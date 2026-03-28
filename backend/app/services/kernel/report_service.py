"""
报告生成服务 — 图谱数据 + 模板占位符替换

整合内核图遍历数据和 PPTX/XLSX 模板生成报告
"""
import os
from datetime import datetime
from typing import Any

from fastapi import HTTPException, status


# 模板存储目录
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "templates")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "output")


class ReportService:
    """报告生成服务"""

    def __init__(self, db: Any):
        self._db = db

    def _ensure_output_dir(self) -> str:
        """确保输出目录存在"""
        if not os.path.exists(OUTPUT_DIR):
            os.makedirs(OUTPUT_DIR, exist_ok=True)
        return OUTPUT_DIR

    def _get_template_path(self, template_key: str, file_type: str) -> str | None:
        """获取模板文件路径"""
        template_dir = os.path.join(TEMPLATES_DIR, template_key)
        if not os.path.exists(template_dir):
            return None

        for filename in os.listdir(template_dir):
            if file_type == "pptx" and filename.endswith(".pptx"):
                return os.path.join(template_dir, filename)
            elif file_type == "xlsx" and filename.endswith(".xlsx"):
                return os.path.join(template_dir, filename)

        return None

    def get_object_with_properties(self, obj_id: str) -> dict[str, Any] | None:
        """获取对象及其属性"""
        parts = obj_id.split("/")
        if len(parts) != 2:
            return None
        collection = self._db.collection("sys_objects")
        return collection.get(parts[1])

    def _get_name(self, vertex: dict) -> str:
        """从 vertex 中提取名称"""
        props = vertex.get("properties", {})
        return (
            props.get("role_name")
            or props.get("name")
            or props.get("unit_name")
            or props.get("competency_name")
            or vertex.get("_key", "")
        )

    def _get_graph_data_any_direction(
        self, root_obj_id: str, depth: int = 5
    ) -> dict[str, Any]:
        """获取双向图遍历数据"""
        from app.services.kernel.relation_service import RelationService
        from app.models.kernel.relation import DirectionEnum

        relation_service = RelationService(self._db)
        return relation_service.get_object_graph(
            start_obj_id=root_obj_id,
            direction=DirectionEnum.ANY,
            depth=depth,
        )

    def _build_report_data(
        self,
        obj: dict[str, Any],
        graph_data: dict[str, Any],
        depth: int = 5,
    ) -> dict[str, Any]:
        """从图谱数据构建报告占位符数据"""
        props = obj.get("properties", {})
        model_key = obj.get("model_key", "")
        relations = graph_data.get("relations", [])

        report_data: dict[str, Any] = {
            "DEPT_NAME": self._get_name(obj),
            "GENERATED_DATE": datetime.now().strftime("%Y-%m-%d"),
            "REPORT_ID": f"COS-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "PROJECT_PERIOD": "2025年度",
            "TOTAL_VERTICES": graph_data.get("total_vertices", 0),
            "TOTAL_EDGES": graph_data.get("total_edges", 0),
            "TRAVERSE_DEPTH": str(depth),
        }

        if model_key == "Org_Unit":
            report_data["DEPT_TYPE"] = props.get("unit_type", "-")
            report_data["HEADCOUNT"] = str(props.get("headcount", "-"))
            report_data["PARENT_DEPT"] = "总部"
            report_data["SUB_DEPT_COUNT"] = str(
                len([r for r in relations if r.get("edge", {}).get("relation_type") == "Contains"])
            )

        # 分析摘要
        role_count = len([r for r in relations if r.get("vertex", {}).get("model_key") == "Job_Role"])
        emp_count = len([r for r in relations if r.get("vertex", {}).get("model_key") == "Employee"])
        report_data["ANALYSIS_SUMMARY"] = (
            f"该组织单元下共发现 {role_count} 个岗位、{emp_count} 名员工。"
            f"组织架构层级清晰，汇报关系完整，"
            f"建议关注关键岗位的人员配置和梯队建设。"
        )

        # 人员清单表格数据 (最多7行)
        role_relations = [r for r in relations if r.get("vertex", {}).get("model_key") == "Job_Role"]
        for i in range(7):
            idx = i + 1
            if i < len(role_relations):
                vertex = role_relations[i].get("vertex", {})
                v_props = vertex.get("properties", {})
                emp_name = "-"
                for r2 in relations:
                    if r2.get("vertex", {}).get("model_key") == "Employee":
                        edge = r2.get("edge", {})
                        if edge.get("relation_type") == "Fills" and edge.get("_from", "").endswith(vertex.get("_key", "")):
                            emp_name = self._get_name(r2["vertex"])
                            break
                        if edge.get("relation_type") == "Fills" and edge.get("_to", "").endswith(vertex.get("_key", "")):
                            emp_name = self._get_name(r2["vertex"])
                            break

                report_data[f"ROW{idx}_INDEX"] = str(idx)
                report_data[f"ROW{idx}_ROLE"] = v_props.get("role_name", "-")
                report_data[f"ROW{idx}_FAMILY"] = v_props.get("job_family", "-")
                report_data[f"ROW{idx}_LEVEL"] = v_props.get("level_range", "-")
                report_data[f"ROW{idx}_EMPLOYEE"] = emp_name
            else:
                report_data[f"ROW{idx}_INDEX"] = str(idx)
                report_data[f"ROW{idx}_ROLE"] = ""
                report_data[f"ROW{idx}_FAMILY"] = ""
                report_data[f"ROW{idx}_LEVEL"] = ""
                report_data[f"ROW{idx}_EMPLOYEE"] = ""

        # 关系网络表格数据 (最多6行)
        display_relations = [r for r in relations if r.get("edge") is not None][:6]
        for i in range(6):
            idx = i + 1
            if i < len(display_relations):
                rel = display_relations[i]
                edge = rel.get("edge", {})
                from_vertex = rel.get("vertex", {})
                report_data[f"REL{idx}_FROM"] = self._get_name(from_vertex)
                report_data[f"REL{idx}_TYPE"] = edge.get("relation_type", "-")
                to_id = edge.get("_to", "")
                to_name = to_id.split("/")[-1] if "/" in to_id else to_id
                for r2 in relations:
                    if r2.get("vertex", {}).get("_id", "") == to_id:
                        to_name = self._get_name(r2["vertex"])
                        break
                report_data[f"REL{idx}_TO"] = to_name
                report_data[f"REL{idx}_DESC"] = f"通过 {edge.get('relation_type', '')} 关系连接"
            else:
                report_data[f"REL{idx}_FROM"] = ""
                report_data[f"REL{idx}_TYPE"] = ""
                report_data[f"REL{idx}_TO"] = ""
                report_data[f"REL{idx}_DESC"] = ""

        return report_data

    def generate_report(
        self,
        template_key: str,
        obj_id: str,
        output_format: str | None = None,
        parameters: dict[str, Any] | None = None,
        depth: int = 5,
    ) -> dict[str, Any]:
        """生成报告"""
        obj = self.get_object_with_properties(obj_id)
        if not obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"对象 '{obj_id}' 不存在",
            )

        graph_data = self._get_graph_data_any_direction(obj_id, depth=depth)
        report_data = self._build_report_data(obj, graph_data, depth)

        if parameters:
            report_data.update(parameters)

        file_type = output_format or "pptx"
        if hasattr(file_type, "value"):
            file_type = file_type.value

        template_path = self._get_template_path(template_key, file_type)
        if not template_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"模板 '{template_key}' 不存在",
            )

        output_dir = self._ensure_output_dir()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"{template_key}_{timestamp}.{file_type}"
        output_path = os.path.join(output_dir, output_filename)

        if file_type == "pptx":
            from app.services.kernel.ppt_generator import generate_org_ppt
            result = generate_org_ppt(template_path, report_data, output_path)
        elif file_type == "xlsx":
            from app.services.kernel.excel_generator import generate_compensation_excel
            excel_data = []
            for item in graph_data.get("relations", []):
                vertex = item.get("vertex", {})
                props = vertex.get("properties", {})
                excel_data.append({
                    "position_name": props.get("name", ""),
                    "salary_level": props.get("level", ""),
                    "base_salary": props.get("salary", 0),
                })
            result = generate_compensation_excel(template_path, excel_data, output_path)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的输出格式: {file_type}",
            )

        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"报告生成失败: {result.get('error')}",
            )

        result["file_url"] = f"/api/v1/kernel/reports/download/{output_filename}"
        result["output_filename"] = output_filename
        return result
