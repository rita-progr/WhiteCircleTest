import { detectPIIServer } from '@/lib/detect-pii-server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return Response.json({ piiItems: [], debug: 'no text provided' });
    }

    const piiTexts = await detectPIIServer(text);
    const piiItems = piiTexts.map((t) => ({ text: t, type: 'unknown' }));

    return Response.json({ piiItems });
  } catch (error) {
    console.error('[detect-pii] Error:', error);
    return Response.json({ piiItems: [], error: String(error) });
  }
}
