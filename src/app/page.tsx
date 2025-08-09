// src/app/page.tsx
'use client';
import React from 'react';
import dynamic from 'next/dynamic';

const AppContentClient = dynamic(
  () => import('./AppContentClient'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-lg">Loading app...</div>
      </div>
    ),
  }
);

export default function Page() {
  return <AppContentClient />;
}