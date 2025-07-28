// src/components/thread/MultimodalPreview.tsx
"use client";

import React from "react";
import { File as FileIcon, X as XIcon } from "lucide-react";
import type { Base64ContentBlock } from "@langchain/core/messages";
import { cn } from "@/lib/utils";
import Image from "next/image";

/**
 * Kiểu riêng cho block CSV dưới dạng text.
 */
interface CsvTextBlock {
  type: "text";
  text: string;
  metadata: { filename: string };
}

export interface MultimodalPreviewProps {
  block: Base64ContentBlock | CsvTextBlock;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const MultimodalPreview: React.FC<MultimodalPreviewProps> = ({
  block,
  removable = false,
  onRemove,
  className,
  size = "md",
}) => {
  // 1. IMAGE block
  if (
    (block as Base64ContentBlock).type === "image" &&
    (block as Base64ContentBlock).source_type === "base64" &&
    typeof (block as Base64ContentBlock).mime_type === "string" &&
    (block as Base64ContentBlock).mime_type?.startsWith("image/")
  ) {
    const b = block as Base64ContentBlock;
    const url = `data:${b.mime_type};base64,${b.data}`;
    let imgClass = "rounded-md object-cover h-16 w-16";
    if (size === "sm") imgClass = "rounded-md object-cover h-10 w-10";
    if (size === "lg") imgClass = "rounded-md object-cover h-24 w-24";
    return (
      <div className={cn("relative inline-block", className)}>
        <Image
          src={url}
          alt={String(b.metadata?.name ?? "uploaded image")}
          className={imgClass}
          width={size === "sm" ? 16 : size === "md" ? 32 : 48}
          height={size === "sm" ? 16 : size === "md" ? 32 : 48}
        />
        {removable && onRemove && (
          <button
            type="button"
            className="absolute top-1 right-1 z-10 rounded-full bg-gray-500 text-white hover:bg-gray-700"
            onClick={onRemove}
            aria-label="Remove image"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // 2. PDF block
  if (
    (block as Base64ContentBlock).type === "file" &&
    (block as Base64ContentBlock).source_type === "base64" &&
    (block as Base64ContentBlock).mime_type === "application/pdf"
  ) {
    const b = block as Base64ContentBlock;
    const filename = String(
      b.metadata?.filename ?? b.metadata?.name ?? "PDF file"
    );
    return (
      <div
        className={cn(
          "relative flex items-start gap-2 rounded-md border bg-gray-100 px-3 py-2",
          className
        )}
      >
        <FileIcon
          className={cn(
            "text-teal-700",
            size === "sm" ? "h-5 w-5" : "h-7 w-7"
          )}
        />
        <span
          className={cn("min-w-0 flex-1 text-sm break-all text-gray-800")}
          style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}
        >
          {filename}
        </span>
        {removable && onRemove && (
          <button
            type="button"
            className="ml-2 self-start rounded-full bg-gray-200 p-1 text-teal-700 hover:bg-gray-300"
            onClick={onRemove}
            aria-label="Remove PDF"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // 3. CSV block dưới dạng text
  if ((block as CsvTextBlock).type === "text") {
    const c = block as CsvTextBlock;
    const filename = String(c.metadata.filename);
    return (
      <div
        className={cn(
          "relative flex items-start gap-2 rounded-md border bg-gray-100 px-3 py-2",
          className
        )}
      >
        <FileIcon
          className={cn(
            "text-green-700",
            size === "sm" ? "h-5 w-5" : "h-7 w-7"
          )}
        />
        <span
          className={cn("min-w-0 flex-1 text-sm break-all text-gray-800")}
          style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}
        >
          {filename}
        </span>
        {removable && onRemove && (
          <button
            type="button"
            className="ml-2 self-start rounded-full bg-gray-200 p-1 text-green-700 hover:bg-gray-300"
            onClick={onRemove}
            aria-label="Remove CSV"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // 4. Fallback
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-gray-100 px-3 py-2 text-gray-500",
        className
      )}
    >
      <FileIcon className="h-5 w-5 flex-shrink-0" />
      <span className="truncate text-xs">Unsupported file type</span>
      {removable && onRemove && (
        <button
          type="button"
          className="ml-2 rounded-full bg-gray-200 p-1 text-gray-500 hover:bg-gray-300"
          onClick={onRemove}
          aria-label="Remove file"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
