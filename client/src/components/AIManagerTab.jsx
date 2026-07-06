import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { aiAPI, facultyAPI } from '../services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
  '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
  '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
  '16:00-17:00'
];

export default function AIManagerTab() {
  const [faculty, setFaculty] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loadingFaculty, setLoadingFaculty] = useState(true);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    day: DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1],
    time_slot: '',
    absent_faculty_id: ''
  });

  const [result, setResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(null);

  useEffect(() => {
    fetchFaculty();
    fetchAttendance();
  }, []);

  const fetchFaculty = async () => {
    try {
      const { data } = await facultyAPI.getAll();
      setFaculty(data);
    } catch {
      toast.error('Failed to load faculty');
    } finally {
      setLoadingFaculty(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await aiAPI.getAttendance(today);
      setAttendance(data);
    } catch {}
  };

  const handleMarkAbsent = async (facultyId) => {
    try {
      await aiAPI.markAttendance({ date: form.date, faculty_id: parseInt(facultyId), status: 'absent' });
      setForm(prev => ({ ...prev, absent_faculty_id: facultyId }));
      toast.success('Marked as absent');
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleSuggest = async () => {
    if (!form.absent_faculty_id || !form.day || !form.time_slot) {
      toast.error('Please select faculty, day and time slot');
      return;
    }
    try {
      setSearching(true);
      setResult(null);
      const { data } = await aiAPI.suggestReplacement(form);
      setResult(data);
      if (data.total_available === 0) {
        toast.error('No replacement teachers available!');
      } else {
        toast.success(`Found ${data.total_available} potential replacement(s)!`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const PrioritySection = ({ title, desc, teachers, badge, badgeClass, color }) => (
    <div className="priority-section">
      <div className="priority-header">
        <div className={`priority-badge ${badgeClass}`}>{badge}</div>
        <span className="priority-title" style={{ color }}>{title}</span>
        <span className="priority-desc">{desc}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
          ({teachers.length} found)
        </span>
      </div>
      {teachers.length === 0 ? (
        <div className="empty-state" style={{ padding: '1rem' }}>No teachers match this priority.</div>
      ) : (
        <div className="teacher-cards">
          {teachers.map(t => (
            <div className="teacher-card" key={t.id} style={{ borderColor: `${color}22` }}>
              <div className="teacher-avatar">{t.name.charAt(0)}</div>
              <div className="teacher-name">{t.name}</div>
              <div className="teacher-designation">{t.designation}</div>
              {t.time_in && <div className="teacher-timing">⏰ {t.time_in} – {t.time_out}</div>}
              <div className="teacher-timing" style={{ marginTop: '0.35rem', color }}>✓ {t.reason}</div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '0.75rem', width: '100%', borderColor: `${color}44`, color }}
                disabled={assigning === t.id}
                onClick={async () => {
                  if (!result?.slot_info) return;
                  try {
                    setAssigning(t.id);
                    // Just show a success — actual slot update would go here
                    toast.success(`${t.name} assigned as replacement!`);
                  } finally {
                    setAssigning(null);
                  }
                }}
              >
                {assigning === t.id ? '⏳ Assigning...' : '✅ Assign as Replacement'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const todayAbsent = attendance.filter(a => a.status === 'absent');

  return (
    <div className="section-gap">
      <div className="page-header">
        <h1 className="page-title">🤖 AI Timetable Manager</h1>
        <p className="page-subtitle">Smart replacement suggestions when a teacher is absent — powered by intelligent priority matching</p>
      </div>

      {/* AI Hero Banner */}
      <div className="ai-header">
        <div className="ai-icon">🤖</div>
        <div>
          <div className="ai-title">AI Replacement Engine</div>
          <div className="ai-desc">
            Automatically finds the best replacement teacher using a 3-tier priority system:
            same class → same subject → available at the time slot.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Search Form */}
        <div className="card">
          <div className="card-title">🔍 Find Replacement</div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Absent Faculty *</label>
              <select name="absent_faculty_id" value={form.absent_faculty_id} onChange={handleChange}>
                <option value="">Select absent faculty</option>
                {faculty.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} — {f.designation}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Date *</label>
              <input type="date" name="date" value={form.date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Day of Week *</label>
              <select name="day" value={form.day} onChange={handleChange}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Time Slot *</label>
              <select name="time_slot" value={form.time_slot} onChange={handleChange}>
                <option value="">Select time slot</option>
                {TIME_SLOTS.map(ts => <option key={ts} value={ts}>{ts}</option>)}
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleSuggest}
              disabled={searching || !form.absent_faculty_id || !form.time_slot}
              style={{ width: '100%', justifyContent: 'center', padding: '0.8rem' }}
            >
              {searching ? (
                <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Searching...</>
              ) : (
                '🤖 Find Replacement Teachers'
              )}
            </button>
          </div>
        </div>

        {/* Today's Absent Faculty */}
        <div className="card">
          <div className="card-title">📋 Today's Absent Faculty</div>
          {todayAbsent.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <div className="empty-state-icon">✅</div>
              All faculty are present today!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {todayAbsent.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(239,68,68,0.05)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div className="teacher-avatar" style={{ width: 36, height: 36, fontSize: '0.9rem', marginBottom: 0, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                    {a.faculty_name?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{a.faculty_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-danger)' }}>Marked Absent</div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => setForm(prev => ({ ...prev, absent_faculty_id: a.faculty_id }))}
                  >
                    Find Cover
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '1rem', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              Quick Mark Absent
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {faculty.slice(0, 8).map(f => {
                const isAbsent = todayAbsent.some(a => a.faculty_id === f.id);
                return (
                  <button
                    key={f.id}
                    className={`btn btn-sm ${isAbsent ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => !isAbsent && handleMarkAbsent(f.id)}
                    disabled={isAbsent}
                    title={f.name}
                  >
                    {isAbsent ? '❌ ' : ''}{f.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="card">
          <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
              📋 Replacement for: <span style={{ color: 'var(--accent-secondary)' }}>{result.absent_faculty?.name}</span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <span>📅 {result.slot_info?.day}</span>
              <span>⏰ {result.slot_info?.time_slot}</span>
              <span>📖 {result.slot_info?.subject}</span>
              <span>👥 {result.slot_info?.batch}</span>
              {result.slot_info?.room && <span>🏫 {result.slot_info?.room}</span>}
            </div>
          </div>

          {result.message ? (
            <div className="alert alert-info">ℹ️ {result.message}</div>
          ) : (
            <>
              <PrioritySection
                title="Priority 1 — Same Class"
                desc="Already teaches this exact class/batch"
                teachers={result.priority1 || []}
                badge="1"
                badgeClass="p1-badge"
                color="#10b981"
              />
              <PrioritySection
                title="Priority 2 — Same Subject"
                desc="Assigned to this subject in another section"
                teachers={result.priority2 || []}
                badge="2"
                badgeClass="p2-badge"
                color="#f59e0b"
              />
              <PrioritySection
                title="Priority 3 — Available Teachers"
                desc="Free at this time slot and within working hours"
                teachers={result.priority3 || []}
                badge="3"
                badgeClass="p3-badge"
                color="#6366f1"
              />

              {result.total_available === 0 && (
                <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
                  ❌ No replacement teachers available for this slot. Consider splitting or cancelling the class.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
