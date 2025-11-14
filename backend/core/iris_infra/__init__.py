"""
Iris Infrastructure Module

Provides core infrastructure for context management, artifact storage,
and sandbox file system operations for the Iris agentic AI system.
"""

from core.iris_infra.sandbox_fs import IrisSandboxFS
from core.iris_infra.sandbox_init import ensure_iris_structure, IRIS_ROOT
from core.iris_infra.context_builder import IrisContextBuilder
from core.iris_infra.artifact_store import ArtifactStore
from core.iris_infra.runtime_state import RuntimeState

__all__ = [
    'IrisSandboxFS',
    'ensure_iris_structure',
    'IRIS_ROOT',
    'IrisContextBuilder',
    'ArtifactStore',
    'RuntimeState',
]
