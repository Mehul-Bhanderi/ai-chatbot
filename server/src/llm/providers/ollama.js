/**
 * Local models via Ollama. Needs no API key, which makes it the easiest way to
 * run or demo this project without billing attached to an account.
 *
 * Ollama streams newline-delimited JSON rather than SSE, so it parses its own
 * stream instead of using the shared SSE helper.
 */
export const ollamaProvider = {
  name: 'ollama',
  defaultModel: 'llama3.1',

  async *streamChat({ messages, model, temperature = 0.7, signal }) {
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434';

    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        options: { temperature },
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed (${response.status}): ${await response.text()}`);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line);
        if (parsed.done) return;
        if (parsed.message?.content) yield parsed.message.content;
      }
    }
  },
};
