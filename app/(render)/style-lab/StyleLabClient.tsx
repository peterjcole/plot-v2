'use client';

import dynamic from 'next/dynamic';

const StyleLabMap = dynamic(() => import('./StyleLabMap'), { ssr: false });

export default function StyleLabClient() {
  return <StyleLabMap />;
}
