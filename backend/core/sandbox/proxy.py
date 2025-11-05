"""
Helpers for constructing Daytona sandbox preview URLs behind a custom proxy.

These helpers centralize the logic for rewriting Daytona preview links to an
organization-owned domain while preserving the original Daytona URLs as
fallbacks. They are used throughout the backend wherever preview URLs are
surfaced to users or stored in project metadata.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

from core.utils.config import config
from core.utils.logger import logger


@dataclass
class PreviewLinkInfo:
    """Normalized representation of a Daytona preview link."""

    url: Optional[str]
    token: Optional[str]
    original_url: Optional[str]


def extract_url_from_link(link: Any) -> Optional[str]:
    """Best-effort extraction of the preview URL from Daytona SDK responses."""
    if link is None:
        return None

    url = getattr(link, "url", None)
    if url:
        return url

    text = str(link)
    marker = "url='"
    if marker in text:
        try:
            return text.split(marker, 1)[1].split("'", 1)[0]
        except (IndexError, ValueError):
            logger.debug("Failed to parse URL from Daytona link string: %s", text)
    return None


def extract_token_from_link(link: Any) -> Optional[str]:
    """Best-effort extraction of the preview token from Daytona SDK responses."""
    if link is None:
        return None

    token = getattr(link, "token", None)
    if token:
        return token

    text = str(link)
    marker = "token='"
    if marker in text:
        try:
            return text.split(marker, 1)[1].split("'", 1)[0]
        except (IndexError, ValueError):
            logger.debug("Failed to parse token from Daytona link string: %s", text)
    return None


def build_custom_domain_url(sandbox_id: str, port: int) -> Optional[str]:
    """
    Construct the organization-owned sandbox preview domain.

    Expected format: {port}-{sandbox_id}.{domain}
    """
    domain = (config.SANDBOX_PROXY_DOMAIN or "").strip()
    if not domain:
        return None

    protocol = (config.SANDBOX_PROXY_PROTOCOL or "https").strip()
    custom_port = getattr(config, "SANDBOX_PROXY_PORT", None)
    port_suffix = ""
    if custom_port:
        try:
            custom_port_int = int(custom_port)
            if custom_port_int > 0:
                port_suffix = f":{custom_port_int}"
        except (TypeError, ValueError):
            logger.warning("Invalid SANDBOX_PROXY_PORT value: %s", custom_port)

    # Avoid accidental double dots when users include a leading dot.
    normalized_domain = domain.lstrip(".")
    subdomain = f"{port}-{sandbox_id}"
    return f"{protocol}://{subdomain}.{normalized_domain}{port_suffix}"


def apply_custom_domain(url: Optional[str], sandbox_id: str, port: int) -> Optional[str]:
    """Return the custom domain URL when configured, otherwise the original URL."""
    custom_url = build_custom_domain_url(sandbox_id, port)
    return custom_url or url


def normalize_preview_link(link: Any, sandbox_id: str, port: int) -> PreviewLinkInfo:
    """Normalize Daytona preview link data with optional custom domain rewriting."""
    original_url = extract_url_from_link(link)
    token = extract_token_from_link(link)
    rewritten_url = apply_custom_domain(original_url, sandbox_id, port)
    return PreviewLinkInfo(url=rewritten_url, token=token, original_url=original_url)


def ensure_custom_domain_metadata(metadata: Optional[Dict[str, Any]]) -> Tuple[Dict[str, Any], bool]:
    """
    Ensure sandbox metadata includes the custom domain URLs when configured.

    Returns a tuple of (updated_metadata, changed_flag).
    """
    if not isinstance(metadata, dict):
        return {}, False

    sandbox_id = metadata.get('id')
    if not sandbox_id:
        return metadata, False

    updated = dict(metadata)
    changed = False

    custom_web = build_custom_domain_url(sandbox_id, 8080)
    custom_vnc = build_custom_domain_url(sandbox_id, 6080)

    if custom_web and updated.get('sandbox_url') != custom_web:
        updated['sandbox_url'] = custom_web
        changed = True

    if custom_vnc and updated.get('vnc_preview') != custom_vnc:
        updated['vnc_preview'] = custom_vnc
        changed = True

    return updated, changed
