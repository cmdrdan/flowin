import logging
from collections.abc import Generator
import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


SYSTEM_PROMPT = """You are an expert web developer working for Flowin, an AI website builder.
Generate a complete, standalone HTML5 page. Requirements:

**Structure & Semantics:**
- Valid HTML5 with proper doctype, lang attribute, charset, and viewport meta
- Semantic elements: <header>, <nav>, <main>, <section>, <article>, <footer>
- Open Graph meta tags (og:title, og:description, og:type)
- Proper heading hierarchy (h1 > h2 > h3)

**Design & CSS:**
- Responsive design using CSS Grid and Flexbox
- Mobile-first approach with media queries for tablet (768px+) and desktop (1024px+)
- Modern CSS: clamp() for fluid typography, custom properties for theming
- Smooth transitions and subtle hover states
- Inline all CSS in a <style> tag. You may link to Google Fonts if appropriate.
- Professional color palette with proper contrast ratios (WCAG AA)

**Content:**
- Use realistic, relevant content that matches the site's purpose — NEVER use lorem ipsum
- Write compelling headlines, realistic descriptions, and plausible data
- Include a clear call-to-action where appropriate

**Accessibility:**
- Alt text for all images, aria-labels for interactive elements
- Focus-visible styles, sufficient color contrast
- Keyboard navigable

**Code Quality:**
- Clean, well-indented code
- No external JS dependencies (vanilla JS only)
- No inline event handlers (use addEventListener if JS needed)

**Admin & Management Features (IMPORTANT — follow this pattern exactly):**
- If the site has admin/management features, create an admin dashboard panel visible after login
- The admin dashboard MUST use this exact HTML pattern for each management area:

  <div id="admin-dashboard">
    <h2>Admin Dashboard</h2>
    <div class="admin-grid">
      <button class="admin-btn" data-admin-section="SECTION_ID" data-admin-label="DISPLAY LABEL">
        <span class="admin-icon">EMOJI</span>
        <span class="admin-title">DISPLAY LABEL</span>
        <span class="admin-desc">Brief description</span>
      </button>
      <!-- more buttons... -->
    </div>
    <div id="admin-section-container" style="display:none;"></div>
  </div>

- Use clear section IDs like: menu-manager, reservations, orders, staff, settings, inventory, gallery, testimonials, services, pricing, appointments, blog-posts
- Include 3-6 admin buttons appropriate for the site type
- Wire up button clicks to set a data-active-section attribute on #admin-section-container and show it
- Do NOT build the actual management interfaces — just the dashboard grid and the empty container
- Add this minimal JS for the admin buttons:
  document.querySelectorAll('[data-admin-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const container = document.getElementById('admin-section-container');
      const section = btn.dataset.adminSection;
      container.style.display = 'block';
      container.dataset.activeSection = section;
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#6b7280;"><p>Loading ' + btn.dataset.adminLabel + '...</p></div>';
      window.location.hash = 'admin/' + section;
    });
  });

**Critical Size Constraint:**
- Keep the TOTAL output under 7000 tokens. Be concise.
- For data (menus, products, etc.): include 5-8 sample items MAX, not dozens
- Prefer CSS classes over repeated inline styles
- Keep JavaScript tight — no excessive comments or verbose variable names
- If auth/admin features are requested, prioritize working login logic over extensive sample data

Return ONLY the complete HTML document. No markdown fences, no explanations, no commentary."""


def _strip_fences(text: str) -> str:
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    return text.strip()


def generate_html(prompt: str) -> str:
    client = get_client()
    logger.info("Generating HTML with Claude")
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=16384,
        messages=[{"role": "user", "content": prompt}],
        system=SYSTEM_PROMPT,
    )
    return _strip_fences(message.content[0].text)


def generate_html_stream(prompt: str) -> Generator[str, None, None]:
    client = get_client()
    logger.info("Streaming HTML generation with Claude")
    with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=16384,
        messages=[{"role": "user", "content": prompt}],
        system=SYSTEM_PROMPT,
    ) as stream:
        buffer = []
        started = False
        for text in stream.text_stream:
            if not started:
                buffer.append(text)
                joined = "".join(buffer)
                # Skip leading markdown fence if present
                if joined.startswith("```"):
                    newline_idx = joined.find("\n")
                    if newline_idx != -1:
                        started = True
                        remainder = joined[newline_idx + 1 :]
                        if remainder:
                            yield remainder
                elif "<!DOCTYPE" in joined or "<html" in joined:
                    started = True
                    yield joined
                elif len(joined) > 20:
                    started = True
                    yield joined
            else:
                yield text


REFINE_SYSTEM_PROMPT = """You are an expert web developer working for Flowin, an AI website builder.
You will receive an existing HTML page and a user instruction to modify it.
Apply the requested changes while preserving the overall structure and style.
Return ONLY the complete modified HTML document. No markdown fences, no explanations."""


def refine_html(current_html: str, instruction: str) -> str:
    client = get_client()
    logger.info("Refining HTML with Claude")
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=16384,
        messages=[
            {
                "role": "user",
                "content": f"Here is the current HTML:\n\n{current_html}\n\nPlease make this change: {instruction}",
            }
        ],
        system=REFINE_SYSTEM_PROMPT,
    )
    return _strip_fences(message.content[0].text)


ENHANCE_ANALYZE_SYSTEM = """You are a web app analyst. Given an HTML page, identify all admin/management sections that need to be built out with full CRUD interfaces.

Search the HTML for:
1. Elements with data-admin-section attributes (primary signal)
2. Buttons/links labeled "Manage ___" or similar management actions
3. An #admin-section-container or similar empty container div
4. Admin dashboard areas with cards/buttons that link to management features
5. Static data sections (menus, services, pricing) that should be editable from admin

For EACH admin section found, determine the data model: what fields does each item need?
Think about what a real business owner would need to manage.

Examples:
- Restaurant menu-manager: items with name, description, price, category, image_url, available (boolean)
- Reservations: guest_name, date, time, party_size, phone, email, status (pending/confirmed/cancelled), notes
- Staff: name, role, email, phone, schedule, active (boolean)
- Gallery: image_url, caption, category, display_order

Return a JSON object:
{
  "site_context": string,         // e.g. "Italian restaurant with online ordering"
  "admin_sections": [
    {
      "id": string,               // Match the data-admin-section value exactly (e.g., "menu-manager")
      "label": string,            // Display label (e.g., "Menu Manager")
      "description": string,      // What this section manages
      "data_fields": [
        {"name": string, "type": "text"|"number"|"textarea"|"select"|"date"|"time"|"boolean"|"email"|"tel"|"url", "label": string, "required": boolean, "options": string[]|null}
      ],
      "sample_items": 4,          // How many sample items to seed (3-5)
      "public_section_selector": string|null  // CSS selector of the public-facing section this data populates (e.g., "#menu", ".services-grid"), or null if admin-only
    }
  ],
  "has_auth": boolean,
  "auth_mechanism": string|null,  // "localStorage", "hardcoded", or null
  "existing_features": string[]
}

Return ONLY valid JSON, no markdown fences or commentary."""


ENHANCE_BUILD_SYSTEM = """You are an expert web developer working for Flowin, an AI website builder.
You will receive an existing HTML page and a specification for ONE admin management section to build.

Your job is to ENHANCE the existing page by adding a fully functional admin sub-page for the specified section.

**How the admin routing works:**
- The page already has an #admin-dashboard with buttons that set window.location.hash to #admin/{section-id}
- There is an #admin-section-container div that should display the active management view
- You MUST add a hashchange listener (if not already present) that shows the correct section view
- Add a "Back to Dashboard" button in the section view

**Data Management (CRUD) — this is the core of what you're building:**
- Use localStorage with key "flowin-{section-id}" to persist data as a JSON array
- Build a complete management interface:
  1. LIST VIEW: Table/card grid showing all items with edit/delete buttons
  2. ADD FORM: Button to open an add form, validate required fields, save to localStorage
  3. EDIT: Click an item to edit inline or in a modal, save changes
  4. DELETE: Delete with confirmation dialog
- Seed realistic sample data on first load (check if key exists, if not seed it)
- After any data change, re-render both the admin list AND the public-facing section if applicable

**Public-facing data sync:**
- If a public_section_selector is provided, write a render function that reads from localStorage and populates that section
- Call this render function on page load AND after any CRUD operation
- This makes the public site reflect admin edits in real-time

**UI/UX:**
- Match the existing site's color scheme, fonts, and design language
- Use CSS that's consistent with the existing styles (same border-radius, shadows, spacing)
- Mobile-responsive tables (use cards on small screens)
- Smooth transitions when switching views

**Technical constraints:**
- Vanilla JS only, addEventListener only (no inline handlers)
- Use event delegation on the section container
- Keep code compact — no verbose comments, short variable names are fine
- PRESERVE ALL existing HTML/CSS/JS exactly — only ADD new code
- Insert new CSS inside the existing <style> tag (or add a new one at end of <head>)
- Insert new JS before the closing </body> tag
- Gate admin views behind auth if the site has login

Return ONLY the complete HTML document with the new section added. No markdown fences, no explanations."""


ENHANCE_ROUTER_SYSTEM = """You are an expert web developer. You will receive an HTML page that has multiple admin sections built out.
Your job is to add/fix the hash-based router so all sections work together seamlessly.

Requirements:
- Listen for hashchange events and popstate
- When hash is #admin/{section-id}, show that section's view in #admin-section-container
- When hash is empty or #admin, show the admin dashboard grid
- Each section's render function should already exist — just call them based on hash
- Add initial route handling on DOMContentLoaded
- Ensure the "Back to Dashboard" buttons all work (set hash to #admin)

Keep the code minimal. Return ONLY the complete HTML document. No markdown fences."""


def analyze_html_for_enhancement(html: str) -> dict:
    """Analyze generated HTML to find placeholder admin sections that need building out."""
    import json

    client = get_client()
    logger.info("Analyzing HTML for enhancement opportunities")
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        messages=[{"role": "user", "content": html}],
        system=ENHANCE_ANALYZE_SYSTEM,
    )
    text = message.content[0].text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    return json.loads(text)


def _build_section_spec(section: dict, analysis: dict) -> str:
    """Build a specification string for a single admin section."""
    lines = [
        f"Site context: {analysis.get('site_context', 'unknown')}",
        f"Has authentication: {analysis.get('has_auth', False)}",
        f"Auth mechanism: {analysis.get('auth_mechanism', 'localStorage')}",
        "",
        f"Build this admin section:",
        f"Section ID: {section['id']}",
        f"Label: {section['label']}",
        f"Purpose: {section['description']}",
        f"Public section selector: {section.get('public_section_selector', 'none')}",
        f"Sample items to seed: {section.get('sample_items', 4)}",
        "",
        "Data fields for each item:",
    ]
    for field in section.get("data_fields", []):
        req = " (REQUIRED)" if field.get("required") else ""
        opts = f" [options: {', '.join(field['options'])}]" if field.get("options") else ""
        lines.append(f"  - {field['name']} ({field['type']}): {field['label']}{req}{opts}")
    return "\n".join(lines)


def enhance_html_section(html: str, section: dict, analysis: dict) -> str:
    """Enhance HTML by building out ONE admin section with full CRUD."""
    client = get_client()

    spec = _build_section_spec(section, analysis)
    logger.info("Enhancing section: %s", section['id'])

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=16384,
        messages=[
            {
                "role": "user",
                "content": f"Here is the current HTML page:\n\n{html}\n\n---\n\n{spec}",
            }
        ],
        system=ENHANCE_BUILD_SYSTEM,
    )
    result = _strip_fences(message.content[0].text)

    # Validate we got back a full HTML document
    if "<html" not in result[:500]:
        logger.warning("Enhancement for %s didn't return full HTML, keeping previous", section['id'])
        return html
    return result


def enhance_html(html: str, analysis: dict) -> str:
    """Take generated HTML and analysis, build out admin sub-pages one section at a time."""
    sections = analysis.get("admin_sections", [])
    if not sections:
        logger.info("No admin sections to enhance")
        return html

    current_html = html
    completed = []

    for section in sections:
        try:
            current_html = enhance_html_section(current_html, section, analysis)
            completed.append(section['id'])
            logger.info("Completed section %s (%d/%d)", section['id'], len(completed), len(sections))
        except Exception as e:
            logger.error("Failed to enhance section %s: %s", section['id'], e)
            # Continue with remaining sections — partial enhancement is better than none

    # Add router if we built multiple sections
    if len(completed) > 1:
        try:
            current_html = _add_section_router(current_html, completed)
        except Exception as e:
            logger.error("Failed to add router: %s", e)

    return current_html


def _add_section_router(html: str, section_ids: list[str]) -> str:
    """Add hash-based routing to tie all enhanced sections together."""
    client = get_client()
    logger.info("Adding router for sections: %s", section_ids)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=16384,
        messages=[
            {
                "role": "user",
                "content": f"Here is the HTML page with these admin sections already built: {', '.join(section_ids)}.\n\nAdd/fix the hash router so navigating between sections works.\n\n{html}",
            }
        ],
        system=ENHANCE_ROUTER_SYSTEM,
    )
    result = _strip_fences(message.content[0].text)
    if "<html" not in result[:500]:
        return html
    return result
