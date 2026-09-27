import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { radius, space, Theme, useTheme } from '../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  const t = useTheme();
  return <Ionicons name={name as IconName} size={size} color={color ?? t.text} />;
}

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ color: t.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <Text
      style={[
        { color: t.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  dim,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  dim?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: dim ? t.textDim : t.text, fontSize: 15, lineHeight: 21 }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        { backgroundColor: t.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: t.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.accent : variant === 'secondary' ? t.surface2 : variant === 'danger' ? 'transparent' : 'transparent';
  const fg = variant === 'primary' ? t.accentText : variant === 'danger' ? t.danger : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: small ? 8 : 13,
          paddingHorizontal: small ? 12 : 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          borderWidth: variant === 'danger' ? 1 : 0,
          borderColor: t.danger,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 14 : 16 }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 22,
  color,
  style,
}: {
  icon: string;
  onPress: () => void;
  label: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      <Icon name={icon} size={size} color={color ?? t.text} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: string;
}) {
  const t = useTheme();
  const c = color ?? t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 7,
        paddingHorizontal: 11,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? c : t.border,
        backgroundColor: selected ? c + '26' : t.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? c : t.textDim} /> : null}
      <Text style={{ color: selected ? t.text : t.textDim, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.surface2, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: height, backgroundColor: color ?? t.accent }} />
    </View>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={t.textFaint}
        {...props}
        style={[
          {
            backgroundColor: t.surface2,
            color: t.text,
            borderRadius: radius.md,
            paddingHorizontal: 12,
            paddingVertical: 11,
            fontSize: 16,
            borderWidth: 1,
            borderColor: t.border,
          },
          style,
        ]}
      />
    </View>
  );
}

export function CategoryDot({ color, icon, size = 34 }: { color: string; icon: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '24',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

export function Empty({ icon, title, body }: { icon: string; title: string; body?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
      <Icon name={icon} size={28} color={t.textFaint} />
      <Body style={{ fontWeight: '700' }}>{title}</Body>
      {body ? <Body dim style={{ textAlign: 'center', maxWidth: 300 }}>{body}</Body> : null}
    </View>
  );
}

export const makeStyles = <T extends StyleSheet.NamedStyles<T>>(fn: (t: Theme) => T) => {
  return () => {
    const t = useTheme();
    return React.useMemo(() => StyleSheet.create(fn(t)), [t]);
  };
};
