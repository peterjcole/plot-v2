'use client';

import { useState, useCallback, useRef } from 'react';

export const PLANNER_HUD_COLLAPSED = 38;
export const PLANNER_HUD_EXPANDED = 158;

export function usePlannerHud() {
  const [plannerHudHeight, setPlannerHudHeight] = useState(PLANNER_HUD_EXPANDED);
  const [plannerHudDragging, setPlannerHudDragging] = useState(false);
  const plannerHudDragRef = useRef<{ startY: number; startH: number } | null>(null);

  const handlePlannerHudTouchStart = useCallback((e: React.TouchEvent) => {
    plannerHudDragRef.current = { startY: e.touches[0].clientY, startH: plannerHudHeight };
    setPlannerHudDragging(true);
  }, [plannerHudHeight]);

  const handlePlannerHudTouchMove = useCallback((e: React.TouchEvent) => {
    if (!plannerHudDragRef.current) return;
    const delta = plannerHudDragRef.current.startY - e.touches[0].clientY;
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

  return {
    plannerHudHeight,
    setPlannerHudHeight,
    plannerHudDragging,
    handlePlannerHudTouchStart,
    handlePlannerHudTouchMove,
    handlePlannerHudTouchEnd,
  };
}
