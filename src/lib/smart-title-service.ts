// lib/smart-title-service.ts
interface TitleCache {
  [messageHash: string]: {
    title: string;
    timestamp: number;
  };
}

class SmartTitleService {
  private cache: TitleCache = {};
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 giờ
  private pendingRequests = new Map<string, Promise<string>>();

  // Tạo hash từ message để làm key cache
  private hashMessage(message: string): string {
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  // Kiểm tra cache có hợp lệ không
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  // Phân loại tin nhắn dựa trên patterns
  private categorizeMessage(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    const patterns = [
      // Development & Programming
      { regex: /(tạo|viết|làm|build|create).*(website|web|site)/i, category: 'Tạo website' },
      { regex: /(code|coding|lập trình|viết code).*(react|vue|angular|javascript|typescript)/i, category: 'Lập trình Frontend' },
      { regex: /(code|coding|lập trình|viết code).*(python|java|c\+\+|c#|php|ruby)/i, category: 'Lập trình Backend' },
      { regex: /(api|backend|server|database)/i, category: 'Backend Development' },
      { regex: /(component|ui|giao diện|interface)/i, category: 'UI Component' },
      
      // Data & Analysis
      { regex: /(phân tích|analyze).*(dữ liệu|data)/i, category: 'Phân tích dữ liệu' },
      { regex: /(chart|biểu đồ|visualization|dashboard)/i, category: 'Trực quan hóa dữ liệu' },
      { regex: /(excel|csv|spreadsheet|bảng tính)/i, category: 'Xử lý dữ liệu' },
      
      // Design & UI/UX
      { regex: /(thiết kế|design).*(ui|ux|giao diện)/i, category: 'Thiết kế UI/UX' },
      { regex: /(logo|brand|thương hiệu)/i, category: 'Thiết kế thương hiệu' },
      { regex: /(layout|bố cục|responsive)/i, category: 'Thiết kế layout' },
      
      // Marketing & Business
      { regex: /(seo|marketing|quảng cáo|advertisement)/i, category: 'Marketing & SEO' },
      { regex: /(email|newsletter|chiến dịch)/i, category: 'Email Marketing' },
      { regex: /(content|nội dung|blog|article)/i, category: 'Content Marketing' },
      
      // Learning & Tutorial
      { regex: /(học|learning|tutorial|hướng dẫn|guide)/i, category: 'Học tập & Hướng dẫn' },
      { regex: /(giải thích|explain|how to|làm sao)/i, category: 'Giải thích & Hướng dẫn' },
      
      // Problem Solving
      { regex: /(debug|fix|sửa lỗi|error|bug)/i, category: 'Debug & Sửa lỗi' },
      { regex: /(tối ưu|optimize|performance|cải thiện)/i, category: 'Tối ưu hóa' },
      { regex: /(help|giúp|support|hỗ trợ)/i, category: 'Hỗ trợ & Giải đáp' },
      
      // AI & Tools
      { regex: /(chatbot|ai|artificial intelligence|machine learning)/i, category: 'AI & Chatbot' },
      { regex: /(automation|tự động|script|tool)/i, category: 'Tự động hóa' },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(lowerMessage)) {
        return pattern.category;
      }
    }

    return '';
  }

  // Trích xuất từ khóa quan trọng
  private extractKeywords(text: string, limit: number = 3): string[] {
    const stopWords = new Set([
      'tôi', 'bạn', 'của', 'và', 'với', 'trong', 'là', 'có', 'được', 'để', 
      'cho', 'từ', 'này', 'đó', 'một', 'các', 'những', 'như', 'về', 'trên',
      'hãy', 'làm', 'thế', 'nào', 'gì', 'ai', 'đâu', 'khi', 'nào', 'sao',
      'help', 'please', 'can', 'you', 'me', 'i', 'my', 'the', 'a', 'an'
    ]);
    
    const words = text
      .toLowerCase()
      .replace(/[^\w\sàáâãèéêìíòóôõùúăđĩũơưăạảấầẩẫậắằẳẵặẹẻẽềềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/g, '')
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !stopWords.has(word) &&
        !/^\d+$/.test(word)
      );
    
    // Ưu tiên từ kỹ thuật
    const techWords = words.filter(word => 
      /^(react|vue|angular|javascript|typescript|python|java|sql|api|website|app|code|data|design|ui|ux|seo|marketing)/.test(word)
    );
    
    if (techWords.length >= limit) {
      return techWords.slice(0, limit);
    }
    
    // Đếm tần suất từ
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([word]) => word);
  }

  // Tạo title thông minh từ AI (nếu cần)
  private async generateTitleFromAI(
    message: string,
    apiUrl: string,
    apiKey?: string
  ): Promise<string> {
    try {
      const titlePrompt = `Tạo tiêu đề ngắn gọn (tối đa 6-8 từ) cho cuộc trò chuyện này bằng tiếng Việt. Tiêu đề nên súc tích và phản ánh mục đích chính:

"${message}"

Ví dụ tốt:
- "Tạo website bán hàng online"
- "Code React component"
- "Phân tích dữ liệu khách hàng"
- "Thiết kế logo công ty"
- "Debug lỗi JavaScript"

Chỉ trả về tiêu đề, không giải thích:`;

      const response = await fetch(`${apiUrl}/runs/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
        },
        body: JSON.stringify({
          assistant_id: "your_assistant_id", // Thay bằng assistant ID thực tế
          input: {
            messages: [{
              type: "human",
              content: titlePrompt
            }]
          },
          stream_mode: ["values"]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let title = "";
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.messages && data.messages.length > 0) {
                  const lastMessage = data.messages[data.messages.length - 1];
                  if (lastMessage.type === 'ai' && lastMessage.content) {
                    title = lastMessage.content;
                  }
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        }
      }

      const cleanTitle = title
        .replace(/["']/g, '')
        .replace(/^[-*•]\s*/, '') // Xóa bullet points
        .trim()
        .slice(0, 50);

      return cleanTitle || this.createFallbackTitle(message);
      
    } catch (error) {
      console.error('AI title generation failed:', error);
      return this.createFallbackTitle(message);
    }
  }

  // Tạo title fallback
  private createFallbackTitle(message: string): string {
    const keywords = this.extractKeywords(message, 3);
    if (keywords.length > 0) {
      return keywords.join(' ').replace(/^\w/, c => c.toUpperCase());
    }
    
    const snippet = message.length > 30 
      ? message.slice(0, 30).trim() + "…" 
      : message.trim();
      
    return snippet || `Đoạn chat ${new Date().toLocaleTimeString()}`;
  }

  // Hàm chính để tạo smart title
  async generateSmartTitle(
    message: string,
    apiUrl: string,
    apiKey?: string,
    useAI: boolean = false // Có dùng AI hay chỉ dùng pattern matching
  ): Promise<string> {
    const messageHash = this.hashMessage(message);
    
    // Kiểm tra cache
    const cached = this.cache[messageHash];
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.title;
    }

    // Kiểm tra pending requests
    const pendingRequest = this.pendingRequests.get(messageHash);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Tạo title mới
    const titlePromise = this.generateTitle(message, apiUrl, apiKey, useAI);
    this.pendingRequests.set(messageHash, titlePromise);

    try {
      const title = await titlePromise;
      
      // Lưu cache
      this.cache[messageHash] = {
        title,
        timestamp: Date.now()
      };
      
      return title;
    } finally {
      this.pendingRequests.delete(messageHash);
    }
  }

  // Logic tạo title
  private async generateTitle(
    message: string,
    apiUrl: string,
    apiKey?: string,
    useAI: boolean = false
  ): Promise<string> {
    // 1. Thử pattern matching trước (nhanh và không tốn API)
    const category = this.categorizeMessage(message);
    if (category) {
      const keywords = this.extractKeywords(message, 2);
      if (keywords.length > 0) {
        return `${category}: ${keywords.join(' ')}`;
      }
      return category;
    }

    // 2. Nếu useAI = true và không match pattern, dùng AI
    if (useAI) {
      return this.generateTitleFromAI(message, apiUrl, apiKey);
    }

    // 3. Fallback với keywords
    return this.createFallbackTitle(message);
  }

  // Xóa cache cũ
  public cleanupCache(): void {
    const now = Date.now();
    Object.keys(this.cache).forEach(key => {
      if (!this.isCacheValid(this.cache[key].timestamp)) {
        delete this.cache[key];
      }
    });
  }
}

// Export singleton
export const smartTitleService = new SmartTitleService();

// Helper function dễ sử dụng
export async function generateChatTitle(
  message: string,
  apiUrl: string,
  apiKey?: string,
  options?: {
    useAI?: boolean; // Có dùng AI không (mặc định false)
    forceNew?: boolean; // Bỏ qua cache (mặc định false)
  }
): Promise<string> {
  if (options?.forceNew) {
    // Xóa cache cho message này
    const hash = smartTitleService['hashMessage'](message);
    delete smartTitleService['cache'][hash];
  }
  
  return smartTitleService.generateSmartTitle(
    message, 
    apiUrl, 
    apiKey, 
    options?.useAI ?? false
  );
}