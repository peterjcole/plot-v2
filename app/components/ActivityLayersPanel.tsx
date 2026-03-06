'use client';

import { useState } from 'react';
import { X, Layers } from 'lucide-react';
import type { BaseMap } from '@/lib/map-config';

interface ActivityLayersPanelProps {
  baseMap: BaseMap;
  onBaseMapChange: (b: BaseMap) => void;
}

const selectClass =
  'w-full bg-surface-muted border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent';

export default function ActivityLayersPanel({ baseMap, onBaseMapChange }: ActivityLayersPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-4 left-3 z-[1000]">
      {open && (
        <div className="mb-2 w-56 bg-surface-raised/70 backdrop-blur-md rounded-xl shadow-lg border border-border p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-text-primary">Layers</span>
            <button
              onClick={() => setOpen(false)}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div>
            <div className="text-xs font-medium text-text-secondary mb-1">Base map</div>
            <select
              value={baseMap}
              onChange={(e) => onBaseMapChange(e.target.value as BaseMap)}
              className={selectClass}
            >
              <option value="os">Ordnance Survey</option>
              <option value="satellite">Satellite</option>
            </select>
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Layers"
          className="flex items-center justify-center w-11 h-11 bg-surface-raised/70 backdrop-blur-md rounded-xl shadow-lg border border-border text-text-primary hover:bg-surface-muted transition-colors"
        >
          <Layers size={18} />
        </button>
      )}
    </div>
  );
}
