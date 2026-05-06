# 🧠 Cognitive Assessment API — MySQL Edition

## Setup

### 1. Database
Open **phpMyAdmin** → SQL tab → paste and run `cognitive_assessment.sql`

This creates 5 tables and seeds 27 questions into the question bank.

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure MySQL credentials
Set environment variables (or edit `db.py` directly):
```bash
set DB_HOST=localhost
set DB_USER=root
set DB_PASSWORD=          # XAMPP default is empty
set DB_NAME=cognitive_assessment
```

### 4. Copy model files
Make sure these exist in a `model/` folder next to `app.py`:
- `model/cognitive_model.joblib`
- `model/feature_columns.json`

(Copy from your previous `cognitive_ml/model/` folder)

### 5. Run
```bash
python app.py
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/session/start` | Start a new session |
| GET | `/session/<id>/question` | Get next question |
| POST | `/session/<id>/answer` | Submit answer (AI auto-evaluates) |
| GET | `/session/<id>/score` | Get full cognitive report |
| GET | `/session/<id>/status` | Check session progress |
| GET | `/model/info` | Model metrics + DB stats |
| POST | `/model/retrain` | Retrain model from MySQL data |
| GET | `/children` | List all children |
| GET | `/children/<id>/history` | Session history for a child |

---

## Answer flow

```
POST /session/<id>/answer
{
  "question_id": 3,          ← from GET /question response
  "answer": "elephant",      ← child's raw text answer
  "response_time_sec": 8.5,
  "attempts": 1
}
```

The AI automatically determines `answer_correct` and `partial_score`
by comparing the answer against the question's `answer_key` in the database.

---

## Retraining

Every completed session writes `cognitive_score` back to the `answers` table.
Once you have 50+ real rows, call:

```
POST /model/retrain
```

The model retrains on real data and replaces the synthetic one automatically.

---

## Database schema

```
children       → id, name, age
sessions       → id, child_id, status, overall_score, overall_level
question_bank  → id, domain, difficulty, question_text, answer_key, eval_type
answers        → session_id, child_id, question_id, raw_answer,
                 answer_correct, partial_score, response_time_sec,
                 predicted_score, cognitive_score  ← retraining label
domain_scores  → session_id, domain, average_score, level
```
