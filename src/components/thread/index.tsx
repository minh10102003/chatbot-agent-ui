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
import { ChatInput } from "@/components/chat/ChatInput";

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
        behavior: 'smooth'
      });
    }
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isAtBottom);
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
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
  
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const stream = useStreamContext();
  const messages = stream.messages;
  const isLoading = stream.isLoading;

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
    if (messages.length > prevMessageLength.current && messagesContainerRef.current) {
      setTimeout(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
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

        {/* Messages area */}
        <div 
          ref={messagesContainerRef}
          className={cn(
            "flex-1 overflow-y-auto min-h-0 transition-all duration-700 ease-in-out",
            !chatStarted ? "flex items-center justify-center" : ""
          )}
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="w-full px-4 min-h-full">
            {chatStarted && (
              <div className="py-4 space-y-4 max-w-4xl mx-auto animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
                {messages
                  .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                  .map((message, index) =>
                    message.type === "human" ? (
                      <div key={message.id || `${message.type}-${index}`} className="flex justify-end">
                        <div className="w-full max-w-[70%]">
                          <HumanMessage
                            message={message}
                            isLoading={isLoading}
                          />
                        </div>
                      </div>
                    ) : (
                      <div key={message.id || `${message.type}-${index}`} className="flex justify-start">
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
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className={cn(
          "flex-shrink-0 transition-all duration-700 ease-in-out",
          !chatStarted ? "transform translate-y-0" : ""
        )}>
          <ChatInput />
        </div>

        {/* Scroll to bottom button */}
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
