
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'lunar_reminder.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("PRAGMA table_info(reminders)", (err, rows) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log("Columns in reminders table:");
        rows.forEach(row => console.log(`- ${row.name}`));

        const hasRecurrence = rows.some(r => r.name === 'recurrence_type');
        if (!hasRecurrence) {
            console.log("Missing recurrence_type. Adding it...");
            db.run("ALTER TABLE reminders ADD COLUMN recurrence_type TEXT DEFAULT 'NONE'", (err) => {
                if (err) {
                    console.error("Failed to add recurrence_type:", err);
                } else {
                    console.log("Successfully added recurrence_type.");
                }
                process.exit(0);
            });
        } else {
            console.log("recurrence_type already exists.");
            process.exit(0);
        }
    });
});
