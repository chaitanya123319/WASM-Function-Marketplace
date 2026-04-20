"""
PinataService — All Pinata IPFS API calls.

Replaces S3 entirely. Every WASM binary is stored on IPFS via Pinata.
Retrieval URL: https://gateway.pinata.cloud/ipfs/<CID>
Auth: Bearer <PINATA_JWT>
"""
import io
import json
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"
PINATA_UNPIN_URL = "https://api.pinata.cloud/pinning/unpin/{cid}"
PINATA_TEST_URL = "https://api.pinata.cloud/data/testAuthentication"


class PinataService:
    def __init__(self):
        self.jwt = settings.PINATA_JWT
        self.gateway = settings.PINATA_GATEWAY.rstrip("/")
        self.headers = {"Authorization": f"Bearer {self.jwt}"}

    # ── 1. Upload WASM binary ─────────────────────────────────────────────────
    async def upload_wasm(
        self,
        file_bytes: bytes,
        function_name: str,
        developer_id: str,
        metadata: dict | None = None,
    ) -> dict:
        """
        POST https://api.pinata.cloud/pinning/pinFileToIPFS
        Returns: { cid, gateway_url, size, name }
        """
        pinata_metadata = {
            "name": function_name,
            "keyvalues": {
                "function_name": function_name,
                "developer_id": str(developer_id),
                **(metadata or {}),
            },
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                PINATA_PIN_URL,
                headers=self.headers,
                files={
                    "file": (f"{function_name}.wasm", io.BytesIO(file_bytes), "application/wasm"),
                },
                data={
                    "pinataMetadata": json.dumps(pinata_metadata),
                    "pinataOptions": json.dumps({"cidVersion": 1}),
                },
            )

        if response.status_code != 200:
            logger.error("Pinata upload failed: %s — %s", response.status_code, response.text)
            raise RuntimeError(f"Pinata upload failed: {response.status_code} — {response.text}")

        data = response.json()
        cid = data["IpfsHash"]
        gateway_url = f"{self.gateway}/ipfs/{cid}"

        logger.info("Uploaded %s to IPFS: %s", function_name, cid)
        return {
            "cid": cid,
            "gateway_url": gateway_url,
            "size": data.get("PinSize", len(file_bytes)),
            "name": function_name,
        }

    # ── 2. Download WASM binary ───────────────────────────────────────────────
    async def download_wasm(self, cid: str) -> bytes:
        """
        GET https://gateway.pinata.cloud/ipfs/<cid>
        Returns: raw .wasm bytes
        """
        url = f"{self.gateway}/ipfs/{cid}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)

        if response.status_code != 200:
            raise RuntimeError(f"Failed to download CID {cid}: {response.status_code}")

        return response.content

    # ── 3. Unpin WASM binary ──────────────────────────────────────────────────
    async def unpin_wasm(self, cid: str) -> bool:
        """
        DELETE https://api.pinata.cloud/pinning/unpin/<cid>
        Returns: True if successful
        """
        url = PINATA_UNPIN_URL.format(cid=cid)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(url, headers=self.headers)

        if response.status_code == 200:
            logger.info("Unpinned CID %s from Pinata", cid)
            return True

        logger.warning("Unpin CID %s returned %s: %s", cid, response.status_code, response.text)
        return False

    # ── 4. Test Pinata connection ─────────────────────────────────────────────
    async def test_connection(self) -> bool:
        """
        GET https://api.pinata.cloud/data/testAuthentication
        Returns: True if JWT is valid
        """
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(PINATA_TEST_URL, headers=self.headers)

        ok = response.status_code == 200
        if not ok:
            logger.warning("Pinata auth test failed: %s", response.text)
        return ok


# Singleton
pinata = PinataService()
