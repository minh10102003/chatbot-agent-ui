"use client";

import { v4 as uuidv4 } from "uuid";
import { ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { Base64ContentBlock } from "@langchain/core/messages"; // ✅ giữ 1 import duy nhất ở đây
import { AssistantMessage, AssistantMessageLoading } from "@/components/thread/messages/ai";
import { HumanMessage } from "@/components/thread/messages/human";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { LangGraphLogoSVG } from "@/components/icons/langgraph";
import {
  ArrowDown,
  LoaderCircle,
  XIcon,
  Plus,
} from "lucide-react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ContentBlocksPreview } from "@/components/thread/ContentBlocksPreview";
import {
  useArtifactOpen,
  ArtifactContent,
  ArtifactTitle,
  useArtifactContext,
} from "@/components/thread/artifact";
import useMessageFilter from "@/hooks/useMessageFilter";

// ❌ BỎ import trùng (bạn đang có 2 dòng import Base64ContentBlock trước đó)
// import { Base64ContentBlock, MessageContent, MessageContentText } from "@langchain/core/messages";

// Custom scroll to bottom button
function ScrollToBottomButton() {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isAtBottom);
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  return {
    showScrollButton,
    scrollToBottom,
    messagesEndRef,
    messagesContainerRef,
  };
}

// MAIN EXPORT
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

  // ✅ Bạn vẫn có thể dùng hook nếu cần
  const { filterAndSend } = useMessageFilter();

  const lastError = useRef<string | undefined>(undefined);

  // Custom scroll logic
  const {
    showScrollButton,
    scrollToBottom,
    messagesEndRef,
    messagesContainerRef,
  } = ScrollToBottomButton();

  const setThreadId = (id: string | null) => {
    _setThreadId(id);
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

  // Auto scroll to bottom when new messages arrive
  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length > prevMessageLength.current &&
      messagesContainerRef.current
    ) {
      setTimeout(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 100);
    }
    prevMessageLength.current = messages.length;
  }, [messages]);

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

  // Giữ nguyên luồng submit hiện tại (đang chạy ổn)
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (
      (input.trim().length === 0 && contentBlocks.length === 0) ||
      isLoading
    )
      return;

    console.log("[Thread] handleSubmit called with input:", input);
    setFirstTokenReceived(false);

    try {
      if (input.trim().length > 0 || contentBlocks.length > 0) {
        const messageContent =
          input.trim().length > 0
            ? input.trim()
            : (contentBlocks as Message["content"]);

        const newHumanMessage: Message = {
          id: uuidv4(),
          type: "human",
          content: messageContent,
        };

        const toolMessages = ensureToolCallsHaveResponses(stream.messages);
        const toolMessagesArray = Array.isArray(toolMessages)
          ? toolMessages
          : [];
        const context =
          Object.keys(artifactContext).length > 0
            ? artifactContext
            : undefined;

        if (stream.submit) {
          stream.submit(
            { messages: [...toolMessagesArray, newHumanMessage], context },
            {
              streamMode: ["values"],
              optimisticValues: (prev) => {
                const prevMessages = Array.isArray(prev.messages)
                  ? prev.messages
                  : [];
                return {
                  ...prev,
                  context,
                  messages: [
                    ...prevMessages,
                    ...toolMessagesArray,
                    newHumanMessage,
                  ],
                };
              },
            }
          );
        } else {
          console.error("[Thread] stream.submit method not available");
          toast.error("Stream method not available. Please try again.");
          return;
        }

        setInput("");
        setContentBlocks([]);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. Please try again.");
    }
  };

  const handleRegenerate = (parentCheckpoint: Checkpoint | null | undefined) => {
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

  const mediaBlocks: Base64ContentBlock[] = contentBlocks.filter(
    (b): b is Base64ContentBlock => b.type === "image" || b.type === "file"
  );

  const removeMediaBlock = (idx: number) => {
    const blockToRemove = mediaBlocks[idx];
    setContentBlocks((prev) => prev.filter((b) => b !== blockToRemove));
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-background flex">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header - fixed height */}
        {!chatStarted && (
          <div className="flex-shrink-0 h-16 flex items-center justify-center border-b bg-background px-4">
            <LangGraphLogoSVG className="h-6 w-6 flex-shrink-0" />
            <h1 className="text-xl font-semibold tracking-tight ml-2">
              Quantica Chat
            </h1>
          </div>
        )}

        {/* Messages area - flexible, scrollable with transition */}
        <div
          ref={messagesContainerRef}
          className={cn(
            "flex-1 overflow-y-auto min-h-0 transition-all duration-700 ease-in-out",
            !chatStarted ? "flex items-center justify-center" : ""
          )}
          style={{ scrollBehavior: "smooth" }}
        >
          <div className="w-full px-4 min-h-full">
            {/* Messages - normal flow when chat started */}
            {chatStarted && (
              <div className="py-4 space-y-4 max-w-4xl mx-auto animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
                {messages
                  .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                  .map((message, index) =>
                    message.type === "human" ? (
                      <div
                        key={message.id || `${message.type}-${index}`}
                        className="flex justify-end"
                      >
                        <div className="w-full max-w-[70%]">
                          <HumanMessage
                            message={message}
                            isLoading={isLoading}
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        key={message.id || `${message.type}-${index}`}
                        className="flex justify-start"
                      >
                        <div className="w-full max-w-[85%]">
                          <AssistantMessage
                            message={message}
                            isLoading={isLoading}
                            handleRegenerate={handleRegenerate}
                          />
                        </div>
                      </div>
                    )
                  )}
                {hasNoAIOrToolMessages && !!stream.interrupt && (
                  <div className="flex justify-start">
                    <div className="w-full max-w-[85%]">
                      <AssistantMessage
                        key="interrupt-msg"
                        message={undefined}
                        isLoading={isLoading}
                        handleRegenerate={handleRegenerate}
                      />
                    </div>
                  </div>
                )}
                {isLoading && !firstTokenReceived && (
                  <div className="flex justify-start">
                    <div className="w-full max-w-[85%]">
                      <AssistantMessageLoading />
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Invisible div to scroll to */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area (giữ nguyên chức năng) */}
        <div
          className={cn(
            "flex-shrink-0 border-t bg-background p-4 pb-12 transition-all duration-700 ease-in-out",
            !chatStarted ? "transform translate-y-0" : ""
          )}
        >
          <div className="w-full max-w-4xl mx-auto">
            <div
              ref={dropRef}
              className={cn(
                "bg-muted relative rounded-2xl shadow-sm transition-all max-w-3xl mx-auto duration-300 ease-in-out",
                dragOver
                  ? "border-primary border-2 border-dotted"
                  : "border border-solid",
                !chatStarted ? "shadow-lg border-primary/20" : ""
              )}
            >
              <form
                onSubmit={handleSubmit}
                className="w-full grid grid-rows-[1fr_auto] gap-2"
              >
                <ContentBlocksPreview
                  blocks={contentBlocks}
                  onRemove={removeBlock}
                  size="md"
                />
                <textarea
                  value={input}
                  onChange={(e) => {
                    console.log("[Thread] input changed:", e.target.value);
                    setInput(e.target.value);
                  }}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.metaKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      console.log(
                        "[Thread] Enter key pressed, submitting form"
                      );
                      const el = e.target as HTMLElement | undefined;
                      const form = el?.closest("form");
                      form?.requestSubmit();
                    }
                  }}
                  placeholder="Type your message..."
                  className="field-sizing-content resize-none border-none bg-transparent p-3.5 pb-0 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none text-foreground min-h-[2.5rem] max-h-32"
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
                        isLoading || (!input.trim() && contentBlocks.length === 0)
                      }
                      onClick={() =>
                        console.log("[Thread] Send button clicked")
                      }
                    >
                      Send
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Scroll to bottom button - floating above input */}
        {showScrollButton && (
          <Button
            variant="outline"
            size="sm"
            className="fixed bottom-36 left-1/2 transform -translate-x-1/2 z-10 rounded-full shadow-lg animate-in fade-in-0 zoom-in-95"
            onClick={scrollToBottom}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>
      {/* Artifact side panel */}
      {artifactOpen && (
        <div className="w-96 border-l bg-card h-full flex flex-col flex-shrink-0">
          <div className="flex items-center justify-between border-b p-4">
            <ArtifactTitle className="truncate overflow-hidden flex-1 mr-2" />
            <button onClick={closeArtifact} className="cursor-pointer">
              <XIcon className="size-5" />
            </button>
          </div>
          <ArtifactContent className="flex-1 overflow-y-auto" />
        </div>
      )}
    </div>
  );
}
