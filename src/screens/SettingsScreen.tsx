import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Body, Button, Card, Field, IconButton, Label } from '../components/ui';
import { AWARD_AREAS } from '../lib/categories';
import { isValidDay } from '../lib/dates';
import { useStore } from '../lib/store';
import { radius, space, useTheme } from '../theme';

export function SettingsScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { data, updateSettings, replaceAll } = useStore();
  const a = data.settings.award;
  const [level, setLevel] = useState(a.level);
  const [service, setService] = useState(String(a.targets.service));
  const [personal, setPersonal] = useState(String(a.targets.personal));
  const [fitness, setFitness] = useState(String(a.targets.fitness));
  const [minMonths, setMinMonths] = useState(String(a.minMonths));
  const [startedOn, setStartedOn] = useState(a.startedOn ?? '');
  const [endpoint, setEndpoint] = useState(data.settings.aiEndpoint ?? '');
  const [key, setKey] = useState(data.settings.aiKey ?? '');
  const [restoreText, setRestoreText] = useState('');
  const [msg, setMsg] = useState('');

  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) resetForm();
  }
  function resetForm() {
    setLevel(a.level);
    setService(String(a.targets.service));
    setPersonal(String(a.targets.personal));
    setFitness(String(a.targets.fitness));
    setMinMonths(String(a.minMonths));
    setStartedOn(a.startedOn ?? '');
    setEndpoint(data.settings.aiEndpoint ?? '');
    setKey(data.settings.aiKey ?? '');
    setRestoreText('');
    setMsg('');
  }

  const num = (v: string, fallback: number) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const saveAward = () => {
    updateSettings({
      award: {
        ...a,
        level: level.trim() || a.level,
        targets: {
          ...a.targets,
          service: num(service, a.targets.service),
          personal: num(personal, a.targets.personal),
          fitness: num(fitness, a.targets.fitness),
        },
        minMonths: num(minMonths, a.minMonths),
        startedOn: isValidDay(startedOn.trim()) ? startedOn.trim() : undefined,
      },
    });
    flash('Award settings saved');
  };

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={Platform.OS === 'web'}>
      <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? t.overlay : t.bg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            flex: 1,
            backgroundColor: t.bg,
            marginTop: Platform.OS === 'web' ? 40 : 0,
            borderTopLeftRadius: Platform.OS === 'web' ? radius.lg : 0,
            borderTopRightRadius: Platform.OS === 'web' ? radius.lg : 0,
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
            <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>Settings</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            {msg ? (
              <Card style={{ paddingVertical: 10 }}>
                <Body>{msg}</Body>
              </Card>
            ) : null}

            <Card style={{ gap: space.md }}>
              <Label>Congressional Award</Label>
              <Field label="Level you're working toward" value={level} onChangeText={setLevel} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label={AWARD_AREAS.service.short + ' hrs'} value={service} onChangeText={setService} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label={AWARD_AREAS.personal.short + ' hrs'} value={personal} onChangeText={setPersonal} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label={AWARD_AREAS.fitness.short + ' hrs'} value={fitness} onChangeText={setFitness} keyboardType="number-pad" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Started on" value={startedOn} onChangeText={setStartedOn} placeholder="YYYY-MM-DD" autoCapitalize="none" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Minimum months" value={minMonths} onChangeText={setMinMonths} keyboardType="number-pad" />
                </View>
              </View>
              <Button small title="Save award settings" onPress={saveAward} />
            </Card>

            <Card style={{ gap: space.md }}>
              <Label>AI sorting</Label>
              <Body dim style={{ fontSize: 14 }}>
                Without this, the Log tab uses quick sort, which handles common phrasing offline. Paste your Supabase function URL and key here
                once it’s set up.
              </Body>
              <Field label="Function URL" value={endpoint} onChangeText={setEndpoint} placeholder="https://xxxx.supabase.co/functions/v1/parse-log" autoCapitalize="none" autoCorrect={false} />
              <Field label="Supabase anon key" value={key} onChangeText={setKey} placeholder="eyJ..." autoCapitalize="none" autoCorrect={false} secureTextEntry />
              <Button
                small
                variant="secondary"
                title="Save AI settings"
                onPress={() => {
                  updateSettings({ aiEndpoint: endpoint.trim() || undefined, aiKey: key.trim() || undefined });
                  flash(endpoint.trim() && key.trim() ? 'AI sorting connected' : 'AI sorting turned off');
                }}
              />
            </Card>

            <Card style={{ gap: space.md }}>
              <Label>Backup</Label>
              <Body dim style={{ fontSize: 14 }}>
                For now everything is saved on this device only. Copy a backup now and then, and paste it back here to restore.
              </Body>
              <Button
                small
                variant="secondary"
                icon="share-outline"
                title={`Copy backup (${data.entries.length} entries)`}
                onPress={async () => {
                  try {
                    await Clipboard.setStringAsync(JSON.stringify(data));
                    flash('Backup copied. Paste it into Notes or a file to keep it.');
                  } catch {
                    flash("Couldn't copy the backup.");
                  }
                }}
              />
              <Field
                label="Restore from backup"
                value={restoreText}
                onChangeText={setRestoreText}
                placeholder="Paste a backup here"
                multiline
                style={{ minHeight: 80, textAlignVertical: 'top' }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                disabled={!restoreText.trim()}
                onPress={() => {
                  try {
                    const ok = replaceAll(JSON.parse(restoreText));
                    flash(ok ? 'Backup restored' : "That doesn't look like a Lifelog backup.");
                    if (ok) setRestoreText('');
                  } catch {
                    flash("That doesn't look like a Lifelog backup.");
                  }
                }}
                style={{ opacity: restoreText.trim() ? 1 : 0.4, alignSelf: 'flex-start', paddingVertical: 4 }}
              >
                <Text style={{ color: t.danger, fontWeight: '700' }}>Replace everything with this backup</Text>
              </Pressable>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
