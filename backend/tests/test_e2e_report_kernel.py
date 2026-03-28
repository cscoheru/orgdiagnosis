"""
E2E Test: Report Workflow + Kernel Data Integration

Tests the report workflow's ability to:
  1. Load kernel data for report enrichment
  2. Use kernel graph data alongside AI-generated content

Run with: KERNEL_MODE=demo python -m pytest tests/test_e2e_report_kernel.py -v
Requires: Backend running on localhost:8000 (KERNEL_MODE=demo)
"""
import pytest
import requests
import uuid

BASE_URL = "http://localhost:8000"
KERNEL_API = f"{BASE_URL}/api/v1/kernel"


class TestKernelDataForReport:
    """Test that kernel data is available for report generation"""

    @pytest.fixture
    def sample_kernel_data(self):
        """Seed kernel with sample data mimicking diagnosis results"""
        created_ids = {}

        # Create strategic goal
        r = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Strategic_Goal",
                "properties": {
                    "goal_name": f"报告测试战略_{uuid.uuid4().hex[:8]}",
                    "description": "提升市场占有率至30%",
                    "owner": "CEO",
                    "priority": "high",
                },
            },
        )
        if r.status_code in (200, 201):
            created_ids["goal_id"] = r.json()["_id"]

        # Create org unit
        r = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Org_Unit",
                "properties": {
                    "unit_name": f"报告测试部门_{uuid.uuid4().hex[:8]}",
                    "unit_type": "department",
                    "description": "技术研发部",
                },
            },
        )
        if r.status_code in (200, 201):
            created_ids["org_id"] = r.json()["_id"]

        # Connect them
        if "goal_id" in created_ids and "org_id" in created_ids:
            requests.post(
                f"{KERNEL_API}/relations",
                json={
                    "from_id": created_ids["goal_id"],
                    "to_id": created_ids["org_id"],
                    "relation_type": "Aligned_To",
                },
            )

        # Create employee
        r = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Employee",
                "properties": {
                    "employee_name": f"报告测试员工_{uuid.uuid4().hex[:8]}",
                    "department": "技术研发部",
                    "position": "高级工程师",
                },
            },
        )
        if r.status_code in (200, 201):
            created_ids["employee_id"] = r.json()["_id"]

        return created_ids

    def test_kernel_objects_queryable_for_all_dimensions(self, sample_kernel_data):
        """Objects should exist for report data loading"""
        r = requests.get(f"{KERNEL_API}/objects", params={"limit": 100})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

        # Check that we have objects across multiple domains
        model_keys = {o["model_key"] for o in data}
        # At minimum, we should see the objects we just created
        assert len(model_keys) >= 2, f"Expected multiple model types, got: {model_keys}"

    def test_graph_returns_structured_data_for_report(self, sample_kernel_data):
        """Graph traversal should return data suitable for report assembly"""
        if "goal_id" not in sample_kernel_data:
            pytest.skip("Could not create test data")

        r = requests.get(
            f"{KERNEL_API}/graph",
            params={
                "start_obj_id": sample_kernel_data["goal_id"],
                "depth": 2,
                "direction": "OUTBOUND",
            },
        )
        assert r.status_code == 200
        data = r.json()

        # Graph should have root with properties
        assert "root" in data
        assert "properties" in data["root"]
        assert "model_key" in data["root"]

        # Tree should be traversable for report content extraction
        assert "tree" in data
        tree = data["tree"]
        # Tree may have children
        if "children" in tree:
            assert isinstance(tree["children"], list)


class TestReportEndpointsWithKernel:
    """Report API endpoints should work alongside kernel"""

    def test_report_status_nonexistent(self):
        """Non-existent report task should return appropriate error"""
        r = requests.get(f"{BASE_URL}/api/report/status/nonexistent-report-id")
        assert r.status_code in (200, 404)

    def test_kernel_data_accessible_during_report_workflow(self):
        """Kernel API should remain accessible during report generation"""
        # Simultaneous kernel query while report endpoint is available
        r_kernel = requests.get(f"{KERNEL_API}/meta")
        r_report = requests.get(f"{BASE_URL}/api/report/status/test-id")

        assert r_kernel.status_code == 200
        # Report may return 404 for nonexistent task - that's fine
        assert r_report.status_code in (200, 404)


class TestKernelObjectCountsByDomain:
    """Verify kernel has appropriate object distribution across domains"""

    DOMAIN_MODELS = {
        "strategy": ["Strategic_Goal", "Strategic_Initiative", "Market_Context"],
        "structure": ["Org_Unit", "Job_Role", "Process_Flow"],
        "performance": ["Performance_Metric", "Competency", "Review_Cycle"],
        "compensation": ["Salary_Band", "Pay_Component", "Market_Benchmark"],
        "talent": ["Employee", "Talent_Pipeline", "Learning_Development"],
    }

    def test_objects_per_domain_queryable(self):
        """Each domain's objects should be queryable by model_key"""
        for domain, models in self.DOMAIN_MODELS.items():
            for model_key in models:
                r = requests.get(
                    f"{KERNEL_API}/objects",
                    params={"model_key": model_key, "limit": 10},
                )
                # Should not error - may be empty list
                assert r.status_code == 200, f"Failed to query {model_key}: {r.text}"
                data = r.json()
                assert isinstance(data, list), f"Expected list for {model_key}"


class TestCrossDomainGraphQuery:
    """Test graph queries that span multiple domains"""

    @pytest.fixture
    def cross_domain_data(self):
        """Create objects across multiple domains connected by relations"""
        ids = {}

        # Strategy domain
        r = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Strategic_Goal",
                "properties": {
                    "goal_name": f"跨域测试_{uuid.uuid4().hex[:8]}",
                    "description": "跨域图谱测试",
                    "owner": "测试",
                    "priority": "medium",
                },
            },
        )
        if r.status_code in (200, 201):
            ids["goal"] = r.json()["_id"]

        # Organization domain
        r = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Org_Unit",
                "properties": {
                    "unit_name": f"跨域部门_{uuid.uuid4().hex[:8]}",
                    "unit_type": "department",
                    "description": "测试",
                },
            },
        )
        if r.status_code in (200, 201):
            ids["org"] = r.json()["_id"]

        # Talent domain
        r = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Employee",
                "properties": {
                    "employee_name": f"跨域员工_{uuid.uuid4().hex[:8]}",
                    "department": "测试部门",
                    "position": "经理",
                },
            },
        )
        if r.status_code in (200, 201):
            ids["employee"] = r.json()["_id"]

        # Connect: Goal -> Org -> Employee
        if "goal" in ids and "org" in ids:
            requests.post(
                f"{KERNEL_API}/relations",
                json={
                    "from_id": ids["goal"],
                    "to_id": ids["org"],
                    "relation_type": "Aligned_To",
                },
            )
        if "org" in ids and "employee" in ids:
            requests.post(
                f"{KERNEL_API}/relations",
                json={
                    "from_id": ids["org"],
                    "to_id": ids["employee"],
                    "relation_type": "Contains",
                },
            )

        return ids

    def test_cross_domain_graph_depth_3(self, cross_domain_data):
        """Graph with depth=3 should traverse across domains"""
        if "goal" not in cross_domain_data:
            pytest.skip("Could not create cross-domain test data")

        r = requests.get(
            f"{KERNEL_API}/graph",
            params={
                "start_obj_id": cross_domain_data["goal"],
                "depth": 3,
                "direction": "OUTBOUND",
            },
        )
        assert r.status_code == 200
        data = r.json()

        # Root should be Strategic_Goal
        assert data["root"]["model_key"] == "Strategic_Goal"

        # Should traverse to other domains
        all_model_keys = {data["root"]["model_key"]}

        def collect_model_keys(tree):
            if not tree or "children" not in tree:
                return
            for child in tree["children"]:
                if "model_key" in child:
                    all_model_keys.add(child["model_key"])
                collect_model_keys(child)

        collect_model_keys(data["tree"])

        # Should span at least 2 domains
        expected_domains = {"Strategic_Goal", "Org_Unit"}
        assert expected_domains.issubset(all_model_keys), (
            f"Cross-domain traversal incomplete. Found models: {all_model_keys}"
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
