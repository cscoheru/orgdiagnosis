#!/bin/bash

# E2E Test Script for org-diagnosis
# Tests critical workflows: Projects, Diagnosis, Reports, Knowledge Base

set -e

BASE_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000}"
FRONTEND_URL="http://localhost:3000"
TEST_PROJECT_ID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================================="
echo "  org-diagnosis E2E Test Suite"
echo "=================================================="
echo ""
echo "Backend: $BASE_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    if [ -n "$2" ]; then
        echo "  Error: $2"
    fi
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

# ============================================
# 1. Backend Health Check
# ============================================
echo "--------------------------------------------------"
echo "1. Backend Health Check"
echo "--------------------------------------------------"

# Test backend health
echo "Testing backend health endpoint..."
HEALTH=$(curl -s -w "\n%{http_code}" "$BASE_URL/health" 2>/dev/null)
HTTP_CODE=$(echo "$HEALTH" | tail -n1)
BODY=$(echo "$HEALTH" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    pass "Backend health check (HTTP 200)"
else
    fail "Backend health check" "Got HTTP $HTTP_CODE"
    exit 1
fi

# Test database connection
echo "Testing database connection..."
if echo "$BODY" | grep -q '"database":"connected"'; then
    pass "Database connection"
else
    fail "Database connection" "Database not connected"
fi

# ============================================
# 2. Projects API Tests
# ============================================
echo ""
echo "--------------------------------------------------"
echo "2. Projects API Tests"
echo "--------------------------------------------------"

# Create a test project
echo "Creating test project..."
CREATE_RESULT=$(curl -s -X POST "$BASE_URL/api/projects/" \
    -H "Content-Type: application/json" \
    -d '{"name": "E2E Test Project", "client_name": "Test Client", "description": "Automated E2E test project"}')

TEST_PROJECT_ID=$(echo "$CREATE_RESULT" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TEST_PROJECT_ID" ] && [ "$TEST_PROJECT_ID" != "null" ]; then
    pass "Create project (ID: $TEST_PROJECT_ID)"
else
    fail "Create project" "No project ID returned"
fi

# List projects
echo "Listing projects..."
PROJECTS=$(curl -s "$BASE_URL/api/projects/")
if echo "$PROJECTS" | grep -q "E2E Test Project"; then
    pass "List projects includes test project"
else
    fail "List projects" "Test project not found in list"
fi

# Get single project
echo "Getting single project..."
SINGLE_PROJECT=$(curl -s "$BASE_URL/api/projects/$TEST_PROJECT_ID")
if echo "$SINGLE_PROJECT" | grep -q "E2E Test Project"; then
    pass "Get single project"
else
    fail "Get single project" "Project not found"
fi

# ============================================
# 3. Folders API Tests (File Manager)
# ============================================
echo ""
echo "--------------------------------------------------"
echo "3. Folders API Tests"
echo "--------------------------------------------------"

# Get root folders for project
echo "Getting root folders..."
FOLDERS=$(curl -s "$BASE_URL/api/projects/$TEST_PROJECT_ID/folders")
if [ -n "$FOLDERS" ]; then
    pass "Get project folders"
else
    fail "Get project folders" "No response"
fi

# Create a test folder
echo "Creating test folder..."
FOLDER_RESULT=$(curl -s -X POST "$BASE_URL/api/projects/$TEST_PROJECT_ID/folders" \
    -H "Content-Type: application/json" \
    -d '{"name": "Test Folder", "parent_id": null}')

FOLDER_ID=$(echo "$FOLDER_RESULT" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)

if [ -n "$FOLDER_ID" ]; then
    pass "Create folder (ID: $FOLDER_ID)"
else
    fail "Create folder" "No folder ID returned"
fi

# ============================================
# 4. LangGraph Diagnosis API Tests
# ============================================
echo ""
echo "--------------------------------------------------"
echo "4. LangGraph Diagnosis API Tests"
echo "--------------------------------------------------"

# Submit text analysis with project binding
echo "Submitting text analysis with project binding..."
ANALYZE_RESULT=$(curl -s -X POST "$BASE_URL/api/langgraph/analyze" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"This is a test diagnosis input for E2E testing. The company is facing challenges with organizational structure and communication flow.\", \"project_id\": \"$TEST_PROJECT_ID\"}")

TASK_ID=$(echo "$ANALYZE_RESULT" | grep -o '"task_id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TASK_ID" ] && [ "$TASK_ID" != "null" ]; then
    pass "Submit analysis (Task ID: $TASK_ID)"
else
    fail "Submit analysis" "No task ID returned: $ANALYZE_RESULT"
fi

# Poll for task status (with timeout)
echo "Polling task status (timeout: 60s)..."
TIMEOUT=60
ELAPSED=0
STATUS="pending"

while [ "$STATUS" = "pending" ] || [ "$STATUS" = "processing" ]; do
    if [ $ELAPSED -ge $TIMEOUT ]; then
        fail "Task completion timeout" "Task did not complete within ${TIMEOUT}s"
        break
    fi

    sleep 3
    ELAPSED=$((ELAPSED + 3))

    STATUS_RESULT=$(curl -s "$BASE_URL/api/langgraph/status/$TASK_ID")
    STATUS=$(echo "$STATUS_RESULT" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

    echo "  Status: $STATUS (${ELAPSED}s)"

    if [ "$STATUS" = "completed" ]; then
        pass "Task completed successfully"
        break
    elif [ "$STATUS" = "failed" ]; then
        ERROR_MSG=$(echo "$STATUS_RESULT" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        fail "Task failed" "$ERROR_MSG"
        break
    fi
done

# Get task result
if [ "$STATUS" = "completed" ]; then
    echo "Getting task result..."
    RESULT=$(curl -s "$BASE_URL/api/langgraph/result/$TASK_ID")
    if echo "$RESULT" | grep -q "dimensions"; then
        pass "Get task result contains dimensions"
    else
        fail "Get task result" "No dimensions in result"
    fi
fi

# ============================================
# 5. Knowledge Base API Tests
# ============================================
echo ""
echo "--------------------------------------------------"
echo "5. Knowledge Base API Tests"
echo "--------------------------------------------------"

# Test knowledge base health
echo "Testing knowledge base endpoints..."

# List documents
DOCS=$(curl -s "$BASE_URL/api/knowledge/documents?limit=5")
if [ -n "$DOCS" ]; then
    pass "List knowledge documents"
else
    warn "List knowledge documents (may be empty)"
fi

# Search documents
SEARCH=$(curl -s -X POST "$BASE_URL/api/knowledge/search" \
    -H "Content-Type: application/json" \
    -d '{"query": "test", "limit": 5}')

if [ -n "$SEARCH" ]; then
    pass "Search knowledge documents"
else
    warn "Search knowledge documents (may have no results)"
fi

# ============================================
# 6. Cleanup
# ============================================
echo ""
echo "--------------------------------------------------"
echo "6. Cleanup"
echo "--------------------------------------------------"

# Delete test folder
if [ -n "$FOLDER_ID" ]; then
    echo "Deleting test folder..."
    curl -s -X DELETE "$BASE_URL/api/folders/$FOLDER_ID" > /dev/null
    pass "Delete test folder"
fi

# Delete test project
if [ -n "$TEST_PROJECT_ID" ]; then
    echo "Deleting test project..."
    curl -s -X DELETE "$BASE_URL/api/projects/$TEST_PROJECT_ID" > /dev/null
    pass "Delete test project"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "=================================================="
echo "  Test Summary"
echo "=================================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
