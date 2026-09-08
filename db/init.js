const fs = require('fs');
const path = require('path');
const pool = require('../db');

const sqlFiles = [
    'schema.sql',
    'oauth-migration.sql',
    'cart-migration.sql',
    'orders-id-migration.sql'
];

if (process.env.RUN_DB_INIT !== 'true') {
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

const initializeDatabase = async () => {
    const client = await pool.connect();

    try {
        await client.query('SELECT pg_advisory_lock(274839)');

        if (await databaseHasUsersTable(client)) {
            console.log('Database schema already initialized.');
            return;
        }

        await client.query('BEGIN');
        for (const fileName of sqlFiles) {
            const filePath = path.join(__dirname, fileName);
            await client.query(fs.readFileSync(filePath, 'utf8'));
            console.log(`Applied ${fileName}`);
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