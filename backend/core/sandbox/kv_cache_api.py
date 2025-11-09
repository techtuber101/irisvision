"""
REST API endpoints for KV Cache management.

Exposes cache browsing, statistics, and management operations
through HTTP endpoints for admin and debugging purposes.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from core.sandbox.sandbox import get_or_start_sandbox
from core.sandbox.kv_store import SandboxKVStore, KVKeyError
from core.sandbox.instruction_seeder import seed_instructions_to_cache
from core.utils.logger import logger
from core.utils.auth_utils import verify_and_get_user_id_from_jwt, verify_sandbox_access
from core.services.supabase import DBConnection


router = APIRouter(prefix="/api/sandboxes", tags=["kv-cache"])
db = None


def initialize(_db: DBConnection):
    """Initialize the KV cache API with database connection."""
    global db
    db = _db
    logger.debug("Initialized KV cache API with database connection")


class PutValueRequest(BaseModel):
    scope: str
    key: str
    value: Any
    ttl_hours: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class GetValueRequest(BaseModel):
    scope: str
    key: str


@router.get("/{sandbox_id}/kv-cache/stats")
async def get_cache_stats(
    sandbox_id: str,
    scope: Optional[str] = None,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Get statistics about KV cache usage."""
    try:
        client = await db.client
        await verify_sandbox_access(client, sandbox_id, user_id)
        
        sandbox = await get_or_start_sandbox(sandbox_id)
        kv_store = SandboxKVStore(sandbox)
        
        stats = await kv_store.get_stats(scope=scope)
        
        return {
            "success": True,
            "sandbox_id": sandbox_id,
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Error getting KV cache stats for sandbox {sandbox_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{sandbox_id}/kv-cache/keys")
async def list_cache_keys(
    sandbox_id: str,
    scope: str,
    pattern: Optional[str] = None,
    include_expired: bool = False,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """List all keys in a cache scope."""
    try:
        client = await db.client
        await verify_sandbox_access(client, sandbox_id, user_id)
        
        sandbox = await get_or_start_sandbox(sandbox_id)
        kv_store = SandboxKVStore(sandbox)
        
        keys = await kv_store.list_keys(
            scope=scope,
            pattern=pattern,
            include_expired=include_expired
        )
        
        return {
            "success": True,
            "sandbox_id": sandbox_id,
            "scope": scope,
            "count": len(keys),
            "keys": keys
        }
    except Exception as e:
        logger.error(f"Error listing KV cache keys for sandbox {sandbox_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{sandbox_id}/kv-cache/value")
async def get_cache_value(
    sandbox_id: str,
    scope: str,
    key: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Get a value from the KV cache."""
    try:
        client = await db.client
        await verify_sandbox_access(client, sandbox_id, user_id)
        
        sandbox = await get_or_start_sandbox(sandbox_id)
        kv_store = SandboxKVStore(sandbox)
        
        value = await kv_store.get(scope=scope, key=key, as_type="auto")
        metadata = await kv_store.get_metadata(scope=scope, key=key)
        
        return {
            "success": True,
            "sandbox_id": sandbox_id,
            "scope": scope,
            "key": key,
            "value": value,
            "metadata": metadata
        }
    except KVKeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting KV cache value for sandbox {sandbox_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{sandbox_id}/kv-cache/value")
async def put_cache_value(
    sandbox_id: str,
    request: PutValueRequest,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Store a value in the KV cache."""
    try:
        client = await db.client
        await verify_sandbox_access(client, sandbox_id, user_id)
        
        sandbox = await get_or_start_sandbox(sandbox_id)
        kv_store = SandboxKVStore(sandbox)
        
        path = await kv_store.put(
            scope=request.scope,
            key=request.key,
            value=request.value,
            ttl_hours=request.ttl_hours,
            metadata=request.metadata
        )
        
        return {
            "success": True,
            "sandbox_id": sandbox_id,
            "scope": request.scope,
            "key": request.key,
            "path": path
        }
    except Exception as e:
        logger.error(f"Error putting KV cache value for sandbox {sandbox_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{sandbox_id}/kv-cache/value")
async def delete_cache_value(
    sandbox_id: str,
    scope: str,
    key: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Delete a value from the KV cache."""
    try:
        client = await db.client
        await verify_sandbox_access(client, sandbox_id, user_id)
        
        sandbox = await get_or_start_sandbox(sandbox_id)
        kv_store = SandboxKVStore(sandbox)
        
        deleted = await kv_store.delete(scope=scope, key=key)
        
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Key '{key}' not found in scope '{scope}'")
        
        return {
            "success": True,
            "sandbox_id": sandbox_id,
            "scope": scope,
            "key": key,
            "deleted": True
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting KV cache value for sandbox {sandbox_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{sandbox_id}/kv-cache/prune")
async def prune_cache(
    sandbox_id: str,
    scope: Optional[str] = None,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Remove expired entries from the cache."""
    try:
        client = await db.client
        await verify_sandbox_access(client, sandbox_id, user_id)
        
        sandbox = await get_or_start_sandbox(sandbox_id)
        kv_store = SandboxKVStore(sandbox)
        
        results = await kv_store.prune_expired(scope=scope)
        total_pruned = sum(v for v in results.values() if v >= 0)
        
        return {
            "success": True,
            "sandbox_id": sandbox_id,
            "total_pruned": total_pruned,
            "results": results
        }
    except Exception as e:
        logger.error(f"Error pruning KV cache for sandbox {sandbox_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{sandbox_id}/kv-cache/seed-instructions")
async def seed_instructions(
    sandbox_id: str,
    force_refresh: bool = False,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Seed instruction files into the KV cache."""
    try:
        client = await db.client
        await verify_sandbox_access(client, sandbox_id, user_id)
        
        sandbox = await get_or_start_sandbox(sandbox_id)
        results = await seed_instructions_to_cache(sandbox, force_refresh=force_refresh)
        
        seeded_count = sum(1 for v in results.values() if v)
        
        return {
            "success": True,
            "sandbox_id": sandbox_id,
            "seeded_count": seeded_count,
            "total_instructions": len(results),
            "results": results
        }
    except Exception as e:
        logger.error(f"Error seeding instructions for sandbox {sandbox_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{sandbox_id}/kv-cache/clear-scope")
async def clear_scope(
    sandbox_id: str,
    scope: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Clear all entries from a specific scope."""
    try:
        client = await db.client
        await verify_sandbox_access(client, sandbox_id, user_id)
        
        sandbox = await get_or_start_sandbox(sandbox_id)
        kv_store = SandboxKVStore(sandbox)
        
        deleted_count = await kv_store.clear_scope(scope=scope)
        
        return {
            "success": True,
            "sandbox_id": sandbox_id,
            "scope": scope,
            "deleted_count": deleted_count
        }
    except Exception as e:
        logger.error(f"Error clearing KV cache scope for sandbox {sandbox_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
