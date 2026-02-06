'use client';

import { useMemo } from 'react';
import { detectPIIInstant, splitTextWithPII, type TextSegment } from '@/lib/pii-patterns';
import { useAsyncPiiDetection } from '@/lib/hooks/use-async-pii-detection';
import { Spoiler } from './spoiler';

interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant';
  isStreaming?: boolean;
}

/**
 * Parse <pii>...</pii> tags from LLM response
 */
function parsePIITags(content: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /<pii>([\s\S]*?)<\/pii>/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Text before tag
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    // PII content (without tags)
    segments.push({ type: 'pii', content: match[1] });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    segments.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content }];
}

/**
 * Apply regex fallback to text segments that weren't tagged by LLM
 */
function applyRegexFallback(segments: TextSegment[]): TextSegment[] {
  const result: TextSegment[] = [];

  for (const segment of segments) {
    if (segment.type === 'pii') {
      // Already marked as PII, keep it
      result.push(segment);
    } else {
      // Check for untagged PII using regex
      const piiItems = detectPIIInstant(segment.content);
      if (piiItems.length > 0) {
        const subSegments = splitTextWithPII(segment.content, piiItems);
        result.push(...subSegments);
      } else {
        result.push(segment);
      }
    }
  }

  return result;
}

/**
 * Apply async PII detection results to text segments
 */
function applyAsyncPii(segments: TextSegment[], asyncPiiItems: string[]): TextSegment[] {
  if (asyncPiiItems.length === 0) return segments;

  const result: TextSegment[] = [];

  for (const segment of segments) {
    if (segment.type === 'pii') {
      result.push(segment);
    } else {
      // Check if any async PII items are in this segment
      const currentText = segment.content;
      let hasAsyncPii = false;

      for (const piiText of asyncPiiItems) {
        if (currentText.includes(piiText)) {
          hasAsyncPii = true;
          break;
        }
      }

      if (hasAsyncPii) {
        // Split by async PII items
        const subSegments: TextSegment[] = [];
        let remaining = currentText;

        while (remaining.length > 0) {
          let earliestMatch: { text: string; index: number } | null = null;

          for (const piiText of asyncPiiItems) {
            const idx = remaining.indexOf(piiText);
            if (idx !== -1 && (earliestMatch === null || idx < earliestMatch.index)) {
              earliestMatch = { text: piiText, index: idx };
            }
          }

          if (earliestMatch) {
            if (earliestMatch.index > 0) {
              subSegments.push({ type: 'text', content: remaining.slice(0, earliestMatch.index) });
            }
            subSegments.push({ type: 'pii', content: earliestMatch.text });
            remaining = remaining.slice(earliestMatch.index + earliestMatch.text.length);
          } else {
            subSegments.push({ type: 'text', content: remaining });
            break;
          }
        }

        result.push(...subSegments);
      } else {
        result.push(segment);
      }
    }
  }

  return result;
}

export function ChatMessage({ content, role, isStreaming = false }: ChatMessageProps) {
  // Only scan assistant messages for PII
  const shouldScan = role === 'assistant';

  // Async PII detection with Haiku (runs in parallel)
  const { asyncPiiItems } = useAsyncPiiDetection(
    shouldScan ? content : '',
    isStreaming
  );

  const segments = useMemo(() => {
    if (!shouldScan || !content) {
      return [{ type: 'text' as const, content }];
    }

    console.log('🎯 ChatMessage asyncPiiItems:', asyncPiiItems);

    // First: parse LLM-tagged PII
    const taggedSegments = parsePIITags(content);

    // Second: apply regex fallback for any missed PII
    const withRegex = applyRegexFallback(taggedSegments);

    // Third: apply async Haiku detection results
    const final = applyAsyncPii(withRegex, asyncPiiItems);
    console.log('🎯 Final segments:', final);
    return final;
  }, [content, shouldScan, asyncPiiItems]);

  // For user messages, just render the content directly
  if (!shouldScan) {
    return (
      <p className="whitespace-pre-wrap text-sm text-neutral-100">
        {content}
      </p>
    );
  }

  // For assistant messages, render with PII protection
  return (
    <p className="whitespace-pre-wrap text-sm text-neutral-100">
      {segments.map((segment, index) => {
        if (segment.type === 'pii') {
          return (
            <Spoiler key={`pii-${index}-${segment.content.slice(0, 5)}`}>
              {segment.content}
            </Spoiler>
          );
        }
        return <span key={`text-${index}`}>{segment.content}</span>;
      })}
    </p>
  );
}
