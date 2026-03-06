import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.middleware.rate_limit import rate_limit_generate
from app.middleware.auth import get_current_user
from app.services.ai import (
    generate_html, generate_html_stream, refine_html,
    analyze_html_for_enhancement, enhance_html, enhance_html_section,
)
from app.services.analyze import analyze_prompt

logger = logging.getLogger(__name__)
router = APIRouter()


class AnalyzeInput(BaseModel):
    prompt: str


class PromptInput(BaseModel):
    prompt: str
    stream: bool = False


class RefineInput(BaseModel):
    html: str
    instruction: str


class EnhanceInput(BaseModel):
    html: str


@router.post("/generate/analyze")
async def analyze(input: AnalyzeInput, user: dict = Depends(get_current_user)):
    if not input.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    try:
        result = analyze_prompt(input.prompt)
    except Exception as e:
        logger.error("Prompt analysis failed: %s", e)
        raise HTTPException(status_code=500, detail="Analysis failed")

    logger.info("Analyzed prompt for user %s", user["id"])
    return result


@router.post("/generate")
async def generate(input: PromptInput, user: dict = Depends(rate_limit_generate)):
    if not input.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    try:
        if input.stream:
            return StreamingResponse(
                generate_html_stream(input.prompt),
                media_type="text/plain",
            )
        html = generate_html(input.prompt)
    except Exception as e:
        logger.error("AI generation failed: %s", e)
        raise HTTPException(status_code=500, detail="AI generation failed")

    truncated = not html.rstrip().endswith("</html>")
    if truncated:
        logger.warning("Generated HTML appears truncated for user %s", user["id"])

    logger.info("Generated HTML for user %s", user["id"])
    return {"html": html, "truncated": truncated}


@router.post("/generate/refine")
async def refine(input: RefineInput, user: dict = Depends(rate_limit_generate)):
    if not input.html.strip() or not input.instruction.strip():
        raise HTTPException(status_code=400, detail="Both html and instruction are required")

    try:
        html = refine_html(input.html, input.instruction)
    except Exception as e:
        logger.error("AI refinement failed: %s", e)
        raise HTTPException(status_code=500, detail="AI refinement failed")

    logger.info("Refined HTML for user %s", user["id"])
    return {"html": html}


@router.post("/generate/enhance")
async def enhance(input: EnhanceInput, user: dict = Depends(rate_limit_generate)):
    """Enhance HTML with admin sections. Streams SSE progress events, final event has the HTML."""
    if not input.html.strip():
        raise HTTPException(status_code=400, detail="HTML content is required")

    try:
        analysis = analyze_html_for_enhancement(input.html)
    except Exception as e:
        logger.error("Enhancement analysis failed: %s", e)
        raise HTTPException(status_code=500, detail="Enhancement analysis failed")

    admin_sections = analysis.get("admin_sections", [])
    if not admin_sections:
        logger.info("No admin sections to enhance for user %s", user["id"])
        return {"html": input.html, "enhanced": False, "sections_added": []}

    def sse_stream():
        current_html = input.html
        completed = []
        total = len(admin_sections)

        for i, section in enumerate(admin_sections):
            # Send progress event
            progress = {
                "type": "progress",
                "section": section["label"],
                "current": i + 1,
                "total": total,
            }
            yield f"data: {json.dumps(progress)}\n\n"

            try:
                current_html = enhance_html_section(current_html, section, analysis)
                completed.append(section["label"])
            except Exception as e:
                logger.error("Failed to enhance section %s: %s", section["id"], e)
                error_evt = {"type": "section_error", "section": section["label"], "error": str(e)}
                yield f"data: {json.dumps(error_evt)}\n\n"

        truncated = not current_html.rstrip().endswith("</html>")
        done = {
            "type": "done",
            "html": current_html,
            "enhanced": len(completed) > 0,
            "truncated": truncated,
            "sections_added": completed,
        }
        yield f"data: {json.dumps(done)}\n\n"

    logger.info("Enhancing %d sections for user %s", len(admin_sections), user["id"])
    return StreamingResponse(sse_stream(), media_type="text/event-stream")
