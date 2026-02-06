import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return Response.json({ piiItems: [], debug: 'no text provided' });
    }

    console.log('🔍 [detect-pii] Input text:', text.slice(0, 100));

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

    console.log('🔍 [detect-pii] Haiku raw response:', result.text);

    // Parse the JSON response
    let piiItems: Array<{ text: string; type: string }> = [];
    try {
      const parsed = JSON.parse(result.text.trim());
      if (Array.isArray(parsed)) {
        piiItems = parsed;
      }
    } catch (parseError) {
      console.error('🔍 [detect-pii] JSON parse error:', parseError);
      // Try to extract JSON from response
      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          piiItems = JSON.parse(jsonMatch[0]);
        } catch {
          console.error('🔍 [detect-pii] Failed to extract JSON');
        }
      }
    }

    console.log('🔍 [detect-pii] Parsed piiItems:', piiItems);

    return Response.json({ piiItems, debug: { raw: result.text.slice(0, 200) } });
  } catch (error) {
    console.error('🔍 [detect-pii] Error:', error);
    return Response.json({ piiItems: [], error: String(error) });
  }
}
