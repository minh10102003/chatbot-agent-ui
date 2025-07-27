import React, { Suspense } from "react";
import ClientProviders from "@/components/ClientProviders";
import { ThreadProvider } from "@/providers/Thread";
import { StreamProvider } from "@/providers/Stream";
import { ArtifactProvider } from "@/components/thread/artifact";
import ThreadView from "./ThreadView";

export default function DemoPage() {
  return (
    <Suspense fallback={<div>Loading (layout)...</div>}>
      {/* Toaster giờ nằm trong ClientProviders */}
      <ClientProviders>
        <ThreadProvider>
          <StreamProvider>
            <ArtifactProvider>
              <ThreadView />
            </ArtifactProvider>
          </StreamProvider>
        </ThreadProvider>
      </ClientProviders>
    </Suspense>
  );
}