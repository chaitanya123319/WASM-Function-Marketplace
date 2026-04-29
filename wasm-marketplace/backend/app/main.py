"""
FastAPI application entry point.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.models import user, function, job  # noqa: F401 — register models with Base
from app.routers import auth, functions, jobs, nodes
from app.services.pinata import pinata

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready.")

    logger.info("Testing Pinata connection...")
    try:
        ok = await pinata.test_connection()
        if ok:
            logger.info("✅ Pinata connected successfully")
        else:
            logger.warning("⚠️  Pinata connection test failed — check PINATA_JWT in .env")
    except Exception as exc:
        logger.warning("⚠️  Pinata connection test error (non-fatal): %s", exc)

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("Shutting down...")
    await engine.dispose()


app = FastAPI(
    title="WASM Function Marketplace",
    description="Serverless WebAssembly FaaS platform powered by Pinata IPFS",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(functions.router)
app.include_router(jobs.router)
app.include_router(nodes.router)


@app.get("/health", tags=["Health"])
async def health():
    pinata_ok = await pinata.test_connection()
    return {
        "status": "ok",
        "pinata_connected": pinata_ok,
    }


@app.get("/", tags=["Root"])
async def root():
    return {"message": "WASM Marketplace API", "docs": "/docs"}
