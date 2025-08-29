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
  
  // Check if SQL contains CREATE TABLE statements
  const hasCreateStatements = /CREATE\s+TABLE/i.test(sqlContent);
  
  let tables: TableSchema[];
  if (hasCreateStatements) {
    tables = extractTables(sqlContent);
  } else {
    // Extract table structure from INSERT statements
    console.log('No CREATE TABLE statements found. Extracting schema from INSERT statements...');
    tables = extractTablesFromInserts(sqlContent);
  }
  
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
  const indexRegex = new RegExp(`CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?\`?([a-zA-Z_][a-zA-Z0-9_]*)\`?\\s+ON\\s+\`?${tableName}\`?`, 'gi');
  
  let match;
  while ((match = indexRegex.exec(sqlContent)) !== null) {
    indexes.push(match[1]);
  }
  
  return indexes;
}

function extractTablesFromInserts(sqlContent: string): TableSchema[] {
  const tables: TableSchema[] = [];
  const insertRegex = /INSERT\s+INTO\s+`?(\w+)`?\s*\(\s*`?([^)]+?)`?\s*\)\s+VALUES/gi;
  const tablesProcessed = new Set<string>();
  
  let match;
  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const tableName = match[1];
    const columnsStr = match[2];
    
    if (tablesProcessed.has(tableName)) {
      continue; // Table already processed
    }
    
    // Parse column names - handle backticks properly
    const columnNames = columnsStr
      .split('`,')
      .map(col => col.trim().replace(/^`|`$/g, ''))
      .filter(col => col.length > 0);
    
    // Get sample data to infer types
    const sampleData = getSampleDataForTable(sqlContent, tableName);
    
    // Create column definitions
    const columns = columnNames.map((colName, index) => {
      const sampleValue = sampleData[index] || '';
      let type = 'TEXT'; // Default type
      let primaryKey = false;
      
      // Infer type from sample data and column name
      if (colName.toLowerCase().includes('id') && index === 0) {
        type = 'INTEGER';
        primaryKey = true;
      } else if (colName.toLowerCase().includes('id')) {
        type = 'INTEGER';
      } else if (!isNaN(Number(sampleValue)) && sampleValue !== '' && sampleValue !== 'null') {
        type = sampleValue.includes('.') ? 'REAL' : 'INTEGER';
      } else if (sampleValue === '0' || sampleValue === '1') {
        type = 'INTEGER'; // Boolean-like
      }
      
      return {
        name: colName,
        type: type,
        nullable: true, // Default to nullable for INSERT-derived schemas
        primaryKey: primaryKey
      };
    });
    
    tables.push({
      name: tableName,
      columns: columns,
      indexes: [] // No index information available from INSERT statements
    });
    
    tablesProcessed.add(tableName);
  }
  
  return tables;
}

function getSampleDataForTable(sqlContent: string, tableName: string): string[] {
  // Find the first VALUES clause for this table
  const valuesRegex = new RegExp(`INSERT\\s+INTO\\s+\`?${tableName}\`?[^V]+VALUES\\s*\\n?([^;]+)`, 'i');
  const match = sqlContent.match(valuesRegex);
  
  if (!match) return [];
  
  // Extract first row of data
  const valuesSection = match[1];
  const firstRowMatch = valuesSection.match(/\(([^)]+)\)/);
  
  if (!firstRowMatch) return [];
  
  // Parse the values
  const values = firstRowMatch[1]
    .split(',')
    .map(val => val.trim().replace(/^['"`]|['"`]$/g, ''));
  
  return values;
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