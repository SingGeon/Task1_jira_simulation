import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { Activity, Paginated, Project } from '../lib/types';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { ActivityLog } from '../components/ActivityLog';

export function AdminActivityPage() {
  const [data, setData] = useState<Paginated<Activity> | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = params.get('project') ?? '';
  const page = Number(params.get('page') ?? '1');

  useEffect(() => {
    api.get<Project[]>('/projects').then(setProjects).catch(() => {});
  }, []);

  const load = useCallback(() => {
    api
      .get<Paginated<Activity>>('/activity', { projectId: projectId || undefined, page, limit: 50 })
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca jurnalul'));
  }, [projectId, page]);

  useEffect(load, [load]);

  // Changing the project resets to page 1 — a fresh filter shouldn't keep an old page number.
  const setProjectFilter = (id: string) => setParams(id ? { project: id } : {});

  const setPage = (p: number) => {
    const next = new URLSearchParams(params);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    setParams(next);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1>Jurnal de activitate</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Cine a schimbat ce și când — pe toate proiectele, sau filtrat pe unul singur.
        </p>
      </div>

      <div className="field" style={{ maxWidth: 340 }}>
        <label>Proiect</label>
        <select className="select" value={projectId} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">Toate proiectele</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.key} — {p.name}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorBanner message={error} />}
      {!data && !error && <Spinner />}
      {data && data.items.length === 0 && (
        <EmptyState
          title="Nicio activitate încă"
          hint={projectId ? 'Nicio schimbare înregistrată pentru acest proiect.' : 'Schimbările pe task-uri vor apărea aici.'}
        />
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
          <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Înapoi
          </button>
          <span style={{ fontSize: 13, color: 'var(--muted)', alignSelf: 'center' }}>
            Pagina {data.page} din {Math.ceil(data.total / data.limit)}
          </span>
          <button className="btn" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>
            Înainte →
          </button>
        </div>
      )}
    </div>
  );
}
