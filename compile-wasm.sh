#!/bin/bash
# compile-wasm.sh - Compile C++ to WebAssembly using Docker

SOURCE_FILE="${1:-add.cpp}"
OUTPUT_FILE="${2:-add.wasm}"
WORKSPACE="$(pwd)"

echo "🔨 Compiling $SOURCE_FILE to $OUTPUT_FILE using Docker..."

docker run --rm \
  -v "$WORKSPACE:/src" \
  emscripten/emsdk:latest \
  emcc "/src/$SOURCE_FILE" \
  -o "/src/$OUTPUT_FILE" \
  -s STANDALONE_WASM=1 \
  -s WASM=1 \
  -Os

if [ -f "$OUTPUT_FILE" ]; then
  echo "✅ Compilation successful!"
  echo "📦 Output: $OUTPUT_FILE"
  ls -lh "$OUTPUT_FILE"
else
  echo "❌ Compilation failed!"
  exit 1
fi
