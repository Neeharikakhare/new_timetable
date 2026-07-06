import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { mappingAPI, facultyAPI, subjectAPI } from '../services/api';

const BATCH_OPTIONS = [
  { value: 'whole', label: '👥 Whole Batch' },
  { value: 'batch1', label: '👤 Batch 1' },
  { value: 'batch2', label: '👤 Batch 2' }
];

export default function MappingTab() {
  const [mappings, setMappings] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    faculty_id: '', subject_id: '', lecture_count: '', batch_option: 'whole'
  });
  const [autoCount, setAutoCount] = useState(null);
  const [selectedSubjectType, setSelectedSubjectType] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [mRes, fRes, sRes] = await Promise.all([
        mappingAPI.getAll(),
        facultyAPI.getAll(),
        subjectAPI.getAll()
      ]);
      setMappings(mRes.data);
      setFaculty(fRes.data);
      setSubjects(sRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectChange = async (subjectId) => {
    setForm(prev => ({ ...prev, subject_id: subjectId, lecture_count: '' }));
    setAutoCount(null);
    setSelectedSubjectType('');
    if (!subjectId) return;
    try {
      const { data } = await mappingAPI.getAutoCount(subjectId);
      setAutoCount(data.lecture_count);
      setSelectedSubjectType(data.type);
      setForm(prev => ({ ...prev, lecture_count: data.lecture_count }));
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.faculty_id || !form.subject_id) {
      toast.error('Faculty and Subject are required');
      return;
    }
    try {
      setSubmitting(true);
      if (editingId) {
        const { data } = await mappingAPI.update(editingId, {
          lecture_count: parseInt(form.lecture_count),
          batch_option: form.batch_option
        });
        setMappings(prev => prev.map(m => m.id === editingId ? data : m));
        toast.success('Assignment updated!');
      } else {
        const { data } = await mappingAPI.create({
          faculty_id: parseInt(form.faculty_id),
          subject_id: parseInt(form.subject_id),
          lecture_count_override: form.lecture_count ? parseInt(form.lecture_count) : undefined,
          batch_option: form.batch_option
        });
        setMappings(prev => [...prev, data]);
        toast.success('Assignment created!');
      }
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (m) => {
    setForm({ faculty_id: m.faculty_id, subject_id: m.subject_id, lecture_count: m.lecture_count, batch_option: m.batch_option });
    setSelectedSubjectType(m.subject_type);
    setEditingId(m.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this faculty-subject assignment?')) return;
    try {
      await mappingAPI.delete(id);
      setMappings(prev => prev.filter(m => m.id !== id));
      toast.success('Assignment removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const resetForm = () => {
    setForm({ faculty_id: '', subject_id: '', lecture_count: '', batch_option: 'whole' });
    setAutoCount(null);
    setSelectedSubjectType('');
    setEditingId(null);
    setShowForm(false);
  };

  const isLab = selectedSubjectType === 'lab';
  const badgeMap = { whole: 'badge-whole', batch1: 'badge-batch1', batch2: 'badge-batch2' };
  const typeMap = { theory: 'badge-theory', lab: 'badge-lab', tutorial: 'badge-tutorial' };

  const filtered = mappings.filter(m =>
    !search ||
    m.faculty_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.subject_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.subject_branch?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by faculty for display
  const byFaculty = {};
  filtered.forEach(m => {
    if (!byFaculty[m.faculty_name]) byFaculty[m.faculty_name] = [];
    byFaculty[m.faculty_name].push(m);
  });

  return (
    <div className="section-gap">
      <div className="page-header">
        <h1 className="page-title">🔗 Faculty-Subject Assignments</h1>
        <p className="page-subtitle">Assign subjects to faculty with lecture counts and batch options for lab sessions</p>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-value">{mappings.length}</div><div className="stat-label">Total Assignments</div></div>
        <div className="stat-card"><div className="stat-value">{new Set(mappings.map(m => m.faculty_id)).size}</div><div className="stat-label">Faculty Assigned</div></div>
        <div className="stat-card"><div className="stat-value">{new Set(mappings.map(m => m.subject_id)).size}</div><div className="stat-label">Subjects Covered</div></div>
        <div className="stat-card"><div className="stat-value">{mappings.filter(m => m.subject_type === 'lab').length}</div><div className="stat-label">Lab Sessions</div></div>
      </div>

      {/* Form */}
      <div className="card">
        <div className="card-title" style={{ cursor: 'pointer' }} onClick={() => setShowForm(!showForm)}>
          <span>{editingId ? '✏️ Edit Assignment' : '➕ New Assignment'}</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{showForm ? '▲ Collapse' : '▼ Expand'}</span>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Faculty *</label>
                <select name="faculty_id" value={form.faculty_id}
                  onChange={e => setForm(prev => ({ ...prev, faculty_id: e.target.value }))}
                  required disabled={!!editingId}>
                  <option value="">Select Faculty</option>
                  {faculty.map(f => <option key={f.id} value={f.id}>{f.name} — {f.designation}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Subject *</label>
                <select name="subject_id" value={form.subject_id}
                  onChange={e => handleSubjectChange(e.target.value)}
                  required disabled={!!editingId}>
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code}) — {s.branch} Sem {s.semester}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Lectures per Week {autoCount && !editingId ? <span style={{ color: 'var(--text-muted)', textTransform: 'none', fontWeight: 400 }}>(auto: {autoCount})</span> : null}</label>
                <input name="lecture_count" type="number" min="1" max="20"
                  value={form.lecture_count}
                  onChange={e => setForm(prev => ({ ...prev, lecture_count: e.target.value }))}
                  placeholder={autoCount ? `Default: ${autoCount}` : 'Enter count'}
                />
              </div>

              {(isLab || editingId) && (
                <div className="form-group">
                  <label>Batch Option</label>
                  <select name="batch_option" value={form.batch_option}
                    onChange={e => setForm(prev => ({ ...prev, batch_option: e.target.value }))}>
                    {BATCH_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {selectedSubjectType && (
              <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                ℹ️ {selectedSubjectType === 'theory' ? 'Theory subjects default to 3 lectures/week' :
                  selectedSubjectType === 'lab' ? 'Lab subjects default to 2 sessions/week. Choose batch below.' :
                  'Tutorial subjects default to 1 session/week'}
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? '⏳ Saving...' : editingId ? '💾 Update' : '✅ Assign'}
              </button>
              {editingId && <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>}
            </div>
          </form>
        )}
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div className="card-title" style={{ margin: 0 }}>📋 All Assignments ({filtered.length})</div>
          <input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /> Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔗</div>
            No assignments yet. Create one above.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Branch</th>
                  <th>Semester</th>
                  <th>Type</th>
                  <th>Lectures/Week</th>
                  <th>Batch</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="teacher-avatar" style={{ width: 28, height: 28, fontSize: '0.75rem', marginBottom: 0 }}>
                          {m.faculty_name?.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 600 }}>{m.faculty_name}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{m.subject_name}</td>
                    <td><code style={{ background: 'rgba(99,102,241,0.1)', padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.78rem', color: 'var(--accent-secondary)' }}>{m.subject_code}</code></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{m.subject_branch}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>Sem {m.subject_semester}</td>
                    <td><span className={`badge ${typeMap[m.subject_type]}`}>{m.subject_type}</span></td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-secondary)', textAlign: 'center' }}>{m.lecture_count}</td>
                    <td><span className={`badge ${badgeMap[m.batch_option]}`}>{m.batch_option === 'whole' ? 'Whole' : m.batch_option === 'batch1' ? 'Batch 1' : 'Batch 2'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(m)}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
