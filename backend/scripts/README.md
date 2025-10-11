# Backend Scripts

This directory contains utility scripts for backend operations.

## Auto-Update Scripts

### `update_default_agents.py`

Automatically updates all default Iris agents with the latest configuration from `SUNA_CONFIG`.

**What it does:**
- Updates agent names from "Suna" → "Iris" if needed
- Updates agent descriptions to match current config
- Migrates metadata from `is_suna_default` → `is_iris_default`
- Updates agent versions with latest system prompt and tools
- Preserves user's custom MCP configurations

**When it runs:**
- Automatically on every docker compose startup via `startup.sh`
- Can be run manually: `uv run python scripts/update_default_agents.py`

### `startup.sh`

Container startup script that:
1. Runs `update_default_agents.py` to refresh all default agents
2. Starts the Gunicorn application server

**Usage:**
This script is automatically executed when the Docker container starts. No manual intervention needed.

## Benefits

- **Always Fresh**: Default agents automatically get the latest names, prompts, and configuration
- **Zero Downtime**: Updates happen during startup before the app accepts requests
- **Backward Compatible**: Safely handles both old (Suna) and new (Iris) metadata
- **User Data Preserved**: Custom MCPs, triggers, and user configurations are retained

## Configuration

The default agent configuration is defined in:
```
backend/core/suna_config.py
```

To update the default agent setup, modify `SUNA_CONFIG` in that file. Changes will be applied on next container restart.


