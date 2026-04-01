const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create water_logs table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS water_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// API: Get today's total glasses
app.get('/api/water/today', (req, res) => {
  // datetime('now', 'localtime') ensures it uses local server time for grouping
  const query = `
    SELECT COUNT(*) as count 
    FROM water_logs 
    WHERE date(timestamp, 'localtime') = date('now', 'localtime')
  `;
  
  db.get(query, [], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ count: row.count });
  });
});

// API: Get month's records
app.get('/api/water/month', (req, res) => {
  const { year, month } = req.query; // format: 'YYYY' and 'MM'
  if (!year || !month) return res.status(400).json({ error: 'Missing year or month' });
  const ym = `${year}-${month.toString().padStart(2, '0')}`;
  
  const query = `
    SELECT date(timestamp, 'localtime') as date, COUNT(*) as count 
    FROM water_logs 
    WHERE strftime('%Y-%m', timestamp, 'localtime') = ?
    GROUP BY date(timestamp, 'localtime')
  `;
  
  db.all(query, [ym], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// API: Remove the last glass of water from today
app.post('/api/water/remove', (req, res) => {
  const query = `
    DELETE FROM water_logs 
    WHERE id = (
      SELECT id 
      FROM water_logs 
      WHERE date(timestamp, 'localtime') = date('now', 'localtime') 
      ORDER BY timestamp DESC 
      LIMIT 1
    )
  `;
  
  db.run(query, function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Failed to remove data' });
    }
    
    // Check if any row was actually deleted
    if (this.changes === 0) {
      return res.status(400).json({ error: '今日尚無飲水紀錄可撤銷' });
    }
    
    // Return the updated count for today
    const selectQuery = `SELECT COUNT(*) as count FROM water_logs WHERE date(timestamp, 'localtime') = date('now', 'localtime')`;
    db.get(selectQuery, [], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve updated count' });
      }
      res.json({ success: true, count: row.count });
    });
  });
});

// API: Record a glass of water
app.post('/api/water/drink', (req, res) => {
  const query = `INSERT INTO water_logs DEFAULT VALUES`;
  
  db.run(query, function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Failed to record data' });
    }
    
    const selectQuery = `SELECT COUNT(*) as count FROM water_logs WHERE date(timestamp, 'localtime') = date('now', 'localtime')`;
    db.get(selectQuery, [], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve updated count' });
      }
      res.json({ success: true, count: row.count });
    });
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  db.close(() => {
    console.log('Database connection closed.');
    process.exit(0);
  });
});
