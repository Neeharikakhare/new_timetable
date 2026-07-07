# College Timetable Management System

This is a College Timetable Management System built with a React/Vite frontend and an Express/Node.js backend using PostgreSQL.

## Prerequisites

Before running this project, ensure you have the following installed:
*   [Node.js](https://nodejs.org/) (v16 or higher recommended)
*   [PostgreSQL](https://www.postgresql.org/) (running locally or accessible via network)

---

## Getting Started

### 1. Database Setup

1. Make sure your PostgreSQL server is running.
2. The server uses the credentials defined in `server/.env`. Open `server/.env` and update the connection parameters if they differ from your local setup:
    ```env
    PORT=5000
    PGHOST=localhost
    PGPORT=5432
    PGUSER=postgres
    PGPASSWORD=postgres
    PGDATABASE=timetable
    ```
    *Note: The backend automatically checks if the database specified in `PGDATABASE` exists. If not, it will attempt to create it and initialize all necessary tables.*

3. To test your PostgreSQL connection before starting the server, run:
    ```bash
    cd server
    node test-db.js
    ```

### 2. Install Dependencies

Install both the backend and frontend dependencies in one command by running this from the root directory:
```bash
npm run install:all
```

### 3. Run the Project in Development Mode

To start both the client and server concurrently, run the following command in the root directory:
```bash
npm run dev
```

*   **Frontend**: Available at `http://localhost:5173` (or the port specified by Vite)
*   **Backend Server**: Runs on `http://localhost:5000`
*   **API Health Check**: Access `http://localhost:5000/api/health`

---

## Directory Structure

*   `client/`: React frontend application powered by Vite.
    *   Vite is configured to proxy all `/api` requests to `http://localhost:5000`.
*   `server/`: Node.js/Express backend API.
    *   `server/config/db.js`: Initializes connection pool and sets up tables if they don't exist.
    *   `server/routes/`: Route definitions for faculty, subjects, mapping, timetable, and AI functionality.

## Useful Scripts (defined in root `package.json`)

*   `npm run install:all`: Installs packages for both client and server folders.
*   `npm run dev`: Runs frontend and backend concurrently in development mode.
*   `npm run dev:client`: Runs only the Vite development server.
*   `npm run dev:server`: Runs only the backend Express server.
*   `npm run build:client`: Builds the frontend client for production.
*   `npm run start`: Starts the backend server.
