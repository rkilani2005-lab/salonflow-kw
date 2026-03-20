/**
 * Anthropic Messages API wrapper.
 *
 * TO ACTIVATE AI FEATURES:
 * In Lovable → Project Settings → Environment Variables → Add:
 *   Name:  VITE_ANTHROPIC_API_KEY
 *   Value: sk-ant-api03-PQ7MCUuT6E5yBk_jfhWbH...  (your key)
 */

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askClaude({
  system,
  messages,
  maxTokens = 1024,
}: {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}): Promise<string> {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

  if (!key) {
    throw new Error(
      'AI not configured. Add VITE_ANTHROPIC_API_KEY in Lovable → Project Settings → Environment Variables.'
    );
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`AI error: ${(err as any)?.error?.message || `HTTP ${response.status}`}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Empty response from AI');
  return text;
}
