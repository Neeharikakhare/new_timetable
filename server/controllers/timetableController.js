const db = require('../config/db');

const getAll = async (req, res) => {
  try {
    const query = `
      SELECT 
        ts.id,
        ts.day,
        ts.time_slot,
        ts.faculty_id,
        ts.subject_id,
        ts.room,
        ts.batch,
        f.name AS faculty_name,
        s.name AS subject_name,
        s.type AS subject_type,
        s.code AS subject_code
      FROM timetable_slots ts
      LEFT JOIN faculty f ON ts.faculty_id = f.id
      LEFT JOIN subjects s ON ts.subject_id = s.id
      ORDER BY ts.day, ts.time_slot
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const upsertSlot = async (req, res) => {
  try {
    const { id, day, time_slot, faculty_id, subject_id, room, batch } = req.body;
    if (!day || !time_slot) {
      return res.status(400).json({ error: 'Day and time slot are required' });
    }

    const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (!VALID_DAYS.includes(day)) {
      return res.status(400).json({ error: 'Invalid day' });
    }

    // Check conflict: same faculty same day+time
    if (faculty_id) {
      let conflictQuery = 'SELECT id FROM timetable_slots WHERE day = $1 AND time_slot = $2 AND faculty_id = $3';
      const conflictParams = [day, time_slot, parseInt(faculty_id)];

      if (id) {
        conflictParams.push(parseInt(id));
        conflictQuery += ' AND id <> $4';
      }

      const conflictCheck = await db.query(conflictQuery, conflictParams);
      if (conflictCheck.rowCount > 0) {
        const facultyNameQuery = await db.query('SELECT name FROM faculty WHERE id = $1', [faculty_id]);
        const facultyName = facultyNameQuery.rows[0]?.name || 'Faculty';
        return res.status(400).json({
          error: `Conflict: ${facultyName} is already scheduled at this time`
        });
      }
    }

    let result;
    if (id) {
      // Update
      const query = `
        UPDATE timetable_slots 
        SET day=$1, time_slot=$2, faculty_id=$3, subject_id=$4, room=$5, batch=$6 
        WHERE id=$7 RETURNING *
      `;
      result = await db.query(query, [
        day, time_slot,
        faculty_id ? parseInt(faculty_id) : null,
        subject_id ? parseInt(subject_id) : null,
        room || '', batch || 'whole', parseInt(id)
      ]);
    } else {
      // Insert
      const query = `
        INSERT INTO timetable_slots (day, time_slot, faculty_id, subject_id, room, batch) 
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `;
      result = await db.query(query, [
        day, time_slot,
        faculty_id ? parseInt(faculty_id) : null,
        subject_id ? parseInt(subject_id) : null,
        room || '', batch || 'whole'
      ]);
    }

    // Fetch enriched updated/inserted row
    const queryEnriched = `
      SELECT 
        ts.id,
        ts.day,
        ts.time_slot,
        ts.faculty_id,
        ts.subject_id,
        ts.room,
        ts.batch,
        f.name AS faculty_name,
        s.name AS subject_name,
        s.type AS subject_type,
        s.code AS subject_code
      FROM timetable_slots ts
      LEFT JOIN faculty f ON ts.faculty_id = f.id
      LEFT JOIN subjects s ON ts.subject_id = s.id
      WHERE ts.id = $1
    `;
    const enrichedResult = await db.query(queryEnriched, [result.rows[0].id]);
    res.status(201).json(enrichedResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query('SELECT 1 FROM timetable_slots WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    await db.query('DELETE FROM timetable_slots WHERE id = $1', [id]);
    res.json({ message: 'Slot deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getConflicts = async (req, res) => {
  try {
    // Find any duplicate bookings (same day, same time slot, same faculty)
    const query = `
      SELECT ts1.id AS slot1_id, ts2.id AS slot2_id, ts1.day, ts1.time_slot, ts1.faculty_id 
      FROM timetable_slots ts1
      JOIN timetable_slots ts2 ON ts1.day = ts2.day 
        AND ts1.time_slot = ts2.time_slot 
        AND ts1.faculty_id = ts2.faculty_id 
        AND ts1.id < ts2.id
      WHERE ts1.faculty_id IS NOT NULL
    `;
    const result = await db.query(query);

    // Format conflicts to match frontend expectations
    const conflicts = result.rows.map(row => ({
      slot1: { id: row.slot1_id, day: row.day, time_slot: row.time_slot, faculty_id: row.faculty_id },
      slot2: { id: row.slot2_id, day: row.day, time_slot: row.time_slot, faculty_id: row.faculty_id },
      reason: 'Same faculty double-booked'
    }));

    res.json(conflicts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAll, upsertSlot, deleteSlot, getConflicts };
