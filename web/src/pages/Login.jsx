import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (isRegister) await register(form);
      else await login({ email: form.email, password: form.password });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit}>
        <h1>{isRegister ? 'Create an account' : 'Sign in'}</h1>

        {error && <div className="banner banner--error">{error}</div>}

        {isRegister && (
          <label>
            Name
            <input value={form.name} onChange={update('name')} required />
          </label>
        )}

        <label>
          Email
          <input type="email" value={form.email} onChange={update('email')} required />
        </label>

        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={update('password')}
            required
            minLength={isRegister ? 8 : undefined}
          />
        </label>

        <button type="submit" disabled={busy}>
          {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
        </button>

        <button
          type="button"
          className="auth__switch"
          onClick={() => {
            setMode(isRegister ? 'login' : 'register');
            setError(null);
          }}
        >
          {isRegister ? 'Already have an account? Sign in' : 'Need an account? Register'}
        </button>
      </form>
    </div>
  );
}
