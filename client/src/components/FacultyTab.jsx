import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { facultyAPI } from '../services/api';

const DESIGNATIONS = [
  'Professor', 'Associate Professor', 'Assistant Professor',
  'Senior Lecturer', 'Lecturer', 'Lab Assistant', 'HOD', 'Principal'
];

const EMPTY_FORM = {
  name: '', designation: '', phone: '', email: '', time_in: '', time_out: ''
};

export default function FacultyTab() {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchFaculty(); }, []);

  const fetchFaculty = async () => {
    try {
      setLoading(true);
      const { data } = await facultyAPI.getAll();
      setFaculty(data);
    } catch (err) {
      toast.error('Failed to load faculty');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.designation) {
      toast.error('Name and designation are required');
      return;
    }
    try {
      setSubmitting(true);
      if (editingId) {
        const { data } = await facultyAPI.update(editingId, form);
        setFaculty(prev => prev.map(f => f.id === editingId ? data : f));
        toast.success('Faculty updated successfully!');
      } else {
        const { data } = await facultyAPI.create(form);
        setFaculty(prev => [...prev, data]);
        toast.success('Faculty added successfully!');
      }
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (f) => {
    setForm({ name: f.name, designation: f.designation, phone: f.phone || '', email: f.email || '', time_in: f.time_in || '', time_out: f.time_out || '' });
    setEditingId(f.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete faculty "${name}"? This will also remove their assignments.`)) return;
    try {
      await facultyAPI.delete(id);
      setFaculty(prev => prev.filter(f => f.id !== id));
      toast.success('Faculty deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const filtered = faculty.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.designation.toLowerCase().includes(search.toLowerCase()) ||
    (f.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="section-gap">
      <div className="page-header">
        <h1 className="page-title">👨‍🏫 Faculty Management</h1>
        <p className="page-subtitle">Add and manage teaching staff details, timings and contact information</p>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{faculty.length}</div>
          <div className="stat-label">Total Faculty</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{faculty.filter(f => f.designation.includes('Professor')).length}</div>
          <div className="stat-label">Professors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{faculty.filter(f => f.time_in).length}</div>
          <div className="stat-label">With Timings</div>
        </div>
      </div>

      {/* Form */}
      <div className="card">
        <div className="card-title" style={{ cursor: 'pointer' }} onClick={() => setShowForm(!showForm)}>
          <span>{editingId ? '✏️ Edit Faculty' : '➕ Add New Faculty'}</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {showForm ? '▲ Collapse' : '▼ Expand'}
          </span>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name *</label>
                <input name="name" value={form.name} onChange={handleChange} placeholder="Dr. Rajesh Kumar" required />
              </div>
              <div className="form-group">
                <label>Designation *</label>
                <select name="designation" value={form.designation} onChange={handleChange} required>
                  <option value="">Select designation</option>
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="rajesh@college.edu" />
              </div>
              <div className="form-group">
                <label>Time In</label>
                <input name="time_in" type="time" value={form.time_in} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Time Out</label>
                <input name="time_out" type="time" value={form.time_out} onChange={handleChange} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? '⏳ Saving...' : editingId ? '💾 Update Faculty' : '✅ Add Faculty'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div className="card-title" style={{ margin: 0 }}>📋 Faculty List ({filtered.length})</div>
          <input
            placeholder="🔍 Search faculty..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '220px' }}
          />
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /> Loading faculty...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👨‍🏫</div>
            {search ? 'No faculty match your search.' : 'No faculty added yet. Click "Add New Faculty" to get started.'}
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                  <tr key={f.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div className="teacher-avatar" style={{ width: 32, height: 32, fontSize: '0.8rem', marginBottom: 0 }}>
                          {f.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{f.name}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-whole">{f.designation}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{f.phone || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{f.email || '—'}</td>
                    <td style={{ color: 'var(--accent-success)', fontWeight: 600 }}>{f.time_in || '—'}</td>
                    <td style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>{f.time_out || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(f)}>✏️ Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f.id, f.name)}>🗑️</button>
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
