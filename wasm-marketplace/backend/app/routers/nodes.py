"""
Nodes router:
  POST /api/v1/nodes/results  — contributor node posts execution result
  GET  /api/v1/nodes/health   — node health check
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.function import WasmFunction
from app.models.job import Job
from app.services.pinata import pinata
from app.services.redis_queue import redis_queue

router = APIRouter(prefix="/api/v1/nodes", tags=["Nodes"])


class ResultSubmission(BaseModel):
    job_id: uuid.UUID
    node_id: str
    status: str           # "completed" | "failed"
    output_result: Optional[str] = None
    error_message: Optional[str] = None
    execution_time_ms: float = 0.0
    signature: str = ""   # Ed25519 signature of sha256(job_id + output)


@router.post("/results", status_code=200)
async def submit_result(
    body: ResultSubmission,
    db: AsyncSession = Depends(get_db),
):
    # Fetch job
    result = await db.execute(select(Job).where(Job.id == body.job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status not in ("pending", "dispatched", "running"):
        raise HTTPException(status_code=409, detail=f"Job already in terminal state: {job.status}")

    # Persist result on the job
    job.status = body.status
    job.node_id = body.node_id
    job.output_result = body.output_result
    job.error_message = body.error_message
    job.execution_time_ms = body.execution_time_ms
    job.execution_signature = body.signature
    job.started_at = job.started_at or datetime.now(timezone.utc)
    job.finished_at = datetime.now(timezone.utc)

    await db.flush()

    # Publish to wasm:results stream so invoke endpoint can pick it up
    await redis_queue.publish_result({
        "job_id": str(body.job_id),
        "node_id": body.node_id,
        "status": body.status,
        "output_result": body.output_result or "",
        "error_message": body.error_message or "",
        "execution_time_ms": str(body.execution_time_ms),
        "signature": body.signature,
    })

    return {"ok": True}


@router.get("/health")
async def node_health():
    pinata_ok = await pinata.test_connection()
    return {
        "status": "ok",
        "pinata_connected": pinata_ok,
    }
