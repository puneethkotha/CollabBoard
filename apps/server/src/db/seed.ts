import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { config } from '../config';

const pool = new Pool({ connectionString: config.database.url });

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('Starting seed...');
    
    await client.query('BEGIN');
    
    // Create demo users
    const password1 = await bcrypt.hash('password123', 10);
    const password2 = await bcrypt.hash('password123', 10);
    
    const user1Result = await client.query(
      `INSERT INTO users (email, password_hash, name) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['alice@example.com', password1, 'Alice Johnson']
    );
    const user1Id = user1Result.rows[0].id;
    
    const user2Result = await client.query(
      `INSERT INTO users (email, password_hash, name) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['bob@example.com', password2, 'Bob Smith']
    );
    const user2Id = user2Result.rows[0].id;
    
    console.log('Created demo users: alice@example.com, bob@example.com (password: password123)');
    
    // Create demo workspace
    const workspaceResult = await client.query(
      `INSERT INTO workspaces (name, created_by) 
       VALUES ($1, $2) 
       RETURNING id`,
      ['Demo Workspace', user1Id]
    );
    const workspaceId = workspaceResult.rows[0].id;
    
    console.log('Created demo workspace');
    
    // Add workspace members
    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) 
       VALUES ($1, $2, $3), ($4, $5, $6)`,
      [workspaceId, user1Id, 'OWNER', workspaceId, user2Id, 'MEMBER']
    );
    
    console.log('Added workspace members');
    
    // Create demo board
    const boardResult = await client.query(
      `INSERT INTO boards (workspace_id, name, description, created_by) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [workspaceId, 'Project Planning', 'Demo board for project planning', user1Id]
    );
    const boardId = boardResult.rows[0].id;
    
    console.log('Created demo board');
    
    // Create columns
    const todoResult = await client.query(
      `INSERT INTO columns (board_id, name, position) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      [boardId, 'To Do', 0]
    );
    const todoColumnId = todoResult.rows[0].id;
    
    const inProgressResult = await client.query(
      `INSERT INTO columns (board_id, name, position) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      [boardId, 'In Progress', 1]
    );
    const inProgressColumnId = inProgressResult.rows[0].id;
    
    const doneResult = await client.query(
      `INSERT INTO columns (board_id, name, position) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      [boardId, 'Done', 2]
    );
    const doneColumnId = doneResult.rows[0].id;
    
    console.log('Created columns');
    
    // Create sample cards
    const cards = [
      {
        columnId: todoColumnId,
        title: 'Design new landing page',
        description: 'Create mockups for the new landing page redesign',
        tags: ['design', 'high-priority'],
        position: 0,
      },
      {
        columnId: todoColumnId,
        title: 'Set up CI/CD pipeline',
        description: 'Configure GitHub Actions for automated testing and deployment',
        tags: ['devops', 'infrastructure'],
        position: 1,
      },
      {
        columnId: inProgressColumnId,
        title: 'Implement user authentication',
        description: 'Add JWT-based authentication with refresh tokens',
        tags: ['backend', 'security'],
        position: 0,
      },
      {
        columnId: inProgressColumnId,
        title: 'Build real-time sync',
        description: 'Implement Socket.IO for real-time collaboration',
        tags: ['backend', 'realtime'],
        position: 1,
      },
      {
        columnId: doneColumnId,
        title: 'Set up database schema',
        description: 'Create PostgreSQL tables and migrations',
        tags: ['database', 'backend'],
        position: 0,
      },
      {
        columnId: doneColumnId,
        title: 'Initialize project repository',
        description: 'Set up monorepo with Turbo and workspace structure',
        tags: ['setup'],
        position: 1,
      },
    ];
    
    for (const card of cards) {
      await client.query(
        `INSERT INTO cards (board_id, column_id, title, description, tags, position, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [boardId, card.columnId, card.title, card.description, card.tags, card.position, user1Id, user1Id]
      );
    }
    
    console.log('Created sample cards');
    
    await client.query('COMMIT');
    
    console.log('\n✅ Seed completed successfully!');
    console.log('\nDemo credentials:');
    console.log('  Email: alice@example.com');
    console.log('  Email: bob@example.com');
    console.log('  Password: password123');
    console.log(`\nWorkspace ID: ${workspaceId}`);
    console.log(`Board ID: ${boardId}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
