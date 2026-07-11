const ACTIVE_ROUTE_KEY = 'plotv2-active-route-id';

// Which saved route (premium) was last open — just a pointer so reload reopens the same
// route. This is fine to keep local even under the free-tier zero-backend-footprint rule:
// it names a route, it isn't route content.
export function getActiveRouteId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ROUTE_KEY);
  } catch {
    return null;
  }
}

export function setActiveRouteId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_ROUTE_KEY, id);
    else localStorage.removeItem(ACTIVE_ROUTE_KEY);
  } catch {
    // ignore
  }
}
