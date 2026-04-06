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


# ── 예산 소진율 ───────────────────────────────────────────
import hmac as _hmac, hashlib as _hashlib, base64 as _base64, urllib.request as _urllib_req, urllib.parse as _urllib_parse

BRAND_CREDS = {
    "kucham": {
        "customer_id":    os.environ.get("NAVER_SA_CUSTOMER_ID", "1807556"),
        "access_license": os.environ.get("NAVER_SA_ACCESS_LICENSE", ""),
        "secret_key":     os.environ.get("NAVER_SA_SECRET_KEY", ""),
        "label": "쿠참",
    },
    "uvid": {
        "customer_id":    os.environ.get("NAVER_SA_BW_CUSTOMER_ID", "3527181"),
        "access_license": os.environ.get("NAVER_SA_BW_ACCESS_LICENSE", ""),
        "secret_key":     os.environ.get("NAVER_SA_BW_SECRET_KEY", ""),
        "label": "유비드",
    },
    "meariset": {
        "customer_id":    os.environ.get("NAVER_SA_MS_CUSTOMER_ID", "1910059"),
        "access_license": os.environ.get("NAVER_SA_MS_ACCESS_LICENSE", ""),
        "secret_key":     os.environ.get("NAVER_SA_MS_SECRET_KEY", ""),
        "label": "메아리셋",
    },
    "foremong": {
        "customer_id":    "1748252",
        "access_license": "01000000003dc8d89f2198f105f99520ecf3412b0f0d90bc89f6829ffa13f78f8f9246c3a4",
        "secret_key":     "AQAAAAA9yNifIZjxBfmVIOzzQSsPX2tVsb7x2dm4X407+Di2Yw==",
        "label": "포레몽",
    },
}

_NAVER_SA_BASE = "https://api.naver.com"
_budget_cache: dict = {}
_budget_cache_at: float = 0.0
_BUDGET_TTL = 300  # 5분 캐시

def _sa_request(creds: dict, method: str, path: str, query_str: str = "") -> Any:
    ts = str(int(time.time() * 1000))
    msg = f"{ts}.{method}.{path}"
    sig = _base64.b64encode(
        _hmac.new(creds["secret_key"].encode(), msg.encode(), _hashlib.sha256).digest()
    ).decode()
    url = _NAVER_SA_BASE + path + (f"?{query_str}" if query_str else "")
    req = _urllib_req.Request(url, method=method)
    req.add_header("X-Timestamp", ts)
    req.add_header("X-API-KEY", creds["access_license"])
    req.add_header("X-Customer", creds["customer_id"])
    req.add_header("X-Signature", sig)
    req.add_header("Content-Type", "application/json")
    try:
        with _urllib_req.urlopen(req, timeout=8) as r:
            return json.loads(r.read())
    except Exception:
        return None

def _fetch_budget_for_brand(brand_key: str) -> dict:
    creds = BRAND_CREDS.get(brand_key)
    if not creds or not creds["access_license"]:
        return {"error": "no_credentials"}
    campaigns = _sa_request(creds, "GET", "/ncc/campaigns")
    if not isinstance(campaigns, list):
        return {"error": "api_error"}
    eligible = [c for c in campaigns if c.get("status") == "ELIGIBLE" and int(c.get("dailyBudget", 0) or 0) > 0]
    if not eligible:
        return {"daily_budget": 0, "today_cost": 0, "ratio": 0, "campaigns": []}

    import datetime as _dt
    today = _dt.date.today().strftime("%Y%m%d")
    total_budget = 0
    total_cost = 0
    campaign_details = []
    for cmp in eligible:
        cmp_id = cmp["nccCampaignId"]
        daily_budget = int(cmp.get("dailyBudget", 0) or 0)
        fields_enc = _urllib_parse.quote(json.dumps(["salesAmt"]))
        tr_enc = _urllib_parse.quote(json.dumps({"since": today, "until": today}))
        qs = f"ids={cmp_id}&fields={fields_enc}&timeUnit=TOTAL&timeRange={tr_enc}&type=CAMPAIGN"
        stats = _sa_request(creds, "GET", "/stats", qs)
        today_cost = 0
        if isinstance(stats, dict):
            data = stats.get("data", [])
            if data:
                today_cost = int(data[0].get("salesAmt", 0) or 0)
        total_budget += daily_budget
        total_cost += today_cost
        ratio = round(today_cost / daily_budget * 100, 1) if daily_budget > 0 else 0
        campaign_details.append({
            "name": cmp.get("name", ""),
            "daily_budget": daily_budget,
            "today_cost": today_cost,
            "ratio": ratio,
        })
    overall_ratio = round(total_cost / total_budget * 100, 1) if total_budget > 0 else 0
    # 예상 소진 시각 (선형 추정)
    import datetime as _dt2
    now_h = _dt2.datetime.now().hour + _dt2.datetime.now().minute / 60
    if total_cost > 0 and now_h > 0:
        burn_rate_per_h = total_cost / now_h
        remaining = total_budget - total_cost
        hours_left = remaining / burn_rate_per_h if burn_rate_per_h > 0 else 99
        est_exhaust_h = now_h + hours_left
        est_hhmm = f"{int(est_exhaust_h):02d}:{int((est_exhaust_h % 1) * 60):02d}" if est_exhaust_h < 24 else "24시 이후"
    else:
        est_hhmm = None
    return {
        "daily_budget": total_budget,
        "today_cost": total_cost,
        "ratio": overall_ratio,
        "est_exhaust": est_hhmm,
        "campaigns": campaign_details,
    }

@app.get("/api/budget")
def get_budget():
    global _budget_cache, _budget_cache_at
    now = time.time()
    if now - _budget_cache_at < _BUDGET_TTL and _budget_cache:
        return _budget_cache
    result = {}
    for brand_key in BRAND_CREDS:
        result[brand_key] = _fetch_budget_for_brand(brand_key)
    result["fetched_at"] = datetime.now(timezone.utc).isoformat()
    _budget_cache = result
    _budget_cache_at = now
    return result


# ── 소재 변경 이력 ─────────────────────────────────────────
CREATIVE_HISTORY_FILE = DATA_DIR / "creative_history.json"

@app.get("/api/creative-history")
def get_creative_history():
    return read_json(CREATIVE_HISTORY_FILE, [])

@app.post("/api/creative-history")
def save_creative_history(data: dict):
    history = read_json(CREATIVE_HISTORY_FILE, [])
    # d7_roas 업데이트 또는 신규 항목 추가
    if data.get("action") == "update_roas":
        for item in history:
            if item.get("adgroup") == data.get("adgroup") and item.get("changed_at") == data.get("changed_at"):
                item["d7_roas"] = data.get("d7_roas")
                item["verdict"] = data.get("verdict")
        write_json(CREATIVE_HISTORY_FILE, history)
        return {"ok": True}
    # 신규 추가
    history.append(data)
    write_json(CREATIVE_HISTORY_FILE, history)
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9003, reload=False)
