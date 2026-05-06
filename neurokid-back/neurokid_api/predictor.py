import os
import json
import joblib
import numpy as np
import pandas as pd

DOMAINS = ["Memory", "Logic & Reasoning", "Attention & Focus"]
DIFFICULTIES = ["easy", "medium", "hard"]
DOMAIN_ENC = {d: i for i, d in enumerate(DOMAINS)}
DIFFICULTY_ENC = {d: i for i, d in enumerate(DIFFICULTIES)}

SCORE_LABELS = [
    (8.5, "Excellent"),
    (7.0, "Good"),
    (5.0, "Average"),
    (3.0, "Needs Practice"),
    (0.0, "Developing"),
]

FEATURE_COLS = [
    "age", "domain_enc", "difficulty_enc",
    "response_time_sec", "answer_correct", "partial_score", "attempts"
]


def score_label(score):
    for threshold, label in SCORE_LABELS:
        if score >= threshold:
            return label
    return "Developing"


class CognitivePredictor:

    def __init__(self, model_path=None):
        base = os.path.dirname(os.path.abspath(__file__))
        if model_path is None:
            model_path = os.path.join(base, "model", "cognitive_model.joblib")
        self.model_path = model_path
        meta_path = os.path.join(os.path.dirname(model_path), "feature_columns.json")

        self.model = joblib.load(model_path)
        with open(meta_path) as f:
            meta = json.load(f)
        self.features = meta["features"]
        self.metrics = meta.get("metrics", {})

    def evaluate_answer(self, raw_answer, answer_key, eval_type):
        text = raw_answer.lower().strip()
        key = [k.lower() for k in answer_key]

        if eval_type == "contains":
            matches = sum(1 for k in key if k in text)
            partial = round(matches / len(key), 2)
            correct = 1 if matches >= 1 else 0

        elif eval_type == "sequence":
            # walk the text from left to right, each key must appear after the previous one
            matches = 0
            last_pos = -1
            for k in key:
                pos = text.find(k, last_pos + 1)
                if pos != -1:
                    matches += 1
                    last_pos = pos
            partial = round(matches / len(key), 2)
            correct = 1 if partial >= 0.5 else 0

        else:
            correct, partial = 0, 0.0

        return correct, partial

    def predict_score(self, age, domain, difficulty,
                      response_time_sec, answer_correct, partial_score, attempts):
        x = pd.DataFrame([{
            "age": age,
            "domain_enc": DOMAIN_ENC[domain],
            "difficulty_enc": DIFFICULTY_ENC[difficulty],
            "response_time_sec": response_time_sec,
            "answer_correct": answer_correct,
            "partial_score": partial_score,
            "attempts": attempts,
        }])[self.features]
        score = self.model.predict(x)[0]
        return round(float(np.clip(score, 0, 10)), 2)

    def build_session_report(self, child_name, age, answers):
        domain_scores = {d: [] for d in DOMAINS}
        detailed = []

        for ans in answers:
            score = self.predict_score(
                age=age,
                domain=ans["domain"],
                difficulty=ans["difficulty"],
                response_time_sec=ans["response_time_sec"],
                answer_correct=ans["answer_correct"],
                partial_score=ans["partial_score"],
                attempts=ans.get("attempts", 1),
            )
            domain_scores[ans["domain"]].append(score)
            detailed.append({**ans, "predicted_score": score})

        domain_breakdown = {}
        for domain, scores in domain_scores.items():
            avg = round(sum(scores) / len(scores), 2) if scores else 0.0
            domain_breakdown[domain] = {
                "average_score": avg,
                "level": score_label(avg),
                "individual_scores": scores,
            }

        overall = round(
            sum(v["average_score"] for v in domain_breakdown.values()) / len(domain_breakdown), 2
        )
        return {
            "child_name": child_name,
            "age": age,
            "overall_cognitive_score": overall,
            "overall_level": score_label(overall),
            "domain_breakdown": domain_breakdown,
            "answer_details": detailed,
            "model_metrics": self.metrics,
        }

    def retrain(self):
        from db import query_all
        from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
        from sklearn.model_selection import train_test_split, cross_val_score
        from sklearn.metrics import mean_absolute_error, r2_score

        rows = query_all("""
            SELECT a.age, a.domain, a.difficulty,
                   a.response_time_sec, a.answer_correct,
                   a.partial_score, a.attempts, a.cognitive_score
            FROM answers a
            INNER JOIN sessions s ON a.session_id = s.id
            WHERE s.status = 'complete'
              AND a.cognitive_score IS NOT NULL
        """)

        if len(rows) < 50:
            return {"error": f"Not enough data to retrain (got {len(rows)} rows, need at least 50)"}

        df = pd.DataFrame(rows)
        df["domain_enc"] = df["domain"].map(DOMAIN_ENC)
        df["difficulty_enc"] = df["difficulty"].map(DIFFICULTY_ENC)

        X = df[FEATURE_COLS]
        y = df["cognitive_score"]

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        models = {
            "RandomForest": RandomForestRegressor(n_estimators=200, max_depth=8, random_state=42, n_jobs=-1),
            "GradientBoosting": GradientBoostingRegressor(n_estimators=200, learning_rate=0.05, max_depth=4, random_state=42),
        }

        # train both, then keep whichever has the best cross-validated R²
        results = {}
        for name, m in models.items():
            m.fit(X_train, y_train)
            preds = m.predict(X_test)
            cv = cross_val_score(m, X, y, cv=5, scoring="r2")
            results[name] = {
                "model": m,
                "mae": round(mean_absolute_error(y_test, preds), 4),
                "r2": round(r2_score(y_test, preds), 4),
                "cv_r2": round(cv.mean(), 4),
            }

        best_name = max(results, key=lambda k: results[k]["cv_r2"])
        best = results[best_name]

        joblib.dump(best["model"], self.model_path)
        meta = {
            "features": FEATURE_COLS,
            "best_model": best_name,
            "metrics": {"mae": best["mae"], "r2": best["r2"], "cv_r2": best["cv_r2"]},
            "trained_on_rows": len(df),
        }
        meta_path = os.path.join(os.path.dirname(self.model_path), "feature_columns.json")
        with open(meta_path, "w") as f:
            json.dump(meta, f, indent=2)

        self.model = joblib.load(self.model_path)
        self.metrics = meta["metrics"]

        return {
            "status": "retrained",
            "best_model": best_name,
            "trained_on_rows": len(df),
            "metrics": meta["metrics"],
        }
