"""
组织领域模块包

导出 OrganizationModule 供编排器动态发现。
使用方式:

    from lib.domain.organization import OrganizationModule

    module = OrganizationModule()
    nodes = module.get_analysis_nodes()
    models = module.get_meta_model_keys()
    module.register_nodes()
"""

from .module import OrganizationModule

__all__ = ["OrganizationModule"]
