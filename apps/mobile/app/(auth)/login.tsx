import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { Image } from 'expo-image';
import { Field, LoadingView, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { loginLookupError, resolveLoginIdentifier } from '@/lib/resolve-login-identifier';
import { homeHref } from '@/lib/role';
import { colors } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

function validateLogin(identifier: string, password: string) {
  const errors: { identifier?: string; password?: string } = {};
  const trimmed = identifier.trim();
  if (!trimmed || trimmed.length < 3) errors.identifier = 'Enter an email or phone number';
  if (!password) errors.password = 'Password is required';
  return errors;
}

export default function LoginScreen() {
  const { user, appRole, loading, signIn, roleError, clearRoleError } = useAuth();
  const { institutionName, logoUrl, primaryColor } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingView />;
  if (user && appRole) return <Redirect href={homeHref(appRole)} />;

  const handleSubmit = async () => {
    setError(null);
    clearRoleError();
    const nextErrors = validateLogin(identifier, password);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      const email = await resolveLoginIdentifier(identifier);
      await signIn(email, password);
    } catch (err) {
      setError(loginLookupError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={[colors.navy, colors.teal, colors.green]} style={{ flex: 1 }} className="flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}
        className="flex-1 justify-center px-6"
      >
        <View className="rounded-3xl bg-white p-6">
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={{ width: 56, height: 56, alignSelf: 'center', marginBottom: 8 }} contentFit="contain" />
          ) : null}
          <Text className="text-center text-2xl font-bold text-navy">{institutionName}</Text>
          <Text className="mb-4 mt-1 text-center text-sm text-muted">Staff · Parent · Student · Teacher</Text>
          <Field
            label="Email or phone"
            value={identifier}
            onChangeText={(value) => {
              setIdentifier(value);
              if (fieldErrors.identifier) setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
            }}
            keyboardType="email-address"
            placeholder="email@school.edu.pk or phone"
          />
          {fieldErrors.identifier ? (
            <Text className="mb-2 text-xs text-coral">{fieldErrors.identifier}</Text>
          ) : null}
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
