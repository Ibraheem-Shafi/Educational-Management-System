import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  padded = true,
}: {
  children: React.ReactNode;
  onRefresh?: RefreshControlProps['onRefresh'];
  refreshing?: boolean;
  padded?: boolean;
}) {
  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingHorizontal: padded ? 16 : 0, paddingBottom: 32, paddingTop: 12 }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function LoadingView({ message = 'Loading…' }: { message?: string }) {
  const { primaryColor } = useTheme();
  return (
    <View className="flex-1 items-center justify-center bg-canvas px-6">
      <ActivityIndicator size="large" color={primaryColor} />
      <Text className="mt-3 text-center text-[15px] text-muted">{message}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center bg-canvas px-6">
      <Text className="mb-2 text-lg font-semibold text-coral">Something went wrong</Text>
      <Text className="text-center text-[15px] text-muted">{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} className="mt-4 rounded-xl bg-navy px-4 py-3">
          <Text className="font-semibold text-white">Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyView({ title, message }: { title?: string; message: string }) {
  return (
    <View className="items-center rounded-2xl border border-line bg-white px-4 py-8">
      {title ? <Text className="mb-1 text-base font-semibold text-ink">{title}</Text> : null}
      <Text className="text-center text-sm text-muted">{message}</Text>
    </View>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={`mb-3 rounded-2xl border border-line bg-white p-4 ${className ?? ''}`}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text className="mb-1 text-2xl font-bold text-navy">{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text className="mb-4 text-sm text-muted">{children}</Text>;
}

export function StatCard({
  label,
  value,
  accent = colors.teal,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <View className="min-w-[46%] flex-1 rounded-2xl border border-line bg-white p-3">
      <View className="mb-2 h-1.5 w-8 rounded-full" style={{ backgroundColor: accent }} />
      <Text className="text-xs font-medium uppercase tracking-wide text-muted">{label}</Text>
      <Text className="mt-1 text-xl font-bold text-ink">{value}</Text>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View className="mb-2 flex-row items-center rounded-2xl border border-line bg-white px-4 py-3">
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-ink">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-sm text-muted">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      {content}
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  color,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  const { primaryColor } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="mt-2 items-center rounded-2xl px-4 py-3.5"
      style={{ backgroundColor: color ?? colors.navy, opacity: disabled ? 0.5 : 1 }}
    >
      <Text className="text-base font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  secure,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
}) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-sm font-medium text-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        placeholder={placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        className={`rounded-xl border border-line bg-white px-3.5 text-[16px] text-ink ${multiline ? 'h-28 py-3' : 'h-12'}`}
        placeholderTextColor={colors.soft}
      />
    </View>
  );
}

export function Badge({ label, tone = 'teal' }: { label: string; tone?: 'teal' | 'coral' | 'yellow' | 'green' | 'navy' }) {
  const map = {
    teal: { bg: colors.tealSoft, fg: colors.teal },
    coral: { bg: colors.coralSoft, fg: colors.coral },
    yellow: { bg: colors.yellowSoft, fg: colors.yellow },
    green: { bg: colors.greenSoft, fg: colors.green },
    navy: { bg: '#e8eef5', fg: colors.navy },
  }[tone];
  return (
    <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: map.bg }}>
      <Text className="text-xs font-semibold" style={{ color: map.fg }}>
        {label}
      </Text>
    </View>
  );
}

export function useBottomPad() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 8);
}
