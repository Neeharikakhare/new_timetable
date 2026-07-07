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
        ts.section,
        f.name AS faculty_name,
        s.name AS subject_name,
        s.type AS subject_type,
        s.code AS subject_code,
        s.semester AS subject_semester,
        s.branch AS subject_branch
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
    const { id, day, time_slot, faculty_id, subject_id, room, batch, section } = req.body;
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

    // Check conflict: same section same day+time
    if (section) {
      let sectionConflictQuery = `
        SELECT ts.id, s.name AS subject_name, ts.batch 
        FROM timetable_slots ts
        LEFT JOIN subjects s ON ts.subject_id = s.id
        WHERE ts.day = $1 AND ts.time_slot = $2 AND ts.section = $3
      `;
      const sectionParams = [day, time_slot, section];
      
      if (id) {
        sectionParams.push(parseInt(id));
        sectionConflictQuery += ' AND ts.id <> $4';
      }
      
      const sectionCheck = await db.query(sectionConflictQuery, sectionParams);
      if (sectionCheck.rowCount > 0) {
        let hasConflict = false;
        let conflictMsg = '';
        for (const row of sectionCheck.rows) {
          if (batch === 'whole' || row.batch === 'whole' || batch === row.batch) {
            hasConflict = true;
            conflictMsg = `Conflict: Section ${section} (${row.batch === 'whole' ? 'Whole Batch' : row.batch}) is already scheduled for "${row.subject_name}" at this time.`;
            break;
          }
        }
        if (hasConflict) {
          return res.status(400).json({ error: conflictMsg });
        }
      }
    }

    let result;
    if (id) {
      // Update
      const query = `
        UPDATE timetable_slots 
        SET day=$1, time_slot=$2, faculty_id=$3, subject_id=$4, room=$5, batch=$6, section=$7 
        WHERE id=$8 RETURNING *
      `;
      result = await db.query(query, [
        day, time_slot,
        faculty_id ? parseInt(faculty_id) : null,
        subject_id ? parseInt(subject_id) : null,
        room || '', batch || 'whole', section || null, parseInt(id)
      ]);
    } else {
      // Insert
      const query = `
        INSERT INTO timetable_slots (day, time_slot, faculty_id, subject_id, room, batch, section) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
      `;
      result = await db.query(query, [
        day, time_slot,
        faculty_id ? parseInt(faculty_id) : null,
        subject_id ? parseInt(subject_id) : null,
        room || '', batch || 'whole', section || null
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
        ts.section,
        f.name AS faculty_name,
        s.name AS subject_name,
        s.type AS subject_type,
        s.code AS subject_code,
        s.semester AS subject_semester,
        s.branch AS subject_branch
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

const generateSemester = async (req, res) => {
  try {
    const { semester } = req.body;
    if (!semester) {
      return res.status(400).json({ error: 'Semester is required' });
    }

    const sem = parseInt(semester);
    if (isNaN(sem) || sem < 1 || sem > 8) {
      return res.status(400).json({ error: 'Invalid semester' });
    }

    // Determine sections for the semester
    let sections = [];
    if (sem === 3 || sem === 4) {
      sections = ['CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E', 'CSE F', 'CSBS A', 'CSBS B'];
    } else if (sem === 5 || sem === 6) {
      sections = ['CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E', 'CSE F'];
    } else {
      return res.status(400).json({ error: 'Unsupported semester for auto-generation' });
    }

    // Fetch subjects of this semester
    const subjectsRes = await db.query(
      'SELECT * FROM subjects WHERE semester = $1',
      [sem]
    );
    const subjects = subjectsRes.rows;

    if (subjects.length === 0) {
      return res.status(400).json({ error: 'No subjects found for this semester. Add subjects first.' });
    }

    // Fetch faculty mappings for these subjects
    const mappingsRes = await db.query(
      `SELECT fs.*, f.name AS faculty_name, f.time_in, f.time_out, s.name AS subject_name, s.code AS subject_code, s.type AS subject_type, s.branch AS subject_branch
       FROM faculty_subjects fs
       JOIN faculty f ON fs.faculty_id = f.id
       JOIN subjects s ON fs.subject_id = s.id
       WHERE s.semester = $1`,
       [sem]
    );
    const mappings = mappingsRes.rows;

    if (mappings.length === 0) {
      return res.status(400).json({ error: 'No faculty-subject assignments found for this semester. Create assignments first.' });
    }

    // Fetch all existing timetable slots across ALL semesters so we can prevent faculty collision
    const allSlotsRes = await db.query(
      `SELECT ts.*, s.semester AS subject_semester 
       FROM timetable_slots ts
       LEFT JOIN subjects s ON ts.subject_id = s.id`
    );
    const allSlots = allSlotsRes.rows;

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const TIME_SLOTS = [
      '08:30-09:20', '09:20-10:10', '10:10-11:00', '11:00-11:50',
      '12:30-01:20', '01:20-02:10', '02:10-03:00'
    ];

    // Helper to extract start/end hour of a slot
    const getSlotHours = (slotStr) => {
      const [start, end] = slotStr.split('-');
      const startHour = parseInt(start.split(':')[0]);
      const endHour = parseInt(end.split(':')[0]);
      return { startHour, endHour };
    };

    // Helper to check if a slot fits in faculty work hours
    const isFacultyWithinWorkingHours = (faculty, timeSlot) => {
      if (!faculty.time_in || !faculty.time_out) return true;
      const { startHour, endHour } = getSlotHours(timeSlot);
      const inHour = parseInt(faculty.time_in.split(':')[0]);
      const outHour = parseInt(faculty.time_out.split(':')[0]);
      return startHour >= inHour && endHour <= outHour;
    };

    // Build lists of slots for OTHER semesters that must be preserved
    const preservedSlots = allSlots.filter(slot => !sections.includes(slot.section));

    // Busy faculty tracker for preserved slots
    const busyFacultyTracker = {};
    DAYS.forEach(day => {
      busyFacultyTracker[day] = {};
      TIME_SLOTS.forEach(ts => {
        busyFacultyTracker[day][ts] = new Set();
      });
    });

    preservedSlots.forEach(slot => {
      if (slot.faculty_id) {
        busyFacultyTracker[slot.day]?.[slot.time_slot]?.add(slot.faculty_id);
      }
    });

    // Group mappings by subject first
    const mappingsBySubject = {};
    mappings.forEach(m => {
      if (!mappingsBySubject[m.subject_id]) {
        mappingsBySubject[m.subject_id] = [];
      }
      mappingsBySubject[m.subject_id].push(m);
    });

    const THEORY_SLOTS_BY_DAY = {
      Monday: ['08:30-09:20', '09:20-10:10', '10:10-11:00', '11:00-11:50', '12:30-01:20'],
      Tuesday: ['08:30-09:20', '09:20-10:10', '10:10-11:00', '11:00-11:50', '12:30-01:20'],
      Wednesday: ['08:30-09:20', '09:20-10:10', '10:10-11:00', '11:00-11:50', '12:30-01:20'],
      Thursday: ['08:30-09:20', '09:20-10:10', '10:10-11:00', '11:00-11:50', '12:30-01:20'],
      Friday: ['08:30-09:20', '09:20-10:10', '10:10-11:00', '11:00-11:50', '12:30-01:20'],
      Saturday: ['10:10-11:00', '11:00-11:50']
    };

    const LAB_BLOCKS = [
      { day: 'Monday', slots: ['01:20-02:10', '02:10-03:00'] },
      { day: 'Tuesday', slots: ['01:20-02:10', '02:10-03:00'] },
      { day: 'Wednesday', slots: ['01:20-02:10', '02:10-03:00'] },
      { day: 'Thursday', slots: ['01:20-02:10', '02:10-03:00'] },
      { day: 'Friday', slots: ['01:20-02:10', '02:10-03:00'] },
      { day: 'Saturday', slots: ['08:30-09:20', '09:20-10:10'] }
    ];

    let generatedSlots = [];
    let success = false;
    const MAX_RETRIES = 200;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      generatedSlots = [];
      const attemptBusyFaculty = {};
      DAYS.forEach(day => {
        attemptBusyFaculty[day] = {};
        TIME_SLOTS.forEach(ts => {
          attemptBusyFaculty[day][ts] = new Set(busyFacultyTracker[day][ts]);
        });
      });

      const sectionSchedules = {};
      sections.forEach(sec => {
        sectionSchedules[sec] = {};
        DAYS.forEach(day => {
          sectionSchedules[sec][day] = {};
          TIME_SLOTS.forEach(ts => {
            sectionSchedules[sec][day][ts] = null;
          });
        });
      });

      // Create a list of requirements to schedule
      const requirements = [];
      
      // Group mappings by subject is already done outside the loop

      sections.forEach((sec, secIdx) => {
        const secBranch = sec.startsWith('CSE') ? 'CSE' : 'CSBS';
        const secSubjects = subjects.filter(sub => sub.branch.toUpperCase() === secBranch.toUpperCase());
        
        secSubjects.forEach(subject => {
          const subjectMappings = mappingsBySubject[subject.id];
          if (!subjectMappings || subjectMappings.length === 0) {
            return;
          }
          
          let mapping = subjectMappings.find(m => m.section && m.section.trim().toUpperCase() === sec.trim().toUpperCase());
          if (!mapping) {
            mapping = subjectMappings.find(m => !m.section || m.section.trim() === '' || m.section.trim().toUpperCase() === 'ALL');
          }
          if (!mapping) {
            mapping = subjectMappings[secIdx % subjectMappings.length];
          }
          const room = `${secBranch.toUpperCase()}-${300 + sem * 10 + (secIdx % 4) + 1}`;
          
          if (mapping.subject_type === 'lab') {
            const numBlocks = Math.floor(mapping.lecture_count / 2) || 1;
            for (let i = 0; i < numBlocks; i++) {
              requirements.push({
                section: sec,
                faculty_id: mapping.faculty_id,
                faculty_name: mapping.faculty_name,
                time_in: mapping.time_in,
                time_out: mapping.time_out,
                subject_id: mapping.subject_id,
                subject_name: mapping.subject_name,
                subject_type: mapping.subject_type,
                subject_code: mapping.subject_code,
                batch: mapping.batch_option || 'whole',
                room: `LAB-${secBranch.toUpperCase()}-${secIdx + 1}`,
                isLabBlock: true
              });
            }
          } else {
            for (let i = 0; i < mapping.lecture_count; i++) {
              requirements.push({
                section: sec,
                faculty_id: mapping.faculty_id,
                faculty_name: mapping.faculty_name,
                time_in: mapping.time_in,
                time_out: mapping.time_out,
                subject_id: mapping.subject_id,
                subject_name: mapping.subject_name,
                subject_type: mapping.subject_type,
                subject_code: mapping.subject_code,
                batch: mapping.batch_option || 'whole',
                room: room,
                isLabBlock: false
              });
            }
          }
        });
      });

      // Calculate faculty loads (number of slots assigned to each faculty in this generation batch)
      const facultyLoads = {};
      requirements.forEach(req => {
        if (req.faculty_id) {
          const weight = req.isLabBlock ? 2 : 1;
          facultyLoads[req.faculty_id] = (facultyLoads[req.faculty_id] || 0) + weight;
        }
      });

      // Sort requirements:
      // 1. Labs first, Tutorials second, Theory third
      // 2. Higher faculty load first (Most Constrained Faculty First)
      // 3. Random within ties to ensure backtracking search coverage
      requirements.sort((a, b) => {
        const typeWeight = { lab: 3, tutorial: 2, theory: 1 };
        const weightA = typeWeight[a.subject_type] || 0;
        const weightB = typeWeight[b.subject_type] || 0;
        if (weightA !== weightB) return weightB - weightA;
        
        const loadA = facultyLoads[a.faculty_id] || 0;
        const loadB = facultyLoads[b.faculty_id] || 0;
        if (loadA !== loadB) return loadB - loadA;
        
        return Math.random() - 0.5;
      });

      let placedCount = 0;

      for (const req of requirements) {
        let placed = false;

        if (req.isLabBlock) {
          // LAB PLACEMENT
          const shuffledBlocks = [...LAB_BLOCKS].sort(() => Math.random() - 0.5);
          for (const block of shuffledBlocks) {
            if (placed) break;

            const day = block.day;
            const [ts1, ts2] = block.slots;

            const existingInSec1 = sectionSchedules[req.section][day][ts1];
            const existingInSec2 = sectionSchedules[req.section][day][ts2];
            
            const checkSlotFree = (existing) => !existing || (req.batch !== 'whole' && existing.batch !== 'whole' && req.batch !== existing.batch);
            
            if (checkSlotFree(existingInSec1) && checkSlotFree(existingInSec2)) {
              const isFacultyBusy1 = attemptBusyFaculty[day][ts1].has(req.faculty_id);
              const isFacultyBusy2 = attemptBusyFaculty[day][ts2].has(req.faculty_id);
              if (isFacultyBusy1 || isFacultyBusy2) continue;

              const fitsWorkingHours1 = isFacultyWithinWorkingHours(req, ts1);
              const fitsWorkingHours2 = isFacultyWithinWorkingHours(req, ts2);
              if (!fitsWorkingHours1 || !fitsWorkingHours2) continue;

              sectionSchedules[req.section][day][ts1] = req;
              sectionSchedules[req.section][day][ts2] = req;
              attemptBusyFaculty[day][ts1].add(req.faculty_id);
              attemptBusyFaculty[day][ts2].add(req.faculty_id);

              generatedSlots.push({
                day,
                time_slot: ts1,
                faculty_id: req.faculty_id,
                subject_id: req.subject_id,
                room: req.room,
                batch: req.batch,
                section: req.section
              });
              generatedSlots.push({
                day,
                time_slot: ts2,
                faculty_id: req.faculty_id,
                subject_id: req.subject_id,
                room: req.room,
                batch: req.batch,
                section: req.section
              });

              placed = true;
              placedCount++;
              break;
            }
          }
        } else {
          // THEORY PLACEMENT
          const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);
          for (const day of shuffledDays) {
            if (placed) break;

            const sectionDaySlots = Object.values(sectionSchedules[req.section][day]);
            const alreadyHasSubjectToday = sectionDaySlots.some(s => s && s.subject_id === req.subject_id);
            if (req.subject_type === 'theory' && alreadyHasSubjectToday && attempt < 15) {
              continue;
            }

            const allowedSlots = THEORY_SLOTS_BY_DAY[day];
            const shuffledSlots = [...allowedSlots].sort(() => Math.random() - 0.5);

            for (const ts of shuffledSlots) {
              const existingInSec = sectionSchedules[req.section][day][ts];
              let sectionFree = !existingInSec || (req.batch !== 'whole' && existingInSec.batch !== 'whole' && req.batch !== existingInSec.batch);
              if (!sectionFree) continue;

              const isFacultyBusy = attemptBusyFaculty[day][ts].has(req.faculty_id);
              if (isFacultyBusy) continue;

              const fitsWorkingHours = isFacultyWithinWorkingHours(req, ts);
              if (!fitsWorkingHours) continue;

              sectionSchedules[req.section][day][ts] = req;
              attemptBusyFaculty[day][ts].add(req.faculty_id);
              
              generatedSlots.push({
                day,
                time_slot: ts,
                faculty_id: req.faculty_id,
                subject_id: req.subject_id,
                room: req.room,
                batch: req.batch,
                section: req.section
              });

              placed = true;
              placedCount++;
              break;
            }
          }
        }
      }

      if (placedCount === requirements.length) {
        success = true;
        break;
      }
    }

    if (!success) {
      // Calculate faculty loads (number of slots assigned to each faculty in this generation batch)
      const facultyLoads = {};
      sections.forEach((sec, secIdx) => {
        const secBranch = sec.startsWith('CSE') ? 'CSE' : 'CSBS';
        const secSubjects = subjects.filter(sub => sub.branch.toUpperCase() === secBranch.toUpperCase());
        secSubjects.forEach(subject => {
          const subjectMappings = mappingsBySubject[subject.id];
          if (!subjectMappings || subjectMappings.length === 0) return;
          let mapping = subjectMappings.find(m => m.section && m.section.trim().toUpperCase() === sec.trim().toUpperCase());
          if (!mapping) {
            mapping = subjectMappings.find(m => !m.section || m.section.trim() === '' || m.section.trim().toUpperCase() === 'ALL');
          }
          if (!mapping) {
            mapping = subjectMappings[secIdx % subjectMappings.length];
          }
          facultyLoads[mapping.faculty_id] = (facultyLoads[mapping.faculty_id] || 0) + mapping.lecture_count;
        });
      });

      const attemptBusyFaculty = {};
      DAYS.forEach(day => {
        attemptBusyFaculty[day] = {};
        TIME_SLOTS.forEach(ts => {
          attemptBusyFaculty[day][ts] = new Set(busyFacultyTracker[day][ts]);
        });
      });

      const sectionSchedules = {};
      sections.forEach(sec => {
        sectionSchedules[sec] = {};
        DAYS.forEach(day => {
          sectionSchedules[sec][day] = {};
          TIME_SLOTS.forEach(ts => {
            sectionSchedules[sec][day][ts] = null;
          });
        });
      });

      generatedSlots = [];
      
      const requirements = [];
      sections.forEach((sec, secIdx) => {
        const secBranch = sec.startsWith('CSE') ? 'CSE' : 'CSBS';
        const secSubjects = subjects.filter(sub => sub.branch.toUpperCase() === secBranch.toUpperCase());
        
        secSubjects.forEach(subject => {
          const subjectMappings = mappingsBySubject[subject.id];
          if (!subjectMappings || subjectMappings.length === 0) return;
          
          let mapping = subjectMappings.find(m => m.section && m.section.trim().toUpperCase() === sec.trim().toUpperCase());
          if (!mapping) {
            mapping = subjectMappings.find(m => !m.section || m.section.trim() === '' || m.section.trim().toUpperCase() === 'ALL');
          }
          if (!mapping) {
            mapping = subjectMappings[secIdx % subjectMappings.length];
          }
          const room = `${secBranch.toUpperCase()}-${300 + sem * 10 + (secIdx % 4) + 1}`;
          
          if (mapping.subject_type === 'lab') {
            const numBlocks = Math.floor(mapping.lecture_count / 2) || 1;
            for (let i = 0; i < numBlocks; i++) {
              requirements.push({
                section: sec,
                faculty_id: mapping.faculty_id,
                faculty_name: mapping.faculty_name,
                time_in: mapping.time_in,
                time_out: mapping.time_out,
                subject_id: mapping.subject_id,
                subject_name: mapping.subject_name,
                subject_type: mapping.subject_type,
                subject_code: mapping.subject_code,
                batch: mapping.batch_option || 'whole',
                room: `LAB-${secBranch.toUpperCase()}-${secIdx + 1}`,
                isLabBlock: true
              });
            }
          } else {
            for (let i = 0; i < mapping.lecture_count; i++) {
              requirements.push({
                section: sec,
                faculty_id: mapping.faculty_id,
                faculty_name: mapping.faculty_name,
                time_in: mapping.time_in,
                time_out: mapping.time_out,
                subject_id: mapping.subject_id,
                subject_name: mapping.subject_name,
                subject_type: mapping.subject_type,
                subject_code: mapping.subject_code,
                batch: mapping.batch_option || 'whole',
                room: room,
                isLabBlock: false
              });
            }
          }
        });
      });

      requirements.sort((a, b) => {
        const typeWeight = { lab: 3, tutorial: 2, theory: 1 };
        const weightA = typeWeight[a.subject_type] || 0;
        const weightB = typeWeight[b.subject_type] || 0;
        if (weightA !== weightB) return weightB - weightA;
        const loadA = facultyLoads[a.faculty_id] || 0;
        const loadB = facultyLoads[b.faculty_id] || 0;
        return loadB - loadA;
      });

      for (const req of requirements) {
        let placed = false;

        if (req.isLabBlock) {
          const shuffledBlocks = [...LAB_BLOCKS].sort(() => Math.random() - 0.5);
          for (const block of shuffledBlocks) {
            if (placed) break;
            const day = block.day;
            const [ts1, ts2] = block.slots;

            const existingInSec1 = sectionSchedules[req.section][day][ts1];
            const existingInSec2 = sectionSchedules[req.section][day][ts2];
            const checkSlotFree = (existing) => !existing || (req.batch !== 'whole' && existing.batch !== 'whole' && req.batch !== existing.batch);
            
            if (checkSlotFree(existingInSec1) && checkSlotFree(existingInSec2)) {
              const isFacultyBusy1 = attemptBusyFaculty[day][ts1].has(req.faculty_id);
              const isFacultyBusy2 = attemptBusyFaculty[day][ts2].has(req.faculty_id);
              if (isFacultyBusy1 || isFacultyBusy2) continue;

              const fitsWorkingHours1 = isFacultyWithinWorkingHours(req, ts1);
              const fitsWorkingHours2 = isFacultyWithinWorkingHours(req, ts2);
              if (!fitsWorkingHours1 || !fitsWorkingHours2) continue;

              sectionSchedules[req.section][day][ts1] = req;
              sectionSchedules[req.section][day][ts2] = req;
              attemptBusyFaculty[day][ts1].add(req.faculty_id);
              attemptBusyFaculty[day][ts2].add(req.faculty_id);

              generatedSlots.push({
                day,
                time_slot: ts1,
                faculty_id: req.faculty_id,
                subject_id: req.subject_id,
                room: req.room,
                batch: req.batch,
                section: req.section
              });
              generatedSlots.push({
                day,
                time_slot: ts2,
                faculty_id: req.faculty_id,
                subject_id: req.subject_id,
                room: req.room,
                batch: req.batch,
                section: req.section
              });
              placed = true;
              break;
            }
          }

          if (!placed) {
            for (const block of shuffledBlocks) {
              if (placed) break;
              const day = block.day;
              const [ts1, ts2] = block.slots;

              const existingInSec1 = sectionSchedules[req.section][day][ts1];
              const existingInSec2 = sectionSchedules[req.section][day][ts2];
              const checkSlotFree = (existing) => !existing || (req.batch !== 'whole' && existing.batch !== 'whole' && req.batch !== existing.batch);

              if (checkSlotFree(existingInSec1) && checkSlotFree(existingInSec2)) {
                sectionSchedules[req.section][day][ts1] = req;
                sectionSchedules[req.section][day][ts2] = req;
                generatedSlots.push({
                  day,
                  time_slot: ts1,
                  faculty_id: null,
                  subject_id: req.subject_id,
                  room: req.room,
                  batch: req.batch,
                  section: req.section
                });
                generatedSlots.push({
                  day,
                  time_slot: ts2,
                  faculty_id: null,
                  subject_id: req.subject_id,
                  room: req.room,
                  batch: req.batch,
                  section: req.section
                });
                placed = true;
                break;
              }
            }
          }
        } else {
          const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);
          for (const day of shuffledDays) {
            if (placed) break;
            const allowedSlots = THEORY_SLOTS_BY_DAY[day];
            const shuffledSlots = [...allowedSlots].sort(() => Math.random() - 0.5);

            for (const ts of shuffledSlots) {
              const existingInSec = sectionSchedules[req.section][day][ts];
              let sectionFree = !existingInSec || (req.batch !== 'whole' && existingInSec.batch !== 'whole' && req.batch !== existingInSec.batch);
              if (!sectionFree) continue;

              const isFacultyBusy = attemptBusyFaculty[day][ts].has(req.faculty_id);
              if (isFacultyBusy) continue;

              const fitsWorkingHours = isFacultyWithinWorkingHours(req, ts);
              if (!fitsWorkingHours) continue;

              sectionSchedules[req.section][day][ts] = req;
              attemptBusyFaculty[day][ts].add(req.faculty_id);
              generatedSlots.push({
                day,
                time_slot: ts,
                faculty_id: req.faculty_id,
                subject_id: req.subject_id,
                room: req.room,
                batch: req.batch,
                section: req.section
              });
              placed = true;
              break;
            }
          }

          if (!placed) {
            for (const day of shuffledDays) {
              if (placed) break;
              const allowedSlots = THEORY_SLOTS_BY_DAY[day];
              const shuffledSlots = [...allowedSlots].sort(() => Math.random() - 0.5);

              for (const ts of shuffledSlots) {
                const existingInSec = sectionSchedules[req.section][day][ts];
                let sectionFree = !existingInSec || (req.batch !== 'whole' && existingInSec.batch !== 'whole' && req.batch !== existingInSec.batch);
                if (!sectionFree) continue;

                sectionSchedules[req.section][day][ts] = req;
                generatedSlots.push({
                  day,
                  time_slot: ts,
                  faculty_id: null,
                  subject_id: req.subject_id,
                  room: req.room,
                  batch: req.batch,
                  section: req.section
                });
                placed = true;
                break;
              }
            }
          }
        }
      }
      success = true;
    }

    await db.query('BEGIN');
    try {
      await db.query(
        'DELETE FROM timetable_slots WHERE section = ANY($1)',
        [sections]
      );

      for (const slot of generatedSlots) {
        await db.query(
          `INSERT INTO timetable_slots (day, time_slot, faculty_id, subject_id, room, batch, section)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [slot.day, slot.time_slot, slot.faculty_id, slot.subject_id, slot.room, slot.batch, slot.section]
        );
      }

      await db.query('COMMIT');
    } catch (dbErr) {
      await db.query('ROLLBACK');
      throw dbErr;
    }

    res.json({ message: 'Successfully generated timetable for all sections!', count: generatedSlots.length });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAll, upsertSlot, deleteSlot, getConflicts, generateSemester };
