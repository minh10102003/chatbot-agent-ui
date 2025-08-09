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
  block: Base64ContentBlock | CsvTextBlock | Record<string, any>;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/** Helpers: lấy field theo cả camelCase & snake_case */
const getMime = (b: any) => b?.mimeType ?? b?.mime_type;
const getSource = (b: any) => b?.source ?? b?.source_type;
const getName = (b: any) =>
  (b?.metadata?.name ?? b?.metadata?.filename) as string | undefined;

export const MultimodalPreview: React.FC<MultimodalPreviewProps> = ({
  block,
  removable = false,
  onRemove,
  className,
  size = "md",
}) => {
  const b: any = block;
  const type = b?.type;
  const mime = getMime(b);
  const source = getSource(b);
  const name = getName(b);

  // 1) IMAGE (base64)
  if (
    type === "image" &&
    (source === "base64" || !!b?.data) &&
    typeof mime === "string" &&
    mime.startsWith("image/")
  ) {
    const url = `data:${mime};base64,${b.data}`;
    const box = size === "sm" ? 40 : size === "lg" ? 96 : 64; // px
    const imgClass =
      size === "sm"
        ? "rounded-md object-cover h-10 w-10"
        : size === "lg"
        ? "rounded-md object-cover h-24 w-24"
        : "rounded-md object-cover h-16 w-16";

    return (
      <div className={cn("relative inline-block", className)}>
        <Image
          src={url}
          alt={String(name ?? "uploaded image")}
          className={imgClass}
          width={box}
          height={box}
        />
        {removable && onRemove && (
          <button
            type="button"
            className="absolute top-1 right-1 z-10 rounded-full bg-gray-500/90 text-white hover:bg-gray-700"
            onClick={onRemove}
            aria-label="Remove image"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // 2) PDF (base64)
  if (
    type === "file" &&
    (source === "base64" || !!b?.data) &&
    mime === "application/pdf"
  ) {
    const filename = String(name ?? "file.pdf");
    return (
      <div
        className={cn(
          "relative flex items-start gap-2 rounded-md border bg-gray-100 px-3 py-2",
          className
        )}
      >
        <FileIcon
          className={cn(
            "text-teal-700 flex-shrink-0",
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

  // 3) CSV (text block do hook parse ra)
  if (type === "text" && b?.metadata?.filename?.toLowerCase?.().endsWith(".csv")) {
    const filename = String(b.metadata.filename);
    return (
      <div
        className={cn(
          "relative flex items-start gap-2 rounded-md border bg-gray-100 px-3 py-2",
          className
        )}
      >
        <FileIcon
          className={cn(
            "text-green-700 flex-shrink-0",
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

  // 4) Fallback
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
