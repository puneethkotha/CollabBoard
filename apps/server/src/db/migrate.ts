import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({ connectionString: config.database.url });

const migrations = [
  {
    name: '001_initial_schema',
    sql: `
      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      -- Users table
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_users_email ON users(email);
      
      -- Refresh tokens table
      CREATE TABLE refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
      
      -- Workspaces table
      CREATE TABLE workspaces (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Workspace members table
      CREATE TABLE workspace_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(workspace_id, user_id)
      );
      
      CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
      CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
      CREATE INDEX idx_workspace_members_workspace_user ON workspace_members(workspace_id, user_id);
      
      -- Boards table
      CREATE TABLE boards (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_boards_workspace_id ON boards(workspace_id);
      
      -- Columns table
      CREATE TABLE columns (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        position INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_columns_board_id ON columns(board_id);
      
      -- Cards table
      CREATE TABLE cards (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        column_id UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        tags TEXT[] DEFAULT '{}',
        position INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        created_by UUID NOT NULL REFERENCES users(id),
        updated_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_cards_board_id ON cards(board_id);
      CREATE INDEX idx_cards_column_id ON cards(column_id);
      CREATE INDEX idx_cards_board_column_position ON cards(board_id, column_id, position);
      
      -- Board events table (event sourcing for sync)
      CREATE TABLE board_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        event_id SERIAL,
        type VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_board_events_board_id ON board_events(board_id);
      CREATE INDEX idx_board_events_board_event_id ON board_events(board_id, event_id);
      
      -- Create a sequence per board for event_id
      CREATE SEQUENCE IF NOT EXISTS board_event_seq;
      
      -- Migrations tracking table
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
];

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migrations...');
    
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    for (const migration of migrations) {
      // Check if migration already applied
      const result = await client.query(
        'SELECT * FROM migrations WHERE name = $1',
        [migration.name]
      );
      
      if (result.rows.length > 0) {
        console.log(`Migration ${migration.name} already applied, skipping...`);
        continue;
      }
      
      console.log(`Running migration: ${migration.name}`);
      
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration.name]
        );
        await client.query('COMMIT');
        console.log(`Migration ${migration.name} completed successfully`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
