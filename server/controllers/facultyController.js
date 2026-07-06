const db = require('../config/db');

const getAll = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM faculty ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { name, designation, phone, email, time_in, time_out } = req.body;
    if (!name || !designation) {
      return res.status(400).json({ error: 'Name and designation are required' });
    }

    // Check unique email
    if (email) {
      const existing = await db.query('SELECT 1 FROM faculty WHERE email = $1', [email]);
      if (existing.rowCount > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    const result = await db.query(
      `INSERT INTO faculty (name, designation, phone, email, time_in, time_out) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, designation, phone || null, email || null, time_in || null, time_out || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, designation, phone, email, time_in, time_out } = req.body;

    const existing = await db.query('SELECT * FROM faculty WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Faculty not found' });
    }

    if (email && email !== existing.rows[0].email) {
      const emailCheck = await db.query('SELECT 1 FROM faculty WHERE email = $1 AND id <> $2', [email, id]);
      if (emailCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    const result = await db.query(
      `UPDATE faculty SET name=$1, designation=$2, phone=$3, email=$4, time_in=$5, time_out=$6 
       WHERE id=$7 RETURNING *`,
      [name, designation, phone, email, time_in, time_out, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query('SELECT 1 FROM faculty WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Faculty not found' });
    }

    await db.query('DELETE FROM faculty WHERE id = $1', [id]);
    res.json({ message: 'Faculty deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAll, create, update, remove };
