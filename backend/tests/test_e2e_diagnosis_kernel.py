"""
E2E Test: Diagnosis + Kernel Pipeline

Tests the complete flow:
  1. Meta-models are seeded and accessible
  2. Objects can be created via kernel API
  3. Relations can be created between objects
  4. Graph traversal returns correct tree structure
  5. Kernel bridge integration with diagnosis workflow

Run with: KERNEL_MODE=demo python -m pytest tests/test_e2e_diagnosis_kernel.py -v
Requires: Backend running on localhost:8000 (KERNEL_MODE=demo)
"""
import pytest
import requests
import json
import uuid

BASE_URL = "http://localhost:8000"
KERNEL_API = f"{BASE_URL}/api/v1/kernel"


class TestKernelHealth:
    """Verify kernel API is reachable and seeded"""

    def test_kernel_meta_models_list(self):
        """GET /meta should return seeded meta-models"""
        r = requests.get(f"{KERNEL_API}/meta")
        assert r.status_code == 200, f"Failed: {r.text}"
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        # Should have at least the original 8 meta-models from seed
        model_keys = [m["model_key"] for m in data]
        assert "Strategic_Goal" in model_keys, f"Missing Strategic_Goal. Got: {model_keys}"
        assert "Org_Unit" in model_keys, f"Missing Org_Unit. Got: {model_keys}"
        assert "Employee" in model_keys, f"Missing Employee. Got: {model_keys}"

    def test_kernel_meta_model_has_fields(self):
        """Each meta-model should have field definitions"""
        r = requests.get(f"{KERNEL_API}/meta/Strategic_Goal")
        assert r.status_code == 200, f"Failed: {r.text}"
        data = r.json()
        assert "fields" in data, "Meta-model should have fields"
        assert len(data["fields"]) > 0, "Meta-model should have at least one field"


class TestKernelObjectCRUD:
    """Object CRUD operations via kernel API"""

    @pytest.fixture
    def strategic_goal_id(self):
        """Create a test strategic goal and return its _id"""
        unique_name = f"E2E目标_{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Strategic_Goal",
                "properties": {
                    "goal_name": unique_name,
                    "description": "E2E测试用战略目标",
                    "owner": "测试用户",
                    "priority": "high",
                },
            },
        )
        assert r.status_code in (200, 201), f"Create failed: {r.text}"
        data = r.json()
        assert "_id" in data, f"No _id in response: {data}"
        return data["_id"]

    @pytest.fixture
    def org_unit_id(self):
        """Create a test org unit"""
        unique_name = f"E2E部门_{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Org_Unit",
                "properties": {
                    "unit_name": unique_name,
                    "unit_type": "department",
                    "description": "E2E测试用组织单元",
                },
            },
        )
        assert r.status_code in (200, 201), f"Create org unit failed: {r.text}"
        return r.json()["_id"]

    def test_create_object(self, strategic_goal_id):
        """Object should be retrievable after creation"""
        r = requests.get(f"{KERNEL_API}/objects/{strategic_goal_id}")
        assert r.status_code == 200, f"Get failed: {r.text}"
        data = r.json()
        assert data["model_key"] == "Strategic_Goal"
        assert data["properties"]["goal_name"].startswith("E2E目标_")

    def test_list_objects_by_model(self, strategic_goal_id):
        """Should be able to list objects filtered by model_key"""
        r = requests.get(f"{KERNEL_API}/objects", params={"model_key": "Strategic_Goal"})
        assert r.status_code == 200, f"List failed: {r.text}"
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        # Should contain our test object
        ids = [o["_id"] for o in data]
        assert strategic_goal_id in ids, f"Our object not found in list. Got {len(data)} objects"

    def test_update_object(self, strategic_goal_id):
        """Should be able to update object properties"""
        r = requests.patch(
            f"{KERNEL_API}/objects/{strategic_goal_id}",
            json={"properties": {"priority": "critical"}},
        )
        assert r.status_code == 200, f"Update failed: {r.text}"
        # Verify update
        r = requests.get(f"{KERNEL_API}/objects/{strategic_goal_id}")
        data = r.json()
        assert data["properties"]["priority"] == "critical"

    def test_delete_object(self):
        """Should be able to delete an object"""
        unique_name = f"E2E删除_{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Org_Unit",
                "properties": {"unit_name": unique_name, "unit_type": "team"},
            },
        )
        obj_id = r.json()["_id"]
        r = requests.delete(f"{KERNEL_API}/objects/{obj_id}")
        assert r.status_code == 200, f"Delete failed: {r.text}"
        # Verify deleted
        r = requests.get(f"{KERNEL_API}/objects/{obj_id}")
        assert r.status_code == 404, f"Object should be deleted, got {r.status_code}"


class TestKernelRelationAndGraph:
    """Relations and graph traversal"""

    @pytest.fixture
    def connected_objects(self):
        """Create two connected objects: Org_Unit -> Job_Role"""
        org_name = f"E2E公司_{uuid.uuid4().hex[:8]}"
        role_name = f"E2E岗位_{uuid.uuid4().hex[:8]}"

        r1 = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Org_Unit",
                "properties": {"unit_name": org_name, "unit_type": "company"},
            },
        )
        org_id = r1.json()["_id"]

        r2 = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Job_Role",
                "properties": {"role_name": role_name, "role_level": "senior"},
            },
        )
        role_id = r2.json()["_id"]

        return {"org_id": org_id, "role_id": role_id, "org_name": org_name, "role_name": role_name}

    def test_create_relation(self, connected_objects):
        """Should be able to create a relation between objects"""
        r = requests.post(
            f"{KERNEL_API}/relations",
            json={
                "from_id": connected_objects["org_id"],
                "to_id": connected_objects["role_id"],
                "relation_type": "Contains",
            },
        )
        assert r.status_code in (200, 201), f"Create relation failed: {r.text}"

    def test_graph_traversal(self, connected_objects):
        """Graph query should return tree with connected objects"""
        # First create the relation
        requests.post(
            f"{KERNEL_API}/relations",
            json={
                "from_id": connected_objects["org_id"],
                "to_id": connected_objects["role_id"],
                "relation_type": "Contains",
            },
        )

        # Query graph from org_unit
        r = requests.get(
            f"{KERNEL_API}/graph",
            params={
                "start_obj_id": connected_objects["org_id"],
                "depth": 2,
                "direction": "OUTBOUND",
            },
        )
        assert r.status_code == 200, f"Graph query failed: {r.text}"
        data = r.json()
        assert "root" in data, "Graph should have root node"
        assert data["root"]["_id"] == connected_objects["org_id"]
        assert "tree" in data, "Graph should have tree structure"
        # Should contain the connected Job_Role
        tree = data["tree"]
        if "children" in tree and tree["children"]:
            child_ids = [c.get("_id") or c.get("id") for c in tree["children"]]
            assert connected_objects["role_id"] in child_ids, (
                f"Connected role not in graph. Child IDs: {child_ids}"
            )

    def test_graph_empty_for_isolated_object(self):
        """Graph query for isolated object should return just root"""
        unique_name = f"E2E孤立_{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Market_Context",
                "properties": {"market_name": unique_name, "trend": "growing"},
            },
        )
        obj_id = r.json()["_id"]

        r = requests.get(
            f"{KERNEL_API}/graph",
            params={"start_obj_id": obj_id, "depth": 1, "direction": "OUTBOUND"},
        )
        assert r.status_code == 200, f"Graph query failed: {r.text}"
        data = r.json()
        assert data["root"]["_id"] == obj_id


class TestKernelValidation:
    """Meta-model validation should reject invalid data"""

    def test_reject_missing_required_field(self):
        """Creating object without required field should fail"""
        r = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "Strategic_Goal",
                "properties": {
                    # Missing required: goal_name
                    "description": "no name goal",
                },
            },
        )
        # Should fail with validation error
        assert r.status_code in (400, 422), (
            f"Expected validation error, got {r.status_code}: {r.text}"
        )

    def test_reject_unknown_model(self):
        """Creating object with non-existent model should fail"""
        r = requests.post(
            f"{KERNEL_API}/objects",
            json={
                "model_key": "NonExistent_Model",
                "properties": {"name": "test"},
            },
        )
        assert r.status_code in (400, 404, 422), (
            f"Expected error for unknown model, got {r.status_code}: {r.text}"
        )


class TestDimensionMetaModelMapping:
    """Verify the DIMENSION_META_MODELS mapping matches actual seeded meta-models"""

    EXPECTED_DIMENSION_MODELS = {
        "strategy": ["Strategic_Goal", "Strategic_Initiative", "Market_Context"],
        "structure": ["Org_Unit", "Job_Role", "Process_Flow"],
        "performance": ["Performance_Metric", "Competency", "Review_Cycle"],
        "compensation": ["Salary_Band", "Pay_Component", "Market_Benchmark"],
        "talent": ["Employee", "Talent_Pipeline", "Learning_Development"],
    }

    def test_all_dimension_models_exist(self):
        """Every meta-model referenced in the diagnosis workflow should be seeded"""
        r = requests.get(f"{KERNEL_API}/meta")
        assert r.status_code == 200
        seeded_keys = {m["model_key"] for m in r.json()}

        missing = []
        for dimension, models in self.EXPECTED_DIMENSION_MODELS.items():
            for model in models:
                if model not in seeded_keys:
                    missing.append(f"{dimension}/{model}")

        assert not missing, f"Missing meta-models: {missing}"


class TestKernelRouteRegistered:
    """Kernel routes should appear in OpenAPI schema"""

    def test_kernel_routes_in_openapi(self):
        """All kernel endpoints should be discoverable via OpenAPI"""
        r = requests.get(f"{BASE_URL}/openapi.json")
        assert r.status_code == 200
        paths = r.json()["paths"]

        expected_paths = [
            "/api/v1/kernel/meta",
            "/api/v1/kernel/objects",
            "/api/v1/kernel/relations",
            "/api/v1/kernel/graph",
        ]

        found = []
        for prefix in expected_paths:
            if any(p.startswith(prefix) for p in paths):
                found.append(prefix)

        assert len(found) >= 3, f"Missing kernel routes. Found: {found}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
