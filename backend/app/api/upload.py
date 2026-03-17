"""
文件上传 API
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Optional

from app.services.file_parser import file_parser, FileParseError
from app.models.schemas import UploadResponse

router = APIRouter()


@router.post("", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
):
    """
    上传并解析文件

    支持格式: txt, md, csv, json, pdf, docx, xlsx, xls, png, jpg, jpeg

    返回:
    - success: 是否成功
    - text: 提取的文本内容
    - metadata: 文件元数据
    - error: 错误信息（如果失败）
    """
    # 获取文件扩展名
    filename = file.filename or "unknown"
    ext = filename.split('.')[-1].lower() if '.' in filename else ""

    # 检查文件类型
    if ext not in file_parser.get_supported_types():
        return UploadResponse(
            success=False,
            error=f"不支持的文件格式: .{ext}\n支持的格式: {', '.join(file_parser.get_supported_types())}"
        )

    # 读取文件内容
    content = await file.read()

    # 检查文件大小
    if len(content) > file_parser.max_file_size:
        return UploadResponse(
            success=False,
            error=f"文件大小超过 {file_parser.max_file_size // (1024*1024)}MB 限制"
        )

    # 解析文件
    try:
        text, metadata = await file_parser.parse(content, ext, filename)

        return UploadResponse(
            success=True,
            text=text,
            metadata=metadata
        )

    except FileParseError as e:
        return UploadResponse(
            success=False,
            error=str(e)
        )

    except Exception as e:
        return UploadResponse(
            success=False,
            error=f"文件解析失败: {str(e)}"
        )
