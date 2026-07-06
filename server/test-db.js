const { Client } = require('pg');
require('dotenv').config();

const pgConfig = {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: 'postgres'
};

async function test() {
  const client = new Client(pgConfig);
  try {
    console.log('Connecting with config:', { ...pgConfig, password: '***' });
    await client.connect();
    console.log('Successfully connected to postgres default database!');
    const res = await client.query('SELECT version()');
    console.log('Version:', res.rows[0].version);
  } catch (err) {
    console.error('Connection failed details:');
    console.error(err);
  } finally {
    await client.end();
  }
}

test();
