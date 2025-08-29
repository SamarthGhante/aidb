import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { DynamicTool } from "@langchain/core/tools";
import { createSQLExecutor } from "./sql-executor";
import { loadDatabaseSchema, DatabaseSchema } from "./schema-extractor";

export class DatabaseChatAgent {
  private llm: ChatGroq;
  private sessionToken: string;
  private schema: DatabaseSchema | null = null;

  constructor(sessionToken: string) {
    this.sessionToken = sessionToken;
    this.llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
    });
  }

  async initialize(): Promise<void> {
    this.schema = await loadDatabaseSchema(this.sessionToken);
    if (!this.schema) {
      throw new Error("Database schema not found");
    }
  }

  private createSQLTool() {
    return new DynamicTool({
      name: "execute_sql_query",
      description: "Execute SQL queries on the database. Input should be a valid SQL query string.",
      func: async (input: string) => {
        try {
          console.log("Executing SQL query:", input);
          const executor = createSQLExecutor(this.sessionToken);
          const results = await executor.executeQuery(input);
          await executor.close();

          return `Query executed successfully!
Results (${results.length} rows):
${JSON.stringify(results, null, 2)}`;
        } catch (error) {
          console.error("SQL execution error:", error);
          return `Error executing query: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    });
  }

  private createSchemaInfoTool() {
    return new DynamicTool({
      name: "get_schema_info",
      description: "Get information about database schema, tables, and columns. Input should be a table name or empty string for all tables.",
      func: async (input: string) => {
        console.log("Getting schema info for:", input);
        if (!this.schema) {
          return "Schema not loaded";
        }

        const table = input.trim();
        if (table) {
          const tableInfo = this.schema.tables.find(
            (t) => t.name.toLowerCase() === table.toLowerCase()
          );
          if (tableInfo) {
            return `Table: ${tableInfo.name}
Columns:
${tableInfo.columns.map(col => `- ${col.name}: ${col.type}${col.primaryKey ? ' (PRIMARY KEY)' : ''}${!col.nullable ? ' (NOT NULL)' : ''}`).join('\n')}`;
          } else {
            return `Table '${table}' not found`;
          }
        }

        const tablesList = this.schema.tables.map(t => 
          `- ${t.name} (${t.columns.length} columns: ${t.columns.map(c => c.name).join(', ')})`
        ).join('\n');

        return `Database Schema:
Total Tables: ${this.schema.metadata.totalTables}

Tables:
${tablesList}

Relationships:
${this.schema.relationships.map(rel => `- ${rel.from.table}.${rel.from.column} -> ${rel.to.table}.${rel.to.column}`).join('\n')}`;
      },
    });
  }

  private createSystemPrompt(): string {
    if (!this.schema) {
      return "You are a helpful database assistant.";
    }

    const schemaDescription = this.schema.tables.map(table => {
      const columns = table.columns.map(col => {
        const constraints = [];
        if (col.primaryKey) constraints.push("PRIMARY KEY");
        if (!col.nullable) constraints.push("NOT NULL");
        if (col.foreignKey) constraints.push(`REFERENCES ${col.foreignKey.table}(${col.foreignKey.column})`);
        
        return `  - ${col.name}: ${col.type}${constraints.length ? ` (${constraints.join(", ")})` : ""}`;
      }).join("\n");

      return `Table: ${table.name}\n${columns}`;
    }).join("\n\n");

    const relationships = this.schema.relationships.length > 0 
      ? `\nRelationships:\n${this.schema.relationships.map(rel => 
          `- ${rel.from.table}.${rel.from.column} -> ${rel.to.table}.${rel.to.column} (${rel.type})`
        ).join("\n")}`
      : "";

    return `You are an AI database assistant with access to a SQL database. You can execute SQL queries and provide information about the database structure.

DATABASE SCHEMA:
${schemaDescription}${relationships}

AVAILABLE TABLES: ${this.schema.tables.map(t => t.name).join(', ')}

INSTRUCTIONS:
1. When users ask questions that require data from the database, use the execute_sql_query tool to run appropriate SQL queries.
2. When users ask about database structure, tables, or columns, use the get_schema_info tool.
3. For general questions not related to the database, respond normally without using tools.
4. Always write clean, efficient SQL queries.
5. Explain your queries and results in a user-friendly way.
6. If a query fails, explain the error and suggest corrections.
7. Be helpful and provide context about the data you're showing.

IMPORTANT: 
- Only use table names that exist in the schema: ${this.schema.tables.map(t => t.name).join(', ')}
- Always double-check table and column names against the provided schema
- If a user asks about "user_details" or similar, they likely mean the "${this.schema.tables[0]?.name || 'users'}" table
- Use the get_schema_info tool first if you're unsure about table structure`;
  }

  async chat(message: string, chatHistory: any[] = []): Promise<string> {
    if (!this.schema) {
      await this.initialize();
    }

    const tools = [this.createSQLTool(), this.createSchemaInfoTool()];

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", this.createSystemPrompt()],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    const agent = await createToolCallingAgent({
      llm: this.llm,
      tools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: false,
      maxIterations: 3,
      returnIntermediateSteps: false,
    });

    try {
      const result = await agentExecutor.invoke({
        input: message,
        chat_history: chatHistory,
      });

      // Ensure we return a string
      if (typeof result.output === 'string') {
        return result.output;
      } else {
        return JSON.stringify(result.output);
      }
    } catch (error) {
      console.error("Chat agent error:", error);
      return "I'm sorry, I encountered an error while processing your request. Please try again or rephrase your question.";
    }
  }
}