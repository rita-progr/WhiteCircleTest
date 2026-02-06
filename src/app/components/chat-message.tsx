'use client';

import { useMemo } from 'react';
import { detectPIIInstant, splitTextWithPII, type TextSegment } from '@/lib/pii-patterns';
import { Spoiler } from './spoiler';

interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant';
}

/**
 * Parse <pii>...</pii> tags from LLM response
 */
function parsePIITags(content: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /<pii>(.*?)<\/pii>/gs;
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

export function ChatMessage({ content, role }: ChatMessageProps) {
  // Only scan assistant messages for PII
  const shouldScan = role === 'assistant';

  const segments = useMemo(() => {
    if (!shouldScan || !content) {
      return [{ type: 'text' as const, content }];
    }

    // First: parse LLM-tagged PII
    const taggedSegments = parsePIITags(content);

    // Second: apply regex fallback for any missed PII
    return applyRegexFallback(taggedSegments);
  }, [content, shouldScan]);

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
