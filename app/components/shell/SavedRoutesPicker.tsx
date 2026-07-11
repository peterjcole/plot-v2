'use client';

import { useRef, useState } from 'react';
import { ChevronDown, MapPin, Plus, Pencil, Route as RouteIcon } from 'lucide-react';
import { displayRouteLabel, UNTITLED_ROUTE_NAME, type RouteSummary } from '@/lib/saved-routes';
import RouteListRows from './RouteListRows';

interface SavedRoutesPickerProps {
  loading?: boolean;
  routeName: string;
  routeLocation: string | null;
  isLocating?: boolean;
  saveStatus: 'idle' | 'saving' | 'saved';
  routes: RouteSummary[];
  activeRouteId: string | null;
  onSelectRoute: (id: string) => void;
  onCreateRoute: () => void;
  onRenameActive: (name: string) => void;
  onRenameRoute: (id: string, name: string) => void;
  onDuplicateRoute: (id: string) => void;
  onDeleteRoute: (id: string) => void;
}

export default function SavedRoutesPicker({
  loading = false, routeName, routeLocation, isLocating = false, saveStatus, routes, activeRouteId,
  onSelectRoute, onCreateRoute, onRenameActive, onRenameRoute, onDuplicateRoute, onDeleteRoute,
}: SavedRoutesPickerProps) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState(routeName);
  // Escape unmounts the focused <input>, which fires a native blur — guard commitRename
  // (called from onBlur) against treating that as a save.
  const renameCancelledRef = useRef(false);

  const { label, isPlaceholder } = displayRouteLabel({ name: routeName, location: routeLocation });
  // When the header is already showing the location in place of a name, the subline
  // below shouldn't repeat it.
  const usingLocationAsName = routeName === UNTITLED_ROUTE_NAME && !!routeLocation;

  function startRename() {
    setNameValue(routeName);
    setRenaming(true);
    setOpen(false);
  }

  function commitRename() {
    if (renameCancelledRef.current) {
      renameCancelledRef.current = false;
      return;
    }
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== routeName) onRenameActive(trimmed);
    setRenaming(false);
  }

  function cancelRename() {
    renameCancelledRef.current = true;
    setRenaming(false);
  }

  if (loading) {
    return (
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--fog-ghost)' }}>
        <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: .5; } 50% { opacity: .15; } }`}</style>
        <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px' }}>
          <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--p3)', flexShrink: 0, animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
          <div style={{ width: 110, height: 11, borderRadius: 2, background: 'var(--p3)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
        </div>
        <div style={{ padding: '0 14px 8px' }}>
          <div style={{ width: 70, height: 9, borderRadius: 2, background: 'var(--p3)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ flexShrink: 0, borderBottom: '1px solid var(--fog-ghost)', position: 'relative' }}>
      <style>{`@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }`}</style>
      <div
        onClick={() => !renaming && setOpen((v) => !v)}
        style={{
          height: 44, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px',
          cursor: renaming ? 'default' : 'pointer', background: open ? 'var(--p2)' : 'transparent',
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: 4, background: 'var(--p2)', border: '1px solid var(--p3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isPlaceholder ? 'var(--fog-dim)' : 'var(--ora)', flexShrink: 0,
        }}>
          <RouteIcon size={14} />
        </div>
        {renaming ? (
          <input
            autoFocus
            value={nameValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') cancelRename();
            }}
            onBlur={commitRename}
            style={{
              flex: 1, minWidth: 0, background: 'transparent', border: 'none', borderBottom: '1px solid var(--ora)',
              outline: 'none', font: '600 11px/1.3 var(--mono)', color: 'var(--ice)', padding: '0 0 3px',
            }}
          />
        ) : (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => { e.stopPropagation(); startRename(); }}>
            <span style={{
              font: '600 11px/1.3 var(--mono)', color: isPlaceholder ? 'var(--fog-dim)' : 'var(--ice)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
            <Pencil size={10} style={{ color: 'var(--fog-dim)', flexShrink: 0, opacity: 0.7 }} />
          </div>
        )}
        {!renaming && (
          <ChevronDown
            size={14}
            style={{ color: open ? 'var(--ora)' : 'var(--fog-dim)', flexShrink: 0, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}
          />
        )}

        {open && (
          <>
            <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute', top: 44, left: 8, right: 8,
                background: 'var(--glass-hvy)', backdropFilter: 'blur(14px)', border: '1px solid var(--p3)',
                borderRadius: 6, boxShadow: '0 12px 32px rgba(0,0,0,0.55)', zIndex: 40, overflow: 'hidden',
              }}
            >
              <div style={{ padding: '10px 12px 8px', font: '600 8px/1 var(--mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--fog-dim)' }}>
                My Routes{routes.length > 0 ? ` · ${routes.length}` : ''}
              </div>
              <RouteListRows
                routes={routes}
                activeRouteId={activeRouteId}
                onSelect={(id) => { onSelectRoute(id); setOpen(false); }}
                onRename={onRenameRoute}
                onDuplicate={onDuplicateRoute}
                onDelete={onDeleteRoute}
              />
              <div
                onClick={() => { onCreateRoute(); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px',
                  borderTop: '1px solid var(--fog-ghost)', cursor: 'pointer', color: 'var(--ora)',
                  font: '600 9px/1 var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase',
                }}
              >
                <Plus size={13} />
                New route
              </div>
            </div>
          </>
        )}
      </div>

      {!renaming && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 14px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, font: '400 9px/1 var(--mono)', color: 'var(--fog-dim)',
            letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
          }}>
            {!usingLocationAsName && (
              <>
                {routeLocation && <MapPin size={10} style={{ flexShrink: 0 }} />}
                {routeLocation ?? (isLocating ? 'Locating…' : '')}
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, font: '500 8px/1 var(--mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--fog-dim)', flexShrink: 0 }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: saveStatus === 'saving' ? 'var(--fog-dim)' : 'var(--grn)',
              boxShadow: saveStatus === 'saving' ? 'none' : '0 0 4px var(--grn)',
              animation: saveStatus === 'saving' ? 'pulse-dot 1s ease-in-out infinite' : 'none',
            }} />
            {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
          </div>
        </div>
      )}
    </div>
  );
}
