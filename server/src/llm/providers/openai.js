import { streamSSE } from '../sse.js';

const API_URL = 'https://api.openai.com/v1/chat/completions';

export const openaiProvider = {
  name: 'openai',
  defaultModel: 'gpt-4o-mini',

  async *streamChat({ messages, model, temperature = 0.7, signal }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const response = await fetch(API_URL, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        stream: true,
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed (${response.status}): ${await response.text()}`);
    }

    for await (const event of streamSSE(response.body)) {
      if (event === '[DONE]') return;

      const delta = JSON.parse(event).choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  },
};
