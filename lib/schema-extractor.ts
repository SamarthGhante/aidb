import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface TableSchema {
  name: string;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
    foreignKey?: {
      table: string;
      column: string;
    };
  }[];
  indexes: string[];
}

export interface DatabaseSchema {
  tables: TableSchema[];
  relationships: {
    from: { table: string; column: string };
    to: { table: string; column: string };
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  }[];
  metadata: {
    extractedAt: string;
    fileName: string;
    totalTables: number;
  };
}

export async function extractDatabaseSchema(sqlFilePath: string, fileName: string): Promise<DatabaseSchema> {
  const sqlContent = await readFile(sqlFilePath, 'utf-8');
  
  const tables = extractTables(sqlContent);
  const relationships = extractRelationships(sqlContent, tables);
  
  const schema: DatabaseSchema = {
    tables,
    relationships,
    metadata: {
      extractedAt: new Date().toISOString(),
      fileName,
      totalTables: tables.length
    }
  };
  
  // Save schema to JSON file
  const schemaPath = join(sqlFilePath.replace(fileName, ''), 'schema.json');
  await writeFile(schemaPath, JSON.stringify(schema, null, 2));
  
  return schema;
}

function extractTables(sqlContent: string): TableSchema[] {
  const tables: TableSchema[] = [];
  
  // Match CREATE TABLE statements
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s*\(([\s\S]*?)\);/gi;
  
  let match;
  while ((match = createTableRegex.exec(sqlContent)) !== null) {
    const tableName = match[1];
    const tableDefinition = match[2];
    
    const columns = extractColumns(tableDefinition);
    const indexes = extractIndexes(sqlContent, tableName);
    
    tables.push({
      name: tableName,
      columns,
      indexes
    });
  }
  
  return tables;
}

function extractColumns(tableDefinition: string) {
  const columns: TableSchema['columns'] = [];
  const lines = tableDefinition.split(',');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip constraints and other non-column definitions
    if (trimmed.startsWith('PRIMARY KEY') || 
        trimmed.startsWith('FOREIGN KEY') || 
        trimmed.startsWith('UNIQUE') ||
        trimmed.startsWith('INDEX') ||
        trimmed.startsWith('KEY') ||
        trimmed.startsWith('CONSTRAINT')) {
      continue;
    }
    
    // Match column definition
    const columnMatch = trimmed.match(/`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s+([a-zA-Z]+(?:\(\d+(?:,\s*\d+)?\))?)\s*(.*)/i);
    
    if (columnMatch) {
      const columnName = columnMatch[1];
      const columnType = columnMatch[2];
      const constraints = columnMatch[3] || '';
      
      const column = {
        name: columnName,
        type: columnType,
        nullable: !constraints.toUpperCase().includes('NOT NULL'),
        primaryKey: constraints.toUpperCase().includes('PRIMARY KEY'),
        foreignKey: extractForeignKey(constraints)
      };
      
      columns.push(column);
    }
  }
  
  return columns;
}

function extractForeignKey(constraints: string) {
  const fkMatch = constraints.match(/REFERENCES\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s*\(\s*`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s*\)/i);
  
  if (fkMatch) {
    return {
      table: fkMatch[1],
      column: fkMatch[2]
    };
  }
  
  return undefined;
}

function extractIndexes(sqlContent: string, tableName: string): string[] {
  const indexes: string[] = [];
  
  // Match CREATE INDEX statements
  const indexRegex = new RegExp(`CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?\\`?([a-zA-Z_][a-zA-Z0-9_]*)\\`?\\s+ON\\s+\\`?${tableName}\\`?`, 'gi');
  
  let match;
  while ((match = indexRegex.exec(sqlContent)) !== null) {
    indexes.push(match[1]);
  }
  
  return indexes;
}

function extractRelationships(sqlContent: string, tables: TableSchema[]) {
  const relationships: DatabaseSchema['relationships'] = [];
  
  for (const table of tables) {
    for (const column of table.columns) {
      if (column.foreignKey) {
        relationships.push({
          from: { table: table.name, column: column.name },
          to: { table: column.foreignKey.table, column: column.foreignKey.column },
          type: 'many-to-one' // Default, could be enhanced with more analysis
        });
      }
    }
  }
  
  return relationships;
}

export async function loadDatabaseSchema(sessionToken: string): Promise<DatabaseSchema | null> {
  try {
    const schemaPath = join(process.cwd(), 'data', sessionToken, 'schema.json');
    const schemaContent = await readFile(schemaPath, 'utf-8');
    return JSON.parse(schemaContent);
  } catch (error) {
    console.error('Error loading schema:', error);
    return null;
  }
}