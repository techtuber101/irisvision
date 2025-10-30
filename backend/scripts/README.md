# Backend Scripts

This directory contains utility scripts for backend operations.

## Auto-Update Scripts

### `update_default_agents.py`

Automatically updates all default Iris agents with the latest configuration from `IRIS_CONFIG`.

**What it does:**
- Ensures agent names remain set to "Iris"
- Updates agent descriptions to match the current configuration
- Migrates metadata from the legacy default flag to `is_iris_default`
- Updates agent versions with the latest system prompt and tools
- Preserves user-managed MCP configurations

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
- **Backward Compatible**: Safely handles both old (Iris) and new (Iris) metadata
- **User Data Preserved**: Custom MCPs, triggers, and user configurations are retained

## SQL Migration Scripts

### `update_agent_prompts.sql`
Clears stored system prompts for default agents, forcing them to use the latest prompt from the backend code.

**Purpose:** Ensures backend picks up the latest prompt from `backend/core/prompts/prompt.py`

**What it does:**
- Clears `agent_versions.config->>'system_prompt'` for default agents
- Clears `agents.config->>'system_prompt'` for default agents  
- Clears legacy `agents.system_prompt` for default agents
- Safe for mixed schemas with existence guards

### `update_agent_prompts_generated.sql`
Updates all agents with the latest system prompt from the backend.

**Purpose:** Bulk update script generated from `backend/core/prompts/prompt.py`

**What it does:**
- Updates all agents to use current system prompt
- Updates both `config` JSONB field and legacy `system_prompt` field
- Contains the full Iris system prompt (5,000+ lines)

### `update_default_iris_prompts.sql`
Synchronizes default agent prompts with backend's SYSTEM_PROMPT.

**Purpose:** Update stored prompts for default agents across supported schemas

**What it does:**
- Updates default agents to match backend prompt value
- Safe for mixed schemas with table/column existence guards
- Contains the full Iris system prompt (1,400+ lines)

### `update_default_agent_prompts.sql`
Legacy script for updating default agent prompts.

**Purpose:** Historical script for agent prompt updates

## Configuration

The default agent configuration is defined in:
```
backend/core/iris_config.py
```

To update the default agent setup, modify `IRIS_CONFIG` in that file. Changes will be applied on next container restart.

## Usage

**Automatic Updates:**
- Scripts run automatically via `update_default_agents.py` on container startup
- No manual intervention needed for normal operations

**Manual SQL Execution:**
```bash
# Connect to your Supabase database and run:
psql -f backend/scripts/update_agent_prompts.sql
psql -f backend/scripts/update_agent_prompts_generated.sql
psql -f backend/scripts/update_default_iris_prompts.sql
```

**Manual Python Script:**
```bash
cd backend
uv run python scripts/update_default_agents.py
```

