import { useStreamContext } from "@/providers/Stream";
import { Message } from "@langchain/langgraph-sdk";
import { useState, useCallback } from "react";
import { getContentString } from "../utils";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { BranchSwitcher, CommandBar } from "./shared";
import { MultimodalPreview } from "@/components/thread/MultimodalPreview";
import { isBase64ContentBlock } from "@/lib/multimodal-utils";

function EditableContent({
  value,
  setValue,
  onSubmit,
}: {
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className="focus-visible:ring-0"
      placeholder="Edit your message..."
    />
  );
}

export function HumanMessage({
  message,
  isLoading,
}: {
  message: Message;
  isLoading: boolean;
}) {
  const thread = useStreamContext();
  const meta = thread.getMessagesMetadata(message);
  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;

  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  const contentString = getContentString(message.content);

  // 🎯 Handle message edit with potential title regeneration
  const handleSubmitEdit = useCallback(() => {
    setIsEditing(false);

    const newMessage: Message = { 
      type: "human", 
      content: value,
      id: message.id // Preserve message ID for consistency
    };

    // Check if this is the first human message (for title regeneration)
    const isFirstHuman = thread.messages.findIndex(m => m.type === "human") === 
                         thread.messages.findIndex(m => m.id === message.id);

    thread.submit(
      { messages: [newMessage] },
      {
        checkpoint: parentCheckpoint,
        streamMode: ["values"],
        optimisticValues: (prev) => {
          const values = meta?.firstSeenState?.values;
          if (!values) return prev;

          // 🎯 Update messages with edited content
          const messagesArray = Array.isArray(values.messages) ? values.messages : [];
          const updatedMessages = messagesArray.map(msg => 
            msg.id === message.id ? newMessage : msg
          ) ?? [newMessage];

          return {
            ...values,
            messages: updatedMessages,
            // 🎯 Add metadata flag for title regeneration if first human message
            ...(isFirstHuman && { 
              _shouldRegenerateTitle: true,
              _editedFirstMessage: value 
            })
          };
        },
      },
    );

    // 🎯 Optional: Immediate UI feedback for title change
    if (isFirstHuman && process.env.NEXT_PUBLIC_DEBUG_NAMER === "1") {
      console.info("[HumanMessage] Edited first human message, title may regenerate");
    }
  }, [value, message.id, thread, meta, parentCheckpoint]);

  return (
    <div className="group flex items-start gap-3 justify-end w-full">
      {/* Message Content - Flex order 2 to appear after avatar on mobile */}
      <div className={cn(
        "flex flex-col gap-2 order-1",
        isEditing && "w-full"
      )}>
        {isEditing ? (
          <div className="relative">
            <EditableContent
              value={value}
              setValue={setValue}
              onSubmit={handleSubmitEdit}
            />
            {/* 🎯 Helper text for editing */}
            <div className="text-xs text-muted-foreground mt-1">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Cmd+Enter</kbd> to save
              {thread.messages.findIndex(m => m.type === "human") === 
               thread.messages.findIndex(m => m.id === message.id) && 
               " (will regenerate thread title)"}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 items-start">
            {/* Render images and files if present */}
            {Array.isArray(message.content) && message.content.length > 0 && (
              <div className="flex flex-wrap items-start justify-start gap-2">
                {message.content.reduce<React.ReactNode[]>(
                  (acc, block, idx) => {
                    if (isBase64ContentBlock(block)) {
                      acc.push(
                        <MultimodalPreview
                          key={idx}
                          block={block}
                          size="md"
                        />,
                      );
                    }
                    return acc;
                  },
                  [],
                )}
              </div>
            )}
            {/* Render text content */}
            {contentString && (
              <div className="bg-muted text-foreground rounded-2xl px-4 py-2 max-w-sm whitespace-pre-wrap text-left">
                {contentString}
              </div>
            )}
          </div>
        )}

        {/* Command bar */}
        <div
          className={cn(
            "flex items-center gap-2 justify-start transition-opacity",
            "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
            isEditing && "opacity-100",
          )}
        >
          <BranchSwitcher
            branch={meta?.branch}
            branchOptions={meta?.branchOptions}
            onSelect={(branch) => thread.setBranch(branch)}
            isLoading={isLoading}
          />
          <CommandBar
            isLoading={isLoading}
            content={contentString}
            isEditing={isEditing}
            setIsEditing={(c) => {
              if (c) {
                setValue(contentString);
              }
              setIsEditing(c);
            }}
            handleSubmitEdit={handleSubmitEdit}
            isHumanMessage={true}
          />
        </div>
      </div>

      {/* User Avatar - Flex order 1 to appear first */}
      <div className="flex-shrink-0 w-8 h-8 bg-muted border-2 border-primary rounded-full flex items-center justify-center text-primary text-sm font-medium order-2">
        U
      </div>
    </div>
  );
}