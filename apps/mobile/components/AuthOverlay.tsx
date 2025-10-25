import { fontWeights } from '@/constants/Fonts';
import { supabase } from '@/constants/SupabaseConfig';
import { useTheme } from '@/hooks/useThemeColor';
import { useAuth } from '@/hooks/useAuth';
import React, { useState, useEffect } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ScrollView,
    Image,
    Animated,
    Dimensions
} from 'react-native';
import { Card } from './ui/Card';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface AuthOverlayProps {
    visible: boolean;
    onClose: () => void;
}

export const AuthOverlay: React.FC<AuthOverlayProps> = ({ visible, onClose }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
    const [showSuccess, setShowSuccess] = useState(false);
    const [successEmail, setSuccessEmail] = useState('');
    const [rotationAnim] = useState(new Animated.Value(0));

    const theme = useTheme();
    const { signInWithGoogle, signInWithGitHub } = useAuth();
    const { width, height } = Dimensions.get('window');

    // Animation for rotating shapes
    useEffect(() => {
        const startRotation = () => {
            Animated.loop(
                Animated.timing(rotationAnim, {
                    toValue: 1,
                    duration: 30000,
                    useNativeDriver: true,
                })
            ).start();
        };
        startRotation();
    }, [rotationAnim]);

    const styles = StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: '#030712', // bg-gray-950 exact color
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
        },
        // Grid pattern background
        gridPattern: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.05,
        },
        // Background geometric shapes
        shapeContainer: {
            position: 'absolute',
            width: width,
            height: height,
        },
        rotatingShape: {
            position: 'absolute',
            borderWidth: 1,
            borderColor: 'rgba(173, 216, 255, 0.1)', // primary/10
            borderRadius: 200,
        },
        shape1: {
            width: 320,
            height: 320,
            top: -128,
            left: -128,
        },
        shape2: {
            width: 256,
            height: 256,
            top: -96,
            left: -96,
            borderColor: 'rgba(173, 216, 255, 0.15)', // primary/15
        },
        shape3: {
            width: 320,
            height: 320,
            bottom: -128,
            right: -128,
            transform: [{ rotate: '45deg' }],
        },
        shape4: {
            width: 256,
            height: 256,
            bottom: -96,
            right: -96,
            transform: [{ rotate: '45deg' }],
            borderColor: 'rgba(173, 216, 255, 0.15)', // primary/15
        },
        // Abstract lines
        lineContainer: {
            position: 'absolute',
            top: height / 2,
            left: 64,
            width: 400,
            height: 1,
        },
        line: {
            width: '100%',
            height: 1,
            backgroundColor: 'rgba(173, 216, 255, 0.2)', // primary/20
        },
        line1: {
            transform: [{ translateY: -48 }],
        },
        line2: {
            transform: [{ translateY: 48 }],
        },
        // Corner accents
        cornerAccent: {
            position: 'absolute',
            borderWidth: 2,
            borderColor: 'rgba(173, 216, 255, 0.1)', // primary/10
        },
        cornerTopRight: {
            top: 0,
            right: 0,
            width: 160,
            height: 160,
            borderTopWidth: 2,
            borderRightWidth: 2,
            borderBottomWidth: 0,
            borderLeftWidth: 0,
        },
        cornerBottomLeft: {
            bottom: 0,
            left: 0,
            width: 160,
            height: 160,
            borderBottomWidth: 2,
            borderLeftWidth: 2,
            borderTopWidth: 0,
            borderRightWidth: 0,
        },
        // Main card container
        cardContainer: {
            width: '100%',
            maxWidth: 400,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(10, 14, 22, 0.8)', // More opaque for better visibility
            overflow: 'hidden',
            position: 'relative',
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 20,
            },
            shadowOpacity: 0.8,
            shadowRadius: 30,
            elevation: 20,
        },
        // Gradient border effect
        gradientBorder: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 24,
            padding: 1,
        },
        // Top glow effect
        topGlow: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 96,
            opacity: 0.22,
        },
        // Noise texture overlay
        noiseTexture: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.3,
            backgroundColor: 'transparent',
        },
        // Corner dots
        cornerDot: {
            position: 'absolute',
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
        },
        dotTopLeft: { top: 12, left: 12 },
        dotTopRight: { top: 12, right: 12 },
        dotBottomLeft: { bottom: 12, left: 12 },
        dotBottomRight: { bottom: 12, right: 12 },
        // Content styles
        content: {
            padding: 32,
        },
        header: {
            alignItems: 'center',
            marginBottom: 32,
        },
        logo: {
            marginBottom: 24,
        },
        title: {
            fontSize: 24,
            fontFamily: fontWeights[600],
            color: 'rgba(255, 255, 255, 0.9)',
            textAlign: 'center',
            marginBottom: 8,
        },
        subtitle: {
            fontSize: 14,
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
        },
        // Form styles
        form: {
            gap: 24,
        },
        inputGroup: {
            gap: 8,
        },
        label: {
            fontSize: 14,
            fontFamily: fontWeights[500],
            color: 'rgba(255, 255, 255, 0.8)',
        },
        input: {
            height: 36,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: 'rgba(100, 116, 139, 0.4)', // navy-600/40
            backgroundColor: 'rgba(30, 41, 59, 0.3)', // navy-800/30
            paddingHorizontal: 12,
            fontSize: 14,
            color: 'rgba(255, 255, 255, 1)',
        },
        inputFocused: {
            borderColor: 'rgba(173, 216, 255, 0.5)', // primary/50
        },
        forgotPassword: {
            alignItems: 'flex-end',
        },
        forgotText: {
            fontSize: 14,
            color: '#ADD8FF', // primary color
        },
        // Button styles
        button: {
            height: 40,
            borderRadius: 8,
            backgroundColor: '#ADD8FF', // primary color
            alignItems: 'center',
            justifyContent: 'center',
        },
        buttonDisabled: {
            opacity: 0.6,
        },
        buttonText: {
            fontSize: 14,
            fontFamily: fontWeights[500],
            color: '#000000',
        },
        // Divider
        divider: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 24,
        },
        dividerLine: {
            flex: 1,
            height: 1,
            backgroundColor: 'rgba(100, 116, 139, 0.3)', // navy-600/30
        },
        dividerText: {
            paddingHorizontal: 16,
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.5)',
            textTransform: 'uppercase',
        },
        // Social buttons
        socialButton: {
            height: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        socialButtonText: {
            fontSize: 14,
            fontFamily: fontWeights[500],
            color: 'rgba(255, 255, 255, 0.9)',
        },
        // Switch mode text
        switchText: {
            fontSize: 14,
            color: 'rgba(255, 255, 255, 0.6)',
            textAlign: 'center',
        },
        switchLink: {
            color: '#ADD8FF', // primary color
        },
        // Close button
        closeButton: {
            position: 'absolute',
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
        },
        closeText: {
            fontSize: 16,
            color: 'rgba(255, 255, 255, 0.7)',
        },
        // Success screen styles
        successContainer: {
            alignItems: 'center',
        },
        successIcon: {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#10B981',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
        },
        successIconText: {
            fontSize: 28,
            color: '#ffffff',
        },
        successTitle: {
            fontSize: 24,
            fontFamily: fontWeights[600],
            color: 'rgba(255, 255, 255, 0.9)',
            textAlign: 'center',
            marginBottom: 8,
        },
        successDescription: {
            fontSize: 15,
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
            marginBottom: 6,
            lineHeight: 20,
        },
        successEmail: {
            fontSize: 15,
            fontFamily: fontWeights[600],
            color: 'rgba(255, 255, 255, 0.9)',
            textAlign: 'center',
            marginBottom: 16,
        },
        successNote: {
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 0.2)',
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 20,
        },
        successNoteText: {
            fontSize: 13,
            color: '#059669',
            textAlign: 'center',
            lineHeight: 18,
        },
        successButtonContainer: {
            width: '100%',
            gap: 8,
        },
        // Legal text
        legalText: {
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.6)',
            textAlign: 'center',
            marginTop: 12,
            lineHeight: 14,
            paddingHorizontal: 4,
        },
        legalLink: {
            color: '#ADD8FF', // primary color
        },
    });

    const handleAuth = async () => {
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email');
            return;
        }

        if (mode !== 'forgot' && !password.trim()) {
            Alert.alert('Error', 'Please enter your password');
            return;
        }

        setLoading(true);

        try {
            if (mode === 'signup') {
                if (password !== confirmPassword) {
                    Alert.alert('Error', 'Passwords do not match');
                    return;
                }
                if (password.length < 6) {
                    Alert.alert('Error', 'Password must be at least 6 characters');
                    return;
                }

                const { error } = await supabase.auth.signUp({
                    email: email.trim(),
                    password: password.trim(),
                });

                if (error) {
                    Alert.alert('Sign Up Error', error.message);
                } else {
                    setSuccessEmail(email.trim());
                    setShowSuccess(true);
                }
            } else if (mode === 'forgot') {
                const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

                if (error) {
                    Alert.alert('Error', error.message);
                } else {
                    Alert.alert('Success', 'Check your email for a password reset link');
                    setMode('signin');
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password: password.trim(),
                });

                if (error) {
                    if (error.message === 'Email not confirmed') {
                        Alert.alert(
                            'Email Not Confirmed',
                            'Please check your email and click the confirmation link before signing in.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Resend Email',
                                    onPress: async () => {
                                        const { error: resendError } = await supabase.auth.resend({
                                            type: 'signup',
                                            email: email.trim()
                                        });

                                        if (resendError) {
                                            Alert.alert('Error', resendError.message);
                                        } else {
                                            Alert.alert('Success', 'Confirmation email sent! Please check your inbox.');
                                        }
                                    }
                                }
                            ]
                        );
                    } else {
                        Alert.alert('Sign In Error', error.message);
                    }
                } else {
                    onClose();
                }
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setMode('signin');
        setShowSuccess(false);
        setSuccessEmail('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleBackToSignIn = () => {
        setShowSuccess(false);
        setSuccessEmail('');
        setMode('signin');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
    };

    const rotation = rotationAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <Modal visible={visible} transparent animationType="fade">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                {/* Grid pattern background */}
                <View style={styles.gridPattern}>
                    {/* Create grid lines using multiple Views */}
                    {Array.from({ length: Math.ceil(width / 20) }, (_, i) => (
                        <View
                            key={`v-${i}`}
                            style={{
                                position: 'absolute',
                                left: i * 20,
                                top: 0,
                                bottom: 0,
                                width: 1,
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            }}
                        />
                    ))}
                    {Array.from({ length: Math.ceil(height / 20) }, (_, i) => (
                        <View
                            key={`h-${i}`}
                            style={{
                                position: 'absolute',
                                top: i * 20,
                                left: 0,
                                right: 0,
                                height: 1,
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            }}
                        />
                    ))}
                </View>

                {/* Background geometric shapes */}
                <View style={styles.shapeContainer}>
                    <Animated.View style={[styles.rotatingShape, styles.shape1, { transform: [{ rotate: rotation }] }]} />
                    <Animated.View style={[styles.rotatingShape, styles.shape2, { transform: [{ rotate: rotation }] }]} />
                    <Animated.View style={[styles.rotatingShape, styles.shape3, { transform: [{ rotate: rotation }] }]} />
                    <Animated.View style={[styles.rotatingShape, styles.shape4, { transform: [{ rotate: rotation }] }]} />
                </View>

                {/* Abstract lines */}
                <View style={styles.lineContainer}>
                    <View style={[styles.line, styles.line1]} />
                    <View style={[styles.line, styles.line2]} />
                </View>

                {/* Corner accents */}
                <View style={[styles.cornerAccent, styles.cornerTopRight]} />
                <View style={[styles.cornerAccent, styles.cornerBottomLeft]} />

                {/* Main card */}
                <View style={styles.cardContainer}>
                    {/* Gradient border effect */}
                    <LinearGradient
                        colors={['rgba(173,216,255,0.18)', 'rgba(255,255,255,0.04)', 'rgba(150,160,255,0.14)', 'rgba(255,255,255,0.06)']}
                        locations={[0, 0.3, 0.85, 1]}
                        style={styles.gradientBorder}
                    />

                    {/* Top glow effect */}
                    <LinearGradient
                        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
                        locations={[0, 0.45, 1]}
                        style={styles.topGlow}
                    />

                    {/* Noise texture overlay */}
                    <View style={styles.noiseTexture}>
                        {Array.from({ length: 200 }, (_, i) => (
                            <View
                                key={`noise-${i}`}
                                style={{
                                    position: 'absolute',
                                    left: Math.random() * 400,
                                    top: Math.random() * 600,
                                    width: Math.random() * 2 + 0.5,
                                    height: Math.random() * 2 + 0.5,
                                    backgroundColor: `rgba(255, 255, 255, ${Math.random() * 0.1 + 0.02})`,
                                    borderRadius: 1,
                                }}
                            />
                        ))}
                    </View>

                    {/* Corner dots */}
                    <View style={[styles.cornerDot, styles.dotTopLeft]} />
                    <View style={[styles.cornerDot, styles.dotTopRight]} />
                    <View style={[styles.cornerDot, styles.dotBottomLeft]} />
                    <View style={[styles.cornerDot, styles.dotBottomRight]} />

                    {/* Close button */}
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>

                    <View style={styles.content}>
                        {showSuccess ? (
                            <View style={styles.successContainer}>
                                <View style={styles.successIcon}>
                                    <Text style={styles.successIconText}>✉</Text>
                                </View>

                                <Text style={styles.successTitle}>Check your email</Text>

                                <Text style={styles.successDescription}>
                                    We&apos;ve sent a confirmation link to:
                                </Text>

                                <Text style={styles.successEmail}>{successEmail}</Text>

                                <View style={styles.successNote}>
                                    <Text style={styles.successNoteText}>
                                    Click the link in the email to activate your account. If you don&apos;t see the email, check your spam folder.
                                    </Text>
                                </View>

                                <View style={styles.successButtonContainer}>
                                    <TouchableOpacity style={styles.button} onPress={handleBackToSignIn}>
                                        <Text style={styles.buttonText}>Back to Sign In</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ADD8FF' }]}
                                        onPress={handleClose}
                                    >
                                        <Text style={[styles.buttonText, { color: '#ADD8FF' }]}>Close</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <>
                                {/* Header */}
                                <View style={styles.header}>
                                    <View style={styles.logo}>
                                        <Image
                                            source={require('@/assets/images/irislogowhitebig.png')}
                                            style={{ width: 120, height: 22 }}
                                            resizeMode="contain"
                                        />
                                    </View>
                                    <Text style={styles.title}>
                                        {mode === 'signup' ? 'Create your account' : 'Welcome back'}
                                    </Text>
                                    <Text style={styles.subtitle}>
                                        {mode === 'signup' ? 'Sign up to get started with Iris' : 'Sign in to your account to continue'}
                                    </Text>
                                </View>

                                {/* Form */}
                                <View style={styles.form}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Email</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Enter your email"
                                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                                            value={email}
                                            onChangeText={setEmail}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                    </View>

                                    {mode !== 'forgot' && (
                                        <View style={styles.inputGroup}>
                                            <Text style={styles.label}>Password</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Enter your password"
                                                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                                                value={password}
                                                onChangeText={setPassword}
                                                secureTextEntry
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                            />
                                        </View>
                                    )}

                                    {mode === 'signup' && (
                                        <View style={styles.inputGroup}>
                                            <Text style={styles.label}>Confirm Password</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Confirm your password"
                                                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                                secureTextEntry
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                            />
                                        </View>
                                    )}

                                    {mode === 'signin' && (
                                        <View style={styles.forgotPassword}>
                                            <TouchableOpacity onPress={() => setMode('forgot')}>
                                                <Text style={styles.forgotText}>Forgot password?</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        style={[styles.button, loading && styles.buttonDisabled]}
                                        onPress={handleAuth}
                                        disabled={loading}
                                    >
                                        <Text style={styles.buttonText}>
                                            {loading ? 'Loading...' : mode === 'signup' ? 'Sign up' : mode === 'forgot' ? 'Send Reset Link' : 'Sign in'}
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Divider */}
                                    <View style={styles.divider}>
                                        <View style={styles.dividerLine} />
                                        <Text style={styles.dividerText}>or continue with email</Text>
                                        <View style={styles.dividerLine} />
                                    </View>

                                    {/* Social buttons */}
                                    <TouchableOpacity style={styles.socialButton} onPress={signInWithGoogle}>
                                        <Text style={styles.socialButtonText}>Continue with Google</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.socialButton} onPress={signInWithGitHub}>
                                        <Text style={styles.socialButtonText}>Continue with GitHub</Text>
                                    </TouchableOpacity>

                                    {/* Switch mode text */}
                                    <Text style={styles.switchText}>
                                        {mode === 'signup' ? (
                                            <>
                                                Already have an account?{' '}
                                                <Text style={styles.switchLink} onPress={() => setMode('signin')}>
                                                    Sign in
                                                </Text>
                                            </>
                                        ) : mode === 'forgot' ? (
                                            <>
                                                <Text style={styles.switchLink} onPress={() => setMode('signin')}>
                                                    Back to Sign In
                                                </Text>
                                            </>
                                        ) : (
                                            <>
                                                Don't have an account?{' '}
                                                <Text style={styles.switchLink} onPress={() => setMode('signup')}>
                                                    Sign up
                                                </Text>
                                            </>
                                        )}
                                    </Text>

                                    {/* Legal text */}
                                    <Text style={styles.legalText}>
                                        By continuing, you agree to our{' '}
                                        <Text
                                            style={styles.legalLink}
                                            onPress={() => Linking.openURL('https://irisvision.ai/legal?tab=terms')}
                                        >
                                            Terms of Service
                                        </Text>
                                        {' '}and{' '}
                                        <Text
                                            style={styles.legalLink}
                                            onPress={() => Linking.openURL('https://irisvision.ai/legal?tab=privacy')}
                                        >
                                            Privacy Policy
                                        </Text>
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}; 