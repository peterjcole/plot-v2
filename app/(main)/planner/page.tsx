import { redirect } from 'next/navigation';

export default function PlannerPage() {
  redirect('/?mode=planner');
}
