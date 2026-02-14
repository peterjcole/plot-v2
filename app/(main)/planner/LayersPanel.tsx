'use client';

import { useState } from 'react';
import { X, Layers } from 'lucide-react';
import Switch from '@/app/components/ui/Switch';

interface LayersPanelProps {
  heatmapEnabled: boolean;
  onHeatmapEnabledChange: (enabled: boolean) => void;
  heatmapSport: string;
  onHeatmapSportChange: (sport: string) => void;
  heatmapColor: string;
  onHeatmapColorChange: (color: string) => void;
  dimBaseMap: boolean;
  onDimBaseMapChange: (dim: boolean) => void;
  personalHeatmapEnabled: boolean;
  onPersonalHeatmapEnabledChange: (enabled: boolean) => void;
  personalTilesAvailable: boolean | null;
}

const SPORTS = [
  { value: 'all', label: 'All' },
  { value: 'ride', label: 'Ride' },
  { value: 'run', label: 'Run' },
  { value: 'water', label: 'Water' },
  { value: 'winter', label: 'Winter' },
];

const COLORS = [
  { value: 'hot', label: 'Hot' },
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
  { value: 'gray', label: 'Gray' },
  { value: 'bluered', label: 'Blue-Red' },
];

const selectClass =
  'w-full bg-surface-muted border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent';


export default function LayersPanel({
  heatmapEnabled,
  onHeatmapEnabledChange,
  heatmapSport,
  onHeatmapSportChange,
  heatmapColor,
  onHeatmapColorChange,
  dimBaseMap,
  onDimBaseMapChange,
  personalHeatmapEnabled,
  onPersonalHeatmapEnabledChange,
  personalTilesAvailable,
}: LayersPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-4 left-3 z-10">
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

          {/* Base map section */}
          <div className="mb-3">
            <div className="text-xs font-medium text-text-secondary mb-1">Base map</div>
            <div className="text-sm text-text-primary">Ordnance Survey</div>
          </div>

          <div className="w-full h-px bg-border mb-3" />

          {/* Personal heatmap section — only shown for tile-enabled users */}
          {personalTilesAvailable === true && (
            <>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-text-secondary">Personal heatmap</div>
                  <Switch
                    checked={personalHeatmapEnabled}
                    onCheckedChange={onPersonalHeatmapEnabledChange}
                  />
                </div>
              </div>

              <div className="w-full h-px bg-border mb-3" />
            </>
          )}

          {/* Global heatmap section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-text-secondary">Global heatmap</div>
              <Switch checked={heatmapEnabled} onCheckedChange={onHeatmapEnabledChange} />
            </div>

            {heatmapEnabled && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-text-secondary">Sport</label>
                  <select
                    value={heatmapSport}
                    onChange={(e) => onHeatmapSportChange(e.target.value)}
                    className={selectClass}
                  >
                    {SPORTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Color</label>
                  <select
                    value={heatmapColor}
                    onChange={(e) => onHeatmapColorChange(e.target.value)}
                    className={selectClass}
                  >
                    {COLORS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {(heatmapEnabled || personalHeatmapEnabled) && (
            <>
              <div className="w-full h-px bg-border my-3" />
              <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary">Dim base map</label>
                <Switch checked={dimBaseMap} onCheckedChange={onDimBaseMapChange} />
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title="Layers"
        className="flex items-center justify-center w-11 h-11 bg-surface-raised/70 backdrop-blur-md rounded-xl shadow-lg border border-border text-text-primary hover:bg-surface-muted transition-colors"
      >
        <Layers size={18} />
      </button>
    </div>
  );
}
