'use client';

import React, { Suspense } from 'react';
import ClientProviders from '@/components/ClientProviders';
import { ThreadProvider } from '@/providers/Thread';
import { StreamProvider } from '@/providers/Stream';
import { ArtifactProvider } from '@/components/thread/artifact';

// Component chứa tất cả providers và logic chính
function AppContent() {
  return (
    <ClientProviders>
      <ThreadProvider>
        <StreamProvider>
          <ArtifactProvider>
            {/* UI chính của app ở đây */}
          </ArtifactProvider>
        </StreamProvider>
      </ThreadProvider>
    </ClientProviders>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading app...</div>}>
      <AppContent />
    </Suspense>
  );
}