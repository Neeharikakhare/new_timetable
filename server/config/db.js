const { Client, Pool } = require('pg');

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
    };

const dbName = process.env.PGDATABASE || 'timetable';

let pool;

async function initDb() {
  if (!useConnectionString) {
    // First, connect to postgres default database to ensure target database exists
    const client = new Client({ ...pgConfig, database: 'postgres' });
    try {
      await client.connect();
      const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
      if (res.rowCount === 0) {
        console.log(`Database "${dbName}" does not exist. Creating...`);
        // CREATE DATABASE cannot run inside transaction or be parameterized for db name
        await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
        console.log(`Database "${dbName}" created successfully.`);
      }
    } catch (err) {
      console.error('Error checking/creating database:', err.message);
    } finally {
      try {
        await client.end();
      } catch (e) {}
    }
  }

  // Now create the pool for the target database
  pool = useConnectionString
    ? new Pool(pgConfig)
    : new Pool({ ...pgConfig, database: dbName });

  // Initialize schema
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS faculty (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        designation VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255) UNIQUE,
        time_in VARCHAR(10),
        time_out VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        branch VARCHAR(100) NOT NULL,
        semester INTEGER NOT NULL,
        code VARCHAR(50) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK(type IN ('theory','lab','tutorial')),
        credits INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_code_type UNIQUE(code, type)
      );

      CREATE TABLE IF NOT EXISTS faculty_subjects (
        id SERIAL PRIMARY KEY,
        faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        lecture_count INTEGER NOT NULL,
        batch_option VARCHAR(20) DEFAULT 'whole' CHECK(batch_option IN ('whole','batch1','batch2')),
        section VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_faculty_subject_batch_section UNIQUE(faculty_id, subject_id, batch_option, section)
      );

      CREATE TABLE IF NOT EXISTS timetable_slots (
        id SERIAL PRIMARY KEY,
        day VARCHAR(20) NOT NULL CHECK(day IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
        time_slot VARCHAR(50) NOT NULL,
        faculty_id INTEGER REFERENCES faculty(id) ON DELETE SET NULL,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
        room VARCHAR(50),
        batch VARCHAR(20) DEFAULT 'whole',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_day_slot_faculty UNIQUE(day, time_slot, faculty_id)
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        date VARCHAR(20) NOT NULL,
        faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK(status IN ('present','absent')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_date_faculty UNIQUE(date, faculty_id)
      );
    `);

    // Add section column if not exists
    await pool.query('ALTER TABLE timetable_slots ADD COLUMN IF NOT EXISTS section VARCHAR(50);');

    console.log('PostgreSQL schema initialized successfully.');
  } catch (err) {
    console.error('Error initializing schema:', err.message);
  }
}

module.exports = {
  initDb,
  query: (text, params) => {
    if (!pool) {
      throw new Error('Database pool not initialized. Call initDb() first.');
    }
    return pool.query(text, params);
  },
  getPool: () => pool
};
