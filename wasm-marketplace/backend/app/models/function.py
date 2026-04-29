import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class WasmFunction(Base):
    __tablename__ = "wasm_functions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    developer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    version: Mapped[str] = mapped_column(String(32), default="1.0.0", nullable=False)

    # ── Pinata IPFS storage (NOT S3) ──────────────────────────────────────────
    ipfs_cid: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    gateway_url: Mapped[str] = mapped_column(String(512), nullable=False)
    # ──────────────────────────────────────────────────────────────────────────

    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source_language: Mapped[str] = mapped_column(String(32), default="rust", nullable=False)
    price_per_call: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    total_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_earnings: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
