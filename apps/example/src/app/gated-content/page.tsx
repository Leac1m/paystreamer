'use client';

import dynamic from 'next/dynamic';

const GatedContentDemo = dynamic(() => import('./GatedContentDemo'), {
  ssr: false,
});

export default function Page() {
  return <GatedContentDemo />;
}
