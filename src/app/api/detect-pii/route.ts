interface PIIItem {
  start: number;
  end: number;
  type: string;
  text: string;
}

// Regex patterns for PII detection
const PII_PATTERNS: { type: string; pattern: RegExp }[] = [
  // Email
  { type: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  // Phone numbers (various formats)
  { type: 'phone', pattern: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g },
  // SSN
  { type: 'ssn', pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g },
  // Credit card (basic pattern)
  { type: 'card', pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
  // IP addresses
  { type: 'ip', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
];

function detectPII(text: string): PIIItem[] {
  const items: PIIItem[] = [];
  const usedRanges: Array<{ start: number; end: number }> = [];

  for (const { type, pattern } of PII_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check for overlaps
      const overlaps = usedRanges.some(
        (range) => (start >= range.start && start < range.end) || (end > range.start && end <= range.end)
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

export async function POST(req: Request) {
  try {
    const { text }: { text: string } = await req.json();

    if (!text || text.trim().length === 0) {
      return Response.json({ piiItems: [] });
    }

    console.log('[PII Detection] Scanning text:', text.slice(0, 100));

    const piiItems = detectPII(text);

    console.log('[PII Detection] Found items:', JSON.stringify(piiItems));
    return Response.json({ piiItems });
  } catch (error) {
    console.error('[PII Detection] Error:', error);
    return Response.json({ piiItems: [], error: String(error) });
  }
}
