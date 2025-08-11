// src/lib/namer.ts
import { type Message } from "@langchain/langgraph-sdk";

interface NamerConfig {
  apiUrl: string;
  apiKey: string | null;
  assistantId: string;
}

interface NamerInput {
  initial_message: string;
  thread_name?: string; // This will be empty/null to request generation
}

interface NamerResponse {
  thread_name: string;
}

/**
 * Generate thread name using LangGraph namer assistant
 * This calls the specific namer graph that expects both initial_message and thread_name inputs
 */
export async function generateThreadName(
  config: NamerConfig,
  initialMessage: string
): Promise<string | null> {
  try {
    console.log('[LangGraphNamer] Calling namer with config:', {
      apiUrl: config.apiUrl,
      assistantId: config.assistantId,
      hasApiKey: !!config.apiKey,
      messageLength: initialMessage.length
    });

    // Prepare the input that matches your LangGraph namer schema
    const namerInput: NamerInput = {
      initial_message: initialMessage.trim(),
      thread_name: "" // Empty to request generation
    };

    const response = await fetch(`${config.apiUrl}/runs/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'X-Api-Key': config.apiKey }),
      },
      body: JSON.stringify({
        assistant_id: config.assistantId,
        input: namerInput,
        stream_mode: ['values'], // Get the final values
        config: {
          configurable: {}
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Process the streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    let finalResult: any = null;
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Look for the final result with thread_name
              if (data && typeof data === 'object') {
                if (data.thread_name) {
                  finalResult = data;
                }
                // Also check if it's nested in other structures
                else if (data.output && data.output.thread_name) {
                  finalResult = data.output;
                }
                else if (data.return_values && data.return_values.thread_name) {
                  finalResult = data.return_values;
                }
              }
            } catch (parseError) {
              console.debug('[LangGraphNamer] Failed to parse chunk:', parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (finalResult?.thread_name) {
      const generatedName = finalResult.thread_name.trim();
      console.log('[LangGraphNamer] Success:', generatedName);
      return generatedName;
    } else {
      console.warn('[LangGraphNamer] No thread_name in final result:', finalResult);
      return null;
    }

  } catch (error) {
    console.error('[LangGraphNamer] Error:', error);
    return null;
  }
}

/**
 * Alternative approach using the direct invoke API (non-streaming)
 * Use this if the streaming approach doesn't work with your namer graph
 */
export async function generateThreadNameDirect(
  config: NamerConfig,
  initialMessage: string
): Promise<string | null> {
  try {
    console.log('[LangGraphNamerDirect] Calling namer directly');

    const namerInput: NamerInput = {
      initial_message: initialMessage.trim(),
      thread_name: "" // Empty to request generation
    };

    const response = await fetch(`${config.apiUrl}/runs/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'X-Api-Key': config.apiKey }),
      },
      body: JSON.stringify({
        assistant_id: config.assistantId,
        input: namerInput,
        config: {
          configurable: {}
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[LangGraphNamerDirect] Result:', result);

    // Extract thread_name from various possible response structures
    let threadName: string | null = null;
    
    if (result.thread_name) {
      threadName = result.thread_name;
    } else if (result.output?.thread_name) {
      threadName = result.output.thread_name;
    } else if (result.return_values?.thread_name) {
      threadName = result.return_values.thread_name;
    } else if (result.response?.thread_name) {
      threadName = result.response.thread_name;
    }

    if (threadName) {
      console.log('[LangGraphNamerDirect] Success:', threadName);
      return threadName.trim();
    } else {
      console.warn('[LangGraphNamerDirect] No thread_name found in result:', result);
      return null;
    }

  } catch (error) {
    console.error('[LangGraphNamerDirect] Error:', error);
    return null;
  }
}

/**
 * Smart namer that tries both approaches
 */
export async function generateThreadNameSmart(
  config: NamerConfig,
  initialMessage: string
): Promise<string | null> {
  // Try streaming first (matches your main chat flow)
  let result = await generateThreadName(config, initialMessage);
  
  if (!result) {
    console.log('[SmartNamer] Streaming failed, trying direct invoke...');
    // Fallback to direct invoke
    result = await generateThreadNameDirect(config, initialMessage);
  }
  
  return result;
}