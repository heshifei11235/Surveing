-- =====================================================
-- OpenCode Conversation Manager - Database Schema
-- SQLite3 SQL Script
-- =====================================================

-- Drop existing tables (for clean reinstall)
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS tasks;

-- =====================================================
-- Tasks Table
-- =====================================================
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Sessions Table
-- =====================================================
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'semi_auto',
    opencode_session_id VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- =====================================================
-- Messages Table
-- =====================================================
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- =====================================================
-- Indexes for Performance
-- =====================================================
CREATE INDEX idx_sessions_task_id ON sessions(task_id);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- =====================================================
-- Sample Data (Optional - for testing)
-- =====================================================
-- INSERT INTO tasks (title, description) VALUES
--     ('示例任务', '这是一个示例任务用于测试');
--
-- INSERT INTO sessions (task_id, mode, opencode_session_id) VALUES
--     (1, 'semi_auto', NULL);
--
-- INSERT INTO messages (session_id, role, content) VALUES
--     (1, 'user', '你好，这是一个测试消息'),
--     (1, 'assistant', '你好！我可以帮助你进行代码调查。');

-- =====================================================
-- Useful Queries
-- =====================================================

-- Get all sessions for a task with message count
-- SELECT s.*, COUNT(m.id) as message_count
-- FROM sessions s
-- LEFT JOIN messages m ON s.id = m.session_id
-- WHERE s.task_id = ?
-- GROUP BY s.id;

-- Get conversation with all messages
-- SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC;

-- Delete all data (clean slate)
-- DELETE FROM messages;
-- DELETE FROM sessions;
-- DELETE FROM tasks;