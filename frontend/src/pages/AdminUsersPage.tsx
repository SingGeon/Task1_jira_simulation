import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { SystemRole, type Paginated, type User } from '../lib/types';
import { Spinner, ErrorBanner } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const [data, setData] = useState<Paginated<User> | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const load = useCallback(() => {
    api
      .get<Paginated<User>>('/users', { q: q || undefined, limit: 50 })
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca utilizatorii'));
  }, [q]);

  useEffect(load, [load]);

  if (error) return <ErrorBanner message={error} />;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>Utilizatori</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Toți conturile din sistem.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Utilizator nou
        </button>
      </div>

      <input className="input" style={{ maxWidth: 280 }} placeholder="Caută după nume sau e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />

      {!data && <Spinner />}
      {data && (
        <div className="card scroll-x">
          <table>
            <thead>
              <tr>
                <th>Utilizator</th>
                <th>Rol sistem</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(u)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={u.fullName} />
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {u.fullName} {u.id === me?.id && <span style={{ fontSize: 11, color: 'var(--muted)' }}>(tu)</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={u.systemRole === SystemRole.ADMIN ? 'pill pill-progress' : 'pill pill-todo'}>{u.systemRole}</span>
                  </td>
                  <td>
                    <span className={u.isActive ? 'pill pill-done' : 'pill pill-critical'}>{u.isActive ? 'Activ' : 'Dezactivat'}</span>
                  </td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {editing && (
        <EditUserModal
          user={editing}
          isSelf={editing.id === me?.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [systemRole, setSystemRole] = useState<SystemRole>(SystemRole.USER);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/users', { fullName, email, password, systemRole });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Creare eșuată');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Utilizator nou" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <div className="field">
          <label>Nume complet</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="field">
          <label>E-mail</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Parolă</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Min. 8 caractere, literă mare, literă mică și o cifră.</span>
        </div>
        <div className="field">
          <label>Rol sistem</label>
          <select className="select" value={systemRole} onChange={(e) => setSystemRole(e.target.value as SystemRole)}>
            <option value={SystemRole.USER}>Utilizator</option>
            <option value={SystemRole.ADMIN}>Admin</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Anulează
          </button>
          <button className="btn btn-primary" disabled={busy || !fullName || !email || !password} onClick={submit}>
            Creează
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditUserModal({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  user: User;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(user.fullName);
  const [systemRole, setSystemRole] = useState(user.systemRole);
  const [isActive, setIsActive] = useState(user.isActive);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/users/${user.id}`, {
        fullName,
        systemRole,
        isActive,
        password: password || undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Salvare eșuată');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={user.fullName} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <div className="field">
          <label>Nume complet</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="field">
          <label>E-mail</label>
          <input className="input" value={user.email} disabled />
        </div>
        <div className="field">
          <label>Rol sistem</label>
          <select className="select" value={systemRole} disabled={isSelf} onChange={(e) => setSystemRole(e.target.value as SystemRole)}>
            <option value={SystemRole.USER}>Utilizator</option>
            <option value={SystemRole.ADMIN}>Admin</option>
          </select>
          {isSelf && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Nu îți poți schimba propriul rol.</span>}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={isActive} disabled={isSelf} onChange={(e) => setIsActive(e.target.checked)} />
          Cont activ
        </label>
        <div className="field">
          <label>Resetează parola (opțional)</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Lasă gol pentru a păstra parola curentă" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Anulează
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            Salvează
          </button>
        </div>
      </div>
    </Modal>
  );
}
