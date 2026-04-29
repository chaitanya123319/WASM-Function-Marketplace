// contributor-node/main.go
//
// Serverless WASM contributor node.
// Reads jobs from Redis Stream "wasm:jobs", executes .wasm via Wazero,
// signs the result with Ed25519, and POSTs back to the API.

package main

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

// ── Config ────────────────────────────────────────────────────────────────────

var (
	redisURL   = envOrDefault("REDIS_URL", "redis://localhost:6379")
	backendURL = envOrDefault("BACKEND_URL", "http://localhost:8000")
	nodeIDEnv  = envOrDefault("NODE_ID", "")
)

const (
	jobsStream     = "wasm:jobs"
	consumerGroup  = "contributor-nodes"
	memoryLimit    = 64 * 1024 * 1024 // 64 MB
	execTimeout    = 10 * time.Second
	nodePrivKeyEnv = "NODE_PRIVATE_KEY"
)

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// ── Key management ────────────────────────────────────────────────────────────

func loadOrGenerateKey() (ed25519.PrivateKey, ed25519.PublicKey) {
	envKey := os.Getenv(nodePrivKeyEnv)
	if envKey != "" {
		decoded, err := base64.StdEncoding.DecodeString(envKey)
		if err == nil && len(decoded) == ed25519.PrivateKeySize {
			priv := ed25519.PrivateKey(decoded)
			return priv, priv.Public().(ed25519.PublicKey)
		}
		log.Printf("Warning: could not parse NODE_PRIVATE_KEY, generating new key")
	}

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		log.Fatalf("Failed to generate Ed25519 key: %v", err)
	}
	encoded := base64.StdEncoding.EncodeToString(priv)
	log.Printf("Generated new Ed25519 key. Set NODE_PRIVATE_KEY=%s to reuse.", encoded)
	return priv, pub
}

// ── Redis helpers ─────────────────────────────────────────────────────────────

func newRedisClient() *redis.Client {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("Invalid REDIS_URL: %v", err)
	}
	return redis.NewClient(opt)
}

func ensureConsumerGroup(ctx context.Context, rdb *redis.Client) {
	err := rdb.XGroupCreateMkStream(ctx, jobsStream, consumerGroup, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		log.Fatalf("Failed to create consumer group: %v", err)
	}
}

// ── WASM execution ────────────────────────────────────────────────────────────

type execResult struct {
	output    string
	execMs    float64
	err       error
}

func executeWasm(wasmBytes []byte, args map[string]interface{}) execResult {
	ctx, cancel := context.WithTimeout(context.Background(), execTimeout)
	defer cancel()

	start := time.Now()

	// Build runtime with memory limit
	cfg := wazero.NewRuntimeConfig().
		WithMemoryLimitPages(uint32(memoryLimit / (64 * 1024))) // pages = bytes / 65536

	rt := wazero.NewRuntimeWithConfig(ctx, cfg)
	defer rt.Close(ctx)

	// Instantiate WASI
	wasi_snapshot_preview1.MustInstantiate(ctx, rt)

	// Compile module
	compiled, err := rt.CompileModule(ctx, wasmBytes)
	if err != nil {
		return execResult{err: fmt.Errorf("compile error: %w", err)}
	}

	// Capture stdout
	var stdout bytes.Buffer
	modCfg := wazero.NewModuleConfig().
		WithStdout(&stdout).
		WithStderr(io.Discard).
		WithArgs("wasm-fn")

	// Serialize args as JSON env var
	if len(args) > 0 {
		argsJSON, _ := json.Marshal(args)
		modCfg = modCfg.WithEnv("WASM_ARGS", string(argsJSON))
	}

	mod, err := rt.InstantiateModule(ctx, compiled, modCfg)
	if err != nil {
		// Some modules exit via proc_exit — that's fine
		if !strings.Contains(err.Error(), "exit_code(0)") {
			return execResult{
				output: stdout.String(),
				execMs: float64(time.Since(start).Milliseconds()),
				err:    fmt.Errorf("instantiation error: %w", err),
			}
		}
	}

	// Try calling exported "run" function if it exists
	if mod != nil {
		if runFn := mod.ExportedFunction("run"); runFn != nil {
			_, callErr := runFn.Call(ctx)
			if callErr != nil && !strings.Contains(callErr.Error(), "exit_code(0)") {
				return execResult{
					output: stdout.String(),
					execMs: float64(time.Since(start).Milliseconds()),
					err:    fmt.Errorf("run() error: %w", callErr),
				}
			}
		} else if mainFn := mod.ExportedFunction("_start"); mainFn != nil {
			mainFn.Call(ctx) // ignore exit errors
		}
	}

	_ = api.CoreFeaturesV2 // suppress unused import

	return execResult{
		output: stdout.String(),
		execMs: float64(time.Since(start).Milliseconds()),
	}
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

func fetchWasm(gatewayURL string) ([]byte, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(gatewayURL)
	if err != nil {
		return nil, fmt.Errorf("HTTP GET %s: %w", gatewayURL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("unexpected status %d from %s", resp.StatusCode, gatewayURL)
	}
	return io.ReadAll(resp.Body)
}

type ResultPayload struct {
	JobID           string  `json:"job_id"`
	NodeID          string  `json:"node_id"`
	Status          string  `json:"status"`
	OutputResult    string  `json:"output_result,omitempty"`
	ErrorMessage    string  `json:"error_message,omitempty"`
	ExecutionTimeMs float64 `json:"execution_time_ms"`
	Signature       string  `json:"signature"`
}

func postResult(payload ResultPayload) error {
	body, _ := json.Marshal(payload)
	url := strings.TrimRight(backendURL, "/") + "/api/v1/nodes/results"
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("POST result: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("result POST returned %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// ── Signing ───────────────────────────────────────────────────────────────────

func signResult(priv ed25519.PrivateKey, jobID, output string) string {
	combined := jobID + output
	hash := sha256.Sum256([]byte(combined))
	sig := ed25519.Sign(priv, hash[:])
	return hex.EncodeToString(sig)
}

// ── Node ID ───────────────────────────────────────────────────────────────────

func resolveNodeID(pub ed25519.PublicKey) string {
	if nodeIDEnv != "" {
		return nodeIDEnv
	}
	return "node-" + hex.EncodeToString(pub[:8])
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	log.Println("🚀 Contributor Node starting...")

	priv, pub := loadOrGenerateKey()
	nodeID := resolveNodeID(pub)
	log.Printf("Node ID: %s", nodeID)

	rdb := newRedisClient()
	ctx := context.Background()

	// Ensure stream + consumer group exist
	ensureConsumerGroup(ctx, rdb)
	log.Printf("Listening on Redis stream '%s' (group: %s)...", jobsStream, consumerGroup)

	for {
		streams, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    consumerGroup,
			Consumer: nodeID,
			Streams:  []string{jobsStream, ">"},
			Count:    1,
			Block:    5 * time.Second,
		}).Result()

		if err != nil {
			if err == redis.Nil || strings.Contains(err.Error(), "redis: nil") {
				// No new messages, continue polling
				continue
			}
			log.Printf("XReadGroup error: %v — retrying in 2s", err)
			time.Sleep(2 * time.Second)
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				processJob(ctx, rdb, msg, nodeID, priv)
				// Acknowledge message
				rdb.XAck(ctx, jobsStream, consumerGroup, msg.ID)
			}
		}
	}
}

func processJob(ctx context.Context, rdb *redis.Client, msg redis.XMessage, nodeID string, priv ed25519.PrivateKey) {
	fields := msg.Values
	jobID, _ := fields["job_id"].(string)
	gatewayURL, _ := fields["gateway_url"].(string)
	argsRaw, _ := fields["args"].(string)

	log.Printf("Processing job %s from %s", jobID, gatewayURL)

	var args map[string]interface{}
	if argsRaw != "" {
		json.Unmarshal([]byte(argsRaw), &args) //nolint
	}

	// Fetch .wasm from Pinata gateway
	wasmBytes, err := fetchWasm(gatewayURL)
	if err != nil {
		log.Printf("Failed to fetch WASM for job %s: %v", jobID, err)
		postResult(ResultPayload{
			JobID:        jobID,
			NodeID:       nodeID,
			Status:       "failed",
			ErrorMessage: fmt.Sprintf("Failed to fetch WASM: %v", err),
			Signature:    signResult(priv, jobID, ""),
		})
		return
	}

	// Execute in Wazero sandbox
	res := executeWasm(wasmBytes, args)

	if res.err != nil {
		log.Printf("Execution failed for job %s: %v", jobID, res.err)
		postResult(ResultPayload{
			JobID:           jobID,
			NodeID:          nodeID,
			Status:          "failed",
			OutputResult:    res.output,
			ErrorMessage:    res.err.Error(),
			ExecutionTimeMs: res.execMs,
			Signature:       signResult(priv, jobID, ""),
		})
		return
	}

	sig := signResult(priv, jobID, res.output)
	log.Printf("Job %s completed in %.1fms — output: %q", jobID, res.execMs, truncate(res.output, 80))

	postResult(ResultPayload{
		JobID:           jobID,
		NodeID:          nodeID,
		Status:          "completed",
		OutputResult:    res.output,
		ExecutionTimeMs: res.execMs,
		Signature:       sig,
	})
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
