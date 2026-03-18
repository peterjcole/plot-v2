'use client';

import { useState } from 'react';
import { X, Layers } from 'lucide-react';
import Switch from '@/app/components/ui/Switch';
import type { BaseMap } from '@/lib/map-config';

interface ActivityLayersPanelProps {
  baseMap: BaseMap;
  onBaseMapChange: (b: BaseMap) => void;
  osMapMode: 'light' | 'dark';
  onOsMapModeChange: (mode: 'light' | 'dark') => void;
  osMapFollowSystem: boolean;
  onOsMapFollowSystemChange: (follow: boolean) => void;
  hillshadeEnabled: boolean;
  onHillshadeEnabledChange: (v: boolean) => void;
}

const selectClass =
  'w-full bg-surface-muted border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent';

export default function ActivityLayersPanel({
  baseMap,
  onBaseMapChange,
  osMapMode,
  onOsMapModeChange,
  osMapFollowSystem,
  onOsMapFollowSystemChange,
  hillshadeEnabled,
  onHillshadeEnabledChange,
}: ActivityLayersPanelProps) {
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

          {baseMap === 'os' && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Dark mode</span>
                <Switch
                  checked={osMapMode === 'dark'}
                  onCheckedChange={(checked) => onOsMapModeChange(checked ? 'dark' : 'light')}
                  disabled={osMapFollowSystem}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={osMapFollowSystem}
                  onChange={(e) => onOsMapFollowSystemChange(e.target.checked)}
                  className="w-3.5 h-3.5 accent-accent"
                />
                <span className="text-xs text-text-secondary">Follow system colour scheme</span>
              </label>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Hillshading</span>
                <Switch checked={hillshadeEnabled} onCheckedChange={onHillshadeEnabledChange} />
              </div>
            </div>
          )}
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
