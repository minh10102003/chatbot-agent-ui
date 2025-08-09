"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Plus } from "lucide-react";
import useMessageFilter from "@/hooks/useMessageFilter";
import { useStreamContext } from "@/providers/Stream";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ContentBlocksPreview } from "@/components/thread/ContentBlocksPreview";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Message } from "@langchain/langgraph-sdk";

export const ChatInput: React.FC = () => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { filterAndSend, previewFilter } = useMessageFilter();
  const stream = useStreamContext();

  // Upload state (ảnh/pdf/csv), drag & drop & paste
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

  // --- Debounce input for preview ---
  const [debounced, setDebounced] = useState(input);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), 250); // 250–300ms là hợp lý
    return () => clearTimeout(t);
  }, [input]);

  // Preview filtering (chỉ áp dụng cho text) – chạy theo debounced input
  const filterPreview = useMemo(() => {
    if (!debounced) return null;
    return previewFilter(debounced);
  }, [debounced, previewFilter]);

  const hasText = input.trim().length > 0;
  const hasFiles = contentBlocks.length > 0;

  const clearUI = () => {
    setInput("");
    setContentBlocks([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleSend = async () => {
    if ((!hasText && !hasFiles) || stream.isLoading) return;

    // Gộp theo kiểu ChatGPT: nếu có text + file => tạo mảng content blocks: [text, ...files]
    let messageContent: Message["content"];
    if (hasText && hasFiles) {
      messageContent = [{ type: "text", text: input.trim() }, ...(contentBlocks as any)];
    } else if (hasText) {
      messageContent = input.trim();
    } else {
      messageContent = contentBlocks as any;
    }

    try {
      await filterAndSend(messageContent);
      clearUI();
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <div
        ref={dropRef}
        className={cn(
          "bg-muted relative rounded-2xl shadow-sm transition-all max-w-3xl mx-auto duration-300 ease-in-out border",
          dragOver ? "border-primary border-2 border-dotted" : "border-solid"
        )}
      >
        {/* Preview files (ảnh, pdf, csv) */}
        <ContentBlocksPreview blocks={contentBlocks} onRemove={removeBlock} size="md" />

        {/* Input row giống ChatGPT */}
        <div className="flex items-end gap-2 p-2">
          {/* Upload button */}
          <div className="flex items-center">
            <Label htmlFor="file-input" className="flex cursor-pointer items-center justify-center">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-background transition-colors">
                <Plus className="h-5 w-5" />
              </div>
            </Label>
            <input
              id="file-input"
              type="file"
              onChange={handleFileUpload}
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/csv"
              className="hidden"
            />
          </div>

          {/* Text area */}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            onPaste={handlePaste}
            placeholder="Type a message..."
            className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            disabled={stream.isLoading}
          />

          {/* Send / Stop */}
          {stream.isLoading ? (
            <Button onClick={() => stream.stop?.()} size="icon" className="h-11 w-11 shrink-0">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!hasText && !hasFiles}
              size="icon"
              className="h-11 w-11 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Footer row: hint + filter preview */}
        <div className="flex justify-between items-center text-xs text-muted-foreground px-3 pb-2">
          <span>Upload: images, PDF, CSV — drag & drop or paste supported</span>
          {hasText && filterPreview?.metadata?.filtered && (
            <span className="text-orange-500">Text will be filtered before sending</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
