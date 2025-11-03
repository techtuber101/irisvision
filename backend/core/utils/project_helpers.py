"""Project-related helper functions."""
import json
import re
import traceback
from typing import Dict, Optional
from core.services.supabase import DBConnection
from core.services.llm import make_llm_api_call
from .logger import logger
from .icon_generator import RELEVANT_ICONS


class TitleGenerationError(Exception):
    """Raised when project title generation fails."""


def _parse_llm_structured_output(raw_content: str):
    """
    Attempt to parse structured JSON output from an LLM response.
    Handles code fences and stray text around the JSON payload.
    """
    if not raw_content:
        return None

    cleaned = raw_content.strip()

    # Handle fenced code blocks like ```json ... ```
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    # First attempt direct JSON parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Attempt to extract the first JSON object within the text
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if match:
        json_candidate = match.group(0)
        try:
            return json.loads(json_candidate)
        except json.JSONDecodeError:
            logger.debug(f"Failed to parse JSON candidate from LLM output: {json_candidate}")

    return None


def _extract_title_and_icon(parsed_response: Dict[str, str], available_icons) -> Dict[str, str]:
    """
    Validate and extract the title/icon pair from a parsed LLM response.
    Raises TitleGenerationError when the payload is unusable.
    """
    if not isinstance(parsed_response, dict):
        raise TitleGenerationError("LLM response must be a JSON object.")

    raw_title = parsed_response.get("title", "")
    title = str(raw_title).strip('\'" \n\t')
    if not title:
        raise TitleGenerationError("LLM response missing required 'title' field.")

    raw_icon = parsed_response.get("icon", "")
    icon = str(raw_icon).strip('\'" \n\t')
    if not icon:
        raise TitleGenerationError("LLM response missing required 'icon' field.")

    if icon not in available_icons:
        raise TitleGenerationError(f"Icon '{icon}' is not in the approved icon list.")

    return {"title": title, "icon": icon}


async def generate_and_update_project_name(project_id: str, prompt: str) -> Dict[str, str]:
    """
    Generates a project name and icon using an LLM and updates the database.
    
    This is typically run as a background task after project creation.
    
    Args:
        project_id: The project ID to update
        prompt: The initial user prompt to base the name/icon on
    """
    logger.debug(f"Starting project title generation for project: {project_id}")
    
    try:
        db_conn = DBConnection()
        client = await db_conn.client

        model_name = "gemini/gemini-2.5-flash"
        
        # Use pre-loaded Lucide React icons
        relevant_icons = RELEVANT_ICONS
        system_prompt = f"""You are a helpful assistant that generates extremely concise titles (2-4 words maximum) and selects appropriate icons for chat threads based on the user's message.

        Available Lucide React icons to choose from:
        {', '.join(relevant_icons)}

        Respond with a JSON object containing:
        - "title": A concise 2-4 word title for the thread
        - "icon": The most appropriate icon name from the list above

        Example response:
        {{"title": "Code Review Help", "icon": "code"}}"""

        user_message = f"Generate an extremely brief title (2-4 words only) and select the most appropriate icon for a chat thread that starts with this message: \"{prompt}\""
        messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_message}]

        logger.debug(f"Calling LLM ({model_name}) for project {project_id} naming and icon selection.")
        try:
            response = await make_llm_api_call(
                messages=messages,
                model_name=model_name,
                max_tokens=1000,
                temperature=0.7,
                response_format={"type": "json_object"},
                stream=False
            )
        except Exception as llm_error:
            raise TitleGenerationError(f"LLM call failed: {llm_error}") from llm_error

        if not response:
            raise TitleGenerationError("LLM call returned an empty response.")

        choices = response.get("choices") or []
        if not choices:
            raise TitleGenerationError("LLM response did not include any choices.")

        message_payload: Optional[Dict[str, str]] = choices[0].get("message")
        if not message_payload:
            raise TitleGenerationError("LLM response missing message payload.")

        raw_content = (message_payload.get("content") or "").strip()
        if not raw_content:
            raise TitleGenerationError("LLM response contained no content.")

        parsed_response = _parse_llm_structured_output(raw_content)
        if parsed_response is None:
            raise TitleGenerationError("Unable to parse JSON payload from LLM response.")

        extracted = _extract_title_and_icon(parsed_response, relevant_icons)
        logger.debug(
            f"LLM generated payload for project {project_id}: title='{extracted['title']}' icon='{extracted['icon']}'"
        )

        update_data = {"name": extracted["title"], "icon_name": extracted["icon"]}

        try:
            update_result = await client.table('projects').update(update_data).eq("project_id", project_id).execute()
        except Exception as db_error:
            raise TitleGenerationError(f"Failed to update project record: {db_error}") from db_error

        if not getattr(update_result, "data", None):
            raise TitleGenerationError("Database update did not return any rows.")

        logger.debug(f"Successfully updated project {project_id} with generated title and icon.")
        return extracted

    except TitleGenerationError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during title generation for project {project_id}: {str(e)}\n{traceback.format_exc()}")
        raise TitleGenerationError("Unexpected error during title generation.") from e
