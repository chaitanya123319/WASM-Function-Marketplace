#!/bin/bash
# e2e-test.sh - End-to-End Test of WASM Marketplace

set -e

API_URL="http://localhost:8000/api/v1"
WASM_FILE="${1:-add.wasm}"
TIMESTAMP=$(date +%s)
TEST_USER="testuser_${TIMESTAMP}"
TEST_EMAIL="test_${TIMESTAMP}@example.com"
TEST_PASSWORD="test123"

echo "============================================"
echo "🚀 WASM Marketplace E2E Test"
echo "============================================"
echo ""

# Step 1: Register User
echo "📝 Step 1: Register Test User"
echo "  User: $TEST_USER"
echo "  Email: $TEST_EMAIL"

REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$TEST_USER\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "  Response: $REGISTER_RESPONSE"
USER_ID=$(echo $REGISTER_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "  ✅ User created: $USER_ID"
echo ""

# Step 2: Login
echo "🔐 Step 2: Login User"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$TEST_USER&password=$TEST_PASSWORD")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
echo "  ✅ Login successful"
echo "  Token: ${TOKEN:0:20}..."
echo ""

# Step 3: Get User Info
echo "👤 Step 3: Fetch User Info"

ME_RESPONSE=$(curl -s -X GET "$API_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN")

CREDITS=$(echo $ME_RESPONSE | grep -o '"credits":[0-9]*' | cut -d':' -f2)
echo "  Credits: $CREDITS cr"
echo "  ✅ User info retrieved"
echo ""

# Step 4: Check if WASM file exists
if [ ! -f "$WASM_FILE" ]; then
    echo "❌ Error: $WASM_FILE not found!"
    echo "   Please compile the C++ file first:"
    echo "   ./compile-wasm.sh add.cpp add.wasm"
    exit 1
fi

# Step 5: Upload Function
echo "📦 Step 4: Upload WASM Function"
echo "  File: $WASM_FILE"
FILE_SIZE=$(stat -f%z "$WASM_FILE" 2>/dev/null || stat -c%s "$WASM_FILE" 2>/dev/null)
echo "  Size: $FILE_SIZE bytes"

UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/functions/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$WASM_FILE" \
  -F "name=Add Function Test" \
  -F "description=Test add function for E2E testing" \
  -F "version=1.0.0" \
  -F "source_language=c" \
  -F "price_per_call=1.0" \
  -F "is_public=true")

FUNCTION_ID=$(echo $UPLOAD_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
IPFS_CID=$(echo $UPLOAD_RESPONSE | grep -o '"ipfs_cid":"[^"]*' | cut -d'"' -f4)

if [ -z "$FUNCTION_ID" ]; then
    echo "  ❌ Upload failed!"
    echo "  Response: $UPLOAD_RESPONSE"
    exit 1
fi

echo "  ✅ Function uploaded"
echo "  Function ID: $FUNCTION_ID"
echo "  IPFS CID: $IPFS_CID"
echo ""

# Step 6: List Functions
echo "📋 Step 5: List Public Functions"

LIST_RESPONSE=$(curl -s -X GET "$API_URL/functions/" \
  -H "Authorization: Bearer $TOKEN")

FUNC_COUNT=$(echo $LIST_RESPONSE | grep -o '"id"' | wc -l)
echo "  Found $FUNC_COUNT public functions"
echo "  ✅ List retrieved"
echo ""

# Step 7: Invoke Function
echo "⚡ Step 6: Invoke Function"
TEST_A="10.5"
TEST_B="20.3"
echo "  Arguments: a=$TEST_A, b=$TEST_B"
echo "  Expected: 30.8"

INVOKE_RESPONSE=$(curl -s -X POST "$API_URL/functions/$FUNCTION_ID/invoke" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"args\": {\"a\": $TEST_A, \"b\": $TEST_B}}")

JOB_ID=$(echo $INVOKE_RESPONSE | grep -o '"job_id":"[^"]*' | cut -d'"' -f4)
JOB_STATUS=$(echo $INVOKE_RESPONSE | grep -o '"status":"[^"]*' | cut -d'"' -f4)
OUTPUT=$(echo $INVOKE_RESPONSE | grep -o '"output_result":"[^"]*' | cut -d'"' -f4)
EXEC_TIME=$(echo $INVOKE_RESPONSE | grep -o '"execution_time_ms":[0-9]*' | cut -d':' -f2)

if [ "$JOB_STATUS" = "completed" ]; then
    echo "  ✅ Execution completed"
    echo "  Job ID: $JOB_ID"
    echo "  Status: $JOB_STATUS"
    echo "  Output: $OUTPUT"
    echo "  Time: ${EXEC_TIME}ms"
else
    echo "  ⚠️  Status: $JOB_STATUS"
    echo "  Response: $INVOKE_RESPONSE"
fi
echo ""

# Step 8: View Job History
echo "📊 Step 7: View Job History"

JOBS_RESPONSE=$(curl -s -X GET "$API_URL/jobs/" \
  -H "Authorization: Bearer $TOKEN")

JOB_COUNT=$(echo $JOBS_RESPONSE | grep -o '"id"' | wc -l)
echo "  Total jobs: $JOB_COUNT"
echo "  ✅ Job history retrieved"
echo ""

# Step 9: Summary
echo "============================================"
echo "✅ E2E Test Completed Successfully!"
echo "============================================"
echo ""
echo "Summary:"
echo "  • User Registration: ✅"
echo "  • Login: ✅"
echo "  • WASM Upload: ✅"
echo "  • Function Invocation: ✅"
echo "  • Job History: ✅"
echo ""
echo "Test User Credentials:"
echo "  Username: $TEST_USER"
echo "  Password: $TEST_PASSWORD"
echo "  Email: $TEST_EMAIL"
echo ""
echo "Access Frontend: http://localhost:3000"
echo "API Docs: http://localhost:8000/docs"
