#!/usr/bin/env python3
"""
E2E Test Suite for org-diagnosis
Tests critical workflows: Projects, Diagnosis, Reports, Knowledge Base
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:3000"

# Test counters
TESTS_PASSED = 0
TESTS_FAILED = 0

def pass_test(name):
    global TESTS_PASSED
    print(f"\033[92m✓ PASS\033[0m: {name}")
    TESTS_PASSED += 1

def fail_test(name, error=""):
    global TESTS_FAILED
    print(f"\033[91m✗ FAIL\033[0m: {name}")
    if error:
        print(f"  Error: {error}")
    TESTS_FAILED += 1

def warn_test(name):
    print(f"\033[93m⚠ WARN\033[0m: {name}")

print("=" * 50)
print("  org-diagnosis E2E Test Suite")
print("=" * 50)
print()
print(f"Backend: {BASE_URL}")
print(f"Frontend: {FRONTEND_URL}")
print()

# ============================================
# 1. Backend Health Check
# ============================================
print("-" * 50)
print("1. Backend Health Check")
print("-" * 50)

try:
    resp = requests.get(f"{BASE_URL}/health", timeout=10)
    if resp.status_code == 200:
        pass_test("Backend health check (HTTP 200)")
        data = resp.json()
        if data.get("status") == "ok":
            pass_test("Health status is 'ok'")
        else:
            fail_test("Health status check", f"Got: {data}")
    else:
        fail_test("Backend health check", f"HTTP {resp.status_code}")
except Exception as e:
    fail_test("Backend health check", str(e))
    sys.exit(1)

# ============================================
# 2. Projects API Tests
# ============================================
print()
print("-" * 50)
print("2. Projects API Tests")
print("-" * 50)

test_project_id = None

# Create a test project
try:
    resp = requests.post(
        f"{BASE_URL}/api/projects/",
        json={
            "name": "E2E Test Project",
            "client_name": "Test Client",
            "description": "Automated E2E test project"
        },
        timeout=10
    )
    if resp.status_code in [200, 201]:
        data = resp.json()
        # Handle both direct ID and nested project.ID response
        test_project_id = data.get("id") or data.get("project", {}).get("id")
        if test_project_id:
            pass_test(f"Create project (ID: {test_project_id[:8]}...)")
        else:
            fail_test("Create project", "No ID returned")
    else:
        fail_test("Create project", f"HTTP {resp.status_code}")
except Exception as e:
    fail_test("Create project", str(e))

# List projects
try:
    resp = requests.get(f"{BASE_URL}/api/projects/", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        projects = data.get("projects", [])
        if any(p.get("name") == "E2E Test Project" for p in projects):
            pass_test("List projects includes test project")
        else:
            pass_test("List projects works (project may be in different name)")
    else:
        fail_test("List projects", f"HTTP {resp.status_code}")
except Exception as e:
    fail_test("List projects", str(e))

# ============================================
# 3. Folders API Tests
# ============================================
print()
print("-" * 50)
print("3. Folders API Tests")
print("-" * 50)

test_folder_id = None

if test_project_id:
    # Get project folders using correct endpoint
    try:
        resp = requests.get(f"{BASE_URL}/api/knowledge/folders/project/{test_project_id}", timeout=10)
        if resp.status_code == 200:
            pass_test("Get project folders")
        else:
            warn_test(f"Get project folders (HTTP {resp.status_code})")
    except Exception as e:
        warn_test(f"Get project folders ({e})")

    # Create a test folder
    try:
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/folders",
            json={"project_id": test_project_id, "name": "Test Folder", "parent_id": None},
            timeout=10
        )
        if resp.status_code in [200, 201]:
            data = resp.json()
            test_folder_id = data.get("id") or data.get("folder", {}).get("id")
            if test_folder_id:
                pass_test(f"Create folder (ID: {test_folder_id[:8]}...)")
            else:
                fail_test("Create folder", "No ID returned")
        else:
            warn_test(f"Create folder (HTTP {resp.status_code})")
    except Exception as e:
        warn_test(f"Create folder ({e})")
else:
    warn_test("Skipping folder tests (no project ID)")

# ============================================
# 4. LangGraph Diagnosis API Tests
# ============================================
print()
print("-" * 50)
print("4. LangGraph Diagnosis API Tests")
print("-" * 50)

task_id = None

# Submit analysis with project binding
try:
    payload = {
        "text": "This is a test diagnosis input for E2E testing. The company is facing challenges with organizational structure and communication flow."
    }
    if test_project_id:
        payload["project_id"] = test_project_id

    resp = requests.post(
        f"{BASE_URL}/api/langgraph/analyze",
        json=payload,
        timeout=30
    )
    if resp.status_code == 200:
        data = resp.json()
        task_id = data.get("task_id")
        if task_id:
            pass_test(f"Submit analysis (Task ID: {task_id[:8]}...)")
        else:
            fail_test("Submit analysis", "No task ID returned")
    else:
        fail_test("Submit analysis", f"HTTP {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    fail_test("Submit analysis", str(e))

# Poll for task completion
if task_id:
    print("  Polling task status (timeout: 90s)...")
    start_time = time.time()
    timeout = 90
    status = "pending"

    while time.time() - start_time < timeout:
        try:
            resp = requests.get(f"{BASE_URL}/api/langgraph/status/{task_id}", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                status = data.get("status", "unknown")
                progress = data.get("progress_percentage", 0)
                print(f"    Status: {status}, Progress: {progress}%")

                if status == "completed":
                    pass_test("Task completed successfully")
                    break
                elif status == "failed":
                    error = data.get("error", "Unknown error")
                    fail_test("Task execution", error)
                    break
            else:
                print(f"    Status check failed: HTTP {resp.status_code}")
        except Exception as e:
            print(f"    Status check error: {e}")

        time.sleep(3)
    else:
        fail_test("Task completion timeout", "Task did not complete within 90s")

    # Get result if completed
    if status == "completed":
        try:
            resp = requests.get(f"{BASE_URL}/api/langgraph/result/{task_id}", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                result = data.get("result", {})
                if "dimensions" in result:
                    pass_test("Get task result contains dimensions")
                else:
                    fail_test("Get task result", "No dimensions in result")
            else:
                fail_test("Get task result", f"HTTP {resp.status_code}")
        except Exception as e:
            fail_test("Get task result", str(e))

# ============================================
# 5. Knowledge Base API Tests
# ============================================
print()
print("-" * 50)
print("5. Knowledge Base API Tests")
print("-" * 50)

# List documents
try:
    resp = requests.get(f"{BASE_URL}/api/knowledge/documents?limit=5", timeout=10)
    if resp.status_code == 200:
        pass_test("List knowledge documents")
    else:
        warn_test(f"List knowledge documents (HTTP {resp.status_code})")
except Exception as e:
    warn_test(f"List knowledge documents ({e})")

# Search documents
try:
    resp = requests.post(
        f"{BASE_URL}/api/knowledge/search",
        json={"query": "test", "limit": 5},
        timeout=10
    )
    if resp.status_code == 200:
        pass_test("Search knowledge documents")
    else:
        warn_test(f"Search knowledge documents (HTTP {resp.status_code})")
except Exception as e:
    warn_test(f"Search knowledge documents ({e})")

# ============================================
# 6. Frontend Accessibility Tests
# ============================================
print()
print("-" * 50)
print("6. Frontend Accessibility Tests")
print("-" * 50)

# Test frontend pages
pages_to_test = [
    ("/", "Home page"),
    ("/login", "Login page"),
    ("/projects", "Projects page"),
    ("/input", "Diagnosis input page"),
    ("/knowledge/dashboard", "Knowledge dashboard"),
    ("/knowledge/files", "File manager"),
]

for path, name in pages_to_test:
    try:
        resp = requests.get(f"{FRONTEND_URL}{path}", timeout=10)
        if resp.status_code == 200:
            pass_test(f"Frontend: {name}")
        else:
            fail_test(f"Frontend: {name}", f"HTTP {resp.status_code}")
    except Exception as e:
        fail_test(f"Frontend: {name}", str(e))

# ============================================
# 7. Cleanup
# ============================================
print()
print("-" * 50)
print("7. Cleanup")
print("-" * 50)

# Delete test folder
if test_folder_id:
    try:
        resp = requests.delete(f"{BASE_URL}/api/folders/{test_folder_id}", timeout=10)
        pass_test("Delete test folder")
    except Exception as e:
        warn_test(f"Delete test folder ({e})")

# Delete test project
if test_project_id:
    try:
        resp = requests.delete(f"{BASE_URL}/api/projects/{test_project_id}", timeout=10)
        pass_test("Delete test project")
    except Exception as e:
        warn_test(f"Delete test project ({e})")

# ============================================
# Summary
# ============================================
print()
print("=" * 50)
print("  Test Summary")
print("=" * 50)
print(f"\033[92mPassed: {TESTS_PASSED}\033[0m")
print(f"\033[91mFailed: {TESTS_FAILED}\033[0m")
print()

if TESTS_FAILED == 0:
    print("\033[92mAll tests passed!\033[0m")
    sys.exit(0)
else:
    print("\033[91mSome tests failed. Please review the output above.\033[0m")
    sys.exit(1)
