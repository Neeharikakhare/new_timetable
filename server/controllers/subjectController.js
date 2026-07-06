const db = require('../config/db');

const getAll = async (req, res) => {
  try {
    const { branch, semester } = req.query;
    let queryText = 'SELECT * FROM subjects';
    const params = [];
    const conditions = [];

    if (branch) {
      params.push(branch);
      conditions.push(`branch = $${params.length}`);
    }
    if (semester) {
      params.push(parseInt(semester));
      conditions.push(`semester = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY name';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { name, branch, semester, code, type, credits } = req.body;
    if (!name || !branch || !semester || !code || !type || !credits) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!['theory', 'lab', 'tutorial'].includes(type)) {
      return res.status(400).json({ error: 'Type must be theory, lab, or tutorial' });
    }

    const codeCheck = await db.query('SELECT 1 FROM subjects WHERE code = $1', [code]);
    if (codeCheck.rowCount > 0) {
      return res.status(400).json({ error: 'Subject code already exists' });
    }

    const result = await db.query(
      `INSERT INTO subjects (name, branch, semester, code, type, credits) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, branch, parseInt(semester), code, type, parseInt(credits)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, branch, semester, code, type, credits } = req.body;

    const existing = await db.query('SELECT * FROM subjects WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (code && code !== existing.rows[0].code) {
      const codeCheck = await db.query('SELECT 1 FROM subjects WHERE code = $1 AND id <> $2', [code, id]);
      if (codeCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Subject code already exists' });
      }
    }
    if (type && !['theory', 'lab', 'tutorial'].includes(type)) {
      return res.status(400).json({ error: 'Type must be theory, lab, or tutorial' });
    }

    const result = await db.query(
      `UPDATE subjects SET name=$1, branch=$2, semester=$3, code=$4, type=$5, credits=$6 
       WHERE id=$7 RETURNING *`,
      [name, branch, parseInt(semester), code, type, parseInt(credits), id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query('SELECT 1 FROM subjects WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    await db.query('DELETE FROM subjects WHERE id = $1', [id]);
    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getBranches = async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT branch FROM subjects ORDER BY branch');
    res.json(result.rows.map(r => r.branch));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAll, create, update, remove, getBranches };
