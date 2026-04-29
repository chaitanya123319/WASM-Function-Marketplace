"""
PinataService — All Pinata IPFS API calls (V3 Files API).

Every WASM binary is stored on IPFS via Pinata.
Retrieval URL: https://gateway.pinata.cloud/ipfs/<CID>
Auth: Bearer <PINATA_JWT>
"""
import io
import json
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── V3 API endpoints ─────────────────────────────────────────────────────────
PINATA_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files"
PINATA_FILES_URL = "https://api.pinata.cloud/v3/files"
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
        POST https://uploads.pinata.cloud/v3/files
        V3 Files API — replaces legacy pinFileToIPFS.
        Returns: { cid, gateway_url, size, name, pinata_id }
        """
        keyvalues = {
            "function_name": function_name,
            "developer_id": str(developer_id),
            **(metadata or {}),
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                PINATA_UPLOAD_URL,
                headers=self.headers,
                files={
                    "file": (f"{function_name}.wasm", io.BytesIO(file_bytes), "application/wasm"),
                },
                data={
                    "network": "public",
                    "name": function_name,
                    "keyvalues": json.dumps(keyvalues),
                },
            )

        if response.status_code not in (200, 201):
            logger.error("Pinata upload failed: %s — %s", response.status_code, response.text)
            raise RuntimeError(f"Pinata upload failed: {response.status_code} — {response.text}")

        data = response.json()["data"]
        cid = data["cid"]
        pinata_id = data["id"]
        gateway_url = f"{self.gateway}/ipfs/{cid}"

        logger.info("Uploaded %s to IPFS: CID=%s, ID=%s", function_name, cid, pinata_id)
        return {
            "cid": cid,
            "gateway_url": gateway_url,
            "size": data.get("size", len(file_bytes)),
            "name": function_name,
            "pinata_id": pinata_id,
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

    # ── 3. Delete / Unpin WASM binary ─────────────────────────────────────────
    async def unpin_wasm(self, cid: str) -> bool:
        """
        DELETE https://api.pinata.cloud/v3/files/public/<id>
        Note: V3 requires the Pinata file ID, not the CID.
        Falls back to listing files by CID to find the ID first.
        Returns: True if successful
        """
        # First, find the Pinata file ID by CID
        pinata_id = await self._get_file_id_by_cid(cid)
        if not pinata_id:
            logger.warning("Could not find Pinata file ID for CID %s — skipping unpin", cid)
            return False

        url = f"{PINATA_FILES_URL}/public/{pinata_id}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(url, headers=self.headers)

        if response.status_code in (200, 204):
            logger.info("Deleted file %s (CID %s) from Pinata", pinata_id, cid)
            return True

        logger.warning("Delete file %s (CID %s) returned %s: %s",
                        pinata_id, cid, response.status_code, response.text)
        return False

    async def _get_file_id_by_cid(self, cid: str) -> str | None:
        """Look up the Pinata file ID for a given CID via the list endpoint."""
        url = f"{PINATA_FILES_URL}/public?cid={cid}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, headers=self.headers)

        if response.status_code != 200:
            logger.warning("Failed to list files for CID %s: %s", cid, response.text)
            return None

        data = response.json().get("data", {})
        files = data.get("files", [])
        if files:
            return files[0]["id"]
        return None

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
