# compile-wasm.ps1 - Compile C++ to WebAssembly using Docker (PowerShell)

param(
    [string]$SourceFile = "add.cpp",
    [string]$OutputFile = "add.wasm"
)

$Workspace = Get-Location
Write-Host "🔨 Compiling $SourceFile to $OutputFile using Docker..." -ForegroundColor Cyan

$DockerCmd = @(
    "run",
    "--rm",
    "-v", "$($Workspace):/src",
    "emscripten/emsdk:latest",
    "emcc", "/src/$SourceFile",
    "-o", "/src/$OutputFile",
    "-s", "STANDALONE_WASM=1",
    "-s", "WASM=1",
    "-Os"
)

docker @DockerCmd

if (Test-Path $OutputFile) {
    Write-Host "✅ Compilation successful!" -ForegroundColor Green
    Write-Host "📦 Output: $OutputFile" -ForegroundColor Green
    Get-Item $OutputFile | Select-Object FullName, @{Name='Size(KB)';Expression={[math]::Round($_.Length/1KB, 2)}}
} else {
    Write-Host "❌ Compilation failed!" -ForegroundColor Red
    exit 1
}
