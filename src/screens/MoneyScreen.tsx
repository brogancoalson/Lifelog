import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { EntryEditor } from '../components/EntryEditor';
import { Sheet } from '../components/Sheet';
import { Body, Button, Card, Chip, Field, Icon, IconButton, Label, ProgressBar } from '../components/ui';
import { addDays, prettyDay, toDay, toTime, uid } from '../lib/dates';
import { FREE, grossPaycheck, moneyState, planSplit, round2, ruleText, type BucketState } from '../lib/money';
import { fmtMoney } from '../lib/stats';
import { useStore } from '../lib/store';
import { font, space, useTheme } from '../theme';
import type { Bucket, BucketRule, Entry } from '../types';
import { TrackerScreen } from './TrackerScreen';

const money = (n: number) => `${n < 0 ? '−' : ''}${fmtMoney(n)}`;
const parse = (v: string) => {
  const x = parseFloat(v.replace(/[$,\s]/g, ''));
  return Number.isFinite(x) ? x : NaN;
};

// ---------------------------------------------------------------------------
// I got paid
// ---------------------------------------------------------------------------
function IncomeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { data, addEntries } = useStore();
  const pay = data.settings.pay;
  const [kind, setKind] = useState<'paycheck' | 'other'>('paycheck');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState(toDay());
  const [split, setSplit] = useState(true);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState(false);

  if (visible !== opened) {
    setOpened(visible);
    if (visible) {
      setKind('paycheck');
      setAmount(String(grossPaycheck(pay)));
      setSource('');
      setDate(toDay());
      setSplit(true);
      setCustom({});
    }
  }

  const amt = parse(amount);
  const valid = Number.isFinite(amt) && amt > 0;
  const plan = useMemo(() => (valid && split ? planSplit(amt, data.buckets, pay) : { allocations: [], short: {} as Record<string, number> }), [amt, valid, split, data.buckets, pay]);

  const allocFor = (b: Bucket) => {
    if (custom[b.id] !== undefined) return Math.max(0, parse(custom[b.id]) || 0);
    return plan.allocations.find((a) => a.bucketId === b.id)?.amount ?? 0;
  };
  const allocated = split ? round2(data.buckets.reduce((a, b) => a + allocFor(b), 0)) : 0;
  const left = valid ? round2(amt - allocated) : 0;

  const save = () => {
    if (!valid) return;
    const allocations = split ? data.buckets.map((b) => ({ bucketId: b.id, amount: round2(allocFor(b)) })).filter((a) => a.amount > 0) : [];
    const e: Entry = {
      id: uid(),
      createdAt: new Date().toISOString(),
      date,
      time: date === toDay() ? toTime() : undefined,
      category: 'money',
      text: source.trim() || (kind === 'paycheck' ? 'Paycheck' : 'Income'),
      money: round2(amt),
      kind: kind === 'paycheck' ? 'paycheck' : 'income',
      incomeKind: kind,
      allocations: allocations.length ? allocations : undefined,
      source: 'manual',
    };
    addEntries([e]);
    onClose();
  };

  return (
    <Sheet visible={visible} title="I got paid" onClose={onClose}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip
          label="Paycheck"
          selected={kind === 'paycheck'}
          onPress={() => {
            setKind('paycheck');
            setSplit(true);
            setAmount(String(grossPaycheck(pay)));
          }}
        />
        <Chip
          label="Other money"
          selected={kind === 'other'}
          onPress={() => {
            setKind('other');
            setSplit(false);
            setAmount('');
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
        </View>
        <View style={{ flex: 1.3 }}>
          <Field label={kind === 'paycheck' ? 'From (optional)' : 'From'} value={source} onChangeText={setSource} placeholder={kind === 'paycheck' ? 'Work' : 'Odd job for grandparents'} />
        </View>
      </View>
      {kind === 'paycheck' ? (
        <Body dim style={{ fontSize: 13 }}>
          Filled in from your pay settings: ${pay.hourly}/hr × {pay.hoursPerDay} hrs × {pay.daysPerWeek} days × {Math.round(pay.periodDays / 7)} weeks = {fmtMoney(grossPaycheck(pay))} before taxes. Enter what actually hit your account.
        </Body>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Label style={{ flex: 1 }}>Day</Label>
        <IconButton icon="chevron-back" label="Previous day" onPress={() => setDate(addDays(date, -1))} />
        <Text style={{ color: t.text, fontWeight: '700', minWidth: 110, textAlign: 'center' }}>{prettyDay(date)}</Text>
        <IconButton icon="chevron-forward" label="Next day" onPress={() => setDate(addDays(date, 1))} />
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>Split into buckets</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Yes" selected={split} onPress={() => setSplit(true)} />
            <Chip label="No" selected={!split} onPress={() => setSplit(false)} />
          </View>
        </View>
        {split ? (
          <Card style={{ gap: 2, paddingVertical: 8 }}>
            {data.buckets.map((b, i) => {
              const a = allocFor(b);
              const short = custom[b.id] === undefined ? plan.short[b.id] : undefined;
              return (
                <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontFamily: font.labelBold, fontSize: 16, letterSpacing: 0.6, textTransform: 'uppercase' }}>{b.name}</Text>
                    <Text style={{ color: short ? t.danger : t.textFaint, fontSize: 12 }}>{short ? `${fmtMoney(short)} short: paycheck ran out` : ruleText(b, pay)}</Text>
                  </View>
                  <View style={{ width: 96 }}>
                    <Field
                      value={custom[b.id] ?? (a ? String(a) : '')}
                      onChangeText={(v) => setCustom((c) => ({ ...c, [b.id]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      style={{ textAlign: 'right', paddingVertical: 8 }}
                    />
                  </View>
                </View>
              );
            })}
            {!data.buckets.length ? <Body dim>No buckets yet. Add some on the Money page.</Body> : null}
          </Card>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, borderTopColor: t.border, paddingTop: 12 }}>
        <Text style={{ color: t.textDim, fontFamily: font.label, fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' }}>Left over to spend freely</Text>
        <Text style={{ color: left < 0 ? t.danger : t.text, fontFamily: font.display, fontSize: 34 }}>{money(left)}</Text>
      </View>
      {left < 0 ? <Body style={{ color: t.danger, fontSize: 13 }}>The buckets add up to more than this money. Lower one of them.</Body> : null}
      <Button title="Save" onPress={save} disabled={!valid || left < 0} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Bucket editor
// ---------------------------------------------------------------------------
function BucketEditor({ visible, bucket, onClose }: { visible: boolean; bucket?: BucketState; onClose: () => void }) {
  const t = useTheme();
  const { data, upsertBucket, deleteBucket, moveBucket } = useStore();
  const pay = data.settings.pay;
  const b = bucket?.bucket;
  const [name, setName] = useState('');
  const [rule, setRule] = useState<BucketRule>('fixed');
  const [value, setValue] = useState('');
  const [kind, setKind] = useState<'spend' | 'save'>('spend');
  const [keywords, setKeywords] = useState('');
  const [start, setStart] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const token = visible ? b?.id ?? 'new' : null;
  if (token !== openedFor) {
    setOpenedFor(token);
    if (token) {
      setName(b?.name ?? '');
      setRule(b?.rule ?? 'fixed');
      setValue(b ? String(b.value) : '');
      setKind(b?.kind ?? 'spend');
      setKeywords((b?.keywords ?? []).join(', '));
      setStart(b?.start ? String(b.start) : '');
      setConfirm(false);
    }
  }
  const v = parse(value);
  const canSave = name.trim().length > 0 && (value.trim() === '' || (Number.isFinite(v) && v >= 0));

  const save = () => {
    if (!canSave) return;
    upsertBucket({
      id: b?.id ?? uid(),
      createdAt: b?.createdAt ?? new Date().toISOString(),
      name: name.trim(),
      rule,
      value: Number.isFinite(v) ? v : 0,
      kind,
      keywords: keywords
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
      start: parse(start) || undefined,
    });
    onClose();
  };

  const preview = Number.isFinite(v) ? ruleText({ id: '', name, rule, value: v, kind, createdAt: '' }, pay) : '';
  const recent = b
    ? data.entries
        .filter((e) => e.bucketId === b.id || e.allocations?.some((a) => a.bucketId === b.id))
        .sort((x, y) => y.date.localeCompare(x.date) || y.createdAt.localeCompare(x.createdAt))
        .slice(0, 12)
    : [];

  return (
    <Sheet visible={visible} title={b ? 'Edit bucket' : 'New bucket'} onClose={onClose}>
      {bucket ? (
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label>In this bucket now</Label>
          <Text style={{ color: bucket.balance < 0 ? t.danger : t.text, fontFamily: font.display, fontSize: 32 }}>{money(bucket.balance)}</Text>
        </Card>
      ) : null}
      <Field label="Name" value={name} onChangeText={setName} placeholder="Groceries" />
      <View style={{ gap: 8 }}>
        <Label>Each paycheck it gets</Label>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip label="Dollar amount" selected={rule === 'fixed'} onPress={() => setRule('fixed')} />
          <Chip label="% of paycheck" selected={rule === 'percent'} onPress={() => setRule('percent')} />
          <Chip label="$ per day" selected={rule === 'daily'} onPress={() => setRule('daily')} />
        </View>
        <Field
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          placeholder={rule === 'percent' ? '10' : rule === 'daily' ? '20' : '100'}
        />
        {preview ? <Body dim style={{ fontSize: 13 }}>{preview}</Body> : null}
      </View>
      <View style={{ gap: 8 }}>
        <Label>Type</Label>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Spending" selected={kind === 'spend'} onPress={() => setKind('spend')} />
          <Chip label="Saving / retirement" selected={kind === 'save'} onPress={() => setKind('save')} />
        </View>
      </View>
      <Field label="Words that go here (optional)" value={keywords} onChangeText={setKeywords} placeholder="gas, shell, chevron" autoCapitalize="none" />
      <Body dim style={{ fontSize: 13 }}>When you log “spent $14 at Shell,” it comes out of the bucket whose words match.</Body>
      <Field label="Already in it (optional)" value={start} onChangeText={setStart} keyboardType="decimal-pad" placeholder="0" />
      <Button title={b ? 'Save changes' : 'Add bucket'} onPress={save} disabled={!canSave} />

      {b ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button small variant="secondary" icon="arrow-up" title="Move up" onPress={() => moveBucket(b.id, -1)} style={{ flex: 1 }} />
          <Button small variant="secondary" icon="arrow-down" title="Move down" onPress={() => moveBucket(b.id, 1)} style={{ flex: 1 }} />
        </View>
      ) : null}
      {b ? <Body dim style={{ fontSize: 12 }}>Buckets at the top get paid first when a paycheck is split.</Body> : null}

      {recent.length ? (
        <View style={{ gap: 6 }}>
          <Label>Recent</Label>
          {recent.map((e) => {
            const inAmt = e.allocations?.find((a) => a.bucketId === b!.id)?.amount;
            const val = inAmt ?? e.money ?? 0;
            return (
              <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: t.border }}>
                <Text style={{ color: t.text, flex: 1 }} numberOfLines={1}>
                  {prettyDay(e.date)} · {inAmt ? `from ${e.text}` : e.text}
                </Text>
                <Text style={{ color: val >= 0 ? t.good : t.danger, fontFamily: font.display, fontSize: 20 }}>
                  {val >= 0 ? '+' : '−'}
                  {fmtMoney(val)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {b ? (
        confirm ? (
          <View style={{ gap: 8 }}>
            <Body dim style={{ textAlign: 'center' }}>Delete this bucket? Its money goes back to free money.</Body>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Keep it" variant="secondary" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
              <Button
                title="Delete"
                variant="danger"
                onPress={() => {
                  deleteBucket(b.id);
                  onClose();
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setConfirm(true)} style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={{ color: t.danger, fontWeight: '600' }}>Delete bucket</Text>
          </Pressable>
        )
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Move money between buckets
// ---------------------------------------------------------------------------
function TransferSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { data, addTransfer } = useStore();
  const st = moneyState(data);
  const [from, setFrom] = useState(FREE);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [opened, setOpened] = useState(false);
  if (visible !== opened) {
    setOpened(visible);
    if (visible) {
      setFrom(FREE);
      setTo(data.buckets[0]?.id ?? '');
      setAmount('');
    }
  }
  const options = [{ id: FREE, name: 'Free money', balance: st.free }, ...st.buckets.map((b) => ({ id: b.bucket.id, name: b.bucket.name, balance: b.balance }))];
  const amt = parse(amount);
  const ok = Number.isFinite(amt) && amt > 0 && from && to && from !== to;
  return (
    <Sheet visible={visible} title="Move money" onClose={onClose}>
      <View style={{ gap: 8 }}>
        <Label>From</Label>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {options.map((o) => (
            <Chip key={o.id} label={`${o.name} ${money(o.balance)}`} selected={from === o.id} onPress={() => setFrom(o.id)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Label>To</Label>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {options
            .filter((o) => o.id !== from)
            .map((o) => (
              <Chip key={o.id} label={o.name} selected={to === o.id} onPress={() => setTo(o.id)} />
            ))}
        </View>
      </View>
      <Field label="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
      <Button
        title="Move"
        disabled={!ok}
        onPress={() => {
          if (!ok) return;
          addTransfer({ id: uid(), date: toDay(), from, to, amount: round2(amt), createdAt: new Date().toISOString() });
          onClose();
        }}
      />
      <Body dim style={{ fontSize: 12, color: t.textFaint }}>Moving money doesn’t count as spending. It just changes which bucket it’s in.</Body>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Top of the Money tab
// ---------------------------------------------------------------------------
function BucketsSection() {
  const t = useTheme();
  const { data } = useStore();
  const st = useMemo(() => moneyState(data), [data]);
  const pay = data.settings.pay;
  const [paid, setPaid] = useState(false);
  const [spend, setSpend] = useState(false);
  const [move, setMove] = useState(false);
  const [editing, setEditing] = useState<BucketState | undefined>();
  const [adding, setAdding] = useState(false);
  const lp = st.lastPaycheck;

  return (
    <View style={{ gap: space.lg }}>
      <Card style={{ gap: 6, borderColor: t.borderStrong }}>
        <Label>Free to spend</Label>
        <Text style={{ color: st.free < 0 ? t.danger : t.text, fontFamily: font.display, fontSize: 56, lineHeight: 58 }}>{money(st.free)}</Text>
        <Text style={{ color: t.textDim, fontSize: 13 }}>
          {money(st.totalInBuckets)} in buckets{lp ? ` · last paycheck ${prettyDay(lp.date).toLowerCase()}: ${fmtMoney(lp.money ?? 0)}` : ''}
        </Text>
      </Card>

      <View style={{ gap: 8 }}>
        <Button icon="add" title="I got paid" onPress={() => setPaid(true)} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="secondary" icon="remove" title="Spent" onPress={() => setSpend(true)} style={{ flex: 1 }} />
          <Button variant="secondary" icon="swap-horizontal" title="Move money" onPress={() => setMove(true)} style={{ flex: 1 }} />
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>Buckets</Label>
          <Pressable onPress={() => setAdding(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="add" size={16} color={t.accent} />
            <Text style={{ color: t.accent, fontFamily: font.labelBold, fontSize: 15, letterSpacing: 1, textTransform: 'uppercase' }}>Add bucket</Text>
          </Pressable>
        </View>
        {st.buckets.map((b) => {
          const per = b.bucket.rule === 'daily' ? b.bucket.value * pay.periodDays : b.bucket.rule === 'fixed' ? b.bucket.value : 0;
          const save = b.bucket.kind === 'save';
          return (
            <Pressable key={b.bucket.id} onPress={() => setEditing(b)} accessibilityRole="button" accessibilityLabel={`${b.bucket.name}: ${money(b.balance)}. Edit.`}>
              <Card style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name={save ? 'trending-up' : 'wallet'} size={18} color={save ? t.good : t.textDim} />
                  <Text style={{ flex: 1, color: t.text, fontFamily: font.labelBold, fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase' }}>{b.bucket.name}</Text>
                  <Text style={{ color: b.balance < 0 ? t.danger : t.text, fontFamily: font.display, fontSize: 30 }}>{money(b.balance)}</Text>
                </View>
                {per > 0 && !save ? <ProgressBar value={b.balance / per} color={b.balance < per * 0.25 ? t.danger : t.good} height={6} /> : null}
                <Text style={{ color: t.textFaint, fontSize: 12 }}>
                  {save ? `${fmtMoney(b.added)} put away so far · ` : b.spent ? `${fmtMoney(b.spent)} spent from it · ` : ''}
                  {ruleText(b.bucket, pay)}
                </Text>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <IncomeSheet visible={paid} onClose={() => setPaid(false)} />
      <TransferSheet visible={move} onClose={() => setMove(false)} />
      <BucketEditor visible={!!editing} bucket={editing} onClose={() => setEditing(undefined)} />
      <BucketEditor visible={adding} onClose={() => setAdding(false)} />
      <EntryEditor visible={spend} defaults={{ category: 'money' }} onClose={() => setSpend(false)} />
    </View>
  );
}

export function MoneyScreen() {
  return <TrackerScreen tracker="money" top={<BucketsSection />} />;
}
