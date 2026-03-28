"""
报告模板与生成的 Pydantic 模型
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Any
from enum import Enum


class ReportFormatEnum(str, Enum):
    """报告格式"""

    PPTX = "pptx"
    XLSX = "xlsx"
    PDF = "pdf"
    HTML = "html"


class ChartTypeEnum(str, Enum):
    """图表类型"""

    BAR = "bar"
    LINE = "line"
    PIE = "pie"
    TABLE = "table"
    METRIC = "metric"
    TREEMAP = "treemap"
    SANKEY = "sankey"


class DataSourceConfig(BaseModel):
    """数据源配置"""

    model_key: str = Field(..., description="元模型标识")
    filters: dict[str, Any] | None = Field(default=None, description="过滤条件")
    aggregations: list[dict[str, Any]] | None = Field(
        default=None, description="聚合配置 (如 count, sum, avg)"
    )
    group_by: str | None = Field(default=None, description="分组字段")
    order_by: str | None = Field(default=None, description="排序字段")
    limit: int | None = Field(default=None, ge=1, le=1000, description="限制数量")


class ChartConfig(BaseModel):
    """图表配置"""

    chart_type: ChartTypeEnum = Field(..., description="图表类型")
    title: str = Field(..., min_length=1, max_length=256, description="图表标题")
    data_source: DataSourceConfig = Field(..., description="数据源配置")
    x_field: str | None = Field(default=None, description="X轴字段")
    y_field: str | None = Field(default=None, description="Y轴字段")
    series_field: str | None = Field(default=None, description="系列字段")
    color_scheme: str | None = Field(default="default", description="配色方案")


class SlideConfig(BaseModel):
    """幻灯片配置"""

    title: str = Field(..., min_length=1, max_length=256, description="幻灯片标题")
    layout: str = Field(default="default", description="布局类型")
    charts: list[ChartConfig] = Field(default_factory=list, description="图表列表")
    text_content: str | None = Field(default=None, description="文本内容")
    notes: str | None = Field(default=None, description="备注")


class ReportTemplateCreate(BaseModel):
    """创建报告模板"""

    template_key: str = Field(
        ...,
        min_length=1,
        max_length=64,
        pattern=r"^[a-zA-Z_][a-zA-Z0-9_]*$",
        description="模板唯一标识",
    )
    name: str = Field(..., min_length=1, max_length=128, description="模板名称")
    description: str | None = Field(default=None, max_length=512, description="模板描述")
    format: ReportFormatEnum = Field(..., description="输出格式")
    slides: list[SlideConfig] = Field(..., min_length=1, description="幻灯片配置")
    global_styles: dict[str, Any] | None = Field(
        default=None, description="全局样式配置"
    )


class ReportTemplateUpdate(BaseModel):
    """更新报告模板"""

    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=512)
    slides: list[SlideConfig] | None = Field(default=None, min_length=1)
    global_styles: dict[str, Any] | None = None


class ReportGenerateRequest(BaseModel):
    """生成报告请求"""

    template_key: str = Field(..., description="模板标识")
    obj_id: str = Field(..., description="业务对象 ID (部门/项目等)")
    output_format: ReportFormatEnum | None = Field(
        default=None, description="输出格式 (覆盖模板默认值)"
    )
    parameters: dict[str, Any] | None = Field(
        default=None, description="运行时参数 (用于数据过滤)"
    )
    filename: str | None = Field(
        default=None, max_length=256, description="自定义文件名"
    )


class ChartData(BaseModel):
    """图表数据"""

    chart_type: ChartTypeEnum
    title: str
    labels: list[str] = Field(default_factory=list)
    datasets: list[dict[str, Any]] = Field(default_factory=list)
    summary: dict[str, Any] | None = None


class SlideData(BaseModel):
    """幻灯片数据"""

    title: str
    charts: list[ChartData] = Field(default_factory=list)
    text_content: str | None = None
    generated_at: str


class ReportResponse(BaseModel):
    """报告响应"""

    template_key: str
    template_name: str
    output_format: ReportFormatEnum
    generated_at: str
    slides: list[SlideData]
    file_url: str | None = None
    file_size: int | None = None
