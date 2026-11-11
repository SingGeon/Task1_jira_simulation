import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { Permission, type ProjectWithAccess } from './types';

interface ProjectAccessValue {
  project: ProjectWithAccess;
  can: (p: Permission) => boolean;
  reload: () => void;
}

const Ctx = createContext<ProjectAccessValue | null>(null);

export function ProjectAccessProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const [project, setProject] = useState<ProjectWithAccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api
      .get<ProjectWithAccess>(`/projects/${projectId}`)
      .then(setProject)
      .catch(() => setError('Proiectul nu a putut fi încărcat'));
  }, [projectId]);

  useEffect(reload, [reload]);

  if (error) return <div className="error-banner" style={{ margin: 20 }}>{error}</div>;
  if (!project) return null;

  return (
    <Ctx.Provider value={{ project, can: (p) => project.myPermissions.includes(p), reload }}>{children}</Ctx.Provider>
  );
}

export function useProjectAccess(): ProjectAccessValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProjectAccess must be used within ProjectAccessProvider');
  return ctx;
}
