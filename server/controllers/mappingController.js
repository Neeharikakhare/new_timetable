const db = require('../config/db');

function calcLectureCount(type) {
  if (type === 'theory') return 3;
  if (type === 'lab') return 2;
  if (type === 'tutorial') return 1;
  return 3;
}

const getAll = async (req, res) => {
  try {
    const query = `
      SELECT 
        fs.id,
        fs.faculty_id,
        fs.subject_id,
        fs.lecture_count,
        fs.batch_option,
        f.name AS faculty_name,
        f.designation AS faculty_designation,
        s.name AS subject_name,
        s.code AS subject_code,
        s.type AS subject_type,
        s.branch AS subject_branch,
        s.semester AS subject_semester,
        s.credits AS subject_credits
      FROM faculty_subjects fs
      JOIN faculty f ON fs.faculty_id = f.id
      JOIN subjects s ON fs.subject_id = s.id
      ORDER BY f.name, s.name
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { faculty_id, subject_id, lecture_count_override, batch_option } = req.body;
    if (!faculty_id || !subject_id) {
      return res.status(400).json({ error: 'Faculty and Subject are required' });
    }

    const faculty = await db.query('SELECT 1 FROM faculty WHERE id = $1', [faculty_id]);
    if (faculty.rowCount === 0) {
      return res.status(400).json({ error: 'Faculty not found' });
    }

    const subject = await db.query('SELECT * FROM subjects WHERE id = $1', [subject_id]);
    if (subject.rowCount === 0) {
      return res.status(400).json({ error: 'Subject not found' });
    }

    const batch = batch_option || 'whole';
    const checkDuplicate = await db.query(
      'SELECT 1 FROM faculty_subjects WHERE faculty_id = $1 AND subject_id = $2 AND batch_option = $3',
      [faculty_id, subject_id, batch]
    );

    if (checkDuplicate.rowCount > 0) {
      return res.status(400).json({ error: 'This faculty-subject mapping already exists' });
    }

    const lectureCount = lecture_count_override ? parseInt(lecture_count_override) : calcLectureCount(subject.rows[0].type);

    const insertResult = await db.query(
      `INSERT INTO faculty_subjects (faculty_id, subject_id, lecture_count, batch_option) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [parseInt(faculty_id), parseInt(subject_id), lectureCount, batch]
    );

    const queryEnriched = `
      SELECT 
        fs.id,
        fs.faculty_id,
        fs.subject_id,
        fs.lecture_count,
        fs.batch_option,
        f.name AS faculty_name,
        f.designation AS faculty_designation,
        s.name AS subject_name,
        s.code AS subject_code,
        s.type AS subject_type,
        s.branch AS subject_branch,
        s.semester AS subject_semester,
        s.credits AS subject_credits
      FROM faculty_subjects fs
      JOIN faculty f ON fs.faculty_id = f.id
      JOIN subjects s ON fs.subject_id = s.id
      WHERE fs.id = $1
    `;
    const enrichedResult = await db.query(queryEnriched, [insertResult.rows[0].id]);
    res.status(201).json(enrichedResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { lecture_count, batch_option } = req.body;

    const existing = await db.query('SELECT 1 FROM faculty_subjects WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    const updates = [];
    const params = [];
    if (lecture_count !== undefined) {
      params.push(parseInt(lecture_count));
      updates.push(`lecture_count = $${params.length}`);
    }
    if (batch_option !== undefined) {
      params.push(batch_option);
      updates.push(`batch_option = $${params.length}`);
    }

    params.push(id);
    const query = `UPDATE faculty_subjects SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`;
    await db.query(query, params);

    const queryEnriched = `
      SELECT 
        fs.id,
        fs.faculty_id,
        fs.subject_id,
        fs.lecture_count,
        fs.batch_option,
        f.name AS faculty_name,
        f.designation AS faculty_designation,
        s.name AS subject_name,
        s.code AS subject_code,
        s.type AS subject_type,
        s.branch AS subject_branch,
        s.semester AS subject_semester,
        s.credits AS subject_credits
      FROM faculty_subjects fs
      JOIN faculty f ON fs.faculty_id = f.id
      JOIN subjects s ON fs.subject_id = s.id
      WHERE fs.id = $1
    `;
    const enrichedResult = await db.query(queryEnriched, [id]);
    res.json(enrichedResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query('SELECT 1 FROM faculty_subjects WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    await db.query('DELETE FROM faculty_subjects WHERE id = $1', [id]);
    res.json({ message: 'Mapping deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAutoCount = async (req, res) => {
  try {
    const { subject_id } = req.params;
    const subject = await db.query('SELECT type FROM subjects WHERE id = $1', [subject_id]);
    if (subject.rowCount === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    const type = subject.rows[0].type;
    res.json({ lecture_count: calcLectureCount(type), type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAll, create, update, remove, getAutoCount };
