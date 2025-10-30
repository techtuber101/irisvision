"""
Iris SDK for Iris AI Worker Platform

A Python SDK for creating and managing AI Workers with thread execution capabilities.
"""

__version__ = "0.1.0"

from .iris.iris import Iris
from .iris.tools import AgentPressTools, MCPTools

__all__ = ["Iris", "AgentPressTools", "MCPTools"]
