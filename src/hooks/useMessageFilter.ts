// src/hooks/useMessageFilter.ts
import { useCallback } from "react";
import { useStreamContext } from "@/providers/Stream";
import { type Message } from "@langchain/langgraph-sdk";

type SafeAny = any;

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  originalContent?: string | Message["content"];
  sentContent?: string | Message["content"];
}

interface SimpleFilterSettings {
  [key: string]: SafeAny;
}

interface TitleResult {
  title: string;
  generated: boolean;
  error?: string;
}

const useMessageFilter = () => {
  const { messageFilter, sendFilteredMessage } = useStreamContext();

  // ✅ Cho phép gửi string HOẶC mảng content blocks (Message["content"])
  const filterAndSend = useCallback(
    async (
      content: string | Message["content"],
      options?: { context?: Record<string, unknown> }
    ): Promise<SendResult> => {
      console.log("[filterAndSend] called with:", content);

      try {
        // Hợp lệ nếu là string hoặc là mảng block
        const isString = typeof content === "string";
        const isBlocksArray = Array.isArray(content);

        if (!isString && !isBlocksArray) {
          return { success: false, error: "Invalid content type", originalContent: content };
        }

        if (!sendFilteredMessage) {
          return { success: false, error: "Stream context not available", originalContent: content };
        }

        // Gửi thẳng xuống Stream.sendFilteredMessage (đã hỗ trợ auto-text cho file only)
        await sendFilteredMessage(content as any, options);

        return {
          success: true,
          originalContent: content,
          sentContent: content,
          messageId: `msg_${Date.now()}`,
        };
      } catch (error: SafeAny) {
        console.error("[filterAndSend] error:", error);
        return {
          success: false,
          error: error?.message || "Unknown error",
          originalContent: content,
        };
      }
    },
    [sendFilteredMessage]
  );

  // Preview filter cho TEXT (không áp dụng cho blocks)
  const previewFilter = useCallback(
    (content: string): SafeAny => {
      try {
        if (!messageFilter?.filterMessage) {
          return { content, error: "Filter not available" };
        }
        const result = messageFilter.filterMessage(content);
        return result;
      } catch (error: SafeAny) {
        return { content, error: error?.message || "Filter error" };
      }
    },
    [messageFilter]
  );

  const getFilteredHistory = useCallback(
    (messages: Message[]): Message[] => {
      try {
        if (!Array.isArray(messages) || !messageFilter?.filterMessagesForBackend) {
          return messages;
        }
        return messageFilter.filterMessagesForBackend(messages);
      } catch (error: SafeAny) {
        console.error("getFilteredHistory error:", error);
        return messages;
      }
    },
    [messageFilter]
  );

  const generateTitle = useCallback(
    async (messages: Message[]): Promise<TitleResult> => {
      try {
        if (!Array.isArray(messages) || messages.length === 0) {
          return { title: "New Conversation", generated: false };
        }
        if (!messageFilter?.generateThreadTitle) {
          return { title: "New Conversation", generated: false };
        }
        const result = await messageFilter.generateThreadTitle(messages);
        return { title: result || "New Conversation", generated: !!result };
      } catch (error: SafeAny) {
        return {
          title: "New Conversation",
          generated: false,
          error: error?.message || "Title generation failed",
        };
      }
    },
    [messageFilter]
  );

  const updateFilterSettings = useCallback(
    (settings: SimpleFilterSettings): boolean => {
      try {
        if (!messageFilter?.updateFilter) return false;
        messageFilter.updateFilter(settings);
        return true;
      } catch (error: SafeAny) {
        console.error("updateFilterSettings error:", error);
        return false;
      }
    },
    [messageFilter]
  );

  const updateTitleSettings = useCallback(
    (settings: SimpleFilterSettings): boolean => {
      try {
        if (!messageFilter?.updateTitleConfig) return false;
        messageFilter.updateTitleConfig(settings);
        return true;
      } catch (error: SafeAny) {
        console.error("updateTitleSettings error:", error);
        return false;
      }
    },
    [messageFilter]
  );

  const isFilterAvailable = useCallback((): boolean => {
    return !!(messageFilter && messageFilter.filterMessage);
  }, [messageFilter]);

  const isSendAvailable = useCallback((): boolean => {
    return typeof sendFilteredMessage === "function";
  }, [sendFilteredMessage]);

  const getFilterStats = useCallback(() => {
    try {
      const methods: string[] = [];
      if (messageFilter) {
        const filterService = messageFilter as Record<string, any>;
        ["filterMessage", "filterMessagesForBackend", "generateThreadTitle"].forEach((name) => {
          if (typeof filterService[name] === "function") methods.push(name);
        });
      }
      return {
        available: isFilterAvailable(),
        sendAvailable: isSendAvailable(),
        hasFilter: !!messageFilter,
        filterMethods: methods,
      };
    } catch (error: SafeAny) {
      return {
        available: false,
        sendAvailable: false,
        hasFilter: false,
        filterMethods: [],
      };
    }
  }, [messageFilter, isFilterAvailable, isSendAvailable]);

  const debugFilter = useCallback(
    (content: string): void => {
      console.group("🔍 Message Filter Debug");
      console.log("Input:", content);
      console.log("Stats:", getFilterStats());
      try {
        const result = previewFilter(content);
        console.log("Filter result:", result);
      } catch (error: SafeAny) {
        console.log("Filter error:", error);
      }
      console.groupEnd();
    },
    [previewFilter, getFilterStats]
  );

  return {
    filterAndSend,
    previewFilter,
    getFilteredHistory,
    generateTitle,
    updateFilterSettings,
    updateTitleSettings,
    isFilterAvailable,
    isSendAvailable,
    getFilterStats,
    debugFilter,
    messageFilter,
  };
};

export type { SendResult, TitleResult };
export default useMessageFilter;
