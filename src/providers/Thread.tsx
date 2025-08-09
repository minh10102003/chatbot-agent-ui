// src/providers/Thread.ts
"use client";

import { validate } from "uuid";
import { getApiKey } from "@/lib/api-key";
import { Thread as ThreadType } from "@langchain/langgraph-sdk";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  useEffect,
  Dispatch,
  SetStateAction,
} from "react";
import { createClient } from "@/providers/client";

interface ThreadContextType {
  getThreads: (metadataFilter?: Record<string, unknown>) => Promise<ThreadType[]>;
  threads: ThreadType[];
  setThreads: Dispatch<SetStateAction<ThreadType[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
  updateThreadTitle: (id: string, title: string) => Promise<void>;
  /** Chuẩn hóa hiển thị title cho UI, chỉ dựa trên metadata.title */
  threadDisplayTitle: (t: ThreadType) => string;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

function getThreadSearchMetadata(
  assistantId: string
): { graph_id: string } | { assistant_id: string } {
  return validate(assistantId) ? { assistant_id: assistantId } : { graph_id: assistantId };
}

/** Fallback title: chỉ dùng metadata.title */
function threadDisplayTitle(t: ThreadType): string {
  const title = (t.metadata as any)?.title;
  return typeof title === "string" && title.trim() ? title.trim() : "Untitled chat";
}

/** Ép thread luôn có metadata.title để UI đồng bộ */
function coerceTitle(t: ThreadType): ThreadType {
  const title = threadDisplayTitle(t);
  return {
    ...t,
    metadata: { ...(t.metadata ?? {}), title },
  } as ThreadType;
}

export function ThreadProvider({ children }: { children: ReactNode }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://agent.grozone.vn";
  const assistantId = process.env.NEXT_PUBLIC_ASSISTANT_ID || "agent";

  const [threads, setThreads] = useState<ThreadType[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const getThreads = useCallback(
    async (metadataFilter: Record<string, unknown> = {}): Promise<ThreadType[]> => {
      setThreadsLoading(true);
      try {
        if (!apiUrl || !assistantId) return [];
        const client = createClient(apiUrl, getApiKey() ?? undefined);
        const results = await client.threads.search({
          metadata: {
            ...(validate(assistantId) ? { assistant_id: assistantId } : { graph_id: assistantId }),
            ...metadataFilter,
          },
          limit: 100,
        });
        // đảm bảo luôn có metadata.title
        return results.map(coerceTitle);
      } finally {
        setThreadsLoading(false);
      }
    },
    [apiUrl, assistantId]
  );

  useEffect(() => {
    getThreads()
      .then((list) => setThreads(list))
      .catch((err) => console.error("[ThreadProvider] getThreads failed:", err));
  }, [getThreads]);

  const updateThreadTitle = useCallback(
    async (id: string, title: string) => {
      const client = createClient(apiUrl, getApiKey() ?? undefined);
      await client.threads.update(id, { metadata: { title } });
      setThreads((prev) =>
        prev.map((t) =>
          t.thread_id === id ? { ...t, metadata: { ...(t.metadata ?? {}), title } } : t
        )
      );
    },
    [apiUrl]
  );

  const value: ThreadContextType = {
    getThreads,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
    updateThreadTitle,
    threadDisplayTitle,
  };

  return <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>;
}

export function useThreads() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
}
