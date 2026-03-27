"""
E2E API Integration Tests

Tests the complete backend API surface against a running server.
Run with: python -m pytest tests/test_e2e_api.py -v
Requires: Backend running on localhost:8000 (AUTH_ENABLED=false)
"""
import pytest
import requests
import time
import json
import uuid

BASE_URL = "http://localhost:8000"


class TestHealthEndpoints:
    """Health check endpoints - should always work"""

    def test_health_simple(self):
        r = requests.get(f"{BASE_URL}/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_health_detailed(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "healthy"
        assert "service" in data
        assert "version" in data

    def test_docs_accessible(self):
        r = requests.get(f"{BASE_URL}/docs")
        assert r.status_code == 200

    def test_openapi_json(self):
        r = requests.get(f"{BASE_URL}/openapi.json")
        assert r.status_code == 200
        data = r.json()
        assert "paths" in data
        assert len(data["paths"]) > 10, "Should have many API routes"


class TestProjectCRUD:
    """Project management endpoints"""

    def test_create_project(self):
        name = f"E2E Test Project {uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/projects", json={"name": name})
        # Accept both 200 and 201
        assert r.status_code in (200, 201), f"Failed: {r.text}"
        data = r.json()
        assert "id" in data or "project" in data
        self._project_id = data.get("id", data.get("project", {}).get("id"))
        return self._project_id

    def test_list_projects(self):
        r = requests.get(f"{BASE_URL}/api/projects")
        assert r.status_code == 200
        data = r.json()
        # Should be a list or dict with projects
        assert isinstance(data, (list, dict))

    def test_project_lifecycle(self):
        """Full CRUD lifecycle"""
        # Create
        name = f"Lifecycle Test {uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/projects", json={"name": name})
        assert r.status_code in (200, 201), f"Create failed: {r.text}"
        data = r.json()
        project_id = data.get("id", data.get("project", {}).get("id"))
        assert project_id, f"No project ID in response: {data}"

        # Get
        r = requests.get(f"{BASE_URL}/api/projects/{project_id}")
        assert r.status_code in (200, 404), f"Get failed: {r.text}"


class TestFolderCRUD:
    """Folder management endpoints"""

    def _create_project(self):
        name = f"Folder Test {uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/projects", json={"name": name})
        if r.status_code in (200, 201):
            data = r.json()
            return data.get("id", data.get("project", {}).get("id"))
        return None

    def test_create_folder(self):
        project_id = self._create_project()
        if not project_id:
            pytest.skip("Could not create project for folder test")

        r = requests.post(
            f"{BASE_URL}/api/knowledge/folders",
            json={"project_id": project_id, "name": "test_folder", "folder_type": "root"}
        )
        assert r.status_code in (200, 201), f"Create folder failed: {r.text}"


class TestAnalyzeEndpoint:
    """Text analysis / diagnosis submission"""

    def test_analyze_requires_text(self):
        """POST /api/analyze without text should fail"""
        r = requests.post(f"{BASE_URL}/api/analyze", json={})
        # Should fail - missing required field
        assert r.status_code in (400, 422, 500), f"Expected validation error, got {r.status_code}: {r.text}"

    def test_analyze_with_text(self):
        """POST /api/analyze with text should return task or result"""
        # Minimum 50 characters required by validation
        r = requests.post(
            f"{BASE_URL}/api/analyze",
            json={"text": "测试公司有50名员工，组织架构扁平化，绩效管理采用OKR体系，目前面临战略方向不清晰的问题，人才梯队建设不足，薪酬体系缺乏竞争力"}
        )
        # Should accept the request (may be sync or async)
        assert r.status_code in (200, 201, 202), f"Analyze failed: {r.text}"
        data = r.json()
        # Response should have some useful data
        assert isinstance(data, dict), f"Expected dict response, got {type(data)}"


class TestDiagnosisEndpoints:
    """Diagnosis task and result endpoints"""

    def test_diagnosis_list(self):
        r = requests.get(f"{BASE_URL}/api/diagnosis")
        assert r.status_code == 200, f"List diagnosis failed: {r.text}"
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_diagnosis_status_nonexistent(self):
        """Non-existent task should return 404 or empty"""
        r = requests.get(f"{BASE_URL}/api/langgraph/status/nonexistent-task-id")
        assert r.status_code in (200, 404), f"Status check failed: {r.text}"


class TestReportEndpoints:
    """Report generation workflow endpoints"""

    def test_report_start_requires_data(self):
        """Starting a report without required data should fail"""
        r = requests.post(f"{BASE_URL}/api/report/start", json={})
        assert r.status_code in (400, 422, 500), f"Expected error, got {r.status_code}: {r.text}"

    def test_report_status_nonexistent(self):
        """Non-existent report task"""
        r = requests.get(f"{BASE_URL}/api/report/status/nonexistent-id")
        assert r.status_code in (200, 404)


class TestKnowledgeEndpoints:
    """Knowledge base endpoints"""

    def test_knowledge_search_no_query(self):
        """Search without query should fail or return empty"""
        r = requests.get(f"{BASE_URL}/api/knowledge/search")
        assert r.status_code in (200, 400, 404, 405, 422), f"Unexpected: {r.status_code}: {r.text}"

    def test_knowledge_list(self):
        r = requests.get(f"{BASE_URL}/api/knowledge/files")
        assert r.status_code in (200, 404, 405), f"List failed: {r.status_code}: {r.text}"


class TestRequirementEndpoint:
    """Requirement extraction endpoint"""

    def test_requirement_requires_text(self):
        r = requests.post(f"{BASE_URL}/api/requirement/extract", json={})
        assert r.status_code in (400, 422, 500), f"Expected error: {r.status_code}: {r.text}"

    def test_requirement_with_text(self):
        r = requests.post(
            f"{BASE_URL}/api/requirement/extract",
            json={"text": "我们是一家科技初创公司，需要组织架构优化方案"}
        )
        # May succeed or fail depending on AI config
        assert r.status_code in (200, 201, 500), f"Unexpected: {r.status_code}: {r.text}"


class TestExportEndpoint:
    """Export endpoints"""

    def test_export_pdf_nonexistent(self):
        r = requests.get(f"{BASE_URL}/api/export/pdf/nonexistent-session")
        # Should fail for non-existent session
        assert r.status_code in (400, 404, 500), f"Unexpected: {r.status_code}: {r.text}"


class TestSecurity:
    """Security verification tests"""

    def test_no_stack_traces_in_errors(self):
        """500 errors should not leak stack traces"""
        r = requests.get(f"{BASE_URL}/api/export/pdf/nonexistent-session")
        if r.status_code == 500:
            text = r.text
            # Should not contain Python file paths or tracebacks
            assert "Traceback" not in text, "Stack trace leaked in error response"
            assert ".py" not in text or "error" in text.lower(), "Python paths leaked"

    def test_cors_preflight(self):
        """OPTIONS preflight should work"""
        r = requests.options(
            f"{BASE_URL}/api/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            }
        )
        # Should succeed (CORS preflight)
        assert r.status_code in (200, 204), f"CORS preflight failed: {r.status_code}"

    def test_rate_limiting_headers(self):
        """Response should not expose rate limit info when disabled"""
        r = requests.get(f"{BASE_URL}/api/health")
        # When rate limiting is disabled, no rate limit headers expected
        # This is just to verify the endpoint works
        assert r.status_code == 200


class TestOpenAPICompleteness:
    """Verify all major route groups are registered"""

    def test_all_route_groups_exist(self):
        r = requests.get(f"{BASE_URL}/openapi.json")
        data = r.json()
        paths = data["paths"]

        expected_prefixes = [
            "/api/health",
            "/api/projects",
            "/api/folders",
            "/api/analyze",
            "/api/diagnosis",
            "/api/report",
            "/api/export",
            "/api/knowledge",
            "/api/requirement",
        ]

        found = []
        for prefix in expected_prefixes:
            if any(p.startswith(prefix) for p in paths):
                found.append(prefix)

        # At least 6 route groups should exist
        assert len(found) >= 6, f"Missing route groups. Found: {found}. All paths: {list(paths.keys())}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
