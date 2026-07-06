import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { subjectAPI } from '../services/api';

const BRANCHES = ['CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'AIDS', 'AIML', 'Cyber Security', 'Other'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const TYPES = [
  { value: 'theory', label: '📖 Theory' },
  { value: 'lab', label: '🔬 Lab' },
  { value: 'tutorial', label: '📝 Tutorial' }
];

const EMPTY_FORM = { name: '', branch: '', semester: '', code: '', type: 'theory', credits: '' };

export default function SubjectsTab() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSem, setFilterSem] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchSubjects(); }, []);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const { data } = await subjectAPI.getAll();
      setSubjects(data);
    } catch (err) {
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.branch || !form.semester || !form.code || !form.credits) {
      toast.error('All fields are required');
      return;
    }
    try {
      setSubmitting(true);
      if (editingId) {
        const { data } = await subjectAPI.update(editingId, form);
        setSubjects(prev => prev.map(s => s.id === editingId ? data : s));
        toast.success('Subject updated!');
      } else {
        const { data } = await subjectAPI.create(form);
        setSubjects(prev => [...prev, data]);
        toast.success('Subject added!');
      }
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (s) => {
    setForm({ name: s.name, branch: s.branch, semester: s.semester, code: s.code, type: s.type, credits: s.credits });
    setEditingId(s.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete subject "${name}"?`)) return;
    try {
      await subjectAPI.delete(id);
      setSubjects(prev => prev.filter(s => s.id !== id));
      toast.success('Subject deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); };
  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const filtered = subjects.filter(s =>
    (!filterBranch || s.branch === filterBranch) &&
    (!filterSem || s.semester === parseInt(filterSem)) &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
  );

  const typeColors = { theory: 'badge-theory', lab: 'badge-lab', tutorial: 'badge-tutorial' };

  return (
    <div className="section-gap">
      <div className="page-header">
        <h1 className="page-title">📚 Subject Management</h1>
        <p className="page-subtitle">Manage all subjects across branches, semesters, and lecture types</p>
      </div>

      {/* Stats */}
      <div className="stats-row">
        {['theory', 'lab', 'tutorial'].map(t => (
          <div className="stat-card" key={t}>
            <div className="stat-value">{subjects.filter(s => s.type === t).length}</div>
            <div className="stat-label">{t.charAt(0).toUpperCase() + t.slice(1)} Subjects</div>
          </div>
        ))}
        <div className="stat-card">
          <div className="stat-value">{subjects.length}</div>
          <div className="stat-label">Total Subjects</div>
        </div>
      </div>

      {/* Form */}
      <div className="card">
        <div className="card-title" style={{ cursor: 'pointer' }} onClick={() => setShowForm(!showForm)}>
          <span>{editingId ? '✏️ Edit Subject' : '➕ Add New Subject'}</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {showForm ? '▲ Collapse' : '▼ Expand'}
          </span>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Subject Name *</label>
                <input name="name" value={form.name} onChange={handleChange} placeholder="Data Structures and Algorithms" required />
              </div>
              <div className="form-group">
                <label>Branch *</label>
                <select name="branch" value={form.branch} onChange={handleChange} required>
                  <option value="">Select Branch</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Semester *</label>
                <select name="semester" value={form.semester} onChange={handleChange} required>
                  <option value="">Select Semester</option>
                  {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Subject Code *</label>
                <input name="code" value={form.code} onChange={handleChange} placeholder="CS301" required />
              </div>
              <div className="form-group">
                <label>Lecture Type *</label>
                <select name="type" value={form.type} onChange={handleChange} required>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Total Credits *</label>
                <input name="credits" type="number" min="1" max="10" value={form.credits} onChange={handleChange} placeholder="4" required />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? '⏳ Saving...' : editingId ? '💾 Update Subject' : '✅ Add Subject'}
              </button>
              {editingId && <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>}
            </div>
          </form>
        )}
      </div>

      {/* Filters + Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div className="card-title" style={{ margin: 0 }}>📋 Subject List ({filtered.length})</div>
          <div className="filter-row" style={{ margin: 0 }}>
            <input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} />
            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="">All Branches</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={filterSem} onChange={e => setFilterSem(e.target.value)}>
              <option value="">All Sems</option>
              {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
            </select>
            {(filterBranch || filterSem || search) && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setFilterBranch(''); setFilterSem(''); setSearch(''); }}>✕ Clear</button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /> Loading subjects...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            {search || filterBranch || filterSem ? 'No subjects match your filters.' : 'No subjects added yet.'}
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Subject Name</th>
                  <th>Code</th>
                  <th>Branch</th>
                  <th>Semester</th>
                  <th>Type</th>
                  <th>Credits</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td><code style={{ background: 'rgba(99,102,241,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.8rem', color: 'var(--accent-secondary)' }}>{s.code}</code></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.branch}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>Sem {s.semester}</td>
                    <td><span className={`badge ${typeColors[s.type]}`}>{s.type}</span></td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-success)' }}>{s.credits}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(s)}>✏️ Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id, s.name)}>🗑️</button>
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
