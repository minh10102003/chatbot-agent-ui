export interface MessageFilter {
  minLength?: number;
  maxLength?: number;
  allowedTypes?: string[];
  blockedKeywords?: string[];
  enableContentSanitization?: boolean;
}

export interface FilteredMessage {
  content: string;
  metadata: {
    originalLength: number;
    filtered: boolean;
    filterReasons?: string[];
  };
}

export interface ThreadTitleConfig {
  enabled: boolean;
  maxLength: number;
  fallbackTemplate: string;
  useAI: boolean;
}

export const DEFAULT_MESSAGE_FILTER: MessageFilter = {
  minLength: 1,
  maxLength: 4000,
  allowedTypes: ['text', 'image'],
  blockedKeywords: [],
  enableContentSanitization: true,
};

export const DEFAULT_TITLE_CONFIG: ThreadTitleConfig = {
  enabled: true,
  maxLength: 50,
  fallbackTemplate: 'Chat {{timestamp}}',
  useAI: false,
};
