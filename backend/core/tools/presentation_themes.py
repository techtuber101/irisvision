"""New presentation theme catalog for Iris slide generation.

Each theme focuses on bold, modern aesthetics that differ from the legacy
styles. Themes are intentionally diverse to support a wide range of
presentations—from finance to deep tech to creative storytelling.
"""

from __future__ import annotations

from typing import Any, Dict

DEFAULT_THEME_KEY = "kaleidoscope"

PRESENTATION_THEMES: Dict[str, Dict[str, Any]] = {
    "kaleidoscope": {
        "label": "Kaleidoscope Grid",
        "background": (
            "radial-gradient(circle at 20% 20%, rgba(141, 198, 255, 0.25), transparent 35%),"
            "linear-gradient(135deg, #0f1629 0%, #0b1020 45%, #101630 100%)"
        ),
        "surface": "rgba(255, 255, 255, 0.08)",
        "muted": "rgba(255, 255, 255, 0.55)",
        "text": "#e8edf7",
        "accent": "#6dd3ff",
        "accent_secondary": "#c084fc",
        "stroke": "rgba(255, 255, 255, 0.16)",
        "glow": "0 25px 120px rgba(109, 211, 255, 0.35)",
        "heading_font": "'Space Grotesk', 'Inter', system-ui, sans-serif",
        "body_font": "'Manrope', 'Inter', system-ui, sans-serif",
        "grid": (
            "linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px),"
            "linear-gradient(0deg, rgba(255,255,255,0.04) 1px, transparent 1px)"
        ),
    },
    "terracotta": {
        "label": "Terracotta Atlas",
        "background": (
            "radial-gradient(circle at 80% 10%, rgba(255, 236, 200, 0.25), transparent 30%),"
            "linear-gradient(135deg, #1d1a16 0%, #241b12 38%, #302018 100%)"
        ),
        "surface": "rgba(255, 244, 235, 0.08)",
        "muted": "rgba(255, 240, 229, 0.7)",
        "text": "#f6ede3",
        "accent": "#f6a63c",
        "accent_secondary": "#e26643",
        "stroke": "rgba(247, 207, 182, 0.35)",
        "glow": "0 18px 90px rgba(230, 146, 90, 0.35)",
        "heading_font": "'DM Serif Display', 'Georgia', serif",
        "body_font": "'DM Sans', 'Inter', sans-serif",
        "grid": (
            "linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px),"
            "linear-gradient(0deg, rgba(255,255,255,0.06) 1px, transparent 1px)"
        ),
    },
    "circuitwave": {
        "label": "Circuit Wave",
        "background": (
            "radial-gradient(circle at 10% 90%, rgba(61, 255, 189, 0.16), transparent 32%),"
            "linear-gradient(135deg, #050910 0%, #0b1320 55%, #05121f 100%)"
        ),
        "surface": "rgba(8, 17, 31, 0.85)",
        "muted": "rgba(192, 224, 255, 0.7)",
        "text": "#d5e9ff",
        "accent": "#39e7b5",
        "accent_secondary": "#5ad4ff",
        "stroke": "rgba(90, 192, 255, 0.35)",
        "glow": "0 22px 110px rgba(58, 238, 190, 0.4)",
        "heading_font": "'Sora', 'Inter', sans-serif",
        "body_font": "'Manrope', 'Inter', sans-serif",
        "grid": (
            "linear-gradient(90deg, rgba(57, 231, 181, 0.06) 1px, transparent 1px),"
            "linear-gradient(0deg, rgba(90, 212, 255, 0.06) 1px, transparent 1px)"
        ),
    },
    "nocturne": {
        "label": "Nocturne Film",
        "background": (
            "radial-gradient(circle at 50% 50%, rgba(46, 119, 255, 0.18), transparent 32%),"
            "linear-gradient(145deg, #0c0d16 0%, #14192b 40%, #0c0f1d 100%)"
        ),
        "surface": "rgba(20, 27, 49, 0.8)",
        "muted": "rgba(223, 234, 255, 0.72)",
        "text": "#f0f4ff",
        "accent": "#70a6ff",
        "accent_secondary": "#ff8fb1",
        "stroke": "rgba(123, 158, 255, 0.35)",
        "glow": "0 18px 120px rgba(112, 166, 255, 0.42)",
        "heading_font": "'Clash Display', 'Space Grotesk', sans-serif",
        "body_font": "'Outfit', 'Inter', sans-serif",
        "grid": (
            "linear-gradient(90deg, rgba(112, 166, 255, 0.08) 1px, transparent 1px),"
            "linear-gradient(0deg, rgba(112, 166, 255, 0.08) 1px, transparent 1px)"
        ),
    },
    "solstice": {
        "label": "Solstice Dawn",
        "background": (
            "radial-gradient(circle at 10% 10%, rgba(255, 186, 120, 0.35), transparent 30%),"
            "linear-gradient(135deg, #0e0f12 0%, #1c1412 45%, #120d0b 100%)"
        ),
        "surface": "rgba(255, 244, 229, 0.08)",
        "muted": "rgba(255, 236, 220, 0.72)",
        "text": "#f7ede6",
        "accent": "#ffb86c",
        "accent_secondary": "#ffcbd5",
        "stroke": "rgba(255, 216, 186, 0.3)",
        "glow": "0 24px 110px rgba(255, 184, 108, 0.4)",
        "heading_font": "'Canela Text', 'DM Sans', sans-serif",
        "body_font": "'Work Sans', 'Inter', sans-serif",
        "grid": (
            "linear-gradient(90deg, rgba(255, 216, 186, 0.05) 1px, transparent 1px),"
            "linear-gradient(0deg, rgba(255, 216, 186, 0.05) 1px, transparent 1px)"
        ),
    },
    "aerogel": {
        "label": "Aerogel Minimal",
        "background": (
            "radial-gradient(circle at 80% 80%, rgba(129, 230, 217, 0.28), transparent 28%),"
            "linear-gradient(135deg, #f5f7fb 0%, #eef2fb 50%, #e8eef7 100%)"
        ),
        "surface": "rgba(255, 255, 255, 0.78)",
        "muted": "#536076",
        "text": "#0f172a",
        "accent": "#3366ff",
        "accent_secondary": "#2dd4bf",
        "stroke": "rgba(15, 23, 42, 0.08)",
        "glow": "0 16px 60px rgba(51, 102, 255, 0.18)",
        "heading_font": "'Neue Haas Grotesk Display Pro', 'Space Grotesk', sans-serif",
        "body_font": "'Plus Jakarta Sans', 'Inter', sans-serif",
        "grid": (
            "linear-gradient(90deg, rgba(15, 23, 42, 0.06) 1px, transparent 1px),"
            "linear-gradient(0deg, rgba(15, 23, 42, 0.06) 1px, transparent 1px)"
        ),
    },
}


def get_theme(name: str | None) -> Dict[str, Any]:
    """Return a theme definition with a graceful fallback."""

    if not name:
        return PRESENTATION_THEMES[DEFAULT_THEME_KEY]

    normalized = name.strip().lower()
    return PRESENTATION_THEMES.get(normalized, PRESENTATION_THEMES[DEFAULT_THEME_KEY])
