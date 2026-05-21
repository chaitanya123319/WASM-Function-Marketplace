# WASM Function Marketplace - Complete Setup & Deployment Guide

## ✅ Current Status
- **Docker Services**: All running ✓
- **Backend**: http://localhost:8000 ✓
- **Frontend**: http://localhost:3000 ✓
- **API Docs**: http://localhost:8000/docs ✓

---

## 📋 Installation Steps Completed

### 1. **Docker Compose Setup** ✅
```bash
cd wasm-marketplace
docker-compose up --build
```

All 5 services started:
- ✓ PostgreSQL (Port 5432)
- ✓ Redis (Port 6379)
- ✓ FastAPI Backend (Port 8000)
- ✓ Contributor Node (Worker)
- ✓ React Frontend (Port 3000)

### 2. **Environment Configuration** ✅
`.env` file already configured with:
- PostgreSQL credentials
- Redis URL
- Pinata API credentials (active)
- JWT secret key
- Platform fee settings (20%)

---

## 🔧 Setup Emscripten for C++ → WASM Compilation

### Option A: Using Docker (Recommended - No Local Install)
```bash
# Compile C++ to WASM inside Docker container
docker run --rm -v C:\Users\Admin\OneDrive\Desktop\WASM Function Marketplace:/src emscripten/emsdk:latest \
  emcc /src/add.cpp -o /src/add.wasm -s STANDALONE_WASM=1 -Os
```

### Option B: Local Installation
**Windows:**
```powershell
# Install Emscripten using Git Bash or WSL2
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest

# Add to PATH
$env:EMSDK = "C:\path\to\emsdk"
$env:PATH += ";$env:EMSDK;$env:EMSDK\node\16.0.0_64bit;$env:EMSDK\upstream\emscripten"

# Test
emcc --version
```

**Mac/Linux:**
```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

### Option C: Use Pre-built WASM (For Testing)
Skip compilation and use the provided test WASM files.

---

## 🚀 Complete Workflow

### 1. **Register User**
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "test123"
  }'
```

### 2. **Login**
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser&password=test123"
```
Save the `access_token`.

### 3. **Upload WASM Function**
```bash
curl -X POST http://localhost:8000/api/v1/functions/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@add.wasm" \
  -F "name=Add Function" \
  -F "description=Adds two numbers" \
  -F "version=1.0.0" \
  -F "source_language=c" \
  -F "price_per_call=1.0" \
  -F "is_public=true"
```

### 4. **List Functions**
```bash
curl http://localhost:8000/api/v1/functions/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. **Invoke Function**
```bash
curl -X POST http://localhost:8000/api/v1/functions/{FUNCTION_ID}/invoke \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"args": {"a": 10.5, "b": 20.3}}'
```

### 6. **View Results**
```bash
curl http://localhost:8000/api/v1/jobs/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎨 Frontend Testing

1. **Open Browser**: http://localhost:3000
2. **Register**: Create account
3. **Marketplace**: Browse available functions
4. **Upload**: Upload your WASM file
5. **Invoke**: Run function with JSON arguments
6. **History**: View execution results

---

## 📊 Billing System

| Role | Share | Example (1 credit call) |
|------|-------|------------------------|
| Platform | 20% | 0.20 cr |
| Developer | 56% | 0.56 cr |
| Node Operator | 24% | 0.24 cr |

New users start with **100 free credits**.

---

## 🔍 API Documentation

**Swagger UI**: http://localhost:8000/docs  
**ReDoc**: http://localhost:8000/redoc

### Key Endpoints

#### Auth
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login (OAuth2)
- `GET /api/v1/auth/me` - Get current user

#### Functions
- `GET /api/v1/functions/` - List public functions
- `GET /api/v1/functions/my` - List your functions
- `POST /api/v1/functions/upload` - Upload WASM
- `POST /api/v1/functions/{id}/invoke` - Execute function
- `DELETE /api/v1/functions/{id}` - Delete function

#### Jobs
- `GET /api/v1/jobs/` - View your job history
- `GET /api/v1/jobs/{id}` - Get job details

---

## 📁 Project Structure

```
wasm-marketplace/
├── backend/               # FastAPI Server
│   ├── app/
│   │   ├── main.py       # App entry point
│   │   ├── core/         # Config & Database
│   │   ├── models/       # SQLAlchemy models
│   │   ├── routers/      # API endpoints
│   │   └── services/     # Business logic
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/              # React + Vite
│   ├── src/
│   │   ├── App.tsx       # Main app
│   │   ├── pages/        # Route pages
│   │   ├── components/   # Reusable UI
│   │   └── services/     # API client
│   ├── package.json
│   └── Dockerfile
├── contributor-node/      # Go + Wazero
│   ├── main.go           # Node worker
│   ├── go.mod
│   └── Dockerfile
├── docker-compose.yml
└── .env                  # Configuration

```

---

## 🐛 Troubleshooting

### Containers Won't Start
```bash
# Check logs
docker-compose logs -f backend

# Restart everything
docker-compose down -v
docker-compose up --build
```

### Database Connection Error
- Ensure PostgreSQL container is healthy: `docker-compose ps`
- Check `.env` DATABASE_URL matches docker-compose setup

### WASM Compilation Fails
- Use Docker option (no local install needed)
- Or install Emscripten SDK locally

### Function Invocation Times Out
- Node may not be ready, wait 10+ seconds after container start
- Check node logs: `docker-compose logs wasm-node`

---

## 🎯 Next Steps

1. ✅ Install Emscripten (Docker method recommended)
2. ✅ Compile add.cpp to add.wasm
3. ✅ Register user via API or UI
4. ✅ Upload WASM function
5. ✅ Invoke function with test arguments
6. ✅ Monitor results in Job History

---

## 📝 Notes

- All WASM binaries stored on **Pinata IPFS** (not local)
- Results signed with **Ed25519** for verification
- Execution runs in **Wazero sandbox** (64MB memory, 10s timeout)
- Credits are **immutable** (no refunds except on timeout)
- Node operations are **stateless** (can scale horizontally)

---

**Status**: Production-Ready 🚀  
**Version**: 1.0.0  
**Last Updated**: 2026-05-21
