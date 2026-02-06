'use client';

import { useStreamingPII } from '@/lib/hooks/use-streaming-pii';
import { Spoiler } from './spoiler';
import type { PIIType } from '@/lib/pii-scanner';

interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant';
  isStreaming?: boolean;
}

const PII_LABELS: Record<PIIType, string> = {
  email: 'Email',
  phone: 'Phone',
  card: 'Card',
  ssn: 'SSN',
  name: 'Name',
  address: 'Address',
  dob: 'DOB',
  ip: 'IP',
};

export function ChatMessage({ content, role, isStreaming = false }: ChatMessageProps) {
  // Only scan assistant messages for PII
  const shouldScan = role === 'assistant';

  const { segments, isScanning, piiCount } = useStreamingPII({
    text: shouldScan ? content : '',
    isStreaming: shouldScan && isStreaming,
  });

  console.log('[ChatMessage] PII count:', piiCount, 'segments:', segments.length);

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
            <Spoiler
              key={`pii-${index}-${segment.content.slice(0, 10)}`}
              label={segment.piiType ? PII_LABELS[segment.piiType] : 'PII'}
            >
              {segment.content}
            </Spoiler>
          );
        }
        return <span key={`text-${index}`}>{segment.content}</span>;
      })}
      {isScanning && (
        <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-neutral-500" />
      )}
    </p>
  );
}
