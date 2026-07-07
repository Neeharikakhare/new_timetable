import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { facultyAPI } from '../services/api';

const DESIGNATIONS = [
  'Professor', 'Associate Professor', 'Assistant Professor',
  'Senior Lecturer', 'Lecturer', 'Lab Assistant', 'HOD', 'Principal'
];

const BRANCHES = [
  'CSE', 'CSBS', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'AIDS', 'AIML', 'Cyber Security', 'Other'
];

const EMPTY_FORM = {
  name: '', designation: '', phone: '', email: '', time_in: '', time_out: '',
  subjects: []
};

export default function FacultyTab() {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const addSubjectRow = () => {
    setForm(prev => ({
      ...prev,
      subjects: [...prev.subjects, { name: '', code: '', branch: 'CSE', semester: '3', type: 'theory', batch_option: 'whole', lecture_count: '3' }]
    }));
  };

  const updateSubjectRow = (index, key, value) => {
    setForm(prev => {
      const updated = [...prev.subjects];
      updated[index] = { ...updated[index], [key]: value };
      
      // Default lecture counts and batch option rules when type changes
      if (key === 'type') {
        if (value === 'lab') {
          updated[index].lecture_count = '2';
          updated[index].batch_option = 'whole';
        } else if (value === 'tutorial') {
          updated[index].lecture_count = '1';
          updated[index].batch_option = 'whole';
        } else {
          updated[index].lecture_count = '3';
          updated[index].batch_option = 'whole';
        }
      }
      return { ...prev, subjects: updated };
    });
  };

  const removeSubjectRow = (index) => {
    setForm(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index)
    }));
  };

  // Excel Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => { fetchFaculty(); }, []);

  const downloadTemplate = () => {
    const headers = [
      ['S. No.', 'Name of Faculty', 'Cadre', 'Sub. Code', 'Subject Name', 'Program / Section', 'UG / PG', 'Sem']
    ];
    const sampleData = [
      ['1', 'Dr. Ritu Sharma', 'Prof & Head', 'CS-405', 'OPERATING SYSTEM', 'B.tech/CSE A', 'UG', '4th'],
      ['', '', '', 'CS-405', 'OPERATING SYSTEM', 'B.tech/CSE B', 'UG', '4th'],
      ['2', 'Mr. Arun Kumar', 'Asst Prof', 'CS-601', 'MACHINE LEARNING', 'B.tech/CSE A', 'UG', '6th'],
      ['', '', '', 'CS-603', 'COMPILER DESIGN', 'B.tech/CSE D', 'UG', '6th'],
      ['', '', '', 'CS-603', 'COMPILER DESIGN', 'B.tech/CSE E', 'UG', '6th'],
      ['', '', '', 'CB-608', 'MINOR PROJECT', 'B.tech/CS CSBS', 'UG', '6th']
    ];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
    
    ws['!cols'] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
      { wch: 25 },
      { wch: 20 },
      { wch: 10 },
      { wch: 10 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'faculty_import_template.xlsx');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Use header: 1 to get a raw array of arrays
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        
        if (rows.length < 2) {
          toast.error('The spreadsheet is empty or has invalid format.');
          return;
        }

        // Find the header row (contains Name or Cadre or Sub. Code)
        let headerIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const row = rows[i];
          if (row && row.some(cell => {
            const val = String(cell || '').toLowerCase();
            return val.includes('faculty') || val.includes('sub. code') || val.includes('cadre') || val.includes('subject');
          })) {
            headerIdx = i;
            break;
          }
        }

        const headers = rows[headerIdx].map(h => String(h || '').trim().toLowerCase());
        const dataRows = rows.slice(headerIdx + 1);

        const colIdx = {
          name: headers.findIndex(h => h.includes('name') && h.includes('faculty')),
          cadre: headers.findIndex(h => h.includes('cadre') || h.includes('designation')),
          subCode: headers.findIndex(h => h.includes('sub') || h.includes('code')),
          subName: headers.findIndex(h => h.includes('subject') && h.includes('name')),
          program: headers.findIndex(h => h.includes('program') || h.includes('section')),
          sem: headers.findIndex(h => h.includes('sem'))
        };

        // Fallbacks
        if (colIdx.name === -1) colIdx.name = headers.findIndex(h => h.includes('faculty') || h.includes('name'));
        if (colIdx.cadre === -1) colIdx.cadre = headers.findIndex(h => h.includes('designation') || h.includes('cadre') || h.includes('role'));
        if (colIdx.subCode === -1) colIdx.subCode = headers.findIndex(h => h.includes('code'));
        if (colIdx.subName === -1) colIdx.subName = headers.findIndex(h => h.includes('subject'));
        if (colIdx.program === -1) colIdx.program = headers.findIndex(h => h.includes('section') || h.includes('program'));
        if (colIdx.sem === -1) colIdx.sem = headers.findIndex(h => h.includes('sem') || h.includes('semester'));

        if (colIdx.name === -1 || colIdx.subCode === -1) {
          toast.error('Could not identify "Name of Faculty" or "Sub. Code" columns in the sheet.');
          return;
        }

        const parsedFacultyList = [];
        let currentFaculty = null;
        let rowNumOffset = headerIdx + 2;

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          if (!row || row.length === 0) continue;

          const fName = colIdx.name !== -1 ? String(row[colIdx.name] || '').trim() : '';
          const fCadre = colIdx.cadre !== -1 ? String(row[colIdx.cadre] || '').trim() : '';

          // If Name is present, we start a new faculty group
          if (fName) {
            let design = fCadre || 'Assistant Professor';
            const lowerDesign = design.toLowerCase().trim();
            if (lowerDesign.includes('lab assistant') || lowerDesign.includes('lab')) {
              design = 'Lab Assistant';
            } else if (lowerDesign.includes('asst') || lowerDesign.includes('assistant')) {
              design = 'Assistant Professor';
            } else if (lowerDesign.includes('assoc') || lowerDesign.includes('associate')) {
              design = 'Associate Professor';
            } else if (lowerDesign.includes('prof') || lowerDesign.includes('head')) {
              design = 'Professor';
            } else if (lowerDesign.includes('lecturer')) {
              design = 'Lecturer';
            } else if (lowerDesign.includes('hod')) {
              design = 'HOD';
            } else if (lowerDesign.includes('principal')) {
              design = 'Principal';
            } else {
              design = 'Assistant Professor';
            }

            currentFaculty = {
              rowNum: i + rowNumOffset,
              name: fName,
              designation: design,
              phone: '',
              email: '', // empty email will be treated as null in database
              time_in: '09:00',
              time_out: '17:00',
              subjects: [],
              errors: [],
              isValid: true
            };
            parsedFacultyList.push(currentFaculty);
          }

          // Parse subject info for the row
          const sCode = colIdx.subCode !== -1 ? String(row[colIdx.subCode] || '').trim() : '';
          const sName = colIdx.subName !== -1 ? String(row[colIdx.subName] || '').trim() : '';
          const sProgram = colIdx.program !== -1 ? String(row[colIdx.program] || '').trim() : '';
          const sSem = colIdx.sem !== -1 ? String(row[colIdx.sem] || '').trim() : '';

          if (sCode) {
            if (!currentFaculty) {
              // Row has a subject code but no current faculty has been initialized
              continue;
            }

            // Extract branch
            let branch = 'CSE';
            if (sProgram.toUpperCase().includes('CSBS') || sCode.toUpperCase().includes('CB')) {
              branch = 'CSBS';
            }

            // Extract semester number (digits from string)
            const semMatch = sSem.match(/\d+/);
            const semNum = semMatch ? parseInt(semMatch[0]) : 3;

            // Determine type
            let type = 'theory';
            const lowerSubName = sName.toLowerCase();
            const lowerSubCode = sCode.toLowerCase();
            if (
              lowerSubName.includes('lab') || 
              lowerSubName.includes('practical') || 
              lowerSubName.includes('project') || 
              lowerSubName.includes('workshop') ||
              lowerSubCode.includes('lab') ||
              lowerSubName.includes('minor')
            ) {
              type = 'lab';
            }

            const lectureCount = type === 'lab' ? 2 : 3;

            currentFaculty.subjects.push({
              name: sName || `Subject ${sCode}`,
              code: sCode.toUpperCase(),
              branch: branch,
              semester: semNum,
              type: type,
              batch_option: 'whole',
              lecture_count: lectureCount
            });
          }
        }

        // Validate final faculty list
        parsedFacultyList.forEach(fac => {
          const errors = [];
          if (!fac.name) errors.push('Name is required');
          if (!fac.designation) errors.push('Designation is required');
          if (!fac.subjects || fac.subjects.length === 0) {
            errors.push('At least one subject assignment is required');
          }
          fac.errors = errors;
          fac.isValid = errors.length === 0;
        });

        setImportData(parsedFacultyList);
        toast.success(`Successfully parsed ${parsedFacultyList.length} faculty members.`);
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse file. Please upload a valid Excel/CSV file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportSubmit = async () => {
    const validRows = importData.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error('No valid records to import');
      return;
    }

    try {
      setImportLoading(true);
      const payload = validRows.map(({ name, designation, phone, email, time_in, time_out, subjects }) => ({
        name, designation, phone, email, time_in, time_out, subjects
      }));

      const { data } = await facultyAPI.bulkCreate({ faculty: payload });
      
      if (data.success) {
        toast.success(`Imported ${data.insertedCount} faculty members successfully!`);
        if (data.skipped && data.skipped.length > 0) {
          toast.custom(() => (
            <div className="alert alert-info" style={{ display: 'block', maxWidth: '350px', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--accent-secondary)' }}>⚠️ Skipped {data.skipped.length} Rows</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                The following rows were skipped (email duplicates or errors):
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.25rem' }}>
                  {data.skipped.slice(0, 3).map((s, idx) => (
                    <li key={idx}>{s.name} ({s.email || 'no email'})</li>
                  ))}
                  {data.skipped.length > 3 && <li>...and {data.skipped.length - 3} more</li>}
                </ul>
              </div>
            </div>
          ), { duration: 8000 });
        }
        fetchFaculty();
        setShowImportModal(false);
        setImportData([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to bulk import faculty');
    } finally {
      setImportLoading(false);
    }
  };

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
    setForm({
      name: f.name,
      designation: f.designation,
      phone: f.phone || '',
      email: f.email || '',
      time_in: f.time_in || '',
      time_out: f.time_out || '',
      subjects: f.subjects || []
    });
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">👨‍🏫 Faculty Management</h1>
          <p className="page-subtitle">Add and manage teaching staff details, timings and contact information</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowImportModal(true)} type="button">
          📤 Import from Excel
        </button>
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

            {/* Dynamic Subjects Sub-form */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  📚 Subjects & Branch Details
                </h4>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addSubjectRow}>
                  ➕ Add Subject
                </button>
              </div>

              {form.subjects.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No subjects assigned yet. Click "Add Subject" to assign a subject and branch.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {form.subjects.map((sub, idx) => (
                    <div key={idx} style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) auto', 
                      gap: '0.75rem', 
                      alignItems: 'flex-end',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem', flex: 1, width: '100%' }}>
                        <div className="form-group">
                          <label style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>Subject Name *</label>
                          <input 
                            placeholder="e.g. Data Structures" 
                            value={sub.subject_name || sub.name || ''} 
                            onChange={e => updateSubjectRow(idx, 'name', e.target.value)} 
                            required 
                          />
                        </div>
                        
                        <div className="form-group">
                          <label style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>Subject Code *</label>
                          <input 
                            placeholder="CS301" 
                            value={sub.subject_code || sub.code || ''} 
                            onChange={e => updateSubjectRow(idx, 'code', e.target.value)} 
                            required 
                          />
                        </div>
                        
                        <div className="form-group">
                          <label style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>Branch *</label>
                          <select 
                            value={sub.subject_branch || sub.branch || 'CSE'} 
                            onChange={e => updateSubjectRow(idx, 'branch', e.target.value)}
                          >
                            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>

                        <div className="form-group">
                          <label style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>Semester *</label>
                          <select 
                            value={sub.subject_semester || sub.semester || '3'} 
                            onChange={e => updateSubjectRow(idx, 'semester', e.target.value)}
                          >
                            {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                          </select>
                        </div>

                        <div className="form-group">
                          <label style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>Type *</label>
                          <select 
                            value={sub.subject_type || sub.type || 'theory'} 
                            onChange={e => updateSubjectRow(idx, 'type', e.target.value)}
                          >
                            <option value="theory">Theory</option>
                            <option value="lab">Lab</option>
                            <option value="tutorial">Tutorial</option>
                          </select>
                        </div>

                        {(sub.subject_type === 'lab' || sub.type === 'lab') ? (
                          <div className="form-group">
                            <label style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>Lab Batch *</label>
                            <select 
                              value={sub.batch_option || 'whole'} 
                              onChange={e => updateSubjectRow(idx, 'batch_option', e.target.value)}
                            >
                              <option value="whole">Whole Batch</option>
                              <option value="batch1">Batch 1</option>
                              <option value="batch2">Batch 2</option>
                            </select>
                          </div>
                        ) : (
                          <div className="form-group">
                            <label style={{ fontSize: '0.68rem', letterSpacing: '0.02em', color: 'var(--text-muted)' }}>Lab Batch</label>
                            <select disabled value="whole">
                              <option value="whole">Whole Batch</option>
                            </select>
                          </div>
                        )}

                        <div className="form-group">
                          <label style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>Lectures / Week *</label>
                          <input 
                            type="number" 
                            min="1" 
                            max="10"
                            value={sub.lecture_count || ''} 
                            onChange={e => updateSubjectRow(idx, 'lecture_count', e.target.value)} 
                            placeholder="3"
                            required 
                          />
                        </div>
                      </div>

                      <button 
                        type="button" 
                        className="btn btn-danger btn-icon" 
                        onClick={() => removeSubjectRow(idx)}
                        title="Remove Subject"
                        style={{ marginBottom: '2px' }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                  <th>Subjects Taught</th>
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
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxWidth: '340px' }}>
                        {(f.subjects && f.subjects.length > 0) ? (
                          f.subjects.map((sub, sIdx) => (
                            <div key={sIdx} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>{sub.subject_code}</span>
                              <span style={{ color: 'var(--text-primary)' }}>{sub.subject_name}</span>
                              <span className="badge badge-whole" style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem' }}>{sub.subject_branch}</span>
                              <span className={`badge ${sub.subject_type === 'lab' ? 'badge-lab' : sub.subject_type === 'tutorial' ? 'badge-tutorial' : 'badge-theory'}`} style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem' }}>
                                {sub.subject_type === 'lab' ? `Lab (${sub.batch_option === 'whole' ? 'Whole' : sub.batch_option === 'batch1' ? 'B1' : 'B2'})` : sub.subject_type}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>No subjects assigned</span>
                        )}
                      </div>
                    </td>
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

      {showImportModal && (
        <div className="modal-overlay" onClick={() => { if (!importLoading) { setShowImportModal(false); setImportData([]); } }}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ minWidth: 'min(90vw, 800px)' }}>
            <div className="modal-header">
              <h3 className="modal-title">📤 Import Faculty via Excel / CSV</h3>
              <button className="modal-close" onClick={() => { setShowImportModal(false); setImportData([]); }} disabled={importLoading}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Download our pre-structured template, fill in details of your faculty members, and upload the file below.
              </p>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={downloadTemplate} type="button">
                  📥 Download Excel Template
                </button>
              </div>

              <div style={{ 
                border: '2px dashed var(--border-color)', 
                borderRadius: 'var(--radius-md)', 
                padding: '2rem 1.5rem', 
                textAlign: 'center', 
                background: 'rgba(0,0,0,0.2)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'var(--transition)'
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (e.dataTransfer.files?.length) {
                  const fakeEvent = { target: { files: e.dataTransfer.files } };
                  handleFileChange(fakeEvent);
                }
              }}
              >
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileChange} 
                  style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    opacity: 0, 
                    cursor: 'pointer' 
                  }} 
                />
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Click to upload or drag & drop</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Supports .xlsx, .xls, and .csv</div>
              </div>

              {importData.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title" style={{ margin: 0, fontSize: '0.9rem' }}>
                      📋 Preview ({importData.length} rows parsed)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {importData.filter(r => r.isValid).length} Valid | {importData.filter(r => !r.isValid).length} Errors
                    </div>
                  </div>

                  <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Name</th>
                          <th>Designation</th>
                          <th>Subjects</th>
                          <th>Phone</th>
                          <th>Email</th>
                          <th>Timing</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.map((row, index) => (
                          <tr key={index} style={{ opacity: row.isValid ? 1 : 0.75, background: row.isValid ? 'transparent' : 'rgba(239, 68, 68, 0.05)' }}>
                            <td style={{ color: 'var(--text-muted)' }}>{row.rowNum}</td>
                            <td style={{ fontWeight: 600 }}>{row.name || <em style={{ color: 'var(--accent-danger)' }}>Missing</em>}</td>
                            <td>
                              {row.designation ? (
                                <span className="badge badge-whole">{row.designation}</span>
                              ) : (
                                <em style={{ color: 'var(--accent-danger)' }}>Missing</em>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '280px' }}>
                                {row.subjects && row.subjects.map((sub, sIdx) => (
                                  <div key={sIdx} style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700 }}>{sub.code}</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>{sub.name}</span>
                                    <span className="badge badge-theory" style={{ fontSize: '0.58rem', padding: '0.01rem 0.25rem' }}>
                                      Sem {sub.semester} {sub.branch}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>{row.phone || '—'}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{row.email || '—'}</td>
                            <td style={{ fontSize: '0.75rem' }}>
                              {row.time_in && row.time_out ? `${row.time_in} - ${row.time_out}` : '—'}
                            </td>
                            <td>
                              {row.isValid ? (
                                <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>✓ Ready</span>
                              ) : (
                                <span style={{ color: 'var(--accent-danger)', fontSize: '0.75rem' }} title={row.errors.join(', ')}>
                                  ⚠️ {row.errors[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="form-actions" style={{ marginTop: '0.5rem', borderTop: 'none', paddingTop: 0 }}>
                <button 
                  className="btn btn-primary" 
                  onClick={handleImportSubmit} 
                  disabled={importLoading || importData.filter(r => r.isValid).length === 0}
                  type="button"
                >
                  {importLoading ? '⏳ Importing...' : `✅ Import ${importData.filter(r => r.isValid).length} Records`}
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => { setShowImportModal(false); setImportData([]); }}
                  disabled={importLoading}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
