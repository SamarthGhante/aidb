import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Function to parse SQL file and extract schema information
async function parseDatabase(filePath: string) {
  try {
    const sqlContent = await readFile(filePath, "utf-8");

    // Extract table schemas, sample data, etc.
    const tables = extractTableInfo(sqlContent);
    const sampleData = extractSampleData(sqlContent);

    return {
      schema: tables,
      sampleData,
      fullContent: sqlContent,
    };
  } catch (error) {
    console.error("Error parsing database:", error);
    return null;
  }
}

function extractTableInfo(sqlContent: string) {
  const tables: any[] = [];
  const createTableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*?)\);/gi;

  let match;
  while ((match = createTableRegex.exec(sqlContent)) !== null) {
    const tableName = match[1];
    const tableDefinition = match[2];

    // Extract columns
    const columns = extractColumns(tableDefinition);

    tables.push({
      name: tableName,
      columns: columns,
    });
  }

  return tables;
}

function extractColumns(tableDefinition: string) {
  const columns: any[] = [];
  const lines = tableDefinition.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith("PRIMARY KEY") &&
      !trimmed.startsWith("FOREIGN KEY") &&
      !trimmed.startsWith("KEY") &&
      !trimmed.startsWith("INDEX")
    ) {
      const columnMatch = trimmed.match(/`?(\w+)`?\s+(\w+(?:\(\d+\))?)/);
      if (columnMatch) {
        columns.push({
          name: columnMatch[1],
          type: columnMatch[2],
        });
      }
    }
  }

  return columns;
}

function extractSampleData(sqlContent: string) {
  const insertRegex = /INSERT\s+INTO\s+`?(\w+)`?[\s\S]*?VALUES\s*([\s\S]*?);/gi;
  const sampleData: { [key: string]: string[] } = {};

  let match;
  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const tableName = match[1];
    const valuesSection = match[2];

    // Extract first few rows as sample
    const rows = valuesSection.split(/\),\s*\(/);
    sampleData[tableName] = rows.slice(0, 3); // First 3 rows as sample
  }

  return sampleData;
}

export async function POST(request: NextRequest) {
  try {
    const { message, sessionToken, fileName } = await request.json();

    if (!message || !sessionToken || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if database file exists
    const filePath = join(process.cwd(), "data", sessionToken, fileName);
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "Database file not found" },
        { status: 404 }
      );
    }

    // Parse the database
    const dbInfo = await parseDatabase(filePath);
    if (!dbInfo) {
      return NextResponse.json(
        { error: "Failed to parse database" },
        { status: 500 }
      );
    }

    // Create context for Groq
    const databaseContext = `
Database Schema:
${dbInfo.schema
  .map(
    (table) =>
      `Table: ${table.name}
  Columns: ${table.columns
    .map((col: any) => `${col.name} (${col.type})`)
    .join(", ")}`
  )
  .join("\n\n")}

Sample Data:
${Object.entries(dbInfo.sampleData)
  .map(([tableName, rows]) => `${tableName}: ${rows.slice(0, 2).join(", ")}`)
  .join("\n")}

Full SQL Content Available for Reference:
${dbInfo.fullContent.substring(0, 2000)}...
`;

    // Create the prompt for Groq
    const prompt = `You are a database assistant. You have access to a SQL database with the following information:

${databaseContext}

User Question: ${message}

Please provide a helpful response based on the database schema and data. If the user is asking for specific data, explain what you can see from the sample data or suggest appropriate SQL queries. If you need to query specific data, provide the SQL query that would answer their question.

Keep responses concise but informative. Use a friendly, professional tone.`;

    // Call Groq API
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful database assistant that can analyze SQL databases and answer questions about the data in a natural, conversational way.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response =
      completion.choices[0]?.message?.content ||
      "I'm sorry, I couldn't process your request.";

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
