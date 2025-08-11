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
      // Chỉ gửi khi có nội dung và không đang loading
      if ((hasText || hasFiles) && !stream.isLoading) {
        handleSend();
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  return (
    <div className="w-full px-4 pb-6 pt-4">
      <div className="max-w-3xl mx-auto mb-4">
        <div
          ref={dropRef}
          className={cn(
            "relative rounded-2xl transition-all duration-200 border shadow-sm",
            "bg-background",
            dragOver ? "border-primary border-2 border-dashed" : "border-border"
          )}
        >
          {/* Preview files (ảnh, pdf, csv) */}
          {contentBlocks.length > 0 && (
            <div className="p-3 pb-0">
              <ContentBlocksPreview blocks={contentBlocks} onRemove={removeBlock} size="md" />
            </div>
          )}

          {/* Main input row */}
          <div className="flex items-end gap-2 p-3">
            {/* Upload button */}
            <Label htmlFor="file-input" className="cursor-pointer">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                <Plus className="h-4 w-4 text-muted-foreground" />
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

            {/* Textarea container */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                onPaste={handlePaste}
                placeholder="Hỏi bất kỳ điều gì..."
                className={cn(
                  "min-h-[40px] max-h-32 resize-none border-0 bg-transparent",
                  "focus-visible:ring-0 shadow-none px-0 py-2",
                  "placeholder:text-muted-foreground text-sm"
                )}
                disabled={stream.isLoading}
              />
            </div>

            {/* Nút gửi cố định - mờ khi không có nội dung */}
            {stream.isLoading ? (
              <Button
                onClick={() => stream.stop?.()}
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-lg"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={!hasText && !hasFiles}
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-lg transition-all duration-200",
                  (hasText || hasFiles)
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                )}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Drag overlay */}
          {dragOver && (
            <div className="absolute inset-0 bg-primary/5 rounded-2xl flex items-center justify-center border-2 border-dashed border-primary">
              <div className="text-sm text-primary font-medium">Drop files here</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;