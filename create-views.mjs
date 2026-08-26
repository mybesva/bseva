import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createViews() {
  try {
    console.log('Creating database views...');
    
    const viewsSQL = readFileSync(join(__dirname, '../drizzle/views.sql'), 'utf-8');
    
    // Split by CREATE OR REPLACE VIEW and execute each view separately
    const viewStatements = viewsSQL
      .split(/CREATE OR REPLACE VIEW/)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => 'CREATE OR REPLACE VIEW' + stmt);
    
    for (const viewStmt of viewStatements) {
      if (viewStmt.trim()) {
        try {
          await db.execute(sql.raw(viewStmt));
          const viewName = viewStmt.match(/VIEW\s+(\w+)/)?.[1];
          console.log(`✓ Created view: ${viewName}`);
        } catch (err) {
          console.error(`Error creating view:`, err.message);
        }
      }
    }
    
    console.log('\n✓ All views created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createViews();
