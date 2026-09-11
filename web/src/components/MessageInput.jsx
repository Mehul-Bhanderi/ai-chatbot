import { useState } from 'react';

export function MessageInput({ onSend, onStop, busy }) {
  const [value, setValue] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const text = value.trim();
    if (!text || busy) return;

    onSend(text);
    setValue('');
  };

  return (
    <form className="composer" onSubmit={submit}>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter inserts a newline.
          if (event.key === 'Enter' && !event.shiftKey) submit(event);
        }}
        placeholder="Send a message…"
        rows={1}
        disabled={busy}
      />

      {busy ? (
        <button type="button" onClick={onStop} className="composer__stop">
          Stop
        </button>
      ) : (
        <button type="submit" disabled={!value.trim()}>
          Send
        </button>
      )}
    </form>
  );
}
