#!/usr/bin/env bash
#
# test-permission-guard.sh — live curl verification for the dev mutate
# endpoint's Permission Guard layer (POST /dev/canvas/:id/mutate).
#
# Tests the five-branch decision matrix from the add-permission-guard spec:
#   1. null session                       → 401  errors.auth.unauthorized
#   2. canvas exists, role ∈ allowed      → guard passes (400 invalidPayload
#                                            because we send a bogus body —
#                                            getting 400 means the guard let
#                                            the request through to payload
#                                            parsing)
#   3. canvas exists, role ∉ allowed      → 403  errors.canvas.forbidden
#   4. canvas does not exist              → 404  errors.canvas.notFound
#   5. rate limit (>30 / 60s, per-user)   → 429  + retry-after header
#
# Usage:
#   ./scripts/test-permission-guard.sh
#
# Required environment variables (or pass as args):
#   COOKIE            — full Cookie header value (better-auth.session_token=…)
#   CANVAS_OK         — UUID of a canvas the session user owns/edits
#   CANVAS_FORBIDDEN  — UUID of a canvas the session user has NO access to
#
# Optional:
#   BASE_URL          — default: http://localhost:3002
#   SKIP_RATELIMIT    — set to 1 to skip test 5 (it consumes the user bucket
#                       for ~60s)
#
# Exit code: 0 if all assertions pass, 1 otherwise.

set -u

BASE_URL="${BASE_URL:-http://localhost:3002}"
COOKIE="${COOKIE:-${1:-}}"
CANVAS_OK="${CANVAS_OK:-${2:-}}"
CANVAS_FORBIDDEN="${CANVAS_FORBIDDEN:-${3:-}}"
CANVAS_UNKNOWN="00000000-0000-0000-0000-000000000000"
BOGUS_BODY='{"mutations":[{"type":"deleteShape","shapeId":"shape:probe"}]}'

if [[ -z "${COOKIE}" || -z "${CANVAS_OK}" || -z "${CANVAS_FORBIDDEN}" ]]; then
  cat >&2 <<EOF
Missing required input.

Set env vars:
  COOKIE='better-auth.session_token=...; vellum.session_token=...'
  CANVAS_OK=<uuid you have access to>
  CANVAS_FORBIDDEN=<uuid you do NOT have access to>

Or pass as args:
  $0 "<COOKIE>" "<CANVAS_OK>" "<CANVAS_FORBIDDEN>"
EOF
  exit 2
fi

# ANSI colours (skip if stdout is not a TTY)
if [[ -t 1 ]]; then
  GREEN=$'\e[32m'; RED=$'\e[31m'; DIM=$'\e[2m'; BOLD=$'\e[1m'; RESET=$'\e[0m'
else
  GREEN=""; RED=""; DIM=""; BOLD=""; RESET=""
fi

PASSED=0
FAILED=0

# Run one curl test:
#   $1 label
#   $2 expected status
#   $3 expected substring in body (or empty to skip body check)
#   $4 url
#   $5 cookie header value (or empty for no cookie)
run_case() {
  local label="$1" want_status="$2" want_body="$3" url="$4" cookie="$5"
  local headers_file body_file got_status body
  headers_file=$(mktemp)
  body_file=$(mktemp)

  local -a curl_args=(
    -s -D "$headers_file" -o "$body_file"
    -X POST "$url"
    -H 'content-type: application/json'
    -d "$BOGUS_BODY"
    -w '%{http_code}'
  )
  if [[ -n "$cookie" ]]; then
    curl_args+=(-H "cookie: $cookie")
  fi

  got_status=$(curl "${curl_args[@]}")
  body=$(cat "$body_file")

  local ok=1
  if [[ "$got_status" != "$want_status" ]]; then ok=0; fi
  if [[ -n "$want_body" && "$body" != *"$want_body"* ]]; then ok=0; fi

  if [[ $ok -eq 1 ]]; then
    printf "  %s✓%s %s ${DIM}— HTTP %s${RESET}\n" "$GREEN" "$RESET" "$label" "$got_status"
    PASSED=$((PASSED + 1))
  else
    printf "  %s✗%s %s\n" "$RED" "$RESET" "$label"
    printf "     ${DIM}expected${RESET} HTTP %s containing %q\n" "$want_status" "$want_body"
    printf "     ${DIM}got${RESET}      HTTP %s body=%s\n" "$got_status" "$body"
    FAILED=$((FAILED + 1))
  fi

  rm -f "$headers_file" "$body_file"
}

printf "${BOLD}Permission Guard — live curl tests${RESET}\n"
printf "${DIM}target: %s${RESET}\n\n" "$BASE_URL"

printf "%s[1] no session → 401 errors.auth.unauthorized%s\n" "$BOLD" "$RESET"
run_case "anon request rejected" \
  "401" "errors.auth.unauthorized" \
  "$BASE_URL/dev/canvas/$CANVAS_OK/mutate" ""

printf "\n%s[2] authorized canvas → guard passes (400 invalidPayload)%s\n" "$BOLD" "$RESET"
run_case "owner/editor reaches payload parser" \
  "400" "errors.devMutate.invalidPayload" \
  "$BASE_URL/dev/canvas/$CANVAS_OK/mutate" "$COOKIE"

printf "\n%s[3] unauthorized canvas → 403 errors.canvas.forbidden%s\n" "$BOLD" "$RESET"
run_case "non-member blocked" \
  "403" "errors.canvas.forbidden" \
  "$BASE_URL/dev/canvas/$CANVAS_FORBIDDEN/mutate" "$COOKIE"

printf "\n%s[4] unknown canvas → 404 errors.canvas.notFound%s\n" "$BOLD" "$RESET"
run_case "missing canvas" \
  "404" "errors.canvas.notFound" \
  "$BASE_URL/dev/canvas/$CANVAS_UNKNOWN/mutate" "$COOKIE"

if [[ "${SKIP_RATELIMIT:-0}" != "1" ]]; then
  printf "\n%s[5] rate limit → 429 + retry-after%s\n" "$BOLD" "$RESET"
  printf "  ${DIM}firing 35 rapid requests to exhaust the user bucket…${RESET}\n"
  for _ in $(seq 1 35); do
    curl -s -o /dev/null \
      -X POST "$BASE_URL/dev/canvas/$CANVAS_OK/mutate" \
      -H 'content-type: application/json' \
      -H "cookie: $COOKIE" \
      -d "$BOGUS_BODY" >/dev/null
  done
  headers_file=$(mktemp)
  body_file=$(mktemp)
  rl_status=$(curl -s -D "$headers_file" -o "$body_file" \
    -X POST "$BASE_URL/dev/canvas/$CANVAS_OK/mutate" \
    -H 'content-type: application/json' \
    -H "cookie: $COOKIE" \
    -d "$BOGUS_BODY" \
    -w '%{http_code}')
  rl_body=$(cat "$body_file")
  rl_retry_after=$(grep -i '^retry-after:' "$headers_file" | tr -d '\r' | awk '{print $2}')

  if [[ "$rl_status" == "429" && "$rl_body" == *"errors.rateLimit"* && -n "$rl_retry_after" ]]; then
    printf "  %s✓%s rate limit triggered ${DIM}— HTTP 429, retry-after: %s${RESET}\n" \
      "$GREEN" "$RESET" "$rl_retry_after"
    PASSED=$((PASSED + 1))
  else
    printf "  %s✗%s rate limit\n" "$RED" "$RESET"
    printf "     ${DIM}expected${RESET} HTTP 429 + body errors.rateLimit + retry-after header\n"
    printf "     ${DIM}got${RESET}      HTTP %s body=%s retry-after=%q\n" \
      "$rl_status" "$rl_body" "$rl_retry_after"
    FAILED=$((FAILED + 1))
  fi
  rm -f "$headers_file" "$body_file"
else
  printf "\n%s[5] rate limit — skipped (SKIP_RATELIMIT=1)%s\n" "$DIM" "$RESET"
fi

printf "\n${BOLD}Result:${RESET} %s%d passed%s, %s%d failed%s\n" \
  "$GREEN" "$PASSED" "$RESET" \
  "$([[ $FAILED -gt 0 ]] && echo "$RED" || echo "$DIM")" "$FAILED" "$RESET"

[[ $FAILED -eq 0 ]]
