// src/providers/Stream.tsx - Key changes for namer integration
"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  isUIMessage,
  isRemoveUIMessage,
  type UIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { getApiKey } from "@/lib/api-key";
import { ensureToolCallsHaveResponses } from "@/lib/ensure-tool-responses";
import MessageFilterService from "@/lib/message-filter";
import { MessageFilter, ThreadTitleConfig } from "@/types/message-filter";
import { useThreads } from "./Thread";
// 🎯 Import the fixed LangGraph namer
import { generateThreadNameSmart } from "@/lib/namer";

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
  sendFilteredMessage: (
    content: string | Message["content"],
    options?: { context?: Record<string, unknown> }
  ) => Promise<void>;
};

const StreamContext = createContext<StreamContextType | undefined>(undefined);

async function sleep(ms = 4000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkGraphStatus(apiUrl: string, apiKey: string | null): Promise<boolean> {
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

/** -------------------- NORMALIZE HELPERS -------------------- */
function normalizeBlock(blk: any): any {
  if (!blk || typeof blk !== "object") return blk;
  if (blk.type === "text") return blk;

  if (blk.type === "image" || blk.type === "file") {
    const origMime = blk.mime_type ?? blk.mimeType;
    const origSrc = blk.source_type ?? blk.source;

    let mime = origMime;
    let source = origSrc ?? "base64";

    if (!mime) {
      const name: string = blk?.metadata?.filename ?? blk?.metadata?.name ?? "";
      if (blk.type === "file") {
        mime = name.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "application/octet-stream";
      } else if (blk.type === "image") {
        mime = "image/png";
      }
    }

    return {
      ...blk,
      mime_type: mime,
      mimeType: mime,
      source_type: source,
      source: source,
    };
  }

  return blk;
}

function normalizeContent(content: string | Message["content"]): string | Message["content"] {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content;
  return content.map((b: any) => normalizeBlock(b));
}

/** -------------------- CONTENT EXTRACTION HELPERS -------------------- */
type TextBlock = { type: "text"; text: string };
function isTextBlock(block: unknown): block is TextBlock {
  return (
    !!block &&
    typeof block === "object" &&
    (block as any).type === "text" &&
    typeof (block as any).text === "string"
  );
}

function contentToText(c: Message["content"]): string {
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) {
    const t = c.find(isTextBlock);
    if (t) return t.text.trim();
  }
  return "";
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
  const { getThreads, setThreads, updateThreadTitle } = useThreads();

  const [messageFilter] = useState(() => new MessageFilterService());

  const streamValue = useStream<StreamState>({
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
      // refresh sidebar sau một nhịp ngắn
      sleep().then(() => getThreads().then(setThreads)).catch(console.error);
    },
  });

  // 🎯 Configuration cho LangGraph namer
  const NAMER_ASSISTANT_ID = 
    process.env.NEXT_PUBLIC_NAMER_ASSISTANT_ID || 
    "namer"; // 🚨 CHANGED: Default to "namer" instead of "agent"

  const DEBUG_NAMER = process.env.NEXT_PUBLIC_DEBUG_NAMER === "1";

  // 🔄 Smart naming function - LangGraph first, fallback to local
  const generateSmartThreadName = useCallback(
    async (messages: Message[]): Promise<string> => {
      if (!messages.length) return messageFilter.generateThreadTitle(messages);

      const firstHuman = messages.find((m) => m?.type === "human");
      if (!firstHuman) return messageFilter.generateThreadTitle(messages);

      const initialText = contentToText(firstHuman.content);
      if (!initialText.trim()) return messageFilter.generateThreadTitle(messages);

      // 🎯 Thử LangGraph namer trước với improved integration
      if (messageFilter.titleConfig?.useAI !== false) {
        try {
          if (DEBUG_NAMER) {
            console.info("[SmartNaming] Attempting LangGraph with:", {
              apiUrl,
              assistantId: NAMER_ASSISTANT_ID,
              messagePreview: initialText.substring(0, 50) + "..."
            });
          }

          const aiTitle = await generateThreadNameSmart(
            {
              apiUrl,
              apiKey,
              assistantId: NAMER_ASSISTANT_ID,
            },
            initialText
          );
          
          if (aiTitle && aiTitle.trim()) {
            if (DEBUG_NAMER) {
              console.info("[SmartNaming] LangGraph success:", aiTitle);
            }
            return aiTitle;
          } else {
            if (DEBUG_NAMER) {
              console.warn("[SmartNaming] LangGraph returned empty result");
            }
          }
        } catch (error) {
          console.warn("[SmartNaming] LangGraph failed, fallback to local:", error);
        }
      } else {
        if (DEBUG_NAMER) {
          console.info("[SmartNaming] AI naming disabled, using local");
        }
      }

      // 🔧 Fallback to local hard-coded rules
      const localTitle = messageFilter.generateThreadTitle(messages);
      if (DEBUG_NAMER) {
        console.info("[SmartNaming] Using local fallback:", localTitle);
      }
      return localTitle;
    },
    [apiUrl, apiKey, NAMER_ASSISTANT_ID, messageFilter, DEBUG_NAMER]
  );

  /*** 1) Đặt tiêu đề khi AgentFinish với smart naming ***/
  useEffect(() => {
    const data = (streamValue as any).data || streamValue;
    const outcome = data?.agent_outcome;
    if (outcome?.type === "AgentFinish" && threadId) {
      const msgs = data?.messages ?? [];
      if (Array.isArray(msgs) && msgs.length > 0) {
        if (DEBUG_NAMER) {
          console.info("[AgentFinish] Triggering smart naming for thread:", threadId);
        }

        generateSmartThreadName(msgs).then((smartTitle) => {
          // cập nhật UI
          setThreads((prev: any) =>
            prev.map((t: any) =>
              t.thread_id === threadId
                ? { ...t, metadata: { ...t.metadata, title: smartTitle } }
                : t
            )
          );

          // persist
          updateThreadTitle(threadId, smartTitle).catch(console.error);
        }).catch((error) => {
          console.error("[AgentFinish] Smart naming failed:", error);
          // Fallback to basic local naming
          const fallbackTitle = messageFilter.generateThreadTitle(msgs);
          setThreads((prev: any) =>
            prev.map((t: any) =>
              t.thread_id === threadId
                ? { ...t, metadata: { ...t.metadata, title: fallbackTitle } }
                : t
            )
          );
          updateThreadTitle(threadId, fallbackTitle).catch(console.error);
        });
      }
    }
  }, [
    (streamValue as any).data?.agent_outcome || (streamValue as any).agent_outcome,
    threadId,
    generateSmartThreadName,
    messageFilter,
    setThreads,
    updateThreadTitle,
    DEBUG_NAMER,
  ]);

  // ... [REST OF THE CODE REMAINS THE SAME - sendFilteredMessage, effects, etc.]
  
  /*** 2) Gửi tin nhắn có filter + normalize ***/
  const sendFilteredMessage = useCallback(
    async (
      content: string | Message["content"],
      options?: { context?: Record<string, unknown> }
    ): Promise<void> => {
      try {
        const filtered =
          typeof content === "string"
            ? messageFilter.filterMessage(content)
            : { content, metadata: { filtered: false } };

        let outgoingContent = (filtered as any).content as string | any[];
        if (Array.isArray(outgoingContent)) {
          const hasText = outgoingContent.some((b) => b && b.type === "text");
          if (!hasText) {
            outgoingContent = [{ type: "text", text: "" }, ...outgoingContent];
          }
        }
        outgoingContent = normalizeContent(outgoingContent) as any;

        const submit = (streamValue as any).submit as
          | ((
              input: { messages: Message[]; context?: Record<string, unknown> } | undefined,
              opts?: any
            ) => Promise<void>)
          | undefined;

        if (!submit) {
          toast.error("Chat is not ready. Please try again in a moment.");
          return;
        }

        const currentMessages: Message[] =
          ((streamValue as any).messages as Message[]) ??
          ((streamValue as any).data?.messages as Message[]) ?? [];

        const toolMsgs = ensureToolCallsHaveResponses(currentMessages);
        const toolMessagesArray = Array.isArray(toolMsgs) ? toolMsgs : [];

        const newHuman: Message = {
          id: (globalThis as any).crypto?.randomUUID?.() ?? Math.random().toString(36),
          type: "human",
          content: outgoingContent as any,
        };

        await submit(
          { messages: [...toolMessagesArray, newHuman], context: options?.context },
          {
            streamMode: ["values"],
            optimisticValues: (prev: any) => {
              const prevMessages = Array.isArray(prev.messages) ? prev.messages : [];
              return {
                ...prev,
                context: options?.context,
                messages: [...prevMessages, ...toolMessagesArray, newHuman],
              };
            },
          }
        );
      } catch (err) {
        console.error("[sendFilteredMessage] Failed:", err);
        toast.error("Failed to send message. Check console for details.");
      }
    },
    [streamValue, messageFilter]
  );

  /*** 3) Auto-title nhẹ khi agent CHƯA finish với smart naming ***/
  useEffect(() => {
    if (!threadId) return;
    const msgs = (streamValue as any).messages || (streamValue as any).data?.messages;
    if (!Array.isArray(msgs) || msgs.length === 0) return;

    const data = (streamValue as any).data || streamValue;
    const agentFinished = data?.agent_outcome?.type === "AgentFinish";
    if (agentFinished) return;

    const shouldUpdateTitle = msgs.length <= 2 || msgs.length % 5 === 0;
    if (!shouldUpdateTitle) return;

    // 🎯 Sử dụng smart naming cho progressive updates
    generateSmartThreadName(msgs).then((smartTitle) => {
      setThreads((prev: any) =>
        prev.map((t: any) =>
          t.thread_id === threadId
            ? { ...t, metadata: { ...t.metadata, title: smartTitle } }
            : t
        )
      );

      const timeout = setTimeout(async () => {
        try {
          await updateThreadTitle(threadId, smartTitle);
        } catch (e) {
          console.error("Failed to persist thread title", e);
          // Fallback title on persist error
          const fallbackTitle = messageFilter.generateThreadTitle(msgs);
          setThreads((prev: any) =>
            prev.map((t: any) =>
              t.thread_id === threadId
                ? { ...t, metadata: { ...t.metadata, title: fallbackTitle } }
                : t
            )
          );
        }
      }, 1000);

      return () => clearTimeout(timeout);
    }).catch((error) => {
      console.error("Smart naming failed in progressive update:", error);
      // Use local fallback immediately
      const fallbackTitle = messageFilter.generateThreadTitle(msgs);
      setThreads((prev: any) =>
        prev.map((t: any) =>
          t.thread_id === threadId
            ? { ...t, metadata: { ...t.metadata, title: fallbackTitle } }
            : t
        )
      );
    });
  }, [
    (streamValue as any).messages?.length || (streamValue as any).data?.messages?.length,
    (streamValue as any).data?.agent_outcome?.type || (streamValue as any).agent_outcome?.type,
    threadId,
    setThreads,
    generateSmartThreadName,
    messageFilter,
    updateThreadTitle,
  ]);

  /*** 4) Health check ***/
  useEffect(() => {
    checkGraphStatus(apiUrl, apiKey).then((ok) => {
      if (!ok) {
        toast.error("Failed to connect to LangGraph server", {
          description: () => (
            <p>
              Please ensure your graph is running at <code>{apiUrl}</code> and your API key is correctly set.
            </p>
          ),
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, [apiKey, apiUrl]);

  /*** 5) 🎯 Initial thread naming với LangGraph - chỉ chạy 1 lần per thread ***/
  const hasNamedRef = useRef(false);

  // Reset flag mỗi khi đổi thread
  useEffect(() => {
    hasNamedRef.current = false;
  }, [threadId]);

  useEffect(() => {
    if (!threadId || hasNamedRef.current) return;

    const msgs: Message[] =
      ((streamValue as any).messages as Message[]) ??
      ((streamValue as any).data?.messages as Message[]) ?? [];

    if (!Array.isArray(msgs) || msgs.length === 0) return;

    const firstHuman = msgs.find((m) => m?.type === "human");
    if (!firstHuman) return;

    hasNamedRef.current = true;

    if (DEBUG_NAMER) {
      console.info("[InitialNaming] Starting for thread:", threadId, "messages:", msgs.length);
    }

    // 🚀 Sử dụng LangGraph smart naming cho initial thread
    generateSmartThreadName(msgs).then((smartTitle) => {
      if (DEBUG_NAMER) {
        console.info("[InitialNaming] Generated title:", smartTitle);
      }

      // Update UI
      setThreads((prev: any) =>
        prev.map((t: any) =>
          t.thread_id === threadId
            ? { ...t, metadata: { ...t.metadata, title: smartTitle } }
            : t
        )
      );

      // Persist to backend
      updateThreadTitle(threadId, smartTitle).catch((error) => {
        console.error("[InitialNaming] Persist failed:", error);
      });
    }).catch((error) => {
      console.error("[InitialNaming] Smart naming failed:", error);
      
      // Fallback to local naming
      const fallbackTitle = messageFilter.generateThreadTitle(msgs);
      setThreads((prev: any) =>
        prev.map((t: any) =>
          t.thread_id === threadId
            ? { ...t, metadata: { ...t.metadata, title: fallbackTitle } }
            : t
        )
      );
      updateThreadTitle(threadId, fallbackTitle).catch(console.error);
    });
  }, [
    threadId,
    (streamValue as any).messages?.length || (streamValue as any).data?.messages?.length,
    setThreads,
    updateThreadTitle,
    generateSmartThreadName,
    DEBUG_NAMER,
  ]);

  /*** 6) 🔄 Title regeneration on first message edit ***/
  useEffect(() => {
    if (!threadId) return;

    const data = (streamValue as any).data || streamValue;
    const shouldRegenerate = data?._shouldRegenerateTitle;
    const editedContent = data?._editedFirstMessage;

    if (shouldRegenerate && editedContent) {
      if (DEBUG_NAMER) {
        console.info("[TitleRegeneration] Triggered by message edit:", editedContent);
      }

      const msgs: Message[] =
        ((streamValue as any).messages as Message[]) ??
        ((streamValue as any).data?.messages as Message[]) ?? [];

      if (msgs.length > 0) {
        generateSmartThreadName(msgs).then((newTitle) => {
          if (DEBUG_NAMER) {
            console.info("[TitleRegeneration] New title:", newTitle);
          }

          // Update UI
          setThreads((prev: any) =>
            prev.map((t: any) =>
              t.thread_id === threadId
                ? { ...t, metadata: { ...t.metadata, title: newTitle } }
                : t
            )
          );

          // Persist to backend
          updateThreadTitle(threadId, newTitle).catch((error) => {
            console.error("[TitleRegeneration] Persist failed:", error);
          });
        }).catch((error) => {
          console.error("[TitleRegeneration] Smart naming failed:", error);
        });
      }
    }
  }, [
    (streamValue as any).data?._shouldRegenerateTitle,
    (streamValue as any).data?._editedFirstMessage,
    threadId,
    generateSmartThreadName,
    setThreads,
    updateThreadTitle,
    DEBUG_NAMER,
  ]);

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
        // 🎯 Sync AI usage config
        if ('useAI' in cfg) {
          console.info('[TitleConfig] AI naming:', cfg.useAI ? 'enabled' : 'disabled');
        }
      },
    }),
    [streamValue, messageFilter, sendFilteredMessage]
  );

  return <StreamContext.Provider value={contextValue}>{children}</StreamContext.Provider>;
};

const DEFAULT_API_URL = "https://agent.grozone.vn";
const DEFAULT_ASSISTANT_ID = "agent";

export const StreamProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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