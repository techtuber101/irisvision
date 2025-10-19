"""
LLM API interface for making calls to various language models.

This module provides a unified interface for making API calls to different LLM providers
using LiteLLM with simplified error handling and clean parameter management.
"""

from typing import Union, Dict, Any, Optional, AsyncGenerator, List, Set
import os
import asyncio
import litellm
from litellm.router import Router
from litellm.files.main import ModelResponse
from core.utils.logger import logger
from core.utils.config import config
from core.agentpress.error_processor import ErrorProcessor

# Configure LiteLLM
# os.environ['LITELLM_LOG'] = 'DEBUG'
# litellm.set_verbose = True  # Enable verbose logging
litellm.modify_params = True
litellm.drop_params = True

# Enable additional debug logging
# import logging
# litellm_logger = logging.getLogger("LiteLLM")
# litellm_logger.setLevel(logging.DEBUG)

# Constants
MAX_RETRIES = 3
BASE_BACKOFF_SECONDS = 1.0
MAX_BACKOFF_SECONDS = 8.0
provider_router = None
MODEL_FALLBACKS = {
    "gemini/gemini-2.0-flash": [
        "gemini/gemini-2.5-flash",
        "gemini/gemini-2.5-flash-lite",
        "gemini/gemini-2.5-pro",
    ],
    "gemini/gemini-2.5-flash-lite": [
        "gemini/gemini-2.5-pro",
    ],
    "openai/gpt-5-nano": [
        "openai/gpt-5-mini",
    ],
}


class LLMError(Exception):
    """Exception for LLM-related errors."""
    pass

def setup_api_keys() -> None:
    """Set up API keys from environment variables."""
    providers = [
        "OPENAI",
        "ANTHROPIC",
        "GROQ",
        "OPENROUTER",
        "XAI",
        "MORPH",
        "GEMINI",
        "OPENAI_COMPATIBLE",
    ]
    for provider in providers:
        key = getattr(config, f"{provider}_API_KEY")
        if key:
            # logger.debug(f"API key set for provider: {provider}")
            pass
        else:
            logger.warning(f"No API key found for provider: {provider}")

    # Set up OpenRouter API base if not already set
    if config.OPENROUTER_API_KEY and config.OPENROUTER_API_BASE:
        os.environ["OPENROUTER_API_BASE"] = config.OPENROUTER_API_BASE
        # logger.debug(f"Set OPENROUTER_API_BASE to {config.OPENROUTER_API_BASE}")


    # Set up AWS Bedrock bearer token authentication
    bedrock_token = config.AWS_BEARER_TOKEN_BEDROCK
    if bedrock_token:
        os.environ["AWS_BEARER_TOKEN_BEDROCK"] = bedrock_token
        logger.debug("AWS Bedrock bearer token configured")
    else:
        logger.warning("AWS_BEARER_TOKEN_BEDROCK not configured - Bedrock models will not be available")

def setup_provider_router(openai_compatible_api_key: str = None, openai_compatible_api_base: str = None):
    global provider_router
    model_list = [
        {
            "model_name": "openai-compatible/*", # support OpenAI-Compatible LLM provider
            "litellm_params": {
                "model": "openai/*",
                "api_key": openai_compatible_api_key or config.OPENAI_COMPATIBLE_API_KEY,
                "api_base": openai_compatible_api_base or config.OPENAI_COMPATIBLE_API_BASE,
            },
        },
        {
            "model_name": "*", # supported LLM provider by LiteLLM
            "litellm_params": {
                "model": "*",
            },
        },
    ]
    
    # Configure fallbacks: Bedrock models -> Direct Anthropic API
    fallbacks = []
    
    provider_router = Router(
        model_list=model_list,
        retry_after=15,
        fallbacks=fallbacks,
    )
    
    logger.info(f"Configured LiteLLM Router with {len(fallbacks)} fallback rules")

def _configure_openai_compatible(params: Dict[str, Any], model_name: str, api_key: Optional[str], api_base: Optional[str]) -> None:
    """Configure OpenAI-compatible provider setup."""
    if not model_name.startswith("openai-compatible/"):
        return
    
    # Check if have required config either from parameters or environment
    if (not api_key and not config.OPENAI_COMPATIBLE_API_KEY) or (
        not api_base and not config.OPENAI_COMPATIBLE_API_BASE
    ):
        raise LLMError(
            "OPENAI_COMPATIBLE_API_KEY and OPENAI_COMPATIBLE_API_BASE is required for openai-compatible models. If just updated the environment variables, wait a few minutes or restart the service to ensure they are loaded."
        )
    
    setup_provider_router(api_key, api_base)
    logger.debug(f"Configured OpenAI-compatible provider with custom API base")

def _add_tools_config(params: Dict[str, Any], tools: Optional[List[Dict[str, Any]]], tool_choice: str) -> None:
    """Add tools configuration to parameters."""
    if tools is None:
        return
    
    params.update({
        "tools": tools,
        "tool_choice": tool_choice
    })
    # logger.debug(f"Added {len(tools)} tools to API parameters")


async def make_llm_api_call(
    messages: List[Dict[str, Any]],
    model_name: str,
    response_format: Optional[Any] = None,
    temperature: float = 0,
    max_tokens: Optional[int] = None,
    tools: Optional[List[Dict[str, Any]]] = None,
    tool_choice: str = "auto",
    api_key: Optional[str] = None,
    api_base: Optional[str] = None,
    stream: bool = True,  # Always stream for better UX
    top_p: Optional[float] = None,
    model_id: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None,
    extra_headers: Optional[Dict[str, str]] = None,
) -> Union[Dict[str, Any], AsyncGenerator, ModelResponse]:
    """Make an API call to a language model using LiteLLM."""
    logger.info(f"Making LLM API call to model: {model_name} with {len(messages)} messages")
    
    # Prepare parameters using centralized model configuration
    from core.ai_models import model_manager
    resolved_model_name = model_manager.resolve_model_id(model_name)
    # logger.debug(f"Model resolution: '{model_name}' -> '{resolved_model_name}'")
    
    # Only pass headers/extra_headers if they are not None to avoid overriding model config
    override_params = {
        "messages": messages,
        "temperature": temperature,
        "response_format": response_format,
        "top_p": top_p,
        "stream": stream,
        "api_key": api_key,
        "api_base": api_base
    }
    
    # Only add headers if they are provided (not None)
    if headers is not None:
        override_params["headers"] = headers
    if extra_headers is not None:
        override_params["extra_headers"] = extra_headers
    
    def build_attempt_sequence(primary: str) -> List[str]:
        sequence: List[str] = []
        queue: List[str] = [primary]
        seen: Set[str] = set()
        
        while queue:
            current = queue.pop(0)
            if current in seen:
                continue
            seen.add(current)
            sequence.append(current)
            for fallback_model in MODEL_FALLBACKS.get(current, []):
                if fallback_model not in seen:
                    queue.append(fallback_model)
        return sequence
    
    def build_params_for_model(candidate: str) -> Dict[str, Any]:
        params = model_manager.get_litellm_params(candidate, **override_params)
        if model_id:
            params["model_id"] = model_id
        if stream:
            params["stream_options"] = {"include_usage": True}
        _configure_openai_compatible(params, candidate, api_key, api_base)
        _add_tools_config(params, tools, tool_choice)
        return params
    
    async def call_with_retries(candidate: str) -> Union[Dict[str, Any], AsyncGenerator, ModelResponse, None]:
        if provider_router is None:
            setup_provider_router()
        backoff = BASE_BACKOFF_SECONDS
        for attempt in range(1, MAX_RETRIES + 1):
            params = build_params_for_model(candidate)
            try:
                response = await provider_router.acompletion(**params)
                if hasattr(response, '__aiter__') and stream:
                    return _wrap_streaming_response(response)
                return response
            except Exception as exc:
                processed_error = ErrorProcessor.process_llm_error(exc, context={"model": candidate, "attempt": attempt})
                logger.warning(
                    f"LLM call failed for model '{candidate}' (attempt {attempt}/{MAX_RETRIES}): {processed_error.message}"
                )
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(min(backoff, MAX_BACKOFF_SECONDS))
                    backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
                    continue
                ErrorProcessor.log_error(processed_error)
                raise LLMError(processed_error.message) from exc
        return None
    
    attempt_sequence = build_attempt_sequence(resolved_model_name)
    errors: List[str] = []
    
    for candidate in attempt_sequence:
        logger.info(f"Attempting LLM call with model '{candidate}'")
        try:
            response = await call_with_retries(candidate)
            if response is not None:
                if candidate != resolved_model_name:
                    logger.info(f"LLM call succeeded using fallback model '{candidate}'")
                return response
        except LLMError as err:
            errors.append(f"{candidate}: {err}")
            if candidate == attempt_sequence[-1]:
                break
            logger.warning(f"Switching to fallback model after failure on '{candidate}'")
            continue
    
    aggregated_error = "; ".join(errors) if errors else f"All attempts failed for model '{resolved_model_name}'"
    raise LLMError(aggregated_error)

async def _wrap_streaming_response(response) -> AsyncGenerator:
    """Wrap streaming response to handle errors during iteration."""
    try:
        async for chunk in response:
            yield chunk
    except Exception as e:
        # Convert streaming errors to processed errors
        processed_error = ErrorProcessor.process_llm_error(e)
        ErrorProcessor.log_error(processed_error)
        raise LLMError(processed_error.message)

setup_api_keys()
setup_provider_router()


if __name__ == "__main__":
    from litellm import completion

    setup_api_keys()

    response = completion(
        model="gemini/gemini-2.0-flash",
        messages=[{"role": "user", "content": "Hello! Testing Iris Pro pipeline."}],
        max_tokens=100,
    )
