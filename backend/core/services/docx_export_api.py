from __future__ import annotations

from io import BytesIO
import re
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core.sandbox.docker.html_to_docx_router import HTMLToDocxConverter
from core.utils.logger import logger


router = APIRouter(tags=["documents"])


class DocxExportRequest(BaseModel):
    content: str = Field(..., description="HTML content to convert into DOCX")
    fileName: str = Field(..., description="Desired filename (without extension)")


def _polish_content(raw: Optional[str]) -> str:
    """Light HTML cleanup to avoid malformed markup in the converter."""
    if not raw:
        return ""

    return (
        raw.replace("<hr>", "<hr />")
        .replace("<hr/>", "<hr />")
        .replace("<br>", "<br />")
        .replace("<br/>", "<br />")
    )


def _safe_filename(name: str) -> str:
    normalized = name.strip() or "document"
    normalized = re.sub(r"[^\w\s-]", "", normalized)
    normalized = re.sub(r"[-\s]+", "-", normalized)
    normalized = normalized[:80] or "document"
    return f"{normalized}.docx" if not normalized.endswith(".docx") else normalized


@router.post("/export/docx")
async def export_docx(payload: DocxExportRequest):
    """
    Convert rich HTML content into a professionally formatted DOCX.
    Mirrors the previous Next.js API behavior so the frontend can continue
    calling `/api/export/docx` even in static deployments.
    """
    try:
        polished_html = _polish_content(payload.content)

        converter = HTMLToDocxConverter(doc_path=f"/tmp/{uuid4().hex}.json")
        converter.doc_data = {
            "title": payload.fileName.strip() or "Document",
            "content": polished_html,
            "metadata": {},
        }

        document = converter.create_docx()
        buffer = BytesIO()
        document.save(buffer)
        buffer.seek(0)

        filename = _safe_filename(payload.fileName)

        return Response(
            content=buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Daytona-Skip-Preview-Warning": "true",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to export DOCX: {exc}")
        raise HTTPException(status_code=500, detail="Failed to generate DOCX file")
