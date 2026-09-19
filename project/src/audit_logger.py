"""
audit_logger.py — Statutory Geospatial Audit Logger.
Captures search history, satellite data requests, source switches,
tier-1/tier-2 ingestions, interventions, and security events.

Ponytail principles:
- Single canonical entry point for all audit logging.
- Writes to MongoDB watershed_db.audit_logs when available.
- Resilient in-memory FIFO queue (500 items) + JSONL append log for offline execution.
- Zero external dependencies beyond standard library (collections, json, threading, time).
"""

import os
import json
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Optional, Dict, Any, List

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
AUDIT_LOG_FILE = DATA_DIR / "audit_log.jsonl"

_MEMORY_AUDIT_LOGS = deque(maxlen=500)
_AUDIT_LOCK = Lock()


def _get_mongo_collection():
    """Lazy retrieve MongoDB audit_logs collection."""
    try:
        import mongo_raster_cache as mrc
        if mrc._init_mongo():
            return mrc._mongo_db.audit_logs
    except Exception:
        pass
    return None


def record_audit(
    category: str,
    action: str,
    user: str = "official",
    role: str = "official",
    details: Optional[Dict[str, Any]] = None,
    status: str = "success",
    ip: str = "127.0.0.1",
) -> Dict[str, Any]:
    """
    Record an immutable statutory audit event.
    Categories:
      - 'search': Place geocoding, coordinates lookups
      - 'pipeline': Custom AOI execution, timeline selection
      - 'source_switch': Toggling between Sentinel-2 preview and Bhoonidhi Tier 1
      - 'ingestion': Satellite scene retrieval (Tier 0 Mongo, Tier 1 Bhoonidhi, Tier 2 AWS S3)
      - 'intervention': Ground watershed structures added to registry
      - 'security': Login, registration, role elevation, access rejection
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    record = {
        "timestamp": now_iso,
        "category": category,
        "action": action,
        "user": user or "official",
        "role": role or "official",
        "details": details or {},
        "status": status,
        "ip": ip,
    }

    # 1. Thread-safe in-memory cache
    with _AUDIT_LOCK:
        _MEMORY_AUDIT_LOGS.appendleft(record)

    # 2. Append to local JSONL fallback
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(AUDIT_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
    except Exception as e:
        print(f"--> [AuditLogger] Failed writing to JSONL file: {e}", flush=True)

    # 3. Persistent MongoDB write
    col = _get_mongo_collection()
    if col is not None:
        try:
            # clone doc to avoid pymongo adding _id to record in-memory
            col.insert_one(dict(record))
        except Exception as e:
            print(f"--> [AuditLogger] MongoDB write error: {e}", flush=True)

    return record


def get_audit_logs(
    limit: int = 100,
    category: Optional[str] = None,
    query: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Retrieve audit logs ordered newest to oldest.
    Queries MongoDB first, falls back to in-memory + JSONL.
    """
    logs: List[Dict[str, Any]] = []

    # Try Mongo first
    col = _get_mongo_collection()
    if col is not None:
        try:
            filter_q: Dict[str, Any] = {}
            if category and category != "all":
                filter_q["category"] = category
            if query:
                # Text search across action, user, or details
                filter_q["$or"] = [
                    {"action": {"$regex": query, "$options": "i"}},
                    {"user": {"$regex": query, "$options": "i"}},
                    {"role": {"$regex": query, "$options": "i"}},
                ]
            raw_docs = list(col.find(filter_q, {"_id": 0}).sort("timestamp", -1).limit(limit))
            if raw_docs:
                return raw_docs
        except Exception as e:
            print(f"--> [AuditLogger] MongoDB read error: {e}, using memory fallback", flush=True)

    # Fallback to in-memory & file
    with _AUDIT_LOCK:
        combined = list(_MEMORY_AUDIT_LOGS)

    # If memory is sparse, read JSONL
    if len(combined) < limit and AUDIT_LOG_FILE.exists():
        try:
            with open(AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
                lines = f.readlines()
                for line in reversed(lines):
                    if len(combined) >= limit * 2:
                        break
                    try:
                        item = json.loads(line.strip())
                        if item not in combined:
                            combined.append(item)
                    except Exception:
                        continue
        except Exception:
            pass

    # Apply filters in Python
    filtered = []
    q_lower = query.lower() if query else None
    for r in combined:
        if category and category != "all" and r.get("category") != category:
            continue
        if q_lower:
            text_haystack = f"{r.get('action', '')} {r.get('user', '')} {r.get('role', '')} {json.dumps(r.get('details', {}))}".lower()
            if q_lower not in text_haystack:
                continue
        filtered.append(r)
        if len(filtered) >= limit:
            break

    # Sort descending by timestamp
    filtered.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return filtered[:limit]


def get_audit_summary() -> Dict[str, Any]:
    """Return high-level statutory compliance metrics."""
    logs = get_audit_logs(limit=500)
    total = len(logs)
    searches = sum(1 for x in logs if x.get("category") == "search")
    pipeline_runs = sum(1 for x in logs if x.get("category") == "pipeline")
    ingestions = sum(1 for x in logs if x.get("category") == "ingestion")
    security = sum(1 for x in logs if x.get("category") == "security")
    interventions = sum(1 for x in logs if x.get("category") == "intervention")

    return {
        "total_events": total,
        "searches": searches,
        "pipeline_runs": pipeline_runs,
        "ingestions": ingestions,
        "security_events": security,
        "interventions": interventions,
        "status": "online",
        "storage_mode": "MongoDB + In-Memory Fallback" if _get_mongo_collection() is not None else "In-Memory + JSONL Fallback",
    }
