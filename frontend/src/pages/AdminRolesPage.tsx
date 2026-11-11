import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { GrantScope, type PermissionCatalogue, type PermissionGrant, type Role } from '../lib/types';
import { Spinner, ErrorBanner } from '../components/Feedback';
import { Modal } from '../components/Modal';

export function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [catalogue, setCatalogue] = useState<PermissionCatalogue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Role | 'new' | null>(null);

  const load = useCallback(() => {
    Promise.all([api.get<Role[]>('/roles'), api.get<PermissionCatalogue>('/roles/permissions')])
      .then(([r, c]) => {
        setRoles(r);
        setCatalogue(c);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca rolurile'));
  }, []);

  useEffect(load, [load]);

  const remove = async (r: Role) => {
    if (!confirm(`Ștergi rolul "${r.name}"?`)) return;
    try {
      await api.delete(`/roles/${r.id}`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ștergere eșuată (poate fi încă folosit)');
    }
  };

  if (error) return <ErrorBanner message={error} />;
  if (!roles || !catalogue) return <Spinner />;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>Roluri</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Rolurile globale disponibile pentru membrii de proiect.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          + Rol nou
        </button>
      </div>

      <div className="card scroll-x">
        <table>
          <thead>
            <tr>
              <th>Nume</th>
              <th>Descriere</th>
              <th>Permisiuni</th>
              <th>Implicit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(r)}>
                <td style={{ fontWeight: 500 }}>
                  {r.name} {r.isSystem && <span style={{ fontSize: 11, color: 'var(--muted)' }}>(sistem)</span>}
                </td>
                <td style={{ fontSize: 13, color: 'var(--muted)' }}>{r.description || '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.grants.length}</td>
                <td>{r.isDefault ? '✓' : ''}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {!r.isSystem && (
                    <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => remove(r)}>
                      Șterge
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <RoleEditorModal
          role={editing === 'new' ? null : editing}
          catalogue={catalogue}
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

function RoleEditorModal({
  role,
  catalogue,
  onClose,
  onSaved,
}: {
  role: Role | null;
  catalogue: PermissionCatalogue;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [isDefault, setIsDefault] = useState(role?.isDefault ?? false);
  const [grants, setGrants] = useState<Record<string, PermissionGrant>>(
    Object.fromEntries((role?.grants ?? []).map((g) => [g.permission, g])),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (key: string) => {
    setGrants((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { permission: key as PermissionGrant['permission'], scope: GrantScope.ANY };
      return next;
    });
  };

  const setScope = (key: string, scope: GrantScope) => {
    setGrants((prev) => ({ ...prev, [key]: { ...prev[key], scope } }));
  };

  const setStatuses = (key: string, raw: string) => {
    const statuses = raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    setGrants((prev) => ({ ...prev, [key]: { ...prev[key], statuses: statuses.length ? statuses : undefined } }));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const body = { name, description: description || undefined, grants: Object.values(grants), isDefault };
    try {
      if (role) await api.patch(`/roles/${role.id}`, body);
      else await api.post('/roles', body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Salvare eșuată');
    } finally {
      setBusy(false);
    }
  };

  const disabledName = role?.isSystem;

  return (
    <Modal title={role ? `Editează "${role.name}"` : 'Rol nou'} onClose={onClose} width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Nume</label>
            <input className="input" value={name} disabled={disabledName} onChange={(e) => setName(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap', paddingTop: 20 }}>
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Rol implicit
          </label>
        </div>
        <div className="field">
          <label>Descriere</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="field">
          <label>Permisiuni</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {catalogue.permissions.map((p) => {
              const grant = grants[p.key];
              return (
                <div key={p.key} className="card" style={{ padding: '8px 10px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!grant} onChange={() => toggle(p.key)} style={{ marginTop: 3 }} />
                    <div style={{ flex: 1 }}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                        {p.key}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.description}</div>
                    </div>
                  </label>
                  {grant && p.supportsConditions && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, marginLeft: 24 }}>
                      <select
                        className="select"
                        style={{ maxWidth: 150 }}
                        value={grant.scope ?? GrantScope.ANY}
                        onChange={(e) => setScope(p.key, e.target.value as GrantScope)}
                      >
                        {catalogue.scopes.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        placeholder="statusuri (ex: IN_QA), opțional"
                        defaultValue={grant.statuses?.join(', ') ?? ''}
                        onBlur={(e) => setStatuses(p.key, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Anulează
          </button>
          <button className="btn btn-primary" disabled={busy || name.length < 2} onClick={submit}>
            {role ? 'Salvează' : 'Creează rol'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
