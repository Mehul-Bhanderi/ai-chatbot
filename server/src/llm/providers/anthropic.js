import { streamSSE } from '../sse.js';

const API_URL = 'https://api.anthropic.com/v1/messages';

export const anthropicProvider = {
  name: 'anthropic',
  defaultModel: 'claude-sonnet-4-5',

  async *streamChat({ messages, model, temperature = 0.7, signal }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

    // Anthropic takes the system prompt as a top-level field rather than a message.
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const turns = messages
      .filter((m) => m.role !== 'system')
      .map(({ role, content }) => ({ role, content }));

    const response = await fetch(API_URL, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        temperature,
        stream: true,
        max_tokens: Number(process.env.LLM_MAX_TOKENS || 2048),
        ...(system ? { system } : {}),
        messages: turns,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed (${response.status}): ${await response.text()}`);
    }

    for await (const event of streamSSE(response.body)) {
      const parsed = JSON.parse(event);
      if (parsed.type === 'message_stop') return;
      if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
        yield parsed.delta.text;
      }
    }
  },
};
