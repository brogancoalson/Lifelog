import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { BarChart } from '../components/BarChart';
import { ChatThread, Examples, Thumb, type PendingImage } from '../components/ChatThread';
import { Sheet } from '../components/Sheet';
import { Body, Button, Card, Chip, Empty, Field, Icon, IconButton, Label, Title } from '../components/ui';
import { addDays, parseDay, prettyDay, toDay, toTime, uid } from '../lib/dates';
import { deleteImage, pickImages, useImageUri } from '../lib/imageStore';
import { journalMessage, tradeStats } from '../lib/journal';
import { fmtMoney } from '../lib/stats';
import { useStore } from '../lib/store';
import { RANGES, rangeStart, type Bucket, type RangeKey } from '../lib/trackers';
import { font, space, useInsets, useTheme } from '../theme';
import type { Trade } from '../types';

const pnlText = (n?: number) => (n === undefined ? '' : `${n >= 0 ? '+' : '−'}${fmtMoney(n)}`);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function BigImage({ id, onRemove }: { id: string; onRemove?: () => void }) {
  const t = useTheme();
  const uri = useImageUri(id);
  return (
    <View style={{ borderWidth: 1, borderColor: t.border, backgroundColor: t.surface2 }}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', aspectRatio: 16 / 10 }} resizeMode="contain" /> : <View style={{ width: '100%', aspectRatio: 16 / 10 }} />}
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityLabel="Remove screenshot" style={{ position: 'absolute', top: 6, right: 6, backgroundColor: t.bg, padding: 2 }}>
          <Icon name="close" size={18} color={t.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
function TradeEditor({ visible, trade, onClose }: { visible: boolean; trade?: Trade; onClose: () => void }) {
  const t = useTheme();
  const { upsertTrade, deleteTrades } = useStore();
  const [f, setF] = useState<Record<string, string>>({});
  const [dir, setDir] = useState<'long' | 'short' | undefined>();
  const [date, setDate] = useState(toDay());
  const [images, setImages] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const token = visible ? trade?.id ?? 'new' : null;
  if (token !== openedFor) {
    setOpenedFor(token);
    if (token) {
      const s = (v?: number) => (v === undefined ? '' : String(v));
      setF({
        symbol: trade?.symbol ?? 'MES',
        contracts: s(trade?.contracts),
        entry: s(trade?.entry),
        exit: s(trade?.exit),
        pnl: s(trade?.pnl),
        setup: trade?.setup ?? '',
        good: trade?.good ?? '',
        bad: trade?.bad ?? '',
        emotion: trade?.emotion ?? '',
        notes: trade?.notes ?? '',
      });
      setDir(trade?.direction);
      setDate(trade?.date ?? toDay());
      setImages(trade?.images ?? []);
      setConfirm(false);
    }
  }
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const num = (v?: string) => {
    const x = parseFloat((v ?? '').replace(/[$,\s]/g, ''));
    return Number.isFinite(x) ? x : undefined;
  };
  const save = () => {
    upsertTrade({
      id: trade?.id ?? uid(),
      createdAt: trade?.createdAt ?? new Date().toISOString(),
      date,
      time: trade?.time ?? (date === toDay() ? toTime() : undefined),
      symbol: (f.symbol || 'MES').toUpperCase(),
      direction: dir,
      contracts: num(f.contracts),
      entry: num(f.entry),
      exit: num(f.exit),
      pnl: num(f.pnl),
      setup: f.setup?.trim() || undefined,
      good: f.good?.trim() || undefined,
      bad: f.bad?.trim() || undefined,
      emotion: f.emotion?.trim() || undefined,
      notes: f.notes?.trim() ?? '',
      images,
      source: trade?.source ?? 'manual',
    });
    onClose();
  };
  return (
    <Sheet visible={visible} title={trade ? 'Edit trade' : 'New trade'} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Label style={{ flex: 1 }}>Day</Label>
        <IconButton icon="chevron-back" label="Previous day" onPress={() => setDate(addDays(date, -1))} />
        <Text style={{ color: t.text, fontWeight: '700', minWidth: 110, textAlign: 'center' }}>{prettyDay(date)}</Text>
        <IconButton icon="chevron-forward" label="Next day" onPress={() => setDate(addDays(date, 1))} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label="Symbol" value={f.symbol} onChangeText={(v) => set('symbol', v)} autoCapitalize="characters" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Contracts" value={f.contracts} onChangeText={(v) => set('contracts', v)} keyboardType="number-pad" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Long" color={t.good} selected={dir === 'long'} onPress={() => setDir(dir === 'long' ? undefined : 'long')} />
        <Chip label="Short" color={t.danger} selected={dir === 'short'} onPress={() => setDir(dir === 'short' ? undefined : 'short')} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label="Entry" value={f.entry} onChangeText={(v) => set('entry', v)} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Exit" value={f.exit} onChangeText={(v) => set('exit', v)} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="P&L ($)" value={f.pnl} onChangeText={(v) => set('pnl', v)} keyboardType="numbers-and-punctuation" placeholder="-40" />
        </View>
      </View>
      <Field label="Setup" value={f.setup} onChangeText={(v) => set('setup', v)} placeholder="Opening range breakout" />
      <Field label="What was good" value={f.good} onChangeText={(v) => set('good', v)} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
      <Field label="What was bad" value={f.bad} onChangeText={(v) => set('bad', v)} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
      <Field label="How you felt" value={f.emotion} onChangeText={(v) => set('emotion', v)} placeholder="Patient, then got greedy" />
      <Field label="Notes" value={f.notes} onChangeText={(v) => set('notes', v)} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
      <View style={{ gap: 8 }}>
        <Label>Screenshots</Label>
        {images.map((id) => (
          <BigImage key={id} id={id} onRemove={() => setImages((l) => l.filter((x) => x !== id))} />
        ))}
        <Button
          small
          variant="secondary"
          icon="image-outline"
          title="Add screenshots"
          style={{ alignSelf: 'flex-start' }}
          onPress={async () => {
            const picked = await pickImages(4);
            if (picked.length) setImages((l) => [...l, ...picked.map((p) => p.id)]);
          }}
        />
      </View>
      <Button title={trade ? 'Save changes' : 'Save trade'} onPress={save} />
      {trade ? (
        confirm ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Keep it" variant="secondary" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
            <Button
              title="Delete"
              variant="danger"
              onPress={() => {
                trade.images.forEach((id) => deleteImage(id));
                deleteTrades([trade.id]);
                onClose();
              }}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <Pressable onPress={() => setConfirm(true)} style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={{ color: t.danger, fontWeight: '600' }}>Delete trade</Text>
          </Pressable>
        )
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
function TradeCard({ trade, onPress }: { trade: Trade; onPress: () => void }) {
  const t = useTheme();
  const win = (trade.pnl ?? 0) >= 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${trade.symbol} ${trade.direction ?? ''} ${pnlText(trade.pnl)}. Edit.`}>
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: t.text, fontFamily: font.labelBold, fontSize: 18, letterSpacing: 0.8 }}>{trade.symbol}</Text>
          {trade.direction ? (
            <Text style={{ color: trade.direction === 'long' ? t.good : t.danger, fontFamily: font.label, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
              {trade.direction}
              {trade.contracts ? ` ×${trade.contracts}` : ''}
            </Text>
          ) : null}
          <Text style={{ flex: 1, color: t.textFaint, fontSize: 12 }} numberOfLines={1}>
            {prettyDay(trade.date)}
            {trade.setup ? ` · ${trade.setup}` : ''}
          </Text>
          {trade.pnl !== undefined ? <Text style={{ color: win ? t.good : t.danger, fontFamily: font.display, fontSize: 26 }}>{pnlText(trade.pnl)}</Text> : null}
        </View>
        {trade.good ? (
          <Text style={{ color: t.textDim, fontSize: 13 }} numberOfLines={2}>
            <Text style={{ color: t.good, fontWeight: '700' }}>Good: </Text>
            {trade.good}
          </Text>
        ) : null}
        {trade.bad ? (
          <Text style={{ color: t.textDim, fontSize: 13 }} numberOfLines={2}>
            <Text style={{ color: t.danger, fontWeight: '700' }}>Bad: </Text>
            {trade.bad}
          </Text>
        ) : null}
        {!trade.good && !trade.bad && trade.notes ? (
          <Text style={{ color: t.textDim, fontSize: 13 }} numberOfLines={3}>
            {trade.notes}
          </Text>
        ) : null}
        {trade.images.length ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {trade.images.slice(0, 4).map((id) => (
              <Thumb key={id} id={id} size={64} />
            ))}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function pnlBuckets(trades: Trade[], start: string, today: string): Bucket[] {
  const byDay = new Map<string, number>();
  for (const tr of trades) if (tr.pnl !== undefined && tr.date >= start && tr.date <= today) byDay.set(tr.date, (byDay.get(tr.date) ?? 0) + tr.pnl);
  const out: Bucket[] = [];
  const n = Math.round((parseDay(today).getTime() - parseDay(start).getTime()) / 86400000) + 1;
  for (let i = 0; i < n; i++) {
    const day = addDays(start, i);
    const d = parseDay(day);
    out.push({ key: day, label: 'SMTWTFS'[d.getDay()], long: `${MONTHS[d.getMonth()]} ${d.getDate()}`, value: byDay.has(day) ? Math.round(byDay.get(day)! * 100) / 100 : null });
  }
  // long ranges: keep the chart readable by showing only the last 60 days
  return out.slice(-60);
}

function TradesList() {
  const t = useTheme();
  const { data } = useStore();
  const [range, setRange] = useState<RangeKey>('30d');
  const [editing, setEditing] = useState<Trade | undefined>();
  const [adding, setAdding] = useState(false);
  const today = toDay();
  const start = rangeStart(range, today, data.trades.map((tr) => ({ date: tr.date })) as any);
  const list = useMemo(
    () => data.trades.filter((tr) => tr.date >= start && tr.date <= today).sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? ''))),
    [data.trades, start, today],
  );
  const st = tradeStats(list);
  const chart = useMemo(() => pnlBuckets(list, start, today), [list, start, today]);
  const tile = (label: string, value: string, sub?: string, color?: string) => (
    <View key={label} style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, padding: space.md, gap: 2 }}>
      <Text style={{ color: t.textDim, fontSize: 13, fontFamily: font.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: color ?? t.text, fontSize: 32, lineHeight: 34, fontFamily: font.display }}>{value}</Text>
      {sub ? <Text style={{ color: t.textFaint, fontSize: 12 }} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 110 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {RANGES.map((r) => (
            <Chip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} color={t.accent} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {tile('Net P&L', st.count ? pnlText(st.net) : '—', `${st.count} trade${st.count === 1 ? '' : 's'}`, st.net >= 0 ? t.good : t.danger)}
          {tile('Win rate', st.winRate === null ? '—' : `${Math.round(st.winRate * 100)}%`)}
          {tile('Avg win', st.avgWin === null ? '—' : pnlText(st.avgWin), undefined, st.avgWin ? t.good : undefined)}
          {tile('Avg loss', st.avgLoss === null ? '—' : pnlText(st.avgLoss), undefined, st.avgLoss ? t.danger : undefined)}
        </View>
        <Card style={{ gap: 10 }}>
          <Label>P&L per day</Label>
          <BarChart key={range} data={chart} color={t.good} negativeColor={t.danger} format={(v) => pnlText(v)} />
        </Card>
        <View style={{ gap: space.sm }}>
          <Label>Trades · {list.length}</Label>
          {list.length ? list.map((tr) => <TradeCard key={tr.id} trade={tr} onPress={() => setEditing(tr)} />) : (
            <Card>
              <Empty icon="trending-up" title="No trades in this range" body="Journal a trade in the Journal tab, or add one with the + button." />
            </Card>
          )}
        </View>
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a trade by hand"
        onPress={() => setAdding(true)}
        style={({ pressed }) => ({ position: 'absolute', right: space.lg, bottom: space.lg, width: 56, height: 56, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}
      >
        <Icon name="add" size={30} color={t.accentText} />
      </Pressable>
      <TradeEditor visible={!!editing} trade={editing} onClose={() => setEditing(undefined)} />
      <TradeEditor visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

// ---------------------------------------------------------------------------
const JOURNAL_EXAMPLES = [
  'Long MES 2 contracts off the opening range breakout, took +$150. Good: waited for the retest. Bad: exited early.',
  'Shorted MES at the VWAP rejection, stopped out −$60. Chased it after missing the first entry.',
  'No trades today. Market was choppy and I stuck to my rules.',
];

function Journal({ onOpenTrade }: { onOpenTrade: (t: Trade) => void }) {
  const t = useTheme();
  const { data, addChat, upsertTrade } = useStore();
  const [busy, setBusy] = useState(false);
  const tradesById = useMemo(() => new Map(data.trades.map((tr) => [tr.id, tr])), [data.trades]);

  const send = async (text: string, images: PendingImage[]) => {
    const history = data.tradeChat;
    addChat({ role: 'me', text, images: images.map((i) => i.id) }, 'tradeChat');
    setBusy(true);
    try {
      const res = await journalMessage(text, images, history, data);
      if (res.trade) upsertTrade(res.trade);
      addChat({ role: 'app', text: res.reply, tradeIds: res.trade ? [res.trade.id] : undefined }, 'tradeChat');
    } catch (e: any) {
      // never lose what they wrote: save it as a plain journal entry
      const now = new Date();
      const tr: Trade = { id: uid(), date: toDay(now), time: toTime(now), symbol: 'MES', notes: text, images: images.map((i) => i.id), createdAt: now.toISOString(), source: 'chat' };
      upsertTrade(tr);
      addChat({ role: 'app', text: `${e?.message ?? 'Claude didn’t answer.'} I saved what you wrote to your journal anyway.`, tradeIds: [tr.id] }, 'tradeChat');
    }
    setBusy(false);
  };

  return (
    <ChatThread
      messages={data.tradeChat}
      busy={busy}
      busyText={data.settings.claudeKey ? 'Reading your trade…' : 'Saving…'}
      onSend={send}
      placeholder="What did you see? What did you do?"
      onPickImages={async () => (await pickImages(4)).map((p) => ({ id: p.id, uri: p.uri, base64: p.base64 }))}
      renderBelow={(m) =>
        (m.tradeIds ?? [])
          .map((id) => tradesById.get(id))
          .filter(Boolean)
          .map((tr) => (
            <Pressable key={tr!.id} onPress={() => onOpenTrade(tr!)} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="create-outline" size={14} color={t.textDim} />
              <Text style={{ color: t.textDim, fontFamily: font.labelBold, fontSize: 14, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {[tr!.symbol, tr!.direction, pnlText(tr!.pnl)].filter(Boolean).join(' ')} · edit
              </Text>
            </Pressable>
          ))
      }
      empty={
        <View style={{ gap: space.md }}>
          <Body dim>
            Journal like you’re talking to a coach: what you saw, what you did, what went right and wrong. Add chart screenshots with the image button.
            {data.settings.claudeKey ? ' Claude reads the screenshots too.' : ''}
          </Body>
          <Examples items={JOURNAL_EXAMPLES} onPick={(q) => send(q, [])} />
        </View>
      }
    />
  );
}

export function TradeScreen() {
  const t = useTheme();
  const insets = useInsets();
  const [view, setView] = useState<'journal' | 'trades'>('journal');
  const [editing, setEditing] = useState<Trade | undefined>();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.sm }}>
        <Title>Trading</Title>
        <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: t.border }}>
          {(['journal', 'trades'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === v }}
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: view === v ? t.accent : 'transparent' }}
            >
              <Text style={{ color: view === v ? t.accentText : t.textDim, fontFamily: font.labelBold, fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase' }}>{v}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {view === 'journal' ? <Journal onOpenTrade={setEditing} /> : <TradesList />}
      <TradeEditor visible={!!editing} trade={editing} onClose={() => setEditing(undefined)} />
    </View>
  );
}
