import { NextRequest, NextResponse } from 'next/server';
import { DatabaseChatAgent } from '@/lib/chat-agent';
import { existsSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { message, sessionToken, fileName, chatHistory } = await request.json();

    if (!message || !sessionToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if database exists
    const dbPath = join(process.cwd(), 'data', sessionToken, 'database.db');
    const schemaPath = join(process.cwd(), 'data', sessionToken, 'schema.json');
    
    if (!existsSync(dbPath) || !existsSync(schemaPath)) {
      return NextResponse.json({ error: 'Database or schema not found' }, { status: 404 });
    }

    // Create and initialize the chat agent
    const agent = new DatabaseChatAgent(sessionToken);
    await agent.initialize();

    // Get response from the agent
    const response = await agent.chat(message, chatHistory || []);

    return NextResponse.json({ response });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ 
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}