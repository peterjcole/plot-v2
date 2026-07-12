'use client';

import { useState, useCallback, useRef } from 'react';

export const PLANNER_HUD_COLLAPSED = 90;
export const PLANNER_HUD_EXPANDED = 185;

// Movement below this (px) is treated as a tap, not a drag — lets onClick handlers on the
// same element still fire for taps while touchmove-based dragging works for real swipes.
const DRAG_THRESHOLD = 4;

export function usePlannerHud() {
  const [plannerHudHeight, setPlannerHudHeight] = useState(PLANNER_HUD_EXPANDED);
  const [plannerHudDragging, setPlannerHudDragging] = useState(false);
  const plannerHudDragRef = useRef<{ startY: number; startH: number } | null>(null);
  // True once the current touch has moved past DRAG_THRESHOLD — read by onClick handlers
  // on the same draggable element so a drag-release doesn't also register as a tap.
  const plannerHudDidDragRef = useRef(false);

  const handlePlannerHudTouchStart = useCallback((e: React.TouchEvent) => {
    plannerHudDragRef.current = { startY: e.touches[0].clientY, startH: plannerHudHeight };
    plannerHudDidDragRef.current = false;
    setPlannerHudDragging(true);
  }, [plannerHudHeight]);

  const handlePlannerHudTouchMove = useCallback((e: React.TouchEvent) => {
    if (!plannerHudDragRef.current) return;
    const delta = plannerHudDragRef.current.startY - e.touches[0].clientY;
    if (Math.abs(delta) > DRAG_THRESHOLD) plannerHudDidDragRef.current = true;
    const next = Math.max(PLANNER_HUD_COLLAPSED, Math.min(PLANNER_HUD_EXPANDED, plannerHudDragRef.current.startH + delta));
    setPlannerHudHeight(next);
  }, []);

  const handlePlannerHudTouchEnd = useCallback(() => {
    if (!plannerHudDragRef.current) return;
    setPlannerHudDragging(false);
    const mid = (PLANNER_HUD_COLLAPSED + PLANNER_HUD_EXPANDED) / 2;
    setPlannerHudHeight(h => h >= mid ? PLANNER_HUD_EXPANDED : PLANNER_HUD_COLLAPSED);
    plannerHudDragRef.current = null;
  }, []);

  // Wrap a tap handler so it's skipped when the touch that just ended was actually a drag.
  const guardTap = useCallback((handler: () => void) => () => {
    if (plannerHudDidDragRef.current) return;
    handler();
  }, []);

  return {
    plannerHudHeight,
    setPlannerHudHeight,
    plannerHudDragging,
    handlePlannerHudTouchStart,
    handlePlannerHudTouchMove,
    handlePlannerHudTouchEnd,
    guardTap,
  };
}
