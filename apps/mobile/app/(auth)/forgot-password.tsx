import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Field, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const { institutionName, primaryColor } = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={[colors.navy, colors.teal, colors.green]} style={{ flex: 1 }}>
      <View className="flex-1 justify-center px-6">
        <View className="rounded-3xl bg-white p-6">
          <Text className="text-center text-2xl font-bold text-navy">Reset password</Text>
          <Text className="mb-4 mt-2 text-center text-sm text-muted">
            Enter the email linked to your {institutionName} account.
          </Text>
          {sent ? (
            <Text className="text-sm leading-6 text-muted">
              If an account exists for {email}, you will receive reset instructions shortly.
            </Text>
          ) : (
            <>
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
              {error ? <Text className="mb-2 text-sm text-coral">{error}</Text> : null}
              <PrimaryButton label={submitting ? 'Sending…' : 'Send reset link'} onPress={handleSubmit} disabled={submitting} />
            </>
          )}
          <Pressable onPress={() => router.back()} className="mt-4 items-center">
            <Text style={{ color: primaryColor, fontWeight: '600' }}>Back to sign in</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}
