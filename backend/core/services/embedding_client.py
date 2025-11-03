# NEW
"""
Embedding Client: Unified interface for text embeddings.

Supports Gemini and local sentence-transformers models with automatic fallback.
Includes backoff, circuit breaker, and normalization.
"""

import os
import asyncio
import numpy as np
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import time

import litellm
from core.utils.logger import logger
from core.utils.config import config


class EmbeddingClient:
    """
    Unified embedding client with provider support and fallback.
    """
    
    def __init__(
        self,
        provider: str = "gemini",
        model: Optional[str] = None,
        timeout_ms: int = 8000,
        circuit_breaker_failures: int = 5,
        circuit_breaker_window_seconds: int = 60
    ):
        self.provider = provider.lower()
        self.model = model or self._get_default_model(provider)
        self.timeout_ms = timeout_ms
        self.timeout_seconds = timeout_ms / 1000.0
        
        # Circuit breaker state
        self.circuit_breaker_failures = circuit_breaker_failures
        self.circuit_breaker_window = circuit_breaker_window_seconds
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.circuit_open = False
        
        # Local model cache (sentence-transformers)
        self._local_model: Optional[Any] = None
        default_local_model = self._get_default_model("local")
        self._local_model_name: str = (
            model if provider.lower() == "local" and model else default_local_model
        )
        
        # Provider availability tracking
        self._gemini_available: Optional[bool] = None
        self._local_available: Optional[bool] = None
        self._gemini_notice_logged = False
        self._local_notice_logged = False
        self._providers_disabled_logged = False
        self._target_dimension: Optional[int] = None
    
    def _get_default_model(self, provider: str) -> str:
        """Get default model for provider."""
        defaults = {
            "gemini": "models/text-embedding-004",
            "local": "all-MiniLM-L6-v2"  # sentence-transformers
        }
        return defaults.get(provider.lower(), defaults["gemini"])
    
    def _normalize_embedding(self, embedding: List[float]) -> List[float]:
        """Normalize embedding to unit length."""
        arr = np.array(embedding, dtype=np.float32)
        norm = np.linalg.norm(arr)
        if norm == 0:
            return embedding
        normalized = (arr / norm).tolist()
        return normalized

    def _finalize_embedding(self, embedding: List[float]) -> List[float]:
        """Normalize and align embedding dimensions consistently."""
        normalized = self._normalize_embedding(embedding)
        current_dim = len(normalized)
        if self._target_dimension is None:
            self._target_dimension = current_dim
            return normalized
        if current_dim == self._target_dimension:
            return normalized
        if current_dim > self._target_dimension:
            logger.warning(
                "Embedding dimension %d exceeds target %d; truncating",
                current_dim,
                self._target_dimension,
            )
            return normalized[: self._target_dimension]
        logger.warning(
            "Embedding dimension %d below target %d; padding with zeros",
            current_dim,
            self._target_dimension,
        )
        padded = normalized + [0.0] * (self._target_dimension - current_dim)
        return padded
    
    def _check_circuit_breaker(self) -> bool:
        """Check if circuit breaker allows request."""
        if not self.circuit_open:
            return True
        
        # Reset if window expired
        if self.last_failure_time and (time.time() - self.last_failure_time) > self.circuit_breaker_window:
            logger.info(f"Circuit breaker reset for {self.provider}")
            self.circuit_open = False
            self.failure_count = 0
            return True
        
        return False
    
    def _record_failure(self):
        """Record failure for circuit breaker."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.circuit_breaker_failures:
            self.circuit_open = True
            logger.warning(
                f"Circuit breaker opened for {self.provider} "
                f"after {self.failure_count} failures"
            )
    
    def _record_success(self):
        """Record success for circuit breaker."""
        self.failure_count = 0
        if self.circuit_open:
            self.circuit_open = False
            logger.info(f"Circuit breaker closed for {self.provider}")

    def _prepare_text_for_embedding(self, text: str, provider: str) -> str:
        """
        Normalize and truncate embedding text for provider limits.
        
        Gemini enforces a ~36KB payload cap. We keep a safety buffer to avoid hard 400s.
        """
        cleaned = (text or "").strip()
        if not cleaned:
            return ""
        
        if provider == "gemini":
            max_bytes = 32000  # ~32KB to leave headroom below Gemini's 36KB limit
            raw_bytes = cleaned.encode("utf-8")
            if len(raw_bytes) <= max_bytes:
                return cleaned
            
            truncated = raw_bytes[: max_bytes - 3]  # reserve space for ellipsis
            # Ensure we do not cut inside a multibyte character
            while truncated and (truncated[-1] & 0xC0) == 0x80:
                truncated = truncated[:-1]
            
            truncated_text = truncated.decode("utf-8", errors="ignore") + "..."
            logger.warning(
                "Gemini embedding payload truncated from %d to %d bytes",
                len(raw_bytes),
                len(truncated),
            )
            return truncated_text
        
        return cleaned
    
    async def _embed_gemini(self, text: str) -> Optional[List[float]]:
        """Embed using Gemini API."""
        if self._gemini_available is False:
            return None
        
        try:
            import google.generativeai as genai
        except ImportError as exc:
            logger.warning(f"Gemini client not installed: {exc}")
            self._gemini_available = False
            return None
        
        if not config.GEMINI_API_KEY:
            if not self._gemini_notice_logged:
                logger.info("Gemini embeddings disabled: GEMINI_API_KEY not configured")
                self._gemini_notice_logged = True
            self._gemini_available = False
            return None
        
        prepared_text = self._prepare_text_for_embedding(text, "gemini")
        if not prepared_text:
            logger.debug("Skipping Gemini embedding: empty text after sanitization")
            return None
        
        try:
            genai.configure(api_key=config.GEMINI_API_KEY)
            
            # Run synchronous genai.embed_content in executor since it's not async
            # Use asyncio.to_thread if available (Python 3.9+), otherwise fall back to run_in_executor
            def embed_call():
                return genai.embed_content(model=self.model, content=prepared_text)
            
            try:
                # Python 3.9+ preferred method
                response = await asyncio.wait_for(
                    asyncio.to_thread(embed_call),
                    timeout=self.timeout_seconds
                )
            except AttributeError:
                # Fallback for older Python versions
                loop = asyncio.get_event_loop()
                response = await asyncio.wait_for(
                    loop.run_in_executor(None, embed_call),
                    timeout=self.timeout_seconds
                )
            
            if response and response.get('embedding'):
                embedding = response['embedding']
                self._gemini_available = True
                return self._finalize_embedding(embedding)
        
        except asyncio.TimeoutError:
            logger.warning(f"Embedding timeout for {self.provider}/{self.model}")
        except Exception as e:
            logger.warning(f"Gemini embedding failed: {e}")
        
        return None
    
    async def _embed_local(self, text: str) -> Optional[List[float]]:
        """Embed using local sentence-transformers model (optional fallback)."""
        if self._local_available is False:
            return None
        
        try:
            # Import check - sentence-transformers is optional
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError:
                if not self._local_notice_logged:
                    logger.debug(
                        "sentence-transformers not available. "
                        "Local embedding fallback disabled. "
                        "(Optional: install manually if needed, but may not work on all platforms)"
                    )
                    self._local_notice_logged = True
                self._local_available = False
                return None
            
            # Lazy load local model
            if self._local_model is None:
                try:
                    self._local_model = SentenceTransformer(self._local_model_name)
                    logger.info(f"Loaded local embedding model: {self._local_model_name}")
                except Exception as e:
                    logger.warning(f"Failed to load local model {self._local_model_name}: {e}")
                    self._local_available = False
                    return None
            
            # Generate embedding
            embedding = self._local_model.encode(text, normalize_embeddings=True)
            self._local_available = True
            return self._finalize_embedding(embedding.tolist())
        
        except Exception as e:
            logger.warning(f"Local embedding failed: {e}")
            self._local_available = False
            return None
    
    async def embed_text(self, text: str) -> Optional[List[float]]:
        """
        Embed single text with backoff and fallback.
        
        Returns normalized embedding or None if all providers fail.
        """
        if not text or not text.strip():
            return None
        
        providers_tried: List[str] = []
        embedding: Optional[List[float]] = None
        attempted_primary = False
        
        if self.provider == "gemini":
            if self._gemini_available is not False and self._check_circuit_breaker():
                attempted_primary = True
                providers_tried.append("gemini")
                embedding = await self._embed_gemini(text)
                if embedding:
                    self._record_success()
                    return embedding
                self._record_failure()
        elif self.provider == "local":
            if self._check_circuit_breaker():
                attempted_primary = True
                providers_tried.append("local")
                embedding = await self._embed_local(text)
                if embedding:
                    self._record_success()
                    return embedding
                self._record_failure()
        
        fallback_embedding: Optional[List[float]] = None
        if self.provider == "gemini" and self._local_available is not False:
            providers_tried.append("local")
            logger.info("Gemini embedding failed, falling back to local embedding model")
            fallback_embedding = await self._embed_local(text)
        elif self.provider == "local" and self._gemini_available is not False:
            providers_tried.append("gemini")
            logger.info("Local embedding failed, falling back to Gemini")
            fallback_embedding = await self._embed_gemini(text)
        
        if fallback_embedding:
            return fallback_embedding
        
        if providers_tried:
            logger.warning(
                "Embedding request skipped after providers failed: %s",
                ", ".join(dict.fromkeys(providers_tried))
            )
        elif not attempted_primary and not self._providers_disabled_logged:
            logger.info(
                "No embedding providers available; semantic caching disabled for this process"
            )
            self._providers_disabled_logged = True
        
        return None
    
    async def embed_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """
        Embed batch of texts (more efficient for local model).
        
        Returns list of embeddings (some may be None on failure).
        """
        if not texts:
            return []
        
        # Batch processing for local model
        if self.provider == "local" or self.provider != "local":
            try:
                if self._local_model is None:
                    try:
                        from sentence_transformers import SentenceTransformer
                        self._local_model = SentenceTransformer(self._local_model_name)
                    except ImportError:
                        pass
                
                if self._local_model:
                    embeddings = self._local_model.encode(
                        texts,
                        normalize_embeddings=True,
                        show_progress_bar=False
                    )
                    finalized: List[List[float]] = []
                    for emb in embeddings:
                        finalized.append(self._finalize_embedding(emb.tolist()))
                    return finalized
            except Exception as e:
                logger.warning(f"Batch local embedding failed: {e}")
        
        # Fallback to sequential for remote providers
        results = []
        for text in texts:
            embedding = await self.embed_text(text)
            results.append(embedding)
        
        return results


# Global embedding client instance
_embedding_client: Optional[EmbeddingClient] = None


def get_embedding_client() -> EmbeddingClient:
    """Get global embedding client instance."""
    global _embedding_client
    
    if _embedding_client is None:
        # Default to Gemini instead of OpenAI
        provider = os.getenv("EMBEDDINGS_PROVIDER", "gemini").lower()
        # Validate provider - only allow gemini or local
        if provider not in ["gemini", "local"]:
            logger.warning(f"Invalid embedding provider '{provider}', defaulting to 'gemini'")
            provider = "gemini"
        
        model = os.getenv("EMBEDDINGS_MODEL") or None
        timeout_ms = int(os.getenv("EMBEDDINGS_TIMEOUT_MS", "8000"))
        
        _embedding_client = EmbeddingClient(
            provider=provider,
            model=model,
            timeout_ms=timeout_ms
        )
        
        logger.info(
            f"Initialized embedding client: provider={provider}, "
            f"model={_embedding_client.model}, timeout={timeout_ms}ms"
        )
    
    return _embedding_client
