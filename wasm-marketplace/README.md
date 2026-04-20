# WASM Function Marketplace

A **Serverless WebAssembly (WASM) Function Marketplace** — a decentralized
Functions-as-a-Service (FaaS) platform powered by **Pinata IPFS** for storage,
**Wazero** for sandboxed execution, and **Ed25519** for verifiable results.

---

## Architecture

```
Consumer → POST /invoke → Redis Stream → Contributor Node (Wazero)
                                              ↓  fetches .wasm from Pinata IPFS
                                              ↓  executes (64MB memory, 10s timeout)
                                              ↓  signs with Ed25519
                                         POST /nodes/results → settle billing
```

## Quick Start

### 1. Get Pinata credentials

Sign up at https://app.pinata.cloud/developers/api-keys  
Create a key with `pinFileToIPFS`, `unpin`, `pinList` permissions.

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in PINATA_API_KEY, PINATA_API_SECRET, PINATA_JWT
```

### 3. Start all services

```bash
docker compose up --build
```

### 4. Access points

| Service      | URL                         |
|--------------|-----------------------------|
| Frontend     | http://localhost:3000       |
| API Docs     | http://localhost:8000/docs  |
| Health Check | http://localhost:8000/health|

---

## Services

| Container | Image | Port |
|-----------|-------|------|
| `wasm-postgres`  | postgres:16-alpine    | 5432 |
| `wasm-redis`     | redis:7-alpine        | 6379 |
| `wasm-backend`   | Python FastAPI        | 8000 |
| `wasm-node`      | Go + Wazero           | — (worker) |
| `wasm-frontend`  | React/Vite + nginx    | 3000 |

---

## Credit System

| Participant   | Share | Example (1 cr call) |
|---------------|-------|---------------------|
| Platform      | 20%   | 0.20 cr             |
| Developer     | 56%   | 0.56 cr             |
| Node operator | 24%   | 0.24 cr             |

New users start with **100 free credits**.

---

## IPFS Storage (Pinata)

- **Upload**: `POST /api/v1/functions/upload` → binary pinned to IPFS
- **CID stored** in DB (`ipfs_cid` field) — not a filename or S3 key
- **Gateway URL**: `https://gateway.pinata.cloud/ipfs/<CID>`
- **Delete**: unpins from Pinata before removing DB record

---

## Contributor Node

The Go node (`contributor-node/`) automatically:

1. Loads or generates an **Ed25519 private key** (set `NODE_PRIVATE_KEY` env to persist)
2. Consumes jobs from `wasm:jobs` Redis Stream
3. Fetches `.wasm` from Pinata gateway
4. Executes in **Wazero** sandbox (64 MB memory limit, 10 s timeout)
5. Signs result: `Ed25519Sign(sha256(job_id + output))`
6. POSTs signed result to backend

---

## API Endpoints

### Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET  /api/v1/auth/me`

### Functions
- `POST   /api/v1/functions/upload`
- `GET    /api/v1/functions/`
- `GET    /api/v1/functions/my`
- `GET    /api/v1/functions/{id}`
- `POST   /api/v1/functions/{id}/invoke`
- `DELETE /api/v1/functions/{id}`

### Jobs
- `GET /api/v1/jobs/`
- `GET /api/v1/jobs/{id}`

### Nodes
- `POST /api/v1/nodes/results`
- `GET  /api/v1/nodes/health`
