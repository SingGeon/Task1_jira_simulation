import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { AuthShell } from './AuthShell';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate('/projects');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Autentificare eșuată');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Bun venit înapoi" subtitle="Intră în contul tău pentru a-ți vedea proiectele.">
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            className="input"
            type="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@tracker.local"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Parolă</label>
          <input
            id="password"
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ justifyContent: 'center', marginTop: 4 }}>
          {busy ? 'Se conectează…' : 'Conectare'}
        </button>
      </form>
      <p style={{ marginTop: 18, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
        Nu ai cont? <Link to="/register">Creează unul</Link>
      </p>
    </AuthShell>
  );
}
