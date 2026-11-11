import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useProjectAccess } from '../lib/projectAccess';
import { useProjectRealtime } from '../lib/realtime';
import { InviteStatus, Permission, type Invite, type ProjectMember, type Role, type User } from '../lib/types';
import { Spinner, ErrorBanner } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { UserPicker } from '../components/UserPicker';
import { formatDateTime } from '../lib/format';

const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  [InviteStatus.PENDING]: 'În așteptare',
  [InviteStatus.ACCEPTED]: 'Acceptată',
  [InviteStatus.DECLINED]: 'Refuzată',
};

const INVITE_STATUS_PILL: Record<InviteStatus, string> = {
  [InviteStatus.PENDING]: 'pill pill-todo',
  [InviteStatus.ACCEPTED]: 'pill pill-done',
  [InviteStatus.DECLINED]: 'pill pill-critical',
};

export function MembersPage() {
  const { project, can } = useProjectAccess();
  const [members, setMembers] = useState<ProjectMember[] | null>(null);
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const canManage = can(Permission.MEMBERS_MANAGE);

  const load = useCallback(() => {
    Promise.all([api.get<ProjectMember[]>(`/projects/${project.id}/members`), api.get<Role[]>('/roles')])
      .then(([m, r]) => {
        setMembers(m);
        setRoles(r);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca membrii'));
    if (canManage) {
      api
        .get<Invite[]>(`/projects/${project.id}/invites`)
        .then(setInvites)
        .catch(() => setInvites([]));
    }
  }, [project.id, canManage]);

  useEffect(load, [load]);
  useProjectRealtime(project.id, load);

  const changeRole = async (userId: string, roleId: string) => {
    try {
      await api.patch(`/projects/${project.id}/members/${userId}`, { roleId });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Schimbare rol eșuată');
    }
  };

  const removeMember = async (userId: string, name: string) => {
    if (!confirm(`Elimini ${name} din proiect?`)) return;
    try {
      await api.delete(`/projects/${project.id}/members/${userId}`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Eliminare eșuată');
    }
  };

  const pendingInvites = (invites ?? []).filter((i) => i.status === InviteStatus.PENDING);

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {canManage && (
          <button className="btn" onClick={() => setShowInvite(true)}>
            Invită
          </button>
        )}
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Adaugă membru
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}
      {!members && !error && <Spinner />}

      {members && (
        <div className="card scroll-x">
          <table>
            <thead>
              <tr>
                <th>Membru</th>
                <th>Rol</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={m.user.fullName} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{m.user.fullName}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {canManage ? (
                      <select className="select" style={{ maxWidth: 200 }} value={m.roleId} onChange={(e) => changeRole(m.userId, e.target.value)}>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      m.role.name
                    )}
                  </td>
                  <td>
                    {canManage && (
                      <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => removeMember(m.userId, m.user.fullName)}>
                        Elimină
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && pendingInvites.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 8 }}>INVITAȚII ÎN AȘTEPTARE</h3>
          <div className="card scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Invitat</th>
                  <th>Rol</th>
                  <th>Status</th>
                  <th>Trimisă</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      {inv.user.fullName} <span style={{ color: 'var(--muted)' }}>· {inv.user.email}</span>
                    </td>
                    <td>{inv.role.name}</td>
                    <td>
                      <span className={INVITE_STATUS_PILL[inv.status]}>{INVITE_STATUS_LABEL[inv.status]}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDateTime(inv.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <AddMemberModal
          projectId={project.id}
          roles={roles}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
      {showInvite && (
        <InviteModal
          projectId={project.id}
          roles={roles}
          onClose={() => setShowInvite(false)}
          onSent={() => {
            setShowInvite(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddMemberModal({
  projectId,
  roles,
  onClose,
  onAdded,
}: {
  projectId: string;
  roles: Role[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [roleId, setRoleId] = useState(roles.find((r) => r.isDefault)?.id ?? roles[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${projectId}/members`, { userId: user.id, roleId: roleId || undefined });
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Adăugare eșuată');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Adaugă membru direct" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Adaugă imediat, fără să ceri confirmarea utilizatorului.</p>
        <div className="field">
          <label>Utilizator</label>
          <UserPicker value={user} onChange={setUser} />
        </div>
        <div className="field">
          <label>Rol</label>
          <select className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Anulează
          </button>
          <button className="btn btn-primary" disabled={busy || !user} onClick={submit}>
            Adaugă
          </button>
        </div>
      </div>
    </Modal>
  );
}

function InviteModal({
  projectId,
  roles,
  onClose,
  onSent,
}: {
  projectId: string;
  roles: Role[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [roleId, setRoleId] = useState(roles.find((r) => r.isDefault)?.id ?? roles[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${projectId}/invites`, { userId: user.id, roleId });
      onSent();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Trimiterea invitației a eșuat');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Invită un utilizator" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          Utilizatorul primește invitația și decide singur dacă acceptă sau refuză.
        </p>
        <div className="field">
          <label>Utilizator</label>
          <UserPicker value={user} onChange={setUser} />
        </div>
        <div className="field">
          <label>Rol</label>
          <select className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Anulează
          </button>
          <button className="btn btn-primary" disabled={busy || !user} onClick={submit}>
            {busy ? 'Se trimite…' : 'Trimite invitația'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
