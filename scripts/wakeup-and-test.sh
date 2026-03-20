#!/bin/bash
# Wake-up and Test Deployed Services
# Usage: ./scripts/wakeup-and-test.sh

# === Configuration ===
FRONTEND_URL="https://orgdiagnosis.vercel.app"
BACKEND_URL="https://backend-ai.onrender.com"
MAX_RETRIES=6
RETRY_DELAY=10

echo "=== Waking up services ==="
echo "This will ping the services until they respond or max 60 seconds"
echo ""

# Function to test a URL
test_url() {
    local url=$1
    local name=$2
    local max_time=15

    local code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $max_time "$url" 2>/dev/null)
    if [ "$code" = "200" ]; then
        echo "✅ $name is UP (200)"
        return 0
    else
        echo "⏳ $name returned $code"
        return 1
    fi
}

echo "Step 1: Waking up backend..."
for i in $(seq 1 $MAX_RETRIES); do
    echo "  Attempt $i/$MAX_RETRIES..."

    if test_url "${BACKEND_URL}/api/health" "Backend"; then
        break
    fi

    sleep $RETRY_DELAY
done

echo ""
echo "Step 2: Waking up frontend..."
for i in $(seq 1 $MAX_RETRIES); do
    echo "  $(date '+%H:%M:%S')"
    echo "  Attempt $i/$MAX_RETRIES..."

    if test_url "${FRONTEND_URL}" "Frontend"; then
        break
    fi

    sleep $RETRY_DELAY
done
echo ""
echo "=== Services are now awake! ==="
echo ""

# Test the LangGraph API
echo "Step 3: Testing LangGraph API..."
echo ""

echo "Submitting analysis task..."
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/langgraph/analyze" \
    -H "Content-Type: application/json" \
    -d '{"text":"测试文本"}' \
    --max-time 30 2>&1 | head -20)
echo ""
echo "Full API Test Results:"
echo "$RESPONSE"
