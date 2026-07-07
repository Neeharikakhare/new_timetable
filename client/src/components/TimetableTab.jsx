import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
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

const SEMESTERS = [
  { value: '3', label: '3rd Semester (2nd Year)' },
  { value: '4', label: '4th Semester (2nd Year)' },
  { value: '5', label: '5th Semester (3rd Year)' },
  { value: '6', label: '6th Semester (3rd Year)' }
];

const SECTIONS_BY_YEAR = {
  '2nd_year': ['CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E', 'CSE F', 'CSBS A', 'CSBS B'],
  '3rd_year': ['CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E', 'CSE F']
};

const getYearBySem = (sem) => {
  if (sem === '3' || sem === '4') return '2nd_year';
  if (sem === '5' || sem === '6') return '3rd_year';
  return null;
};

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

  // Filters and Cohorts
  const [selectedSem, setSelectedSem] = useState('');
  const [selectedSec, setSelectedSec] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const handleSemChange = (e) => {
    const sem = e.target.value;
    setSelectedSem(sem);
    const year = getYearBySem(sem);
    const sections = year ? SECTIONS_BY_YEAR[year] : [];
    if (!sections.includes(selectedSec)) {
      setSelectedSec('');
    }
  };

  const handleExportExcel = () => {
    if (!selectedSem || !selectedSec) {
      toast.error('Please select a Semester and Section to export');
      return;
    }

    const headers = ['Day', ...TIME_SLOTS];
    const rows = DAYS.map(day => {
      const rowData = [day];
      TIME_SLOTS.forEach(ts => {
        const slot = slots.find(s => 
          s.day === day && 
          s.time_slot === ts &&
          s.subject_semester === parseInt(selectedSem) &&
          s.section === selectedSec
        );
        if (slot && slot.faculty_id) {
          rowData.push(`${slot.subject_code}: ${slot.subject_name} (${slot.faculty_name}) [Room: ${slot.room || '—'}]${slot.batch !== 'whole' ? ` (${slot.batch === 'batch1' ? 'B1' : 'B2'})` : ''}`);
        } else {
          rowData.push('Free Slot');
        }
      });
      return rowData;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    ws['!cols'] = [
      { wch: 12 },
      ...TIME_SLOTS.map(() => ({ wch: 25 }))
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
    XLSX.writeFile(wb, `timetable_${selectedSec.replace(/\s+/g, '_')}_sem_${selectedSem}.xlsx`);
    toast.success('Excel timetable downloaded!');
  };

  const handleExportPDF = () => {
    if (!selectedSem || !selectedSec) {
      toast.error('Please select a Semester and Section to export');
      return;
    }

    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
      <html>
        <head>
          <title>Timetable - ${selectedSec} (Semester ${selectedSem})</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              padding: 30px;
              margin: 0;
              background-color: #ffffff;
            }
            .header {
              text-align: center;
              margin-bottom: 25px;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 15px;
            }
            .title {
              font-size: 26px;
              font-weight: 800;
              margin: 0;
              color: #1e1b4b;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .subtitle {
              font-size: 13px;
              color: #64748b;
              margin-top: 6px;
              font-weight: 500;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              table-layout: fixed;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 8px 6px;
              text-align: center;
              font-size: 11px;
              vertical-align: middle;
              word-wrap: break-word;
            }
            th {
              background-color: #f8fafc;
              font-weight: 700;
              color: #334155;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.03em;
            }
            .time-col {
              background-color: #f1f5f9;
              font-weight: 700;
              color: #475569;
              width: 100px;
            }
            .slot-card {
              background-color: #f0f4ff;
              border: 1px solid #bfdbfe;
              border-left: 4px solid #3b82f6;
              padding: 6px;
              border-radius: 4px;
              text-align: left;
            }
            .slot-card.slot-lab {
              background-color: #ecfdf5;
              border-color: #a7f3d0;
              border-left-color: #10b981;
            }
            .slot-card.slot-tutorial {
              background-color: #fffbeb;
              border-color: #fde68a;
              border-left-color: #f59e0b;
            }
            .slot-faculty {
              font-weight: 700;
              color: #0f172a;
              font-size: 11px;
              margin-bottom: 2px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .slot-subject {
              color: #2563eb;
              font-size: 10px;
              font-weight: 600;
            }
            .slot-card.slot-lab .slot-subject {
              color: #059669;
            }
            .slot-card.slot-tutorial .slot-subject {
              color: #d97706;
            }
            .slot-room {
              color: #64748b;
              font-size: 9px;
              margin-top: 3px;
              font-weight: 500;
            }
            .empty-slot {
              color: #94a3b8;
              font-style: italic;
              font-size: 10px;
            }
            @media print {
              body { padding: 0; }
              @page {
                size: landscape;
                margin: 0.5cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">College Timetable</h1>
            <div class="subtitle">Semester: ${selectedSem} | Section: ${selectedSec} | Generated: ${new Date().toLocaleDateString()}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 100px;">Time</th>
                ${DAYS.map(d => `<th>${d}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${TIME_SLOTS.map(ts => `
                <tr>
                  <td class="time-col">${ts}</td>
                  ${DAYS.map(day => {
                    const slot = slots.find(s => 
                      s.day === day && 
                      s.time_slot === ts &&
                      s.subject_semester === parseInt(selectedSem) &&
                      s.section === selectedSec
                    );
                    if (slot && slot.faculty_id) {
                      const cardClass = slot.subject_type === 'lab' ? 'slot-lab' : slot.subject_type === 'tutorial' ? 'slot-tutorial' : '';
                      return `
                        <td>
                          <div class="slot-card ${cardClass}">
                            <div class="slot-faculty">${slot.faculty_name}</div>
                            <div class="slot-subject">${slot.subject_code}</div>
                            <div class="slot-room">Room: ${slot.room || '—'}${slot.batch !== 'whole' ? ` (${slot.batch === 'batch1' ? 'B1' : 'B2'})` : ''}</div>
                          </div>
                        </td>
                      `;
                    } else {
                      return `<td><span class="empty-slot">—</span></td>`;
                    }
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

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
    slots.find(s => 
      s.day === day && 
      s.time_slot === timeSlot &&
      s.subject_semester === parseInt(selectedSem) &&
      s.section === selectedSec
    ) || null;

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
        section: selectedSec,
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

  const activeYear = getYearBySem(selectedSem);
  const availableSections = activeYear ? SECTIONS_BY_YEAR[activeYear] : [];

  return (
    <div className="section-gap">
      <div className="page-header">
        <h1 className="page-title">📅 Timetable Generator</h1>
        <p className="page-subtitle">Select a cohort, assign class slots, resolve conflicts, and export schedules.</p>
      </div>

      {/* Cohort Select and Export Controls */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', flex: 1 }}>
            <div className="form-group" style={{ minWidth: '220px', flex: 1 }}>
              <label>Semester</label>
              <select value={selectedSem} onChange={handleSemChange}>
                <option value="">— Select Semester —</option>
                {SEMESTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            
            <div className="form-group" style={{ minWidth: '220px', flex: 1 }}>
              <label>Section</label>
              <select 
                value={selectedSec} 
                onChange={e => setSelectedSec(e.target.value)}
                disabled={!selectedSem}
              >
                <option value="">
                  {selectedSem ? '— Select Section —' : 'Select Semester First'}
                </option>
                {availableSections.map(sec => <option key={sec} value={sec}>{sec}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-end' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleExportExcel}
              disabled={!selectedSem || !selectedSec}
              type="button"
            >
              📥 Export to Excel
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleExportPDF}
              disabled={!selectedSem || !selectedSec}
              type="button"
            >
              📄 Export to PDF
            </button>
          </div>
        </div>
      </div>

      {!selectedSem || !selectedSec ? (
        <div className="card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <div className="empty-state-icon">📅</div>
          <h3 style={{ marginBottom: '0.5rem' }}>No Cohort Selected</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Select a **Semester** and **Section** above to load and manage the weekly timetable.
          </p>
        </div>
      ) : (
        <>
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
        </>
      )}

      {/* Slot Modal */}
      {modalOpen && selectedCell && (() => {
        const activeBranch = selectedSec.startsWith('CSE') ? 'CSE' : 'CSBS';
        const filteredSubjects = subjects.filter(s => 
          s.semester === parseInt(selectedSem) &&
          s.branch.toUpperCase() === activeBranch.toUpperCase()
        );

        return (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
            <div className="modal">
              <div className="modal-header">
                <div>
                  <div className="modal-title">{editingSlot ? '✏️ Edit Slot' : '➕ Add Slot'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {selectedCell.day} · {selectedCell.timeSlot} · Section {selectedSec}
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
                    {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
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
        );
      })()}
    </div>
  );
}
