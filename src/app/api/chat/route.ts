import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, generateText, streamText, type UIMessage } from 'ai';
import { prisma } from '@/lib/prisma';
import { detectPIIServer } from '@/lib/detect-pii-server';

export async function POST(req: Request) {
  const { messages, chatId }: { messages: UIMessage[]; chatId?: string } = await req.json();

  const userMessagesCount = messages.filter((m) => m.role === 'user').length;
  const isFirstMessage = userMessagesCount === 1;

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages: await convertToModelMessages(messages),
    onFinish: async ({ response }) => {
      if (!chatId) return;

      try {
        const lastUserMessage = messages[messages.length - 1];
        const userContent = lastUserMessage.parts
          .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
          .map((part) => part.text)
          .join('');

        const assistantContent = response.messages
          .map((m) => m.content)
          .flat()
          .map((c) => {
            if (typeof c === 'string') return c;
            if (typeof c === 'object' && c !== null && 'type' in c && c.type === 'text' && 'text' in c) {
              return c.text;
            }
            return '';
          })
          .join('');

        // Detect PII once on server — result stored in DB
        const piiItems = assistantContent ? await detectPIIServer(assistantContent) : [];

        await prisma.message.createMany({
          data: [
            { chatId, role: 'user', content: userContent },
            { chatId, role: 'assistant', content: assistantContent, piiItems },
          ],
        });

        await prisma.chat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
        });

        if (isFirstMessage) {
          const titleResult = await generateText({
            model: anthropic('claude-sonnet-4-20250514'),
            prompt: `Generate a short title (5-7 words max) for a chat that starts with this message: "${userContent}". Return only the title, no quotes or punctuation at the end.`,
          });

          await prisma.chat.update({
            where: { id: chatId },
            data: { title: titleResult.text.trim() },
          });
        }
      } catch (error) {
        console.error('Failed to save messages:', error);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
