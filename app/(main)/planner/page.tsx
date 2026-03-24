import type { Metadata } from 'next';
import PlannerClient from './PlannerClient';

export const metadata: Metadata = {
  title: 'Route Planner – Plot',
  description: 'Plan walking and cycling routes on OS / topo maps',
};

export default function PlannerPage() {
  return <PlannerClient />;
}
