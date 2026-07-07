# College Timetable Management System

This is a College Timetable Management System built with a React/Vite frontend and an Express/Node.js backend, configured to work with PostgreSQL (including Supabase).

---

## 🚀 Getting Started

### 1. Database Configuration
The application connects to a PostgreSQL database via the `DATABASE_URL` environment variable.

1. Open the [server/.env](file:///d:/Neeharika Project/new_timetable/server/.env) file.
2. Configure your database connection string:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<database_name>
   ```

#### 💡 Supabase Connection Guidelines
If connecting to a **Supabase** instance, follow these guidelines to prevent connection errors:
*   **Avoid IPv6 timeouts**: Many local ISPs lack proper IPv6 routing, causing direct connection timeouts (`ETIMEDOUT`). Under your Supabase dashboard settings, copy the **Transaction Pooler** URI (runs on port **`6543`**) instead of the direct session URI (port `5432`).
*   **Format credentials correctly**: Remove any square brackets `[ ]` surrounding your password.
*   **URL-encode special characters**: If your password contains special characters like `@`, you **must** URL-encode them (e.g., replace `@` with `%40`).

*Note: The backend automatically checks the connection on startup and initializes all required tables (`faculty`, `subjects`, `faculty_subjects`, `timetable_slots`, and `attendance`) if they do not exist.*

---

### 2. Install Dependencies
Install all client and server packages in one step by running this command in the project root:
```bash
npm run install:all
```
*(If your system restricts package-scoped postinstall scripts, run: `npm install --ignore-scripts --prefix client; npm install --ignore-scripts --prefix server`)*

---

### 3. Run the Project
Start both the React client development server and the Express server concurrently:
```bash
npm run dev
```

*   **Vite Frontend Client**: [http://localhost:5173](http://localhost:5173)
*   **Express Backend Server**: [http://localhost:5000](http://localhost:5000)
*   **API Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 📋 Key Features

### 1. Excel Faculty Import
Import faculty schedules from spreadsheets (.xlsx, .xls, .csv).
*   **Automatic Faculty Grouping**: If a faculty member is listed on multiple rows (for different subjects or sections), the system automatically merges them into a single faculty profile with multiple mappings rather than creating duplicate profiles.
*   **Smarter Section Extraction**: Supports parsing sections from program strings (e.g., `B.Tech/CSE/A` $\rightarrow$ `CSE A`, `CSE/B` $\rightarrow$ `CSE B`, and normalizes CSBS cohorts).

### 2. Contextual Timetable Scheduling
When assigning subjects and faculty to a timetable slot:
*   **Semester Filtering**: The subjects dropdown is automatically filtered to show only courses taught in the current semester.
*   **Smart Faculty Prioritization**: Faculty members mapped to teach the selected subject in the current section are prefixed with a `⭐` and sorted to the top of the selection list. Their mapped sections are also displayed inline (e.g., `⭐ Dr. Ritu Sharma (Mapped in: CSE A, CSE B)`).

### 3. AI Substitution & Attendance Manager
Mark faculty as absent and retrieve intelligent, prioritized coverage recommendations for their scheduled slots based on subject mappings, schedule status, and availability timings.

---

## 📁 Directory Structure
*   `client/`: React application using Vite and Vanilla CSS.
    *   `src/components/`: Core panels (`FacultyTab`, `SubjectsTab`, `MappingTab`, `TimetableTab`, `AIManagerTab`).
*   `server/`: Express backend API.
    *   `server/config/db.js`: Initializes and manages database connection pool/migrations.
    *   `server/controllers/`: Business logic handlers.
