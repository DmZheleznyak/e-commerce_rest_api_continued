const fs = require('fs');
const path = require('path');
const pool = require('../db');

const sqlFiles = [
    'schema.sql',
    'oauth-migration.sql',
    'product-seed.sql',
    'cart-migration.sql',
    'orders-id-migration.sql'
];

const shouldInitializeDatabase = process.env.RUN_DB_INIT === 'true'
    || process.env.NODE_ENV === 'production';

if (!shouldInitializeDatabase) {
    console.log('Database initialization is disabled.');
    process.exit(0);
}

const databaseHasUsersTable = async (client) => {
    const result = await client.query(`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'users'
        ) AS exists
    `);
    return result.rows[0].exists;
};

const applySqlFile = async (client, fileName) => {
    const filePath = path.join(__dirname, fileName);
    await client.query(fs.readFileSync(filePath, 'utf8'));
    console.log(`Applied ${fileName}`);
};

const initializeDatabase = async () => {
    const client = await pool.connect();

    try {
        await client.query('SELECT pg_advisory_lock(274839)');

        if (await databaseHasUsersTable(client)) {
            await applySqlFile(client, 'oauth-migration.sql');
            await applySqlFile(client, 'customers-id-migration.sql');
            await applySqlFile(client, 'product-id-migration.sql');
            await applySqlFile(client, 'product-seed.sql');
            console.log('Database schema already initialized; migrations checked.');
            return;
        }

        await client.query('BEGIN');
        for (const fileName of sqlFiles) {
            await applySqlFile(client, fileName);
        }
        await client.query('COMMIT');
        console.log('Database schema initialized.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Database initialization failed:', error.message);
        process.exitCode = 1;
    } finally {
        await client.query('SELECT pg_advisory_unlock(274839)');
        client.release();
        await pool.end();
    }
};

initializeDatabase();