// src/lib/thread-utils.ts
import { Message, Thread } from "@langchain/langgraph-sdk";

/** ---- Type guards cho content blocks ---- */
type TextBlock = { type: "text"; text: string };

function isTextBlock(x: unknown): x is TextBlock {
  return (
    !!x &&
    typeof x === "object" &&
    (x as any).type === "text" &&
    typeof (x as any).text === "string"
  );
}

/** Lấy text an toàn từ Message["content"] (string | array blocks | unknown) */
export function textFromContent(c: unknown): string {
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) {
    const blk = c.find(isTextBlock);
    if (blk) return blk.text.trim();
  }
  return "";
}

/** Sinh tiêu đề ngắn gọn từ mảng messages (ưu tiên human message đầu tiên) */
export function makeTitleFromMessages(
  messages: Message[] | undefined,
  max = 50
): string {
  if (!Array.isArray(messages) || messages.length === 0) return "New Chat";
  const firstHuman = messages.find((m) => m?.type === "human");
  const text = textFromContent(firstHuman?.content);
  if (!text) return "New Chat";
  const t = text.slice(0, max);
  return t.length < text.length ? `${t}…` : t;
}

/**
 * Lấy title để hiển thị cho một Thread.
 * - Ưu tiên metadata.title (nếu có)
 * - Nếu không, thử suy ra từ messages trong thread.values
 * - Cuối cùng fallback "New Chat"
 */
export function getThreadDisplayTitle(thread: Thread): string {
  const metaTitle = (thread.metadata as any)?.title;
  if (typeof metaTitle === "string" && metaTitle.trim()) {
    return metaTitle.trim();
  }

  // Thử lấy messages từ thread.values (tùy server sẽ có/không)
  const valuesAny = (thread as any).values;
  let messages: Message[] | undefined;

  if (Array.isArray(valuesAny)) {
    messages = valuesAny.find(
      (v: any) => v && Array.isArray(v.messages)
    )?.messages as Message[] | undefined;
  } else if (valuesAny && Array.isArray(valuesAny.messages)) {
    messages = valuesAny.messages as Message[];
  }

  return makeTitleFromMessages(messages);
}

/** alias để tương thích code cũ nếu có */
export const generateThreadTitle = makeTitleFromMessages;
