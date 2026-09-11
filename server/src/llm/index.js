import { openaiProvider } from './providers/openai.js';
import { anthropicProvider } from './providers/anthropic.js';
import { ollamaProvider } from './providers/ollama.js';

const providers = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  ollama: ollamaProvider,
};

/**
 * Every provider exposes the same shape:
 *   name
 *   defaultModel
 *   streamChat({ messages, model, temperature, signal }) -> AsyncIterable<string>
 *
 * Callers never branch on which provider is active, so swapping LLM_PROVIDER
 * is the only change needed to move between vendors.
 */
export function getProvider(name = process.env.LLM_PROVIDER) {
  const key = (name || 'openai').toLowerCase();
  const provider = providers[key];

  if (!provider) {
    const known = Object.keys(providers).join(', ');
    throw new Error(`Unknown LLM_PROVIDER "${key}". Supported providers: ${known}`);
  }

  return provider;
}

export function listProviders() {
  return Object.keys(providers);
}

export function resolveModel(provider, requested) {
  return requested || process.env.LLM_MODEL || provider.defaultModel;
}
