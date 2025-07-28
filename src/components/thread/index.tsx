"use client";

import { v4 as uuidv4 } from "uuid";
import { ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { useState, FormEvent } from "react";
import { Button } from "../ui/button";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { Base64ContentBlock } from "@langchain/core/messages";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { LangGraphLogoSVG } from "../icons/langgraph";
import {
  ArrowDown,
  LoaderCircle,
  XIcon,
  Plus,
} from "lucide-react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ContentBlocksPreview } from "./ContentBlocksPreview";
import {
  useArtifactOpen,
  ArtifactContent,
  ArtifactTitle,
  useArtifactContext,
} from "./artifact";

// MỚI: import client + API key để cập nhật metadata.title
import { createClient } from "@/providers/client";
import { getApiKey } from "@/lib/api-key";
import { generateChatTitle } from "@/lib/smart-title-service";

// Scroll/Stick to bottom logic
function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div ref={context.contentRef} className={props.contentClassName}>
        {props.content}
      </div>
      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="h-4 w-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

export function Thread() {
  const [artifactContext, setArtifactContext] = useArtifactContext();
  const [artifactOpen, closeArtifact] = useArtifactOpen();

  const [threadId, _setThreadId] = useQueryState("threadId");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false)
  );
  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false)
  );
  const [input, setInput] = useState("");
  const {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks,
    dragOver,
    handlePaste,
  } = useFileUpload();
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const stream = useStreamContext();
  const messages = stream.messages;
  const isLoading = stream.isLoading;

  const lastError = useRef<string | undefined>(undefined);

  // MỚI: khởi tạo client để update title
  const [apiUrl] = useQueryState("apiUrl");
  const client = apiUrl
    ? createClient(apiUrl, getApiKey() ?? undefined)
    : null;

  const setThreadId = (id: string | null) => {
    _setThreadId(id);

    // close artifact and reset artifact context
    closeArtifact();
    setArtifactContext({});
  };

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as any).message;
      if (!message || lastError.current === message) {
        return;
      }
      lastError.current = message;
      toast.error("An error occurred. Please try again.", {
        description: (
          <p>
            <strong>Error:</strong> <code>{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
      });
    } catch {
      // no-op
    }
  }, [stream.error]);

  // TODO: this should be part of the useStream hook
  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length &&
      messages[messages.length - 1].type === "ai"
    ) {
      setFirstTokenReceived(true);
    }
    prevMessageLength.current = messages.length;
  }, [messages]);

  // MỚI: handleSubmit bây giờ async để đợi update title
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if ((input.trim().length === 0 && contentBlocks.length === 0) || isLoading)
      return;
    setFirstTokenReceived(false);

    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: [
        ...(input.trim().length > 0 ? [{ type: "text", text: input }] : []),
        ...contentBlocks,
      ] as Message["content"],
    };

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);
    const context =
      Object.keys(artifactContext).length > 0 ? artifactContext : undefined;

    // 1) Gửi tin nhắn trước
    stream.submit(
      { messages: [...toolMessages, newHumanMessage], context },
      {
        streamMode: ["values"],
        optimisticValues: (prev) => ({
          ...prev,
          context,
          messages: [
            ...(prev.messages ?? []),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      }
    );

    // 2) Nếu đây là tin nhắn đầu tiên của thread mới, tạo smart title
    if (client && !threadId) {
      try {
        // Lấy text từ tin nhắn đầu tiên
        const arr = newHumanMessage.content as any[];
        const firstTextBlock = arr.find(
          (c: any) => c.type === "text"
        ) as { text: string } | undefined;
        const messageText = firstTextBlock?.text ?? "";
        
        if (messageText.trim()) {
          console.log(`Generating smart title for: "${messageText.slice(0, 50)}${messageText.length > 50 ? '...' : ''}"`);
          
          // Tạo smart title (không dùng AI để tiết kiệm cost và tăng tốc độ)
          const smartTitle = await generateChatTitle(
            messageText,
            apiUrl!,
            getApiKey() ?? undefined,
            { 
              useAI: true, // BẬT AI để tạo title thông minh hơn
              forceNew: false 
            }
          );
          
          console.log(`Generated smart title: "${smartTitle}"`);
          
          // Cập nhật thread với title mới
          await client.threads.update(threadId!, {
            metadata: { title: smartTitle },
          });
          
          // Hiển thị thông báo thành công (tùy chọn)
          // toast.success(`Đã đặt tên: "${smartTitle}"`);
          
        } else {
          // Nếu không có text, dùng title mặc định
          const defaultTitle = `Đoạn chat ${new Date().toLocaleTimeString()}`;
          await client.threads.update(threadId!, {
            metadata: { title: defaultTitle },
          });
        }
        
      } catch (err) {
        console.error("Failed to generate smart title:", err);
        
        // Fallback: dùng snippet như cũ
        try {
          const arr = newHumanMessage.content as any[];
          const firstTextBlock = arr.find(
            (c: any) => c.type === "text"
          ) as { text: string } | undefined;
          const raw = firstTextBlock?.text ?? "";
          const snippet =
            raw.length > 30 ? raw.slice(0, 30).trim() + "…" : raw.trim() || "Cuộc trò chuyện";

          await client.threads.update(threadId!, {
            metadata: { title: snippet },
          });
          
          console.log(`Fallback to snippet title: "${snippet}"`);
        } catch (updateErr) {
          console.error("Failed to update thread title with fallback:", updateErr);
        }
      }
    }

    setInput("");
    setContentBlocks([]);
  };

  const handleRegenerate = (
    parentCheckpoint: Checkpoint | null | undefined
  ) => {
    prevMessageLength.current = prevMessageLength.current - 1;
    setFirstTokenReceived(false);
    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      streamMode: ["values"],
    });
  };

  const chatStarted = !!threadId || !!messages.length;
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool"
  );

  // Lọc ra chỉ các Base64ContentBlock (hình ảnh hoặc file)
  const mediaBlocks: Base64ContentBlock[] = contentBlocks.filter(
    (b): b is Base64ContentBlock => b.type === "image" || b.type === "file"
  );

  // Hàm xóa block media theo index trong mediaBlocks
  const removeMediaBlock = (idx: number) => {
    const blockToRemove = mediaBlocks[idx];
    setContentBlocks((prev) => prev.filter((b) => b !== blockToRemove));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* MAIN FLEX */}
      <div className="flex-1 flex flex-col justify-end w-full h-full">
        <StickToBottom className="flex-1 flex flex-col justify-end">
          <StickyToBottomContent
            className={cn(
              "flex-1 flex flex-col",
              !chatStarted && "mt-[20vh] items-stretch",
              chatStarted && "grid grid-rows-[1fr_auto]"
            )}
            contentClassName="pt-8 pb-4 flex flex-col gap-4 w-full"
            content={
              <>
                {messages
                  .filter((m) =>
                    !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX)
                  )
                  .map((message, index) =>
                    message.type === "human" ? (
                      <HumanMessage
                        key={message.id || `${message.type}-${index}`}
                        message={message}
                        isLoading={isLoading}
                      />
                    ) : (
                      <AssistantMessage
                        key={message.id || `${message.type}-${index}`}
                        message={message}
                        isLoading={isLoading}
                        handleRegenerate={handleRegenerate}
                      />
                    )
                  )}
                {hasNoAIOrToolMessages && !!stream.interrupt && (
                  <AssistantMessage
                    key="interrupt-msg"
                    message={undefined}
                    isLoading={isLoading}
                    handleRegenerate={handleRegenerate}
                  />
                )}
                {isLoading && !firstTokenReceived && (
                  <AssistantMessageLoading />
                )}
              </>
            }
            footer={
              <div className="sticky bottom-0 flex flex-col items-center gap-8 w-full bg-background px-0 pb-8">
                {!chatStarted && (
                  <div className="flex items-center gap-3">
                    <LangGraphLogoSVG className="h-8 flex-shrink-0" />
                    <h1 className="text-2xl font-semibold tracking-tight">
                      Agent Data Chat
                    </h1>
                  </div>
                )}

                <ScrollToBottom className="animate-in fade-in-0 zoom-in-95 absolute bottom-full left-1/2 mb-4 -translate-x-1/2" />

                <div
                  ref={dropRef}
                  className={cn(
                    "bg-muted relative z-10 w-full rounded-2xl shadow-xs transition-all",
                    dragOver
                      ? "border-primary border-2 border-dotted"
                      : "border border-solid"
                  )}
                >
                  <form
                    onSubmit={handleSubmit}
                    className="w-full grid grid-rows-[1fr_auto] gap-2"
                  >
                    <ContentBlocksPreview
                      blocks={mediaBlocks}
                      onRemove={removeMediaBlock}
                      size="md"
                    />
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onPaste={handlePaste}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.metaKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          const el = e.target as HTMLElement | undefined;
                          const form = el?.closest("form");
                          form?.requestSubmit();
                        }
                      }}
                      placeholder="Type your message..."
                      className="field-sizing-content resize-none border-none bg-transparent p-3.5 pb-0 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none text-foreground"
                    />

                    <div className="flex items-center gap-6 p-2 pt-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="render-tool-calls"
                            checked={hideToolCalls ?? false}
                            onCheckedChange={setHideToolCalls}
                          />
                          <Label
                            htmlFor="render-tool-calls"
                            className="text-sm text-gray-600"
                          >
                            Hide Tool Calls
                          </Label>
                        </div>
                      </div>
                      <Label
                        htmlFor="file-input"
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <Plus className="size-5 text-gray-600" />
                        <span className="text-sm text-gray-600">
                          Upload image, PDF or CSV
                        </span>
                      </Label>
                      <input
                        id="file-input"
                        type="file"
                        onChange={handleFileUpload}
                        multiple
                        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/csv"
                        className="hidden"
                      />
                      {stream.isLoading ? (
                        <Button
                          key="stop"
                          onClick={() => stream.stop()}
                          className="ml-auto"
                        >
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          className="ml-auto shadow-md transition-all"
                          disabled={
                            isLoading ||
                            (!input.trim() && contentBlocks.length === 0)
                          }
                        >
                          Send
                        </Button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            }
          />
        </StickToBottom>
      </div>

      {artifactOpen && (
        <div className="relative flex flex-col border-l bg-card h-full min-w-[30vw]">
          <div className="absolute inset-0 flex flex-col">
            <div className="grid grid-cols-[1fr_auto] border-b p-4">
              <ArtifactTitle className="truncate overflow-hidden" />
              <button onClick={closeArtifact} className="cursor-pointer">
                <XIcon className="size-5" />
              </button>
            </div>
            <ArtifactContent className="relative flex-grow" />
          </div>
        </div>
      )}
    </div>
  );
}
