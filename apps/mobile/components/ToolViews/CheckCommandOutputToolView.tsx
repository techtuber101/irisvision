import { useTheme } from '@/hooks/useThemeColor';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { Body, Caption } from '../Typography';
import { ToolViewProps } from './ToolViewRegistry';
import { formatTimestamp, getToolTitle } from '@/utils/tool-utils';
import { extractToolData } from '@/utils/tool-utils';
import { Terminal, CheckCircle, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react-native';

interface CheckCommandOutputData {
    sessionName: string | null;
    output: string | null;
    status: string | null;
    success: boolean;
    timestamp?: string;
}

function extractCheckCommandOutputData(
    assistantContent: any,
    toolContent: any,
    isSuccess: boolean,
    toolTimestamp?: string,
    assistantTimestamp?: string
): CheckCommandOutputData {
    let sessionName: string | null = null;
    let output: string | null = null;
    let status: string | null = null;
    let actualIsSuccess = isSuccess;
    const actualTimestamp = toolTimestamp || assistantTimestamp;

    // Parse content to extract data
    const parseContent = (content: any): any => {
        if (typeof content === 'string') {
            try {
                return JSON.parse(content);
            } catch (e) {
                return content;
            }
        }
        return content;
    };

    // Try to extract from tool content first (most likely to have the result)
    const toolParsed = parseContent(toolContent);

    if (toolParsed && typeof toolParsed === 'object') {
        // First, try to extract directly from tool_execution (the actual format being used)
        if (toolParsed.tool_execution && toolParsed.tool_execution.result) {
            const result = toolParsed.tool_execution.result;
            const args = toolParsed.tool_execution.arguments || {};
            
            if (result.output && typeof result.output === 'object') {
                sessionName = result.output.session_name || args.session_name || null;
                output = result.output.output || null;
                status = result.output.status || null;
            } else if (typeof result.output === 'string') {
                output = result.output;
                sessionName = args.session_name || null;
            }
            
            actualIsSuccess = result.success !== undefined ? result.success : actualIsSuccess;
        }
        // Handle the case where content is a JSON string
        else if (toolParsed.content && typeof toolParsed.content === 'string') {
            try {
                const contentParsed = JSON.parse(toolParsed.content);
                if (contentParsed.tool_execution) {
                    const toolExecution = contentParsed.tool_execution;

                    if (toolExecution.result && toolExecution.result.output) {
                        if (typeof toolExecution.result.output === 'object') {
                            const nestedOutput = toolExecution.result.output;
                            output = nestedOutput.output || null;
                            sessionName = nestedOutput.session_name || null;
                            status = nestedOutput.status || null;
                        } else if (typeof toolExecution.result.output === 'string') {
                            output = toolExecution.result.output;
                        }
                        actualIsSuccess = toolExecution.result.success !== undefined ? toolExecution.result.success : actualIsSuccess;
                    }

                    if (!sessionName && toolExecution.arguments) {
                        sessionName = toolExecution.arguments.session_name || null;
                    }
                }
            } catch (e) {
                console.error('Failed to parse toolContent.content:', e);
            }
        }
    }

    // Fallback to assistant content if no data found in tool content
    if (!output && !sessionName) {
        const assistantParsed = parseContent(assistantContent);
        if (assistantParsed && typeof assistantParsed === 'object' && assistantParsed.tool_execution) {
            const toolExecution = assistantParsed.tool_execution;
            if (toolExecution.result && toolExecution.result.output) {
                if (typeof toolExecution.result.output === 'object') {
                    const nestedOutput = toolExecution.result.output;
                    output = nestedOutput.output || null;
                    sessionName = nestedOutput.session_name || null;
                    status = nestedOutput.status || null;
                } else if (typeof toolExecution.result.output === 'string') {
                    output = toolExecution.result.output;
                }
            }
            if (!sessionName && toolExecution.arguments) {
                sessionName = toolExecution.arguments.session_name || null;
            }
        }
    }

    return {
        sessionName,
        output,
        status,
        success: actualIsSuccess,
        timestamp: actualTimestamp
    };
}

export function CheckCommandOutputToolView({
    name = 'check-command-output',
    assistantContent,
    toolContent,
    assistantTimestamp,
    toolTimestamp,
    isSuccess = true,
    isStreaming = false,
}: ToolViewProps) {
    const theme = useTheme();
    const [showFullOutput, setShowFullOutput] = useState(true);

    const {
        sessionName,
        output,
        status,
        success: actualIsSuccess,
        timestamp: actualTimestamp
    } = extractCheckCommandOutputData(
        assistantContent,
        toolContent,
        isSuccess,
        toolTimestamp,
        assistantTimestamp
    );

    const toolTitle = getToolTitle(name);

    const formattedOutput = useMemo(() => {
        if (!output) return [];

        let processedOutput = output;

        if (typeof output === 'object' && output !== null) {
            try {
                processedOutput = JSON.stringify(output, null, 2);
            } catch (e) {
                processedOutput = String(output);
            }
        } else if (typeof output === 'string') {
            try {
                if (output.trim().startsWith('{') || output.trim().startsWith('[')) {
                    const parsed = JSON.parse(output);
                    if (parsed && typeof parsed === 'object') {
                        processedOutput = JSON.stringify(parsed, null, 2);
                    } else {
                        processedOutput = String(parsed);
                    }
                } else {
                    processedOutput = output;
                }
            } catch (e) {
                processedOutput = output;
            }
        } else {
            processedOutput = String(output);
        }

        // Clean up escape sequences
        processedOutput = processedOutput.replace(/\\\\/g, '\\');
        processedOutput = processedOutput
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'");

        processedOutput = processedOutput.replace(/\\u([0-9a-fA-F]{4})/g, (_match, group) => {
            return String.fromCharCode(parseInt(group, 16));
        });

        return processedOutput.split('\n');
    }, [output]);

    const hasMoreLines = formattedOutput.length > 10;
    const previewLines = formattedOutput.slice(0, 10);
    const linesToShow = showFullOutput ? formattedOutput : previewLines;

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 32,
        },
        emptyText: {
            fontSize: 16,
            color: theme.mutedForeground,
            textAlign: 'center',
        },
        content: {
            flex: 1,
        },
        terminalHeader: {
            backgroundColor: theme.muted,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        terminalContent: {
            backgroundColor: theme.background,
            padding: 16,
        },
        outputText: {
            fontFamily: 'monospace',
            fontSize: 12,
            color: theme.foreground,
            lineHeight: 18,
        },
        footer: {
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.sidebar,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        timestamp: {
            fontSize: 11,
            color: theme.mutedForeground,
        },
        toggleButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 4,
            backgroundColor: theme.muted + '40',
        },
    });

    if (isStreaming) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <Terminal size={32} color={theme.mutedForeground} />
                    <Body style={styles.emptyText}>Checking command output...</Body>
                </View>
            </View>
        );
    }

    if (!sessionName) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <Terminal size={32} color={theme.mutedForeground} />
                    <Body style={styles.emptyText}>No session found</Body>
                    <Caption style={{ color: theme.mutedForeground, marginTop: 8 }}>
                        No session name was detected
                    </Caption>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.terminalHeader}>
                <Terminal size={16} color={theme.foreground} />
                <Body style={{ color: theme.foreground, fontWeight: '600' }}>
                    Terminal Session
                </Body>
                <Caption style={{ color: theme.mutedForeground }}>
                    ({sessionName})
                </Caption>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.terminalContent}>
                    {linesToShow.map((line, index) => (
                        <Body key={index} style={styles.outputText}>
                            {line}
                            {'\n'}
                        </Body>
                    ))}
                    {!showFullOutput && hasMoreLines && (
                        <TouchableOpacity
                            style={styles.toggleButton}
                            onPress={() => setShowFullOutput(true)}
                        >
                            <ChevronDown size={14} color={theme.foreground} />
                            <Caption style={{ color: theme.foreground }}>
                                + {formattedOutput.length - 10} more lines
                            </Caption>
                        </TouchableOpacity>
                    )}
                    {showFullOutput && hasMoreLines && (
                        <TouchableOpacity
                            style={styles.toggleButton}
                            onPress={() => setShowFullOutput(false)}
                        >
                            <ChevronUp size={14} color={theme.foreground} />
                            <Caption style={{ color: theme.foreground }}>
                                Show less
                            </Caption>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {actualIsSuccess ? (
                        <CheckCircle size={14} color={theme.accent} />
                    ) : (
                        <AlertTriangle size={14} color={theme.destructive} />
                    )}
                    <Caption style={styles.timestamp}>
                        {actualIsSuccess ? 'Output retrieved' : 'Failed'}
                    </Caption>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} color={theme.mutedForeground} />
                    <Caption style={styles.timestamp}>
                        {actualTimestamp ? formatTimestamp(actualTimestamp) : ''}
                    </Caption>
                </View>
            </View>
        </View>
    );
}

