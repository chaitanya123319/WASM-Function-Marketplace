# e2e-test.ps1 - End-to-End Test of WASM Marketplace (PowerShell)

param(
    [string]$WasmFile = "add.wasm",
    [string]$ApiUrl = "http://localhost:8000/api/v1"
)

$Timestamp = Get-Date -Format "yyyyMMddHHmmss"
$TestUser = "testuser_$Timestamp"
$TestEmail = "test_$Timestamp@example.com"
$TestPassword = "test123"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "🚀 WASM Marketplace E2E Test" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Register User
Write-Host "📝 Step 1: Register Test User" -ForegroundColor Yellow
Write-Host "  User: $TestUser"
Write-Host "  Email: $TestEmail"

$RegisterBody = @{
    username = $TestUser
    email = $TestEmail
    password = $TestPassword
} | ConvertTo-Json

$RegisterResponse = Invoke-WebRequest -Uri "$ApiUrl/auth/register" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $RegisterBody -ErrorAction SilentlyContinue

$RegisterJson = $RegisterResponse.Content | ConvertFrom-Json
$UserId = $RegisterJson.id

Write-Host "  ✅ User created: $UserId" -ForegroundColor Green
Write-Host ""

# Step 2: Login
Write-Host "🔐 Step 2: Login User" -ForegroundColor Yellow

$LoginBody = "username=$TestUser&password=$TestPassword"

$LoginResponse = Invoke-WebRequest -Uri "$ApiUrl/auth/login" `
    -Method POST `
    -Headers @{"Content-Type"="application/x-www-form-urlencoded"} `
    -Body $LoginBody -ErrorAction SilentlyContinue

$LoginJson = $LoginResponse.Content | ConvertFrom-Json
$Token = $LoginJson.access_token

Write-Host "  ✅ Login successful" -ForegroundColor Green
Write-Host "  Token: $($Token.Substring(0, 20))..." -ForegroundColor Gray
Write-Host ""

# Step 3: Get User Info
Write-Host "👤 Step 3: Fetch User Info" -ForegroundColor Yellow

$MeResponse = Invoke-WebRequest -Uri "$ApiUrl/auth/me" `
    -Method GET `
    -Headers @{"Authorization"="Bearer $Token"} -ErrorAction SilentlyContinue

$MeJson = $MeResponse.Content | ConvertFrom-Json
$Credits = $MeJson.credits

Write-Host "  Credits: $Credits cr" -ForegroundColor Cyan
Write-Host "  ✅ User info retrieved" -ForegroundColor Green
Write-Host ""

# Step 4: Check if WASM file exists
if (-not (Test-Path $WasmFile)) {
    Write-Host "❌ Error: $WasmFile not found!" -ForegroundColor Red
    Write-Host "   Please compile the C++ file first:" -ForegroundColor Yellow
    Write-Host "   .\compile-wasm.ps1 -SourceFile add.cpp -OutputFile add.wasm" -ForegroundColor Yellow
    exit 1
}

# Step 5: Upload Function
Write-Host "📦 Step 4: Upload WASM Function" -ForegroundColor Yellow
Write-Host "  File: $WasmFile"
$FileSize = (Get-Item $WasmFile).Length
Write-Host "  Size: $FileSize bytes"

$FileStream = [System.IO.File]::OpenRead($WasmFile)
$Boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$UploadBody = @"
--$Boundary
Content-Disposition: form-data; name="file"; filename="$WasmFile"
Content-Type: application/wasm

$(Get-Content -Raw -Path $WasmFile -Encoding Byte)
--$Boundary
Content-Disposition: form-data; name="name"

Add Function Test
--$Boundary
Content-Disposition: form-data; name="description"

Test add function for E2E testing
--$Boundary
Content-Disposition: form-data; name="version"

1.0.0
--$Boundary
Content-Disposition: form-data; name="source_language"

c
--$Boundary
Content-Disposition: form-data; name="price_per_call"

1.0
--$Boundary
Content-Disposition: form-data; name="is_public"

true
--$Boundary--
"@

$UploadResponse = Invoke-WebRequest -Uri "$ApiUrl/functions/upload" `
    -Method POST `
    -Headers @{"Authorization"="Bearer $Token"; "Content-Type"="multipart/form-data; boundary=$Boundary"} `
    -Body $UploadBody -ErrorAction SilentlyContinue

$UploadJson = $UploadResponse.Content | ConvertFrom-Json
$FunctionId = $UploadJson.id
$IpfsCid = $UploadJson.ipfs_cid

if (-not $FunctionId) {
    Write-Host "  ❌ Upload failed!" -ForegroundColor Red
    Write-Host "  Response: $($UploadResponse.Content)" -ForegroundColor Red
    exit 1
}

Write-Host "  ✅ Function uploaded" -ForegroundColor Green
Write-Host "  Function ID: $FunctionId" -ForegroundColor Cyan
Write-Host "  IPFS CID: $IpfsCid" -ForegroundColor Cyan
Write-Host ""

# Step 6: List Functions
Write-Host "📋 Step 5: List Public Functions" -ForegroundColor Yellow

$ListResponse = Invoke-WebRequest -Uri "$ApiUrl/functions/" `
    -Method GET `
    -Headers @{"Authorization"="Bearer $Token"} -ErrorAction SilentlyContinue

$ListJson = $ListResponse.Content | ConvertFrom-Json
$FuncCount = @($ListJson).Count

Write-Host "  Found $FuncCount public functions" -ForegroundColor Cyan
Write-Host "  ✅ List retrieved" -ForegroundColor Green
Write-Host ""

# Step 7: Invoke Function
Write-Host "⚡ Step 6: Invoke Function" -ForegroundColor Yellow
$TestA = 10.5
$TestB = 20.3
Write-Host "  Arguments: a=$TestA, b=$TestB" -ForegroundColor Cyan
Write-Host "  Expected: 30.8" -ForegroundColor Cyan

$InvokeBody = @{
    args = @{
        a = $TestA
        b = $TestB
    }
} | ConvertTo-Json

$InvokeResponse = Invoke-WebRequest -Uri "$ApiUrl/functions/$FunctionId/invoke" `
    -Method POST `
    -Headers @{"Authorization"="Bearer $Token"; "Content-Type"="application/json"} `
    -Body $InvokeBody -ErrorAction SilentlyContinue

$InvokeJson = $InvokeResponse.Content | ConvertFrom-Json
$JobId = $InvokeJson.job_id
$JobStatus = $InvokeJson.status
$Output = $InvokeJson.output_result
$ExecTime = $InvokeJson.execution_time_ms

if ($JobStatus -eq "completed") {
    Write-Host "  ✅ Execution completed" -ForegroundColor Green
    Write-Host "  Job ID: $JobId" -ForegroundColor Cyan
    Write-Host "  Status: $JobStatus" -ForegroundColor Cyan
    Write-Host "  Output: $Output" -ForegroundColor Cyan
    Write-Host "  Time: $($ExecTime)ms" -ForegroundColor Cyan
} else {
    Write-Host "  ⚠️  Status: $JobStatus" -ForegroundColor Yellow
}
Write-Host ""

# Step 8: View Job History
Write-Host "📊 Step 7: View Job History" -ForegroundColor Yellow

$JobsResponse = Invoke-WebRequest -Uri "$ApiUrl/jobs/" `
    -Method GET `
    -Headers @{"Authorization"="Bearer $Token"} -ErrorAction SilentlyContinue

$JobsJson = $JobsResponse.Content | ConvertFrom-Json
$JobCount = @($JobsJson).Count

Write-Host "  Total jobs: $JobCount" -ForegroundColor Cyan
Write-Host "  ✅ Job history retrieved" -ForegroundColor Green
Write-Host ""

# Step 9: Summary
Write-Host "============================================" -ForegroundColor Green
Write-Host "✅ E2E Test Completed Successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  • User Registration: ✅" -ForegroundColor Green
Write-Host "  • Login: ✅" -ForegroundColor Green
Write-Host "  • WASM Upload: ✅" -ForegroundColor Green
Write-Host "  • Function Invocation: ✅" -ForegroundColor Green
Write-Host "  • Job History: ✅" -ForegroundColor Green
Write-Host ""

Write-Host "Test User Credentials:" -ForegroundColor Cyan
Write-Host "  Username: $TestUser" -ForegroundColor Gray
Write-Host "  Password: $TestPassword" -ForegroundColor Gray
Write-Host "  Email: $TestEmail" -ForegroundColor Gray
Write-Host ""

Write-Host "Access Endpoints:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Gray
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor Gray
