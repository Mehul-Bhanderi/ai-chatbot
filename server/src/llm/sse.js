/**
 * Turns a byte stream of Server-Sent Events into the payload of each `data:`
 * line. Shared by the providers that speak SSE (OpenAI, Anthropic).
 *
 * Chunk boundaries do not respect line boundaries, so partial lines are held
 * in a buffer until the newline that completes them arrives.
 */
export async function* streamSSE(body) {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      yield trimmed.slice(5).trim();
    }
  }
}
