import { useAuth } from '../context/AuthContext.jsx';

export function ConversationSidebar({
  conversations,
  activeId,
  provider,
  onSelect,
  onCreate,
  onDelete,
}) {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <button className="sidebar__new" onClick={onCreate}>
        New conversation
      </button>

      <nav className="sidebar__list">
        {conversations.map((conversation) => (
          <div
            key={conversation._id}
            className={`sidebar__item ${conversation._id === activeId ? 'is-active' : ''}`}
          >
            <button onClick={() => onSelect(conversation._id)}>{conversation.title}</button>
            <button
              className="sidebar__delete"
              onClick={() => onDelete(conversation._id)}
              aria-label={`Delete ${conversation.title}`}
            >
              ×
            </button>
          </div>
        ))}

        {!conversations.length && <p className="sidebar__empty">No conversations yet.</p>}
      </nav>

      <footer className="sidebar__footer">
        {provider && (
          <div className="sidebar__provider">
            {provider.active} · {provider.model}
          </div>
        )}
        <div className="sidebar__user">{user?.name}</div>
        <button onClick={logout}>Sign out</button>
      </footer>
    </aside>
  );
}
