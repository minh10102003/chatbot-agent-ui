import type { Base64ContentBlock } from "@langchain/core/messages";
import { toast } from "sonner";

/** Convert File -> base64 (loại bỏ tiền tố data:...) */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Tạo Base64ContentBlock cho image/PDF.
 * -> Trả về block có ĐỦ cả snake_case và camelCase để mọi UI/SDK đều hiểu.
 *    - source_type + source
 *    - mime_type + mimeType
 *    - metadata.name + metadata.filename
 */
export async function fileToContentBlock(file: File): Promise<Base64ContentBlock> {
  const supportedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const supportedFileTypes = [...supportedImageTypes, "application/pdf"];

  if (!supportedFileTypes.includes(file.type)) {
    toast.error(
      `Unsupported file type: ${file.type}. Supported types are: ${supportedFileTypes.join(", ")}`
    );
    return Promise.reject(new Error(`Unsupported file type: ${file.type}`));
  }

  const data = await fileToBase64(file);

  if (supportedImageTypes.includes(file.type)) {
    // Image block
    const block: any = {
      type: "image",
      // snake_case
      source_type: "base64",
      mime_type: file.type,
      // camelCase (để ContentBlocksPreview nhận ra)
      source: "base64",
      mimeType: file.type,
      data,
      metadata: {
        name: file.name,
        filename: file.name,
      },
    };
    return block as unknown as Base64ContentBlock;
  }

  // PDF block
  const pdf: any = {
    type: "file",
    // snake_case
    source_type: "base64",
    mime_type: "application/pdf",
    // camelCase
    source: "base64",
    mimeType: "application/pdf",
    data,
    metadata: {
      filename: file.name,
      name: file.name,
    },
  };
  return pdf as unknown as Base64ContentBlock;
}

/**
 * Type guard: chấp nhận cả snake_case & camelCase
 */
export function isBase64ContentBlock(block: unknown): block is Base64ContentBlock {
  if (typeof block !== "object" || block === null) return false;
  const b = block as any;
  if (b.type !== "image" && b.type !== "file") return false;

  const source = b.source ?? b.source_type;
  const mime = b.mimeType ?? b.mime_type;

  if (source !== "base64") return false;
  if (typeof mime !== "string") return false;

  if (b.type === "image") return mime.startsWith("image/");
  if (b.type === "file") return mime === "application/pdf";
  return false;
}
