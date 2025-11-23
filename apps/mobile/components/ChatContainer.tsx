import { Message } from '@/api/chat-api';
import { commonStyles } from '@/constants/CommonStyles';
import { useThemedStyles } from '@/hooks/useThemeColor';
import { Project } from '@/stores/ui-store';
import { UploadedFile } from '@/utils/file-upload';
import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform, View } from 'react-native';
import { ChatInput, FastResponsePayload } from './ChatInput';
import { MessageThread } from './MessageThread';
import { SkeletonText } from './Skeleton';
import { Body } from './Typography';

interface ChatContainerProps {
    messages: Message[];
    isGenerating: boolean;
    isSending: boolean;
    streamContent: string;
    streamError: string | null;
    isLoadingThread: boolean;
    isLoadingMessages: boolean;
    isNewChatMode: boolean;
    selectedProject: Project | null;
    onSendMessage: (content: string, files?: UploadedFile[]) => Promise<void>;
    onCancelStream: () => void;
    onTabChange?: (tab: 'workspace' | 'quick') => void;
    onQuickChatResponse?: (payload: FastResponsePayload) => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
    messages,
    isGenerating,
    isSending,
    streamContent,
    streamError,
    isLoadingMessages,
    isLoadingThread,
    isNewChatMode,
    selectedProject,
    onSendMessage,
    onCancelStream,
    onTabChange,
    onQuickChatResponse,
}) => {
    const [isAtBottomOfChat, setIsAtBottomOfChat] = useState(true);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const handleKeyboardShow = (event: KeyboardEvent) => {
            setKeyboardHeight(event.endCoordinates.height);
        };

        const handleKeyboardHide = () => {
            setKeyboardHeight(0);
        };

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
        const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const styles = useThemedStyles((theme) => ({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        loadingContainer: {
            ...commonStyles.flexCenter,
            backgroundColor: theme.background,
            paddingHorizontal: 32,
        },
        emptyContainer: {
            ...commonStyles.flexCenter,
            backgroundColor: theme.background,
            paddingHorizontal: 32,
        },
        emptyText: {
            color: theme.mutedForeground,
            fontSize: 18,
            textAlign: 'center' as const,
            lineHeight: 24,
        },
        emptySubtext: {
            color: theme.mutedForeground,
            fontSize: 14,
            textAlign: 'center' as const,
            marginTop: 8,
            opacity: 0.7,
        },
        chatContent: {
            flex: 1,
        },
    }));

    const handleScrollPositionChange = (isAtBottom: boolean) => {
        setIsAtBottomOfChat(isAtBottom);
    };

    if (!isNewChatMode && selectedProject && isLoadingThread) {
        return (
            <View style={styles.loadingContainer}>
                <SkeletonText lines={3} />
            </View>
        );
    }

    if (!isNewChatMode && !selectedProject) {
        return (
            <View style={styles.emptyContainer}>
                <Body style={styles.emptyText}>Select a project to start chatting</Body>
                <Body style={styles.emptySubtext}>
                    Choose a project from the sidebar to begin your conversation.
                </Body>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.chatContent}>
                <MessageThread
                    messages={messages}
                    isGenerating={isGenerating}
                    isSending={isSending}
                    streamContent={streamContent}
                    streamError={streamError}
                    isLoadingMessages={isLoadingMessages}
                    onScrollPositionChange={handleScrollPositionChange}
                    keyboardHeight={keyboardHeight}
                    sandboxId={selectedProject?.sandbox?.id}
                />
            </View>
            <ChatInput
                onSendMessage={onSendMessage}
                onCancelStream={onCancelStream}
                placeholder={
                    isGenerating
                        ? "AI is responding..."
                        : isSending
                            ? "Sending..."
                            : isNewChatMode
                                ? "Start a new conversation..."
                                : `Chat with ${selectedProject?.name || 'project'}...`
                }
                isAtBottomOfChat={isAtBottomOfChat}
                isGenerating={isGenerating}
                isSending={isSending}
                onTabChange={onTabChange}
                onQuickChatResponse={onQuickChatResponse}
            />
        </View>
    );
};

export default ChatContainer;
