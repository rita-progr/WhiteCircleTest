import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const chats = await prisma.chat.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(chats);
}

export async function POST() {
  const chat = await prisma.chat.create({
    data: { title: 'New Chat' },
  });
  return NextResponse.json(chat);
}
