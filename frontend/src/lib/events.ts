/**
 * Fired whenever the current user's own project access changes outside the normal page-load path
 * (accepted/declined an invite, had a join request approved/rejected) — things no project-scoped
 * WebSocket room would ever tell us about, since they're not about one specific project's content.
 * The sidebar listens for this to refresh its project list and the "Cereri" badge live, without
 * requiring a manual reload.
 */
const ACCESS_CHANGED_EVENT = 'tracker:access-changed';

export function notifyAccessChanged() {
  window.dispatchEvent(new Event(ACCESS_CHANGED_EVENT));
}

export function onAccessChanged(handler: () => void): () => void {
  window.addEventListener(ACCESS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(ACCESS_CHANGED_EVENT, handler);
}
