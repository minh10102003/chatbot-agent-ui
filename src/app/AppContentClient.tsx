// src/app/AppContentClient.tsx
'use client';
import React, { Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Thread } from '@/components/thread';
import { ThreadProvider } from '@/providers/Thread';
import { StreamProvider } from '@/providers/Stream';
import { ArtifactProvider } from '@/components/thread/artifact';

export default function AppContentClient() {
  return (
    <Suspense fallback={<div>Loading app…</div>}>
      <Toaster />
      <ThreadProvider>
        <StreamProvider>
          <ArtifactProvider>
            {/* Thread bao gồm cả phần message list và input box */}
            <Thread />
          </ArtifactProvider>
        </StreamProvider>
      </ThreadProvider>
    </Suspense>
  );
}
