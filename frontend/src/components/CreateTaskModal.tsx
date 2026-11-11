import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { TaskPriority, TaskType, type Epic, type Task } from '../lib/types';
import { Modal } from './Modal';
import { ErrorBanner } from './Feedback';
import { typeIcon } from '../lib/format';

const CREATABLE_TYPES = Object.values(TaskType).filter((t) => t !== TaskType.EPIC);

export function CreateTaskModal({
  projectId,
  sprintId,
  onClose,
  onCreated,
}: {
  projectId: string;
  sprintId?: string | null;
  onClose: () => void;
  onCreated: (t: Task) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>(TaskType.TASK);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [epicId, setEpicId] = useState('');
  const [epics, setEpics] = useState<Epic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Epic[]>(`/projects/${projectId}/epics`).then(setEpics).catch(() => {});
  }, [projectId]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const task = await api.post<Task>(`/projects/${projectId}/tasks`, {
        title,
        description: description || undefined,
        type,
        priority,
        sprintId: sprintId ?? undefined,
        epicId: epicId || undefined,
      });
      onCreated(task);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Crearea task-ului a eșuat');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Task nou" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <div className="field">
          <label>Titlu</label>
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ce trebuie făcut?" />
        </div>
        <div className="field">
          <label>Descriere (opțional)</label>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Tip</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as TaskType)}>
              {CREATABLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeIcon(t)} {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Prioritate</label>
            <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {Object.values(TaskPriority).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        {epics.length > 0 && (
          <div className="field">
            <label>Epic (opțional)</label>
            <select className="select" value={epicId} onChange={(e) => setEpicId(e.target.value)}>
              <option value="">Fără epic</option>
              {epics.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.key} — {e.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Anulează
          </button>
          <button className="btn btn-primary" disabled={busy || title.trim().length < 3} onClick={submit}>
            {busy ? 'Se creează…' : 'Creează task'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
