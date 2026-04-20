"""
Jobs router:
  GET /api/v1/jobs/      — consumer's job history
  GET /api/v1/jobs/{id}  — single job detail
"""
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.job import Job
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/v1/jobs", tags=["Jobs"])


class JobOut(BaseModel):
    id: uuid.UUID
    function_id: Optional[uuid.UUID]
    consumer_id: uuid.UUID
    node_id: Optional[str]
    status: str
    input_args: dict
    output_result: Optional[str]
    error_message: Optional[str]
    credits_charged: float
    platform_fee: float
    developer_payout: float
    node_payout: float
    execution_signature: Optional[str]
    execution_time_ms: float
    created_at: datetime
    started_at: Optional[datetime]
    finished_at: Optional[datetime]

    model_config = {"from_attributes": True}


@router.get("/", response_model=List[JobOut])
async def list_jobs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job)
        .where(Job.consumer_id == current_user.id)
        .order_by(Job.created_at.desc())
        .limit(100)
    )
    return result.scalars().all()


@router.get("/{job_id}", response_model=JobOut)
async def get_job(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.consumer_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
