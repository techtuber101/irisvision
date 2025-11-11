import os
import json
import asyncio
import datetime
from typing import Optional, Dict, List, Any, AsyncGenerator
from dataclasses import dataclass

from core.tools.message_tool import MessageTool
from core.tools.sb_expose_tool import SandboxExposeTool
from core.tools.web_search_tool import SandboxWebSearchTool
from core.tools.image_search_tool import SandboxImageSearchTool
from dotenv import load_dotenv
from core.utils.config import config
from core.prompts.agent_builder_prompt import get_agent_builder_prompt
from core.agentpress.thread_manager import ThreadManager
from core.agentpress.response_processor import ProcessorConfig
from core.agentpress.error_processor import ErrorProcessor
from core.tools.sb_shell_tool import SandboxShellTool
from core.tools.sb_files_tool import SandboxFilesTool
from core.tools.sb_kb_tool import SandboxKbTool
from core.tools.data_providers_tool import DataProvidersTool
from core.tools.expand_msg_tool import ExpandMessageTool
from core.prompts.prompt import get_system_prompt as get_system_prompt_original
from core.prompts.prompt_kv_cache import get_system_prompt_kv_cache

from core.utils.logger import logger

from core.billing.billing_integration import billing_integration
from core.tools.sb_vision_tool import SandboxVisionTool
from core.tools.sb_image_edit_tool import SandboxImageEditTool
from core.tools.sb_designer_tool import SandboxDesignerTool
from core.tools.sb_presentation_tool import ProfessionalPresentationTool
from core.tools.sb_document_parser import SandboxDocumentParserTool

from core.services.langfuse import langfuse
from langfuse.client import StatefulTraceClient

from core.tools.mcp_tool_wrapper import MCPToolWrapper
from core.tools.task_list_tool import TaskListTool
from core.agentpress.tool import SchemaType
from core.tools.sb_upload_file_tool import SandboxUploadFileTool
from core.tools.sb_docs_tool import SandboxDocsTool
from core.tools.sb_kv_cache_tool import SandboxKvCacheTool
from core.tools.people_search_tool import PeopleSearchTool
from core.tools.company_search_tool import CompanySearchTool
from core.tools.paper_search_tool import PaperSearchTool
from core.ai_models.manager import model_manager
from core.agentpress.context_planner import get_project_context
from core.sandbox.instruction_seeder import (
    INSTRUCTION_FILES,
    get_all_instruction_references,
    seed_instructions_to_cache,
)
from core.sandbox.kv_store import SandboxKVStore
from core.sandbox.sandbox import get_or_start_sandbox

load_dotenv()


@dataclass
class AgentConfig:
    thread_id: str
    project_id: str
    native_max_auto_continues: int = 25
    max_iterations: int = 100
    model_name: str = "openai/gpt-5-mini"
    agent_config: Optional[dict] = None
    trace: Optional[StatefulTraceClient] = None
    fallback_model: str = "gemini/gemini-2.5-flash-lite"  # Model to use when error occurs
    fallback_triggered: bool = False  # Track if fallback has been triggered

class ToolManager:
    def __init__(self, thread_manager: ThreadManager, project_id: str, thread_id: str, agent_config: Optional[dict] = None):
        self.thread_manager = thread_manager
        self.project_id = project_id
        self.thread_id = thread_id
        self.agent_config = agent_config
        self.account_id = agent_config.get('account_id') if agent_config else None
    
    def register_all_tools(self, agent_id: Optional[str] = None, disabled_tools: Optional[List[str]] = None):
        """Register all tools with manual control and proper initialization.
        
        Args:
            agent_id: Optional agent ID for agent builder tools
            disabled_tools: List of tool names to exclude from registration
        """
        disabled_tools = disabled_tools or []
        
        # Core tools - always enabled
        self._register_core_tools()
        
        # Sandbox tools
        self._register_sandbox_tools(disabled_tools)
        
        # Data and utility tools
        self._register_utility_tools(disabled_tools)
        
        # Agent builder tools - register if agent_id provided
        if agent_id:
            self._register_agent_builder_tools(agent_id, disabled_tools)
        
        # Browser tool
        self._register_browser_tool(disabled_tools)
        
        # Iris-specific tools (agent creation)
        if self.account_id:
            self._register_iris_specific_tools(disabled_tools)
        
        logger.info(f"Tool registration complete. Registered {len(self.thread_manager.tool_registry.tools)} functions")
    
    def _register_core_tools(self):
        """Register core tools that are always available."""
        self.thread_manager.add_tool(ExpandMessageTool, thread_id=self.thread_id, thread_manager=self.thread_manager)
        self.thread_manager.add_tool(MessageTool)
        self.thread_manager.add_tool(TaskListTool, project_id=self.project_id, thread_manager=self.thread_manager, thread_id=self.thread_id)
    
    def _register_sandbox_tools(self, disabled_tools: List[str]):
        """Register sandbox-related tools with granular control."""
        sandbox_tools = [
            ('sb_kv_cache_tool', SandboxKvCacheTool, {'project_id': self.project_id, 'thread_manager': self.thread_manager}),
            ('sb_shell_tool', SandboxShellTool, {'project_id': self.project_id, 'thread_manager': self.thread_manager}),
            ('sb_files_tool', SandboxFilesTool, {'project_id': self.project_id, 'thread_manager': self.thread_manager}),
            ('sb_expose_tool', SandboxExposeTool, {'project_id': self.project_id, 'thread_manager': self.thread_manager}),
            ('web_search_tool', SandboxWebSearchTool, {'project_id': self.project_id, 'thread_manager': self.thread_manager}),
            ('image_search_tool', SandboxImageSearchTool, {'project_id': self.project_id, 'thread_manager': self.thread_manager}),
            ('sb_vision_tool', SandboxVisionTool, {'project_id': self.project_id, 'thread_id': self.thread_id, 'thread_manager': self.thread_manager}),
            ('sb_image_edit_tool', SandboxImageEditTool, {'project_id': self.project_id, 'thread_id': self.thread_id, 'thread_manager': self.thread_manager}),
            ('sb_kb_tool', SandboxKbTool, {'project_id': self.project_id, 'thread_manager': self.thread_manager}),
            ('sb_design_tool', SandboxDesignerTool, {'project_id': self.project_id, 'thread_id': self.thread_id, 'thread_manager': self.thread_manager}),
            ('sb_presentation_tool', ProfessionalPresentationTool, {'project_id': self.project_id, 'thread_manager': self.thread_manager}),
            ('sb_upload_file_tool', SandboxUploadFileTool, {'project_id': self.project_id, 'thread_manager': self.thread_manager}),
            ('sb_docs_tool', SandboxDocsTool, {'project_id': self.project_id, 'thread_manager': self.thread_manager}),
        ]
        
        for tool_name, tool_class, kwargs in sandbox_tools:
            if tool_name not in disabled_tools:
                enabled_methods = self._get_enabled_methods_for_tool(tool_name)
                self.thread_manager.add_tool(tool_class, function_names=enabled_methods, **kwargs)
                if enabled_methods:
                    logger.debug(f"✅ Registered {tool_name} with methods: {enabled_methods}")
    
    def _register_utility_tools(self, disabled_tools: List[str]):
        """Register utility tools with API key checks."""
        if config.RAPID_API_KEY and 'data_providers_tool' not in disabled_tools:
            enabled_methods = self._get_enabled_methods_for_tool('data_providers_tool')
            self.thread_manager.add_tool(DataProvidersTool, function_names=enabled_methods)
            if enabled_methods:
                logger.debug(f"✅ Registered data_providers_tool with methods: {enabled_methods}")
        
        # Register search tools if EXA API key is available
        if config.EXA_API_KEY:
            if 'people_search_tool' not in disabled_tools:
                enabled_methods = self._get_enabled_methods_for_tool('people_search_tool')
                self.thread_manager.add_tool(PeopleSearchTool, function_names=enabled_methods, thread_manager=self.thread_manager)
                if enabled_methods:
                    logger.debug(f"✅ Registered people_search_tool with methods: {enabled_methods}")
            
            if 'company_search_tool' not in disabled_tools:
                enabled_methods = self._get_enabled_methods_for_tool('company_search_tool')
                self.thread_manager.add_tool(CompanySearchTool, function_names=enabled_methods, thread_manager=self.thread_manager)
                if enabled_methods:
                    logger.debug(f"✅ Registered company_search_tool with methods: {enabled_methods}")
            
            if 'paper_search_tool' not in disabled_tools:
                enabled_methods = self._get_enabled_methods_for_tool('paper_search_tool')
                self.thread_manager.add_tool(PaperSearchTool, function_names=enabled_methods, thread_manager=self.thread_manager)
                if enabled_methods:
                    logger.debug(f"✅ Registered paper_search_tool with methods: {enabled_methods}")
    
    def _register_agent_builder_tools(self, agent_id: str, disabled_tools: List[str]):
        """Register agent builder tools with proper initialization."""
        from core.tools.agent_builder_tools.agent_config_tool import AgentConfigTool
        from core.tools.agent_builder_tools.mcp_search_tool import MCPSearchTool
        from core.tools.agent_builder_tools.credential_profile_tool import CredentialProfileTool
        from core.tools.agent_builder_tools.trigger_tool import TriggerTool
        from core.services.supabase import DBConnection
        
        db = DBConnection()
        
        agent_builder_tools = [
            ('agent_config_tool', AgentConfigTool),
            ('mcp_search_tool', MCPSearchTool),
            ('credential_profile_tool', CredentialProfileTool),
            ('trigger_tool', TriggerTool),
        ]

        for tool_name, tool_class in agent_builder_tools:
            if tool_name not in disabled_tools:
                try:
                    enabled_methods = self._get_enabled_methods_for_tool(tool_name)
                    self.thread_manager.add_tool(
                        tool_class, 
                        function_names=enabled_methods, 
                        thread_manager=self.thread_manager, 
                        db_connection=db, 
                        agent_id=agent_id
                    )
                    if enabled_methods:
                        logger.debug(f"✅ Registered {tool_name} with methods: {enabled_methods}")
                except Exception as e:
                    logger.warning(f"❌ Failed to register {tool_name}: {e}")
    
    def _register_iris_specific_tools(self, disabled_tools: List[str]):
        """Register Iris-specific tools like agent creation."""
        if 'agent_creation_tool' not in disabled_tools and self.account_id:
            from core.tools.agent_creation_tool import AgentCreationTool
            from core.services.supabase import DBConnection
            
            db = DBConnection()
            enabled_methods = self._get_enabled_methods_for_tool('agent_creation_tool')
            self.thread_manager.add_tool(
                AgentCreationTool, 
                function_names=enabled_methods, 
                thread_manager=self.thread_manager, 
                db_connection=db, 
                account_id=self.account_id
            )
            if enabled_methods:
                logger.debug(f"✅ Registered agent_creation_tool with methods: {enabled_methods}")
    
    def _register_browser_tool(self, disabled_tools: List[str]):
        """Register browser tool with sandbox access."""
        if 'browser_tool' not in disabled_tools:
            from core.tools.browser_tool import BrowserTool
            
            enabled_methods = self._get_enabled_methods_for_tool('browser_tool')
            self.thread_manager.add_tool(
                BrowserTool, 
                function_names=enabled_methods, 
                project_id=self.project_id, 
                thread_id=self.thread_id, 
                thread_manager=self.thread_manager
            )
            if enabled_methods:
                logger.debug(f"✅ Registered browser_tool with methods: {enabled_methods}")
    
    def _get_enabled_methods_for_tool(self, tool_name: str) -> Optional[List[str]]:
        if not self.agent_config or 'agentpress_tools' not in self.agent_config:
            return None
        
        from core.utils.tool_discovery import get_enabled_methods_for_tool
        from core.utils.tool_migration import migrate_legacy_tool_config
        
        raw_tools = self.agent_config['agentpress_tools']
        
        if not isinstance(raw_tools, dict):
            return None
        
        migrated_tools = migrate_legacy_tool_config(raw_tools)
        
        return get_enabled_methods_for_tool(tool_name, migrated_tools)

class MCPManager:
    def __init__(self, thread_manager: ThreadManager, account_id: str):
        self.thread_manager = thread_manager
        self.account_id = account_id
    
    async def register_mcp_tools(self, agent_config: dict) -> Optional[MCPToolWrapper]:
        all_mcps = []
        
        if agent_config.get('configured_mcps'):
            all_mcps.extend(agent_config['configured_mcps'])
        
        if agent_config.get('custom_mcps'):
            for custom_mcp in agent_config['custom_mcps']:
                custom_type = custom_mcp.get('customType', custom_mcp.get('type', 'sse'))
                
                if custom_type == 'composio':
                    qualified_name = custom_mcp.get('qualifiedName')
                    if not qualified_name:
                        qualified_name = f"composio.{custom_mcp['name'].replace(' ', '_').lower()}"
                    
                    mcp_config = {
                        'name': custom_mcp['name'],
                        'qualifiedName': qualified_name,
                        'config': custom_mcp.get('config', {}),
                        'enabledTools': custom_mcp.get('enabledTools', []),
                        'instructions': custom_mcp.get('instructions', ''),
                        'isCustom': True,
                        'customType': 'composio'
                    }
                    all_mcps.append(mcp_config)
                    continue
                
                mcp_config = {
                    'name': custom_mcp['name'],
                    'qualifiedName': f"custom_{custom_type}_{custom_mcp['name'].replace(' ', '_').lower()}",
                    'config': custom_mcp['config'],
                    'enabledTools': custom_mcp.get('enabledTools', []),
                    'instructions': custom_mcp.get('instructions', ''),
                    'isCustom': True,
                    'customType': custom_type
                }
                all_mcps.append(mcp_config)
        
        if not all_mcps:
            return None
        
        mcp_wrapper_instance = MCPToolWrapper(mcp_configs=all_mcps)
        try:
            await mcp_wrapper_instance.initialize_and_register_tools()
            
            updated_schemas = mcp_wrapper_instance.get_schemas()
            for method_name, schema_list in updated_schemas.items():
                for schema in schema_list:
                    self.thread_manager.tool_registry.tools[method_name] = {
                        "instance": mcp_wrapper_instance,
                        "schema": schema
                    }
            
            logger.info(f"⚡ Registered {len(updated_schemas)} MCP tools (Redis cache enabled)")
            return mcp_wrapper_instance
        except Exception as e:
            logger.error(f"Failed to initialize MCP tools: {e}")
            return None


class PromptManager:
    @staticmethod
    def _format_tools_for_xml(openapi_schemas: List[Dict[str, Any]]) -> str:
        """Format OpenAPI schemas into compact tool reference for XML mode.
        
        Args:
            openapi_schemas: List of OpenAPI schema dictionaries
            
        Returns:
            Formatted string with tool names, descriptions, and parameters
        """
        tool_docs = []
        
        for schema in openapi_schemas:
            func_info = schema.get('function', {})
            tool_name = func_info.get('name', 'unknown')
            description = func_info.get('description', 'No description')
            
            params = func_info.get('parameters', {})
            properties = params.get('properties', {})
            required = params.get('required', [])
            
            # Special handling for task tools - add extra detail
            is_task_tool = tool_name in ['create_tasks', 'update_tasks']
            
            # Build parameter list
            param_list = []
            for param_name, param_spec in properties.items():
                param_type = param_spec.get('type', 'string')
                param_desc = param_spec.get('description', '')
                is_required = param_name in required
                req_marker = " *REQUIRED*" if is_required else ""
                
                # Handle array/object types with special formatting for task tools
                if param_type == 'array':
                    items = param_spec.get('items', {})
                    item_type = items.get('type', 'string')
                    
                    # Special formatting for task tool arrays
                    if is_task_tool and param_name == 'sections':
                        param_list.append(f"  - {param_name} (array[object], JSON string){req_marker}: {param_desc}")
                        param_list.append(f"    FORMAT: [{{\"title\": \"Section Name\", \"task_contents\": [\"task1\", \"task2\"]}}]")
                    elif is_task_tool and param_name in ['task_contents', 'task_ids']:
                        param_list.append(f"  - {param_name} (array[{item_type}], JSON string){req_marker}: {param_desc}")
                        param_list.append(f"    FORMAT: [\"item1\", \"item2\", \"item3\"] as JSON string")
                    else:
                        param_list.append(f"  - {param_name} ({param_type}[{item_type}], JSON string){req_marker}: {param_desc}")
                elif param_type == 'object':
                    param_list.append(f"  - {param_name} (object/JSON string){req_marker}: {param_desc}")
                else:
                    param_list.append(f"  - {param_name} ({param_type}){req_marker}: {param_desc}")
            
            # Format tool entry with special note for task tools
            tool_entry = f"**{tool_name}**: {description}"
            if is_task_tool:
                tool_entry += "\n  ⚠️ CRITICAL: See section 5.1 in prompt for detailed usage examples!"
            if param_list:
                tool_entry += "\n" + "\n".join(param_list)
            
            tool_docs.append(tool_entry)
        
        return "\n\n".join(tool_docs)
    
    @staticmethod
    def _detect_task_type(user_message: Optional[str]) -> Optional[str]:
        """Detect task type from user message for automatic instruction loading.
        
        Args:
            user_message: User's message content
            
        Returns:
            Instruction tag (presentation, document_creation, research, web_development, visualization) or None
        """
        if not user_message:
            return None
        
        message_lower = user_message.lower()
        
        # Presentation detection
        presentation_keywords = ['presentation', 'slide', 'slides', 'deck', 'powerpoint', 'ppt', 'keynote', 'pitch deck']
        if any(keyword in message_lower for keyword in presentation_keywords):
            return 'presentation'
        
        # Document creation detection
        document_keywords = ['document', 'report', 'pdf', 'create document', 'write document', 'generate document', 'comprehensive document']
        if any(keyword in message_lower for keyword in document_keywords):
            return 'document_creation'
        
        # Research detection
        research_keywords = ['research', 'analyze', 'analysis', 'study', 'investigate', 'data visualization', 'comprehensive report', 'find information']
        if any(keyword in message_lower for keyword in research_keywords):
            return 'research'
        
        # Visualization detection (charts, graphs, matplotlib)
        visualization_keywords = ['chart', 'charts', 'graph', 'graphs', 'visualization', 'visualize', 'matplotlib', 'plot', 'plots', 'infographic', 'infographics', 'create chart', 'create graph', 'generate chart', 'generate graph']
        if any(keyword in message_lower for keyword in visualization_keywords):
            return 'visualization'
        
        # Web development detection
        webdev_keywords = ['website', 'web app', 'web application', 'html', 'css', 'javascript', 'react', 'vue', 'frontend', 'backend', 'deploy website', 'create website']
        if any(keyword in message_lower for keyword in webdev_keywords):
            return 'web_development'
        
        return None

    
    @staticmethod
    async def _load_instructions_for_task(
        task_type: str,
        thread_id: str,
        client,
        kv_store: Optional[SandboxKVStore] = None,
    ) -> Optional[str]:
        """Load instructions from KV cache for detected task type.
        
        Args:
            task_type: Instruction tag (presentation, document_creation, etc.)
            thread_id: Thread ID to get project_id
            client: Database client
            kv_store: Optional pre-initialized KV store
            
        Returns:
            Instruction content or None if not found
        """
        try:
            if not kv_store:
                context = await get_project_context(thread_id, client)
                kv_store = context.get("kv_store")
            if not kv_store:
                return None

            key = f"instruction_{task_type}"
            instruction_content = await kv_store.get(
                scope="instructions", key=key, as_type="str"
            )

            if instruction_content:
                logger.info(
                    f"✅ Auto-loaded {task_type} instructions from KV cache ({len(instruction_content)} chars)"
                )
                return instruction_content
        except Exception as e:
            logger.debug(f"Could not auto-load instructions for {task_type}: {e}")
        
        return None
    
    @staticmethod
    async def _load_multiple_instructions(
        task_types: List[str],
        thread_id: str,
        client,
        kv_store: Optional[SandboxKVStore] = None,
    ) -> str:
        """Load multiple instruction types and combine them.
        
        Args:
            task_types: List of instruction tags to load
            thread_id: Thread ID to get project_id
            client: Database client
            
        Returns:
            Combined instruction content
        """
        combined_instructions = []
        
        for task_type in task_types:
            instruction_content = await PromptManager._load_instructions_for_task(
                task_type, thread_id, client, kv_store=kv_store
            )
            if instruction_content:
                combined_instructions.append(instruction_content)
        
        return "\n\n".join(combined_instructions) if combined_instructions else ""
    
    @staticmethod
    async def build_system_prompt(model_name: str, agent_config: Optional[dict], 
                                  thread_id: str, 
                                  mcp_wrapper_instance: Optional[MCPToolWrapper],
                                  client=None,
                                  tool_registry=None,
                                  xml_tool_calling: bool = True,
                                  user_message: Optional[str] = None) -> dict:
        
        if config.USE_KV_CACHE_PROMPT:
            default_system_content = get_system_prompt_kv_cache()
            logger.info("🔥 Using streamlined KV cache prompt (~10k tokens)")
        else:
            default_system_content = get_system_prompt_original()
            logger.info("Using original prompt (~40k tokens)")
        
        # if "anthropic" not in model_name.lower():
        #     sample_response_path = os.path.join(os.path.dirname(__file__), 'prompts/samples/1.txt')
        #     with open(sample_response_path, 'r') as file:
        #         sample_response = file.read()
        #     default_system_content = default_system_content + "\n\n <sample_assistant_response>" + sample_response + "</sample_assistant_response>"
        
        # Start with agent's normal system prompt or default
        if agent_config and agent_config.get('system_prompt'):
            system_content = agent_config['system_prompt'].strip()
        else:
            system_content = default_system_content
        
        # Check if agent has builder tools enabled - append the full builder prompt
        if agent_config:
            agentpress_tools = agent_config.get('agentpress_tools', {})
            has_builder_tools = any(
                agentpress_tools.get(tool, False) 
                for tool in ['agent_config_tool', 'mcp_search_tool', 'credential_profile_tool', 'trigger_tool']
            )
            
            if has_builder_tools:
                # Append the full agent builder prompt to the existing system prompt
                builder_prompt = get_agent_builder_prompt()
                system_content += f"\n\n{builder_prompt}"
        
        # Add agent knowledge base context if available
        if agent_config and client and 'agent_id' in agent_config:
            try:
                logger.debug(f"Retrieving agent knowledge base context for agent {agent_config['agent_id']}")
                
                # Use only agent-based knowledge base context
                kb_result = await client.rpc('get_agent_knowledge_base_context', {
                    'p_agent_id': agent_config['agent_id']
                }).execute()
                
                if kb_result.data and kb_result.data.strip():
                    kb_data = kb_result.data.strip()
                    # Truncate knowledge base if too large (max 5k chars to keep prompt reasonable)
                    max_kb_chars = 5000
                    if len(kb_data) > max_kb_chars:
                        kb_data = kb_data[:max_kb_chars] + "\n\n[Knowledge base truncated - use search tools for full content]"
                        logger.debug(f"Truncated knowledge base from {len(kb_result.data)} to {max_kb_chars} chars")
                    
                    logger.debug(f"Found agent knowledge base context, adding to system prompt (length: {len(kb_data)} chars)")
                    
                    # Compact knowledge base section
                    kb_section = f"\n\n=== AGENT KNOWLEDGE BASE ===\n{kb_data}\n=== END KNOWLEDGE BASE ===\n"
                    
                    system_content += kb_section
                else:
                    logger.debug("No knowledge base context found for this agent")
                    
            except Exception as e:
                logger.error(f"Error retrieving knowledge base context for agent {agent_config.get('agent_id', 'unknown')}: {e}")
                # Continue without knowledge base context rather than failing
        
        if agent_config and (agent_config.get('configured_mcps') or agent_config.get('custom_mcps')) and mcp_wrapper_instance and mcp_wrapper_instance._initialized:
            # Compact MCP info
            try:
                registered_schemas = mcp_wrapper_instance.get_schemas()
                mcp_tool_count = sum(len(schema_list) for schema_list in registered_schemas.values())
                mcp_info = f"\n\n--- MCP Tools ({mcp_tool_count} available) ---\n"
                mcp_info += "MCP tools use standard function calling format. CRITICAL: Use ONLY data from MCP tool results - never fabricate sources or URLs.\n"
            except Exception as e:
                logger.error(f"Error listing MCP tools: {e}")
                mcp_info = "\n\n--- MCP Tools Available ---\n"
            
            system_content += mcp_info
        
        # Add XML tool calling instructions to system prompt if requested
        # For XML mode, LLM needs tool schemas to construct proper tool calls
        if xml_tool_calling and tool_registry:
            openapi_schemas = tool_registry.get_openapi_schemas()
            
            if openapi_schemas:
                # Create compact but complete tool reference for XML mode
                tool_reference = PromptManager._format_tools_for_xml(openapi_schemas)
                
                examples_content = f"""

# AVAILABLE TOOLS & USAGE

**Tool Calling Format:**
Use <function_calls> blocks to invoke tools:

<function_calls>
<invoke name="tool_name">
<parameter name="param">value</parameter>
</invoke>
</function_calls>

**Formatting Rules:**
- Use exact tool names from the list below
- Include ALL required parameters (marked with *)
- Format arrays/objects as JSON strings: <parameter name="items">["item1", "item2"]</parameter>
- Boolean values: "true" or "false" (lowercase)
- Strings: Use as-is, no quotes needed in parameter tags

**Available Tools:**

{tool_reference}
"""
                
                system_content += examples_content
                logger.debug(f"Added complete tool reference for XML mode ({len(openapi_schemas)} tools)")

        now = datetime.datetime.now(datetime.timezone.utc)
        datetime_info = f"\n\n=== CURRENT DATE/TIME INFORMATION ===\n"
        datetime_info += f"Today's date: {now.strftime('%A, %B %d, %Y')}\n"
        datetime_info += f"Current year: {now.strftime('%Y')}\n"
        datetime_info += f"Current month: {now.strftime('%B')}\n"
        datetime_info += f"Current day: {now.strftime('%A')}\n"
        datetime_info += "Use this information for any time-sensitive tasks, research, or when current date/time context is needed.\n"
        
        system_content += datetime_info

        # Add KV cache instruction references (dramatically reduces baseline prompt)
        try:
            instruction_refs = get_all_instruction_references()
            system_content += f"\n\n{instruction_refs}\n"
            logger.debug("Added KV cache instruction references to prompt")
        except Exception as e:
            logger.warning(f"Failed to add instruction references (non-critical): {e}")

        # Add adaptive input handling guidance
        adaptive_input_guidance = """

=== ADAPTIVE INPUT HANDLING ===
When you see a new user message that appears mid-conversation (while you're working on a task), this is adaptive input - the user is providing additional guidance or corrections while you're executing.

CRITICAL INSTRUCTIONS FOR ADAPTIVE INPUT:
1. **Natural Acknowledgment**: When you see adaptive input, naturally acknowledge it as part of your response while immediately acting on it. For example:
   - "Got it, I'll add error handling to the code..." (then proceed to add it)
   - "Understood, switching to feature B..." (then immediately switch)
   - "Perfect, I'll make sure to include rate limiting..." (then add it)

2. **No Separate Acknowledgments**: Do NOT create a separate acknowledgment message. The acknowledgment should be seamlessly merged with your action/response.

3. **Immediate Action**: Once you see adaptive input, prioritize it and incorporate it into your current work immediately. Don't wait or create artificial delays.

4. **Natural Flow**: Make your response feel natural and conversational - acknowledge what the user said while showing you're acting on it right away.

5. **Context Awareness**: If the adaptive input relates to what you're currently doing, acknowledge the connection naturally: "I see you want me to also add X while I'm working on Y - I'll incorporate that now..."

Remember: The user sent this message because they want you to respond to it NOW. Acknowledge naturally and act immediately - all in one smooth response.
=== END ADAPTIVE INPUT HANDLING ===
"""
        system_content += adaptive_input_guidance

        system_message = {"role": "system", "content": system_content}
        return system_message



class AgentRunner:
    def __init__(self, config: AgentConfig):
        self.config = config
    
    async def setup(self):
        if not self.config.trace:
            self.config.trace = langfuse.trace(name="run_agent", session_id=self.config.thread_id, metadata={"project_id": self.config.project_id})
        
        self.thread_manager = ThreadManager(
            trace=self.config.trace, 
            agent_config=self.config.agent_config,
            project_id=self.config.project_id
        )
        
        self.client = await self.thread_manager.db.client
        
        response = await self.client.table('threads').select('account_id').eq('thread_id', self.config.thread_id).execute()
        
        if not response.data or len(response.data) == 0:
            raise ValueError(f"Thread {self.config.thread_id} not found")
        
        self.account_id = response.data[0].get('account_id')
        
        if not self.account_id:
            raise ValueError(f"Thread {self.config.thread_id} has no associated account")

        project = await self.client.table('projects').select('*').eq('project_id', self.config.project_id).execute()
        if not project.data or len(project.data) == 0:
            raise ValueError(f"Project {self.config.project_id} not found")

        project_data = project.data[0]
        sandbox_info = project_data.get('sandbox', {})
        if not sandbox_info.get('id'):
            logger.debug(f"No sandbox found for project {self.config.project_id}; will create lazily when needed")
        else:
            # Seed instructions into KV cache (non-blocking, best effort)
            try:
                from core.sandbox.sandbox import get_or_start_sandbox
                from core.sandbox.kv_store import SandboxKVStore
                sandbox = await get_or_start_sandbox(sandbox_info['id'])
                await seed_instructions_to_cache(sandbox, force_refresh=True)
                logger.info(f"Instructions seeded into KV cache for project {self.config.project_id}")
                
                # Initialize KV store for ThreadManager to use for conversation caching
                self.thread_manager.kv_store = SandboxKVStore(sandbox)
                logger.info(f"✅ KV cache enabled for ThreadManager (conversation summaries will be cached)")
            except Exception as e:
                logger.warning(f"Failed to seed instructions (non-critical): {e}")
    
    async def setup_tools(self):
        tool_manager = ToolManager(self.thread_manager, self.config.project_id, self.config.thread_id, self.config.agent_config)
        
        agent_id = None
        if self.config.agent_config:
            agent_id = self.config.agent_config.get('agent_id')
        
        disabled_tools = self._get_disabled_tools_from_config()
        
        tool_manager.register_all_tools(agent_id=agent_id, disabled_tools=disabled_tools)
        
        is_iris_agent = (self.config.agent_config and self.config.agent_config.get('is_iris_default', False)) or (self.config.agent_config is None)
        logger.debug(f"Agent config check: agent_config={self.config.agent_config is not None}, is_iris_default={is_iris_agent}")
        
        if is_iris_agent:
            logger.debug("Registering Iris-specific tools...")
            self._register_iris_specific_tools(disabled_tools)
        else:
            logger.debug("Not a Iris agent, skipping Iris-specific tool registration")
    
    def _get_enabled_methods_for_tool(self, tool_name: str) -> Optional[List[str]]:
        if not self.config.agent_config or 'agentpress_tools' not in self.config.agent_config:
            return None
        
        from core.utils.tool_discovery import get_enabled_methods_for_tool
        from core.utils.tool_migration import migrate_legacy_tool_config
        
        raw_tools = self.config.agent_config['agentpress_tools']
        
        if not isinstance(raw_tools, dict):
            return None
        
        migrated_tools = migrate_legacy_tool_config(raw_tools)
        
        return get_enabled_methods_for_tool(tool_name, migrated_tools)
    
    def _register_iris_specific_tools(self, disabled_tools: List[str]):
        if 'agent_creation_tool' not in disabled_tools:
            from core.tools.agent_creation_tool import AgentCreationTool
            from core.services.supabase import DBConnection
            
            db = DBConnection()
            
            if hasattr(self, 'account_id') and self.account_id:
                # Check for granular method control
                enabled_methods = self._get_enabled_methods_for_tool('agent_creation_tool')
                if enabled_methods is not None:
                    # Register only enabled methods
                    self.thread_manager.add_tool(AgentCreationTool, function_names=enabled_methods, thread_manager=self.thread_manager, db_connection=db, account_id=self.account_id)
                    logger.debug(f"Registered agent_creation_tool for Iris with methods: {enabled_methods}")
                else:
                    # Register all methods (backward compatibility)
                    self.thread_manager.add_tool(AgentCreationTool, thread_manager=self.thread_manager, db_connection=db, account_id=self.account_id)
                    logger.debug("Registered agent_creation_tool for Iris (all methods)")
            else:
                logger.warning("Could not register agent_creation_tool: account_id not available")
    
    def _should_trigger_fallback(self, error_message: str) -> bool:
        """
        Determine if an error should trigger fallback to flash-lite model.
        
        Only triggers on actual errors, not false positives like:
        - "not found" errors (agent run not found, etc.)
        - Cancellation errors
        - User-initiated stops
        
        Args:
            error_message: The error message to evaluate
            
        Returns:
            True if fallback should be triggered, False otherwise
        """
        if not error_message:
            return False
        
        error_lower = error_message.lower()
        
        # Don't trigger fallback for these benign/expected errors
        skip_patterns = [
            'not found',
            'not running',
            'cancelled',
            'canceled',
            'stopped by user',
            'insufficient credits',
            'billing',
            'authentication',
            'authorization',
            'permission denied',
        ]
        
        for pattern in skip_patterns:
            if pattern in error_lower:
                logger.debug(f"Skipping fallback for error: {error_message[:100]} (matches skip pattern: {pattern})")
                return False
        
        # Only trigger fallback if we haven't already done so
        if self.config.fallback_triggered:
            logger.debug(f"Skipping fallback - already triggered (error: {error_message[:100]})")
            return False
        
        # Check if current model is NOT already the fallback model
        current_model_lower = self.config.model_name.lower()
        fallback_model_lower = self.config.fallback_model.lower()
        
        if current_model_lower == fallback_model_lower or 'lite' in current_model_lower:
            logger.debug(f"Skipping fallback - already using fallback model or lite variant (current: {self.config.model_name})")
            return False
        
        # Trigger fallback for actual errors
        logger.info(f"✅ Triggering fallback: {error_message[:200]}")
        return True
    
    def _get_disabled_tools_from_config(self) -> List[str]:
        disabled_tools = []
        
        if not self.config.agent_config or 'agentpress_tools' not in self.config.agent_config:
            return disabled_tools
        
        raw_tools = self.config.agent_config['agentpress_tools']
        
        if not isinstance(raw_tools, dict):
            return disabled_tools
        
        if self.config.agent_config.get('is_iris_default', False) and not raw_tools:
            return disabled_tools
        
        def is_tool_enabled(tool_name: str) -> bool:
            try:
                tool_config = raw_tools.get(tool_name, True)
                if isinstance(tool_config, bool):
                    return tool_config
                elif isinstance(tool_config, dict):
                    return tool_config.get('enabled', True)
                else:
                    return True
            except Exception:
                return True
        
        all_tools = [
            'sb_kv_cache_tool', 'sb_shell_tool', 'sb_files_tool', 'sb_expose_tool',
            'web_search_tool', 'image_search_tool', 'sb_vision_tool', 'sb_presentation_tool', 'sb_image_edit_tool',
            'sb_kb_tool', 'sb_design_tool', 'sb_upload_file_tool',
            'sb_docs_tool',
            'data_providers_tool', 'browser_tool', 'people_search_tool', 'company_search_tool', 
            'agent_config_tool', 'mcp_search_tool', 'credential_profile_tool', 'trigger_tool',
            'agent_creation_tool'
        ]
        
        for tool_name in all_tools:
            if not is_tool_enabled(tool_name):
                disabled_tools.append(tool_name)
                
        logger.debug(f"Disabled tools from config: {disabled_tools}")
        return disabled_tools
    
    async def setup_mcp_tools(self) -> Optional[MCPToolWrapper]:
        if not self.config.agent_config:
            return None
        
        mcp_manager = MCPManager(self.thread_manager, self.account_id)
        return await mcp_manager.register_mcp_tools(self.config.agent_config)
    
    async def run(self) -> AsyncGenerator[Dict[str, Any], None]:
        await self.setup()
        await self.setup_tools()
        mcp_wrapper_instance = await self.setup_mcp_tools()
        
        # Get user message for task detection and auto-instruction loading
        latest_user_message = await self.client.table('messages').select('*').eq('thread_id', self.config.thread_id).eq('type', 'user').order('created_at', desc=True).limit(1).execute()
        user_message_content = None
        if latest_user_message.data and len(latest_user_message.data) > 0:
            data = latest_user_message.data[0]['content']
            if isinstance(data, str):
                data = json.loads(data)
            if self.config.trace:
                self.config.trace.update(input=data['content'])
            # Extract user message content for task detection
            user_message_content = data.get('content') if isinstance(data, dict) else str(data)
        
        system_message = await PromptManager.build_system_prompt(
            self.config.model_name, self.config.agent_config, 
            self.config.thread_id, 
            mcp_wrapper_instance, self.client,
            tool_registry=self.thread_manager.tool_registry,
            xml_tool_calling=True,
            user_message=user_message_content
        )
        system_content_length = len(str(system_message.get('content', '')))
        logger.info(f"📝 System message built once: {system_content_length} chars")
        logger.debug(f"model_name received: {self.config.model_name}")
        iteration_count = 0
        continue_execution = True
        final_error_detected = False  # Track if any error occurred during the run
        final_termination_reason = None  # Track why execution stopped: None, 'explicit', 'max_iterations', 'unknown'
        fallback_triggered = self.config.fallback_triggered  # Track if fallback model has been used
        system_message_needs_rebuild = False  # Track if system message needs to be rebuilt after fallback
        
        # Track the last message count to detect new adaptive input
        last_message_result = await self.client.table('messages').select('message_id').eq('thread_id', self.config.thread_id).eq('is_llm_message', True).execute()
        last_message_count = len(last_message_result.data or [])

        while continue_execution and iteration_count < self.config.max_iterations:
            iteration_count += 1
            should_continue = False
            
            # Check for new adaptive input messages
            current_message_result = await self.client.table('messages').select('message_id').eq('thread_id', self.config.thread_id).eq('is_llm_message', True).execute()
            current_message_count = len(current_message_result.data or [])
            if current_message_count > last_message_count:
                new_message_count = current_message_count - last_message_count
                logger.info(f"🔄 Detected {new_message_count} new adaptive input message(s) for thread {self.config.thread_id}")
                last_message_count = current_message_count
                # New messages will be automatically picked up by thread_manager.get_llm_messages()

            can_run, message, reservation_id = await billing_integration.check_and_reserve_credits(self.account_id)
            if not can_run:
                error_msg = f"Insufficient credits: {message}"
                final_error_detected = True
                yield {
                    "type": "status",
                    "status": "stopped",
                    "message": error_msg
                }
                break

            temporary_message = None
            # Don't set max_tokens by default - let LiteLLM and providers handle their own defaults
            max_tokens = None
            logger.debug(f"max_tokens: {max_tokens} (using provider defaults)")
            generation = self.config.trace.generation(name="thread_manager.run_thread") if self.config.trace else None
            
            # Rebuild system message if model changed (fallback triggered)
            if system_message_needs_rebuild:
                logger.info(f"🔄 Rebuilding system prompt with fallback model: {self.config.model_name}")
                system_message = await PromptManager.build_system_prompt(
                    self.config.model_name, self.config.agent_config, 
                    self.config.thread_id, 
                    mcp_wrapper_instance, self.client,
                    tool_registry=self.thread_manager.tool_registry,
                    xml_tool_calling=True,
                    user_message=user_message_content
                )
                system_message_needs_rebuild = False
                system_content_length_rebuilt = len(str(system_message.get('content', '')))
                logger.info(f"📝 System message rebuilt with fallback model: {system_content_length_rebuilt} chars")
            
            try:
                logger.debug(f"Starting thread execution for {self.config.thread_id} with model: {self.config.model_name}")
                response = await self.thread_manager.run_thread(
                    thread_id=self.config.thread_id,
                    system_prompt=system_message,
                    stream=True, 
                    llm_model=self.config.model_name,
                    llm_temperature=0,
                    llm_max_tokens=max_tokens,
                    tool_choice="auto",
                    max_xml_tool_calls=1,
                    temporary_message=temporary_message,
                    processor_config=ProcessorConfig(
                        xml_tool_calling=True,
                        native_tool_calling=False,
                        execute_tools=True,
                        execute_on_stream=True,
                        tool_execution_strategy="parallel",
                        xml_adding_strategy="user_message"
                    ),
                    native_max_auto_continues=self.config.native_max_auto_continues,
                    generation=generation
                )

                last_tool_call = None
                agent_should_terminate = False
                error_detected = False
                tool_activity_detected = False
                finish_reason = None
                saw_thread_run_end = False

                try:
                    if hasattr(response, '__aiter__') and not isinstance(response, dict):
                        async for chunk in response:
                            # Check for error status from thread_manager
                            if isinstance(chunk, dict) and chunk.get('type') == 'status' and chunk.get('status') == 'error':
                                error_message = chunk.get('message', 'Unknown error')
                                logger.error(f"Error in thread execution: {error_message}")
                                
                                # Check if we should trigger fallback instead of stopping
                                if not fallback_triggered and self._should_trigger_fallback(error_message):
                                    logger.info(f"🔄 Error detected, triggering fallback to {self.config.fallback_model} (thread {self.config.thread_id})")
                                    fallback_triggered = True
                                    self.config.model_name = self.config.fallback_model
                                    self.config.fallback_triggered = True
                                    system_message_needs_rebuild = True  # Mark system message for rebuild
                                    
                                    # Yield a status message indicating fallback
                                    yield {
                                        "type": "status",
                                        "status": "fallback",
                                        "message": f"Switching to fallback model {self.config.fallback_model} due to error",
                                        "original_error": error_message
                                    }
                                    
                                    # Continue execution instead of breaking
                                    error_detected = False
                                    break  # Break to restart iteration with new model
                                else:
                                    # Error occurred but fallback already used or shouldn't trigger
                                    error_detected = True
                                    final_error_detected = True
                                    yield chunk
                                    break

                            # Check for error status in the stream (message format)
                            if isinstance(chunk, dict) and chunk.get('type') == 'status':
                                try:
                                    content = chunk.get('content', {})
                                    if isinstance(content, str):
                                        content = json.loads(content)
                                    
                                    # Check for error status
                                    if content.get('status_type') == 'error':
                                        error_message = content.get('message', 'Unknown error')
                                        
                                        # Check if we should trigger fallback instead of stopping
                                        if not fallback_triggered and self._should_trigger_fallback(error_message):
                                            logger.info(f"🔄 Error detected in stream, triggering fallback to {self.config.fallback_model} (thread {self.config.thread_id})")
                                            fallback_triggered = True
                                            self.config.model_name = self.config.fallback_model
                                            self.config.fallback_triggered = True
                                            system_message_needs_rebuild = True  # Mark system message for rebuild
                                            
                                            # Yield a status message indicating fallback
                                            yield {
                                                "type": "status",
                                                "status": "fallback",
                                                "message": f"Switching to fallback model {self.config.fallback_model} due to error",
                                                "original_error": error_message
                                            }
                                            
                                            # Continue execution instead of breaking
                                            error_detected = False
                                            break  # Break to restart iteration with new model
                                        else:
                                            # Error occurred but fallback already used or shouldn't trigger
                                            error_detected = True
                                            final_error_detected = True
                                            yield chunk
                                            break
                                    
                                    # Check for thread_run_end - marks a completed run from ThreadManager
                                    if content.get('status_type') == 'thread_run_end':
                                        saw_thread_run_end = True

                                    if content.get('status_type') == 'finish':
                                        finish_reason = content.get('finish_reason')
                                        logger.debug(f"Finish reason detected: {finish_reason} (thread {self.config.thread_id})")

                                    # Check for agent termination
                                    metadata = chunk.get('metadata', {})
                                    if isinstance(metadata, str):
                                        metadata = json.loads(metadata)
                                    
                                    if metadata.get('agent_should_terminate'):
                                        agent_should_terminate = True
                                        
                                        if content.get('function_name'):
                                            last_tool_call = content['function_name']
                                        elif content.get('xml_tag_name'):
                                            last_tool_call = content['xml_tag_name']

                                    status_type = content.get('status_type')
                                    if status_type and status_type.startswith('tool_'):
                                        tool_activity_detected = True
                                        logger.debug(f"Tool activity detected: {status_type} (thread {self.config.thread_id})")

                                except Exception:
                                    pass

                            # Check for terminating XML tools in assistant content
                            if chunk.get('type') == 'assistant' and 'content' in chunk:
                                try:
                                    content = chunk.get('content', '{}')
                                    if isinstance(content, str):
                                        assistant_content_json = json.loads(content)
                                    else:
                                        assistant_content_json = content

                                    assistant_text = assistant_content_json.get('content', '')
                                    if isinstance(assistant_text, str):
                                        if '</ask>' in assistant_text:
                                            last_tool_call = 'ask'
                                        elif '</complete>' in assistant_text:
                                            last_tool_call = 'complete'

                                except (json.JSONDecodeError, Exception):
                                    pass

                            if chunk.get('type') == 'tool':
                                tool_activity_detected = True
                                logger.debug(f"Tool activity detected: tool chunk (thread {self.config.thread_id})")
                                
                                # Check for adaptive input after tool calls to respond immediately
                                current_message_result = await self.client.table('messages').select('message_id').eq('thread_id', self.config.thread_id).eq('is_llm_message', True).execute()
                                current_message_count = len(current_message_result.data or [])
                                if current_message_count > last_message_count:
                                    new_message_count = current_message_count - last_message_count
                                    logger.info(f"🔄 Detected {new_message_count} new adaptive input message(s) during tool execution - will prioritize in next iteration (thread {self.config.thread_id})")
                                    last_message_count = current_message_count
                                    # Force continuation to process adaptive input immediately
                                    should_continue = True
                                    tool_activity_detected = True

                            yield chunk
                    else:
                        # Non-streaming response or error dict
                        # logger.debug(f"Response is not async iterable: {type(response)}")
                        
                        # Check if it's an error dict
                        if isinstance(response, dict) and response.get('type') == 'status' and response.get('status') == 'error':
                            error_message = response.get('message', 'Unknown error')
                            logger.error(f"Thread returned error: {error_message}")
                            
                            # Check if we should trigger fallback instead of stopping
                            if not fallback_triggered and self._should_trigger_fallback(error_message):
                                logger.info(f"🔄 Error detected in response, triggering fallback to {self.config.fallback_model} (thread {self.config.thread_id})")
                                fallback_triggered = True
                                self.config.model_name = self.config.fallback_model
                                self.config.fallback_triggered = True
                                system_message_needs_rebuild = True  # Mark system message for rebuild
                                
                                # Yield a status message indicating fallback
                                yield {
                                    "type": "status",
                                    "status": "fallback",
                                    "message": f"Switching to fallback model {self.config.fallback_model} due to error",
                                    "original_error": error_message
                                }
                                
                                # Continue execution instead of breaking
                                error_detected = False
                            else:
                                error_detected = True
                                yield response
                        else:
                            logger.warning(f"Unexpected response type: {type(response)}")
                            error_detected = True

                    if error_detected:
                        if generation:
                            generation.end(status_message="error_detected", level="ERROR")
                        final_error_detected = True
                        break
                        
                    if agent_should_terminate or last_tool_call in ['ask', 'complete', 'present_presentation']:
                        if generation:
                            generation.end(status_message="agent_stopped")
                        continue_execution = False
                        final_termination_reason = 'explicit'
                    else:
                        auto_continue_reasons = {"length", "tool_calls"}
                        # Check for adaptive input before deciding continuation
                        # This ensures adaptive input is processed immediately
                        current_message_result = await self.client.table('messages').select('message_id').eq('thread_id', self.config.thread_id).eq('is_llm_message', True).execute()
                        current_message_count = len(current_message_result.data or [])
                        adaptive_input_detected = current_message_count > last_message_count
                        if adaptive_input_detected:
                            new_message_count = current_message_count - last_message_count
                            logger.info(f"🔄 Detected {new_message_count} new adaptive input message(s) - prioritizing immediate response (thread {self.config.thread_id})")
                            last_message_count = current_message_count
                            should_continue = True
                            logger.debug(f"Continuing execution to process adaptive input immediately (thread {self.config.thread_id})")
                        # Priority 1: If tool activity was detected, always continue
                        # This ensures the agent continues after executing tools to process results
                        elif tool_activity_detected:
                            should_continue = True
                            logger.debug(f"Continuing execution due to tool activity detected (thread {self.config.thread_id})")
                        # Priority 2: Check finish_reason for auto-continue reasons
                        elif finish_reason and finish_reason in auto_continue_reasons:
                            should_continue = True
                            logger.debug(f"Continuing execution due to finish_reason: {finish_reason} (thread {self.config.thread_id})")
                        # Priority 3: If we haven't seen thread_run_end yet, assume more processing may follow
                        elif not saw_thread_run_end and finish_reason is None and not tool_activity_detected:
                            should_continue = True
                            logger.debug(f"Continuing execution - no explicit finish signal yet (thread {self.config.thread_id})")
                        # Priority 4: Only stop if we've seen thread_run_end AND no tool activity AND no auto-continue reason
                        else:
                            should_continue = False
                            if saw_thread_run_end and final_termination_reason is None:
                                final_termination_reason = 'implicit'
                                logger.debug(f"Stopping execution - saw thread_run_end with no tool activity (thread {self.config.thread_id}, finish_reason={finish_reason}, tool_activity_detected={tool_activity_detected})")
                    
                    # Log final decision for debugging
                    logger.debug(f"Continuation decision for iteration {iteration_count}: should_continue={should_continue}, tool_activity_detected={tool_activity_detected}, finish_reason={finish_reason}, saw_thread_run_end={saw_thread_run_end}, agent_should_terminate={agent_should_terminate} (thread {self.config.thread_id})")

                except Exception as e:
                    # Use ErrorProcessor for safe error handling
                    processed_error = ErrorProcessor.process_system_error(e, context={"thread_id": self.config.thread_id})
                    ErrorProcessor.log_error(processed_error)
                    error_message = processed_error.message
                    
                    # Check if we should trigger fallback instead of stopping
                    if not fallback_triggered and self._should_trigger_fallback(error_message):
                        logger.info(f"🔄 Exception detected, triggering fallback to {self.config.fallback_model} (thread {self.config.thread_id})")
                        fallback_triggered = True
                        self.config.model_name = self.config.fallback_model
                        self.config.fallback_triggered = True
                        system_message_needs_rebuild = True  # Mark system message for rebuild
                        
                        # Yield a status message indicating fallback
                        yield {
                            "type": "status",
                            "status": "fallback",
                            "message": f"Switching to fallback model {self.config.fallback_model} due to error",
                            "original_error": error_message
                        }
                        
                        # Continue execution instead of breaking - restart iteration with new model
                        error_detected = False
                        if generation:
                            generation.end()
                        continue  # Continue to next iteration with fallback model
                    else:
                        # Error occurred but fallback already used or shouldn't trigger
                        if generation:
                            generation.end(status_message=processed_error.message, level="ERROR")
                        final_error_detected = True
                        yield processed_error.to_stream_dict()
                        break
                    
            except Exception as e:
                # Use ErrorProcessor for safe error conversion
                processed_error = ErrorProcessor.process_system_error(e, context={"thread_id": self.config.thread_id})
                ErrorProcessor.log_error(processed_error)
                error_message = processed_error.message
                
                # Check if we should trigger fallback instead of stopping
                if not fallback_triggered and self._should_trigger_fallback(error_message):
                    logger.info(f"🔄 Outer exception detected, triggering fallback to {self.config.fallback_model} (thread {self.config.thread_id})")
                    fallback_triggered = True
                    self.config.model_name = self.config.fallback_model
                    self.config.fallback_triggered = True
                    system_message_needs_rebuild = True  # Mark system message for rebuild
                    
                    # Yield a status message indicating fallback
                    yield {
                        "type": "status",
                        "status": "fallback",
                        "message": f"Switching to fallback model {self.config.fallback_model} due to error",
                        "original_error": error_message
                    }
                    
                    # Continue execution instead of breaking - restart iteration with new model
                    final_error_detected = False
                    continue  # Continue to next iteration with fallback model
                else:
                    # Error occurred but fallback already used or shouldn't trigger
                    final_error_detected = True
                    yield processed_error.to_stream_dict()
                    break
            
            if generation:
                generation.end()

            continue_execution = should_continue

        # Yield completion status when loop exits naturally (not via break)
        # This ensures run_agent_background knows why the agent stopped
        if not final_error_detected:
            # Check if we hit max iterations
            if iteration_count >= self.config.max_iterations:
                final_termination_reason = 'max_iterations'
                yield {
                    "type": "status",
                    "status": "stopped",
                    "message": f"Agent reached maximum iterations ({self.config.max_iterations})"
                }
            elif final_termination_reason == 'explicit':
                # Agent was explicitly stopped (termination signal)
                yield {
                    "type": "status",
                    "status": "completed",
                    "message": "Agent completed successfully"
                }
            elif not continue_execution:
                # continue_execution was set to False but we don't know why
                logger.warning(f"Agent generator exited with continue_execution=False but no explicit termination reason for thread {self.config.thread_id}")
                yield {
                    "type": "status",
                    "status": "completed",
                    "message": "Agent run completed"
                }
            else:
                # Loop exited for unknown reason - this shouldn't happen but log it
                logger.warning(f"Agent generator exited unexpectedly for thread {self.config.thread_id} (iteration_count={iteration_count}, continue_execution={continue_execution})")
                yield {
                    "type": "status",
                    "status": "completed",
                    "message": "Agent run completed"
                }

        try:
            asyncio.create_task(asyncio.to_thread(lambda: langfuse.flush()))
        except Exception as e:
            logger.warning(f"Failed to flush Langfuse: {e}")


async def run_agent(
    thread_id: str,
    project_id: str,
    thread_manager: Optional[ThreadManager] = None,
    native_max_auto_continues: int = 25,
    max_iterations: int = 100,
    model_name: str = "gemini/gemini-2.5-flash",
    agent_config: Optional[dict] = None,    
    trace: Optional[StatefulTraceClient] = None
):
    effective_model = model_name

    # is_tier_default = model_name in ["Kimi K2", "Claude Sonnet 4", "openai/gpt-5-mini"]
    # if is_tier_default and agent_config and agent_config.get('model'):
    #     effective_model = agent_config['model']
    #     logger.debug(f"Using model from agent config: {effective_model} (tier default was {model_name})")
    # elif not is_tier_default:
    #     logger.debug(f"Using user-selected model: {effective_model}")
    # else:
    #     logger.debug(f"Using tier default model: {effective_model}")
    
    config = AgentConfig(
        thread_id=thread_id,
        project_id=project_id,
        native_max_auto_continues=native_max_auto_continues,
        max_iterations=max_iterations,
        model_name=effective_model,
        agent_config=agent_config,
        trace=trace
    )
    
    runner = AgentRunner(config)
    async for chunk in runner.run():
        yield chunk
