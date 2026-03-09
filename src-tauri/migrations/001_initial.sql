CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quadrant INTEGER NOT NULL CHECK (quadrant IN (1, 2)),
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    device_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    locked INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    locked_until TEXT NOT NULL,
    device_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    last_synced_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
