// Test script to simulate the upload process and check if tables are created
const { extractDatabaseSchema } = require('./lib/schema-extractor.ts');
const { initializeDatabase } = require('./lib/sql-executor.ts');

async function testUpload() {
  try {
    const sessionToken = 'test-session-' + Date.now();
    const sqlFile = 'data/40rtzcltrlxyst5uo09z7h/nss-blood-donation-final-sql-format.sql';
    
    console.log('Testing schema extraction...');
    const schema = await extractDatabaseSchema(sqlFile, 'test.sql');
    console.log('Schema extracted:', JSON.stringify(schema, null, 2));
    
    console.log('\nTesting database initialization...');
    await initializeDatabase(sessionToken, sqlFile);
    console.log('Database initialized successfully');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testUpload();