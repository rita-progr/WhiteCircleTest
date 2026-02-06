'use client';

import { useMemo } from 'react';
import { detectPIIInstant, splitTextWithPII, type PIIType } from '@/lib/pii-patterns';
import { Spoiler } from './spoiler';

interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant';
}

const PII_LABELS: Record<PIIType, string> = {
  email: 'Email',
  phone: 'Phone',
  card: 'Card',
  ssn: 'SSN',
  ip: 'IP',
};

export function ChatMessage({ content, role }: ChatMessageProps) {
  // Only scan assistant messages for PII
  const shouldScan = role === 'assistant';

  // Memoized synchronous PII detection - runs instantly on every content change
  const segments = useMemo(() => {
    if (!shouldScan || !content) {
      return [{ type: 'text' as const, content }];
    }

    const piiItems = detectPIIInstant(content);
    return splitTextWithPII(content, piiItems);
  }, [content, shouldScan]);

  // For user messages, just render the content directly
  if (!shouldScan) {
    return (
      <p className="whitespace-pre-wrap text-sm text-neutral-100">
        {content}
      </p>
    );
  }

  // For assistant messages, render with instant PII protection
  return (
    <p className="whitespace-pre-wrap text-sm text-neutral-100">
      {segments.map((segment, index) => {
        if (segment.type === 'pii') {
          return (
            <Spoiler
              key={`pii-${index}-${segment.content.slice(0, 5)}`}
              label={segment.piiType ? PII_LABELS[segment.piiType] : 'PII'}
            >
              {segment.content}
            </Spoiler>
          );
        }
        return <span key={`text-${index}`}>{segment.content}</span>;
      })}
    </p>
  );
}
