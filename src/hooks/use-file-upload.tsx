// src/hooks/use-file-upload.tsx
import { useState, useRef, useEffect, ChangeEvent } from "react";
import { toast } from "sonner";
import type { Base64ContentBlock } from "@langchain/core/messages";
import { fileToContentBlock } from "@/lib/multimodal-utils";
import { parseCsv } from "@/lib/csv";

/** Kiểu text rút ra từ CSV */
interface TextContentBlock {
  type: "text";
  text: string;
  metadata: { filename: string };
}
export type ChatContentBlock = Base64ContentBlock | TextContentBlock;

export const SUPPORTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/csv",
];

interface UseFileUploadOptions {
  initialBlocks?: ChatContentBlock[];
}

/** Chuẩn hoá block: đổi mime_type -> mimeType, bổ sung metadata name/filename */
function normalizeBlock(b: any): Base64ContentBlock {
  const mimeType = b?.mimeType ?? b?.mime_type ?? b?.mime ?? "";
  const metadata = b?.metadata ?? {};
  const name =
    metadata?.name ??
    metadata?.filename ??
    metadata?.fileName ??
    undefined;

  const normalized: any = {
    ...b,
    mimeType,
    type: b?.type,
    data: b?.data,
    metadata: {
      ...metadata,
      name: name ?? metadata?.name,
      filename: metadata?.filename ?? name,
    },
  };
  // xoá trường snake_case nếu có
  if ("mime_type" in normalized) delete normalized.mime_type;

  return normalized as Base64ContentBlock;
}

/**
 * Hook quản lý upload file (image/pdf) và CSV
 */
export function useFileUpload({ initialBlocks = [] }: UseFileUploadOptions = {}) {
  const [contentBlocks, setContentBlocks] = useState<ChatContentBlock[]>(initialBlocks);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  /** Kiểm tra duplicate cho file media */
  const isDuplicate = (file: File, blocks: ChatContentBlock[]): boolean => {
    if (file.type === "application/pdf") {
      return blocks.some((b) => {
        const bb: any = b;
        if (bb.type !== "file") return false;
        const mimeType = bb.mimeType ?? bb.mime_type;
        const meta = bb.metadata ?? {};
        const fname = meta.filename ?? meta.name;
        return mimeType === "application/pdf" && fname === file.name;
      });
    }
    if (SUPPORTED_FILE_TYPES.includes(file.type) && file.type !== "text/csv") {
      return blocks.some((b) => {
        const bb: any = b;
        if (bb.type !== "image") return false;
        const mimeType = bb.mimeType ?? bb.mime_type;
        const meta = bb.metadata ?? {};
        const fname = meta.name ?? meta.filename;
        return mimeType === file.type && fname === file.name;
      });
    }
    return false;
  };

  /** Xử lý input[type=file] */
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((f) => SUPPORTED_FILE_TYPES.includes(f.type));
    const invalidFiles = fileArray.filter((f) => !SUPPORTED_FILE_TYPES.includes(f.type));
    if (invalidFiles.length > 0) {
      toast.error(`Unsupported file type(s): ${invalidFiles.map((f) => f.name).join(", ")}`);
    }

    const csvFiles = validFiles.filter((f) => f.type === "text/csv");
    const mediaFiles = validFiles.filter((f) => f.type !== "text/csv");

    const uniqueMedia = mediaFiles.filter((file) => !isDuplicate(file, contentBlocks));
    const duplicateMedia = mediaFiles.filter((file) => isDuplicate(file, contentBlocks));
    if (duplicateMedia.length > 0) {
      toast.error(`Duplicate file(s): ${duplicateMedia.map((f) => f.name).join(", ")}`);
    }

    // Parse CSV -> TextContentBlock
    const csvBlocks: TextContentBlock[] = (
      await Promise.all(
        csvFiles.map(async (file) => {
          try {
            const records = await parseCsv(file);
            return {
              type: "text",
              text: JSON.stringify(records, null, 2),
              metadata: { filename: file.name },
            };
          } catch (err: any) {
            toast.error(`Failed to parse CSV ${file.name}: ${err.message}`);
            return null;
          }
        })
      )
    ).filter((b): b is TextContentBlock => b !== null);

    // Media -> Base64ContentBlock (chuẩn hoá)
    const mediaBlocks: Base64ContentBlock[] =
      uniqueMedia.length > 0
        ? (await Promise.all(uniqueMedia.map(fileToContentBlock))).map(normalizeBlock)
        : [];

    setContentBlocks((prev) => [...prev, ...mediaBlocks, ...csvBlocks]);
    e.target.value = "";
  };

  /** Drag & drop */
  useEffect(() => {
    if (!dropRef.current) return;

    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        dragCounter.current += 1;
        setDragOver(true);
      }
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
          setDragOver(false);
          dragCounter.current = 0;
        }
      }
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragOver(false);

      if (!e.dataTransfer) return;
      const files = Array.from(e.dataTransfer.files);
      const validFiles = files.filter((f) => SUPPORTED_FILE_TYPES.includes(f.type));
      const invalidFiles = files.filter((f) => !SUPPORTED_FILE_TYPES.includes(f.type));
      if (invalidFiles.length > 0) {
        toast.error(`Unsupported file(s) dropped: ${invalidFiles.map((f) => f.name).join(", ")}`);
      }

      const csvFiles2 = validFiles.filter((f) => f.type === "text/csv");
      const mediaFiles2 = validFiles.filter((f) => f.type !== "text/csv");
      const uniqueMedia2 = mediaFiles2.filter((file) => !isDuplicate(file, contentBlocks));

      const mediaBlocks2: Base64ContentBlock[] =
        uniqueMedia2.length > 0
          ? (await Promise.all(uniqueMedia2.map(fileToContentBlock))).map(normalizeBlock)
          : [];
      const csvBlocks2: TextContentBlock[] = (
        await Promise.all(
          csvFiles2.map(async (file) => {
            try {
              const records = await parseCsv(file);
              return {
                type: "text",
                text: JSON.stringify(records, null, 2),
                metadata: { filename: file.name },
              };
            } catch {
              return null;
            }
          })
        )
      ).filter((b): b is TextContentBlock => b !== null);

      setContentBlocks((prev) => [...prev, ...mediaBlocks2, ...csvBlocks2]);
    };
    const onDragEnd = () => {
      dragCounter.current = 0;
      setDragOver(false);
    };
    const onDragOverWindow = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("dragover", onDragOverWindow);

    const el = dropRef.current!;
    const onDragOverEl = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };
    const onDragEnterEl = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };
    const onDragLeaveEl = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
    };
    el.addEventListener("dragover", onDragOverEl);
    el.addEventListener("dragenter", onDragEnterEl);
    el.addEventListener("dragleave", onDragLeaveEl);

    return () => {
      el.removeEventListener("dragover", onDragOverEl);
      el.removeEventListener("dragenter", onDragEnterEl);
      el.removeEventListener("dragleave", onDragLeaveEl);
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("dragover", onDragOverWindow);
      dragCounter.current = 0;
    };
  }, [contentBlocks]);

  /** Xoá 1 block theo index */
  const removeBlock = (idx: number) => {
    setContentBlocks((prev) => prev.filter((_, i) => i !== idx));
  };

  /** Xoá tất cả block */
  const resetBlocks = () => setContentBlocks([]);

  /** Paste file từ clipboard */
  const handlePaste = async (
    e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const items = e.clipboardData.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length === 0) return;

    e.preventDefault();
    const validFiles = files.filter((file) => SUPPORTED_FILE_TYPES.includes(file.type));
    const invalidFiles = files.filter((file) => !SUPPORTED_FILE_TYPES.includes(file.type));

    const isDup = (file: File) => {
      if (file.type === "application/pdf") {
        return contentBlocks.some((b: any) => {
          if (b.type !== "file") return false;
          const mimeType = b.mimeType ?? b.mime_type;
          const meta = b.metadata ?? {};
          const fname = meta.filename ?? meta.name;
          return mimeType === "application/pdf" && fname === file.name;
        });
      }
      if (SUPPORTED_FILE_TYPES.includes(file.type)) {
        return contentBlocks.some((b: any) => {
          if (b.type !== "image") return false;
          const mimeType = b.mimeType ?? b.mime_type;
          const meta = b.metadata ?? {};
          const fname = meta.name ?? meta.filename;
          return mimeType === file.type && fname === file.name;
        });
      }
      return false;
    };

    const duplicateFiles = validFiles.filter(isDup);
    const uniqueFiles = validFiles.filter((file) => !isDup(file));

    if (invalidFiles.length > 0) {
      toast.error("You have pasted an invalid file type. Please paste a JPEG, PNG, GIF, WEBP image or a PDF.");
    }
    if (duplicateFiles.length > 0) {
      toast.error(`Duplicate file(s) detected: ${duplicateFiles.map((f) => f.name).join(", ")}. Each file can only be uploaded once per message.`);
    }
    if (uniqueFiles.length > 0) {
      const newBlocks = (await Promise.all(uniqueFiles.map(fileToContentBlock))).map(normalizeBlock);
      setContentBlocks((prev) => [...prev, ...newBlocks]);
    }
  };

  return {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks,
    dragOver,
    handlePaste,
  };
}
