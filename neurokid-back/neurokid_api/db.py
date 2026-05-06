"""
Connection pool to MariaDB / MySQL.

`mysql-connector-python` parle nativement le protocole MySQL 4.1+, qui est
strictement compatible avec MariaDB 10.x (c'est le même wire-protocol).
On peut donc cibler indifféremment MySQL ou MariaDB sans changer une ligne.

Au démarrage en environnement Docker, le conteneur de l'API peut booter
avant que la base ne soit prête à accepter des connexions, en particulier
au tout premier `docker compose up` (initialisation du volume +
exécution de `cognitive_assessment.sql`).  On retente donc la création
du pool pendant `STARTUP_TIMEOUT` secondes (défaut 60) avant d'abandonner.
"""

import os
import time
import logging

import mysql.connector
from mysql.connector import pooling


log = logging.getLogger(__name__)


DB_CONFIG = {
    "host":     os.environ.get("DB_HOST", "localhost"),
    "port":     int(os.environ.get("DB_PORT", 3306)),
    "user":     os.environ.get("DB_USER", "root"),
    "password": os.environ.get("DB_PASSWORD", ""),
    "database": os.environ.get("DB_NAME", "cognitive_assessment"),
    "charset":  "utf8mb4",
}

# Total time we'll wait for the DB to become reachable before crashing.
STARTUP_TIMEOUT = int(os.environ.get("DB_STARTUP_TIMEOUT", 60))
RETRY_INTERVAL  = 2  # seconds


def _build_pool():
    """Try to create the connection pool, retrying until STARTUP_TIMEOUT."""
    deadline = time.time() + STARTUP_TIMEOUT
    last_err = None
    while time.time() < deadline:
        try:
            return pooling.MySQLConnectionPool(
                pool_name="cog_pool",
                pool_size=5,
                **DB_CONFIG,
            )
        except mysql.connector.Error as err:
            last_err = err
            log.warning(
                "DB not ready yet (%s) - retrying in %ss",
                err, RETRY_INTERVAL,
            )
            time.sleep(RETRY_INTERVAL)
    raise RuntimeError(
        f"Could not connect to DB at {DB_CONFIG['host']}:{DB_CONFIG['port']} "
        f"after {STARTUP_TIMEOUT}s. Last error: {last_err}"
    )


_pool = _build_pool()


def get_conn():
    return _pool.get_connection()


def query_one(sql, params=()):
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        return cur.fetchone()
    finally:
        conn.close()


def query_all(sql, params=()):
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        return cur.fetchall()
    finally:
        conn.close()


def execute(sql, params=()):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def execute_many(sql, params_list):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.executemany(sql, params_list)
        conn.commit()
    finally:
        conn.close()
