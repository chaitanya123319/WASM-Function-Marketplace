"""
Redis Streams job queue.
Publishes to:   wasm:jobs    (API → Node)
Consumes from:  wasm:results (Node → API)
"""
import asyncio
import json
import logging
from typing import Any

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)

JOBS_STREAM = "wasm:jobs"
RESULTS_STREAM = "wasm:results"
CONSUMER_GROUP = "contributor-nodes"
RESULT_POLL_INTERVAL = 0.5   # seconds
RESULT_TIMEOUT = 30.0        # seconds


class RedisQueue:
    def __init__(self):
        self._client: redis.Redis | None = None

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._client

    # ── Publish job ───────────────────────────────────────────────────────────
    async def publish_job(self, job_data: dict) -> str:
        """XADD wasm:jobs * <fields>"""
        flat = {k: json.dumps(v) if isinstance(v, (dict, list)) else str(v)
                for k, v in job_data.items()}
        msg_id = await self.client.xadd(JOBS_STREAM, flat)
        logger.info("Published job %s to stream as %s", job_data.get("job_id"), msg_id)
        return msg_id

    # ── Poll for result ───────────────────────────────────────────────────────
    async def wait_for_result(self, job_id: str, timeout: float = RESULT_TIMEOUT) -> dict | None:
        """
        Poll wasm:results stream for a message with matching job_id.
        Returns the result dict or None on timeout.
        """
        deadline = asyncio.get_event_loop().time() + timeout
        # Start reading from now
        last_id = "$"
        # But we may have missed it — scan from 0 on first attempt
        scan_id = "0"

        while asyncio.get_event_loop().time() < deadline:
            remaining = deadline - asyncio.get_event_loop().time()
            block_ms = max(0, min(int(remaining * 1000), 2000))

            messages = await self.client.xread(
                {RESULTS_STREAM: scan_id}, block=block_ms, count=100
            )
            scan_id = last_id  # switch to tail read after first pass

            if messages:
                for _stream, entries in messages:
                    for msg_id, fields in entries:
                        last_id = msg_id
                        if fields.get("job_id") == job_id:
                            # Parse JSON fields back
                            result = {}
                            for k, v in fields.items():
                                try:
                                    result[k] = json.loads(v)
                                except (json.JSONDecodeError, TypeError):
                                    result[k] = v
                            logger.info("Received result for job %s", job_id)
                            return result

            await asyncio.sleep(RESULT_POLL_INTERVAL)

        logger.warning("Timeout waiting for result of job %s", job_id)
        return None

    # ── Publish result (used by nodes posting back) ───────────────────────────
    async def publish_result(self, result_data: dict) -> str:
        flat = {k: json.dumps(v) if isinstance(v, (dict, list)) else str(v)
                for k, v in result_data.items()}
        msg_id = await self.client.xadd(RESULTS_STREAM, flat)
        return msg_id

    async def close(self):
        if self._client:
            await self._client.aclose()


# Singleton
redis_queue = RedisQueue()
