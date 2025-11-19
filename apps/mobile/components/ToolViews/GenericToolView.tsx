import { useTheme } from '@/hooks/useThemeColor';
import React, { useMemo } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Body, Caption } from '../Typography';
import { Card, CardContent } from '../ui/Card';
import { ToolViewProps } from './ToolViewRegistry';
import { extractToolData, getToolTitle, formatTimestamp } from '@/utils/tool-utils';
import { Wrench, CheckCircle, AlertTriangle, Clock } from 'lucide-react-native';

interface GenericToolViewProps extends ToolViewProps {
    toolContent?: string;
    assistantContent?: string;
    assistantTimestamp?: string;
    toolTimestamp?: string;
}

export const GenericToolView: React.FC<GenericToolViewProps> = ({
    toolCall,
    toolContent,
    assistantContent,
    assistantTimestamp,
    toolTimestamp,
    isStreaming = false,
    isSuccess = true,
    name,
    ...props
}) => {
    const theme = useTheme();

    // Convert color-mix(in oklab, var(--muted) 20%, transparent) to hex
    const mutedBg = theme.muted === '#e8e8e8' ? '#e8e8e833' : '#30303033';

    const formatContent = useMemo(() => {
        const content = toolContent || assistantContent;
        if (!content) return null;

        // Use the new parser for backwards compatibility
        const { toolResult } = extractToolData(content);

        if (toolResult) {
            // Format the structured content nicely
            const formatted: any = {
                tool: toolResult.xmlTagName || toolResult.functionName,
            };

            if (toolResult.arguments && Object.keys(toolResult.arguments).length > 0) {
                formatted.parameters = toolResult.arguments;
            }

            if (toolResult.toolOutput) {
                formatted.output = toolResult.toolOutput;
            }

            if (toolResult.isSuccess !== undefined) {
                formatted.success = toolResult.isSuccess;
            }

            return JSON.stringify(formatted, null, 2);
        }

        // Fallback to legacy format handling
        if (typeof content === 'object') {
            // Check for direct structured format (legacy)
            if ('tool_name' in content || 'xml_tag_name' in content) {
                const formatted: any = {
                    tool: content.tool_name || content.xml_tag_name || 'unknown',
                };

                if (content.parameters && Object.keys(content.parameters).length > 0) {
                    formatted.parameters = content.parameters;
                }

                if (content.result) {
                    formatted.result = content.result;
                }

                return JSON.stringify(formatted, null, 2);
            }

            // Check if it has a content field that might contain the structured data (legacy)
            if ('content' in content && typeof content.content === 'object') {
                const innerContent = content.content;
                if ('tool_name' in innerContent || 'xml_tag_name' in innerContent) {
                    const formatted: any = {
                        tool: innerContent.tool_name || innerContent.xml_tag_name || 'unknown',
                    };

                    if (innerContent.parameters && Object.keys(innerContent.parameters).length > 0) {
                        formatted.parameters = innerContent.parameters;
                    }

                    if (innerContent.result) {
                        formatted.result = innerContent.result;
                    }

                    return JSON.stringify(formatted, null, 2);
                }
            }

            // Fall back to old format handling
            if (content.content && typeof content.content === 'string') {
                return content.content;
            }
            return JSON.stringify(content, null, 2);
        }

        if (typeof content === 'string') {
            try {
                const parsedJson = JSON.parse(content);
                return JSON.stringify(parsedJson, null, 2);
            } catch (e) {
                return content;
            }
        }

        return String(content);
    }, [toolContent, assistantContent]);

    const toolTitle = getToolTitle(name || 'generic-tool');
    const actualIsSuccess = useMemo(() => {
        const { toolResult } = extractToolData(toolContent || assistantContent);
        return toolResult ? toolResult.isSuccess : isSuccess;
    }, [toolContent, assistantContent, isSuccess]);

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
            padding: 16,
        },
        section: {
            marginBottom: 16,
        },
        sectionTitle: {
            color: theme.foreground,
            marginBottom: 8,
            fontWeight: '600' as const,
            fontSize: 14,
        },
        codeBlock: {
            backgroundColor: mutedBg,
            borderColor: theme.muted,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 8,
        },
        codeText: {
            color: theme.foreground,
            fontFamily: 'monospace',
            fontSize: 12,
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
    });

    if (!formatContent && !isStreaming) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <Wrench size={32} color={theme.mutedForeground} />
                    <Body style={styles.emptyText}>
                        No tool data available
                    </Body>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {formatContent && (
                    <View style={styles.section}>
                        <Body style={styles.sectionTitle}>
                            {toolContent ? 'Output' : 'Input'}
                        </Body>
                        <View style={styles.codeBlock}>
                            <Body style={styles.codeText}>
                                {formatContent}
                            </Body>
                        </View>
                    </View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {!isStreaming && (
                        <>
                            {actualIsSuccess ? (
                                <CheckCircle size={14} color={theme.accent} />
                            ) : (
                                <AlertTriangle size={14} color={theme.destructive} />
                            )}
                            <Caption style={styles.timestamp}>
                                {actualIsSuccess ? 'Success' : 'Failed'}
                            </Caption>
                        </>
                    )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} color={theme.mutedForeground} />
                    <Caption style={styles.timestamp}>
                        {toolTimestamp && !isStreaming
                            ? formatTimestamp(toolTimestamp)
                            : assistantTimestamp
                                ? formatTimestamp(assistantTimestamp)
                                : ''}
                    </Caption>
                </View>
            </View>
        </View>
    );
}; 