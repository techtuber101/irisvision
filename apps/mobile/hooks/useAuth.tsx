import { supabase } from '@/constants/SupabaseConfig';
import { AuthChangeEvent, AuthError, Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    authLoading: boolean;
    signInWithPassword: (email: string, password: string) => Promise<void>;
    signUpWithPassword: (email: string, password: string, metadata?: Record<string, any>) => Promise<void>;
    sendPasswordResetEmail: (email: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signInWithGitHub: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(false);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, session: Session | null) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            }
        );

        return () => subscription?.unsubscribe();
    }, []);

    const runAuthAction = async (action: () => Promise<AuthError | null | undefined | void>) => {
        setAuthLoading(true);
        try {
            const possibleError = await action();
            if (possibleError instanceof AuthError) {
                throw possibleError;
            }
        } finally {
            setAuthLoading(false);
        }
    };

    const signInWithPassword = async (email: string, password: string) => {
        await runAuthAction(async () => {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return error;
            }

            setSession(data.session ?? null);
            setUser(data.user ?? null);
        });
    };

    const signUpWithPassword = async (email: string, password: string, metadata?: Record<string, any>) => {
        await runAuthAction(async () => {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: metadata ? { data: metadata } : undefined,
            });

            if (error) {
                return error;
            }

            setSession(data.session ?? null);
            setUser(data.user ?? null);
        });
    };

    const sendPasswordResetEmail = async (email: string) => {
        await runAuthAction(async () => {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: process.env.EXPO_PUBLIC_SUPABASE_PASSWORD_RESET_REDIRECT,
            });

            if (error) {
                return error;
            }
        });
    };

    const signOut = async () => {
        await runAuthAction(async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                return error;
            }
        });
    };

    const signInWithGoogle = async () => {
        await runAuthAction(async () => {
            // Use the web redirect URL that's already configured in Supabase
            const redirectUrl = 'https://irisvision.ai/auth/callback';

            console.log('[OAuth] Using redirect URL:', redirectUrl);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (error) {
                return error;
            }

            if (data.url) {
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectUrl,
                    {
                        showInRecents: true,
                        preferEphemeralSession: false,
                    }
                );

                console.log('[OAuth] Browser result:', result);

                if (result.type === 'success' && result.url) {
                    const url = new URL(result.url);
                    const accessToken = url.searchParams.get('access_token');
                    const refreshToken = url.searchParams.get('refresh_token');

                    if (accessToken && refreshToken) {
                        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });

                        if (sessionError) {
                            return sessionError;
                        }

                        setSession(sessionData.session ?? null);
                        setUser(sessionData.user ?? null);
                    }
                }
            }
        });
    };

    const signInWithGitHub = async () => {
        await runAuthAction(async () => {
            // Use the web redirect URL that's already configured in Supabase
            const redirectUrl = 'https://irisvision.ai/auth/callback';

            console.log('[OAuth] Using redirect URL:', redirectUrl);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (error) {
                return error;
            }

            if (data.url) {
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectUrl,
                    {
                        showInRecents: true,
                        preferEphemeralSession: false,
                    }
                );

                console.log('[OAuth] Browser result:', result);

                if (result.type === 'success' && result.url) {
                    const url = new URL(result.url);
                    const accessToken = url.searchParams.get('access_token');
                    const refreshToken = url.searchParams.get('refresh_token');

                    if (accessToken && refreshToken) {
                        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });

                        if (sessionError) {
                            return sessionError;
                        }

                        setSession(sessionData.session ?? null);
                        setUser(sessionData.user ?? null);
                    }
                }
            }
        });
    };

    return (
        <AuthContext.Provider
            value={{
                session,
                user,
                loading,
                authLoading,
                signInWithPassword,
                signUpWithPassword,
                sendPasswordResetEmail,
                signInWithGoogle,
                signInWithGitHub,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 
