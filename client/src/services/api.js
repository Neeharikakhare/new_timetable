import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

// Faculty APIs
export const facultyAPI = {
  getAll: () => api.get('/faculty'),
  create: (data) => api.post('/faculty', data),
  bulkCreate: (data) => api.post('/faculty/bulk', data),
  update: (id, data) => api.put(`/faculty/${id}`, data),
  delete: (id) => api.delete(`/faculty/${id}`)
};

// Subject APIs
export const subjectAPI = {
  getAll: (params) => api.get('/subjects', { params }),
  getBranches: () => api.get('/subjects/branches'),
  create: (data) => api.post('/subjects', data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  delete: (id) => api.delete(`/subjects/${id}`)
};

// Mapping APIs
export const mappingAPI = {
  getAll: () => api.get('/mappings'),
  create: (data) => api.post('/mappings', data),
  update: (id, data) => api.put(`/mappings/${id}`, data),
  delete: (id) => api.delete(`/mappings/${id}`),
  getAutoCount: (subjectId) => api.get(`/mappings/auto-count/${subjectId}`)
};

// Timetable APIs
export const timetableAPI = {
  getAll: () => api.get('/timetable'),
  upsertSlot: (data) => api.post('/timetable/slot', data),
  deleteSlot: (id) => api.delete(`/timetable/slot/${id}`),
  getConflicts: () => api.get('/timetable/conflicts'),
  generateSemester: (semester) => api.post('/timetable/generate-semester', { semester })
};

// AI APIs
export const aiAPI = {
  suggestReplacement: (data) => api.post('/ai/suggest-replacement', data),
  markAttendance: (data) => api.post('/ai/attendance', data),
  getAttendance: (date) => api.get('/ai/attendance', { params: { date } })
};

export default api;
