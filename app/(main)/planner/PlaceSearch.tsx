'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useGeocodeSearch, type GeocodeSuggestion } from './useGeocodeSearch';

interface PlaceSearchProps {
  onSelect: (coordinates: [number, number]) => void;
  /** If true, render just the 36×36 icon button. Dropdown anchors relative to button. */
  btnStyle?: React.CSSProperties;
}

export default function PlaceSearch({ onSelect, btnStyle }: PlaceSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const { suggestions, isLoading, search, clear } = useGeocodeSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
    clear();
  }, [clear]);

  const handleSelect = useCallback(
    (suggestion: GeocodeSuggestion) => {
      onSelect(suggestion.coordinates);
      close();
    },
    [onSelect, close]
  );

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, close]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setActiveIndex(-1);
    search(value);
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Search icon button */}
      <button
        onClick={() => (open ? close() : setOpen(true))}
        title="Search places"
        aria-label="Search places"
        style={{
          width: 36, height: 36, borderRadius: 6,
          background: open ? 'var(--ora)' : 'var(--glass)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: open ? 'none' : '1px solid var(--p3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: open ? 'var(--p0)' : 'var(--fog)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          padding: 0,
          ...btnStyle,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
      </button>

      {/* Dropdown panel — floats to the left of the button */}
      {open && (
        <div style={{
          position: 'absolute', bottom: 0, right: 44, zIndex: 50,
          width: 260,
          background: 'var(--glass-hvy)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--p3)',
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}>
          {/* Input row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fog-dim)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              placeholder="Search for a place…"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ice)',
                letterSpacing: '0.02em',
              }}
            />
            {isLoading && (
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                border: '2px solid var(--fog-ghost)', borderTopColor: 'var(--ora)',
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }} />
            )}
          </div>

          {/* Results */}
          {suggestions.length > 0 && (
            <ul style={{
              margin: 0, padding: '2px 0', listStyle: 'none',
              borderTop: '1px solid var(--p3)',
              maxHeight: 200, overflowY: 'auto',
            }}>
              {suggestions.map((s, i) => (
                <li key={`${s.name}-${s.coordinates[0]}-${s.coordinates[1]}`}>
                  <button
                    onClick={() => handleSelect(s)}
                    onMouseEnter={() => setActiveIndex(i)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '6px 10px', border: 'none', cursor: 'pointer',
                      background: i === activeIndex ? 'var(--p3)' : 'transparent',
                      fontFamily: 'var(--mono)', color: 'var(--fog)',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ice)' }}>{s.name}</span>
                    {s.region && (
                      <span style={{ fontSize: 10, color: 'var(--fog-dim)', marginLeft: 6 }}>{s.region}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {query.length >= 2 && !isLoading && suggestions.length === 0 && (
            <div style={{
              padding: '8px 10px', fontSize: 10, fontFamily: 'var(--mono)',
              color: 'var(--fog-dim)', textAlign: 'center',
              borderTop: '1px solid var(--p3)',
            }}>
              No results found
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
