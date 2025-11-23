import { PanelContainer } from '@/components/PanelContainer';
import { ChatContainer } from '@/components/ChatContainer';
import type { FastResponsePayload } from '@/components/ChatInput';
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

interface AdaptivePromptState {
  prompt: string;
  yesLabel: string;
  noLabel: string;
  userMessage: string;
  reason?: string;
}

export default function WorkspaceScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
    adaptiveBubbleContainer: {
      position: 'absolute' as const,
      left: 24,
      right: 24,
      zIndex: 2000,
    },
    adaptiveBubble: {
      padding: 16,
      borderRadius: 18,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    },
    adaptiveBubblePrompt: {
      color: theme.foreground,
      fontSize: 16,
      fontWeight: '600' as const,
    },
    adaptiveBubbleSubtext: {
      color: theme.mutedForeground,
      fontSize: 13,
      marginTop: 6,
    },
    adaptiveBubbleButtons: {
      flexDirection: 'row' as const,
      gap: 12,
      marginTop: 16,
    },
    adaptiveBubbleButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center' as const,
    },
    adaptiveBubbleYes: {
      backgroundColor: '#22c55e',
    },
    adaptiveBubbleNo: {
      backgroundColor: '#ef4444',
    },
    adaptiveBubbleButtonText: {
      color: '#fff',
      fontWeight: '600' as const,
      fontSize: 14,
    },
  }));

  const [activeTab, setActiveTab] = useState<MainTab>('workspace');
  const [leftPanelAnimating, setLeftPanelAnimating] = useState(false);
  const [rightPanelAnimating, setRightPanelAnimating] = useState(false);
  const [adaptivePrompt, setAdaptivePrompt] = useState<AdaptivePromptState | null>(null);

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

  const handleQuickChatResponse = useCallback((payload: FastResponsePayload) => {
    console.log('Fast response:', payload.answer);

    if (payload.mode === 'adaptive' && payload.decision) {
      if (payload.decision.state === 'agent_needed') {
        setAdaptivePrompt(null);
        void handleSendMessage(payload.userMessage);
        return;
      }

      if (payload.decision.state === 'ask_user' && payload.decision.ask_user) {
        const askUser = payload.decision.ask_user;
        setAdaptivePrompt({
          prompt: askUser.prompt,
          yesLabel: askUser.yes_label || 'Yes',
          noLabel: askUser.no_label || "I'm fine",
          userMessage: payload.userMessage,
          reason: payload.decision.reason,
        });
        return;
      }
      setAdaptivePrompt(null);
    } else {
      setAdaptivePrompt(null);
    }
  }, [handleSendMessage]);

  const handleCancelStream = useCallback(() => {
    void activeSession.stopAgent();
  }, [activeSession]);

  const handleTabChange = useCallback((tab: MainTab) => {
    setActiveTab(tab);
    if (tab === 'quick') {
      setRightPanelVisible(false);
    }
  }, [setRightPanelVisible]);

  const handleAdaptiveConfirm = useCallback((message: string) => {
    void handleSendMessage(message);
    setAdaptivePrompt(null);
  }, [handleSendMessage]);

  const handleAdaptiveDecline = useCallback(() => {
    setAdaptivePrompt(null);
  }, []);


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
      {adaptivePrompt && (
        <View style={[
          styles.adaptiveBubbleContainer,
          { bottom: Math.max(insets.bottom + 32, 48) },
        ]}>
          <View style={styles.adaptiveBubble}>
            <Text style={styles.adaptiveBubblePrompt}>{adaptivePrompt.prompt}</Text>
            {adaptivePrompt.reason ? (
              <Text style={styles.adaptiveBubbleSubtext}>{adaptivePrompt.reason}</Text>
            ) : null}
            <View style={styles.adaptiveBubbleButtons}>
              <TouchableOpacity
                style={[styles.adaptiveBubbleButton, styles.adaptiveBubbleYes]}
                onPress={() => handleAdaptiveConfirm(adaptivePrompt.userMessage)}
              >
                <Text style={styles.adaptiveBubbleButtonText}>{adaptivePrompt.yesLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adaptiveBubbleButton, styles.adaptiveBubbleNo]}
                onPress={handleAdaptiveDecline}
              >
                <Text style={styles.adaptiveBubbleButtonText}>{adaptivePrompt.noLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
