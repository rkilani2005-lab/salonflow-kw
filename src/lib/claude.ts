/**
 * Anthropic Claude wrapper — calls securely via backend edge function.
 * The ANTHROPIC_API_KEY is stored as a server-side secret (never exposed to the browser).
 */

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-chat`;

export async function askClaude({
  system,
  messages,
  maxTokens = 1024,
}: {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}): Promise<string> {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ system, messages, maxTokens }),
  });

  const data = await response.json();

  if (!response.ok || data?.error) {
    throw new Error(data?.error || `AI error: HTTP ${response.status}`);
  }

  if (!data?.text) throw new Error('Empty response from AI');
  return data.text;
}
