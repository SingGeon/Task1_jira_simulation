import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useProjectAccess } from '../lib/projectAccess';
import { useProjectRealtime } from '../lib/realtime';
import { Permission, SprintState, type Sprint } from '../lib/types';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { CreateSprintModal, StartSprintModal, CompleteSprintModal } from '../components/SprintModals';
import { formatDate } from '../lib/format';

const STATE_LABEL: Record<SprintState, string> = {
  [SprintState.PLANNED]: 'Planificat',
  [SprintState.ACTIVE]: 'Activ',
  [SprintState.CLOSED]: 'Închis',
};

export function SprintsPage() {
  const { project, can } = useProjectAccess();
  const [sprints, setSprints] = useState<Sprint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [starting, setStarting] = useState<Sprint | null>(null);
  const [completing, setCompleting] = useState<Sprint | null>(null);

  const canManage = can(Permission.SPRINT_MANAGE);

  const load = useCallback(() => {
    api
      .get<Sprint[]>(`/projects/${project.id}/sprints`)
      .then((s) => setSprints(s.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca sprinturile'));
  }, [project.id]);

  useEffect(load, [load]);
  useProjectRealtime(project.id, load);

  const remove = async (s: Sprint) => {
    if (!confirm(`Ștergi "${s.name}"?`)) return;
    try {
      await api.delete(`/projects/${project.id}/sprints/${s.id}`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ștergere eșuată');
    }
  };

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Sprint nou
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}
      {!sprints && !error && <Spinner />}
      {sprints && sprints.length === 0 && <EmptyState title="Niciun sprint" hint="Creează primul sprint pentru acest proiect." />}

      {sprints && sprints.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sprints.map((s) => (
            <div key={s.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2>{s.name}</h2>
                  <span
                    className={
                      s.state === SprintState.ACTIVE ? 'pill pill-progress' : s.state === SprintState.CLOSED ? 'pill pill-done' : 'pill pill-todo'
                    }
                  >
                    {STATE_LABEL[s.state]}
                  </span>
                </div>
                {s.goal && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{s.goal}</p>}
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {s.startDate ? `${formatDate(s.startDate)} → ${formatDate(s.endDate)}` : 'Fără date programate'}
                </p>
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {s.state === SprintState.PLANNED && (
                    <button className="btn" onClick={() => setStarting(s)}>
                      Pornește
                    </button>
                  )}
                  {s.state === SprintState.ACTIVE && (
                    <button className="btn" onClick={() => setCompleting(s)}>
                      Închide
                    </button>
                  )}
                  {s.state === SprintState.PLANNED && (
                    <button className="btn btn-danger" onClick={() => remove(s)}>
                      Șterge
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateSprintModal
          projectId={project.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {starting && (
        <StartSprintModal
          projectId={project.id}
          sprint={starting}
          onClose={() => setStarting(null)}
          onStarted={() => {
            setStarting(null);
            load();
          }}
        />
      )}
      {completing && (
        <CompleteSprintModal
          projectId={project.id}
          sprint={completing}
          sprints={sprints ?? []}
          onClose={() => setCompleting(null)}
          onCompleted={() => {
            setCompleting(null);
            load();
          }}
        />
      )}
    </div>
  );
}
