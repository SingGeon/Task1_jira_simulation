import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { JoinRequest } from '../lib/types';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { formatDateTime } from '../lib/format';

export function AdminJoinRequestsPage() {
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<JoinRequest[]>('/join-requests')
      .then(setRequests)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca cererile'));
  }, []);

  useEffect(load, [load]);

  const decide = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/join-requests/${id}/${action}`);
      setRequests((prev) => prev?.filter((r) => r.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Acțiunea a eșuat');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1>Cereri de acces</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Utilizatori care au cerut să se alăture unui proiect.</p>
      </div>

      {error && <ErrorBanner message={error} />}
      {!requests && !error && <Spinner />}
      {requests && requests.length === 0 && <EmptyState title="Nicio cerere în așteptare" />}

      {requests && requests.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.map((r) => (
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
      )}
    </div>
  );
}
