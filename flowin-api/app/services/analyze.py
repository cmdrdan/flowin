import logging
import json
import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


ANALYZE_SYSTEM = """You are a project analyst for Flowin, an AI website builder.
Given a user's site description, determine what features and infrastructure the site needs.

Return a JSON object with these fields:
{
  "needs_auth": boolean,        // Does the site need login/authentication?
  "needs_database": boolean,    // Does it need persistent data storage?
  "site_type": string,          // One of: "static", "auth_only", "dynamic"
  "suggested_title": string,    // A short, catchy title for the site
  "questions": [                // Follow-up questions to ask (max 3, empty if prompt is clear enough)
    {
      "id": string,             // e.g. "admin_username", "num_roles", "data_type"
      "question": string,       // The question text
      "type": "text" | "choice",
      "options": string[] | null,  // Only for "choice" type
      "default": string | null
    }
  ],
  "features_detected": string[], // e.g. ["login_page", "admin_panel", "contact_form", "dashboard"]
  "reasoning": string           // One sentence explaining your analysis
}

Guidelines:
- If the user mentions admin, login, sign-in, authentication, dashboard, user accounts, or members -> needs_auth = true
- If the user mentions storing data, submissions, orders, bookings, inventory, CRM, or any CRUD operations -> needs_database = true
- Only ask questions that genuinely affect how the site is built
- Common questions: admin username preference, number of user roles, what data to track
- If the prompt is very clear and specific, return an empty questions array
- Keep questions friendly and non-technical

Return ONLY valid JSON, no markdown fences or commentary."""


def analyze_prompt(prompt: str) -> dict:
    client = get_client()
    logger.info("Analyzing prompt for features")
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
        system=ANALYZE_SYSTEM,
    )
    text = message.content[0].text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    return json.loads(text)
