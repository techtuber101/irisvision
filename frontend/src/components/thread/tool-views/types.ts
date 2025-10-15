import { Project } from '@/lib/api';

export interface ToolViewProps {
  assistantContent?: string;
  toolContent?: string;
  assistantTimestamp?: string;
  toolTimestamp?: string;
  isSuccess?: boolean;
  isStreaming?: boolean;
  project?: Project;
  name?: string;
  messages?: any[];
  agentStatus?: string;
  currentIndex?: number;
  totalCalls?: number;
  onFileClick?: (filePath: string) => void;
  viewToggle?: React.ReactNode;
  onSubmit?: (message: string, options?: { model_name?: string; agent_id?: string; chat_mode?: 'chat' | 'execute' }) => void;
  isAgentRunning?: boolean;
  selectedModel?: string;
  getActualModelId?: (modelId: string) => string;
  selectedAgentId?: string;
  chatMode?: 'chat' | 'execute';
  onPopulateChatInput?: (message: string) => void;
}

export interface BrowserToolViewProps extends ToolViewProps {
  name?: string;
}
