import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { Activity, Paginated } from '../lib/types';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { ActivityLog } from '../components/ActivityLog';

export function AdminActivityPage() {
  const [data, setData] = useState<Paginated<Activity> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api
      .get<Paginated<Activity>>('/activity', { page, limit: 50 })
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca jurnalul'));
  }, [page]);

  useEffect(load, [load]);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1>Jurnal de activitate</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Cine a schimbat ce și când, pe toate proiectele.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}
      {!data && !error && <Spinner />}
      {data && data.items.length === 0 && (
        <EmptyState title="Nicio activitate încă" hint="Schimbările pe task-uri vor apărea aici." />
      )}
      {data && data.items.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <ActivityLog
            items={data.items}
            showTask
            onOpenTask={(task) => navigate(`/projects/${task.projectId}/board?task=${task.key}`)}
          />
        </div>
      )}

      {data && data.total > data.limit && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Înapoi
          </button>
          <span style={{ fontSize: 13, color: 'var(--muted)', alignSelf: 'center' }}>
            Pagina {data.page} din {Math.ceil(data.total / data.limit)}
          </span>
          <button className="btn" disabled={page * data.limit >= data.total} onClick={() => setPage((p) => p + 1)}>
            Înainte →
          </button>
        </div>
      )}
    </div>
  );
}
