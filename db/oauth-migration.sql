-- Run once against an existing database before enabling OAuth.
ALTER TABLE users
    ALTER COLUMN password DROP NOT NULL;

CREATE TABLE IF NOT EXISTS oauth_accounts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    UNIQUE (provider, provider_id)
);
