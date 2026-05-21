"""
Functions router:
  POST   /api/v1/functions/upload
  GET    /api/v1/functions/
  GET    /api/v1/functions/my
  GET    /api/v1/functions/{id}
  POST   /api/v1/functions/{id}/invoke
  DELETE /api/v1/functions/{id}
"""
import asyncio
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.function import WasmFunction
from app.models.job import Job
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.pinata import pinata
from app.services.redis_queue import redis_queue

router = APIRouter(prefix="/api/v1/functions", tags=["Functions"])

MAX_WASM_SIZE = 10 * 1024 * 1024  # 10 MB


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class FunctionOut(BaseModel):
    id: uuid.UUID
    developer_id: uuid.UUID
    name: str
    description: Optional[str]
    version: str
    ipfs_cid: str
    gateway_url: str
    file_size_bytes: int
    source_language: str
    price_per_call: float
    total_calls: int
    total_earnings: float
    is_public: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class InvokeRequest(BaseModel):
    args: dict = {}


class InvokeResponse(BaseModel):
    job_id: str
    status: str
    output_result: Optional[str]
    error_message: Optional[str]
    execution_time_ms: float
    credits_charged: float


# ── Billing helper ────────────────────────────────────────────────────────────

def calculate_billing(price: float, platform_pct: float):
    platform_fee = round(price * (platform_pct / 100), 6)
    net = price - platform_fee
    developer_payout = round(net * 0.70, 6)  # 70% of net = 56% of total
    node_payout = round(net * 0.30, 6)       # 30% of net = 24% of total
    return platform_fee, developer_payout, node_payout


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=FunctionOut, status_code=201)
async def upload_function(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(""),
    version: str = Form("1.0.0"),
    source_language: str = Form("rust"),
    price_per_call: float = Form(1.0),
    is_public: bool = Form(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.endswith(".wasm"):
        raise HTTPException(status_code=400, detail="Only .wasm files are accepted")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_WASM_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    # Upload to Pinata IPFS
    try:
        pinata_result = await pinata.upload_wasm(
            file_bytes=file_bytes,
            function_name=name,
            developer_id=str(current_user.id),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=f"Pinata upload failed: {exc}")

    fn = WasmFunction(
        developer_id=current_user.id,
        name=name,
        description=description,
        version=version,
        ipfs_cid=pinata_result["cid"],
        gateway_url=pinata_result["gateway_url"],
        file_size_bytes=pinata_result["size"],
        source_language=source_language,
        price_per_call=price_per_call,
        is_public=is_public,
    )
    db.add(fn)
    await db.flush()
    await db.refresh(fn)
    return fn


@router.get("/", response_model=List[FunctionOut])
async def list_public_functions(
    language: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(WasmFunction).where(
        WasmFunction.is_public == True,
        WasmFunction.is_active == True,
    )
    if language:
        query = query.where(WasmFunction.source_language == language)
    result = await db.execute(query.order_by(WasmFunction.total_calls.desc()))
    return result.scalars().all()


@router.get("/my", response_model=List[FunctionOut])
async def list_my_functions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WasmFunction)
        .where(WasmFunction.developer_id == current_user.id)
        .order_by(WasmFunction.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{function_id}", response_model=FunctionOut)
async def get_function(function_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WasmFunction).where(WasmFunction.id == function_id))
    fn = result.scalar_one_or_none()
    if not fn:
        raise HTTPException(status_code=404, detail="Function not found")
    return fn


@router.post("/{function_id}/invoke", response_model=InvokeResponse)
async def invoke_function(
    function_id: uuid.UUID,
    body: InvokeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch function
    result = await db.execute(
        select(WasmFunction).where(
            WasmFunction.id == function_id,
            WasmFunction.is_active == True,
        )
    )
    fn = result.scalar_one_or_none()
    if not fn:
        raise HTTPException(status_code=404, detail="Function not found or inactive")

    # Check credits
    if current_user.credits < fn.price_per_call:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    # Deduct credits
    current_user.credits -= fn.price_per_call

    # Calculate billing
    platform_fee, developer_payout, node_payout = calculate_billing(
        fn.price_per_call, settings.PLATFORM_FEE_PERCENT
    )

    # Create job
    job = Job(
        function_id=fn.id,
        consumer_id=current_user.id,
        status="dispatched",
        input_args=body.args,
        credits_charged=fn.price_per_call,
        platform_fee=platform_fee,
        developer_payout=developer_payout,
        node_payout=node_payout,
    )
    db.add(job)

    # COMMIT so the node's POST /results can see the job in its own session
    await db.commit()
    await db.refresh(job)
    await db.refresh(fn)
    await db.refresh(current_user)

    # Publish to Redis Stream
    await redis_queue.publish_job({
        "job_id": str(job.id),
        "function_id": str(fn.id),
        "ipfs_cid": fn.ipfs_cid,
        "gateway_url": fn.gateway_url,
        "args": body.args,
        "consumer_id": str(current_user.id),
    })

    # Wait for result from node (30s timeout)
    result_data = await redis_queue.wait_for_result(str(job.id), timeout=30.0)

    if result_data is None:
        # Timeout — refund credits
        current_user.credits += fn.price_per_call
        job.status = "timeout"
        job.error_message = "Execution timed out after 30 seconds"
        await db.commit()
        return InvokeResponse(
            job_id=str(job.id),
            status="timeout",
            output_result=None,
            error_message=job.error_message,
            execution_time_ms=0,
            credits_charged=0,
        )

    # Settle billing on success
    if result_data.get("status") == "completed":
        fn.total_calls += 1
        fn.total_earnings += developer_payout
        job.status = "completed"
        job.output_result = str(result_data.get("output_result", ""))
        job.execution_signature = result_data.get("signature", "")
        job.execution_time_ms = float(result_data.get("execution_time_ms", 0))
        job.node_id = result_data.get("node_id", "")
        job.finished_at = datetime.now(timezone.utc)
    else:
        # Failed — refund
        current_user.credits += fn.price_per_call
        job.status = "failed"
        job.error_message = result_data.get("error_message", "Unknown error")
        job.finished_at = datetime.now(timezone.utc)

    await db.commit()

    return InvokeResponse(
        job_id=str(job.id),
        status=job.status,
        output_result=job.output_result,
        error_message=job.error_message,
        execution_time_ms=job.execution_time_ms,
        credits_charged=fn.price_per_call if job.status == "completed" else 0,
    )


@router.delete("/{function_id}", status_code=204)
async def delete_function(
    function_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WasmFunction).where(
            WasmFunction.id == function_id,
            WasmFunction.developer_id == current_user.id,
        )
    )
    fn = result.scalar_one_or_none()
    if not fn:
        raise HTTPException(status_code=404, detail="Function not found or access denied")

    # Unpin from Pinata
    await pinata.unpin_wasm(fn.ipfs_cid)

    await db.delete(fn)
