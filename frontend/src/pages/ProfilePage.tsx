import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Avatar } from '../components/Avatar';
import { ErrorBanner } from '../components/Feedback';

export function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch('/users/me', {
        fullName: fullName !== user.fullName ? fullName : undefined,
        currentPassword: newPassword ? currentPassword : undefined,
        newPassword: newPassword || undefined,
      });
      await refreshMe();
      setCurrentPassword('');
      setNewPassword('');
      setSuccess('Profil actualizat.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Salvare eșuată');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '28px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Avatar name={user.fullName} size={40} />
        <div>
          <h1>{user.fullName}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>{user.email}</p>
        </div>
      </div>

      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        {success && <div style={{ color: 'var(--good)', fontSize: 13 }}>{success}</div>}
        <div className="field">
          <label>Nume complet</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
        <h3>Schimbă parola</h3>
        <div className="field">
          <label>Parola curentă</label>
          <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>Parola nouă</label>
          <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={busy} style={{ alignSelf: 'flex-start' }} onClick={submit}>
          Salvează
        </button>
      </div>
    </div>
  );
}
