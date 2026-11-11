import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { SprintState, type Sprint } from '../lib/types';
import { Modal } from './Modal';
import { ErrorBanner } from './Feedback';
import { toDateInputValue } from '../lib/format';

export function CreateSprintModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${projectId}/sprints`, { name, goal: goal || undefined });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Creare eșuată');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Sprint nou" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <div className="field">
          <label>Nume</label>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 1" />
        </div>
        <div className="field">
          <label>Obiectiv (opțional)</label>
          <textarea className="textarea" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Anulează
          </button>
          <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={submit}>
            Creează
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function StartSprintModal({
  projectId,
  sprint,
  onClose,
  onStarted,
}: {
  projectId: string;
  sprint: Sprint;
  onClose: () => void;
  onStarted: () => void;
}) {
  const [endDate, setEndDate] = useState(toDateInputValue(new Date(Date.now() + 14 * 86400000)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${projectId}/sprints/${sprint.id}/start`, { endDate: new Date(endDate).toISOString() });
      onStarted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Pornire eșuată');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Pornește "${sprint.name}"`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <div className="field">
          <label>Se încheie la</label>
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Anulează
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            Pornește sprintul
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function CompleteSprintModal({
  projectId,
  sprint,
  sprints,
  onClose,
  onCompleted,
}: {
  projectId: string;
  sprint: Sprint;
  sprints: Sprint[];
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const planned = sprints.filter((s) => s.state === SprintState.PLANNED && s.id !== sprint.id);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${projectId}/sprints/${sprint.id}/complete`, {
        moveOpenTasksToSprintId: target || undefined,
      });
      onCompleted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Închidere eșuată');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Închide "${sprint.name}"`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <div className="field">
          <label>Task-urile nefinalizate merg către</label>
          <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Backlog</option>
            {planned.map((s) => (
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
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            Închide sprintul
          </button>
        </div>
      </div>
    </Modal>
  );
}
