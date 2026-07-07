const db = require('../config/db');

const saveFacultySubjects = async (client, facultyId, subjectsList) => {
  // Reconcile assignments by removing existing ones and recreating them
  await client.query('DELETE FROM faculty_subjects WHERE faculty_id = $1', [facultyId]);

  if (!Array.isArray(subjectsList) || subjectsList.length === 0) {
    return;
  }

  for (const s of subjectsList) {
    const name = s.subject_name || s.name;
    const code = s.subject_code || s.code;
    const branch = s.subject_branch || s.branch;
    const semester = s.subject_semester || s.semester;
    const type = s.subject_type || s.type;
    const batch_option = s.batch_option || 'whole';
    const lecture_count = s.lecture_count;

    if (!name || !code) continue;

    let finalLectureCount = parseInt(lecture_count);
    if (isNaN(finalLectureCount)) {
      if (type === 'lab') finalLectureCount = 2;
      else if (type === 'tutorial') finalLectureCount = 1;
      else finalLectureCount = 3;
    }
    const finalCredits = finalLectureCount;

    let subjectId;
    const existingSubject = await client.query('SELECT id FROM subjects WHERE LOWER(code) = $1', [code.trim().toLowerCase()]);
    
    if (existingSubject.rowCount > 0) {
      subjectId = existingSubject.rows[0].id;
      await client.query(
        `UPDATE subjects SET name = $1, branch = $2, semester = $3, type = $4, credits = $5 WHERE id = $6`,
        [name.trim(), branch ? branch.trim() : 'CSE', parseInt(semester) || 1, type || 'theory', finalCredits, subjectId]
      );
    } else {
      const newSubject = await client.query(
        `INSERT INTO subjects (name, code, branch, semester, type, credits) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [name.trim(), code.trim().toUpperCase(), branch ? branch.trim() : 'CSE', parseInt(semester) || 1, type || 'theory', finalCredits]
      );
      subjectId = newSubject.rows[0].id;
    }

    await client.query(
      `INSERT INTO faculty_subjects (faculty_id, subject_id, lecture_count, batch_option)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (faculty_id, subject_id, batch_option) 
       DO UPDATE SET lecture_count = EXCLUDED.lecture_count`,
      [facultyId, subjectId, finalLectureCount, batch_option]
    );
  }
};

const getAll = async (req, res) => {
  try {
    const query = `
      SELECT 
        f.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', fs.id,
              'subject_id', s.id,
              'subject_name', s.name,
              'subject_code', s.code,
              'subject_branch', s.branch,
              'subject_semester', s.semester,
              'subject_type', s.type,
              'subject_credits', s.credits,
              'lecture_count', fs.lecture_count,
              'batch_option', fs.batch_option
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS subjects
      FROM faculty f
      LEFT JOIN faculty_subjects fs ON f.id = fs.faculty_id
      LEFT JOIN subjects s ON fs.subject_id = s.id
      GROUP BY f.id
      ORDER BY f.name
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const create = async (req, res) => {
  const { name, designation, phone, email, time_in, time_out, subjects } = req.body;
  if (!name || !designation) {
    return res.status(400).json({ error: 'Name and designation are required' });
  }

  const pool = db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (email) {
      const existing = await client.query('SELECT 1 FROM faculty WHERE email = $1', [email]);
      if (existing.rowCount > 0) {
        throw new Error('Email already exists');
      }
    }

    const result = await client.query(
      `INSERT INTO faculty (name, designation, phone, email, time_in, time_out) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, designation, phone || null, email || null, time_in || null, time_out || null]
    );
    const newFaculty = result.rows[0];

    await saveFacultySubjects(client, newFaculty.id, subjects);

    await client.query('COMMIT');

    const enriched = await client.query(`
      SELECT 
        f.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', fs.id,
              'subject_id', s.id,
              'subject_name', s.name,
              'subject_code', s.code,
              'subject_branch', s.branch,
              'subject_semester', s.semester,
              'subject_type', s.type,
              'subject_credits', s.credits,
              'lecture_count', fs.lecture_count,
              'batch_option', fs.batch_option
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS subjects
      FROM faculty f
      LEFT JOIN faculty_subjects fs ON f.id = fs.faculty_id
      LEFT JOIN subjects s ON fs.subject_id = s.id
      WHERE f.id = $1
      GROUP BY f.id
    `, [newFaculty.id]);

    res.status(201).json(enriched.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  const { name, designation, phone, email, time_in, time_out, subjects } = req.body;

  const pool = db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM faculty WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      throw new Error('Faculty not found');
    }

    if (email && email !== existing.rows[0].email) {
      const emailCheck = await client.query('SELECT 1 FROM faculty WHERE email = $1 AND id <> $2', [email, id]);
      if (emailCheck.rowCount > 0) {
        throw new Error('Email already exists');
      }
    }

    await client.query(
      `UPDATE faculty SET name=$1, designation=$2, phone=$3, email=$4, time_in=$5, time_out=$6 
       WHERE id=$7`,
      [name, designation, phone, email, time_in, time_out, id]
    );

    await saveFacultySubjects(client, id, subjects);

    await client.query('COMMIT');

    const enriched = await client.query(`
      SELECT 
        f.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', fs.id,
              'subject_id', s.id,
              'subject_name', s.name,
              'subject_code', s.code,
              'subject_branch', s.branch,
              'subject_semester', s.semester,
              'subject_type', s.type,
              'subject_credits', s.credits,
              'lecture_count', fs.lecture_count,
              'batch_option', fs.batch_option
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS subjects
      FROM faculty f
      LEFT JOIN faculty_subjects fs ON f.id = fs.faculty_id
      LEFT JOIN subjects s ON fs.subject_id = s.id
      WHERE f.id = $1
      GROUP BY f.id
    `, [id]);

    res.json(enriched.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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

const bulkCreate = async (req, res) => {
  const { faculty } = req.body;
  if (!Array.isArray(faculty) || faculty.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty faculty list' });
  }

  const pool = db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const inserted = [];
    const skipped = [];
    const seenEmailsInBatch = new Set();

    for (const f of faculty) {
      const { name, designation, phone, email, time_in, time_out, subjects } = f;

      if (!name || !designation) {
        throw new Error(`Name and designation are required (found row with Name: "${name || 'empty'}")`);
      }

      // Track email duplicates
      if (email) {
        const trimmedEmail = email.trim().toLowerCase();
        
        // Check duplicate within the uploaded batch
        if (seenEmailsInBatch.has(trimmedEmail)) {
          skipped.push({ name, email, reason: 'Duplicate email in upload batch' });
          continue;
        }
        seenEmailsInBatch.add(trimmedEmail);

        // Check duplicate in database
        const existing = await client.query('SELECT 1 FROM faculty WHERE LOWER(email) = $1', [trimmedEmail]);
        if (existing.rowCount > 0) {
          skipped.push({ name, email, reason: 'Email already exists in database' });
          continue;
        }
      }

      const resInsert = await client.query(
        `INSERT INTO faculty (name, designation, phone, email, time_in, time_out) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          name.trim(), 
          designation.trim(), 
          phone ? phone.trim() : null, 
          email ? email.trim() : null, 
          time_in ? time_in.trim() : null, 
          time_out ? time_out.trim() : null
        ]
      );
      const newFaculty = resInsert.rows[0];

      // Save nested subjects for this imported faculty
      await saveFacultySubjects(client, newFaculty.id, subjects);

      // Fetch enriched record
      const enriched = await client.query(`
        SELECT 
          f.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', fs.id,
                'subject_id', s.id,
                'subject_name', s.name,
                'subject_code', s.code,
                'subject_branch', s.branch,
                'subject_semester', s.semester,
                'subject_type', s.type,
                'subject_credits', s.credits,
                'lecture_count', fs.lecture_count,
                'batch_option', fs.batch_option
              )
            ) FILTER (WHERE s.id IS NOT NULL),
            '[]'
          ) AS subjects
        FROM faculty f
        LEFT JOIN faculty_subjects fs ON f.id = fs.faculty_id
        LEFT JOIN subjects s ON fs.subject_id = s.id
        WHERE f.id = $1
        GROUP BY f.id
      `, [newFaculty.id]);

      inserted.push(enriched.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      insertedCount: inserted.length,
      inserted,
      skipped
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

module.exports = { getAll, create, update, remove, bulkCreate };
