const { Client } = require('pg');
require('dotenv').config();

const useConnectionString = !!process.env.DATABASE_URL;

const pgConfig = useConnectionString
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT || 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: 'postgres'
    };

async function test() {
  const client = new Client(pgConfig);
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('Successfully connected to the database!');
    const res = await client.query('SELECT version()');
    console.log('Version:', res.rows[0].version);

    // List all public tables
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Active tables in database:', tables.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Connection failed details:');
    console.error(err);
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
}

test();
