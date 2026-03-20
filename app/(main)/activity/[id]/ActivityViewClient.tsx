'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { ActivityData } from '@/lib/types';
import { type BaseMap } from '@/lib/map-config';
import {
  type ActivityExportPrefs,
  PREFS_CHANGED_EVENT,
  dispatchPrefsChanged,
  loadActivityExportPrefs,
} from '@/lib/activity-export-prefs';
import PhotoGallery from '@/app/components/PhotoGallery';
import ActivityLayersPanel from '@/app/components/ActivityLayersPanel';

interface MapProps {
  activity: ActivityData;
  width: number;
  height: number;
  onPinClick?: (index: number) => void;
  baseMap?: BaseMap;
  osDark?: boolean;
  hideDetails?: boolean;
  hillshadeEnabled?: boolean;
}

const ActivityMap = dynamic<MapProps>(() => import('@/app/components/ActivityMap'), {
  ssr: false,
});

interface ActivityViewClientProps {
  activity: ActivityData;
}

export default function ActivityViewClient({ activity }: ActivityViewClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [maxContainerHeight, setMaxContainerHeight] = useState<number | null>(null);
  const [mapHeight, setMapHeight] = useState<number | null>(null);
  const [isWide, setIsWide] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | undefined>(undefined);
  const [mapReady, setMapReady] = useState(false);
  const [baseMap, setBaseMap] = useState<BaseMap>(() => loadActivityExportPrefs().baseMap);
  const [osMapMode, setOsMapMode] = useState<'light' | 'dark'>(() => loadActivityExportPrefs().osMapMode);
  const [osMapFollowSystem, setOsMapFollowSystem] = useState<boolean>(() => loadActivityExportPrefs().osMapFollowSystem);
  const [hillshadeEnabled, setHillshadeEnabled] = useState<boolean>(() => loadActivityExportPrefs().hillshadeEnabled ?? false);
  const [includeDetails, setIncludeDetails] = useState<boolean>(() => loadActivityExportPrefs().includeDetails ?? true);
  const [systemDark, setSystemDark] = useState(false);

  const hasPhotos = activity.photos.length > 0;

  // Detect system dark mode preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const osDark = baseMap === 'os' && (osMapFollowSystem ? systemDark : osMapMode === 'dark');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const containerWidth = Math.round(el.clientWidth);
      const wide = containerWidth >= 1024;
      setIsWide(wide);

      if (wide && hasPhotos) {
        const mw = Math.round(containerWidth * 0.6);
        // Calculate available height: viewport minus space above the container
        const containerTop = el.getBoundingClientRect().top;
        const availableHeight = Math.round(window.innerHeight - containerTop - 64);
        setMaxContainerHeight(Math.max(400, availableHeight));
        const viewportHeight = Math.max(500, window.innerHeight * 0.75);
        const mh = Math.round(Math.min(mw, viewportHeight));
        setDimensions({ width: mw, height: mh });
      } else {
        setMaxContainerHeight(null);
        const viewportHeight = hasPhotos
          ? Math.max(350, window.innerHeight * 0.7)
          : Math.max(500, window.innerHeight * 0.75);
        setDimensions({ width: containerWidth, height: Math.round(viewportHeight) });
      }
    };

    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();

    return () => {
      observer.disconnect();
    };
  }, [hasPhotos]);

  // In wide mode, observe the map wrapper's stretched height so the map fills it
  useEffect(() => {
    const el = mapWrapperRef.current;
    if (!el || !isWide) {
      setMapHeight(null);
      return;
    }

    const observer = new ResizeObserver(() => {
      setMapHeight(Math.round(el.clientHeight));
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [isWide]);

  // Poll for window.__MAP_READY__ set by TileLoadHandler inside ActivityMap
  useEffect(() => {
    if (mapReady || !dimensions) return;

    const interval = setInterval(() => {
      if (window.__MAP_READY__) {
        setMapReady(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [mapReady, dimensions]);

  // Persist activity preferences and notify other components
  useEffect(() => {
    const prefs = loadActivityExportPrefs();
    const updated = { ...prefs, baseMap, osMapMode, osMapFollowSystem, hillshadeEnabled };
    try {
      localStorage.setItem('plotv2-activity-prefs', JSON.stringify(updated));
    } catch { /* ignore */ }
    dispatchPrefsChanged(updated);
  }, [baseMap, osMapMode, osMapFollowSystem, hillshadeEnabled]);

  // Sync map-layer prefs from ExportOptionsPanel
  useEffect(() => {
    const handler = (e: Event) => {
      const incoming = (e as CustomEvent<ActivityExportPrefs>).detail;
      setBaseMap(incoming.baseMap);
      setOsMapMode(incoming.osMapMode);
      setOsMapFollowSystem(incoming.osMapFollowSystem);
      setHillshadeEnabled(incoming.hillshadeEnabled ?? false);
      setIncludeDetails(incoming.includeDetails ?? true);
    };
    window.addEventListener(PREFS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(PREFS_CHANGED_EVENT, handler);
  }, []);

  // Reset ready state if activity, base map, or dark mode changes
  useEffect(() => {
    window.__MAP_READY__ = false;
    setMapReady(false);
  }, [activity.id, baseMap, osDark]);

  const handlePinClick = useCallback((index: number) => {
    setActivePhotoIndex(index);
  }, []);

  const spinner = (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-muted">
      <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" aria-hidden="true" />
    </div>
  );

  const layersPanel = (
    <ActivityLayersPanel
      baseMap={baseMap}
      onBaseMapChange={setBaseMap}
      osMapMode={osMapMode}
      onOsMapModeChange={setOsMapMode}
      osMapFollowSystem={osMapFollowSystem}
      onOsMapFollowSystemChange={setOsMapFollowSystem}
      hillshadeEnabled={hillshadeEnabled}
      onHillshadeEnabledChange={setHillshadeEnabled}
    />
  );

  if (!hasPhotos) {
    return (
      <div ref={containerRef} className="relative w-full">
        {dimensions && (
          <ActivityMap activity={activity} width={dimensions.width} height={dimensions.height} baseMap={baseMap} osDark={osDark} hillshadeEnabled={hillshadeEnabled} />
        )}
        {layersPanel}
        {!mapReady && spinner}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full bg-surface-muted">
      {dimensions && (
        <div
          className={isWide ? 'flex flex-row items-stretch gap-1' : 'flex flex-col gap-1'}
          style={isWide && maxContainerHeight ? { maxHeight: maxContainerHeight } : undefined}
        >
          <div
            ref={mapWrapperRef}
            className={isWide ? 'shrink-0' : ''}
            style={isWide ? { width: dimensions.width, minHeight: dimensions.height } : undefined}
          >
            <ActivityMap
              activity={activity}
              width={dimensions.width}
              height={isWide && mapHeight ? mapHeight : dimensions.height}
              onPinClick={handlePinClick}
              baseMap={baseMap}
              osDark={osDark}
              hillshadeEnabled={hillshadeEnabled}
            />
          </div>
          <div className={isWide ? 'flex-1 overflow-y-auto' : 'flex-1'}>
            <PhotoGallery
              photos={activity.photos}
              activeIndex={activePhotoIndex}
              columnCount={isWide && activity.photos.length <= 3 ? 1 : !isWide && activity.photos.length === 1 ? 1 : 2}
            />
          </div>
        </div>
      )}
      {layersPanel}
      {!mapReady && spinner}
    </div>
  );
}
