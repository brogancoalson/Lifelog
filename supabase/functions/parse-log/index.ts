// Supabase Edge Function: turns a plain-language log message into entries.
// Deploy:  npx supabase functions deploy parse-log
// Secret:  npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// The Claude API key lives here on the server, never inside the phone app.

import { buildParsePrompt, ENTRY_JSON_SCHEMA } from './prompt.ts';

const MODEL = Deno.env.get('LIFELOG_MODEL') ?? 'claude-haiku-4-5-20251001';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not set' }, 500);

  let body: { message?: string; today?: string; weekday?: string; time?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const message = (body.message ?? '').toString().slice(0, 4000).trim();
  if (!message) return json({ entries: [] });

  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? '') ? body.today! : new Date().toISOString().slice(0, 10);
  const weekday = body.weekday ?? '';
  const time = /^\d{2}:\d{2}$/.test(body.time ?? '') ? body.time! : '12:00';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: buildParsePrompt(today, weekday, time),
      tools: [
        {
          name: 'save_entries',
          description: 'Save the structured life-log entries found in the message.',
          input_schema: ENTRY_JSON_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'save_entries' },
      messages: [{ role: 'user', content: message }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('Claude API error', res.status, detail);
    return json({ error: `Claude API returned ${res.status}` }, 502);
  }

  const data = await res.json();
  const toolUse = (data.content ?? []).find((c: { type: string }) => c.type === 'tool_use');
  const entries = Array.isArray(toolUse?.input?.entries) ? toolUse.input.entries : [];
  return json({ entries });
});
