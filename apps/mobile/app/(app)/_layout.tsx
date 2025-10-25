import { useThemeColor } from '@/hooks/useThemeColor';
import { useAuth } from '@/hooks/useAuth';
import { Stack, Redirect } from 'expo-router';
import React from 'react';

export default function ProtectedLayout() {
  const backgroundColor = useThemeColor({ light: '#ffffff', dark: '#0a0a0a' }, 'background');
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Let the root layout handle loading
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
