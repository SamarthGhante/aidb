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

export function createSQLExecutor(sessionToken: string): SQLExecutor {
  return new SQLExecutor(sessionToken);
}