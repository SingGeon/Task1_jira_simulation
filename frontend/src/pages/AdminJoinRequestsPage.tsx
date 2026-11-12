import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { notifyAccessChanged } from '../lib/events';
import { InviteStatus, JoinRequestStatus, type Invite, type JoinRequest } from '../lib/types';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { formatDateTime } from '../lib/format';

const REQUEST_STATUS_LABEL: Record<JoinRequestStatus, string> = {
  [JoinRequestStatus.PENDING]: 'În așteptare',
  [JoinRequestStatus.APPROVED]: 'Aprobată',
  [JoinRequestStatus.REJECTED]: 'Respinsă',
};

const REQUEST_STATUS_PILL: Record<JoinRequestStatus, string> = {
  [JoinRequestStatus.PENDING]: 'pill pill-todo',
  [JoinRequestStatus.APPROVED]: 'pill pill-done',
  [JoinRequestStatus.REJECTED]: 'pill pill-critical',
};

export function AdminJoinRequestsPage() {
  const { isAdmin } = useAuth();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [myRequests, setMyRequests] = useState<JoinRequest[] | null>(null);
  const [decidable, setDecidable] = useState<JoinRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Invite[]>('/invites/mine').then(setInvites).catch(() => setInvites([]));
    if (!isAdmin) {
      api.get<JoinRequest[]>('/join-requests/mine').then(setMyRequests).catch(() => setMyRequests([]));
    }
    api
      .get<JoinRequest[]>('/join-requests')
      .then(setDecidable)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca cererile'));
  }, [isAdmin]);

  useEffect(load, [load]);

  const respondInvite = async (invite: Invite, action: 'accept' | 'decline') => {
    setBusyId(invite.id);
    setError(null);
    try {
      await api.post(`/invites/${invite.id}/${action}`);
      load();
      notifyAccessChanged(); // accepting adds a project — refresh the sidebar's project list live
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Acțiunea a eșuat');
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/join-requests/${id}/${action}`);
      setDecidable((prev) => prev?.filter((r) => r.id !== id) ?? null);
      notifyAccessChanged(); // keeps the sidebar's "Cereri" badge in sync immediately
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Acțiunea a eșuat');
    } finally {
      setBusyId(null);
    }
  };

  const pendingInvites = (invites ?? []).filter((i) => i.status === InviteStatus.PENDING);
  const loaded = invites !== null && decidable !== null && (isAdmin || myRequests !== null);
  const nothingAtAll = loaded && pendingInvites.length === 0 && (myRequests?.length ?? 0) === 0 && decidable!.length === 0;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1>Cereri</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Invitațiile primite, cererile tale trimise și — dacă gestionezi un proiect — cererile altora de decis.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}
      {!loaded && !error && <Spinner />}
      {nothingAtAll && <EmptyState title="Nimic în așteptare" hint="Nicio invitație, nicio cerere trimisă sau de decis." />}

      {pendingInvites.length > 0 && (
        <section>
          <h3 style={{ marginBottom: 10 }}>INVITAȚIILE TALE</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <p style={{ fontSize: 13, flex: 1 }}>
                  <strong>{inv.invitedBy.fullName}</strong> te-a invitat în{' '}
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {inv.project.key}
                  </span>{' '}
                  ({inv.project.name}) cu rolul <strong>{inv.role.name}</strong>
                </p>
                <button className="btn" disabled={busyId === inv.id} onClick={() => respondInvite(inv, 'decline')}>
                  Refuză
                </button>
                <button className="btn btn-primary" disabled={busyId === inv.id} onClick={() => respondInvite(inv, 'accept')}>
                  Acceptă
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isAdmin && myRequests && myRequests.length > 0 && (
        <section>
          <h3 style={{ marginBottom: 10 }}>CERERILE TALE</h3>
          <div className="card scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Proiect</th>
                  <th>Rol cerut</th>
                  <th>Status</th>
                  <th>Trimisă</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.project.key} · {r.project.name}
                    </td>
                    <td>{r.role.name}</td>
                    <td>
                      <span className={REQUEST_STATUS_PILL[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {decidable && decidable.length > 0 && (
        <section>
          <h3 style={{ marginBottom: 10 }}>CERERI DE DECIS</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {decidable.map((r) => (
              <div key={r.id} className="card" style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <Avatar name={r.user.fullName} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{r.user.fullName}</strong>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{r.user.email}</span>
                  </div>
                  <p style={{ fontSize: 13, marginTop: 4 }}>
                    cere rolul <strong>{r.role.name}</strong> în{' '}
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {r.project.key}
                    </span>{' '}
                    ({r.project.name}) — alăturare nouă sau schimbare de rol dacă e deja membru
                  </p>
                  {r.message && (
                    <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, fontStyle: 'italic' }}>"{r.message}"</p>
                  )}
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{formatDateTime(r.createdAt)}</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn" disabled={busyId === r.id} onClick={() => decide(r.id, 'reject')}>
                    Respinge
                  </button>
                  <button className="btn btn-primary" disabled={busyId === r.id} onClick={() => decide(r.id, 'approve')}>
                    Aprobă
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
