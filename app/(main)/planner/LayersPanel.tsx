'use client';

import { useState } from 'react';

interface LayersPanelProps {
  heatmapEnabled: boolean;
  onHeatmapEnabledChange: (enabled: boolean) => void;
  heatmapSport: string;
  onHeatmapSportChange: (sport: string) => void;
  heatmapColor: string;
  onHeatmapColorChange: (color: string) => void;
  dimBaseMap: boolean;
  onDimBaseMapChange: (dim: boolean) => void;
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

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
        enabled ? 'bg-accent' : 'bg-surface-muted'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform mt-0.5 ml-0.5 ${
          enabled ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function LayersPanel({
  heatmapEnabled,
  onHeatmapEnabledChange,
  heatmapSport,
  onHeatmapSportChange,
  heatmapColor,
  onHeatmapColorChange,
  dimBaseMap,
  onDimBaseMapChange,
}: LayersPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-4 left-3 z-10">
      {open && (
        <div className="mb-2 w-56 bg-surface-raised/95 backdrop-blur-sm rounded-xl shadow-lg border border-border p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-text-primary">Layers</span>
            <button
              onClick={() => setOpen(false)}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Base map section */}
          <div className="mb-3">
            <div className="text-xs font-medium text-text-secondary mb-1">Base map</div>
            <div className="text-sm text-text-primary">Ordnance Survey</div>
          </div>

          <div className="w-full h-px bg-border mb-3" />

          {/* Heatmap section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-text-secondary">Global heatmap</div>
              <ToggleSwitch enabled={heatmapEnabled} onChange={onHeatmapEnabledChange} />
            </div>

            {heatmapEnabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-text-secondary">Dim base map</label>
                  <ToggleSwitch enabled={dimBaseMap} onChange={onDimBaseMapChange} />
                </div>
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
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title="Layers"
        className="flex items-center justify-center w-11 h-11 bg-surface-raised/95 backdrop-blur-sm rounded-xl shadow-lg border border-border text-text-primary hover:bg-surface-muted transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </button>
    </div>
  );
}
