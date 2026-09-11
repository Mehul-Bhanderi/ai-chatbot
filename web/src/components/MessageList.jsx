import { useEffect, useRef } from 'react';

export function MessageList({ messages, streaming }) {
  const bottom = useRef(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  if (!messages.length && !streaming) {
    return (
      <div className="empty">
        <h2>Ask me anything</h2>
        <p>Your conversations are saved, so you can pick any of them back up later.</p>
      </div>
    );
  }

  return (
    <div className="messages">
      {messages.map((message) => (
        <Message key={message._id || message.createdAt} message={message} />
      ))}

      {streaming && (
        <Message message={{ role: 'assistant', content: streaming }} pending />
      )}

      <div ref={bottom} />
    </div>
  );
}

function Message({ message, pending }) {
  return (
    <article className={`message message--${message.role}`}>
      <div className="message__role">{message.role === 'user' ? 'You' : 'Assistant'}</div>
      <div className="message__body">
        {message.content}
        {pending && <span className="cursor" aria-hidden="true" />}
      </div>
      {message.model && !pending && (
        <div className="message__meta">
          {message.provider} · {message.model}
        </div>
      )}
    </article>
  );
}
