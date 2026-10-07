import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { font, radius, space, useInsets, useTheme, ls, ds } from '../theme';
import { IconButton } from './ui';

/** A full-height sheet with a title bar and a close button. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  right,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useInsets();
  const web = Platform.OS === 'web';
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={web}>
      <View style={{ flex: 1, backgroundColor: web ? t.overlay : t.bg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            flex: 1,
            backgroundColor: t.bg,
            marginTop: web ? 40 : 0,
            borderTopLeftRadius: web ? radius.lg : 0,
            borderTopRightRadius: web ? radius.lg : 0,
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: space.sm,
              borderBottomWidth: 1,
              borderBottomColor: t.border,
            }}
          >
            <IconButton icon="close" label="Close" onPress={onClose} />
            <Text style={{ color: t.text, fontSize: ds(26), fontFamily: font.display, letterSpacing: ls(1.2) }} numberOfLines={1}>
              {title}
            </Text>
            <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
          </View>
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 48 + insets.bottom }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
