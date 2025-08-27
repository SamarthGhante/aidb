import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { extractDatabaseSchema } from '@/lib/schema-extractor';
import { initializeDatabase } from '@/lib/sql-executor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sessionToken = formData.get('sessionToken') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!sessionToken) {
      return NextResponse.json({ error: 'No session token provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.sql')) {
      return NextResponse.json({ error: 'Only SQL files are allowed' }, { status: 400 });
    }

    // Create data directory if it doesn't exist
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    // Create session directory
    const sessionDir = join(dataDir, sessionToken);
    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save file with original name
    const filePath = join(sessionDir, file.name);
    await writeFile(filePath, buffer);

    // Extract database schema
    const schema = await extractDatabaseSchema(filePath, file.name);
    
    // Initialize SQLite database from the SQL file
    await initializeDatabase(sessionToken, filePath);

    return NextResponse.json({ 
      message: 'File uploaded successfully',
      fileName: file.name,
      sessionToken,
      filePath: `data/${sessionToken}/${file.name}`,
      schema: schema.metadata
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}