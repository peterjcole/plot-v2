'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useGeocodeSearch, type GeocodeSuggestion } from './useGeocodeSearch';

interface PlaceSearchProps {
  onSelect: (coordinates: [number, number]) => void;
}

export default function PlaceSearch({ onSelect }: PlaceSearchProps) {
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

  // Focus input when opened
  useEffect(() => {
    if (open) {
      // Small delay to ensure the panel is rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, close]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, close]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
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
    <>
      {/* Search icon button — bottom-right, above geolocate */}
      <button
        onClick={() => (open ? close() : setOpen(true))}
        title="Search places"
        className={`absolute bottom-[72px] right-3 z-10 flex items-center justify-center w-11 h-11 rounded-lg backdrop-blur-sm shadow-lg border transition-colors ${
          open
            ? 'bg-accent text-white border-accent'
            : 'bg-surface-raised/95 border-border text-text-primary hover:bg-surface-muted'
        }`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      {/* Search panel — to the left of the search icon */}
      {open && (
        <div
          ref={panelRef}
          className="absolute bottom-[74px] right-[65px] z-20 w-64 sm:w-72"
        >
          <div className="bg-surface-raised/95 backdrop-blur-sm rounded-lg shadow-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-text-secondary shrink-0"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                placeholder="Search for a place..."
                className="flex-1 bg-transparent text-base font-medium text-text-primary placeholder:text-text-secondary/50 outline-none"
              />
              {isLoading && (
                <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
              )}
            </div>

            {suggestions.length > 0 && (
              <ul className="py-0.5 max-h-52 overflow-y-auto border-t border-border">
                {suggestions.map((s, i) => (
                  <li key={`${s.name}-${s.coordinates[0]}-${s.coordinates[1]}`}>
                    <button
                      onClick={() => handleSelect(s)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        i === activeIndex
                          ? 'bg-accent/10 text-text-primary'
                          : 'text-text-primary hover:bg-surface-muted'
                      }`}
                    >
                      <span className="font-medium">{s.name}</span>
                      {s.region && (
                        <span className="text-text-secondary ml-1.5">
                          {s.region}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {query.length >= 2 && !isLoading && suggestions.length === 0 && (
              <div className="px-3 py-2 text-xs font-medium text-text-secondary text-center border-t border-border">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
