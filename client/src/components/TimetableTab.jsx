import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { timetableAPI, facultyAPI, subjectAPI } from '../services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
  '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
  '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
  '16:00-17:00'
];
const BATCHES = [
  { value: 'whole', label: 'Whole Batch' },
  { value: 'batch1', label: 'Batch 1' },
  { value: 'batch2', label: 'Batch 2' }
];

export default function TimetableTab() {
  const [slots, setSlots] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingSlot, setEditingSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [slotForm, setSlotForm] = useState({
    faculty_id: '', subject_id: '', room: '', batch: 'whole'
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [sRes, fRes, subRes, cRes] = await Promise.all([
        timetableAPI.getAll(),
        facultyAPI.getAll(),
        subjectAPI.getAll(),
        timetableAPI.getConflicts()
      ]);
      setSlots(sRes.data);
      setFaculty(fRes.data);
      setSubjects(subRes.data);
      setConflicts(cRes.data);
    } catch {
      toast.error('Failed to load timetable');
    } finally {
      setLoading(false);
    }
  };

  const getSlot = (day, timeSlot) =>
    slots.find(s => s.day === day && s.time_slot === timeSlot) || null;

  const isConflict = (slot) => slot && conflicts.some(c => c.slot1?.id === slot.id || c.slot2?.id === slot.id);

  const openModal = (day, timeSlot) => {
    const existing = getSlot(day, timeSlot);
    setSelectedCell({ day, timeSlot });
    if (existing) {
      setEditingSlot(existing);
      setSlotForm({
        faculty_id: existing.faculty_id || '',
        subject_id: existing.subject_id || '',
        room: existing.room || '',
        batch: existing.batch || 'whole'
      });
    } else {
      setEditingSlot(null);
      setSlotForm({ faculty_id: '', subject_id: '', room: '', batch: 'whole' });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCell) return;
    try {
      setSubmitting(true);
      const payload = {
        day: selectedCell.day,
        time_slot: selectedCell.timeSlot,
        faculty_id: slotForm.faculty_id || null,
        subject_id: slotForm.subject_id || null,
        room: slotForm.room,
        batch: slotForm.batch,
        ...(editingSlot ? { id: editingSlot.id } : {})
      };
      const { data } = await timetableAPI.upsertSlot(payload);
      if (editingSlot) {
        setSlots(prev => prev.map(s => s.id === editingSlot.id ? data : s));
      } else {
        setSlots(prev => [...prev, data]);
      }
      // Refresh conflicts
      const cRes = await timetableAPI.getConflicts();
      setConflicts(cRes.data);
      setModalOpen(false);
      toast.success('Slot saved!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save slot');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingSlot) return;
    if (!window.confirm('Clear this slot?')) return;
    try {
      await timetableAPI.deleteSlot(editingSlot.id);
      setSlots(prev => prev.filter(s => s.id !== editingSlot.id));
      setModalOpen(false);
      toast.success('Slot cleared');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const typeColorMap = { theory: 'slot-theory', lab: 'slot-lab', tutorial: 'slot-tutorial' };

  const filledSlots = slots.filter(s => s.faculty_id).length;

  return (
    <div className="section-gap">
      <div className="page-header">
        <h1 className="page-title">📅 Timetable Generator</h1>
        <p className="page-subtitle">Click any cell to assign or edit a class slot. Conflicts are highlighted in red.</p>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-value">{filledSlots}</div><div className="stat-label">Filled Slots</div></div>
        <div className="stat-card"><div className="stat-value">{DAYS.length * TIME_SLOTS.length - filledSlots}</div><div className="stat-label">Free Slots</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: conflicts.length > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>{conflicts.length}</div><div className="stat-label">Conflicts</div></div>
      </div>

      {conflicts.length > 0 && (
        <div className="alert alert-danger">
          ⚠️ {conflicts.length} scheduling conflict{conflicts.length > 1 ? 's' : ''} detected. Please resolve them.
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {[
          { cls: 'slot-theory', label: 'Theory' },
          { cls: 'slot-lab', label: 'Lab' },
          { cls: 'slot-tutorial', label: 'Tutorial' },
          { cls: 'slot-conflict', label: 'Conflict' }
        ].map(l => (
          <div key={l.cls} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <div style={{ width: 16, height: 16, borderRadius: 3 }} className={l.cls} />
            {l.label}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /> Loading timetable...</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="timetable-grid">
            <table className="timetable-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 90 }}>Time</th>
                  {DAYS.map(d => <th key={d}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(ts => (
                  <tr key={ts}>
                    <td className="time-col">{ts}</td>
                    {DAYS.map(day => {
                      const slot = getSlot(day, ts);
                      const conflict = isConflict(slot);
                      const typeClass = slot?.subject_type ? typeColorMap[slot.subject_type] : '';
                      return (
                        <td
                          key={day}
                          className={conflict ? 'slot-conflict' : typeClass}
                          onClick={() => openModal(day, ts)}
                          title={slot ? `Click to edit: ${slot.faculty_name} — ${slot.subject_name}` : 'Click to add'}
                        >
                          {slot && slot.faculty_id ? (
                            <div className="slot-cell">
                              <div className="slot-faculty">{slot.faculty_name}</div>
                              <div className="slot-subject">{slot.subject_name || slot.subject_code}</div>
                              <div className="slot-room">
                                {slot.room && `🏫 ${slot.room}`}
                                {slot.batch !== 'whole' && ` · ${slot.batch === 'batch1' ? 'B1' : 'B2'}`}
                              </div>
                            </div>
                          ) : (
                            <div className="slot-cell empty" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slot Modal */}
      {modalOpen && selectedCell && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">{editingSlot ? '✏️ Edit Slot' : '➕ Add Slot'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {selectedCell.day} · {selectedCell.timeSlot}
                </div>
              </div>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Faculty</label>
                <select value={slotForm.faculty_id} onChange={e => setSlotForm(p => ({ ...p, faculty_id: e.target.value }))}>
                  <option value="">— Select Faculty —</option>
                  {faculty.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Subject</label>
                <select value={slotForm.subject_id} onChange={e => setSlotForm(p => ({ ...p, subject_id: e.target.value }))}>
                  <option value="">— Select Subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Room / Venue</label>
                <input placeholder="e.g. CS-101" value={slotForm.room} onChange={e => setSlotForm(p => ({ ...p, room: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Batch</label>
                <select value={slotForm.batch} onChange={e => setSlotForm(p => ({ ...p, batch: e.target.value }))}>
                  {BATCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={submitting}>
                {submitting ? '⏳ Saving...' : '💾 Save Slot'}
              </button>
              {editingSlot && (
                <button className="btn btn-danger" onClick={handleDelete}>🗑️ Clear Slot</button>
              )}
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
