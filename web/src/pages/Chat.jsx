import { useCallback, useEffect, useRef, useState } from 'react';
import { api, streamMessage } from '../api/client.js';
import { ConversationSidebar } from '../components/ConversationSidebar.jsx';
import { MessageList } from '../components/MessageList.jsx';
import { MessageInput } from '../components/MessageInput.jsx';

export function Chat() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState('');
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const busy = streaming !== '' || abortRef.current !== null;

  const refreshList = useCallback(async () => {
    const { conversations: list } = await api.listConversations();
    setConversations(list);
    return list;
  }, []);

  useEffect(() => {
    api.providers().then(setProvider).catch(() => {});

    refreshList().then((list) => {
      if (list.length) setActiveId(list[0]._id);
    });
  }, [refreshList]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }

    api
      .getConversation(activeId)
      .then(({ conversation }) => setMessages(conversation.messages))
      .catch((err) => setError(err.message));
  }, [activeId]);

  const createConversation = async () => {
    const { conversation } = await api.createConversation();
    await refreshList();
    setActiveId(conversation._id);
    setMessages([]);
  };

  const deleteConversation = async (id) => {
    await api.deleteConversation(id);
    const list = await refreshList();

    if (id === activeId) setActiveId(list[0]?._id ?? null);
  };

  const send = async (content) => {
    setError(null);

    // A conversation is created lazily so an empty one is never left behind
    // if the user opens the app and never sends anything.
    let conversationId = activeId;
    if (!conversationId) {
      const { conversation } = await api.createConversation();
      conversationId = conversation._id;
      setActiveId(conversationId);
    }

    setMessages((prev) => [...prev, { role: 'user', content, createdAt: Date.now() }]);
    setStreaming(' ');

    abortRef.current = streamMessage(conversationId, content, {
      onDelta: (delta) => setStreaming((prev) => (prev === ' ' ? delta : prev + delta)),
      onError: (err) => setError(err.message),
      onDone: async () => {
        abortRef.current = null;
        setStreaming('');

        // Reload from the server so the saved message carries its real id,
        // timestamp and model metadata rather than our optimistic copy.
        const { conversation } = await api.getConversation(conversationId);
        setMessages(conversation.messages);
        refreshList();
      },
    });
  };

  const stop = () => {
    abortRef.current?.();
    abortRef.current = null;
    setStreaming('');
  };

  return (
    <div className="layout">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        provider={provider}
        onSelect={setActiveId}
        onCreate={createConversation}
        onDelete={deleteConversation}
      />

      <main className="chat">
        {error && <div className="banner banner--error">{error}</div>}
        <MessageList messages={messages} streaming={streaming.trim() ? streaming : ''} />
        <MessageInput onSend={send} onStop={stop} busy={busy} />
      </main>
    </div>
  );
}
