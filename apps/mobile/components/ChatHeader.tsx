import { useTheme } from '@/hooks/useThemeColor';
import { PanelLeft, PanelRightOpen } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H6 } from './Typography';

interface ChatHeaderProps {
    onMenuPress?: () => void;
    onSettingsPress?: () => void;
    selectedProject?: { id: string; name: string } | null;
    title?: string;
    centerContent?: React.ReactNode;
    rightContent?: React.ReactNode;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    onMenuPress,
    onSettingsPress,
    selectedProject,
    title,
    centerContent,
    rightContent,
}) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, {
            backgroundColor: 'transparent', // Make header transparent
            borderBottomColor: theme.border,
            paddingTop: insets.top + 12,
        }]}>
            <TouchableOpacity style={styles.button} onPress={onMenuPress}>
                <PanelLeft size={20} color={theme.foreground} />
            </TouchableOpacity>

            <View style={styles.centerContainer}>
                {centerContent ? (
                    centerContent
                ) : (
                    <H6 style={{ color: theme.foreground }}>
                        {title || selectedProject?.name || 'Iris'}
                    </H6>
                )}
            </View>

            {rightContent ? (
                rightContent
            ) : (
                <TouchableOpacity style={styles.button} onPress={onSettingsPress}>
                    <PanelRightOpen size={20} color={theme.foreground} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
    },
    button: {
        padding: 8,
        borderRadius: 8,
    },
});
