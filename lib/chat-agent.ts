import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
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
      model: "llama-3.1-70b-versatile",
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
    return new DynamicStructuredTool({
      name: "execute_sql_query",
      description: "Execute SQL queries on the database. Use this tool when the user asks questions that require querying the database.",
      schema: z.object({
        query: z.string().describe("The SQL query to execute"),
        explanation: z.string().describe("Brief explanation of what this query does")
      }),
      func: async ({ query, explanation }) => {
        try {
          const executor = createSQLExecutor(this.sessionToken);
          const results = await executor.executeQuery(query);
          await executor.close();

          return {
            success: true,
            results,
            explanation,
            rowCount: results.length
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            explanation
          };
        }
      }
    });
  }

  private createSchemaInfoTool() {
    return new DynamicStructuredTool({
      name: "get_schema_info",
      description: "Get information about database schema, tables, and columns. Use this when user asks about database structure.",
      schema: z.object({
        table: z.string().optional().describe("Specific table name to get info about, or leave empty for all tables")
      }),
      func: async ({ table }) => {
        if (!this.schema) {
          return { error: "Schema not loaded" };
        }

        if (table) {
          const tableInfo = this.schema.tables.find(t => t.name.toLowerCase() === table.toLowerCase());
          return tableInfo ? { table: tableInfo } : { error: `Table '${table}' not found` };
        }

        return {
          tables: this.schema.tables.map(t => ({
            name: t.name,
            columns: t.columns.length,
            columnNames: t.columns.map(c => c.name)
          })),
          totalTables: this.schema.metadata.totalTables,
          relationships: this.schema.relationships
        };
      }
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
          `- ${rel.from.table}.${rel.from.column} → ${rel.to.table}.${rel.to.column} (${rel.type})`
        ).join("\n")}`
      : "";

    return `You are an AI database assistant with access to a SQL database. You can execute SQL queries and provide information about the database structure.

DATABASE SCHEMA:
${schemaDescription}${relationships}

INSTRUCTIONS:
1. When users ask questions that require data from the database, use the execute_sql_query tool to run appropriate SQL queries.
2. When users ask about database structure, tables, or columns, use the get_schema_info tool.
3. For general questions not related to the database, respond normally without using tools.
4. Always write clean, efficient SQL queries.
5. Explain your queries and results in a user-friendly way.
6. If a query fails, explain the error and suggest corrections.
7. Be helpful and provide context about the data you're showing.

IMPORTANT: Only generate valid SQL queries that work with the provided schema. Always double-check table and column names.`;
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
    });

    try {
      const result = await agentExecutor.invoke({
        input: message,
        chat_history: chatHistory,
      });

      return result.output;
    } catch (error) {
      console.error("Chat agent error:", error);
      return "I'm sorry, I encountered an error while processing your request. Please try again or rephrase your question.";
    }
  }
}