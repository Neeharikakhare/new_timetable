import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import FacultyTab from './components/FacultyTab';
import MappingTab from './components/MappingTab';
import TimetableTab from './components/TimetableTab';
import AIManagerTab from './components/AIManagerTab';
import './index.css';

const TABS = [
  { id: 'faculty', label: 'Faculty', icon: '👨‍🏫' },
  { id: 'mapping', label: 'Assignments', icon: '🔗' },
  { id: 'timetable', label: 'Timetable', icon: '📅' },
  { id: 'ai', label: 'AI Manager', icon: '🤖' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('faculty');

  return (
    <div className="app">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a2234',
            color: '#f1f5f9',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '12px',
            fontSize: '0.875rem',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' }
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' }
          }
        }}
      />

      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">📐</div>
            <div className="logo-text">
              <span className="logo-title">TimeTable Pro</span>
              <span className="logo-subtitle">Management System</span>
            </div>
          </div>

          <nav className="tab-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-content">
        {activeTab === 'faculty' && <FacultyTab />}
        {activeTab === 'mapping' && <MappingTab />}
        {activeTab === 'timetable' && <TimetableTab />}
        {activeTab === 'ai' && <AIManagerTab />}
      </main>
    </div>
  );
}
