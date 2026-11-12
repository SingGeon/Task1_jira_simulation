import { typeIcon, typeIconClass } from '../lib/format';

/** Colored badge for a task type (Epic/Story/Task/Bug/Sub-task) — reads at a glance, unlike plain muted text. */
export function TypeIcon({ type }: { type: string }) {
  return (
    <span className={`type-icon ${typeIconClass(type)}`} title={type}>
      {typeIcon(type)}
    </span>
  );
}
