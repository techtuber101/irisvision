import { useQuickChat } from '@/api/quick-chat-api';
import { fontWeights } from '@/constants/Fonts';
import { useThemedStyles } from '@/hooks/useThemeColor';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time?: number;
};

const QUICK_CHAT_MODEL =
  process.env.EXPO_PUBLIC_GEMINI_RESEARCH_MODEL?.trim() || 'gemini-3-pro-preview';

export const QuickChatPane: React.FC = () => {
  const scheme = useColorScheme();
  const isDarkMode = (scheme ?? 'light') === 'dark';

  const styles = useThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden' as const,
      shadowColor: isDarkMode ? '#000' : '#0a1635',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: isDarkMode ? 0.4 : 0.12,
      shadowRadius: 18,
      elevation: 5,
    },
    header: {
      paddingHorizontal: 24,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    headerTitle: {
      fontSize: 20,
      color: theme.foreground,
      fontFamily: fontWeights[600],
    },
    headerSubtitle: {
      fontSize: 13,
      marginTop: 6,
      color: theme.mutedForeground,
      fontFamily: fontWeights[400],
      lineHeight: 18,
    },
    chipRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      marginTop: 16,
      gap: 10,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.mutedWithOpacity(0.15),
    },
    chipText: {
      fontSize: 12,
      color: theme.mutedForeground,
      fontFamily: fontWeights[500],
      letterSpacing: 0.4,
      textTransform: 'uppercase' as const,
    },
    history: {
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
      backgroundColor: theme.card,
    },
    messageBubble: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 18,
      maxWidth: '85%' as const,
    },
    userBubble: {
      alignSelf: 'flex-end' as const,
      backgroundColor: theme.primary,
    },
    userText: {
      color: theme.primaryForeground,
      fontFamily: fontWeights[500],
      fontSize: 15,
      lineHeight: 20,
    },
    assistantBubble: {
      alignSelf: 'flex-start' as const,
      backgroundColor: theme.mutedWithOpacity(0.12),
    },
    assistantText: {
      color: theme.foreground,
      fontFamily: fontWeights[400],
      fontSize: 15,
      lineHeight: 20,
    },
    assistantMeta: {
      color: theme.foreground,
      fontFamily: fontWeights[400],
      fontSize: 11,
      lineHeight: 16,
      opacity: 0.5,
      marginTop: 8,
      textTransform: 'uppercase' as const,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: theme.background,
    },
    inputContainer: {
      flexDirection: 'row' as const,
      alignItems: 'flex-end' as const,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    textInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      fontSize: 15,
      color: theme.foreground,
      fontFamily: fontWeights[400],
      padding: 0,
      margin: 0,
    },
    sendButton: {
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minWidth: 80,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendButtonText: {
      color: theme.primaryForeground,
      fontFamily: fontWeights[600],
      fontSize: 14,
    },
    emptyState: {
      paddingVertical: 48,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 12,
    },
    emptyStateTitle: {
      fontSize: 16,
      fontFamily: fontWeights[600],
      color: theme.foreground,
    },
    emptyStateSubtitle: {
      fontSize: 14,
      fontFamily: fontWeights[400],
      color: theme.mutedForeground,
      maxWidth: 240,
      textAlign: 'center' as const,
      lineHeight: 20,
    },
    pendingBubble: {
      alignSelf: 'flex-start' as const,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
    },
    errorBanner: {
      marginHorizontal: 20,
      marginBottom: 8,
      borderRadius: 12,
      backgroundColor: '#ff5c5c20',
      borderWidth: 1,
      borderColor: '#ff5c5c35',
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    errorText: {
      color: '#ff5c5c',
      fontFamily: fontWeights[500],
      fontSize: 13,
    },
  }));

  const [input, setInput] = useState('');
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const historyRef = useRef<ScrollView>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const quickChatMutation = useQuickChat();

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      historyRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || quickChatMutation.isPending) {
      return;
    }

    Keyboard.dismiss();
    setErrorMessage(null);
    setInput('');

    setHistory((prev) => {
      const next = [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: trimmed,
        },
      ] as ConversationMessage[];
      return next;
    });

    try {
      const response = await quickChatMutation.mutateAsync({
        message: trimmed,
        model: QUICK_CHAT_MODEL,
        chatContext: history.map(({ role, content }) => ({ role, content })),
      });

      setHistory((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.response,
          time: response.time_ms,
        },
      ]);
      scrollToBottom();
    } catch (error) {
      console.error('[QuickChatPane] Failed to send quick chat', error);
      const description =
        error instanceof Error ? error.message : 'Unable to send quick chat message.';
      setErrorMessage(description);
    }
  }, [history, input, quickChatMutation, scrollToBottom]);

  React.useEffect(() => {
    scrollToBottom();
  }, [history.length, scrollToBottom]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quick chat</Text>
        <Text style={styles.headerSubtitle}>
          Ask something lightweight or exploratory without saving it to a project.
        </Text>
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{QUICK_CHAT_MODEL}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>ephemeral</Text>
          </View>
        </View>
      </View>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <ScrollView
        ref={historyRef}
        style={{ flex: 1 }}
        contentContainerStyle={history.length === 0 ? styles.emptyState : styles.history}
      >
        {history.length === 0 ? (
          <>
            <Text style={styles.emptyStateTitle}>Start a lightweight chat</Text>
            <Text style={styles.emptyStateSubtitle}>
              Perfect for quick brainstorms, verifying facts, or checking small snippets before
              handing work off to your main workspace.
            </Text>
          </>
        ) : (
          history.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={message.role === 'user' ? styles.userText : styles.assistantText}
              >
                {message.content}
              </Text>
              {message.role === 'assistant' && message.time ? (
                <Text style={styles.assistantMeta}>
                  responded in {(message.time / 1000).toFixed(2)}s
                </Text>
              ) : null}
            </View>
          ))
        )}
        {quickChatMutation.isPending ? (
          <View
            style={[
              styles.messageBubble,
              styles.assistantBubble,
              styles.pendingBubble,
            ]}
          >
            <ActivityIndicator size="small" color="#8890ff" />
            <Text style={[styles.assistantText, { opacity: 0.6 }]}>Iris is thinking…</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.inputContainer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask something quick…"
            placeholderTextColor="rgba(127, 134, 151, 0.8)"
            style={styles.textInput}
            multiline
            autoCorrect
            autoCapitalize="sentences"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={!quickChatMutation.isPending}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || quickChatMutation.isPending}
            style={[
              styles.sendButton,
              (!input.trim() || quickChatMutation.isPending) ? styles.sendButtonDisabled : undefined,
            ]}
          >
            {quickChatMutation.isPending ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default QuickChatPane;
