import { Colors } from '@/constants/Colors';
import { fontWeights } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/hooks/useAuth';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from 'react-native';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset-sent';

const brandImage = require('@/assets/images/irislogowhitebig.png');

const modeCopy: Record<AuthMode, { title: string; subtitle: string; cta: string }> = {
  signin: {
    title: 'Welcome back',
    subtitle: 'Sign in with the credentials you already use on web.',
    cta: 'Sign in',
  },
  signup: {
    title: 'Create your Iris account',
    subtitle: 'Join Iris to collaborate with your copilots everywhere.',
    cta: 'Create account',
  },
  forgot: {
    title: 'Reset your password',
    subtitle: 'Enter the email tied to your account and we’ll send reset instructions.',
    cta: 'Send reset link',
  },
  'reset-sent': {
    title: 'Check your inbox',
    subtitle: 'We just emailed you a secure link to reset your password.',
    cta: 'Back to sign in',
  },
};

export const LoginScreen: React.FC = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const isDarkMode = (colorScheme ?? 'light') === 'dark';
  const {
    user,
    authLoading,
    signInWithPassword,
    signUpWithPassword,
    sendPasswordResetEmail,
    signInWithGoogle,
    signInWithGitHub,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      router.replace('/(app)');
    }
  }, [router, user]);

  const styles = useMemo(() => createStyles(palette, isDarkMode), [palette, isDarkMode]);

  const setModeWithReset = useCallback((next: AuthMode) => {
    setMode(next);
    setError(null);
    setMessage(null);
    if (next === 'signin') {
      setPassword('');
      setConfirmPassword('');
    }
  }, []);

  const validateInputs = useCallback(() => {
    if (!email.trim()) {
      throw new Error('Please enter your email address.');
    }
    if (mode === 'signin') {
      if (!password.trim()) {
        throw new Error('Password is required to sign in.');
      }
    }
    if (mode === 'signup') {
      if (!password.trim()) {
        throw new Error('Choose a secure password to continue.');
      }
      if (password.length < 6) {
        throw new Error('Password must contain at least 6 characters.');
      }
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }
    }
  }, [mode, email, password, confirmPassword]);

  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();
    setError(null);
    setMessage(null);

    try {
      if (mode === 'reset-sent') {
        setModeWithReset('signin');
        return;
      }

      validateInputs();

      if (mode === 'signin') {
        await signInWithPassword(email.trim(), password);
        setMessage('Signed in successfully.');
        return;
      }

      if (mode === 'signup') {
        await signUpWithPassword(email.trim(), password);
        setMessage('Account created — you are signed in.');
        return;
      }

      if (mode === 'forgot') {
        await sendPasswordResetEmail(email.trim());
        setModeWithReset('reset-sent');
        return;
      }
    } catch (err) {
      console.error('[LoginScreen] Auth error', err);
      const description =
        err instanceof Error ? err.message : 'Something went wrong. Try again.';
      setError(description);
    }
  }, [
    email,
    mode,
    password,
    sendPasswordResetEmail,
    setModeWithReset,
    signInWithPassword,
    signUpWithPassword,
    validateInputs,
  ]);

  const renderFooterLinks = () => {
    if (mode === 'signin') {
      return (
        <View style={styles.footerLinks}>
          <Pressable onPress={() => setModeWithReset('forgot')}>
            <Text style={styles.footerLinkText}>Forgot password?</Text>
          </Pressable>
          <View style={styles.footerDivider} />
          <Pressable onPress={() => setModeWithReset('signup')}>
            <Text style={styles.footerLinkText}>Create account</Text>
          </Pressable>
        </View>
      );
    }

    if (mode === 'signup') {
      return (
        <View style={styles.footerLinksSingle}>
          <Pressable onPress={() => setModeWithReset('signin')}>
            <Text style={styles.footerLinkText}>Already have an account? Sign in</Text>
          </Pressable>
        </View>
      );
    }

    if (mode === 'forgot') {
      return (
        <View style={styles.footerLinksSingle}>
          <Pressable onPress={() => setModeWithReset('signin')}>
            <Text style={styles.footerLinkText}>Return to sign in</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.footerLinksSingle}>
        <Pressable onPress={() => setModeWithReset('signin')}>
          <Text style={styles.footerLinkText}>Return to sign in</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.backgroundLayer} />
        <View style={styles.gradientOverlay} />
        <View style={styles.topEmbellishment}>
          <View style={styles.topCircleLarge} />
          <View style={styles.topCircleSmall} />
        </View>
        <View style={styles.bottomEmbellishment}>
          <View style={styles.bottomDiamond} />
          <View style={styles.bottomLineOne} />
          <View style={styles.bottomLineTwo} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.brandContainer}>
              <Image source={brandImage} style={styles.brandIcon} />
              <Text style={styles.brandText}>Iris</Text>
            </View>

            <View style={styles.callout}>
              <Text style={styles.calloutTitle}>Iris 1.0.2</Text>
              <Text style={styles.calloutDescription}>
                Iris just evolved from a conversational AI into a fully agentic system — capable of
                reasoning, planning, and acting across complex workflows.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>{modeCopy[mode].title}</Text>
              <Text style={styles.subtitle}>{modeCopy[mode].subtitle}</Text>

              {message && mode !== 'reset-sent' ? (
                <View style={styles.messageContainer}>
                  <Text style={styles.messageText}>{message}</Text>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.form}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="name@company.com"
                  placeholderTextColor={palette.mutedForeground}
                  style={styles.input}
                  textContentType="emailAddress"
                  autoCorrect={false}
                  returnKeyType="next"
                />

                {mode === 'signin' || mode === 'signup' ? (
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={palette.mutedForeground}
                    style={styles.input}
                    secureTextEntry
                    textContentType="password"
                    returnKeyType={mode === 'signup' ? 'next' : 'done'}
                    onSubmitEditing={handleSubmit}
                  />
                ) : null}

                {mode === 'signup' ? (
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm password"
                    placeholderTextColor={palette.mutedForeground}
                    style={styles.input}
                    secureTextEntry
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                ) : null}
              </View>

              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  authLoading && styles.primaryButtonDisabled,
                ]}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color={palette.background} />
                ) : (
                  <Text style={styles.primaryButtonText}>{modeCopy[mode].cta}</Text>
                )}
              </Pressable>

              {mode === 'signin' || mode === 'signup' ? (
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>
              ) : null}

              {mode === 'signin' || mode === 'signup' ? (
                <View style={styles.socialRow}>
                  <Pressable
                    onPress={signInWithGoogle}
                    style={styles.socialButton}
                  >
                    <Text style={styles.socialButtonText}>Google</Text>
                  </Pressable>
                  <Pressable
                    onPress={signInWithGitHub}
                    style={styles.socialButton}
                  >
                    <Text style={styles.socialButtonText}>GitHub</Text>
                  </Pressable>
                </View>
              ) : null}

              {renderFooterLinks()}

              <Text style={styles.legal}>
                By continuing, you agree to our{' '}
                <Text style={styles.legalHighlight}>Terms</Text> and{' '}
                <Text style={styles.legalHighlight}>Privacy Policy</Text>.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
};

const createStyles = (palette: typeof Colors.light, isDarkMode: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: palette.background,
    },
    backgroundLayer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: palette.background,
    },
    gradientOverlay: {
      ...StyleSheet.absoluteFillObject,
      opacity: isDarkMode ? 0.3 : 0.2,
      backgroundColor: palette.primary,
    },
    topEmbellishment: {
      position: 'absolute',
      top: -120,
      left: -60,
    },
    topCircleLarge: {
      width: 240,
      height: 240,
      borderRadius: 120,
      borderWidth: 1,
      borderColor: `${palette.primary}40`,
    },
    topCircleSmall: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      borderWidth: 1,
      borderColor: `${palette.primary}25`,
      top: 30,
      left: 30,
    },
    bottomEmbellishment: {
      position: 'absolute',
      bottom: -100,
      right: -40,
      alignItems: 'flex-end',
    },
    bottomDiamond: {
      width: 220,
      height: 220,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${palette.primary}20`,
      transform: [{ rotate: '45deg' }],
    },
    bottomLineOne: {
      width: 260,
      height: 1,
      backgroundColor: `${palette.primary}30`,
      marginTop: 32,
    },
    bottomLineTwo: {
      width: 260,
      height: 1,
      backgroundColor: `${palette.primary}20`,
      marginTop: 12,
    },
    keyboardContainer: {
      flex: 1,
    },
    scrollContainer: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 80,
      paddingBottom: 32,
    },
    brandContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 32,
    },
    brandIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      marginRight: 12,
    },
    brandText: {
      fontSize: 22,
      color: palette.foreground,
      fontFamily: fontWeights[600],
      letterSpacing: 0.2,
    },
    callout: {
      backgroundColor: `${palette.secondary}12`,
      borderWidth: 1,
      borderColor: `${palette.secondary}24`,
      padding: 16,
      borderRadius: 16,
      marginBottom: 28,
    },
    calloutTitle: {
      color: palette.secondary,
      fontFamily: fontWeights[600],
      fontSize: 14,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    calloutDescription: {
      color: palette.foreground,
      fontFamily: fontWeights[400],
      fontSize: 14,
      lineHeight: 20,
      opacity: 0.8,
    },
    card: {
      backgroundColor: palette.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: `${palette.border}`,
      padding: 24,
      shadowColor: isDarkMode ? '#000' : '#0a1635',
      shadowOpacity: isDarkMode ? 0.45 : 0.15,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 16 },
      elevation: 12,
    },
    title: {
      fontSize: 26,
      color: palette.foreground,
      fontFamily: fontWeights[700],
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: palette.mutedForeground,
      fontFamily: fontWeights[400],
      marginBottom: 20,
      lineHeight: 21,
    },
    messageContainer: {
      backgroundColor: `${palette.secondary}20`,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    messageText: {
      color: palette.secondary,
      fontFamily: fontWeights[500],
      fontSize: 14,
    },
    errorContainer: {
      backgroundColor: '#ff5c5c12',
      borderWidth: 1,
      borderColor: '#ff5c5c44',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    errorText: {
      color: '#ff5c5c',
      fontFamily: fontWeights[500],
      fontSize: 14,
    },
    form: {
      gap: 12,
      marginBottom: 18,
    },
    input: {
      borderWidth: 1,
      borderColor: `${palette.border}`,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: Platform.select({ ios: 16, default: 14 }),
      fontSize: 16,
      color: palette.foreground,
      fontFamily: fontWeights[500],
      backgroundColor: isDarkMode ? '#16161a' : '#ffffff',
    },
    primaryButton: {
      backgroundColor: palette.primary,
      borderRadius: 16,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    primaryButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: palette.primaryForeground,
      fontFamily: fontWeights[600],
      fontSize: 16,
      letterSpacing: 0.3,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 18,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: `${palette.border}`,
    },
    dividerText: {
      marginHorizontal: 12,
      color: palette.mutedForeground,
      fontFamily: fontWeights[500],
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    socialRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    socialButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: `${palette.border}`,
      borderRadius: 14,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? '#16161a' : '#f0f2f9',
    },
    socialButtonText: {
      fontFamily: fontWeights[600],
      color: palette.foreground,
      fontSize: 15,
    },
    footerLinks: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginTop: 12,
    },
    footerLinksSingle: {
      alignItems: 'center',
      marginTop: 12,
    },
    footerLinkText: {
      color: palette.secondary,
      fontFamily: fontWeights[500],
      fontSize: 14,
    },
    footerDivider: {
      width: 1,
      height: 12,
      backgroundColor: `${palette.border}`,
    },
    legal: {
      marginTop: 20,
      fontSize: 12,
      lineHeight: 16,
      textAlign: 'center',
      color: palette.mutedForeground,
      fontFamily: fontWeights[400],
    },
    legalHighlight: {
      color: palette.secondary,
      fontFamily: fontWeights[600],
    },
  });

export default LoginScreen;
