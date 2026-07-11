'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Check, Route as RouteIcon } from 'lucide-react';
import { displayRouteLabel, type RouteSummary } from '@/lib/saved-routes';
import DeleteRouteConfirm from './DeleteRouteConfirm';

interface RouteListRowsProps {
  routes: RouteSummary[];
  activeRouteId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

function fmtDist(m: number): string {
  return `${(m / 1000).toFixed(1)} km`;
}

// Positions a fixed-position popover of `width` below-right of `anchor`, flipping above
// when there isn't room below and clamping horizontally to stay on-screen. Mirrors the
// positioning logic already used by ImportRoutePopover.
function popoverPosition(anchor: DOMRect, width: number, height: number) {
  const left = Math.min(Math.max(8, anchor.right - width), window.innerWidth - width - 8);
  const spaceBelow = window.innerHeight - anchor.bottom;
  const top = spaceBelow < height + 8 ? anchor.top - height - 4 : anchor.bottom + 4;
  return { top, left };
}

export default function RouteListRows({ routes, activeRouteId, onSelect, onRename, onDuplicate, onDelete }: RouteListRowsProps) {
  const [menuFor, setMenuFor] = useState<{ id: string; anchor: DOMRect } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; anchor: DOMRect } | null>(null);

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) onRename(id, trimmed);
    setRenamingId(null);
  }

  if (routes.length === 0) {
    return (
      <div style={{ padding: '28px 20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--p2)', border: '1px solid var(--p3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fog-dim)' }}>
          <RouteIcon size={16} />
        </div>
        <div style={{ font: '600 10px/1.4 var(--mono)', color: 'var(--fog)' }}>No saved routes yet</div>
        <div style={{ font: '400 9px/1.5 var(--mono)', color: 'var(--fog-dim)', maxWidth: 200 }}>Start plotting to create one.</div>
      </div>
    );
  }

  const menuRoute = menuFor ? routes.find((r) => r.id === menuFor.id) : null;
  const confirmRoute = confirmDelete ? routes.find((r) => r.id === confirmDelete.id) : null;

  return (
    <div className="route-list-scroll" style={{ maxHeight: 320, overflowY: 'auto' }}>
      <style>{`
        .route-list-scroll { scrollbar-width: thin; scrollbar-color: var(--p3) transparent; }
        .route-list-scroll::-webkit-scrollbar { width: 6px; }
        .route-list-scroll::-webkit-scrollbar-track { background: transparent; }
        .route-list-scroll::-webkit-scrollbar-thumb { background: var(--p3); border-radius: 3px; }
      `}</style>
      {routes.map((route) => {
        const isCurrent = route.id === activeRouteId;
        const { label, isPlaceholder } = displayRouteLabel(route);
        const isRenaming = renamingId === route.id;
        return (
          <div
            key={route.id}
            onClick={() => !isRenaming && onSelect(route.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              cursor: isRenaming ? 'default' : 'pointer',
              background: isCurrent ? 'rgba(224,112,32,0.07)' : 'transparent',
            }}
          >
            <div style={{ width: 13, height: 13, flexShrink: 0, color: 'var(--ora)' }}>
              {isCurrent && <Check size={13} strokeWidth={2.5} />}
            </div>
            <div style={{
              width: 26, height: 26, borderRadius: 4, background: 'var(--p2)', border: '1px solid var(--p3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isPlaceholder ? 'var(--fog-dim)' : 'var(--ora)', flexShrink: 0,
            }}>
              <RouteIcon size={13} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(route.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={() => commitRename(route.id)}
                  style={{
                    width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--ora)',
                    outline: 'none', font: '600 10px/1.3 var(--mono)', color: 'var(--ice)', padding: '0 0 2px',
                  }}
                />
              ) : (
                <>
                  <div style={{
                    font: '600 10px/1.3 var(--mono)', color: isPlaceholder ? 'var(--fog-dim)' : 'var(--ice)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </div>
                  <div style={{ font: '400 8px/1 var(--mono)', color: 'var(--fog-dim)', marginTop: 3 }}>
                    {fmtDist(route.distanceM)} · {relativeTime(route.updatedAt)}
                  </div>
                </>
              )}
            </div>
            {!isRenaming && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const anchor = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                  setMenuFor(menuFor?.id === route.id ? null : { id: route.id, anchor });
                }}
                aria-label="Route options"
                style={{
                  width: 22, height: 22, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--fog-dim)', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <MoreVertical size={13} />
              </button>
            )}
          </div>
        );
      })}

      {menuFor && menuRoute && createPortal(
        (() => {
          const { top, left } = popoverPosition(menuFor.anchor, 138, 96);
          return (
            <>
              <div onClick={() => setMenuFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
              <div
                style={{
                  position: 'fixed', top, left, minWidth: 138,
                  background: 'var(--glass-hvy)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid var(--p3)', borderRadius: 5, padding: 4, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
                }}
              >
                <div
                  onClick={() => { setRenamingId(menuFor.id); setRenameValue(menuRoute.name); setMenuFor(null); }}
                  style={{ padding: '7px 8px', borderRadius: 3, font: '500 9.5px/1 var(--mono)', color: 'var(--fog)', cursor: 'pointer' }}
                >
                  Rename
                </div>
                <div
                  onClick={() => { onDuplicate(menuFor.id); setMenuFor(null); }}
                  style={{ padding: '7px 8px', borderRadius: 3, font: '500 9.5px/1 var(--mono)', color: 'var(--fog)', cursor: 'pointer' }}
                >
                  Duplicate
                </div>
                <div style={{ height: 1, background: 'var(--fog-ghost)', margin: '4px 2px' }} />
                <div
                  onClick={(e) => {
                    const anchor = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    setConfirmDelete({ id: menuFor.id, anchor });
                    setMenuFor(null);
                  }}
                  style={{ padding: '7px 8px', borderRadius: 3, font: '500 9.5px/1 var(--mono)', color: 'rgba(220,80,80,0.85)', cursor: 'pointer' }}
                >
                  Delete
                </div>
              </div>
            </>
          );
        })(),
        document.body,
      )}

      {confirmDelete && confirmRoute && createPortal(
        (() => {
          const { top, left } = popoverPosition(confirmDelete.anchor, 208, 90);
          return (
            <>
              <div onClick={() => setConfirmDelete(null)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
              <div style={{ position: 'fixed', top, left, zIndex: 50 }}>
                <DeleteRouteConfirm
                  name={confirmRoute.name}
                  onCancel={() => setConfirmDelete(null)}
                  onConfirm={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }}
                />
              </div>
            </>
          );
        })(),
        document.body,
      )}
    </div>
  );
}
