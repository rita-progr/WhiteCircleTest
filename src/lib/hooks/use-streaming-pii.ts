'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type PIIItem,
  type TextSegment,
  scanForPII,
  splitTextWithPII,
  mergePIIItems,
} from '@/lib/pii-scanner';

interface UseStreamingPIIProps {
  text: string;
  isStreaming: boolean;
  debounceMs?: number;
  overlapChars?: number;
}

interface UseStreamingPIIResult {
  segments: TextSegment[];
  isScanning: boolean;
  piiCount: number;
}

export function useStreamingPII({
  text,
  isStreaming,
  debounceMs = 300,
  overlapChars = 50,
}: UseStreamingPIIProps): UseStreamingPIIResult {
  const [piiItems, setPiiItems] = useState<PIIItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const lastScannedLengthRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingScanRef = useRef(false);

  const performScan = useCallback(
    async (textToScan: string, isIncremental: boolean) => {
      console.log('[useStreamingPII] performScan called, isIncremental:', isIncremental, 'textLength:', textToScan.length);

      // Cancel any pending scan
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setIsScanning(true);

      try {
        let scanText: string;
        let offset: number;

        if (isIncremental && lastScannedLengthRef.current > overlapChars) {
          // Scan only new text with overlap
          offset = lastScannedLengthRef.current - overlapChars;
          scanText = textToScan.slice(offset);
        } else {
          // Full scan
          offset = 0;
          scanText = textToScan;
        }

        console.log('[useStreamingPII] Calling scanForPII with', scanText.length, 'chars');
        const newPiiItems = await scanForPII(scanText);
        console.log('[useStreamingPII] scanForPII returned', newPiiItems.length, 'items:', newPiiItems);

        // Check if scan was aborted
        if (abortControllerRef.current?.signal.aborted) {
          console.log('[useStreamingPII] Scan was aborted');
          return;
        }

        if (isIncremental && offset > 0) {
          // Merge with existing items
          setPiiItems((existing) => mergePIIItems(existing, newPiiItems, offset));
        } else {
          console.log('[useStreamingPII] Setting piiItems to', newPiiItems);
          setPiiItems(newPiiItems);
        }

        lastScannedLengthRef.current = textToScan.length;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('[useStreamingPII] Error:', error);
      } finally {
        setIsScanning(false);
        pendingScanRef.current = false;
      }
    },
    [overlapChars]
  );

  // Handle streaming updates with debounce
  useEffect(() => {
    console.log('[useStreamingPII] useEffect triggered, text length:', text?.length, 'isStreaming:', isStreaming);

    if (!text) {
      console.log('[useStreamingPII] No text, resetting');
      setPiiItems([]);
      lastScannedLengthRef.current = 0;
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (isStreaming) {
      // During streaming: debounced incremental scan
      console.log('[useStreamingPII] Streaming mode, setting debounce timer');
      pendingScanRef.current = true;
      debounceTimerRef.current = setTimeout(() => {
        performScan(text, true);
      }, debounceMs);
    } else {
      // Streaming finished: perform final scan
      console.log('[useStreamingPII] Not streaming, lastScannedLength:', lastScannedLengthRef.current, 'pendingScan:', pendingScanRef.current);
      if (text.length !== lastScannedLengthRef.current || pendingScanRef.current) {
        console.log('[useStreamingPII] Triggering final scan');
        performScan(text, false);
      }
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [text, isStreaming, debounceMs, performScan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Generate segments from text and PII items
  const segments = splitTextWithPII(text, piiItems);

  return {
    segments,
    isScanning,
    piiCount: piiItems.length,
  };
}
