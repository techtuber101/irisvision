import pytest

from core.utils.project_helpers import (
    _parse_llm_structured_output,
    _extract_title_and_icon,
    TitleGenerationError,
)


def test_parse_llm_structured_output_with_json_object():
    payload = '{"title": "Debug Tools", "icon": "tool"}'

    result = _parse_llm_structured_output(payload)

    assert result == {"title": "Debug Tools", "icon": "tool"}


def test_parse_llm_structured_output_with_code_fence_and_extra_text():
    payload = """Here you go:
```json
{
  "title": "Build Pipeline",
  "icon": "workflow"
}
```"""

    result = _parse_llm_structured_output(payload)

    assert result == {"title": "Build Pipeline", "icon": "workflow"}


def test_parse_llm_structured_output_returns_none_for_invalid_json():
    payload = "Not a JSON payload"

    result = _parse_llm_structured_output(payload)

    assert result is None


def test_extract_title_and_icon_returns_payload():
    parsed = {"title": "Quick Summary", "icon": "book"}
    available_icons = {"book", "bot"}

    result = _extract_title_and_icon(parsed, available_icons)

    assert result == {"title": "Quick Summary", "icon": "book"}


def test_extract_title_and_icon_raises_when_missing_title():
    parsed = {"icon": "book"}
    available_icons = {"book"}

    with pytest.raises(TitleGenerationError):
        _extract_title_and_icon(parsed, available_icons)


def test_extract_title_and_icon_raises_when_icon_invalid():
    parsed = {"title": "Quick Summary", "icon": "invalid-icon"}
    available_icons = {"book"}

    with pytest.raises(TitleGenerationError):
        _extract_title_and_icon(parsed, available_icons)
