import test from 'node:test';
import assert from 'node:assert/strict';

import { getProvider, listProviders, resolveModel } from '../src/llm/index.js';
import { streamSSE } from '../src/llm/sse.js';
import { ollamaProvider } from '../src/llm/providers/ollama.js';

/** Wraps strings as a byte stream, so chunk boundaries can be placed deliberately. */
function byteStream(chunks) {
  const encoder = new TextEncoder();
  return (async function* () {
    for (const chunk of chunks) yield encoder.encode(chunk);
  })();
}

async function collect(iterable) {
  const out = [];
  for await (const item of iterable) out.push(item);
  return out;
}

test('every registered provider satisfies the common contract', () => {
  for (const name of listProviders()) {
    const provider = getProvider(name);
    assert.equal(provider.name, name);
    assert.ok(provider.defaultModel, `${name} must declare a default model`);
    assert.equal(typeof provider.streamChat, 'function');
  }
});

test('an unknown provider fails loudly and lists the valid options', () => {
  assert.throws(() => getProvider('not-a-provider'), /Unknown LLM_PROVIDER/);
  assert.throws(() => getProvider('not-a-provider'), /openai/);
});

test('model resolution prefers the request, then env, then the provider default', () => {
  const provider = getProvider('openai');
  delete process.env.LLM_MODEL;

  assert.equal(resolveModel(provider, 'gpt-4o'), 'gpt-4o');
  assert.equal(resolveModel(provider), provider.defaultModel);

  process.env.LLM_MODEL = 'from-env';
  assert.equal(resolveModel(provider), 'from-env');
  assert.equal(resolveModel(provider, 'explicit'), 'explicit');

  delete process.env.LLM_MODEL;
});

test('SSE parsing reassembles events split across chunk boundaries', async () => {
  // "hello" is broken mid-line, which is what a real socket does.
  const events = await collect(
    streamSSE(byteStream(['data: {"a":1}\n\ndata: {"b', '":2}\n\n', 'data: [DONE]\n\n']))
  );

  assert.deepEqual(events, ['{"a":1}', '{"b":2}', '[DONE]']);
});

test('SSE parsing ignores comments and keep-alive lines', async () => {
  const events = await collect(
    streamSSE(byteStream([': keep-alive\n\n', 'event: delta\ndata: {"x":1}\n\n']))
  );

  assert.deepEqual(events, ['{"x":1}']);
});

test('ollama provider yields message deltas and stops on done', async (t) => {
  const original = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = original;
  });

  globalThis.fetch = async () => ({
    ok: true,
    body: byteStream([
      '{"message":{"content":"Hel"}}\n',
      '{"message":{"content":"lo"}}\n{"done":true}\n',
      // Anything after done must be ignored.
      '{"message":{"content":" ignored"}}\n',
    ]),
  });

  const deltas = await collect(
    ollamaProvider.streamChat({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'llama3.1',
    })
  );

  assert.deepEqual(deltas, ['Hel', 'lo']);
});

test('ollama provider surfaces HTTP failures', async (t) => {
  const original = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = original;
  });

  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    text: async () => 'model not found',
  });

  await assert.rejects(
    collect(ollamaProvider.streamChat({ messages: [], model: 'nope' })),
    /Ollama request failed \(500\).*model not found/
  );
});
