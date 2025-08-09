// src/lib/message-filter.ts
import { type Message } from "@langchain/langgraph-sdk";
import {
  MessageFilter,
  FilteredMessage,
  ThreadTitleConfig,
  DEFAULT_MESSAGE_FILTER,
  DEFAULT_TITLE_CONFIG,
} from "@/types/message-filter";

export default class MessageFilterService {
  private filter: MessageFilter;
  private titleConfig: ThreadTitleConfig;

  constructor(
    filter: Partial<MessageFilter> = {},
    titleConfig: Partial<ThreadTitleConfig> = {}
  ) {
    this.filter = { ...DEFAULT_MESSAGE_FILTER, ...filter };
    this.titleConfig = { ...DEFAULT_TITLE_CONFIG, ...titleConfig };
  }

  // Lọc message trước khi gửi
  filterMessage(content: string): FilteredMessage {
    console.log('[filterMessage] called with content:', content);

    const reasons: string[] = [];
    let filtered = false;
    let processedContent = content;

    // Check length
    if (this.filter.minLength && content.length < this.filter.minLength) {
      reasons.push(`Too short (min: ${this.filter.minLength})`);
      filtered = true;
    }

    if (this.filter.maxLength && content.length > this.filter.maxLength) {
      processedContent = content.substring(0, this.filter.maxLength);
      reasons.push(`Truncated (max: ${this.filter.maxLength})`);
      filtered = true;
    }

    // Check blocked keywords
    if (this.filter.blockedKeywords?.length) {
      const hasBlocked = this.filter.blockedKeywords.some((keyword) =>
        content.toLowerCase().includes(keyword.toLowerCase())
      );
      if (hasBlocked) {
        reasons.push("Contains blocked keywords");
        filtered = true;
      }
    }

    // Content sanitization
    if (this.filter.enableContentSanitization) {
      const sanitized = this.sanitizeContent(processedContent);
      if (sanitized !== processedContent) {
        processedContent = sanitized;
        reasons.push("Content sanitized");
        filtered = true;
      }
    }

    const result = {
      content: processedContent,
      metadata: {
        originalLength: content.length,
        filtered,
        filterReasons: reasons.length > 0 ? reasons : undefined,
      },
    };
    console.log('[filterMessage] result:', result);
    return result;
  }

  // Lọc messages để gửi về BE
  filterMessagesForBackend(messages: Message[]): Message[] {
    console.log('[filterMessagesForBackend] called with messages count:', messages.length);
    return messages
      .filter((msg) => msg.type === "human" || msg.type === "ai")
      .map((msg) => {
        if (typeof msg.content === "string") {
          const filtered = this.filterMessage(msg.content);
          return { ...msg, content: filtered.content };
        }
        return msg;
      })
      .slice(-20);
  }

  // Generate thread title
  generateThreadTitle(messages: Message[]): string {
    if (!this.titleConfig.enabled || !messages.length) {
        return this.getFallbackTitle();
    }

    // Tìm message human đầu tiên
    const firstHuman = messages.find(
        (msg) => msg.type === "human" && (typeof msg.content === "string" || Array.isArray(msg.content))
    );
    if (!firstHuman) {
        return this.getFallbackTitle();
    }

    // Lấy raw content
    const raw = firstHuman.content;
    let text: string;
    if (typeof raw === "string") {
        text = raw;
    } else if (Array.isArray(raw)) {
        // Giả sử mỗi phần tử có dạng { type: "text"; text: string }
        text = raw
        .filter((c: any) => c.type === "text" && typeof c.text === "string")
        .map((c: any) => c.text)
        .join(" ");
    } else {
        text = "";
    }

    // Xử lý cắt xuống độ dài maxLength
    let title = text
        .trim()
        .replace(/\n/g, " ")
        .substring(0, this.titleConfig.maxLength);

    // Nếu cắt đúng maxLength, tránh cắt giữa từ
    if (title.length === this.titleConfig.maxLength) {
        const lastSpace = title.lastIndexOf(" ");
        if (lastSpace > this.titleConfig.maxLength * 0.7) {
        title = title.substring(0, lastSpace);
        }
    }

    return title || this.getFallbackTitle();
    }

  private sanitizeContent(content: string): string {
    return content
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[^^\w\s.,!?;:()\-\u00C0-\u017F\u1EA0-\u1EF9]/g, "");
  }

  private getFallbackTitle(): string {
    const template = this.titleConfig.fallbackTemplate ?? "Chat {{timestamp}}";
    const timestamp = new Date().toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return template.replace("{{timestamp}}", timestamp);
  }

  updateFilter(newFilter: Partial<MessageFilter>): void {
    this.filter = { ...this.filter, ...newFilter };
  }

  updateTitleConfig(newConfig: Partial<ThreadTitleConfig>): void {
    this.titleConfig = { ...this.titleConfig, ...newConfig };
    console.log('[MessageFilterService] titleConfig updated to:', this.titleConfig);
  }
}
