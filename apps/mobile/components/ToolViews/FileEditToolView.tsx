import { useTheme } from '@/hooks/useThemeColor';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Body, Caption } from '../Typography';
import { ToolViewProps } from './ToolViewRegistry';
import { formatTimestamp, getToolTitle } from '@/utils/tool-utils';
import { FileDiff, CheckCircle, AlertTriangle, Clock, Code, Eye } from 'lucide-react-native';
import { TabSwitcher } from '../ui/TabSwitcher';
import { CodeRenderer } from '../renderers/CodeRenderer';

interface FileEditData {
    filePath: string | null;
    originalContent: string | null;
    updatedContent: string | null;
    actualIsSuccess: boolean;
    actualToolTimestamp?: string;
    errorMessage?: string;
}

function extractFileEditData(
    assistantContent: any,
    toolContent: any,
    isSuccess: boolean,
    toolTimestamp?: string,
    assistantTimestamp?: string
): FileEditData {
    const parseContent = (content: any): any => {
        if (typeof content === 'string') {
            try {
                return JSON.parse(content);
            } catch {
                return content;
            }
        }
        return content;
    };

    const parseOutput = (output: any): any => {
        if (typeof output === 'string') {
            try {
                return JSON.parse(output);
            } catch {
                return output;
            }
        }
        return output;
    };

    const extractData = (content: any) => {
        let parsed = parseContent(content);

        if (parsed?.role && parsed?.content) {
            parsed = typeof parsed.content === 'string' ? parseContent(parsed.content) : parsed.content;
        }

        if (parsed?.tool_execution) {
            const args = parsed.tool_execution.arguments || {};
            const output = parseOutput(parsed.tool_execution.result?.output);
            const success = parsed.tool_execution.result?.success;

            let errorMessage: string | undefined;
            if (success === false) {
                if (typeof output === 'object' && output !== null && output.message) {
                    errorMessage = output.message;
                } else if (typeof output === 'string') {
                    errorMessage = output;
                } else {
                    errorMessage = JSON.stringify(output);
                }
            }

            return {
                filePath: args.target_file || (typeof output === 'object' && output?.file_path) || null,
                originalContent: (typeof output === 'object' && output?.original_content) ?? null,
                updatedContent: (typeof output === 'object' && output?.updated_content) ?? null,
                success: success,
                timestamp: parsed.tool_execution.execution_details?.timestamp,
                errorMessage: errorMessage,
            };
        }

        if (typeof parsed === 'object' && parsed !== null && (parsed.original_content !== undefined || parsed.updated_content !== undefined)) {
            return {
                filePath: parsed.file_path || null,
                originalContent: parsed.original_content ?? null,
                updatedContent: parsed.updated_content ?? null,
                success: parsed.updated_content !== null,
                timestamp: null,
                errorMessage: parsed.message,
            };
        }
        return {};
    };

    const toolData = extractData(toolContent);
    const assistantData = extractData(assistantContent);

    const filePath = toolData.filePath || assistantData.filePath;
    const originalContent = toolData.originalContent || assistantData.originalContent;
    const updatedContent = toolData.updatedContent || assistantData.updatedContent;
    const errorMessage = toolData.errorMessage || assistantData.errorMessage;
    const actualIsSuccess = toolData.success !== undefined ? toolData.success : (assistantData.success !== undefined ? assistantData.success : isSuccess);
    const actualToolTimestamp = toolData.timestamp || assistantData.timestamp || toolTimestamp || assistantTimestamp;

    return {
        filePath,
        originalContent,
        updatedContent,
        actualIsSuccess,
        actualToolTimestamp,
        errorMessage,
    };
}

export function FileEditToolView({
    name = 'edit-file',
    assistantContent,
    toolContent,
    assistantTimestamp,
    toolTimestamp,
    isSuccess = true,
    isStreaming = false,
}: ToolViewProps) {
    const theme = useTheme();
    const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');

    const {
        filePath,
        originalContent,
        updatedContent,
        actualIsSuccess,
        actualToolTimestamp,
        errorMessage,
    } = extractFileEditData(
        assistantContent,
        toolContent,
        isSuccess,
        toolTimestamp,
        assistantTimestamp
    );

    const toolTitle = getToolTitle(name);
    const fileName = filePath ? filePath.split('/').pop() || filePath : 'Unknown file';

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
        codeBlock: {
            backgroundColor: theme.muted + '20',
            borderColor: theme.muted,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            margin: 16,
        },
        codeText: {
            fontFamily: 'monospace',
            fontSize: 12,
            color: theme.foreground,
            lineHeight: 18,
        },
        diffContainer: {
            padding: 16,
        },
        diffLine: {
            flexDirection: 'row',
            marginBottom: 2,
        },
        addedLine: {
            backgroundColor: theme.accent + '20',
        },
        removedLine: {
            backgroundColor: theme.destructive + '20',
        },
        unchangedLine: {
            backgroundColor: 'transparent',
        },
        lineNumber: {
            width: 40,
            color: theme.mutedForeground,
            fontSize: 11,
            fontFamily: 'monospace',
            textAlign: 'right',
            paddingRight: 8,
        },
        lineContent: {
            flex: 1,
            fontFamily: 'monospace',
            fontSize: 12,
            color: theme.foreground,
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

    if (isStreaming) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <FileDiff size={32} color={theme.mutedForeground} />
                    <Body style={styles.emptyText}>Applying file edit...</Body>
                </View>
            </View>
        );
    }

    if (!filePath && !updatedContent) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <FileDiff size={32} color={theme.mutedForeground} />
                    <Body style={styles.emptyText}>No file edit data available</Body>
                </View>
            </View>
        );
    }

    if (errorMessage || !actualIsSuccess) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <AlertTriangle size={32} color={theme.destructive} />
                    <Body style={[styles.emptyText, { color: theme.destructive }]}>
                        {errorMessage || 'File edit failed'}
                    </Body>
                </View>
            </View>
        );
    }

    const renderCodeView = () => {
        if (!updatedContent) {
            return (
                <View style={styles.emptyState}>
                    <Body style={styles.emptyText}>No content to display</Body>
                </View>
            );
        }

        return (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.codeBlock}>
                    <CodeRenderer
                        content={updatedContent}
                        language={fileName.split('.').pop() || 'text'}
                    />
                </View>
            </ScrollView>
        );
    };

    const renderPreviewView = () => {
        if (!updatedContent) {
            return (
                <View style={styles.emptyState}>
                    <Body style={styles.emptyText}>No content to preview</Body>
                </View>
            );
        }

        // Simple diff view
        if (originalContent && updatedContent) {
            const originalLines = originalContent.split('\n');
            const updatedLines = updatedContent.split('\n');
            const maxLines = Math.max(originalLines.length, updatedLines.length);

            return (
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.diffContainer}>
                        {Array.from({ length: maxLines }, (_, i) => {
                            const origLine = originalLines[i];
                            const updatedLine = updatedLines[i];
                            const isChanged = origLine !== updatedLine;
                            const isAdded = !origLine && updatedLine;
                            const isRemoved = origLine && !updatedLine;

                            return (
                                <View
                                    key={i}
                                    style={[
                                        styles.diffLine,
                                        isAdded ? styles.addedLine : isRemoved ? styles.removedLine : styles.unchangedLine,
                                    ]}
                                >
                                    <Body style={styles.lineNumber}>{i + 1}</Body>
                                    <Body style={styles.lineContent}>
                                        {updatedLine || origLine || ''}
                                    </Body>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            );
        }

        return renderCodeView();
    };

    return (
        <View style={styles.container}>
            <TabSwitcher
                tabs={[
                    { id: 'code', label: 'Source', icon: Code },
                    { id: 'preview', label: 'Preview', icon: Eye },
                ]}
                activeTab={activeTab}
                onTabChange={(tab) => setActiveTab(tab as 'code' | 'preview')}
            />

            {activeTab === 'code' ? renderCodeView() : renderPreviewView()}

            <View style={styles.footer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {actualIsSuccess ? (
                        <CheckCircle size={14} color={theme.accent} />
                    ) : (
                        <AlertTriangle size={14} color={theme.destructive} />
                    )}
                    <Caption style={styles.timestamp}>
                        {actualIsSuccess ? 'Edit successful' : 'Edit failed'}
                    </Caption>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} color={theme.mutedForeground} />
                    <Caption style={styles.timestamp}>
                        {actualToolTimestamp ? formatTimestamp(actualToolTimestamp) : ''}
                    </Caption>
                </View>
            </View>
        </View>
    );
}

