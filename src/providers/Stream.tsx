// src/providers/Stream.tsx
"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  isUIMessage,
  isRemoveUIMessage,
  type UIMessage,
  type RemoveUIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { getApiKey } from "@/lib/api-key";
import { createClient } from "@/providers/client";
import { useThreads } from "./Thread";
import MessageFilterService from "@/lib/message-filter";
import { MessageFilter, ThreadTitleConfig } from "@/types/message-filter";

// --- New types for extended stream state ---
export interface AgentOutcome {
  return_values: { output: string };
  log: string;
  type: string;
}

export interface StreamState extends Record<string, unknown> {
  messages: Message[];
  ui?: UIMessage[];
  agent_outcome?: AgentOutcome;
  intermediate_steps?: unknown[];
}

type StreamContextType = ReturnType<typeof useStream> & {
  messageFilter: MessageFilterService;
  updateFilterConfig: (filter: Partial<MessageFilter>) => void;
  updateTitleConfig: (config: Partial<ThreadTitleConfig>) => void;
  sendFilteredMessage: (content: string) => Promise<void>;
};

const StreamContext = createContext<StreamContextType | undefined>(undefined);

async function sleep(ms = 4000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkGraphStatus(
  apiUrl: string,
  apiKey: string | null
): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/info`, {
      ...(apiKey && { headers: { "X-Api-Key": apiKey } }),
    });
    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

const StreamSession = ({
  children,
  apiKey,
  apiUrl,
  assistantId,
}: {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
}) => {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { threads, getThreads, setThreads } = useThreads();

  // Initialize message filter service
  const [messageFilter] = useState(() => new MessageFilterService());

  const streamValue = useStream({
    apiUrl,
    apiKey: apiKey ?? undefined,
    assistantId,
    threadId: threadId ?? null,

    onCustomEvent: (event: any, options: any) => {
      if (isUIMessage(event) || isRemoveUIMessage(event)) {
        options.mutate((prev: any) => ({
          ...prev,
          ui: uiMessageReducer(prev.ui ?? [], event),
        }));
      }
    },
    onThreadId: (id: string) => {
      setThreadId(id);
      sleep().then(() => getThreads().then(setThreads)).catch(console.error);
    },
  });

  // --- Generate thread title when agent finishes ---
  useEffect(() => {
    // Access data through streamValue.data or streamValue directly depending on the API
    const data = (streamValue as any).data || streamValue;
    const outcome = data?.agent_outcome;
    
    if (outcome?.type === "AgentFinish" && threadId) {
      const msgs = data?.messages ?? [];
      if (Array.isArray(msgs) && msgs.length > 0) {
        const newTitle = messageFilter.generateThreadTitle(msgs);
        // Update local list immediately
        setThreads((prev: any) =>
          prev.map((t: any) =>
            t.thread_id === threadId
              ? { ...t, metadata: { ...t.metadata, title: newTitle } }
              : t
          )
        );
        // Persist to server
        createClient(apiUrl, getApiKey() ?? undefined)
          .threads.update(threadId, { metadata: { title: newTitle } })
          .catch(console.error);
      }
    }
  }, [(streamValue as any).data?.agent_outcome || (streamValue as any).agent_outcome, threadId, messageFilter, apiUrl, setThreads]);

  // Simplified send function
  const sendFilteredMessage = useCallback(
    async (content: string): Promise<void> => {
      try {
        const filtered = messageFilter.filterMessage(content);
        if (filtered.metadata.filtered) {
          console.log("Message filtered before sending:", {
            originalLength: filtered.metadata.originalLength,
            newLength: filtered.content.length,
            reasons: filtered.metadata.filterReasons,
          });
        }
        
        const methods = Object.keys(streamValue);
        console.log("Available stream methods:", methods);
        const possibleMethods = ["input", "send", "sendMessage", "message"];
        
        for (const methodName of possibleMethods) {
          if (methodName in streamValue) {
            const fn = (streamValue as any)[methodName];
            if (typeof fn === "function") {
              console.log(`Using method: ${methodName}`);
              await fn(filtered.content);
              return;
            }
          }
        }
        throw new Error("No suitable stream method found");
      } catch (err) {
        console.error("Failed to send filtered message:", err);
        toast.error(
          "Failed to send message. Check console for available methods."
        );
        throw err;
      }
    },
    [streamValue, messageFilter]
  );

  // Auto-generate thread title (fallback logic)
  useEffect(() => {
    if (!threadId) return;
    
    // Access messages through different possible paths
    const msgs = (streamValue as any).messages || (streamValue as any).data?.messages;
    if (!Array.isArray(msgs) || msgs.length === 0) return;
    
    // Only update title if agent hasn't finished yet
    const data = (streamValue as any).data || streamValue;
    const agentFinished = data?.agent_outcome?.type === "AgentFinish";
    if (agentFinished) return;
    
    const shouldUpdateTitle = msgs.length <= 2 || msgs.length % 5 === 0;
    if (!shouldUpdateTitle) return;
    
    const newTitle = messageFilter.generateThreadTitle(msgs);
    setThreads((prev: any) =>
      prev.map((t: any) =>
        t.thread_id === threadId
          ? { ...t, metadata: { ...t.metadata, title: newTitle } }
          : t
      )
    );
    
    const timeout = setTimeout(async () => {
      try {
        const client = createClient(apiUrl, getApiKey() ?? undefined);
        await client.threads.update(threadId, { metadata: { title: newTitle } });
      } catch (e) {
        console.error("Failed to persist thread title", e);
        setThreads((prev: any) =>
          prev.map((t: any) =>
            t.thread_id === threadId
              ? {
                  ...t,
                  metadata: {
                    ...t.metadata,
                    title: `Chat ${new Date().toLocaleTimeString()}`,
                  },
                }
              : t
          )
        );
      }
    }, 1000);
    
    return () => clearTimeout(timeout);
  }, [
    (streamValue as any).messages?.length || (streamValue as any).data?.messages?.length,
    (streamValue as any).data?.agent_outcome?.type || (streamValue as any).agent_outcome?.type,
    threadId,
    apiUrl,
    setThreads,
    messageFilter
  ]);

  // Health check for Graph server
  useEffect(() => {
    checkGraphStatus(apiUrl, apiKey).then((ok) => {
      if (!ok) {
        toast.error("Failed to connect to LangGraph server", {
          description: () => (
            <p>
              Please ensure your graph is running at <code>{apiUrl}</code> and
              your API key is correctly set.
            </p>
          ),
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, [apiKey, apiUrl]);

  // Compose context value
  const contextValue = useMemo(
    () => ({
      ...streamValue,
      messageFilter,
      sendFilteredMessage,
      updateFilterConfig: (cfg: Partial<MessageFilter>) => {
        messageFilter.updateFilter(cfg);
      },
      updateTitleConfig: (cfg: Partial<ThreadTitleConfig>) => {
        messageFilter.updateTitleConfig(cfg);
      },
    }),
    [streamValue, messageFilter, sendFilteredMessage]
  );

  return (
    <StreamContext.Provider value={contextValue}>
      {children}
    </StreamContext.Provider>
  );
};

const DEFAULT_API_URL = "https://agent.grozone.vn";
const DEFAULT_ASSISTANT_ID = "agent";

export const StreamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const apiKey = getApiKey() || null;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  const assistantId = process.env.NEXT_PUBLIC_ASSISTANT_ID || DEFAULT_ASSISTANT_ID;

  return (
    <StreamSession apiKey={apiKey} apiUrl={apiUrl} assistantId={assistantId}>
      {children}
    </StreamSession>
  );
};

export const useStreamContext = (): StreamContextType => {
  const ctx = useContext(StreamContext);
  if (!ctx) throw new Error("useStreamContext must be used within StreamProvider");
  return ctx;
};

export default StreamContext;