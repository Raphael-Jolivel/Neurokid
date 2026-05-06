import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uuid
import json
import random
import secrets
from datetime import datetime, timedelta

import bcrypt
from flask import Flask, request, jsonify
from flask_cors import CORS

from db import query_one, query_all, execute
from predictor import CognitivePredictor, score_label
from admin_routes import admin_bp

app = Flask(__name__)

# CORS origins are configurable via env var (comma-separated list).
# In production, set CORS_ORIGINS to the front-end URL (e.g. http://10.18.60.24).
_cors_origins = os.environ.get("CORS_ORIGINS", "*")
_cors_extra = {
    "allow_headers": ["Content-Type", "X-User-Id", "X-OpenAI-Key"],
    "expose_headers": ["Content-Type"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}
if _cors_origins == "*":
    CORS(app, **_cors_extra)
else:
    CORS(app,
         origins=[o.strip() for o in _cors_origins.split(",") if o.strip()],
         **_cors_extra)

predictor = CognitivePredictor()

# Endpoints admin (auth via X-User-Id, role='admin' obligatoire)
app.register_blueprint(admin_bp)

DOMAINS_ORDER = ["Memory", "Logic & Reasoning", "Attention & Focus"]
DIFFICULTIES_ORDER = ["easy", "medium", "hard"]


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    name = data.get("name", "").strip()
    age = int(data.get("age", 0))
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not name:
        return jsonify({"error": "name is required"}), 400
    if not (7 <= age <= 12):
        return jsonify({"error": "Age must be between 7 and 12"}), 400
    if not username:
        return jsonify({"error": "username is required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    existing = query_one("SELECT id FROM users WHERE username = %s", (username,))
    if existing:
        return jsonify({"error": "Username already taken"}), 409

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    child_id = execute(
        "INSERT INTO users (name, age, username, password) VALUES (%s, %s, %s, %s)",
        (name, age, username, hashed)
    )

    return jsonify({
        "message": "Account created successfully.",
        "child_id": child_id,
        "username": username
    }), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    child = query_one("SELECT * FROM users WHERE username = %s", (username,))
    if not child:
        return jsonify({"error": "Invalid username or password"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), child["password"].encode("utf-8")):
        return jsonify({"error": "Invalid username or password"}), 401

    return jsonify({
        "message": "Login successful.",
        "child_id": child["id"],
        "name": child["name"],
        "age": child["age"],
        "username": child["username"],
        "role": child.get("role", "child")
    }), 200


@app.route("/forgotten-password", methods=["POST"])
def forgotten_password():
    data = request.get_json()
    username = data.get("username", "").strip()

    if not username:
        return jsonify({"error": "username is required"}), 400

    child = query_one("SELECT id FROM users WHERE username = %s", (username,))
    # same response either way so attackers can't tell which usernames exist
    if not child:
        return jsonify({"message": "If this account exists, a reset token has been generated."}), 200

    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(hours=1)
    execute(
        "UPDATE users SET reset_token = %s, reset_token_expires = %s WHERE id = %s",
        (token, expires, child["id"])
    )

    return jsonify({
        "message": "Reset token generated (send this to the user by e-mail in production).",
        "reset_token": token,
        "expires_at": expires.isoformat()
    }), 200


@app.route("/forgotten-password/reset", methods=["POST"])
def reset_password():
    data = request.get_json()
    token = data.get("reset_token", "").strip()
    new_password = data.get("new_password", "").strip()

    if not token or not new_password:
        return jsonify({"error": "reset_token and new_password are required"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    child = query_one(
        "SELECT * FROM users WHERE reset_token = %s AND reset_token_expires > %s",
        (token, datetime.utcnow())
    )
    if not child:
        return jsonify({"error": "Invalid or expired reset token"}), 400

    hashed = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    execute(
        "UPDATE users SET password = %s, reset_token = NULL, reset_token_expires = NULL WHERE id = %s",
        (hashed, child["id"])
    )

    return jsonify({"message": "Password reset successfully."}), 200


ADAPTIVE_LOOKBACK = 2
ADAPTIVE_UP_THRESHOLD = 0.75
ADAPTIVE_DOWN_THRESHOLD = 0.35
DEFAULT_START_DIFFICULTY = "medium"


def _choose_adaptive_difficulty(sid):
    # Look at the last N answers and bump the difficulty up or down based on the average score.
    rows = query_all(
        """SELECT difficulty, partial_score, answer_correct
           FROM answers
           WHERE session_id = %s
           ORDER BY answered_at DESC
           LIMIT %s""",
        (sid, ADAPTIVE_LOOKBACK)
    )

    if not rows:
        return DEFAULT_START_DIFFICULTY

    last_difficulty = rows[0]["difficulty"]
    avg = sum(float(r["partial_score"]) for r in rows) / len(rows)

    idx = DIFFICULTIES_ORDER.index(last_difficulty)
    if avg >= ADAPTIVE_UP_THRESHOLD:
        idx = min(idx + 1, len(DIFFICULTIES_ORDER) - 1)
    elif avg <= ADAPTIVE_DOWN_THRESHOLD:
        idx = max(idx - 1, 0)

    return DIFFICULTIES_ORDER[idx]


def get_next_question(sid, index):
    # 9 questions per session = 3 per domain. The domain block changes every 3 questions.
    domain = DOMAINS_ORDER[index // 3]
    target_diff = _choose_adaptive_difficulty(sid)

    used_rows = query_all(
        "SELECT question_id FROM answers WHERE session_id = %s", (sid,)
    )
    used_ids = {r["question_id"] for r in used_rows}

    # try the target difficulty first; if nothing left, pick the closest neighbour
    target_idx = DIFFICULTIES_ORDER.index(target_diff)
    fallback_order = sorted(
        range(len(DIFFICULTIES_ORDER)),
        key=lambda i: abs(i - target_idx)
    )

    chosen = None
    for i in fallback_order:
        diff = DIFFICULTIES_ORDER[i]
        rows = query_all(
            "SELECT * FROM question_bank WHERE domain = %s AND difficulty = %s",
            (domain, diff)
        )
        rows = [r for r in rows if r["id"] not in used_ids]
        if rows:
            chosen = random.choice(rows)
            break

    if chosen is None:
        return None

    chosen["answer_key"] = (
        json.loads(chosen["answer_key"])
        if isinstance(chosen["answer_key"], str)
        else chosen["answer_key"]
    )
    return chosen


@app.route("/session/start", methods=["POST"])
def start_session():
    data = request.get_json()
    child_id = data.get("child_id")

    if not child_id:
        return jsonify({"error": "child_id is required (obtain it from /login)"}), 400

    child = query_one("SELECT * FROM users WHERE id = %s", (child_id,))
    if not child:
        return jsonify({"error": "Child not found. Please register or log in first."}), 404
    if child.get("role") == "admin":
        return jsonify({"error": "Admin accounts cannot take the quiz."}), 403

    session_id = str(uuid.uuid4())
    execute(
        "INSERT INTO sessions (id, child_id, status) VALUES (%s, %s, 'in_progress')",
        (session_id, child_id)
    )

    return jsonify({
        "session_id": session_id,
        "child_id": child_id,
        "message": f"Session started for {child['name']} (age {child['age']})."
    }), 201


@app.route("/session/<sid>/question", methods=["GET"])
def next_question(sid):
    session = query_one("SELECT * FROM sessions WHERE id = %s", (sid,))
    if not session:
        return jsonify({"error": "Session not found"}), 404
    if session["status"] == "complete":
        return jsonify({"error": "Session complete. GET /session/<id>/score"}), 400

    answered = query_one("SELECT COUNT(*) as cnt FROM answers WHERE session_id = %s", (sid,))
    index = answered["cnt"]

    if index >= 9:
        return jsonify({"message": "All 9 questions answered."}), 200

    q = get_next_question(sid, index)
    if not q:
        return jsonify({"error": "No question found in database for this slot."}), 500

    return jsonify({
        "question_index": index,
        "total_questions": 9,
        "question_id": q["id"],
        "domain": q["domain"],
        "difficulty": q["difficulty"],
        "question": q["question_text"],
    }), 200


@app.route("/session/<sid>/answer", methods=["POST"])
def submit_answer(sid):
    session = query_one("SELECT * FROM sessions WHERE id = %s", (sid,))
    if not session:
        return jsonify({"error": "Session not found"}), 404
    if session["status"] == "complete":
        return jsonify({"error": "Session already complete."}), 400

    data = request.get_json()
    raw_answer = data.get("answer", "").strip()
    response_time_sec = float(data.get("response_time_sec", 10.0))
    attempts = int(data.get("attempts", 1))
    question_id = int(data.get("question_id"))

    if not raw_answer:
        return jsonify({"error": "answer cannot be empty"}), 400

    q = query_one("SELECT * FROM question_bank WHERE id = %s", (question_id,))
    if not q:
        return jsonify({"error": "question_id not found"}), 404

    answer_key = json.loads(q["answer_key"]) if isinstance(q["answer_key"], str) else q["answer_key"]
    eval_type = q["eval_type"]

    answer_correct, partial_score = predictor.evaluate_answer(raw_answer, answer_key, eval_type)

    child = query_one("SELECT age FROM users WHERE id = %s", (session["child_id"],))
    age = child["age"]

    predicted_score = predictor.predict_score(
        age=age,
        domain=q["domain"],
        difficulty=q["difficulty"],
        response_time_sec=response_time_sec,
        answer_correct=answer_correct,
        partial_score=partial_score,
        attempts=attempts,
    )

    execute("""
        INSERT INTO answers
            (session_id, child_id, question_id, domain, difficulty, age,
             raw_answer, answer_correct, partial_score, response_time_sec, attempts, predicted_score)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        sid, session["child_id"], question_id, q["domain"], q["difficulty"], age,
        raw_answer, answer_correct, partial_score, response_time_sec, attempts, predicted_score
    ))

    answered = query_one("SELECT COUNT(*) as cnt FROM answers WHERE session_id = %s", (sid,))
    session_complete = answered["cnt"] >= 9

    if session_complete:
        _finalize_session(sid, session["child_id"], age)

    return jsonify({
        "question_index": answered["cnt"] - 1,
        "domain": q["domain"],
        "difficulty": q["difficulty"],
        "answer_correct": answer_correct,
        "partial_score": partial_score,
        "predicted_score": predicted_score,
        "session_complete": session_complete,
    }), 200


def _finalize_session(sid, child_id, age):
    rows = query_all("""
        SELECT domain, difficulty, response_time_sec, answer_correct,
               partial_score, attempts, predicted_score
        FROM answers WHERE session_id = %s ORDER BY answered_at
    """, (sid,))

    report = predictor.build_session_report("", age, rows)

    for domain, info in report["domain_breakdown"].items():
        execute(
            "INSERT INTO domain_scores (session_id, domain, average_score, level) VALUES (%s,%s,%s,%s)",
            (sid, domain, info["average_score"], info["level"])
        )
        # write the domain average back onto each answer row so we can use it as a label when retraining
        execute("""
            UPDATE answers SET cognitive_score = %s
            WHERE session_id = %s AND domain = %s
        """, (info["average_score"], sid, domain))

    execute("""
        UPDATE sessions
        SET status = 'complete', overall_score = %s, overall_level = %s, finished_at = NOW()
        WHERE id = %s
    """, (report["overall_cognitive_score"], report["overall_level"], sid))


@app.route("/session/<sid>/score", methods=["GET"])
def get_score(sid):
    session = query_one("SELECT * FROM sessions WHERE id = %s", (sid,))
    if not session:
        return jsonify({"error": "Session not found"}), 404
    if session["status"] != "complete":
        return jsonify({"error": "Session not yet complete."}), 400

    child = query_one("SELECT * FROM users WHERE id = %s", (session["child_id"],))
    domains = query_all("SELECT * FROM domain_scores WHERE session_id = %s", (sid,))
    answers = query_all("SELECT * FROM answers WHERE session_id = %s ORDER BY answered_at", (sid,))

    domain_breakdown = {
        d["domain"]: {"average_score": d["average_score"], "level": d["level"]}
        for d in domains
    }

    return jsonify({
        "session_id": sid,
        "child_name": child["name"],
        "age": child["age"],
        "overall_cognitive_score": session["overall_score"],
        "overall_level": session["overall_level"],
        "domain_breakdown": domain_breakdown,
        "answer_details": [
            {
                "domain": a["domain"],
                "difficulty": a["difficulty"],
                "raw_answer": a["raw_answer"],
                "answer_correct": a["answer_correct"],
                "partial_score": a["partial_score"],
                "response_time_sec": a["response_time_sec"],
                "predicted_score": a["predicted_score"],
            } for a in answers
        ],
        "model_metrics": predictor.metrics,
    }), 200


@app.route("/session/<sid>/status", methods=["GET"])
def get_status(sid):
    session = query_one("SELECT * FROM sessions WHERE id = %s", (sid,))
    if not session:
        return jsonify({"error": "Session not found"}), 404

    answered = query_one("SELECT COUNT(*) as cnt FROM answers WHERE session_id = %s", (sid,))
    child = query_one("SELECT * FROM users WHERE id = %s", (session["child_id"],))

    return jsonify({
        "session_id": sid,
        "child_name": child["name"],
        "age": child["age"],
        "answers_given": answered["cnt"],
        "total_questions": 9,
        "status": session["status"],
    }), 200


@app.route("/model/info", methods=["GET"])
def model_info():
    total_answers = query_one("SELECT COUNT(*) as cnt FROM answers WHERE cognitive_score IS NOT NULL")
    total_sessions = query_one("SELECT COUNT(*) as cnt FROM sessions WHERE status = 'complete'")
    return jsonify({
        "model_features": predictor.features,
        "model_metrics": predictor.metrics,
        "completed_sessions": total_sessions["cnt"],
        "training_rows_available": total_answers["cnt"],
        "domains": DOMAINS_ORDER,
        "age_range": "7-12",
    }), 200


@app.route("/model/retrain", methods=["POST"])
def retrain():
    result = predictor.retrain()
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result), 200


@app.route("/children", methods=["GET"])
def list_children():
    rows = query_all(
        "SELECT * FROM users WHERE role = 'child' ORDER BY created_at DESC"
    )
    return jsonify(rows), 200


@app.route("/children/<int:child_id>/history", methods=["GET"])
def child_history(child_id):
    child = query_one(
        "SELECT * FROM users WHERE id = %s AND role = 'child'", (child_id,)
    )
    if not child:
        return jsonify({"error": "Child not found"}), 404
    sessions = query_all("""
        SELECT id, status, overall_score, overall_level, started_at, finished_at
        FROM sessions WHERE child_id = %s ORDER BY started_at DESC
    """, (child_id,))
    return jsonify({"child": child, "sessions": sessions}), 200


# Health-check endpoint (used by Docker healthcheck and reverse proxy)
@app.route("/health", methods=["GET"])
def health():
    try:
        query_one("SELECT 1 AS ok")
        return jsonify({"status": "ok", "db": "up"}), 200
    except Exception as e:
        return jsonify({"status": "degraded", "db": "down", "error": str(e)}), 503


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    port  = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=debug)
