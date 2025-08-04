// src/providers/Thread.ts
"use client";

import { validate } from "uuid";
import { getApiKey } from "@/lib/api-key";
import { Thread } from "@langchain/langgraph-sdk";
import { useQueryState } from "nuqs";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { createClient } from '@/providers/client';

interface ThreadContextType {
  getThreads: (metadataFilter?: Record<string, unknown>) => Promise<Thread[]>;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

function getThreadSearchMetadata(
  assistantId: string
): { graph_id: string } | { assistant_id: string } {
  return validate(assistantId) 
    ? { assistant_id: assistantId } 
    : { graph_id: assistantId };
}

export function ThreadProvider({ children }: { children: ReactNode }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://agent.grozone.vn";
  const assistantId = process.env.NEXT_PUBLIC_ASSISTANT_ID || "agent";
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const getThreads = useCallback(async (
    metadataFilter: Record<string, unknown> = {}
  ): Promise<Thread[]> => {
    setThreadsLoading(true);
    try {
      if (!apiUrl || !assistantId) return [];
      const client = createClient(apiUrl, getApiKey() ?? undefined);
      const threads = await client.threads.search({
        metadata: {
          ...getThreadSearchMetadata(assistantId),
          ...metadataFilter,
        },
        limit: 100,
      });
      return threads;
    } finally {
      setThreadsLoading(false);
    }
  }, [apiUrl, assistantId]);

  const updateThreadTitle = useCallback(
    async (id: string, title: string) => {
      const client = createClient(apiUrl, getApiKey() ?? undefined);
      await client.threads.update(id, { metadata: { title } });
      setThreads(prev =>
        prev.map(t =>
          t.thread_id === id
            ? { ...t, metadata: { ...t.metadata, title } }
            : t
        )
      );
    },
    [apiUrl]
  );

  const value = {
     getThreads,
     threads,
     setThreads,
     threadsLoading,
     setThreadsLoading,
    updateThreadTitle,  // expose helper mới
   };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

export function useThreads() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
}