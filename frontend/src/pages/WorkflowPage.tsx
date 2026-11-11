import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useProjectAccess } from '../lib/projectAccess';
import { useProjectRealtime } from '../lib/realtime';
import { Permission, StatusCategory, type Workflow } from '../lib/types';
import { Spinner, ErrorBanner } from '../components/Feedback';
import { Modal } from '../components/Modal';
import { categoryPillClass } from '../lib/format';

const CATEGORY_LABEL: Record<StatusCategory, string> = {
  [StatusCategory.TODO]: 'De făcut',
  [StatusCategory.IN_PROGRESS]: 'În lucru',
  [StatusCategory.DONE]: 'Finalizat',
};

export function WorkflowPage() {
  const { project, can } = useProjectAccess();
  const [wf, setWf] = useState<Workflow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [showAddTransition, setShowAddTransition] = useState(false);
  const canEdit = can(Permission.PROJECT_UPDATE);

  const load = useCallback(() => {
    api
      .get<Workflow>(`/projects/${project.id}/workflow`)
      .then(setWf)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca workflow-ul'));
  }, [project.id]);

  useEffect(load, [load]);
  useProjectRealtime(project.id, load);

  const removeStatus = async (id: string) => {
    if (!confirm('Ștergi acest status? Task-urile existente nu pot fi în el.')) return;
    try {
      await api.delete(`/projects/${project.id}/workflow/statuses/${id}`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ștergere eșuată');
    }
  };

  const removeTransition = async (id: string) => {
    try {
      await api.delete(`/projects/${project.id}/workflow/transitions/${id}`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ștergere eșuată');
    }
  };

  if (error) return <ErrorBanner message={error} />;
  if (!wf) return <Spinner />;

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2>Statusuri (coloane board)</h2>
          {canEdit && (
            <button className="btn" onClick={() => setShowAddStatus(true)}>
              + Status
            </button>
          )}
        </div>
        <div className="card scroll-x">
          <table>
            <thead>
              <tr>
                <th>Poziție</th>
                <th>Cheie</th>
                <th>Nume</th>
                <th>Categorie</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {wf.statuses.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.position}</td>
                  <td className="mono">{s.key}</td>
                  <td>{s.name}</td>
                  <td>
                    <span className={categoryPillClass(s.category)}>{CATEGORY_LABEL[s.category]}</span>
                  </td>
                  {canEdit && (
                    <td>
                      <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => removeStatus(s.id)}>
                        Șterge
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2>Tranziții permise</h2>
          {canEdit && (
            <button className="btn" onClick={() => setShowAddTransition(true)}>
              + Tranziție
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {wf.transitions.map((t) => (
            <div key={t.id} className="card" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="mono" style={{ fontSize: 13 }}>
                {t.from} → {t.to}
              </span>
              {canEdit && (
                <button className="btn btn-ghost" style={{ marginLeft: 'auto', color: 'var(--danger)', padding: '2px 8px' }} onClick={() => removeTransition(t.id)}>
                  ✕
                </button>
              )}
            </div>
          ))}
          {wf.transitions.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nicio tranziție definită.</p>}
        </div>
      </section>

      {showAddStatus && (
        <AddStatusModal
          projectId={project.id}
          onClose={() => setShowAddStatus(false)}
          onAdded={() => {
            setShowAddStatus(false);
            load();
          }}
        />
      )}
      {showAddTransition && (
        <AddTransitionModal
          projectId={project.id}
          workflow={wf}
          onClose={() => setShowAddTransition(false)}
          onAdded={() => {
            setShowAddTransition(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddStatusModal({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: () => void }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StatusCategory>(StatusCategory.TODO);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${projectId}/workflow/statuses`, { key: key.toUpperCase(), name, category });
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Creare eșuată');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Status nou" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <div className="field">
          <label>Cheie (UPPER_SNAKE_CASE)</label>
          <input className="input mono" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="IN_QA" />
        </div>
        <div className="field">
          <label>Nume afișat</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="În testare" />
        </div>
        <div className="field">
          <label>Categorie</label>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value as StatusCategory)}>
            <option value={StatusCategory.TODO}>De făcut</option>
            <option value={StatusCategory.IN_PROGRESS}>În lucru</option>
            <option value={StatusCategory.DONE}>Finalizat</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Anulează
          </button>
          <button className="btn btn-primary" disabled={busy || !key || !name} onClick={submit}>
            Creează
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddTransitionModal({
  projectId,
  workflow,
  onClose,
  onAdded,
}: {
  projectId: string;
  workflow: Workflow;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [from, setFrom] = useState(workflow.statuses[0]?.id ?? '');
  const [to, setTo] = useState(workflow.statuses[1]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${projectId}/workflow/transitions`, { fromStatusId: from, toStatusId: to });
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Creare eșuată');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Tranziție nouă" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <div className="field">
          <label>Din</label>
          <select className="select" value={from} onChange={(e) => setFrom(e.target.value)}>
            {workflow.statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Către</label>
          <select className="select" value={to} onChange={(e) => setTo(e.target.value)}>
            {workflow.statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Anulează
          </button>
          <button className="btn btn-primary" disabled={busy || from === to} onClick={submit}>
            Creează
          </button>
        </div>
      </div>
    </Modal>
  );
}
