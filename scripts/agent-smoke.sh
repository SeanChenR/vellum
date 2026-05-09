#!/usr/bin/env bash
#
# agent-smoke.sh — live SSE smoke test for the M13 agent runtime.
#
# Walks the full production path:
#   1. Verifies the user has a BYOK key for the chosen provider.
#   2. Posts a prompt to /agent/canvas/:id/run and streams SSE events.
#   3. Optionally cancels the run halfway through.
#
# Prereq:
#   - `bun run dev` is running (api on http://localhost:3002).
#   - You logged into the web UI at least once and have a session cookie.
#   - You saved an API key via Settings → API Keys for the chosen provider.
#   - You opened the target canvas in the browser at least once so the
#     TLSocketRoom is acquired (mutator broadcasts go through that room).
#
# Usage:
#   ./scripts/agent-smoke.sh <canvas_id> [prompt]
#   COOKIE=better-auth.session_token=xxx ./scripts/agent-smoke.sh <id>
#
# Required env (or arg 1):
#   COOKIE            full Cookie header value, e.g.
#                     `better-auth.session_token=eyJ…`
#                     Copy from browser DevTools → Application → Cookies.
#
# Optional env:
#   BASE_URL          default: http://localhost:3002
#   PROVIDER          openai | anthropic | google (default: openai)
#   MODEL             default: gpt-4o-mini (must match a key you saved)
#   SESSION_ID        tldraw session id; default: smoke-cli
#   CANCEL_AFTER_MS   ms to wait before cancelling (omit to let it finish)
#
# Exit codes:
#   0  saw `done` event
#   1  saw `error` event or curl failed
#   2  prereq missing (cookie / canvas id)

set -u

BASE_URL="${BASE_URL:-http://localhost:3002}"
COOKIE="${COOKIE:-}"
CANVAS_ID="${1:-}"
PROMPT="${2:-create a markdown shape that says 'hello from agent smoke'}"
PROVIDER="${PROVIDER:-openai}"
MODEL="${MODEL:-gpt-4o-mini}"
SESSION_ID="${SESSION_ID:-smoke-cli}"
CANCEL_AFTER_MS="${CANCEL_AFTER_MS:-}"

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
dim()    { printf '\033[2m%s\033[0m\n' "$*"; }

if [[ -z "${COOKIE}" ]]; then
  red "❌ COOKIE env var required."
  echo
  echo "How to get it:"
  echo "  1. Open the web UI in browser, log in."
  echo "  2. DevTools → Application → Cookies → http://localhost:3002"
  echo "  3. Copy the row whose name starts with 'better-auth.session_token'"
  echo "  4. export COOKIE='better-auth.session_token=<value>'"
  exit 2
fi

if [[ -z "${CANVAS_ID}" ]]; then
  red "❌ canvas id required as first arg."
  echo "  ./scripts/agent-smoke.sh <canvas_id> [prompt]"
  exit 2
fi

# Generate a UUID v4 client-side so we can target the cancel endpoint.
RUN_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"

yellow "═══ Vellum agent smoke ═══"
echo "  base url   : ${BASE_URL}"
echo "  canvas id  : ${CANVAS_ID}"
echo "  provider   : ${PROVIDER}"
echo "  model      : ${MODEL}"
echo "  session id : ${SESSION_ID}"
echo "  run id     : ${RUN_ID}"
echo "  prompt     : ${PROMPT}"
echo

# ---------------------------------------------------------------------------
# Pre-flight: confirm BYOK key exists for the chosen provider.
# ---------------------------------------------------------------------------
yellow "▸ checking BYOK key …"
BYOK_LIST="$(curl -s -H "Cookie: ${COOKIE}" "${BASE_URL}/api/account/byok" || true)"
if [[ -z "${BYOK_LIST}" ]]; then
  red "❌ /api/account/byok returned empty — session cookie probably invalid."
  exit 2
fi
if echo "${BYOK_LIST}" | grep -q "\"${PROVIDER}\""; then
  green "✓ BYOK key for '${PROVIDER}' is registered."
else
  red "❌ no BYOK key for '${PROVIDER}'. Save one via Settings → API Keys first."
  echo "    response: ${BYOK_LIST}"
  exit 2
fi

# ---------------------------------------------------------------------------
# Optional cancel scheduler — fire-and-forget background subshell.
# ---------------------------------------------------------------------------
if [[ -n "${CANCEL_AFTER_MS}" ]]; then
  (
    sleep_seconds="$(awk "BEGIN {print ${CANCEL_AFTER_MS}/1000}")"
    sleep "${sleep_seconds}"
    yellow "▸ sending cancel after ${CANCEL_AFTER_MS}ms …"
    cancel_status="$(curl -s -o /dev/null -w '%{http_code}' \
      -X POST \
      -H "Cookie: ${COOKIE}" \
      "${BASE_URL}/agent/run/${RUN_ID}/cancel")"
    yellow "  cancel HTTP status: ${cancel_status}"
  ) &
fi

# ---------------------------------------------------------------------------
# Stream SSE.
# ---------------------------------------------------------------------------
yellow "▸ POST /agent/canvas/${CANVAS_ID}/run …"
echo "  (Ctrl-C to abort; stream auto-closes on done/error)"
echo

BODY="$(cat <<JSON
{
  "runId": "${RUN_ID}",
  "provider": "${PROVIDER}",
  "model": "${MODEL}",
  "messages": [{ "role": "user", "content": $(printf '%s' "${PROMPT}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))') }],
  "sessionId": "${SESSION_ID}"
}
JSON
)"

OUTCOME="unknown"
LINE_COUNT=0
EVENT_TYPE=""
while IFS= read -r line; do
  LINE_COUNT=$((LINE_COUNT + 1))
  if [[ "${line}" == event:* ]]; then
    EVENT_TYPE="${line#event: }"
    EVENT_TYPE="${EVENT_TYPE%$'\r'}"
    case "${EVENT_TYPE}" in
      text)        printf '\033[36m%s\033[0m  ' "text"        ;;
      tool_call)   printf '\033[35m%s\033[0m  ' "tool_call"   ;;
      tool_result) printf '\033[35m%s\033[0m  ' "tool_result" ;;
      done)        printf '\033[32m%s\033[0m  ' "done"        ;;
      error)       printf '\033[31m%s\033[0m  ' "error"       ;;
      *)           printf '%s  ' "${EVENT_TYPE}"              ;;
    esac
  elif [[ "${line}" == data:* ]]; then
    payload="${line#data: }"
    payload="${payload%$'\r'}"
    if command -v jq >/dev/null 2>&1; then
      echo "${payload}" | jq -c .
    else
      echo "${payload}"
    fi
    case "${EVENT_TYPE}" in
      done)  OUTCOME="done"  ;;
      error) OUTCOME="error" ;;
    esac
  elif [[ "${line}" == ":hb"* ]]; then
    dim "  · heartbeat"
  fi
done < <(
  curl -sN \
    -X POST \
    -H "Cookie: ${COOKIE}" \
    -H "content-type: application/json" \
    --data-binary "${BODY}" \
    "${BASE_URL}/agent/canvas/${CANVAS_ID}/run"
)

echo
case "${OUTCOME}" in
  done)
    green "✓ run completed (${LINE_COUNT} stream lines)"
    yellow "▸ open the canvas in browser; the new shape should be visible."
    exit 0
    ;;
  error)
    red "✗ run ended with error event (see payload above)"
    exit 1
    ;;
  *)
    red "✗ stream closed without terminal event (network or auth issue?)"
    exit 1
    ;;
esac
