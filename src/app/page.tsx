// src/app/page.tsx
'use client';
import React from 'react';
import dynamic from 'next/dynamic';

// Load AppContentClient only on client, preventing any server-side prerender issues
const AppContentClient = dynamic(
  () => import('./AppContentClient'),
  {
    ssr: false,
    loading: () => <div>Loading app...</div>,
  }
);

export default function Page() {
  return <AppContentClient />;
}
