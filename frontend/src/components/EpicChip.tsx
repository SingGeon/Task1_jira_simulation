import { epicHue } from '../lib/format';
import type { EpicRef } from '../lib/types';

export function EpicChip({ epic }: { epic: EpicRef }) {
  return (
    <span className="epic-chip" style={{ '--hue': epicHue(epic) } as React.CSSProperties} title={epic.title}>
      {epic.title}
    </span>
  );
}
