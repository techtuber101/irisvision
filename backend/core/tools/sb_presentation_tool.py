"""Modern presentation tool with reliable live previews and metadata.

This module rewrites the sandbox presentation workflow to provide:
- Consistent metadata management with explicit presentation + slide models
- Stable sanitisation between backend and frontend (slug-based identifiers)
- Rich tool responses that include sandbox URLs for immediate previews
- Helper utilities for regenerating slides (finalise, validate, delete)
"""

from __future__ import annotations

import html
import json
import re
import unicodedata
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

from core.agentpress.thread_manager import ThreadManager
from core.agentpress.tool import ToolResult, openapi_schema, tool_metadata
from core.sandbox.tool_base import SandboxToolsBase
from core.utils.logger import logger
from .presentation_themes import DEFAULT_THEME_KEY, PRESENTATION_THEMES, get_theme

ISO_SUFFIX = "Z"
METADATA_VERSION = 1
DEFAULT_THEME = DEFAULT_THEME_KEY


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def utc_now() -> str:
    """Return a UTC timestamp with a trailing Z suffix."""
    return datetime.utcnow().replace(microsecond=0).isoformat() + ISO_SUFFIX


def sanitize_presentation_id(raw: str) -> str:
    """Create a filesystem-safe identifier shared across backend and frontend."""
    if not raw:
        return f"presentation_{uuid.uuid4().hex[:8]}"

    normalized = unicodedata.normalize("NFKD", raw)
    ascii_str = normalized.encode("ascii", "ignore").decode("ascii")
    ascii_str = ascii_str.lower()
    ascii_str = re.sub(r"[^\w\s-]", "", ascii_str)
    ascii_str = re.sub(r"[\s-]+", "_", ascii_str)
    ascii_str = ascii_str.strip("_")
    ascii_str = ascii_str[:64]

    return ascii_str or f"presentation_{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Metadata data classes
# ---------------------------------------------------------------------------


@dataclass
class SlideEntry:
    number: int
    title: str
    filename: str
    file_path: str
    content: str
    created_at: str
    updated_at: str

    def to_metadata(self) -> Dict[str, Any]:
        return {
            "number": self.number,
            "title": self.title,
            "filename": self.filename,
            "file_path": self.file_path,
            "content": self.content,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def to_public_dict(self, sandbox_url: Optional[str] = None, include_content: bool = False) -> Dict[str, Any]:
        data = {
            "slide_number": self.number,
            "title": self.title,
            "file_path": self.file_path,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if include_content:
            data["content"] = self.content
        if sandbox_url:
            data["preview_url"] = PresentationStorage.build_external_url(self.file_path, sandbox_url)
        return data

    @classmethod
    def from_metadata(cls, number: int, data: Dict[str, Any], presentation_name: str) -> "SlideEntry":
        filename = data.get("filename") or f"slide_{number:03d}.html"
        file_path = data.get("file_path") or f"presentations/{presentation_name}/{filename}"
        content = data.get("content", "")
        created_at = data.get("created_at") or utc_now()
        updated_at = data.get("updated_at") or created_at
        title = data.get("title") or f"Slide {number}"
        return cls(
            number=number,
            title=title,
            filename=filename,
            file_path=file_path,
            content=content,
            created_at=created_at,
            updated_at=updated_at,
        )


@dataclass
class PresentationState:
    presentation_id: str
    presentation_name: str
    title: str
    theme: str = DEFAULT_THEME
    description: str = ""
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)
    slides: Dict[int, SlideEntry] = field(default_factory=dict)

    @property
    def directory_path(self) -> str:
        return f"presentations/{self.presentation_name}"

    @property
    def metadata_path(self) -> str:
        return f"{self.directory_path}/metadata.json"

    def slide_count(self) -> int:
        return len(self.slides)

    def ordered_slides(self) -> List[SlideEntry]:
        return [self.slides[idx] for idx in sorted(self.slides.keys())]

    def to_metadata(self) -> Dict[str, Any]:
        return {
            "version": METADATA_VERSION,
            "presentation_id": self.presentation_id,
            "presentation_name": self.presentation_name,
            "title": self.title,
            "description": self.description,
            "theme": self.theme,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "slide_count": self.slide_count(),
            "slides": {
                str(number): slide.to_metadata()
                for number, slide in sorted(self.slides.items())
            },
        }

    @classmethod
    def from_metadata(cls, metadata: Dict[str, Any]) -> "PresentationState":
        presentation_name = metadata.get("presentation_name") or sanitize_presentation_id(metadata.get("presentation_id") or "presentation")
        presentation_id = metadata.get("presentation_id") or presentation_name
        state = cls(
            presentation_id=presentation_id,
            presentation_name=presentation_name,
            title=metadata.get("title") or presentation_id,
            theme=metadata.get("theme") or DEFAULT_THEME,
            description=metadata.get("description", ""),
            created_at=metadata.get("created_at") or utc_now(),
            updated_at=metadata.get("updated_at") or utc_now(),
        )

        slides = metadata.get("slides", {})
        for key, value in slides.items():
            try:
                number = int(key)
            except ValueError:
                continue
            state.slides[number] = SlideEntry.from_metadata(number, value, presentation_name)
        return state


# ---------------------------------------------------------------------------
# Storage helper around the sandbox filesystem
# ---------------------------------------------------------------------------


class PresentationStorage:
    def __init__(self, tool: "ProfessionalPresentationTool"):
        self.tool = tool
        self.root_dir = f"{tool.workspace_path}/presentations"
        self.index_path = f"{self.root_dir}/.metadata.json"

    async def ensure_root(self) -> None:
        await self.tool._ensure_sandbox()
        try:
            await self.tool.sandbox.fs.make_dir(self.root_dir)
        except Exception:
            pass

    async def ensure_presentation_dir(self, presentation_name: str) -> str:
        await self.ensure_root()
        presentation_dir = f"{self.root_dir}/{presentation_name}"
        try:
            await self.tool.sandbox.fs.make_dir(presentation_dir)
        except Exception:
            pass
        return presentation_dir

    async def load(self, presentation_reference: str, *, create_if_missing: bool = False, default_title: Optional[str] = None, default_theme: str = DEFAULT_THEME) -> PresentationState:
        name_candidate = sanitize_presentation_id(presentation_reference)
        metadata_path = f"{self.root_dir}/{name_candidate}/metadata.json"

        try:
            raw = await self.tool.sandbox.fs.download_file(metadata_path)
            metadata = json.loads(raw.decode())
            state = PresentationState.from_metadata(metadata)
            return state
        except Exception:
            if not create_if_missing:
                raise FileNotFoundError(f"Presentation '{presentation_reference}' does not exist")

            await self.ensure_presentation_dir(name_candidate)
            now = utc_now()
            state = PresentationState(
                presentation_id=presentation_reference,
                presentation_name=name_candidate,
                title=default_title or presentation_reference,
                theme=default_theme or DEFAULT_THEME,
                created_at=now,
                updated_at=now,
            )
            await self.save(state)
            return state

    async def save(self, state: PresentationState) -> None:
        await self.ensure_presentation_dir(state.presentation_name)
        state.updated_at = utc_now()
        metadata_path = f"{self.root_dir}/{state.presentation_name}/metadata.json"
        payload = json.dumps(state.to_metadata(), indent=2, ensure_ascii=False)
        await self.tool.sandbox.fs.upload_file(payload.encode("utf-8"), metadata_path)

    async def update_index(self, state: PresentationState) -> None:
        await self.ensure_root()
        try:
            raw = await self.tool.sandbox.fs.download_file(self.index_path)
            index = json.loads(raw.decode())
        except Exception:
            index = {"presentations": {}, "updated_at": utc_now()}

        index.setdefault("presentations", {})[state.presentation_name] = {
            "presentation_id": state.presentation_id,
            "title": state.title,
            "description": state.description,
            "theme": state.theme,
            "slide_count": state.slide_count(),
            "created_at": state.created_at,
            "updated_at": state.updated_at,
            "presentation_name": state.presentation_name,
            "metadata_path": state.metadata_path,
        }
        index["updated_at"] = utc_now()
        await self.tool.sandbox.fs.upload_file(json.dumps(index, indent=2).encode("utf-8"), self.index_path)

    async def remove_from_index(self, presentation_name: str) -> None:
        await self.ensure_root()
        try:
            raw = await self.tool.sandbox.fs.download_file(self.index_path)
            index = json.loads(raw.decode())
        except Exception:
            return

        presentations = index.get("presentations", {})
        if presentation_name in presentations:
            presentations.pop(presentation_name, None)
            index["presentations"] = presentations
            index["updated_at"] = utc_now()
            await self.tool.sandbox.fs.upload_file(json.dumps(index, indent=2).encode("utf-8"), self.index_path)

    async def list_presentations(self) -> List[PresentationState]:
        await self.ensure_root()
        try:
            entries = await self.tool.sandbox.fs.list_files(self.root_dir)
        except Exception as exc:
            logger.warning("Failed to list presentations directory: %s", exc)
            return []

        states: List[PresentationState] = []
        for entry in entries:
            is_dir = getattr(entry, "is_directory", None)
            if is_dir is None:
                is_dir = getattr(entry, "is_dir", False)
            if not is_dir:
                continue
            try:
                state = await self.load(entry.name, create_if_missing=False)
                states.append(state)
            except FileNotFoundError:
                continue
            except Exception as exc:
                logger.error("Failed to load presentation %s: %s", entry.name, exc)
        return states

    @staticmethod
    def build_external_url(relative_path: str, sandbox_url: Optional[str]) -> Optional[str]:
        if not sandbox_url or not relative_path:
            return None
        relative = relative_path.lstrip("/")
        base = sandbox_url.rstrip("/")
        return f"{base}/{relative}"


# ---------------------------------------------------------------------------
# HTML rendering helpers
# ---------------------------------------------------------------------------


def resolve_theme(theme: Optional[str]) -> Dict[str, str]:
    return get_theme(theme)


def render_slide_html(
    *,
    presentation: PresentationState,
    slide: SlideEntry,
    slide_index: int,
    total_slides: int,
) -> str:
    theme = resolve_theme(presentation.theme)
    background = " ".join(theme["background"]) if isinstance(theme.get("background"), (tuple, list)) else theme.get("background")
    grid = " ".join(theme["grid"]) if isinstance(theme.get("grid"), (tuple, list)) else theme.get("grid")
    title = html.escape(slide.title or presentation.title)
    presentation_title = html.escape(presentation.title)

    return f"""<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"UTF-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
  <meta name=\"generator\" content=\"Iris Decksmith\" />
  <meta name=\"presentation\" content=\"{presentation.presentation_name}\" />
  <meta name=\"slide-number\" content=\"{slide_index}\" />
  <meta name=\"slide-count\" content=\"{total_slides}\" />
  <meta http-equiv=\"X-Daytona-Skip-Preview-Warning\" content=\"true\" />
  <title>{title} · {presentation_title}</title>
  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" />
  <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin />
  <link href=\"https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;600&family=DM+Sans:wght@400;600&display=swap\" rel=\"stylesheet\" />
  <script src=\"https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js\"></script>
  <script src=\"https://d3js.org/d3.v7.min.js\"></script>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    :root {{
      --bg: {background};
      --grid: {grid};
      --surface: {theme['surface']};
      --muted: {theme['muted']};
      --text: {theme['text']};
      --accent: {theme['accent']};
      --accent-2: {theme['accent_secondary']};
      --stroke: {theme['stroke']};
      --glow: {theme['glow']};
      --heading-font: {theme['heading_font']};
      --body-font: {theme['body_font']};
    }}
    body {{
      width: 1920px;
      height: 1080px;
      background: var(--bg);
      color: var(--text);
      font-family: var(--body-font);
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .grid-overlay {{
      position: absolute;
      inset: 0;
      background-image: var(--grid);
      background-size: 140px 140px, 140px 140px;
      opacity: 0.35;
      mix-blend-mode: screen;
      pointer-events: none;
    }}
    .glow {{
      position: absolute;
      inset: -20%;
      filter: blur(80px);
      background: radial-gradient(circle at 35% 20%, var(--accent) 0%, transparent 35%),
                  radial-gradient(circle at 75% 80%, var(--accent-2) 0%, transparent 32%);
      opacity: 0.5;
      pointer-events: none;
    }}
    .frame {{
      position: relative;
      z-index: 2;
      width: 1720px;
      height: 940px;
      padding: 52px 60px;
      border: 1px solid var(--stroke);
      border-radius: 28px;
      background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
      box-shadow: var(--glow), 0 30px 120px rgba(0,0,0,0.35);
      display: flex;
      flex-direction: column;
      gap: 28px;
      backdrop-filter: blur(14px);
    }}
    .masthead {{
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: center;
      border-bottom: 1px solid var(--stroke);
      padding-bottom: 18px;
    }}
    .eyebrow {{
      font-size: 16px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 8px;
    }}
    h1 {{
      font-family: var(--heading-font);
      font-size: 66px;
      font-weight: 700;
      line-height: 1.02;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }}
    .subtitle {{
      font-size: 22px;
      color: var(--muted);
      max-width: 1100px;
      line-height: 1.5;
    }}
    .pill {{
      justify-self: end;
      padding: 10px 20px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      border: 1px solid var(--stroke);
      color: var(--accent);
      font-weight: 700;
      letter-spacing: 0.08em;
      font-size: 15px;
      text-transform: uppercase;
    }}
    .content-rail {{
      flex: 1;
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 24px;
    }}
    .content-panel {{
      grid-column: span 12;
      background: var(--surface);
      border: 1px solid var(--stroke);
      border-radius: 18px;
      padding: 30px 36px;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 22px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
    }}
    .content-panel h2 {{
      font-family: var(--heading-font);
      font-size: 38px;
      margin-bottom: 8px;
      color: #fff;
      letter-spacing: -0.01em;
    }}
    .content-panel h3 {{
      font-family: var(--heading-font);
      font-size: 26px;
      margin: 14px 0 6px;
      color: var(--accent);
    }}
    .content-panel p {{
      font-size: 22px;
      line-height: 1.6;
      color: var(--text);
    }}
    .content-panel ul, .content-panel ol {{
      display: grid;
      gap: 10px;
      padding-left: 26px;
      color: var(--text);
      font-size: 21px;
    }}
    .two-col {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 18px;
    }}
    .card {{
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--stroke);
      border-radius: 16px;
      padding: 18px 20px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
    }}
    .statline {{
      display: flex;
      align-items: baseline;
      gap: 10px;
    }}
    .statline .value {{
      font-size: 42px;
      font-weight: 700;
      color: var(--accent);
      font-family: var(--heading-font);
    }}
    .statline .label {{
      font-size: 18px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }}
    .data-table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 18px;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--stroke);
      border-radius: 12px;
      overflow: hidden;
    }}
    .data-table th, .data-table td {{
      padding: 12px 14px;
      text-align: left;
    }}
    .data-table th {{
      background: linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
      font-size: 16px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      border-bottom: 1px solid var(--stroke);
    }}
    .data-table tr + tr td {{
      border-top: 1px solid var(--stroke);
    }}
    .chip {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(255,255,255,0.08);
      border-radius: 999px;
      border: 1px solid var(--stroke);
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }}
    .chart-shell {{
      background: rgba(0,0,0,0.2);
      border: 1px dashed var(--stroke);
      border-radius: 14px;
      padding: 14px;
      min-height: 260px;
    }}
    .hero-image {{
      width: 100%;
      border-radius: 18px;
      border: 1px solid var(--stroke);
      box-shadow: 0 18px 60px rgba(0,0,0,0.35);
      object-fit: cover;
    }}
    pre, code {{
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--stroke);
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 18px;
      color: #e1e7ff;
      overflow-x: auto;
    }}
    .status {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid var(--stroke);
      color: var(--muted);
      font-size: 18px;
    }}
    .tag {{
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid var(--stroke);
      background: rgba(255,255,255,0.08);
      color: var(--accent);
      font-weight: 700;
    }}
  </style>
</head>
<body>
  <div class=\"glow\"></div>
  <div class=\"grid-overlay\"></div>
  <div class=\"frame\">
    <header class=\"masthead\">
      <div>
        <div class=\"eyebrow\">Iris Decksmith · {presentation.presentation_name}</div>
        <h1>{title}</h1>
        <p class=\"subtitle\">{presentation_title}</p>
      </div>
      <div class=\"pill\">Slide {slide_index}/{total_slides}</div>
    </header>
    <main class=\"content-rail\">
      <article class=\"content-panel\">
        {slide.content}
      </article>
    </main>
    <footer class=\"status\">
      <span>{presentation_title}</span>
      <span class=\"tag\">Live visualization ready</span>
    </footer>
  </div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Primary Presentation Tool implementation
# ---------------------------------------------------------------------------


@tool_metadata(
    display_name="Professional Presentations",
    description="Create, preview, and deliver stunning presentations",
    icon="Presentation",
    color="bg-purple-100 dark:bg-purple-800/50",
    weight=70,
    visible=True,
)
class ProfessionalPresentationTool(SandboxToolsBase):
    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        self._storage = PresentationStorage(self)

    async def _get_sandbox_links(self) -> Dict[str, Optional[str]]:
        try:
            client = await self.thread_manager.db.client
            result = await client.table("projects").select("sandbox").eq("project_id", self.project_id).execute()
            data = (result.data or [None])[0] if hasattr(result, "data") else None
            sandbox_info = (data or {}).get("sandbox") or {}
            return {
                "sandbox_url": sandbox_info.get("sandbox_url"),
                "vnc_url": sandbox_info.get("vnc_preview"),
                "token": sandbox_info.get("token"),
            }
        except Exception as exc:
            logger.debug("Unable to load sandbox links: %s", exc)
            return {"sandbox_url": None, "vnc_url": None, "token": None}

    # ------------------------------------------------------------------
    # create_slide
    # ------------------------------------------------------------------

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "create_slide",
            "description": "Create or update a presentation slide with rich HTML content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "presentation_id": {
                        "type": "string",
                        "description": "Unique identifier for the presentation (name or slug).",
                    },
                    "slide_number": {
                        "type": "integer",
                        "description": "Slide number (starting from 1).",
                    },
                    "title": {
                        "type": "string",
                        "description": "Slide title displayed in headers and metadata.",
                    },
                    "content": {
                        "type": "string",
                        "description": "HTML body content for the slide (no <html>/<body> wrapper).",
                    },
                    "theme": {
                        "type": "string",
                        "description": "Optional theme key (kaleidoscope, terracotta, circuitwave, nocturne, solstice, aerogel).",
                        "enum": list(PRESENTATION_THEMES.keys()),
                        "default": DEFAULT_THEME,
                    },
                },
                "required": ["presentation_id", "slide_number", "title", "content"],
            },
        },
    })
    async def create_slide(
        self,
        presentation_id: str,
        slide_number: int,
        title: str,
        content: str,
        theme: str = DEFAULT_THEME,
    ) -> ToolResult:
        try:
            await self._storage.ensure_root()

            if slide_number < 1:
                return self.fail_response("slide_number must be >= 1")
            if not presentation_id.strip():
                return self.fail_response("presentation_id is required")
            if not title.strip():
                return self.fail_response("title is required")
            if not content.strip():
                return self.fail_response("content is required")

            state = await self._storage.load(
                presentation_id,
                create_if_missing=True,
                default_title=title,
                default_theme=theme,
            )

            state.theme = theme or state.theme
            slide_filename = f"slide_{slide_number:03d}.html"
            file_path = f"presentations/{state.presentation_name}/{slide_filename}"
            now = utc_now()

            existing = state.slides.get(slide_number)
            created_at = existing.created_at if existing else now
            slide_entry = SlideEntry(
                number=slide_number,
                title=title,
                filename=slide_filename,
                file_path=file_path,
                content=content,
                created_at=created_at,
                updated_at=now,
            )
            state.slides[slide_number] = slide_entry

            total_slides = state.slide_count()
            rendered = render_slide_html(
                presentation=state,
                slide=slide_entry,
                slide_index=slide_number,
                total_slides=total_slides,
            )
            slide_full_path = f"{self._storage.root_dir}/{state.presentation_name}/{slide_filename}"
            await self.sandbox.fs.upload_file(rendered.encode("utf-8"), slide_full_path)

            await self._storage.save(state)
            await self._storage.update_index(state)

            sandbox_links = await self._get_sandbox_links()
            sandbox_url = sandbox_links.get("sandbox_url")

            response = {
                "status": "slide_created",
                "message": f"✓ Slide {slide_number} created successfully",
                "presentation_id": state.presentation_id,
                "presentation_name": state.presentation_name,
                "presentation_title": state.title,
                "presentation_path": state.directory_path,
                "metadata_path": state.metadata_path,
                "metadata_url": PresentationStorage.build_external_url(state.metadata_path, sandbox_url),
                "sandbox_url": sandbox_url,
                "slide_number": slide_number,
                "slide_title": title,
                "slide_file": slide_entry.file_path,
                "slide": slide_entry.to_public_dict(sandbox_url=sandbox_url, include_content=False),
                "total_slides": total_slides,
                "theme": state.theme,
            }
            return self.success_response(response)
        except Exception as exc:
            logger.exception("Failed to create slide: %s", exc)
            return self.fail_response(f"Failed to create slide: {exc}")

    # ------------------------------------------------------------------
    # list_slides
    # ------------------------------------------------------------------

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "list_slides",
            "description": "List all slides for a presentation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "presentation_id": {"type": "string", "description": "Presentation identifier or slug."}
                },
                "required": ["presentation_id"],
            },
        },
    })
    async def list_slides(self, presentation_id: str) -> ToolResult:
        try:
            state = await self._storage.load(presentation_id, create_if_missing=False)
            sandbox_links = await self._get_sandbox_links()
            sandbox_url = sandbox_links.get("sandbox_url")

            slides = [
                slide.to_public_dict(sandbox_url=sandbox_url, include_content=False)
                for slide in state.ordered_slides()
            ]

            response = {
                "message": f"Found {len(slides)} slides",
                "presentation_id": state.presentation_id,
                "presentation_name": state.presentation_name,
                "presentation_title": state.title,
                "presentation_path": state.directory_path,
                "metadata_path": state.metadata_path,
                "metadata_url": PresentationStorage.build_external_url(state.metadata_path, sandbox_url),
                "theme": state.theme,
                "description": state.description,
                "slides": slides,
                "slide_count": state.slide_count(),
                "sandbox_url": sandbox_url,
            }
            return self.success_response(response)
        except FileNotFoundError:
            return self.fail_response(f"Presentation '{presentation_id}' not found")
        except Exception as exc:
            logger.exception("Failed to list slides: %s", exc)
            return self.fail_response(f"Failed to list slides: {exc}")

    # ------------------------------------------------------------------
    # delete_slide
    # ------------------------------------------------------------------

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "delete_slide",
            "description": "Delete a specific slide from a presentation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "presentation_id": {"type": "string"},
                    "slide_number": {"type": "integer"},
                },
                "required": ["presentation_id", "slide_number"],
            },
        },
    })
    async def delete_slide(self, presentation_id: str, slide_number: int) -> ToolResult:
        try:
            state = await self._storage.load(presentation_id, create_if_missing=False)
            slide = state.slides.get(slide_number)
            if not slide:
                return self.fail_response(f"Slide {slide_number} not found in presentation '{presentation_id}'")

            slide_full_path = f"{self._storage.root_dir}/{state.presentation_name}/{slide.filename}"
            try:
                await self.sandbox.fs.delete_file(slide_full_path)
            except Exception as exc:
                logger.debug("Unable to delete slide file %s: %s", slide_full_path, exc)

            del state.slides[slide_number]
            await self._storage.save(state)
            await self._storage.update_index(state)

            response = {
                "message": f"Slide {slide_number} '{slide.title}' deleted successfully",
                "presentation_name": state.presentation_name,
                "presentation_path": state.directory_path,
                "deleted_slide": slide_number,
                "deleted_title": slide.title,
                "remaining_slides": state.slide_count(),
            }
            return self.success_response(response)
        except FileNotFoundError:
            return self.fail_response(f"Presentation '{presentation_id}' not found")
        except Exception as exc:
            logger.exception("Failed to delete slide: %s", exc)
            return self.fail_response(f"Failed to delete slide: {exc}")

    # ------------------------------------------------------------------
    # list_presentations
    # ------------------------------------------------------------------

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "list_presentations",
            "description": "List all presentations stored in the sandbox.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    })
    async def list_presentations(self) -> ToolResult:
        try:
            states = await self._storage.list_presentations()
            presentations = [
                {
                    "folder": state.presentation_name,
                    "title": state.title,
                    "description": state.description,
                    "total_slides": state.slide_count(),
                    "theme": state.theme,
                    "created_at": state.created_at,
                    "updated_at": state.updated_at,
                    "metadata_path": state.metadata_path,
                }
                for state in states
            ]
            response = {
                "message": f"Found {len(presentations)} presentations",
                "presentations": presentations,
                "presentations_directory": "/workspace/presentations",
            }
            return self.success_response(response)
        except Exception as exc:
            logger.exception("Failed to list presentations: %s", exc)
            return self.fail_response(f"Failed to list presentations: {exc}")

    # ------------------------------------------------------------------
    # delete_presentation
    # ------------------------------------------------------------------

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "delete_presentation",
            "description": "Delete an entire presentation and all slides.",
            "parameters": {
                "type": "object",
                "properties": {"presentation_id": {"type": "string"}},
                "required": ["presentation_id"],
            },
        },
    })
    async def delete_presentation(self, presentation_id: str) -> ToolResult:
        try:
            slug = sanitize_presentation_id(presentation_id)
            full_path = f"{self._storage.root_dir}/{slug}"
            try:
                await self.sandbox.fs.delete_folder(full_path)
            except Exception as exc:
                return self.fail_response(f"Presentation '{presentation_id}' not found or could not be deleted: {exc}")

            await self._storage.remove_from_index(slug)
            return self.success_response({
                "message": f"Presentation '{presentation_id}' deleted successfully",
                "deleted_path": f"presentations/{slug}",
            })
        except Exception as exc:
            logger.exception("Failed to delete presentation: %s", exc)
            return self.fail_response(f"Failed to delete presentation: {exc}")

    # ------------------------------------------------------------------
    # validate_slide
    # ------------------------------------------------------------------

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "validate_slide",
            "description": "Validate rendered slide height using Playwright.",
            "parameters": {
                "type": "object",
                "properties": {
                    "presentation_id": {"type": "string"},
                    "slide_number": {"type": "integer"},
                },
                "required": ["presentation_id", "slide_number"],
            },
        },
    })
    async def validate_slide(self, presentation_id: str, slide_number: int) -> ToolResult:
        try:
            state = await self._storage.load(presentation_id, create_if_missing=False)
            slide = state.slides.get(slide_number)
            if not slide:
                return self.fail_response(f"Slide {slide_number} not found in presentation '{presentation_id}'")

            script_name = f".validate_slide_{uuid.uuid4().hex}.py"
            script_path = f"{self.workspace_path}/{script_name}"
            script = f'''import asyncio, json
from playwright.async_api import async_playwright

async def measure():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
        page = await browser.new_page(viewport={{"width": 1920, "height": 1080}})
        await page.goto("file:///workspace/{slide.file_path}", wait_until="networkidle", timeout=25000)
        dimensions = await page.evaluate("""() => {{
            const html = document.documentElement;
            const body = document.body;
            const scrollHeight = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
            return {{
                scrollHeight,
                overflows: scrollHeight > 1080,
                excessHeight: Math.max(0, scrollHeight - 1080)
            }};
        }}""")
        await browser.close()
        return dimensions

print(json.dumps(asyncio.run(measure())))
'''
            await self.sandbox.fs.upload_file(script.encode("utf-8"), script_path)

            try:
                result = await self.sandbox.process.exec(
                    f"/bin/sh -c 'cd /workspace && python3 {script_name}'",
                    timeout=45,
                )
                output = (getattr(result, "result", None) or getattr(result, "output", "") or "").strip()
                if not output:
                    raise RuntimeError("No output produced by validation script")
                dimensions = json.loads(output)
            finally:
                try:
                    await self.sandbox.fs.delete_file(script_path)
                except Exception:
                    pass

            validation_passed = not dimensions.get("overflows", False)
            response = {
                "presentation_name": state.presentation_name,
                "presentation_path": state.directory_path,
                "slide_number": slide_number,
                "slide_title": slide.title,
                "actual_content_height": dimensions.get("scrollHeight"),
                "target_height": 1080,
                "validation_passed": validation_passed,
            }
            if validation_passed:
                response["message"] = f"✓ Slide {slide_number} '{slide.title}' validation passed. Content height: {dimensions.get('scrollHeight')}px"
            else:
                response["message"] = (
                    f"✗ Slide {slide_number} '{slide.title}' validation failed. Content height: "
                    f"{dimensions.get('scrollHeight')}px exceeds 1080px limit by {dimensions.get('excessHeight')}px"
                )
                response["excess_height"] = dimensions.get("excessHeight")
            return self.success_response(response)
        except FileNotFoundError:
            return self.fail_response(f"Presentation '{presentation_id}' not found")
        except Exception as exc:
            logger.exception("Failed to validate slide: %s", exc)
            return self.fail_response(f"Failed to validate slide: {exc}")

    # ------------------------------------------------------------------
    # finalize_presentation
    # ------------------------------------------------------------------

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "finalize_presentation",
            "description": "Finalize a presentation and regenerate slide footers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "presentation_id": {"type": "string"},
                    "presentation_title": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["presentation_id", "presentation_title"],
            },
        },
    })
    async def finalize_presentation(
        self,
        presentation_id: str,
        presentation_title: str,
        description: str = "",
    ) -> ToolResult:
        try:
            state = await self._storage.load(presentation_id, create_if_missing=False)
            state.title = presentation_title
            state.description = description or state.description

            total_slides = state.slide_count()
            if total_slides == 0:
                return self.fail_response("No slides found in presentation")

            for idx, slide in enumerate(state.ordered_slides(), start=1):
                slide.title = slide.title or presentation_title
                slide.updated_at = utc_now()
                rendered = render_slide_html(
                    presentation=state,
                    slide=slide,
                    slide_index=idx,
                    total_slides=total_slides,
                )
                slide_full_path = f"{self._storage.root_dir}/{state.presentation_name}/{slide.filename}"
                await self.sandbox.fs.upload_file(rendered.encode("utf-8"), slide_full_path)

            await self._storage.save(state)
            await self._storage.update_index(state)

            sandbox_links = await self._get_sandbox_links()
            sandbox_url = sandbox_links.get("sandbox_url")
            attachments = [slide.file_path for slide in state.ordered_slides()]

            response = {
                "message": f"✓ Presentation '{presentation_title}' is ready!",
                "presentation_id": state.presentation_id,
                "presentation_name": state.presentation_name,
                "presentation_title": state.title,
                "presentation_path": state.directory_path,
                "metadata_path": state.metadata_path,
                "metadata_url": PresentationStorage.build_external_url(state.metadata_path, sandbox_url),
                "description": state.description,
                "theme": state.theme,
                "slide_count": total_slides,
                "attachments": attachments,
                "sandbox_url": sandbox_url,
                "status": "finalized",
            }
            return self.success_response(response)
        except FileNotFoundError:
            return self.fail_response(f"Presentation '{presentation_id}' not found")
        except Exception as exc:
            logger.exception("Failed to finalize presentation: %s", exc)
            return self.fail_response(f"Failed to finalize presentation: {exc}")

    # ------------------------------------------------------------------
    # present_presentation
    # ------------------------------------------------------------------

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "present_presentation",
            "description": "Deliver the final presentation summary to the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "presentation_name": {"type": "string"},
                    "presentation_title": {"type": "string"},
                    "presentation_path": {"type": "string"},
                    "slide_count": {"type": "integer"},
                    "text": {"type": "string", "description": "Human readable summary."},
                    "attachments": {
                        "type": "string",
                        "description": "File attachment(s) to include with the presentation summary. Provide a single relative path or a comma-separated / JSON-formatted list (e.g., \"presentations/demo/slide_01.html\" or \"[\\\"presentations/demo/slide_01.html\\\", \\\"presentations/demo/slide_02.html\\\"]\").",
                    },
                    "presentation_url": {"type": "string"},
                },
                "required": [
                    "presentation_name",
                    "presentation_title",
                    "presentation_path",
                    "slide_count",
                    "text",
                    "attachments",
                ],
            },
        },
    })
    async def present_presentation(
        self,
        presentation_name: str,
        presentation_title: str,
        presentation_path: str,
        slide_count: int,
        text: str,
        attachments: Union[str, List[str]],
        presentation_url: Optional[str] = None,
    ) -> ToolResult:
        try:
            if isinstance(attachments, str):
                attachments_list = [att.strip() for att in attachments.split(",") if att.strip()]
            else:
                attachments_list = attachments

            sandbox_links = await self._get_sandbox_links()
            response = {
                "presentation_name": presentation_name,
                "presentation_title": presentation_title,
                "presentation_path": presentation_path,
                "slide_count": slide_count,
                "text": text,
                "attachments": attachments_list,
                "presentation_url": presentation_url,
                "sandbox_url": sandbox_links.get("sandbox_url"),
                "status": "presentation_delivered",
            }
            return self.success_response(response)
        except Exception as exc:
            logger.exception("Failed to present presentation: %s", exc)
            return self.fail_response(f"Error presenting presentation: {exc}")
