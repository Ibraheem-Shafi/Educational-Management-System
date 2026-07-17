import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { PrimaryButton } from '@/components/ui';
import { LoadingView } from '@/components/Screen';
import { useAuth } from '@/lib/auth-context';
import { APP_ROLE } from '@/lib/config';
import { useTheme } from '@/lib/theme-context';

export default function LoginScreen() {
  const { user, loading, signIn, roleError, clearRoleError } = useAuth();
  const { primaryColor, institutionName } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingView />;
  if (user) return <Redirect href="/(tabs)" />;

  const handleSubmit = async () => {
    setError(null);
    clearRoleError();
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = roleError ?? error;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <Text style={styles.brand}>{institutionName}</Text>
        <Text style={[styles.roleBadge, { color: primaryColor }]}>
          {APP_ROLE === 'parent' ? 'Parent Portal' : 'Student Portal'}
        </Text>
        <Text style={styles.heading}>Sign in</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="you@example.com"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="••••••••"
          />
        </View>

        {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

        <PrimaryButton label={submitting ? 'Signing in…' : 'Sign in'} onPress={handleSubmit} disabled={submitting} />

        {roleError ? (
          <Pressable onPress={clearRoleError} style={styles.linkWrap}>
            <Text style={[styles.link, { color: primaryColor }]}>Try another account</Text>
          </Pressable>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  roleBadge: {
    textAlign: 'center',
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 32,
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    color: '#b91c1c',
    marginBottom: 8,
    fontSize: 14,
  },
  linkWrap: {
    marginTop: 16,
    alignItems: 'center',
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
  },
});
