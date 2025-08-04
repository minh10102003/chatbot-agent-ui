// src/hooks/useStreamInspector.ts
import { useStreamContext } from "@/providers/Stream";

export const useStreamInspector = () => {
  const streamValue = useStreamContext();

  // Debug function to inspect available methods
  const inspectStream = () => {
    console.log('Available stream methods:');
    console.log('streamValue keys:', Object.keys(streamValue));
    
    // Check each property type
    Object.keys(streamValue).forEach(key => {
      const value = (streamValue as any)[key];
      console.log(`${key}:`, typeof value, value?.constructor?.name);
    });
  };

  return { inspectStream, streamValue };
};