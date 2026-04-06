"""
네이버 SA 대시보드 FastAPI 백엔드
포트: 9003
데이터 경로: /home/ben/.openclaw/workspace/data/
"""
import json
import os
import subprocess
import time
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── 경로 설정 ────────────────────────────────────────────
DATA_DIR = Path("/home/ben/.openclaw/workspace/data")
CRON_STATUS_FILE = DATA_DIR / "cron_status.json"
PENDING_FILE = DATA_DIR / "naver_sa_pending.json"
PENDING_EXEC_FILE = DATA_DIR / "pending_execute.json"
SETTINGS_FILE = DATA_DIR / "settings.json"
SA_HISTORY_DIR = DATA_DIR / "sa_history"
KW_LEARNING_FILE = DATA_DIR / "keyword_learning.json"
KW_EXPANSION_FILE = DATA_DIR / "keyword_expansion_candidates.json"

BRANDS = ["kucham", "uvid", "meariset", "foremong"]

DEFAULT_SETTINGS = {
    "brands": {
        "kucham":   {"bep_roas": 220, "target_roas": 1000, "keyword_click_threshold": 30},
        "uvid":     {"bep_roas": 185, "target_roas": 300,  "keyword_click_threshold": 30},
        "meariset": {"bep_roas": 176, "target_roas": 176,  "keyword_click_threshold": 30},
        "foremong": {"bep_roas": 200, "target_roas": 300,  "keyword_click_threshold": 30},
    },
    "verdict": {"up_threshold_pct": 10, "down_threshold_pct": -10},
    "updated_at": "",
    "previous": None,
}

# ── 유틸 ─────────────────────────────────────────────────
def read_json(path: Path, default: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default if default is not None else {}

def write_json(path: Path, data: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

# ── FastAPI ───────────────────────────────────────────────
app = FastAPI(title="Naver SA Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 실행 큐 타이머 ────────────────────────────────────────
_queue_lock = threading.Lock()

def _execute_approved(queue_id: str):
    """5분 후 실행 — pending_execute.json 상태 'pending' → 'executed'"""
    time.sleep(300)  # 5분
    with _queue_lock:
        data = read_json(PENDING_EXEC_FILE, {"queue": []})
        for item in data["queue"]:
            if item["id"] == queue_id and item["status"] == "pending":
                item["status"] = "executed"
                item["executed_at"] = datetime.now(timezone.utc).isoformat()
                # OpenClaw cron trigger
                try:
                    subprocess.run(
                        ["openclaw", "cron", "trigger", "naver-sa-execute"],
                        timeout=30, capture_output=True
                    )
                except Exception as e:
                    item["execute_error"] = str(e)
                break
        write_json(PENDING_EXEC_FILE, data)

# ── 엔드포인트 ────────────────────────────────────────────

@app.get("/health")
def health():
    return {"ok": True, "ts": datetime.now(timezone.utc).isoformat()}


@app.get("/api/pending")
def get_pending():
    return read_json(PENDING_FILE, {"created_at": "", "approved": False, "plans": []})


@app.get("/api/history")
def get_history(brand: str = "all"):
    if brand == "all":
        records = []
        for b in BRANDS:
            f = SA_HISTORY_DIR / f"{b}_sa_history.json"
            records += read_json(f, [])
        records.sort(key=lambda r: r.get("executed_at", ""), reverse=True)
        return records
    else:
        f = SA_HISTORY_DIR / f"{brand}_sa_history.json"
        return read_json(f, [])


@app.get("/api/settings")
def get_settings():
    s = read_json(SETTINGS_FILE, None)
    return s if s else DEFAULT_SETTINGS


@app.get("/api/pending-execute")
def get_pending_execute():
    return read_json(PENDING_EXEC_FILE, {"queue": []})


@app.get("/api/cron-status")
def get_cron_status():
    return read_json(CRON_STATUS_FILE, {"updated_at": "", "crons": []})


@app.get("/api/keyword-learning")
def get_keyword_learning():
    return read_json(KW_LEARNING_FILE, [])


@app.get("/api/keyword-expansion")
def get_keyword_expansion():
    return read_json(KW_EXPANSION_FILE, [])


# ── 승인 ─────────────────────────────────────────────────
class ApproveRequest(BaseModel):
    plans: list[dict]

@app.post("/api/approve")
def approve(req: ApproveRequest):
    with _queue_lock:
        data = read_json(PENDING_EXEC_FILE, {"queue": []})
        # 이미 pending 항목 있으면 덮어쓰지 않음
        pending_exists = any(q["status"] == "pending" for q in data.get("queue", []))
        if pending_exists:
            raise HTTPException(status_code=409, detail="Already a pending execution in queue")
        queue_id = f"exec_{int(time.time())}"
        scheduled_at = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        item = {
            "id": queue_id,
            "status": "pending",
            "plans": req.plans,
            "scheduled_at": scheduled_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        data.setdefault("queue", []).append(item)
        write_json(PENDING_EXEC_FILE, data)

    # 5분 타이머 시작
    t = threading.Thread(target=_execute_approved, args=(queue_id,), daemon=True)
    t.start()
    return {"ok": True, "queue_id": queue_id, "message": "5분 후 실행 예정"}


# ── 취소 ─────────────────────────────────────────────────
@app.post("/api/cancel")
def cancel():
    with _queue_lock:
        data = read_json(PENDING_EXEC_FILE, {"queue": []})
        cancelled = False
        for item in data.get("queue", []):
            if item["status"] == "pending":
                item["status"] = "cancelled"
                item["cancelled_at"] = datetime.now(timezone.utc).isoformat()
                cancelled = True
        write_json(PENDING_EXEC_FILE, data)
    return {"ok": True, "cancelled": cancelled}


# ── 롤백 ─────────────────────────────────────────────────
class RollbackRequest(BaseModel):
    brand: str
    adgroup_id: str

@app.post("/api/rollback")
def rollback(req: RollbackRequest):
    f = SA_HISTORY_DIR / f"{req.brand}_sa_history.json"
    records = read_json(f, [])
    # 해당 adgroup_id 기록 중 가장 최근 2개 → 직전으로 복원
    group_records = [r for r in records if r.get("adgroup_id") == req.adgroup_id]
    group_records.sort(key=lambda r: r.get("executed_at", ""), reverse=True)
    if len(group_records) < 1:
        raise HTTPException(status_code=404, detail="No history for this adgroup")

    target = group_records[0]
    rollback_bid = target.get("prev_bid")
    if not rollback_bid:
        raise HTTPException(status_code=400, detail="No prev_bid in latest record")

    # openclaw cron trigger로 롤백 실행 (pending_execute에 롤백 플랜 추가 후 즉시 실행)
    rollback_plan = {
        "brand": req.brand,
        "adgroup_id": req.adgroup_id,
        "adgroup_name": target.get("adgroup_name", ""),
        "current_bid": target.get("new_bid"),
        "new_bid": rollback_bid,
        "action": "ROLLBACK",
        "reason": f"롤백: {target.get('executed_at', '')[:10]} 변경 이전으로 복원",
        "approved": True,
    }
    with _queue_lock:
        data = read_json(PENDING_EXEC_FILE, {"queue": []})
        queue_id = f"rollback_{int(time.time())}"
        data.setdefault("queue", []).append({
            "id": queue_id,
            "status": "pending",
            "plans": [rollback_plan],
            "is_rollback": True,
            "scheduled_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        write_json(PENDING_EXEC_FILE, data)

    # 롤백은 즉시 실행
    try:
        subprocess.run(
            ["openclaw", "cron", "trigger", "naver-sa-execute"],
            timeout=30, capture_output=True
        )
    except Exception:
        pass

    return {"ok": True, "rollback_bid": rollback_bid, "queue_id": queue_id}


# ── 설정 저장 ─────────────────────────────────────────────
@app.post("/api/settings")
def save_settings(new_settings: dict):
    current = read_json(SETTINGS_FILE, None) or DEFAULT_SETTINGS
    # previous 1단계 보존
    new_settings["previous"] = {
        k: v for k, v in current.items() if k != "previous"
    }
    new_settings["updated_at"] = datetime.now(timezone.utc).isoformat()
    write_json(SETTINGS_FILE, new_settings)
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9003, reload=False)
