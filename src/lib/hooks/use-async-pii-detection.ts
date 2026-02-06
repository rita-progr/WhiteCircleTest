import { useEffect, useRef, useState } from 'react';

interface PiiItem {
  text: string;
  type: string;
}

export function useAsyncPiiDetection(content: string, isStreaming: boolean) {
  const [asyncPiiItems, setAsyncPiiItems] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const lastCheckedContentRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Don't run if content hasn't changed significantly
    if (content.length - lastCheckedContentRef.current.length < 20 && isStreaming) {
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the API call
    debounceTimerRef.current = setTimeout(
      async () => {
        if (!content || content === lastCheckedContentRef.current) {
          return;
        }

        lastCheckedContentRef.current = content;
        setIsScanning(true);

        try {
          const response = await fetch('/api/detect-pii', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: content }),
          });

          const data = await response.json();
          console.log('🔍 Haiku API response:', data);
          if (data.debug) {
            console.log('🔍 Haiku raw output:', data.debug.raw);
          }
          if (data.error) {
            console.error('🔍 Haiku API error:', data.error);
          }
          const piiTexts = data.piiItems?.map((item: PiiItem) => item.text) || [];
          console.log('🔍 PII texts found:', piiTexts);
          setAsyncPiiItems(piiTexts);
        } catch (error) {
          console.error('Async PII detection error:', error);
        } finally {
          setIsScanning(false);
        }
      },
      isStreaming ? 200 : 100
    ); // Faster check when streaming stops
  }, [content, isStreaming]);

  return { asyncPiiItems, isScanning };
}
