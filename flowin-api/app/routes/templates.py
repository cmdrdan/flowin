import os
import json
import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/templates")

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

_cache: list[dict] | None = None


def _load_templates() -> list[dict]:
    global _cache
    if _cache is not None:
        return _cache

    templates = []
    if not os.path.isdir(TEMPLATES_DIR):
        return templates

    for filename in sorted(os.listdir(TEMPLATES_DIR)):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(TEMPLATES_DIR, filename)
        with open(filepath) as f:
            data = json.load(f)
        templates.append(data)

    _cache = templates
    return templates


@router.get("")
async def list_templates():
    templates = _load_templates()
    return {
        "templates": [
            {"id": t["id"], "name": t["name"], "description": t["description"], "category": t["category"]}
            for t in templates
        ]
    }


@router.get("/{template_id}")
async def get_template(template_id: str):
    templates = _load_templates()
    for t in templates:
        if t["id"] == template_id:
            return t
    return {"error": "Template not found"}, 404
