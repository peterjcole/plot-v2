import { redirect } from 'next/navigation';

// /planner is a thin alias for /?mode=planner (MapShell renders everything). Preserve
// ?route=<id> through the redirect so a shared/reloaded /planner?route=<id> link still
// resolves to the right saved route.
export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ route?: string }> }) {
  const { route } = await searchParams;
  redirect(route ? `/?mode=planner&route=${encodeURIComponent(route)}` : '/?mode=planner');
}
