// src/hooks/use-file-upload.tsx
import { useState, useRef, useEffect, ChangeEvent, ClipboardEvent } from "react";
import { toast } from "sonner";
import type { Base64ContentBlock } from "@langchain/core/messages";
import { fileToContentBlock } from "@/lib/multimodal-utils";
import { parseCsv } from "@/lib/csv";

/**
 * Kiểu riêng để chứa cả block ảnh/pdf (Base64ContentBlock)
 * và block văn bản CSV đã parse.
 */
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
  "text/csv", // hỗ trợ CSV
];

interface UseFileUploadOptions {
  initialBlocks?: ChatContentBlock[];
}

/**
 * Hook quản lý upload file (image/pdf) và CSV,
 * trả về mảng contentBlocks để đính kèm vào tin nhắn.
 */
export function useFileUpload({
  initialBlocks = [],
}: UseFileUploadOptions = {}) {
  const [contentBlocks, setContentBlocks] = useState<ChatContentBlock[]>(initialBlocks);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  /**
   * Kiểm tra file image/pdf đã upload trùng hay chưa.
   */
  const isDuplicate = (file: File, blocks: ChatContentBlock[]): boolean => {
    if (file.type === "application/pdf") {
      return blocks.some((b) =>
        b.type === "file"
        && (b as Base64ContentBlock).mime_type === "application/pdf"
        && (b as Base64ContentBlock).metadata?.filename === file.name
      );
    }
    if (SUPPORTED_FILE_TYPES.includes(file.type) && file.type !== "text/csv") {
      return blocks.some((b) =>
        b.type === "image"
        && (b as Base64ContentBlock).mime_type === file.type
        && (b as Base64ContentBlock).metadata?.name === file.name
      );
    }
    return false;
  };

  /**
   * Xử lý khi user chọn file qua input[type=file].
   */
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((f) => SUPPORTED_FILE_TYPES.includes(f.type));
    const invalidFiles = fileArray.filter((f) => !SUPPORTED_FILE_TYPES.includes(f.type));
    if (invalidFiles.length > 0) {
      toast.error(`Unsupported file type(s): ${invalidFiles.map((f) => f.name).join(", ")}`);
    }

    // Tách CSV và media
    const csvFiles = validFiles.filter((f) => f.type === "text/csv");
    const mediaFiles = validFiles.filter((f) => f.type !== "text/csv");

    // Lọc duplicate trong media
    const uniqueMedia = mediaFiles.filter((file) => !isDuplicate(file, contentBlocks));
    const duplicateMedia = mediaFiles.filter((file) => isDuplicate(file, contentBlocks));
    if (duplicateMedia.length > 0) {
      toast.error(`Duplicate file(s): ${duplicateMedia.map((f) => f.name).join(", ")}`);
    }

    // Parse CSV -> TextContentBlock
    const csvBlocks: TextContentBlock[] = (
      await Promise.all(csvFiles.map(async (file) => {
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
      }))
    ).filter((b): b is TextContentBlock => b !== null);

    // Chuyển media thành Base64ContentBlock
    const mediaBlocks: Base64ContentBlock[] = uniqueMedia.length > 0
      ? await Promise.all(uniqueMedia.map(fileToContentBlock))
      : [];

    // Cập nhật state
    setContentBlocks((prev) => [...prev, ...mediaBlocks, ...csvBlocks]);
    e.target.value = "";
  };

  /**
   * Xử lý drag & drop vào phần tử dropRef.
   */
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

      const mediaBlocks2: Base64ContentBlock[] = uniqueMedia2.length > 0
        ? await Promise.all(uniqueMedia2.map(fileToContentBlock))
        : [];
      const csvBlocks2: TextContentBlock[] = (
        await Promise.all(csvFiles2.map(async (file) => {
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
        }))
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

  /**
   * Xóa block theo index.
   */
  const removeBlock = (idx: number) => {
    setContentBlocks((prev) => prev.filter((_, i) => i !== idx));
  };

  /**
   * Xóa sạch tất cả block.
   */
  const resetBlocks = () => setContentBlocks([]);

  /**
   * Xử lý paste (có thể mở rộng parse CSV từ clipboard).
   */
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
    if (files.length === 0) {
      return;
    }
    e.preventDefault();
    const validFiles = files.filter((file) =>
      SUPPORTED_FILE_TYPES.includes(file.type),
    );
    const invalidFiles = files.filter(
      (file) => !SUPPORTED_FILE_TYPES.includes(file.type),
    );
    const isDuplicate = (file: File) => {
      if (file.type === "application/pdf") {
        return contentBlocks.some(
          (b) =>
            b.type === "file" &&
            b.mime_type === "application/pdf" &&
            b.metadata?.filename === file.name,
        );
      }
      if (SUPPORTED_FILE_TYPES.includes(file.type)) {
        return contentBlocks.some(
          (b) =>
            b.type === "image" &&
            b.metadata?.name === file.name &&
            b.mime_type === file.type,
        );
      }
      return false;
    };
    const duplicateFiles = validFiles.filter(isDuplicate);
    const uniqueFiles = validFiles.filter((file) => !isDuplicate(file));
    if (invalidFiles.length > 0) {
      toast.error(
        "You have pasted an invalid file type. Please paste a JPEG, PNG, GIF, WEBP image or a PDF.",
      );
    }
    if (duplicateFiles.length > 0) {
      toast.error(
        `Duplicate file(s) detected: ${duplicateFiles.map((f) => f.name).join(", ")}. Each file can only be uploaded once per message.`,
      );
    }
    if (uniqueFiles.length > 0) {
      const newBlocks = await Promise.all(uniqueFiles.map(fileToContentBlock));
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
