import { Platform } from 'react-native';

/**
 * Direct calls to the Claude API with the person's own key (stored only on their device).
 * Used for AI sorting, the Ask tab, and the trading journal.
 */

export const MODEL_FAST = 'claude-haiku-4-5-20251001'; // sorting logs
export const MODEL_SMART = 'claude-sonnet-5'; // Ask reports, trading journal (reads screenshots)

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface Msg {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export class ClaudeError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function callClaude(opts: {
  key: string;
  model: string;
  system?: string;
  messages: Msg[];
  tools?: ToolDef[];
  toolChoice?: { type: 'auto' } | { type: 'any' } | { type: 'tool'; name: string };
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<{ content: ContentBlock[]; stop_reason: string }> {
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1500,
    messages: opts.messages,
  };
  if (opts.system) body.system = opts.system;
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;
  const headers: Record<string, string> = {
    'x-api-key': opts.key,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };
  // browsers need this header to call the API directly; the phone app doesn't care
  if (Platform.OS === 'web') headers['anthropic-dangerous-direct-browser-access'] = 'true';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message ?? '';
    } catch {
      // ignore
    }
    throw new ClaudeError(explain(res.status, detail), res.status);
  }
  return res.json();
}

function explain(status: number, detail: string): string {
  if (status === 401) return 'Claude rejected the API key. Check it in Settings.';
  if (status === 403) return 'This API key isn’t allowed to do that. Check its permissions in the Claude Console.';
  if (status === 429) return 'Too many requests right now. Wait a moment and try again.';
  if (status === 400 && /credit|balance/i.test(detail)) return 'Your Claude API account is out of credit. Add credit in the Claude Console.';
  if (status >= 500) return 'Claude is having trouble right now. Try again in a minute.';
  return detail || `Claude returned an error (${status}).`;
}

export function textOf(content: ContentBlock[]): string {
  return content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
}

/**
 * Run a tool-using conversation: Claude asks for data, the app answers from what's on the phone,
 * until Claude writes its final answer.
 */
export async function runWithTools(opts: {
  key: string;
  model: string;
  system: string;
  messages: Msg[];
  tools: ToolDef[];
  execute: (name: string, input: any) => unknown;
  maxRounds?: number;
  onStep?: (label: string) => void;
}): Promise<string> {
  const messages = [...opts.messages];
  for (let round = 0; round < (opts.maxRounds ?? 8); round++) {
    const res = await callClaude({ key: opts.key, model: opts.model, system: opts.system, messages, tools: opts.tools, maxTokens: 2500 });
    const uses = res.content.filter((c): c is Extract<ContentBlock, { type: 'tool_use' }> => c.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !uses.length) return textOf(res.content) || 'I couldn’t find an answer to that.';
    messages.push({ role: 'assistant', content: res.content });
    const results: ContentBlock[] = uses.map((u) => {
      opts.onStep?.(u.name);
      try {
        return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(opts.execute(u.name, u.input ?? {})).slice(0, 150000) };
      } catch (e: any) {
        return { type: 'tool_result', tool_use_id: u.id, content: `Error: ${e?.message ?? 'failed'}`, is_error: true };
      }
    });
    messages.push({ role: 'user', content: results });
  }
  return 'That question needed more lookups than I can do at once. Try asking about a shorter time range.';
}
