import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { AuthShell } from './AuthShell';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(email, password, fullName);
      navigate('/projects');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Înregistrare eșuată');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Creează cont" subtitle="Vei primi acces minim până când un Project Manager te adaugă într-un proiect.">
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="fullName">Nume complet</label>
          <input
            id="fullName"
            className="input"
            required
            autoFocus
            minLength={2}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
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
            placeholder="min. 8 caractere"
          />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            Minimum 8 caractere, cu o literă mare, o literă mică și o cifră.
          </span>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ justifyContent: 'center', marginTop: 4 }}>
          {busy ? 'Se creează…' : 'Creează cont'}
        </button>
      </form>
      <p style={{ marginTop: 18, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
        Ai deja cont? <Link to="/login">Conectează-te</Link>
      </p>
    </AuthShell>
  );
}
