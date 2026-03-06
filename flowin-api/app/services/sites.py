import os
import logging

from app.config import settings
from app.db import get_conn
from app.utils.slugs import generate_slug

logger = logging.getLogger(__name__)


ANALYTICS_SNIPPET = """<script>
(function(){
  var s = document.currentScript || document.querySelector('script[data-flowin]');
  var slug = s && s.dataset.slug;
  if (!slug) return;
  fetch('https://api.flowin.one/analytics/pageview', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({slug: slug, path: location.pathname, referrer: document.referrer})
  }).catch(function(){});
})();
</script>"""


def _inject_analytics(slug: str, html: str) -> str:
    tag = f'<script data-flowin data-slug="{slug}">'
    snippet = ANALYTICS_SNIPPET.replace("<script>", tag, 1)
    if "</body>" in html:
        return html.replace("</body>", snippet + "\n</body>", 1)
    return html + snippet


def write_to_filesystem(slug: str, html: str):
    site_path = os.path.join(settings.sites_dir, slug)
    os.makedirs(site_path, exist_ok=True)
    filepath = os.path.join(site_path, "index.html")
    injected = _inject_analytics(slug, html)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(injected)
    logger.info("Wrote site to filesystem: %s", slug)


def remove_from_filesystem(slug: str):
    import shutil
    site_path = os.path.join(settings.sites_dir, slug)
    if os.path.exists(site_path):
        shutil.rmtree(site_path)
        logger.info("Removed site from filesystem: %s", slug)


def create_site(user_id: int, slug: str | None, title: str, html: str) -> dict:
    if not slug:
        for _ in range(10):
            slug = generate_slug()
            with get_conn() as conn:
                cur = conn.cursor()
                cur.execute("SELECT 1 FROM sites WHERE slug = %s", (slug,))
                if not cur.fetchone():
                    break
        else:
            raise RuntimeError("Could not generate unique slug")
    else:
        slug = slug.lower()
        if not all(c.isalnum() or c == "-" for c in slug):
            raise ValueError("Invalid slug format")
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM sites WHERE slug = %s", (slug,))
            if cur.fetchone():
                raise ValueError("Slug already taken")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO sites (user_id, slug, title, html_content)
               VALUES (%s, %s, %s, %s)
               RETURNING id, slug, title, created_at""",
            (user_id, slug, title, html),
        )
        row = cur.fetchone()

    write_to_filesystem(slug, html)

    return {
        "id": row[0],
        "slug": row[1],
        "title": row[2],
        "created_at": row[3].isoformat(),
        "url": f"https://{slug}.{settings.base_domain}",
    }


def get_sites_by_user(user_id: int) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, slug, title, created_at, updated_at
               FROM sites WHERE user_id = %s ORDER BY updated_at DESC""",
            (user_id,),
        )
        rows = cur.fetchall()

    return [
        {
            "id": row[0],
            "slug": row[1],
            "title": row[2],
            "created_at": row[3].isoformat(),
            "updated_at": row[4].isoformat() if row[4] else None,
            "url": f"https://{row[1]}.{settings.base_domain}",
        }
        for row in rows
    ]


def get_site(slug: str, user_id: int) -> dict | None:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, slug, title, html_content, created_at, updated_at
               FROM sites WHERE slug = %s AND user_id = %s""",
            (slug, user_id),
        )
        row = cur.fetchone()

    if not row:
        return None

    return {
        "id": row[0],
        "slug": row[1],
        "title": row[2],
        "html_content": row[3],
        "created_at": row[4].isoformat(),
        "updated_at": row[5].isoformat() if row[5] else None,
        "url": f"https://{row[1]}.{settings.base_domain}",
    }


def update_site(slug: str, user_id: int, title: str | None, html: str | None) -> dict | None:
    site = get_site(slug, user_id)
    if not site:
        return None

    new_title = title if title is not None else site["title"]
    new_html = html if html is not None else site["html_content"]

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE sites SET title = %s, html_content = %s, updated_at = NOW()
               WHERE slug = %s AND user_id = %s
               RETURNING id, slug, title, created_at, updated_at""",
            (new_title, new_html, slug, user_id),
        )
        row = cur.fetchone()

    if new_html != site.get("html_content"):
        write_to_filesystem(slug, new_html)

    return {
        "id": row[0],
        "slug": row[1],
        "title": row[2],
        "created_at": row[3].isoformat(),
        "updated_at": row[4].isoformat() if row[4] else None,
        "url": f"https://{slug}.{settings.base_domain}",
    }


def delete_site(slug: str, user_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM sites WHERE slug = %s AND user_id = %s RETURNING id",
            (slug, user_id),
        )
        deleted = cur.fetchone()

    if deleted:
        remove_from_filesystem(slug)
        return True
    return False


def check_slug_available(slug: str) -> bool:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM sites WHERE slug = %s", (slug,))
        return cur.fetchone() is None
