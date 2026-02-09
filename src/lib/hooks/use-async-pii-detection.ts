import { useEffect, useRef, useState } from 'react';

interface PiiItem {
  text: string;
  type: string;
}

// djb2 hash: content → short string key for sessionStorage
function hashContent(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
  }
  return 'pii:' + (hash >>> 0).toString(36);
}

// L1: fast in-memory cache (cleared on module reload)
const l1Cache = new Map<string, string[]>();
const MAX_L1_SIZE = 100;
const MAX_SS_KEYS = 200;

function getCached(content: string): string[] | undefined {
  // L1 check
  const l1 = l1Cache.get(content);
  if (l1) return l1;

  // L2 check (sessionStorage)
  try {
    const stored = sessionStorage.getItem(hashContent(content));
    if (stored) {
      const parsed: string[] = JSON.parse(stored);
      // Promote to L1
      if (l1Cache.size >= MAX_L1_SIZE) {
        const firstKey = l1Cache.keys().next().value;
        if (firstKey !== undefined) l1Cache.delete(firstKey);
      }
      l1Cache.set(content, parsed);
      return parsed;
    }
  } catch {
    // SSR or sessionStorage unavailable — ignore
  }

  return undefined;
}

function setCache(content: string, piiTexts: string[]) {
  // L1
  if (l1Cache.size >= MAX_L1_SIZE) {
    const firstKey = l1Cache.keys().next().value;
    if (firstKey !== undefined) l1Cache.delete(firstKey);
  }
  l1Cache.set(content, piiTexts);

  // L2 (sessionStorage)
  try {
    // Count existing pii: keys; skip write if at limit
    let count = 0;
    for (let i = 0; i < sessionStorage.length; i++) {
      if (sessionStorage.key(i)?.startsWith('pii:')) count++;
    }
    if (count < MAX_SS_KEYS) {
      sessionStorage.setItem(hashContent(content), JSON.stringify(piiTexts));
    }
  } catch {
    // quota exceeded or SSR — ignore
  }
}

export function useAsyncPiiDetection(content: string, isStreaming: boolean) {
  const [asyncPiiItems, setAsyncPiiItems] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const lastCheckedContentRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to always have the latest content inside setTimeout callback
  const latestContentRef = useRef<string>(content);
  latestContentRef.current = content;

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!content || content === lastCheckedContentRef.current) {
      return;
    }

    // Check cache immediately
    const cached = getCached(content);
    if (cached) {
      lastCheckedContentRef.current = content;
      setAsyncPiiItems(cached);
      return;
    }

    if (isStreaming) {
      // STREAMING: don't reset existing timer — let it fire
      // Only schedule a new one if no timer is pending
      if (!debounceTimerRef.current) {
        debounceTimerRef.current = setTimeout(async () => {
          debounceTimerRef.current = null;
          // Use latestContentRef — freshest text at the moment timer fires
          const textToCheck = latestContentRef.current;

          if (!textToCheck || textToCheck === lastCheckedContentRef.current) return;

          const cachedResult = getCached(textToCheck);
          if (cachedResult) {
            lastCheckedContentRef.current = textToCheck;
            setAsyncPiiItems(cachedResult);
            return;
          }

          lastCheckedContentRef.current = textToCheck;
          setIsScanning(true);

          try {
            const response = await fetch('/api/detect-pii', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: textToCheck }),
            });
            const data = await response.json();
            if (data.error) console.error('Async PII detection API error:', data.error);
            const piiTexts = data.piiItems?.map((item: PiiItem) => item.text) || [];
            setCache(textToCheck, piiTexts);
            setAsyncPiiItems(piiTexts);
          } catch (error) {
            console.error('Async PII detection error:', error);
          } finally {
            setIsScanning(false);
          }
        }, 300);
      }
    } else {
      // NOT STREAMING: classic debounce — reset timer to check final text
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(async () => {
        debounceTimerRef.current = null;
        const textToCheck = latestContentRef.current;

        if (!textToCheck || textToCheck === lastCheckedContentRef.current) return;

        const cachedResult = getCached(textToCheck);
        if (cachedResult) {
          lastCheckedContentRef.current = textToCheck;
          setAsyncPiiItems(cachedResult);
          return;
        }

        lastCheckedContentRef.current = textToCheck;
        setIsScanning(true);

        try {
          const response = await fetch('/api/detect-pii', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textToCheck }),
          });
          const data = await response.json();
          if (data.error) console.error('Async PII detection API error:', data.error);
          const piiTexts = data.piiItems?.map((item: PiiItem) => item.text) || [];
          setCache(textToCheck, piiTexts);
          setAsyncPiiItems(piiTexts);
        } catch (error) {
          console.error('Async PII detection error:', error);
        } finally {
          setIsScanning(false);
        }
      }, 100);
    }
  }, [content, isStreaming]);

  return { asyncPiiItems, isScanning };
}
