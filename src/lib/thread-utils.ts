import { Message, Thread } from "@langchain/langgraph-sdk";

// Types for better type safety
interface TextContentBlock {
  type: "text";
  text: string;
}

interface ImageContentBlock {
  type: "image" | "image_url";
  image_url?: { url: string };
  [key: string]: any;
}

interface FileContentBlock {
  type: "file";
  [key: string]: any;
}

type ContentBlock = TextContentBlock | ImageContentBlock | FileContentBlock;

// Type guard để kiểm tra text content
function isTextContent(item: any): item is TextContentBlock {
  return item && typeof item === 'object' && item.type === "text" && typeof item.text === "string";
}

export function generateThreadTitle(messages: Message[]): string {
  if (!messages || messages.length === 0) {
    return "New Chat";
  }

  // Lấy tin nhắn đầu tiên từ user
  const firstUserMessage = messages.find((msg: Message) => msg.type === "human");
  
  if (firstUserMessage && firstUserMessage.content) {
    let content = "";
    
    // Xử lý content array hoặc string
    if (Array.isArray(firstUserMessage.content)) {
      // Tìm content block đầu tiên có type là "text"
      const textContent = firstUserMessage.content.find((item: any) => isTextContent(item));
      if (textContent && isTextContent(textContent)) {
        content = textContent.text;
      }
    } else if (typeof firstUserMessage.content === "string") {
      content = firstUserMessage.content;
    }
    
    // Tạo tiêu đề từ nội dung
    if (content.trim()) {
      // Cắt xuống 50 ký tự và thêm "..." nếu cần
      const title = content.trim().substring(0, 50);
      return title.length < content.trim().length ? `${title}...` : title;
    }
  }
  
  return "New Chat";
}

export function getThreadDisplayTitle(thread: Thread): string {
  // Ưu tiên metadata.title nếu có
  if (
    thread.metadata &&
    typeof thread.metadata === 'object' &&
    'title' in thread.metadata &&
    typeof thread.metadata.title === 'string' &&
    thread.metadata.title !== thread.thread_id &&
    !thread.metadata.title.includes("Cuộc trò chuyện")
  ) {
    return thread.metadata.title;
  }

  // Nếu không có title hoặc title là default, tạo từ messages
  // Ép kiểu thread.values về any để tránh lỗi kiểu
  const valuesAny = thread.values as any;

  // Lấy messages nếu có
  const messages: Message[] | undefined = Array.isArray(valuesAny)
    // trường hợp values là mảng các record, tìm object có key 'messages'
    ? valuesAny.find((v: any) => v && Array.isArray(v.messages))?.messages
    // trường hợp values là object
    : valuesAny?.messages;

  if (messages && Array.isArray(messages)) {
    return generateThreadTitle(messages);
  }

  // Fallback
  return "New Chat";
}
