import { AttachmentGroup } from '@/components/AttachmentGroup';
import { useTheme } from '@/hooks/useThemeColor';
import { useSelectedProject } from '@/stores/ui-store';
import { handleLocalFiles, pickFiles, UploadedFile, uploadFilesToSandbox } from '@/utils/file-upload';
import { AdaptiveChatResponse, AdaptiveDecision, QuickChatAttachment, sendAdaptiveChat, sendQuickChat } from '@/api/quick-chat-api';
import { ChevronUp, Mic, Paperclip, Square } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardEvent, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, {
    Easing,
    Extrapolate,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';

const QUICK_ADAPTIVE_MODEL =
    process.env.EXPO_PUBLIC_GEMINI_RESEARCH_MODEL?.trim() || 'gemini-3-pro-preview';

export type IrisChatMode = 'intelligence' | 'adaptive' | 'quick';

export interface FastResponsePayload {
    mode: 'quick' | 'adaptive';
    answer: string;
    userMessage: string;
    decision?: AdaptiveDecision;
    autoEscalate?: boolean;
}

interface ChatInputProps {
    onSendMessage: (message: string, files?: UploadedFile[]) => Promise<void> | void;
    onAttachPress?: () => void;
    onMicPress?: () => void;
    onCancelStream?: () => void;
    placeholder?: string;
    isAtBottomOfChat?: boolean;
    isGenerating?: boolean;
    isSending?: boolean;
    onTabChange?: (tab: 'workspace' | 'quick') => void;
    onQuickChatResponse?: (payload: FastResponsePayload) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    onSendMessage,
    onAttachPress,
    onMicPress,
    onCancelStream,
    placeholder = 'Ask Iris anything...',
    isAtBottomOfChat = true,
    isGenerating = false,
    isSending = false,
    onTabChange,
    onQuickChatResponse,
}) => {
    const [message, setMessage] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [irisMode, setIrisMode] = useState<IrisChatMode>('intelligence'); // Iris Intelligence is default
    const modeOptions: { key: IrisChatMode; label: string }[] = [
        { key: 'intelligence', label: 'Iris Intelligence' },
        { key: 'adaptive', label: 'Adaptive' },
        { key: 'quick', label: 'Quick Chat' },
    ];
    const selectedProject = useSelectedProject();
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    // Animation values
    const menuTranslateY = useSharedValue(300);
    const menuOpacity = useSharedValue(0);
    const backdropOpacity = useSharedValue(0);


    // Get sandboxId from selected project
    const sandboxId = selectedProject?.sandbox?.id;

    const keyboardHeight = useSharedValue(0);

    useEffect(() => {
        const handleKeyboardShow = (event: KeyboardEvent) => {
            keyboardHeight.value = withTiming(event.endCoordinates.height, {
                duration: 250,
                easing: Easing.out(Easing.quad),
            });
        };

        const handleKeyboardHide = () => {
            keyboardHeight.value = withTiming(0, {
                duration: 250,
                easing: Easing.out(Easing.quad),
            });
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

    const handleSend = async () => {
        if (message.trim() || attachedFiles.length > 0) {
            let finalMessage = message.trim();

            // For existing projects with sandboxId, add file references to message
            // For new chat mode, let server handle file references to avoid duplicates
            if (attachedFiles.length > 0 && sandboxId) {
                const fileInfo = attachedFiles
                    .map(file => `[Uploaded File: ${file.path}]`)
                    .join('\n');
                finalMessage = finalMessage ? `${finalMessage}\n\n${fileInfo}` : fileInfo;
            }

            // Route message based on selected mode
            if (irisMode === 'quick') {
                try {
                    const attachmentsPayload = await prepareQuickChatAttachments();
                    const response = await sendQuickChat({
                        message: finalMessage,
                        model: QUICK_ADAPTIVE_MODEL,
                        attachments: attachmentsPayload,
                    });

                    onQuickChatResponse?.({
                        mode: 'quick',
                        answer: response.response,
                        userMessage: finalMessage,
                        autoEscalate: false,
                    });
                } catch (error) {
                    console.error('Quick chat error:', error);
                    const description = error instanceof Error ? error.message : 'Unable to send quick chat message.';
                    Alert.alert('Quick chat failed', description);
                    return;
                }
            } else if (irisMode === 'adaptive') {
                try {
                    const attachmentsPayload = await prepareQuickChatAttachments();
                    const response: AdaptiveChatResponse = await sendAdaptiveChat({
                        message: finalMessage,
                        model: QUICK_ADAPTIVE_MODEL,
                        attachments: attachmentsPayload,
                    });

                    onQuickChatResponse?.({
                        mode: 'adaptive',
                        answer: response.response,
                        userMessage: finalMessage,
                        decision: response.decision,
                        autoEscalate: response.decision.state === 'agent_needed',
                    });
                } catch (error) {
                    console.error('Adaptive chat error:', error);
                    const description = error instanceof Error ? error.message : 'Unable to send adaptive chat message.';
                    Alert.alert('Adaptive mode failed', description);
                    return;
                }
            } else {
                // Use default agent (Iris Intelligence) - existing behavior
                void onSendMessage(finalMessage, attachedFiles);
            }

            setMessage('');
            setAttachedFiles([]);
        }
    };

    const handleAttachPress = async () => {
        try {
            const result = await pickFiles();

            if (result.cancelled || !result.files?.length) {
                return;
            }

            if (sandboxId) {
                // Upload to sandbox - files shown immediately with loading state
                await uploadFilesToSandbox(
                    result.files,
                    sandboxId,
                    (files: UploadedFile[]) => setAttachedFiles(prev => [...prev, ...files]),
                    (filePath: string, status: { isUploading?: boolean; uploadError?: string }) => {
                        setAttachedFiles(prev => prev.map(file =>
                            file.path === filePath
                                ? { ...file, ...status }
                                : file
                        ));
                    }
                );
            } else {
                // Store locally - files shown immediately
                await handleLocalFiles(
                    result.files,
                    () => { }, // We don't need pending files state here
                    (files: UploadedFile[]) => setAttachedFiles(prev => [...prev, ...files])
                );
            }

            onAttachPress?.();
        } catch (error) {
            console.error('File attach error:', error);
        }
    };

    const handleIrisMenuPress = () => {
        const newVisibility = !isMenuVisible;
        setIsMenuVisible(newVisibility);
        
        // Add haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        if (newVisibility) {
            // Opening animation
            backdropOpacity.value = withTiming(1, { duration: 200 });
            menuOpacity.value = withTiming(1, { duration: 200 });
            menuTranslateY.value = withSpring(0, {
                damping: 20,
                stiffness: 300,
            });
        } else {
            // Closing animation
            backdropOpacity.value = withTiming(0, { duration: 200 });
            menuOpacity.value = withTiming(0, { duration: 200 });
            menuTranslateY.value = withTiming(300, { duration: 200 });
        }
    };


    const removeFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Animated styles
    const backdropAnimatedStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const menuAnimatedStyle = useAnimatedStyle(() => ({
        opacity: menuOpacity.value,
        transform: [{ translateY: menuTranslateY.value }],
    }));

    const handleModeChange = (mode: IrisChatMode) => {
        setIrisMode(mode);
        Haptics.selectionAsync(); // Light haptic feedback for selection
    };

    const containerStyle = useAnimatedStyle(() => {
        const paddingBottom = interpolate(
            keyboardHeight.value,
            [0, 300],
            [Math.max(insets.bottom, 20), 10],
            Extrapolate.CLAMP
        );

        return {
            paddingBottom,
        };
    });

    const fakeViewStyle = useAnimatedStyle(() => {
        return {
            height: keyboardHeight.value,
        };
    });

    const shouldShowCancel = isSending || isGenerating;

    const prepareQuickChatAttachments = useCallback(async (): Promise<QuickChatAttachment[] | undefined> => {
        if (attachedFiles.length === 0) {
            return undefined;
        }

        const unsupported = attachedFiles.filter(file => !file.type?.startsWith('image/'));
        if (unsupported.length > 0) {
            const label = unsupported.map(file => file.name || 'Unknown file').join(', ');
            throw new Error(`Quick Chat currently supports images only. Remove unsupported files: ${label}`);
        }

        const encoded: QuickChatAttachment[] = [];

        for (const file of attachedFiles) {
            if (!file.localUri) {
                throw new Error(`Couldn't access ${file.name || 'attachment'}. Please reattach it.`);
            }

            try {
                const data = await FileSystem.readAsStringAsync(file.localUri, {
                    encoding: 'base64',
                });

                encoded.push({
                    name: file.name,
                    mimeType: file.type || 'image/jpeg',
                    data,
                });
            } catch (error) {
                console.error('[ChatInput] Failed to read attachment', error);
                throw new Error(`Failed to read ${file.name}. Please try again.`);
            }
        }

        return encoded;
    }, [attachedFiles]);

    return (
        <>
            <Animated.View style={[
                styles.container,
                {
                    backgroundColor: theme.sidebar,
                    borderTopLeftRadius: 30,
                    borderTopRightRadius: 30,
                    shadowColor: theme.border,
                    shadowOffset: { width: 0, height: -1 },
                    shadowOpacity: 1,
                    shadowRadius: 0,
                    paddingVertical: attachedFiles.length > 0 ? 0 : 12,
                },
                containerStyle
            ]}>
                <View style={[styles.inputContainer, { backgroundColor: theme.sidebar }]}>
                    {/* File attachments preview */}
                    {attachedFiles.length > 0 && (
                        <AttachmentGroup
                            attachments={attachedFiles}
                            layout="inline"
                            showPreviews={true}
                            maxHeight={100}
                            sandboxId={sandboxId}
                            onFilePress={(filepath) => {
                                // Don't remove on file press in inline mode, let X button handle it
                                console.log('File pressed:', filepath);
                            }}
                            onRemove={removeFile}
                        />
                    )}

                    <TextInput
                        style={[styles.textInput, { color: theme.foreground }]}
                        value={message}
                        onChangeText={setMessage}
                        placeholder={placeholder}
                        placeholderTextColor={theme.placeholderText}
                        multiline
                        maxLength={2000}
                        returnKeyType="send"
                        onSubmitEditing={handleSend}
                        blurOnSubmit={false}
                    />

                    <View style={styles.buttonContainer}>
                        <View style={styles.leftButtons}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={handleAttachPress}
                            >
                                <Paperclip size={20} strokeWidth={2} color={theme.placeholderText} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.irisButton}
                                onPress={handleIrisMenuPress}
                            >
                                <Text style={styles.irisButtonText}>Iris</Text>
                                <ChevronUp size={12} strokeWidth={2} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.rightButtons}>
                            <TouchableOpacity style={styles.actionButton} onPress={onMicPress}>
                                <Mic size={20} strokeWidth={2} color={theme.placeholderText} style={{ marginRight: 10 }} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.sendButton, {
                                    backgroundColor: shouldShowCancel || message.trim() || attachedFiles.length > 0
                                        ? 'rgba(255,255,255,0.1)' // bg-white/10
                                        : 'rgba(255,255,255,0.05)', // bg-white/5
                                    borderWidth: 1,
                                    borderColor: shouldShowCancel || message.trim() || attachedFiles.length > 0
                                        ? 'rgba(255,255,255,0.2)' // border-white/20
                                        : 'rgba(255,255,255,0.1)', // border-white/10
                                }]}
                                onPress={shouldShowCancel ? onCancelStream : handleSend}
                                disabled={!shouldShowCancel && !message.trim() && attachedFiles.length === 0}
                            >
                                {shouldShowCancel ? (
                                    <Square
                                        size={16}
                                        strokeWidth={2}
                                        color="rgba(255,255,255,0.9)" // text-white/90
                                        fill="rgba(255,255,255,0.9)"
                                    />
                                ) : (
                                    <Text style={styles.sendButtonText}>Send</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Animated.View>
            
            {/* Iris Menu Popup */}
            {isMenuVisible && (
                <Animated.View style={[styles.menuOverlay, backdropAnimatedStyle]}>
                    <TouchableOpacity 
                        style={styles.menuBackdrop} 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleIrisMenuPress();
                        }}
                        activeOpacity={1}
                    />
                    <Animated.View style={[styles.menuContainer, menuAnimatedStyle]}>
                        <View style={styles.menuHandle} />
                        <View style={styles.menuHeader}>
                            <Text style={styles.menuTitle}>Choose Iris Mode</Text>
                            <Text style={styles.menuSubtitle}>Select how you want Iris to help you</Text>
                        </View>
                        
                        {/* Mode Bubble Selector - Single bubble with separator */}
                        <View style={styles.modeSelectorContainer}>
                            <View style={styles.modeBubble}>
                                {modeOptions.map((option, index) => (
                                    <React.Fragment key={option.key}>
                                        <TouchableOpacity
                                            style={[
                                                styles.modeBubbleSegment,
                                                index === 0 && styles.modeBubbleLeft,
                                                index === modeOptions.length - 1 && styles.modeBubbleRight,
                                                irisMode === option.key && styles.modeBubbleSegmentActive,
                                            ]}
                                            onPress={() => handleModeChange(option.key)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[
                                                styles.modeBubbleText,
                                                irisMode === option.key && styles.modeBubbleTextActive
                                            ]}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                        {index < modeOptions.length - 1 && (
                                            <View style={styles.modeBubbleSeparator} />
                                        )}
                                    </React.Fragment>
                                ))}
                            </View>
                        </View>
                        
                    </Animated.View>
                </Animated.View>
            )}
            
            {/* Fake view that ALWAYS pushes content up */}
            <Animated.View style={fakeViewStyle} />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 10,
        paddingVertical: 0,
    },
    inputContainer: {
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    textInput: {
        fontSize: 16,
        maxHeight: 100,
        marginBottom: 8,
        ...Platform.select({
            ios: {
                paddingTop: 12,
            },
        }),
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    leftButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rightButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionButton: {
        width: 22,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    irisButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)', // bg-white/5
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)', // border-white/10
        gap: 4,
    },
    irisButtonText: {
        color: 'rgba(255,255,255,0.7)', // text-white/70
        fontSize: 13,
        fontWeight: '500',
    },
    sendButton: {
        width: 60,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonText: {
        color: 'rgba(255,255,255,0.9)', // text-white/90
        fontSize: 14,
        fontWeight: '600',
    },
    attachIcon: {
        width: 16,
        height: 16,
        borderRadius: 2,
    },
    micIcon: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    sendIcon: {
        width: 0,
        height: 0,
        borderStyle: 'solid',
        borderLeftWidth: 14,
        borderRightWidth: 0,
        borderBottomWidth: 7,
        borderTopWidth: 7,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
    },
    // Menu styles
    menuOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
    },
    menuBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    menuContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(10,14,22,0.95)', // Same glassmorphism background
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 34, // Safe area padding
    },
    menuHandle: {
        width: 36,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    menuHeader: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        alignItems: 'center',
    },
    menuTitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    menuSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
    },
    // Mode bubble selector styles - Single bubble with separator
    modeSelectorContainer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        alignItems: 'center',
    },
    modeBubble: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        overflow: 'hidden',
        minWidth: 280,
    },
    modeBubbleSegment: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeBubbleLeft: {
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
    },
    modeBubbleRight: {
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
    },
    modeBubbleSegmentActive: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    modeBubbleSeparator: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginVertical: 8,
    },
    modeBubbleText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        fontWeight: '500',
    },
    modeBubbleTextActive: {
        color: 'rgba(255,255,255,0.95)',
        fontWeight: '600',
    },
}); 
