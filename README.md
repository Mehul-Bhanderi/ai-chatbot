# AI Chatbot

A streaming chat application with saved conversation history and a provider-agnostic LLM layer — the same code talks to OpenAI, Anthropic or a local Ollama model depending on one environment variable.

## Why the provider layer matters

Most chat apps hard-code a single vendor's SDK throughout the request path, which makes switching models a refactor. Here every provider implements one contract:

```js
streamChat({ messages, model, temperature, signal }) // -> AsyncIterable<string>
```

Route handlers only ever `for await` over that iterable, so they contain no vendor-specific code. Adding a provider means writing one file and registering it; nothing else changes. Swapping vendors at runtime is a change to `LLM_PROVIDER`.

The providers differ in ways the layer hides:

- **OpenAI** streams SSE with `choices[].delta.content` and a `[DONE]` sentinel.
- **Anthropic** streams SSE too, but takes the system prompt as a top-level field rather than a message, and signals completion with a `message_stop` event.
- **Ollama** streams newline-delimited JSON instead of SSE, and needs no API key.

## Features

**Token-by-token streaming** — Replies stream over SSE and render as they arrive, with a blinking cursor while generating and a Stop button that aborts mid-reply. Aborting propagates an `AbortSignal` all the way to the provider, so cancelling actually stops the upstream request rather than just hiding the output.

**Durable history** — The user's message is saved *before* generation starts, so a dropped connection never loses the question. Partial replies are saved too: disconnect halfway and the text generated so far is still there. Each assistant message records which provider and model produced it, so a conversation spanning a provider switch stays readable.

**Accounts** — Registration and login with bcrypt-hashed passwords and a JWT in an HTTP-only cookie. The login endpoint returns an identical response for an unknown email and a wrong password, so it can't be used to enumerate registered accounts.

**Conversations** — Listed newest-first, auto-titled from the first message, individually deletable. Every query is scoped by the authenticated user's id, so one account cannot read another's conversations.

## Stack

**Backend** — Express, MongoDB with Mongoose, JWT, bcryptjs. No LLM SDKs; providers use `fetch` directly, which keeps the dependency list short and the streaming behaviour explicit.

**Frontend** — React with Vite, no component library. The API client reads the SSE stream with `fetch` and a `ReadableStream` reader, because the streaming endpoint is a POST and `EventSource` only issues GETs.

## Layout

```
server/
  src/
    index.js                  app entry, env validation, error handling
    llm/
      index.js                provider registry and model resolution
      sse.js                  shared SSE parser
      providers/              openai.js, anthropic.js, ollama.js
    models/                   User.js, Conversation.js (messages embedded)
    middleware/auth.js        JWT signing and verification
    routes/                   auth.routes.js, chat.routes.js
  test/llm.test.js            provider contract, SSE parsing, error paths
web/
  src/
    api/client.js             REST client + streaming reader
    context/AuthContext.jsx   session state
    components/               MessageList, MessageInput, ConversationSidebar
    pages/                    Chat, Login
```

## Running it

Requires Node 20+ and MongoDB.

**Backend**

```bash
cd server
npm install
cp .env.example .env     # set JWT_SECRET and pick an LLM_PROVIDER
npm run dev
```

**Frontend**

```bash
cd web
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

### Running with no API key

`.env.example` defaults to `LLM_PROVIDER=ollama`, which runs against a local model and needs no key or billing:

```bash
ollama pull llama3.1
ollama serve
```

For a hosted provider instead, set `LLM_PROVIDER=openai` or `anthropic` and supply the matching key.

## Tests

```bash
cd server
npm test
```

Covers the provider contract, model resolution precedence, error propagation, and SSE parsing where events straddle chunk boundaries — the failure mode that naive stream parsing gets wrong.

## API

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Clear the session cookie |
| `GET` | `/api/auth/me` | Current user |
| `GET` | `/api/chat/providers` | Active provider and model |
| `GET` | `/api/chat/conversations` | List conversations |
| `POST` | `/api/chat/conversations` | Create a conversation |
| `GET` | `/api/chat/conversations/:id` | Fetch with messages |
| `DELETE` | `/api/chat/conversations/:id` | Delete |
| `POST` | `/api/chat/conversations/:id/messages` | Send a message, stream the reply (SSE) |
