#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT_DIR/.codex/logs"
APP_LOG="$LOG_DIR/dev-app.log"
MOCK_LOG="$LOG_DIR/dev-mock-sub2api.log"
APP_PID_FILE="$LOG_DIR/dev-app.pid"
MOCK_PID_FILE="$LOG_DIR/dev-mock-sub2api.pid"

mkdir -p "$LOG_DIR"

cd "$ROOT_DIR"

cleanup() {
  echo ""
  echo "Stopping local services..."
  if [[ -f "$APP_PID_FILE" ]]; then
    kill "$(cat "$APP_PID_FILE")" 2>/dev/null || true
  fi
  if [[ -f "$MOCK_PID_FILE" ]]; then
    kill "$(cat "$MOCK_PID_FILE")" 2>/dev/null || true
  fi
  rm -f "$APP_PID_FILE" "$MOCK_PID_FILE"
}

trap cleanup INT TERM EXIT

echo "[1/4] Stopping existing listeners on ports 3000 and 3001..."
pnpm kill:ports -- 3000 3001 >/dev/null || true

rm -f "$APP_PID_FILE" "$MOCK_PID_FILE"

echo "[2/4] Starting mock Sub2API on :3001 ..."
pnpm dev:mock-sub2api >"$MOCK_LOG" 2>&1 &
MOCK_PID=$!
echo "$MOCK_PID" >"$MOCK_PID_FILE"

echo "[3/4] Starting main app on :3000 ..."
pnpm dev >"$APP_LOG" 2>&1 &
APP_PID=$!
echo "$APP_PID" >"$APP_PID_FILE"

echo "[4/4] Waiting for startup ..."
sleep 3

echo ""
echo "Local environment started."
echo "Mock Sub2API PID: $MOCK_PID"
echo "Main app PID:     $APP_PID"
echo ""
echo "URLs:"
echo "  Frontend: http://localhost:3000/pay?token=mock-user-token"
echo "  Admin:    http://localhost:3000/admin?token=dev-admin-token-2026"
echo "  Mock UI:  http://localhost:3001/mock-console"
echo "  Mock API: http://localhost:3001/health"
echo ""
echo "Logs:"
echo "  $MOCK_LOG"
echo "  $APP_LOG"
echo ""
echo "Stop:"
echo "  Press Ctrl+C in this terminal, or run: pnpm dev:stop"
echo ""
echo "Keeping services alive. Streaming logs below..."
echo ""

tail -n +1 -f "$MOCK_LOG" "$APP_LOG" &
TAIL_PID=$!

wait "$APP_PID" "$MOCK_PID"
kill "$TAIL_PID" 2>/dev/null || true
