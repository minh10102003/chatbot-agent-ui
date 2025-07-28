// src/components/thread/ContentBlocksPreview.tsx
"use client";

import React from "react";
import type { ChatContentBlock } from "@/hooks/use-file-upload";
import { MultimodalPreview } from "./MultimodalPreview";
import { cn } from "@/lib/utils";

interface ContentBlocksPreviewProps {
  blocks: ChatContentBlock[];
  onRemove: (idx: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Renders a preview of content blocks (images, PDF, CSV) with optional remove functionality.
 */
export const ContentBlocksPreview: React.FC<ContentBlocksPreviewProps> = ({
  blocks,
  onRemove,
  size = "md",
  className,
}) => {
  if (!blocks.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-2 p-3.5 pb-0", className)}>
      {blocks.map((block, idx) => (
        <MultimodalPreview
          key={idx}
          // giờ đây block có thể là Base64ContentBlock (image/file)
          // hoặc TextContentBlock (CSV)
          block={block as any}
          removable
          onRemove={() => onRemove(idx)}
          size={size}
        />
      ))}
    </div>
  );
};
