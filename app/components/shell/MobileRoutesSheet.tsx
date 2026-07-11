'use client';

import { X, Plus } from 'lucide-react';
import type { RouteSummary } from '@/lib/saved-routes';
import RouteListRows from './RouteListRows';

interface MobileRoutesSheetProps {
  routes: RouteSummary[];
  activeRouteId: string | null;
  onClose: () => void;
  onSelectRoute: (id: string) => void;
  onCreateRoute: () => void;
  onRenameRoute: (id: string, name: string) => void;
  onDuplicateRoute: (id: string) => void;
  onDeleteRoute: (id: string) => void;
}

export default function MobileRoutesSheet({
  routes, activeRouteId, onClose, onSelectRoute, onCreateRoute, onRenameRoute, onDuplicateRoute, onDeleteRoute,
}: MobileRoutesSheetProps) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'rgba(0,0,0,0.35)' }} />
      <div
        style={{
          position: 'fixed', left: 10, right: 10, bottom: 10, maxHeight: '70vh',
          background: 'var(--p1)', border: '1px solid var(--p3)', borderRadius: 16,
          boxShadow: '0 -4px 24px rgba(0,0,0,.35)', zIndex: 45,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 10px', flexShrink: 0, borderBottom: '1px solid var(--fog-ghost)' }}>
          <span style={{ flex: 1, font: '700 11px/1 var(--mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ice)' }}>
            My Routes{routes.length > 0 ? ` · ${routes.length}` : ''}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--fog-dim)', lineHeight: 0 }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <RouteListRows
            routes={routes}
            activeRouteId={activeRouteId}
            onSelect={(id) => { onSelectRoute(id); onClose(); }}
            onRename={onRenameRoute}
            onDuplicate={onDuplicateRoute}
            onDelete={onDeleteRoute}
          />
        </div>

        <button
          onClick={() => { onCreateRoute(); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px', borderTop: '1px solid var(--fog-ghost)', background: 'none',
            color: 'var(--ora)', font: '700 10px/1 var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Plus size={14} />
          New route
        </button>
      </div>
    </>
  );
}
