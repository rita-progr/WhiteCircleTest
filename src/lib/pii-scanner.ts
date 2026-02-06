export type PIIType = 'email' | 'phone' | 'card' | 'ssn' | 'name' | 'address' | 'dob' | 'ip';

export interface PIIItem {
  start: number;
  end: number;
  type: PIIType;
  text: string;
}

export interface TextSegment {
  type: 'text' | 'pii';
  content: string;
  piiType?: PIIType;
}

interface PIIResponse {
  piiItems: PIIItem[];
}

// Cache for PII scan results
const scanCache = new Map<string, PIIItem[]>();

export async function scanForPII(text: string): Promise<PIIItem[]> {
  console.log('[scanForPII] Called with text length:', text?.length);

  if (!text || text.trim().length === 0) {
    console.log('[scanForPII] Empty text, returning []');
    return [];
  }

  // Check cache first
  const cached = scanCache.get(text);
  if (cached !== undefined) {
    console.log('[scanForPII] Cache hit, returning', cached.length, 'items');
    return cached;
  }

  try {
    console.log('[scanForPII] Making API request...');
    const response = await fetch('/api/detect-pii', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    console.log('[scanForPII] Response status:', response.status);

    if (!response.ok) {
      console.error('[scanForPII] Response not OK:', response.statusText);
      return [];
    }

    const data = await response.json();
    console.log('[scanForPII] API returned:', JSON.stringify(data));
    if (data.error) {
      console.error('[scanForPII] API error:', data.error);
    }
    const piiItems = data.piiItems || [];

    // Cache the result
    scanCache.set(text, piiItems);

    // Limit cache size
    if (scanCache.size > 100) {
      const firstKey = scanCache.keys().next().value;
      if (firstKey) scanCache.delete(firstKey);
    }

    console.log('[scanForPII] Returning', piiItems.length, 'items');
    return piiItems;
  } catch (error) {
    console.error('[scanForPII] Error:', error);
    return [];
  }
}

export function splitTextWithPII(text: string, piiItems: PIIItem[]): TextSegment[] {
  if (!piiItems || piiItems.length === 0) {
    return [{ type: 'text', content: text }];
  }

  // Sort PII items by start position
  const sortedPII = [...piiItems].sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let currentIndex = 0;

  for (const pii of sortedPII) {
    // Validate PII boundaries
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

// Merge PII items from incremental scans
export function mergePIIItems(
  existing: PIIItem[],
  newItems: PIIItem[],
  offset: number
): PIIItem[] {
  // Adjust new items by offset
  const adjustedNew = newItems.map((item) => ({
    ...item,
    start: item.start + offset,
    end: item.end + offset,
  }));

  // Combine and deduplicate
  const combined = [...existing];

  for (const newItem of adjustedNew) {
    // Check for overlap with existing items
    const overlapping = combined.findIndex(
      (existing) =>
        (newItem.start >= existing.start && newItem.start < existing.end) ||
        (newItem.end > existing.start && newItem.end <= existing.end) ||
        (newItem.start <= existing.start && newItem.end >= existing.end)
    );

    if (overlapping === -1) {
      combined.push(newItem);
    } else {
      // Replace with the larger/more accurate item
      const existingItem = combined[overlapping];
      if (newItem.end - newItem.start > existingItem.end - existingItem.start) {
        combined[overlapping] = newItem;
      }
    }
  }

  return combined.sort((a, b) => a.start - b.start);
}

// Clear cache (useful for testing)
export function clearPIICache(): void {
  scanCache.clear();
}
