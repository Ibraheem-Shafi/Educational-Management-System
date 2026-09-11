import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { Image } from 'expo-image';
import { Field, LoadingView, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { homeHref } from '@/lib/role';
import { colors } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

function validateLogin(email: string, password: string) {
  const errors: { email?: string; password?: string } = {};
  const trimmed = email.trim();
  if (!trimmed) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  return errors;
}

export default function LoginScreen() {
  const { user, appRole, loading, signIn, roleError, clearRoleError } = useAuth();
  const { institutionName, logoUrl, primaryColor } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingView />;
  if (user && appRole) return <Redirect href={homeHref(appRole)} />;

  const handleSubmit = async () => {
    setError(null);
    clearRoleError();
    const nextErrors = validateLogin(email, password);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={[colors.navy, colors.teal, colors.green]} style={{ flex: 1 }} className="flex-1">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center px-6">
        <View className="rounded-3xl bg-white p-6">
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={{ width: 56, height: 56, alignSelf: 'center', marginBottom: 8 }} contentFit="contain" />
          ) : null}
          <Text className="text-center text-2xl font-bold text-navy">{institutionName}</Text>
          <Text className="mb-4 mt-1 text-center text-sm text-muted">Parent · Student · Teacher</Text>
          <Field
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          {fieldErrors.email ? <Text className="mb-2 text-xs text-coral">{fieldErrors.email}</Text> : null}
          <Field
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            secure
            placeholder="••••••••"
          />
          {fieldErrors.password ? <Text className="mb-2 text-xs text-coral">{fieldErrors.password}</Text> : null}
          {roleError || error ? <Text className="mb-2 text-sm text-coral">{roleError ?? error}</Text> : null}
          <PrimaryButton label={submitting ? 'Signing in…' : 'Sign in'} onPress={handleSubmit} disabled={submitting} />
          <Pressable onPress={() => router.push('/(auth)/forgot-password')} className="mt-4 items-center">
            <Text style={{ color: primaryColor, fontWeight: '600' }}>Forgot password?</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
