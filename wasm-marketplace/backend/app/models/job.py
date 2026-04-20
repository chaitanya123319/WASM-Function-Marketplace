import uuid
from datetime import datetime, timezone

from sqlalchemy import Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    function_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("wasm_functions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    consumer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    node_id: Mapped[str] = mapped_column(String(128), nullable=True)

    # ── Job lifecycle ─────────────────────────────────────────────────────────
    # pending | dispatched | running | completed | failed | timeout
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)
    input_args: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    output_result: Mapped[str] = mapped_column(Text, nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)

    # ── Billing ───────────────────────────────────────────────────────────────
    credits_charged: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    platform_fee: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)   # 20%
    developer_payout: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 56%
    node_payout: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)    # 24%

    # ── Execution ─────────────────────────────────────────────────────────────
    execution_signature: Mapped[str] = mapped_column(Text, nullable=True)
    execution_time_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    started_at: Mapped[datetime] = mapped_column(nullable=True)
    finished_at: Mapped[datetime] = mapped_column(nullable=True)
