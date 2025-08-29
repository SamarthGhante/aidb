import sqlite3 from 'sqlite3';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

export class SQLExecutor {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor(sessionToken: string) {
    this.dbPath = join(process.cwd(), 'data', sessionToken, 'database.db');
    this.db = new sqlite3.Database(this.dbPath);
  }

  async executeQuery(query: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // Determine if it's a SELECT query or modification query
      const trimmedQuery = query.trim().toUpperCase();
      
      if (trimmedQuery.startsWith('SELECT') || 
          trimmedQuery.startsWith('WITH') ||
          trimmedQuery.startsWith('PRAGMA')) {
        // For SELECT queries, use all() to get results
        this.db.all(query, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      } else {
        // For INSERT, UPDATE, DELETE, etc., use run()
        this.db.run(query, [], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve([{
              changes: this.changes,
              lastID: this.lastID,
              message: `Query executed successfully. ${this.changes} row(s) affected.`
            }]);
          }
        });
      }
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Get table info for validation
  async getTableInfo(tableName: string): Promise<any[]> {
    return this.executeQuery(`PRAGMA table_info(${tableName})`);
  }

  // List all tables
  async getAllTables(): Promise<string[]> {
    const result = await this.executeQuery(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    return result.map(row => row.name);
  }
}

export async function initializeDatabase(sessionToken: string, sqlFilePath: string): Promise<void> {
  const sqlContent = await readFile(sqlFilePath, 'utf-8');
  const executor = new SQLExecutor(sessionToken);

  try {
    // Check if SQL contains CREATE TABLE statements
    const hasCreateStatements = /CREATE\s+TABLE/i.test(sqlContent);
    
    if (!hasCreateStatements) {
      // If no CREATE TABLE statements, infer table structure from INSERT statements
      console.log('No CREATE TABLE statements found. Inferring structure from INSERT statements...');
      await createTablesFromInserts(executor, sqlContent);
    }

    // Split SQL content into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await executor.executeQuery(statement + ';');
        } catch (error) {
          console.warn(`Warning: Failed to execute statement: ${statement.substring(0, 100)}...`, error);
          // Continue with other statements even if one fails
        }
      }
    }

    console.log(`Database initialized successfully for session: ${sessionToken}`);
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    await executor.close();
  }
}

async function createTablesFromInserts(executor: SQLExecutor, sqlContent: string): Promise<void> {
  // Find all INSERT statements and extract table structures
  const insertRegex = /INSERT\s+INTO\s+`?(\w+)`?\s*\(\s*`?([^)]+?)`?\s*\)\s+VALUES/gi;
  const tablesCreated = new Set<string>();
  
  let match;
  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const tableName = match[1];
    const columnsStr = match[2];
    
    if (tablesCreated.has(tableName)) {
      continue; // Table already created
    }
    
    // Parse column names - handle backticks properly
    const columns = columnsStr
      .split('`,')
      .map(col => col.trim().replace(/^`|`$/g, ''))
      .filter(col => col.length > 0);
    
    // Get sample data to infer types
    const sampleData = getSampleDataForTable(sqlContent, tableName);
    
    // Create table with inferred column types
    const createTableSQL = generateCreateTableSQL(tableName, columns, sampleData);
    
    console.log(`Creating table: ${tableName}`);
    console.log(`SQL: ${createTableSQL}`);
    
    try {
      await executor.executeQuery(createTableSQL);
      tablesCreated.add(tableName);
    } catch (error) {
      console.error(`Failed to create table ${tableName}:`, error);
      throw error;
    }
  }
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

function generateCreateTableSQL(tableName: string, columns: string[], sampleData: string[]): string {
  const columnDefinitions = columns.map((col, index) => {
    const sampleValue = sampleData[index] || '';
    let type = 'TEXT'; // Default type
    
    // Infer type from sample data
    if (col.toLowerCase().includes('id') && index === 0) {
      type = 'INTEGER PRIMARY KEY';
    } else if (col.toLowerCase().includes('id')) {
      type = 'INTEGER';
    } else if (!isNaN(Number(sampleValue)) && sampleValue !== '' && sampleValue !== 'null') {
      type = sampleValue.includes('.') ? 'REAL' : 'INTEGER';
    } else if (sampleValue === '0' || sampleValue === '1') {
      type = 'INTEGER'; // Boolean-like
    }
    
    return `\`${col}\` ${type}`;
  });
  
  return `CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n  ${columnDefinitions.join(',\n  ')}\n);`;
}

export function createSQLExecutor(sessionToken: string): SQLExecutor {
  return new SQLExecutor(sessionToken);
}