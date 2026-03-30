'use client';

import { useState } from 'react';
import { X, Layers } from 'lucide-react';
import Switch from '@/app/components/ui/Switch';
import type { BaseMap } from '@/lib/map-config';

interface LayersPanelProps {
  baseMap: BaseMap;
  onBaseMapChange: (b: BaseMap) => void;
  osMapMode: 'light' | 'dark';
  onOsMapModeChange: (mode: 'light' | 'dark') => void;
  osMapFollowSystem: boolean;
  onOsMapFollowSystemChange: (follow: boolean) => void;
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
  explorerEnabled: boolean;
  onExplorerEnabledChange: (enabled: boolean) => void;
  explorerFilter: string;
  onExplorerFilterChange: (filter: string) => void;
  hillshadeEnabled: boolean;
  onHillshadeEnabledChange: (enabled: boolean) => void;
  poisEnabled: boolean;
  onPoisEnabledChange: (enabled: boolean) => void;
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
  baseMap,
  onBaseMapChange,
  osMapMode,
  onOsMapModeChange,
  osMapFollowSystem,
  onOsMapFollowSystemChange,
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
  explorerEnabled,
  onExplorerEnabledChange,
  explorerFilter,
  onExplorerFilterChange,
  hillshadeEnabled,
  onHillshadeEnabledChange,
  poisEnabled,
  onPoisEnabledChange,
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
            <select
              value={baseMap}
              onChange={(e) => onBaseMapChange(e.target.value as BaseMap)}
              className={selectClass}
            >
              <option value="os">OS / Topo</option>
              <option value="satellite">Satellite</option>
            </select>

            {baseMap === 'os' && (
              <div className="mt-2 space-y-2">
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

              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-text-secondary">Explorer tiles</div>
                  <Switch
                    checked={explorerEnabled}
                    onCheckedChange={onExplorerEnabledChange}
                  />
                </div>

                {explorerEnabled && (
                  <div>
                    <label className="text-xs text-text-secondary">Filter</label>
                    <select
                      value={explorerFilter}
                      onChange={(e) => onExplorerFilterChange(e.target.value)}
                      className={selectClass}
                    >
                      <option value="all">All</option>
                      <option value="non-cycling">Non-cycling</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="w-full h-px bg-border mb-3" />
            </>
          )}

          {/* Points of interest section */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-text-secondary">Points of interest</div>
              <Switch checked={poisEnabled} onCheckedChange={onPoisEnabledChange} />
            </div>
          </div>

          <div className="w-full h-px bg-border mb-3" />

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

          {(heatmapEnabled || personalHeatmapEnabled || explorerEnabled) && (
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
