import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { detectPIIInstant } from './pii-patterns';

interface PiiItem {
  text: string;
  type: string;
}

/**
 * Server-side PII detection: regex + Haiku.
 * Called once in onFinish, result stored in DB.
 */
export async function detectPIIServer(text: string): Promise<string[]> {
  // Layer 1: regex (instant, free)
  const regexMatches = detectPIIInstant(text);
  const regexTexts = regexMatches.map((m) => m.text);

  // Layer 2: Haiku (semantic, catches names/addresses)
  let haikuTexts: string[] = [];
  try {
    const result = await generateText({
      model: anthropic('claude-3-haiku-20240307'),
      prompt: `Analyze this text and extract ALL personally identifiable information (PII).

Text:
"""
${text}
"""

Return ONLY a JSON array of objects, nothing else. Format:
[{"text": "exact PII text", "type": "name|email|phone|address"}]

Rules:
- Full names like "Екатерина Волкова", "Дмитрий Соколов", "Anna Petrova" are PII type "name"
- Emails like "anna@mail.ru" are PII type "email"
- Return empty array [] only if there is truly NO PII
- Extract text EXACTLY as it appears

Examples:
- Input: "Меня зовут Иван Петров" → [{"text": "Иван Петров", "type": "name"}]
- Input: "Email: test@mail.ru" → [{"text": "test@mail.ru", "type": "email"}]

JSON array:`,
    });

    let piiItems: PiiItem[] = [];
    try {
      const parsed = JSON.parse(result.text.trim());
      if (Array.isArray(parsed)) {
        piiItems = parsed;
      }
    } catch {
      // Fallback: extract JSON array from response text
      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          piiItems = JSON.parse(jsonMatch[0]);
        } catch {
          // Give up parsing
        }
      }
    }

    haikuTexts = piiItems.map((item) => item.text);
  } catch (error) {
    console.error('Server PII detection (Haiku) failed:', error);
  }

  // Merge and deduplicate
  const all = regexTexts.concat(haikuTexts);
  return all.filter((item, index) => all.indexOf(item) === index);
}
