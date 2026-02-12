-- Initial database setup
-- This file is executed when the Postgres container starts for the first time

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a simple health check table
CREATE TABLE IF NOT EXISTS _health (
    id SERIAL PRIMARY KEY,
    status TEXT DEFAULT 'healthy',
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO _health (status) VALUES ('healthy');
