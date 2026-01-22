const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const logFile = path.join(__dirname, 'server.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
function log(msg) {
    const time = new Date().toISOString();
    logStream.write(`[${time}] ${msg}\n`);
    console.log(`[${time}] ${msg}`);
}

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    log(`${req.method} ${req.url} - Body: ${JSON.stringify(req.body)}`);
    next();
});

// SQLite Database Setup
const dbPath = path.join(__dirname, 'lunar_reminder.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening SQLite database:', err.message);
    } else {
        console.log('Connected to SQLite database at', dbPath);
        // Performance & Durability tweaks
        db.run('PRAGMA journal_mode = WAL');
        db.run('PRAGMA synchronous = NORMAL');

        // Create tables if they don't exist
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                type TEXT NOT NULL,
                year INTEGER,
                month INTEGER NOT NULL,
                day INTEGER NOT NULL,
                time TEXT,
                alertTiming TEXT,
                recurrence_type TEXT DEFAULT 'NONE',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS reminder_exceptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reminder_id INTEGER NOT NULL,
                ex_year INTEGER NOT NULL,
                ex_month INTEGER NOT NULL,
                ex_day INTEGER NOT NULL,
                FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
            )`);
        });
    }
});

// GET all reminders
app.get('/api/reminders', (req, res) => {
    const query = `
        SELECT r.*, e.ex_year, e.ex_month, e.ex_day 
        FROM reminders r
        LEFT JOIN reminder_exceptions e ON r.id = e.reminder_id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const reminderMap = {};
        rows.forEach(row => {
            if (!reminderMap[row.id]) {
                reminderMap[row.id] = {
                    id: row.id,
                    title: row.title,
                    type: row.type,
                    year: row.year,
                    month: row.month,
                    day: row.day,
                    time: row.time,
                    alertTiming: row.alertTiming,
                    recurrence: row.recurrence_type,
                    exceptions: []
                };
            }
            if (row.ex_year !== null) {
                reminderMap[row.id].exceptions.push({
                    year: row.ex_year,
                    month: row.ex_month,
                    day: row.ex_day
                });
            }
        });
        res.json(Object.values(reminderMap));
    });
});

// POST new reminder
app.post('/api/reminders', (req, res) => {
    const { id, title, type, year, month, day, time, alertTiming, recurrence } = req.body;
    const query = 'INSERT INTO reminders (id, title, type, year, month, day, time, alertTiming, recurrence_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.run(query, [id, title, type, year, month, day, time, alertTiming, recurrence], function (err) {
        if (err) {
            log(`POST /api/reminders Error: ${err.message}`);
            return res.status(500).json({ error: err.message });
        }
        log(`POST /api/reminders Success: id=${id}`);
        res.status(201).json({ message: 'Reminder added', id });
    });
});

// PUT update reminder
app.put('/api/reminders/:id', (req, res) => {
    const { id } = req.params;
    const { title, type, year, month, day, time, alertTiming, recurrence } = req.body;
    const query = 'UPDATE reminders SET title = ?, type = ?, year = ?, month = ?, day = ?, time = ?, alertTiming = ?, recurrence_type = ? WHERE id = ?';
    db.run(query, [title, type, year, month, day, time, alertTiming, recurrence, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Reminder updated' });
    });
});

// DELETE reminders by title (Delete Series)
app.delete('/api/reminders/by-title/:title', (req, res) => {
    const title = decodeURIComponent(req.params.title);
    console.log(`Deleting all reminders with title: [${title}]`);
    db.run('DELETE FROM reminders WHERE title = ?', [title], function (err) {
        if (err) {
            console.error('Error deleting series:', err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Successfully deleted ${this.changes} instances of [${title}]`);
        res.json({ message: `All instances of "${title}" deleted`, count: this.changes });
    });
});

// DELETE reminder by ID
app.delete('/api/reminders/:id', (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`Deleting individual reminder with ID: ${id}`);
    db.run('DELETE FROM reminders WHERE id = ?', [id], function (err) {
        if (err) {
            console.error('Error deleting individual reminder:', err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Successfully deleted record with ID: ${id}. Rows affected: ${this.changes}`);
        res.json({ message: 'Reminder deleted', count: this.changes });
    });
});

// POST bulk seed holidays
app.post('/api/seed-holidays', (req, res) => {
    const holidays = req.body; // Array of holiday objects
    if (!Array.isArray(holidays)) return res.status(400).json({ error: 'Invalid data format' });

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare('INSERT OR IGNORE INTO reminders (id, title, type, year, month, day, time, alertTiming, recurrence_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

        holidays.forEach(h => {
            const recurrence = h.repeat ? 'ANNUALLY' : 'NONE';
            stmt.run([h.id, h.title, h.type, h.year, h.month, h.day, h.time, h.alertTiming, recurrence]);
        });

        stmt.finalize((err) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }
            db.run('COMMIT');
            res.json({ message: 'Holidays seeded successfully', count: holidays.length });
        });
    });
});

// POST add exception for a repeating reminder
app.post('/api/reminders/:id/exceptions', (req, res) => {
    const { id } = req.params;
    const { year, month, day } = req.body;
    const query = 'INSERT INTO reminder_exceptions (reminder_id, ex_year, ex_month, ex_day) VALUES (?, ?, ?, ?)';
    db.run(query, [id, year, month, day], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Exception added', id: this.lastID });
    });
});

// 404 Handler - Return JSON for unknown API routes
app.use((req, res) => {
    res.status(404).json({ error: `Path not found: ${req.originalUrl}` });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
