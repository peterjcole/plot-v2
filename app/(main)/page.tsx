import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LeftPanel from '@/app/components/shell/LeftPanel';
import MapArea from '@/app/components/shell/MapArea';

export default async function Home() {
  const session = await getSession();
  const isLoggedIn = !!session.accessToken;

  if (isLoggedIn) {
    const now = Math.floor(Date.now() / 1000);
    const isExpired = session.expiresAt !== undefined && session.expiresAt <= now;
    if (isExpired && session.refreshToken) {
      redirect('/api/auth/refresh?next=/');
    }
  }

  const avatarInitials = session.athlete
    ? `${session.athlete.firstname?.[0] ?? ''}${session.athlete.lastname?.[0] ?? ''}`
    : '?';

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--p0)',
      }}
    >
      <LeftPanel avatarInitials={avatarInitials} />
      <MapArea />
    </div>
  );
}
