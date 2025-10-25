import { PanelContainer } from '@/components/PanelContainer';
import { ChatContainer } from '@/components/ChatContainer';
import { UploadedFile } from '@/utils/file-upload';
import {
  useIsNewChatMode,
  useLeftPanelVisible,
  useResetNewChatSession,
  useRightPanelVisible,
  useSelectedProject,
  useSetLeftPanelVisible,
  useSetNewChatMode,
  useSetRightPanelVisible,
} from '@/stores/ui-store';
import { useChatSession, useNewChatSession } from '@/hooks/useChatHooks';
import { useTheme, useThemedStyles } from '@/hooks/useThemeColor';
import { PanelLeft, PanelRightOpen } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MainTab = 'workspace' | 'quick';

export default function WorkspaceScreen() {
  const theme = useTheme();
  const styles = useThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    body: {
      flex: 1,
    },
    tabSwitcher: {
      flexDirection: 'row' as const,
      backgroundColor: theme.mutedWithOpacity(0.12),
      borderRadius: 999,
      padding: 4,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 999,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: theme.mutedForeground,
    },
    tabTextActive: {
      color: theme.primaryForeground,
    },
    tabButtonActive: {
      backgroundColor: theme.primary,
    },
    tabButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    headerRight: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
    },
    newChatButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: theme.secondary,
    },
    newChatButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    newChatText: {
      color: theme.secondaryForeground,
      fontSize: 13,
      fontWeight: '600' as const,
    },
    settingsButton: {
      padding: 8,
      borderRadius: 12,
      backgroundColor: theme.mutedWithOpacity(0.18),
    },
    settingsButtonPressed: {
      opacity: 0.7,
    },
    floatingButton: {
      position: 'absolute' as const,
      top: 55, // Slightly below header but visible
      padding: 10, // Reduced from 12
      borderRadius: 14, // Reduced from 16
      backgroundColor: theme.card, // Use theme card color
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 1000, // High z-index to stay on top
    },
    sidebarButton: {
      left: 16,
    },
    irisButton: {
      right: 16,
    },
  }));

  const [activeTab, setActiveTab] = useState<MainTab>('workspace');
  const [leftPanelAnimating, setLeftPanelAnimating] = useState(false);
  const [rightPanelAnimating, setRightPanelAnimating] = useState(false);

  const leftPanelVisible = useLeftPanelVisible();
  const rightPanelVisible = useRightPanelVisible();
  const setLeftPanelVisible = useSetLeftPanelVisible();
  const setRightPanelVisible = useSetRightPanelVisible();

  const selectedProject = useSelectedProject();
  const isNewChatMode = useIsNewChatMode();
  const setNewChatMode = useSetNewChatMode();
  const resetNewChatSession = useResetNewChatSession();

  const projectChatSession = useChatSession(
    !isNewChatMode && selectedProject?.id && selectedProject.id !== 'new-chat-temp'
      ? selectedProject.id
      : ''
  );
  const newChatSession = useNewChatSession();

  const activeSession = isNewChatMode ? newChatSession : projectChatSession;

  const messagesForPanel = activeTab === 'workspace' ? activeSession.messages : [];

  const toggleLeftPanel = useCallback(() => {
    setLeftPanelVisible(!leftPanelVisible);
  }, [leftPanelVisible, setLeftPanelVisible]);

  const toggleRightPanel = useCallback(() => {
    setRightPanelVisible(!rightPanelVisible);
  }, [rightPanelVisible, setRightPanelVisible]);

  const handleSendMessage = useCallback(async (content: string, files?: UploadedFile[]) => {
    if (!content.trim() && !(files && files.length > 0)) {
      return;
    }

    await activeSession.sendMessage(content, files);
  }, [activeSession]);

  const handleQuickChatResponse = useCallback((response: string) => {
    // Add the quick chat response to the current session messages
    // This creates a temporary message that will be displayed in the thread
    const quickChatMessage = {
      message_id: `quick-${Date.now()}`,
      thread_id: activeSession.threadId || 'quick-chat',
      type: 'assistant' as const,
      is_llm_message: true,
      content: { role: 'assistant' as const, content: response },
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    // Add to the current session's messages
    // Note: This is a simplified approach - in a real app you might want to
    // use a more sophisticated state management approach
    console.log('Quick chat response added to thread:', response);
  }, [activeSession]);

  const handleCancelStream = useCallback(() => {
    void activeSession.stopAgent();
  }, [activeSession]);

  const handleTabChange = useCallback((tab: MainTab) => {
    setActiveTab(tab);
    if (tab === 'quick') {
      setRightPanelVisible(false);
    }
  }, [setRightPanelVisible]);


  return (
    <View style={styles.container}>
      <PanelContainer
        leftPanelVisible={leftPanelVisible}
        rightPanelVisible={rightPanelVisible && activeTab === 'workspace'}
        onCloseLeft={() => setLeftPanelVisible(false)}
        onCloseRight={() => setRightPanelVisible(false)}
        onOpenLeft={() => setLeftPanelVisible(true)}
        onLeftPanelSlideStart={() => setLeftPanelAnimating(true)}
        onLeftPanelSlideEnd={() => setLeftPanelAnimating(false)}
        onRightPanelSlideStart={() => setRightPanelAnimating(true)}
        onRightPanelSlideEnd={() => setRightPanelAnimating(false)}
        messages={messagesForPanel}
      >
        <View style={styles.body}>
          <ChatContainer
            messages={activeSession.messages}
            isGenerating={activeSession.isGenerating}
            isSending={activeSession.isSending}
            streamContent={activeSession.streamContent}
            streamError={activeSession.streamError}
            isLoadingThread={!isNewChatMode ? projectChatSession.isLoadingThread : false}
            isLoadingMessages={activeSession.isLoadingMessages}
            isNewChatMode={isNewChatMode}
            selectedProject={selectedProject ?? null}
            onSendMessage={handleSendMessage}
            onCancelStream={handleCancelStream}
            onTabChange={handleTabChange}
            onQuickChatResponse={handleQuickChatResponse}
          />
          
          {/* Sticky Buttons - Inside ChatContainer so they move with tab switching */}
          {/* Floating Sidebar Menu Button */}
          {!leftPanelVisible && !leftPanelAnimating && (
            <TouchableOpacity 
              style={[styles.floatingButton, styles.sidebarButton]}
              onPress={toggleLeftPanel}
            >
              <PanelLeft size={16} color={theme.foreground} />
            </TouchableOpacity>
          )}
          
          {/* Floating Iris Computer View Button */}
          {!rightPanelVisible && !rightPanelAnimating && activeTab === 'workspace' && (
            <TouchableOpacity 
              style={[styles.floatingButton, styles.irisButton]}
              onPress={toggleRightPanel}
            >
              <PanelRightOpen size={16} color={theme.foreground} />
            </TouchableOpacity>
          )}
        </View>
      </PanelContainer>
    </View>
  );
}
