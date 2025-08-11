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
  public titleConfig: ThreadTitleConfig; // Make public for external access

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

  // 🎯 Enhanced Thread Title Generation (LOCAL FALLBACK ONLY)
  // This method is now used as fallback when LangGraph namer is not available
  generateThreadTitle(messages: Message[]): string {
    console.log('[generateThreadTitle] LOCAL FALLBACK - messages count:', messages.length);
    
    if (!this.titleConfig.enabled || !messages.length) {
      return this.getFallbackTitle();
    }

    // Tìm message human đầu tiên
    const firstHuman = messages.find(
      (msg) => msg.type === "human" && (typeof msg.content === "string" || Array.isArray(msg.content))
    );
    
    if (!firstHuman) {
      console.log('[generateThreadTitle] no human message found');
      return this.getFallbackTitle();
    }

    // Extract text từ content
    const text = this.extractTextFromContent(firstHuman.content);
    if (!text) {
      console.log('[generateThreadTitle] no text extracted');
      return this.getFallbackTitle();
    }

    // Generate smart title
    const smartTitle = this.generateSmartTitle(text);
    console.log('[generateThreadTitle] LOCAL generated title:', smartTitle);
    
    return smartTitle;
  }

  // 🔍 Extract text từ Message content (string hoặc array blocks)
  private extractTextFromContent(content: any): string {
    if (typeof content === "string") {
      return content.trim();
    } 
    
    if (Array.isArray(content)) {
      return content
        .filter((c: any) => c.type === "text" && typeof c.text === "string")
        .map((c: any) => c.text)
        .join(" ")
        .trim();
    }
    
    return "";
  }

  // 🎨 Generate smart title với rules (LOCAL LOGIC)
  private generateSmartTitle(text: string): string {
    // Clean up text
    const cleaned = text.replace(/\s+/g, " ").trim();
    
    // Apply smart naming rules
    let title = this.applyNamingRules(cleaned);
    
    // Ensure within length limits
    if (title.length > this.titleConfig.maxLength) {
      title = title.substring(0, this.titleConfig.maxLength);
      
      // Don't cut in middle of word
      const lastSpace = title.lastIndexOf(" ");
      if (lastSpace > this.titleConfig.maxLength * 0.7) {
        title = title.substring(0, lastSpace);
      }
      
      title += "...";
    }
    
    return title || this.getFallbackTitle();
  }

  // 🧠 Apply smart naming rules (LOCAL PATTERNS)
  private applyNamingRules(text: string): string {
    const lowerText = text.toLowerCase();
    
    // Greeting detection
    if (this.isGreeting(lowerText)) {
      return this.formatGreeting(text);
    }
    
    // Question detection
    if (this.isQuestion(text)) {
      return this.formatQuestion(text);
    }
    
    // Help/Task request detection
    if (this.isHelpRequest(lowerText)) {
      return this.formatHelpRequest(text);
    }
    
    // Problem/Error detection
    if (this.isProblem(lowerText)) {
      return this.formatProblem(text);
    }
    
    // Task/Creation detection
    if (this.isTaskRequest(lowerText)) {
      return this.formatTaskRequest(text);
    }
    
    // Default: extract key phrases
    return this.extractKeyPhrases(text);
  }

  // 👋 Greeting detection và formatting
  private isGreeting(lowerText: string): boolean {
    const greetings = [
      "hello", "hi", "hey", "good morning", "good afternoon", "good evening",
      "xin chào", "chào", "chào bạn"
    ];
    return greetings.some(greeting => lowerText.startsWith(greeting));
  }

  private formatGreeting(text: string): string {
    // Extract what comes after greeting
    const afterGreeting = text
      .replace(/^(hello|hi|hey|good morning|good afternoon|good evening|xin chào|chào|chào bạn)[,\s]*/i, "")
      .trim();
    return afterGreeting ? `Greeting: ${afterGreeting}` : "Greeting";
  }

  // ❓ Question detection và formatting
  private isQuestion(text: string): boolean {
    const questionStarters = [
      "what", "how", "why", "when", "where", "who", "which", 
      "can you", "could you", "would you", "do you", "will you",
      "là gì", "như thế nào", "tại sao", "khi nào", "ở đâu", "ai", "cái nào"
    ];
    const lowerText = text.toLowerCase();
    return text.includes("?") || questionStarters.some(starter => lowerText.startsWith(starter));
  }

  private formatQuestion(text: string): string {
    // Remove question words and clean up
    const cleaned = text
      .replace(/^(what|how|why|when|where|who|which|can you|could you|would you|do you|will you)\s+/i, "")
      .replace(/^(là gì|như thế nào|tại sao|khi nào|ở đâu|ai|cái nào)\s*/i, "")
      .replace(/\?$/, "")
      .trim();
    const keyPhrases = this.extractKeyPhrases(cleaned);
    return keyPhrases ? `Question: ${keyPhrases}` : "Question";
  }

  // 🆘 Help request detection và formatting
  private isHelpRequest(lowerText: string): boolean {
    const helpPatterns = [
      "help", "assist", "guide", "show me", "teach me", "explain", "how to",
      "giúp", "hướng dẫn", "chỉ tôi", "dạy tôi", "giải thích"
    ];
    return helpPatterns.some(pattern => lowerText.includes(pattern));
  }

  private formatHelpRequest(text: string): string {
    // Extract the topic after help request
    const topic = text
      .replace(/^(help|assist|guide|show me|teach me|explain|how to)\s*(me\s*)?(with\s*)?/i, "")
      .replace(/^(giúp|hướng dẫn|chỉ tôi|dạy tôi|giải thích)\s*(tôi\s*)?(về\s*)?/i, "")
      .trim();
    const keyPhrases = this.extractKeyPhrases(topic || text);
    return keyPhrases ? `Help: ${keyPhrases}` : "Help Request";
  }

  // 🐛 Problem detection và formatting
  private isProblem(lowerText: string): boolean {
    const problemWords = [
      "error", "bug", "issue", "problem", "trouble", "not working", "broken", "fix",
      "lỗi", "sự cố", "vấn đề", "không hoạt động", "hỏng", "sửa"
    ];
    return problemWords.some(word => lowerText.includes(word));
  }

  private formatProblem(text: string): string {
    const keyPhrases = this.extractKeyPhrases(text);
    return keyPhrases ? `Problem: ${keyPhrases}` : "Problem";
  }

  // 📝 Task/Creation request detection
  private isTaskRequest(lowerText: string): boolean {
    const taskWords = [
      "write", "create", "make", "build", "generate", "design", "develop", "code",
      "viết", "tạo", "làm", "xây dựng", "thiết kế", "phát triển", "lập trình"
    ];
    return taskWords.some(word => lowerText.startsWith(word) || lowerText.includes(`${word} `));
  }

  private formatTaskRequest(text: string): string {
    const keyPhrases = this.extractKeyPhrases(text);
    return keyPhrases ? `Task: ${keyPhrases}` : "Task Request";
  }

  // 🔤 Extract key phrases từ text
  private extractKeyPhrases(text: string): string {
    // Simple keyword extraction
    const words = text.split(/\s+/).filter(word => word.length > 2);
    
    // Remove common stop words
    const stopWords = new Set([
      "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one", 
      "our", "had", "but", "words", "use", "each", "which", "their", "said", "many", 
      "them", "these", "some", "would", "into", "has", "more", "two", "like", "him", 
      "time", "very", "when", "come", "its", "now", "find", "long", "down", "day", "get",
      "may", "way", "been", "call", "who", "did", "part", "over", "new", "sound", "take",
      "only", "little", "work", "know", "place", "year", "live", "back", "give", "most",
      "very", "after", "thing", "why", "ask", "went", "men", "read", "need", "land",
      "different", "home", "move", "try", "kind", "hand", "picture", "again", "change",
      "off", "play", "spell", "air", "away", "animal", "house", "point", "page", "letter",
      "mother", "answer", "found", "study", "still", "learn", "should", "america", "world"
    ]);
    
    const keywords = words
      .filter(word => !stopWords.has(word.toLowerCase()))
      .slice(0, 4) // Max 4 keywords
      .join(" ");
      
    return keywords || text.split(" ").slice(0, 3).join(" ");
  }

  // 🔧 Content sanitization
  private sanitizeContent(content: string): string {
    return content
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[^^\w\s.,!?;:()\-\u00C0-\u017F\u1EA0-\u1EF9]/g, "");
  }

  // 📝 Fallback title generation
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

  // 🔄 Update filter settings
  updateFilter(newFilter: Partial<MessageFilter>): void {
    this.filter = { ...this.filter, ...newFilter };
    console.log('[MessageFilterService] filter updated to:', this.filter);
  }

  // 🔄 Update title configuration
  updateTitleConfig(newConfig: Partial<ThreadTitleConfig>): void {
    this.titleConfig = { ...this.titleConfig, ...newConfig };
    console.log('[MessageFilterService] titleConfig updated to:', this.titleConfig);
    
    // Log AI naming status change
    if ('useAI' in newConfig) {
      console.log(`[MessageFilterService] AI naming ${newConfig.useAI ? 'ENABLED' : 'DISABLED'}`);
    }
  }

  // 🎯 NEW: Check if AI naming is enabled
  get isAINamingEnabled(): boolean {
    return this.titleConfig.useAI !== false;
  }

  // 🎯 NEW: Get current naming strategy
  get namingStrategy(): 'ai-first' | 'local-only' {
    return this.isAINamingEnabled ? 'ai-first' : 'local-only';
  }
}