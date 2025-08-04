// src/components/chat/ChatInput.tsx
"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { useMessageFilter } from "@/hooks/useMessageFilter";
import { Badge } from "@/components/ui/badge";

export const ChatInput: React.FC = () => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { filterAndSend, previewFilter } = useMessageFilter();

  // Preview filtering results as user types
  const filterPreview = input ? previewFilter(input) : null;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    try {
      setIsLoading(true);
      
      // Send filtered message
      await filterAndSend(input.trim());
      
      // Clear input after successful send
      setInput("");
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  };

  return (
    <div className="space-y-2 p-4 border-t">
      {/* Filter Preview - Show when filtering is applied */}
      {filterPreview?.metadata.filtered && (
        <div className="flex flex-wrap gap-1">
          {filterPreview.metadata.filterReasons?.map((reason: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined, index: React.Key | null | undefined) => (
            <Badge key={index} variant="outline" className="text-xs">
              {reason}
            </Badge>
          ))}
        </div>
      )}
      
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="min-h-[44px] max-h-32 resize-none"
          disabled={isLoading}
        />
        
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="h-11 w-11 shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Character count with filtering info */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {filterPreview ? 
            `${filterPreview.content.length} chars (${filterPreview.metadata.originalLength} original)` :
            `${input.length} chars`
          }
        </span>
        
        {filterPreview?.metadata.filtered && (
          <span className="text-orange-500">
            Content will be filtered before sending
          </span>
        )}
      </div>
    </div>
  );
};