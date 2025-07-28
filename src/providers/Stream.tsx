// lib/providers/Stream.ts
"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message, type Thread } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  isUIMessage,
  isRemoveUIMessage,
  type UIMessage,
  type RemoveUIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LangGraphLogoSVG } from "@/components/icons/langgraph";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { getApiKey } from "@/lib/api-key";
import { createClient } from "@/providers/client";
import { useThreads } from "./Thread";               // ← đây
import { toast } from "sonner";
import { generateThreadTitle } from "@/lib/thread-utils";

export type StateType = { messages: Message[]; ui?: UIMessage[] };

const useTypedStream = useStream<
  StateType,
  {
    UpdateType: {
      messages?: Message[] | Message | string;
      ui?: (UIMessage | RemoveUIMessage)[] | UIMessage | RemoveUIMessage;
      context?: Record<string, unknown>;
    };
    CustomEventType: UIMessage | RemoveUIMessage;
  }
>;

type StreamContextType = ReturnType<typeof useTypedStream>;
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

  const streamValue = useTypedStream({
    apiUrl,
    apiKey: apiKey ?? undefined,
    assistantId,
    threadId: threadId ?? null,
    onCustomEvent: (event, options) => {
      if (isUIMessage(event) || isRemoveUIMessage(event)) {
        options.mutate((prev) => ({
          ...prev,
          ui: uiMessageReducer(prev.ui ?? [], event),
        }));
      }
    },
    onThreadId: (id) => {
      setThreadId(id);
      sleep()
        .then(() => getThreads().then(setThreads))
        .catch(console.error);
    },
  });

  // mỗi khi có message mới (độ dài messages thay đổi), tính title mới và update
  useEffect(() => {
    if (!threadId) return;
    const msgs = streamValue.messages;
    if (!Array.isArray(msgs) || msgs.length === 0) return;

    const newTitle = generateThreadTitle(msgs);

    // 1) Cập nhật local state để sidebar re-render
    setThreads((prev: Thread[]) =>
      prev.map((t: Thread) =>
        t.thread_id === threadId
          ? { ...t, metadata: { ...t.metadata, title: newTitle } }
          : t
      )
    );

    // 2) Persist lên server
    (async () => {
      try {
        const client = createClient(apiUrl, getApiKey() ?? undefined);
        // theo SDK, signature là update(threadId, { metadata })
        await client.threads.update(threadId, { metadata: { title: newTitle } });
      } catch (err) {
        console.error("Failed to persist thread title", err);
      }
    })();
  }, [threadId, streamValue.messages.length, apiUrl, setThreads]);

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

  return (
    <StreamContext.Provider value={streamValue}>
      {children}
    </StreamContext.Provider>
  );
};

const DEFAULT_API_URL = "https://pdt-exchange-refurbished-lg.trycloudflare.com/";
const DEFAULT_ASSISTANT_ID = "agent";

export const StreamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const envApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const envAssistantId = process.env.NEXT_PUBLIC_ASSISTANT_ID;

  const [apiUrl, setApiUrl] = useQueryState("apiUrl", {
    defaultValue: envApiUrl || "",
  });
  const [assistantId, setAssistantId] = useQueryState("assistantId", {
    defaultValue: envAssistantId || "",
  });

  const [apiKey, _setApiKey] = useState(() => getApiKey() || "");
  const setApiKey = (key: string) => {
    window.localStorage.setItem("lg:chat:apiKey", key);
    _setApiKey(key);
  };

  const finalApiUrl = apiUrl || envApiUrl;
  const finalAssistantId = assistantId || envAssistantId;

  if (!finalApiUrl || !finalAssistantId) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4">
        {/* form nhập URL + ID */}
        <div className="animate-in fade-in-0 zoom-in-95 bg-background flex max-w-3xl flex-col rounded-lg border shadow-lg">
          <div className="mt-14 flex flex-col gap-2 border-b p-6">
            <LangGraphLogoSVG className="h-7" />
            <h1 className="text-xl font-semibold">Agent Data Chat</h1>
            <p className="text-muted-foreground">
              Please enter deployment URL & assistant/graph ID.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const fd = new FormData(form);
              setApiUrl(fd.get("apiUrl") as string);
              setApiKey(fd.get("apiKey") as string);
              setAssistantId(fd.get("assistantId") as string);
              form.reset();
            }}
            className="bg-muted/50 flex flex-col gap-6 p-6"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="apiUrl">Deployment URL</Label>
              <Input
                id="apiUrl"
                name="apiUrl"
                defaultValue={apiUrl || DEFAULT_API_URL}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="assistantId">Assistant / Graph ID</Label>
              <Input
                id="assistantId"
                name="assistantId"
                defaultValue={assistantId || DEFAULT_ASSISTANT_ID}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="apiKey">LangSmith API Key</Label>
              <PasswordInput
                id="apiKey"
                name="apiKey"
                defaultValue={apiKey}
                placeholder="lsv2_pt_..."
              />
            </div>
            <Button type="submit" size="lg">
              Continue <ArrowRight className="size-5" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <StreamSession
      apiKey={apiKey}
      apiUrl={finalApiUrl}
      assistantId={finalAssistantId}
    >
      {children}
    </StreamSession>
  );
};

export const useStreamContext = (): StreamContextType => {
  const ctx = useContext(StreamContext);
  if (!ctx) throw new Error("useStreamContext must be used within Provider");
  return ctx;
};

export default StreamContext;
