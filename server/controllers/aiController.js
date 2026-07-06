const db = require('../config/db');

const suggestReplacement = async (req, res) => {
  try {
    const { date, day, time_slot, absent_faculty_id } = req.body;

    if (!day || !time_slot || !absent_faculty_id) {
      return res.status(400).json({ error: 'day, time_slot, and absent_faculty_id are required' });
    }

    const absentId = parseInt(absent_faculty_id);

    // Get absent faculty details
    const absentFacultyQuery = await db.query('SELECT * FROM faculty WHERE id = $1', [absentId]);
    if (absentFacultyQuery.rowCount === 0) {
      return res.status(404).json({ error: 'Faculty not found' });
    }
    const absentFaculty = absentFacultyQuery.rows[0];

    // Find the slot(s) the absent faculty is supposed to teach
    const absentSlotsQuery = await db.query(
      'SELECT * FROM timetable_slots WHERE faculty_id = $1 AND day = $2 AND time_slot = $3',
      [absentId, day, time_slot]
    );

    if (absentSlotsQuery.rowCount === 0) {
      return res.json({
        absent_faculty: absentFaculty,
        message: 'No scheduled class found for this faculty at the given time',
        priority1: [],
        priority2: [],
        priority3: []
      });
    }

    const absentSlot = absentSlotsQuery.rows[0];
    const subjectId = absentSlot.subject_id;
    const batch = absentSlot.batch;

    // All faculty except the absent one
    const allFacultyQuery = await db.query('SELECT * FROM faculty WHERE id <> $1', [absentId]);
    const allFaculty = allFacultyQuery.rows;

    // Faculty already busy at this slot
    const busyQuery = await db.query(
      'SELECT faculty_id FROM timetable_slots WHERE day = $1 AND time_slot = $2 AND faculty_id IS NOT NULL AND faculty_id <> $3',
      [day, time_slot, absentId]
    );
    const busyIds = new Set(busyQuery.rows.map(r => r.faculty_id));

    // Available faculty (not busy at this time)
    const availableFaculty = allFaculty.filter(f => !busyIds.has(f.id));

    // Check in/out timing availability
    const slotHour = parseInt((time_slot || '09:00').split(':')[0]);
    const timeAvailable = availableFaculty.filter(f => {
      if (!f.time_in || !f.time_out) return true;
      const inHour = parseInt(f.time_in.split(':')[0]);
      const outHour = parseInt(f.time_out.split(':')[0]);
      return slotHour >= inHour && slotHour < outHour;
    });

    const availableIds = new Set(timeAvailable.map(f => f.id));

    // Priority 1: Faculty who already teach the SAME subject+batch in the timetable
    const priority1Ids = new Set();
    if (subjectId) {
      const sameClassQuery = await db.query(
        `SELECT DISTINCT faculty_id FROM timetable_slots 
         WHERE subject_id = $1 AND batch = $2 AND faculty_id IS NOT NULL AND faculty_id <> $3`,
        [subjectId, batch, absentId]
      );
      sameClassQuery.rows.forEach(r => {
        if (availableIds.has(r.faculty_id)) {
          priority1Ids.add(r.faculty_id);
        }
      });
    }

    const priority1 = timeAvailable
      .filter(f => priority1Ids.has(f.id))
      .map(f => ({ ...f, priority: 1, reason: 'Already teaches this exact class/batch' }));

    // Priority 2: Faculty who teach the same subject (via mapping) but not already in P1
    const priority2Ids = new Set();
    if (subjectId) {
      const sameMappingsQuery = await db.query(
        `SELECT DISTINCT fs.faculty_id FROM faculty_subjects fs
         WHERE fs.subject_id = $1 AND fs.faculty_id <> $2`,
        [subjectId, absentId]
      );
      sameMappingsQuery.rows.forEach(r => {
        if (availableIds.has(r.faculty_id) && !priority1Ids.has(r.faculty_id)) {
          priority2Ids.add(r.faculty_id);
        }
      });
    }

    const priority2 = timeAvailable
      .filter(f => priority2Ids.has(f.id))
      .map(f => ({ ...f, priority: 2, reason: 'Teaches the same subject' }));

    // Priority 3: All other available faculty (not in P1 or P2)
    const priority3 = timeAvailable
      .filter(f => !priority1Ids.has(f.id) && !priority2Ids.has(f.id))
      .map(f => ({ ...f, priority: 3, reason: 'Available at this time slot' }));

    // Get subject info
    let subject = null;
    if (subjectId) {
      const subjectQuery = await db.query('SELECT * FROM subjects WHERE id = $1', [subjectId]);
      subject = subjectQuery.rows[0] || null;
    }

    res.json({
      absent_faculty: absentFaculty,
      slot_info: {
        day,
        time_slot,
        subject: subject ? `${subject.name} (${subject.code})` : 'N/A',
        batch,
        room: absentSlot.room
      },
      priority1,
      priority2,
      priority3,
      total_available: priority1.length + priority2.length + priority3.length
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const markAttendance = async (req, res) => {
  try {
    const { date, faculty_id, status } = req.body;
    if (!date || !faculty_id || !status) {
      return res.status(400).json({ error: 'date, faculty_id, and status are required' });
    }

    const faculty = await db.query('SELECT 1 FROM faculty WHERE id = $1', [parseInt(faculty_id)]);
    if (faculty.rowCount === 0) {
      return res.status(404).json({ error: 'Faculty not found' });
    }

    // ON CONFLICT upsert
    const query = `
      INSERT INTO attendance (date, faculty_id, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (date, faculty_id) 
      DO UPDATE SET status = EXCLUDED.status
      RETURNING *
    `;
    const result = await db.query(query, [date, parseInt(faculty_id), status]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAttendance = async (req, res) => {
  try {
    const { date } = req.query;
    let query = `
      SELECT a.*, f.name AS faculty_name 
      FROM attendance a
      JOIN faculty f ON a.faculty_id = f.id
    `;
    const params = [];
    if (date) {
      params.push(date);
      query += ' WHERE a.date = $1';
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { suggestReplacement, markAttendance, getAttendance };
