'use client';
import React from 'react';
import ClientProviders from '@/components/ClientProviders';
import { ThreadProvider } from '@/providers/Thread';
import { StreamProvider } from '@/providers/Stream';
import { ArtifactProvider } from '@/components/thread/artifact';

export default function AppContentClient() {
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
