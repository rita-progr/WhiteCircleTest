// Shared PII detection patterns - used for instant client-side detection

export type PIIType = 'email' | 'phone' | 'card' | 'ssn' | 'ip';

export interface PIIMatch {
  start: number;
  end: number;
  type: PIIType;
  text: string;
}

// Regex patterns for instant PII detection
const PII_PATTERNS: { type: PIIType; pattern: RegExp }[] = [
  // Email
  { type: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  // Phone numbers - international format (+7, +1, +44, etc.)
  { type: 'phone', pattern: /\+\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{0,4}/g },
  // Phone numbers - US format without +
  { type: 'phone', pattern: /\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g },
  // SSN
  { type: 'ssn', pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g },
  // Credit card (basic pattern)
  { type: 'card', pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
  // IP addresses
  { type: 'ip', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
];

/**
 * Instant synchronous PII detection using regex patterns.
 * No API calls, no delays - runs immediately during render.
 */
export function detectPIIInstant(text: string): PIIMatch[] {
  if (!text) return [];

  const items: PIIMatch[] = [];
  const usedRanges: Array<{ start: number; end: number }> = [];

  for (const { type, pattern } of PII_PATTERNS) {
    // Create new regex instance to avoid lastIndex issues
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check for overlaps with existing matches
      const overlaps = usedRanges.some(
        (range) =>
          (start >= range.start && start < range.end) ||
          (end > range.start && end <= range.end)
      );

      if (!overlaps) {
        items.push({
          start,
          end,
          type,
          text: match[0],
        });
        usedRanges.push({ start, end });
      }
    }
  }

  return items.sort((a, b) => a.start - b.start);
}

export interface TextSegment {
  type: 'text' | 'pii';
  content: string;
  piiType?: PIIType;
}

/**
 * Split text into segments with PII marked for blurring.
 * Synchronous - no delays.
 */
export function splitTextWithPII(text: string, piiItems: PIIMatch[]): TextSegment[] {
  if (!text) return [];
  if (!piiItems || piiItems.length === 0) {
    return [{ type: 'text', content: text }];
  }

  const sortedPII = [...piiItems].sort((a, b) => a.start - b.start);
  const segments: TextSegment[] = [];
  let currentIndex = 0;

  for (const pii of sortedPII) {
    // Validate boundaries
    if (pii.start < currentIndex || pii.end > text.length || pii.start >= pii.end) {
      continue;
    }

    // Add text before PII
    if (pii.start > currentIndex) {
      segments.push({
        type: 'text',
        content: text.slice(currentIndex, pii.start),
      });
    }

    // Add PII segment
    segments.push({
      type: 'pii',
      content: text.slice(pii.start, pii.end),
      piiType: pii.type,
    });

    currentIndex = pii.end;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(currentIndex),
    });
  }

  return segments;
}
