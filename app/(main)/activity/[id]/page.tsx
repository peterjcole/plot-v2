import { redirect } from 'next/navigation';

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/?activity=${id}`);
}
