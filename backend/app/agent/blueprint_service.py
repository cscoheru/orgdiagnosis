"""
BlueprintService — 逻辑骨架解析器

Milestone 1 的核心服务。负责:
- 创建/管理 Logic_Node 和 Benchmark 实例
- 组装逻辑依赖树
- 对比 blueprint 要求 vs 已收集数据，找出缺失字段

所有数据通过 ObjectService/RelationService 存入 sys_objects/sys_relations，
不直接操作数据库集合。
"""
from typing import Any
from loguru import logger

from app.services.kernel.object_service import ObjectService
from app.services.kernel.relation_service import RelationService
from app.models.kernel.meta_model import ObjectCreate
from app.models.kernel.relation import RelationCreate


# 关系类型常量
REL_BENCHMARK_CONTAINS_NODE = "benchmark_contains_node"
REL_LOGIC_NODE_DEPENDS_ON = "logic_node_depends_on"


class BlueprintService:
    """逻辑骨架服务"""

    def __init__(self, db: Any):
        self.obj_svc = ObjectService(db)
        self.rel_svc = RelationService(db)

    # ─── Logic Node CRUD ───

    def create_logic_node(self, data: dict) -> dict:
        """创建逻辑节点 (model_key=Logic_Node)"""
        node = self.obj_svc.create_object(ObjectCreate(
            model_key="Logic_Node",
            properties={
                "node_type": data["node_type"],
                "display_name": data["display_name"],
                **({"description": data["description"]} if data.get("description") else {}),
                "required_data_schema": data["required_data_schema"],
                **({"layout_template_id": data["layout_template_id"]} if data.get("layout_template_id") else {}),
                "dependencies": data.get("dependencies", []),
                "industry_tags": data.get("industry_tags", []),
                **({"output_schema": data["output_schema"]} if data.get("output_schema") else {}),
                "display_order": data.get("display_order", 0),
            },
        ))
        logger.info(f"Created Logic_Node: {data['node_type']} (_key={node['_key']})")
        return node

    def list_logic_nodes(self, limit: int = 200) -> list[dict]:
        """列出所有逻辑节点"""
        return self.obj_svc.list_objects(model_key="Logic_Node", limit=limit)

    def get_logic_node(self, key: str) -> dict | None:
        """获取单个逻辑节点"""
        return self.obj_svc.get_object(key)

    def get_logic_node_by_type(self, node_type: str) -> dict | None:
        """根据 node_type 查找逻辑节点"""
        nodes = self.list_logic_nodes(limit=500)
        for n in nodes:
            if n.get("properties", {}).get("node_type") == node_type:
                return n
        return None

    # ─── Benchmark CRUD ───

    def create_benchmark(self, data: dict, logic_node_ids: list[str] | None = None) -> dict:
        """创建标杆报告模板 (model_key=Benchmark)"""
        benchmark = self.obj_svc.create_object(ObjectCreate(
            model_key="Benchmark",
            properties={
                "title": data["title"],
                "industry": data["industry"],
                "consulting_type": data["consulting_type"],
                **({"description": data["description"]} if data.get("description") else {}),
                "node_order": logic_node_ids or [],
            },
        ))

        # 建立 benchmark → logic_node 关系
        if logic_node_ids:
            for node_id in logic_node_ids:
                try:
                    self.rel_svc.create_relation(RelationCreate(
                        from_obj_id=benchmark["_id"],
                        to_obj_id=f"sys_objects/{node_id}",
                        relation_type=REL_BENCHMARK_CONTAINS_NODE,
                    ))
                except Exception as e:
                    logger.warning(f"Failed to link node {node_id}: {e}")

        logger.info(f"Created Benchmark: {data['title']} (_key={benchmark['_key']})")
        return benchmark

    def list_benchmarks(self, limit: int = 100) -> list[dict]:
        """列出所有标杆报告模板"""
        return self.obj_svc.list_objects(model_key="Benchmark", limit=limit)

    def get_benchmark(self, key: str) -> dict | None:
        """获取单个标杆报告"""
        return self.obj_svc.get_object(key)

    # ─── Dependency Tree ───

    def get_dependency_tree(self, benchmark_key: str) -> dict:
        """
        获取标杆报告的完整逻辑依赖树。

        1. 获取 benchmark 的所有 logic_node (通过 benchmark_contains_node 关系)
        2. 获取 logic_node 之间的依赖 (通过 dependencies 字段 + logic_node_depends_on 关系)
        3. 拓扑排序生成 execution_order
        """
        benchmark = self.get_benchmark(benchmark_key)
        if not benchmark:
            raise ValueError(f"Benchmark not found: {benchmark_key}")

        # 获取所有关联的 logic nodes
        node_order = benchmark.get("properties", {}).get("node_order", [])

        # 如果 node_order 为空，通过关系查找
        if not node_order:
            all_rels = self.rel_svc.list_relations(limit=500)
            for r in all_rels:
                if (r.get("relation_type") == REL_BENCHMARK_CONTAINS_NODE
                        and r["_from"] == benchmark["_id"]):
                    node_key = r["_to"].split("/", 1)[1] if "/" in r["_to"] else r["_to"]
                    node_order.append(node_key)

        # 获取每个 node 的详情
        nodes_data = {}
        for node_key in node_order:
            node = self.get_logic_node(node_key)
            if node:
                nodes_data[node_key] = node

        # 也检查通过关系引用的依赖
        all_rels = self.rel_svc.list_relations(limit=1000)
        dep_edges: dict[str, list[str]] = {}  # node_key -> [dependency_node_keys]
        for r in all_rels:
            if r.get("relation_type") == REL_LOGIC_NODE_DEPENDS_ON:
                from_key = r["_from"].split("/", 1)[1] if "/" in r["_from"] else r["_from"]
                to_key = r["_to"].split("/", 1)[1] if "/" in r["_to"] else r["_to"]
                dep_edges.setdefault(from_key, []).append(to_key)

        # 构建节点列表
        tree_nodes = []
        for node_key in node_order:
            if node_key not in nodes_data:
                continue
            props = nodes_data[node_key]
            deps = props.get("properties", {}).get("dependencies", [])
            # 合并关系依赖
            if node_key in dep_edges:
                deps = list(set(deps + dep_edges[node_key]))

            schema = props.get("properties", {}).get("required_data_schema", {})
            required_fields = list(schema.keys()) if isinstance(schema, dict) else []

            tree_nodes.append({
                "id": node_key,
                "node_type": props.get("properties", {}).get("node_type", ""),
                "display_name": props.get("properties", {}).get("display_name", ""),
                "dependencies": deps,
                "required_fields": required_fields,
                "status": "pending",
            })

        # 拓扑排序
        execution_order = self._topological_sort(tree_nodes)

        return {
            "benchmark_id": benchmark_key,
            "title": benchmark.get("properties", {}).get("title", ""),
            "consulting_type": benchmark.get("properties", {}).get("consulting_type", ""),
            "nodes": tree_nodes,
            "execution_order": execution_order,
        }

    def get_dependency_tree_with_status(
        self, benchmark_key: str, collected_data: dict[str, Any]
    ) -> dict:
        """获取依赖树，并根据已收集数据标注每个节点的状态"""
        tree = self.get_dependency_tree(benchmark_key)

        for node in tree["nodes"]:
            node_type = node["node_type"]
            required = node["required_fields"]

            if not required:
                node["status"] = "complete"
            elif node_type in collected_data:
                # 检查该节点所需的必填字段是否都已收集
                node_data = collected_data[node_type]
                logic_node = self.get_logic_node_by_type(node_type)
                schema = {}
                if logic_node:
                    schema = logic_node.get("properties", {}).get("required_data_schema", {})
                if isinstance(node_data, dict):
                    required_keys = [
                        f for f, defn in schema.items()
                        if defn.get("required", False)
                    ]
                    missing = [f for f in required_keys if f not in node_data or not node_data[f]]
                    node["status"] = "complete" if not missing else "missing"
                else:
                    node["status"] = "complete"
            else:
                node["status"] = "missing"

        return tree

    def get_missing_fields(
        self, benchmark_key: str, collected_data: dict[str, Any]
    ) -> list[dict]:
        """
        对比 blueprint 要求 vs 已收集数据，返回缺失字段列表。
        仅返回当前可执行的节点的缺失字段（前置依赖已满足的节点）。
        """
        tree = self.get_dependency_tree_with_status(benchmark_key, collected_data)
        missing = []

        for node in tree["nodes"]:
            if node["status"] != "missing":
                continue

            # 检查前置依赖是否都已满足
            deps_complete = True
            for dep_type in node["dependencies"]:
                dep_node = next(
                    (n for n in tree["nodes"] if n["node_type"] == dep_type), None
                )
                if dep_node and dep_node["status"] != "complete":
                    deps_complete = False
                    break

            if not deps_complete:
                continue  # 前置依赖未满足，暂不收集

            node_type = node["node_type"]
            node_data = collected_data.get(node_type, {})
            if not isinstance(node_data, dict):
                node_data = {}

            # 获取该节点的 required_data_schema 来生成 UI 组件
            logic_node = self.get_logic_node_by_type(node_type)
            schema = {}
            if logic_node:
                schema = logic_node.get("properties", {}).get("required_data_schema", {})

            for field_key in node["required_fields"]:
                field_def = schema.get(field_key, {})
                is_required = field_def.get("required", False)
                # Only report missing if the field is required OR if it's already collected (partial data)
                if not is_required and field_key not in node_data:
                    continue  # Skip optional fields that haven't been touched
                if node_data.get(field_key):
                    continue  # Field already has a value
                missing.append({
                    "node_id": node["id"],
                    "node_type": node_type,
                    "node_display_name": node["display_name"],
                    "field_key": field_key,
                    "field_label": field_def.get("label", field_key),
                    "field_type": field_def.get("type", "input"),
                    "field_options": field_def.get("options"),
                    "required": is_required,
                })

        return missing

    # ─── Helper ───

    @staticmethod
    def _topological_sort(nodes: list[dict]) -> list[str]:
        """拓扑排序：按依赖关系确定执行顺序"""
        # node_id -> set of dependency node_ids
        in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}
        adj: dict[str, list[str]] = {n["id"]: [] for n in nodes}

        id_to_node = {n["id"]: n for n in nodes}
        type_to_id = {n["node_type"]: n["id"] for n in nodes}

        for node in nodes:
            for dep_type in node.get("dependencies", []):
                dep_id = type_to_id.get(dep_type)
                if dep_id and dep_id in in_degree:
                    adj[dep_id].append(node["id"])
                    in_degree[node["id"]] += 1

        # Kahn's algorithm
        queue = [nid for nid, deg in in_degree.items() if deg == 0]
        result = []

        while queue:
            # 按原始顺序优先（保持稳定性）
            current = queue.pop(0)
            result.append(current)
            for neighbor in adj[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        # 如果有环，追加未排序的节点
        if len(result) < len(nodes):
            for node in nodes:
                if node["id"] not in result:
                    result.append(node["id"])

        return result
