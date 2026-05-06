"""
Endpoints réservés aux administrateurs.

Modèle d'auth simple (alignée sur le reste de l'app) :
- chaque requête doit porter l'en-tête X-User-Id (l'ID renvoyé par /login)
- on vérifie en BDD que l'utilisateur a bien role='admin'
- si KO : 401 / 403

La cle API du fournisseur LLM (Gemini par defaut) N'EST JAMAIS
stockee cote serveur. Elle est passee dans le header X-OpenAI-Key
(nom historique conserve) uniquement le temps d'une requete de
generation, puis oubliee.
"""

import json
import os
import urllib.request
import urllib.error
from functools import wraps

from flask import Blueprint, request, jsonify

from db import query_one, query_all, execute


admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


# ----------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------

DOMAINS = ("Memory", "Logic & Reasoning", "Attention & Focus")
DIFFICULTIES = ("easy", "medium", "hard")
EVAL_TYPES = ("contains", "sequence")


def require_admin(fn):
    """Décorateur : exige X-User-Id correspondant à un compte role='admin'."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id = request.headers.get("X-User-Id")
        if not user_id:
            return jsonify({"error": "X-User-Id header missing"}), 401
        try:
            uid = int(user_id)
        except ValueError:
            return jsonify({"error": "X-User-Id must be an integer"}), 400
        user = query_one("SELECT id, role FROM users WHERE id = %s", (uid,))
        if not user:
            return jsonify({"error": "Unknown user"}), 401
        if user["role"] != "admin":
            return jsonify({"error": "Admin role required"}), 403
        return fn(*args, **kwargs)
    return wrapper


def _validate_question_payload(data):
    """Renvoie (errors_list, cleaned_dict)."""
    errors = []
    domain = (data.get("domain") or "").strip()
    difficulty = (data.get("difficulty") or "").strip().lower()
    question_text = (data.get("question_text") or "").strip()
    answer_key = data.get("answer_key")
    eval_type = (data.get("eval_type") or "contains").strip().lower()
    source = (data.get("source") or "admin").strip().lower()

    if domain not in DOMAINS:
        errors.append(f"domain must be one of {DOMAINS}")
    if difficulty not in DIFFICULTIES:
        errors.append(f"difficulty must be one of {DIFFICULTIES}")
    if not question_text:
        errors.append("question_text is required")
    if eval_type not in EVAL_TYPES:
        errors.append(f"eval_type must be one of {EVAL_TYPES}")
    if source not in ("admin", "ai", "seed"):
        errors.append("source must be one of admin/ai/seed")

    # answer_key peut arriver comme list ou comme str JSON.
    if isinstance(answer_key, str):
        try:
            answer_key = json.loads(answer_key)
        except json.JSONDecodeError:
            errors.append("answer_key must be a JSON list or a list of strings")
    if not isinstance(answer_key, list) or not answer_key:
        errors.append("answer_key must be a non-empty list of strings")
    else:
        answer_key = [str(x).strip() for x in answer_key if str(x).strip()]
        if not answer_key:
            errors.append("answer_key cannot be empty after trimming")

    return errors, {
        "domain": domain,
        "difficulty": difficulty,
        "question_text": question_text,
        "answer_key": answer_key,
        "eval_type": eval_type,
        "source": source,
    }


# ================================================================
# 1) Vue d'ensemble
# ================================================================
@admin_bp.route("/overview", methods=["GET"])
@require_admin
def overview():
    users    = query_one("SELECT COUNT(*) AS c FROM users WHERE role = 'child'")
    sessions = query_one("SELECT COUNT(*) AS c FROM sessions")
    completed = query_one("SELECT COUNT(*) AS c FROM sessions WHERE status='complete'")
    questions = query_one("SELECT COUNT(*) AS c FROM question_bank")
    return jsonify({
        "users_count": users["c"],
        "sessions_total": sessions["c"],
        "sessions_completed": completed["c"],
        "questions_count": questions["c"],
    }), 200


# ================================================================
# 2) Utilisateurs : liste + anonymisation
# ================================================================
@admin_bp.route("/users", methods=["GET"])
@require_admin
def list_users():
    rows = query_all("""
        SELECT u.id, u.name, u.age, u.username, u.role, u.created_at,
               (SELECT COUNT(*) FROM sessions s WHERE s.child_id = u.id)
                   AS sessions_count
        FROM users u
        ORDER BY u.created_at DESC
    """)
    return jsonify(rows), 200


@admin_bp.route("/users/<int:user_id>/anonymize", methods=["POST"])
@require_admin
def anonymize_user(user_id):
    user = query_one("SELECT id, role, username FROM users WHERE id = %s", (user_id,))
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user["role"] == "admin":
        return jsonify({"error": "Cannot anonymize an admin account"}), 400

    # On vide les PII mais on garde l'id, la ligne et donc les sessions/réponses.
    anon_username = f"anon_{user_id}"
    execute("""
        UPDATE users
        SET name = 'Anonyme',
            username = %s,
            password = '!disabled!',
            reset_token = NULL,
            reset_token_expires = NULL
        WHERE id = %s
    """, (anon_username, user_id))

    return jsonify({
        "message": "User anonymised. Sessions and answers were preserved.",
        "user_id": user_id,
        "new_username": anon_username,
    }), 200


# ================================================================
# 3) Sessions : liste + suppression
# ================================================================
@admin_bp.route("/sessions", methods=["GET"])
@require_admin
def list_sessions():
    rows = query_all("""
        SELECT s.id, s.child_id, s.status, s.overall_score, s.overall_level,
               s.started_at, s.finished_at,
               u.username AS child_username, u.name AS child_name
        FROM sessions s
        LEFT JOIN users u ON u.id = s.child_id
        ORDER BY s.started_at DESC
        LIMIT 500
    """)
    return jsonify(rows), 200


@admin_bp.route("/sessions/<sid>", methods=["DELETE"])
@require_admin
def delete_session(sid):
    session = query_one("SELECT id FROM sessions WHERE id = %s", (sid,))
    if not session:
        return jsonify({"error": "Session not found"}), 404
    # ON DELETE CASCADE -> answers + domain_scores supprimés automatiquement.
    execute("DELETE FROM sessions WHERE id = %s", (sid,))
    return jsonify({"message": "Session deleted.", "session_id": sid}), 200


# ================================================================
# 4) Questions : CRUD complet
# ================================================================
@admin_bp.route("/questions", methods=["GET"])
@require_admin
def list_questions():
    domain = request.args.get("domain")
    difficulty = request.args.get("difficulty")
    sql = "SELECT * FROM question_bank WHERE 1=1"
    params = []
    if domain:
        sql += " AND domain = %s"; params.append(domain)
    if difficulty:
        sql += " AND difficulty = %s"; params.append(difficulty)
    sql += " ORDER BY id DESC"
    rows = query_all(sql, tuple(params))
    # answer_key peut être string ou déjà list selon le driver
    for r in rows:
        if isinstance(r.get("answer_key"), str):
            try:
                r["answer_key"] = json.loads(r["answer_key"])
            except json.JSONDecodeError:
                pass
    return jsonify(rows), 200


@admin_bp.route("/questions", methods=["POST"])
@require_admin
def create_question():
    data = request.get_json() or {}
    errors, q = _validate_question_payload(data)
    if errors:
        return jsonify({"errors": errors}), 400
    new_id = execute("""
        INSERT INTO question_bank
            (domain, difficulty, question_text, answer_key, eval_type, source)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        q["domain"], q["difficulty"], q["question_text"],
        json.dumps(q["answer_key"]), q["eval_type"], q["source"]
    ))
    return jsonify({"message": "Question created.", "id": new_id}), 201


@admin_bp.route("/questions/<int:qid>", methods=["PUT"])
@require_admin
def update_question(qid):
    existing = query_one("SELECT id FROM question_bank WHERE id = %s", (qid,))
    if not existing:
        return jsonify({"error": "Question not found"}), 404
    data = request.get_json() or {}
    errors, q = _validate_question_payload(data)
    if errors:
        return jsonify({"errors": errors}), 400
    execute("""
        UPDATE question_bank
        SET domain = %s, difficulty = %s, question_text = %s,
            answer_key = %s, eval_type = %s
        WHERE id = %s
    """, (
        q["domain"], q["difficulty"], q["question_text"],
        json.dumps(q["answer_key"]), q["eval_type"], qid
    ))
    return jsonify({"message": "Question updated.", "id": qid}), 200


@admin_bp.route("/questions/<int:qid>", methods=["DELETE"])
@require_admin
def delete_question(qid):
    # Bloque si la question a déjà été utilisée pour préserver l'intégrité
    # référentielle de la table answers.
    in_use = query_one("SELECT COUNT(*) AS c FROM answers WHERE question_id = %s", (qid,))
    if in_use["c"] > 0:
        return jsonify({
            "error": "Cannot delete a question that has been answered. "
                     "Edit it instead, or anonymize the related users."
        }), 409
    execute("DELETE FROM question_bank WHERE id = %s", (qid,))
    return jsonify({"message": "Question deleted.", "id": qid}), 200


# ================================================================
# 5) Generation IA d'une question via un modele LLM
# ================================================================
# Par defaut on utilise Google Gemini via son endpoint compatible
# OpenAI (chat/completions). La cle est passee dans l'en-tete
# X-OpenAI-Key (nom historique) et n'est jamais persistee cote
# serveur. URL et modele sont configurables par variables d'env
# (LLM_URL, LLM_MODEL) pour pouvoir basculer fournisseur sans
# toucher au code (Gemini, OpenAI, Groq, OpenRouter, etc.).

LLM_MODEL = os.environ.get("LLM_MODEL", "gemini-2.5-flash")
LLM_URL   = os.environ.get(
    "LLM_URL",
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
)

PROMPT_TEMPLATE = """You are a designer of cognitive tests for children aged 7 to 12.
Generate ONE cognitive assessment question in English for the domain "{domain}".

EXPECTED output format: a STRICT JSON object, with no surrounding text, containing
EXACTLY these fields:

{{
  "question_text": "string - the question asked to the child",
  "answer_key":    ["string", ...],
  "eval_type":     "contains" or "sequence",
  "suggested_difficulty": "easy" or "medium" or "hard"
}}

Rules:
- "contains"  : the child's answer is correct if it contains ALL the keywords.
- "sequence"  : the answer must contain the keywords IN THE ORDER given.
- Domain "Memory"            : memorization, recalling items.
- Domain "Logic & Reasoning" : deduction, logical sequences, simple arithmetic.
- Domain "Attention & Focus" : counting, spotting, resisting distractions.
- No emojis, English language, level suited to ages 7-12.
- Give your best estimate of the difficulty ("suggested_difficulty");
  the admin will confirm or change it afterwards.
"""


@admin_bp.route("/questions/generate", methods=["POST"])
@require_admin
def generate_question():
    data = request.get_json() or {}
    domain = (data.get("domain") or "").strip()
    if domain not in DOMAINS:
        return jsonify({"error": f"domain must be one of {DOMAINS}"}), 400

    # Le front envoie la cle dans l'en-tete X-OpenAI-Key (nom conserve
    # pour ne pas casser les conventions, mais c'est en realite la cle
    # du fournisseur LLM courant - Gemini par defaut).
    api_key = request.headers.get("X-OpenAI-Key", "").strip()
    if not api_key:
        return jsonify({
            "error": "Missing API key. Enter the Gemini key in the admin panel."
        }), 400

    prompt = PROMPT_TEMPLATE.format(domain=domain)
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": "You reply only with valid JSON."},
            {"role": "user",   "content": prompt},
        ],
        "temperature": 0.8,
    }

    req = urllib.request.Request(
        LLM_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type":  "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            data = json.loads(body)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        return jsonify({
            "error": "LLM API call failed",
            "status_code": e.code,
            "details": err_body[:500],
        }), 502
    except urllib.error.URLError as e:
        return jsonify({
            "error": "Cannot reach LLM API",
            "details": str(e),
        }), 502

    try:
        content = data["choices"][0]["message"]["content"].strip()
        # Certains modeles (Gemini notamment) entourent le JSON de
        # ```json ... ```. On nettoie avant parsing.
        if content.startswith("```"):
            content = content.strip("`").strip()
            if content.lower().startswith("json"):
                content = content[4:].strip()
        question = json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        return jsonify({
            "error": "Reponse LLM mal formee",
            "details": str(e),
            "raw": data,
        }), 502

    # On renvoie la question SANS la sauvegarder. Le front l'affiche,
    # l'admin la valide ou la rejette. La validation passe par le
    # POST /admin/questions classique avec source='ai'.
    return jsonify({
        "domain": domain,
        "question_text":        question.get("question_text", ""),
        "answer_key":           question.get("answer_key", []),
        "eval_type":            question.get("eval_type", "contains"),
        "suggested_difficulty": question.get("suggested_difficulty", "medium"),
        "source": "ai",
    }), 200
