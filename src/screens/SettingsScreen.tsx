import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Body, Button, Card, Field, IconButton, Label } from '../components/ui';
import { AWARD_AREAS } from '../lib/categories';
import { FOOD_COUNT } from '../data/foods.txt';
import { testKey } from '../lib/ask';
import { isValidDay } from '../lib/dates';
import { grossPaycheck } from '../lib/money';
import { fmtMoney } from '../lib/stats';
import { useStore } from '../lib/store';
import { font, radius, space, useTheme } from '../theme';

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
  const [claudeKey, setClaudeKey] = useState(data.settings.claudeKey ?? '');
  const [testing, setTesting] = useState(false);
  const [aboutMe, setAboutMe] = useState(data.settings.aboutMe ?? '');
  const pay = data.settings.pay;
  const [hourly, setHourly] = useState(String(pay.hourly));
  const [hoursPerDay, setHoursPerDay] = useState(String(pay.hoursPerDay));
  const [daysPerWeek, setDaysPerWeek] = useState(String(pay.daysPerWeek));
  const [periodDays, setPeriodDays] = useState(String(pay.periodDays));
  const [freeStart, setFreeStart] = useState(data.settings.freeStart ? String(data.settings.freeStart) : '');
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
    setClaudeKey(data.settings.claudeKey ?? '');
    setAboutMe(data.settings.aboutMe ?? '');
    setHourly(String(data.settings.pay.hourly));
    setHoursPerDay(String(data.settings.pay.hoursPerDay));
    setDaysPerWeek(String(data.settings.pay.daysPerWeek));
    setPeriodDays(String(data.settings.pay.periodDays));
    setFreeStart(data.settings.freeStart ? String(data.settings.freeStart) : '');
    setRestoreText('');
    setMsg('');
  }

  const num = (v: string, fallback: number) => {
    const n = parseFloat(v.replace(/[$,\s]/g, ''));
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
            <Text style={{ color: t.text, fontSize: 26, fontFamily: font.display, letterSpacing: 1.2 }}>Settings</Text>
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
              <Label>Claude connection</Label>
              <Body dim style={{ fontSize: 14 }}>
                Powers the Ask tab (reports and advice from your data), smarter sorting in Log (any food, any phrasing), and the trading journal coach that reads your screenshots.
                Get a key at platform.claude.com, add $5 to $20 of credit, and set a monthly spend limit there. The key stays on this device.
              </Body>
              <Field
                label="Claude API key"
                value={claudeKey}
                onChangeText={setClaudeKey}
                placeholder="sk-ant-..."
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  small
                  title="Save key"
                  style={{ flex: 1 }}
                  onPress={() => {
                    updateSettings({ claudeKey: claudeKey.trim() || undefined });
                    flash(claudeKey.trim() ? 'Claude key saved' : 'Claude key removed');
                  }}
                />
                <Button
                  small
                  variant="secondary"
                  title="Test"
                  loading={testing}
                  disabled={!claudeKey.trim()}
                  style={{ flex: 1 }}
                  onPress={async () => {
                    setTesting(true);
                    try {
                      await testKey(claudeKey.trim());
                      flash('Connected to Claude');
                    } catch (e: any) {
                      flash(e?.message ?? 'Couldn’t reach Claude');
                    }
                    setTesting(false);
                  }}
                />
              </View>
              <Field
                label="About you (for Ask)"
                value={aboutMe}
                onChangeText={setAboutMe}
                placeholder="e.g. 180 lb, want 180g protein a day, lifting push/pull/legs 4 days a week, sleep goal 8 hours"
                multiline
                maxLength={2000}
                style={{ minHeight: 96, textAlignVertical: 'top' }}
              />
              <Button
                small
                variant="secondary"
                title="Save about you"
                onPress={() => {
                  updateSettings({ aboutMe: aboutMe.trim() || undefined });
                  flash('Saved. Ask will use this for advice.');
                }}
              />
            </Card>

            <Card style={{ gap: space.md }}>
              <Label>Pay and buckets</Label>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label="$ per hour" value={hourly} onChangeText={setHourly} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Hours/day" value={hoursPerDay} onChangeText={setHoursPerDay} keyboardType="decimal-pad" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Days/week" value={daysPerWeek} onChangeText={setDaysPerWeek} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Paid every (days)" value={periodDays} onChangeText={setPeriodDays} keyboardType="number-pad" />
                </View>
              </View>
              <Field label="Free money on hand now (optional)" value={freeStart} onChangeText={setFreeStart} keyboardType="decimal-pad" placeholder="0" />
              <Body dim style={{ fontSize: 13 }}>
                Paycheck estimate: {fmtMoney(grossPaycheck({ hourly: num(hourly, pay.hourly), hoursPerDay: num(hoursPerDay, pay.hoursPerDay), daysPerWeek: num(daysPerWeek, pay.daysPerWeek), periodDays: num(periodDays, pay.periodDays) || 14 }))} before taxes. “$ per day” buckets use the days between paychecks.
              </Body>
              <Button
                small
                title="Save pay settings"
                onPress={() => {
                  updateSettings({
                    pay: {
                      hourly: num(hourly, pay.hourly),
                      hoursPerDay: num(hoursPerDay, pay.hoursPerDay),
                      daysPerWeek: num(daysPerWeek, pay.daysPerWeek),
                      periodDays: num(periodDays, pay.periodDays) || 14,
                    },
                    freeStart: parseFloat(freeStart.replace(/[$,\s]/g, '')) || undefined,
                  });
                  flash('Pay settings saved');
                }}
              />
            </Card>

            <Card style={{ gap: space.md }}>
              <Label>Food database</Label>
              <Body dim style={{ fontSize: 14 }}>
                {FOOD_COUNT.toLocaleString('en-US')} foods from USDA FoodData Central, built in and offline, plus your Claude connection for anything it doesn’t know.
              </Body>
            </Card>

            <Card style={{ gap: space.md }}>
              <Label>Advanced: server sorting</Label>
              <Body dim style={{ fontSize: 14 }}>
                Only if you set up the Supabase function instead of using a key above.
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
                    // the API key stays on this device: a backup pasted into Notes or a message shouldn't carry it
                    await Clipboard.setStringAsync(JSON.stringify({ ...data, settings: { ...data.settings, claudeKey: undefined } }));
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
