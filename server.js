const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS water_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

function getLocalToday() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

app.get('/api/water/daily', (req, res) => {
  const targetDate = req.query.date || getLocalToday();
  const query = `
    SELECT COUNT(*) as count 
    FROM water_logs 
    WHERE date(timestamp, 'localtime') = ?
  `;
  
  db.get(query, [targetDate], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ count: row.count });
  });
});

app.get('/api/water/month', (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'Missing year or month' });
  const ym = `${year}-${month.toString().padStart(2, '0')}`;
  
  const query = `
    SELECT date(timestamp, 'localtime') as date, COUNT(*) as count 
    FROM water_logs 
    WHERE strftime('%Y-%m', timestamp, 'localtime') = ?
    GROUP BY date(timestamp, 'localtime')
  `;
  
  db.all(query, [ym], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.post('/api/water/remove', (req, res) => {
  const targetDate = req.body.date || getLocalToday();
  const query = `
    DELETE FROM water_logs 
    WHERE id = (
      SELECT id 
      FROM water_logs 
      WHERE date(timestamp, 'localtime') = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    )
  `;
  db.run(query, [targetDate], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to remove data' });
    if (this.changes === 0) return res.status(400).json({ error: '該日無紀錄可撤銷' });
    
    const selectQuery = `SELECT COUNT(*) as count FROM water_logs WHERE date(timestamp, 'localtime') = ?`;
    db.get(selectQuery, [targetDate], (err, row) => {
      if (err) return res.status(500).json({ error: 'Failed to retrieve updated count' });
      res.json({ success: true, count: row.count });
    });
  });
});

app.post('/api/water/drink', (req, res) => {
  const targetDate = req.body.date || getLocalToday();
  const query = req.body.date 
    ? `INSERT INTO water_logs (timestamp) VALUES (?)`
    : `INSERT INTO water_logs DEFAULT VALUES`;
  const params = req.body.date ? [`${targetDate} 12:00:00`] : [];
  
  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: 'Failed to record data' });
    
    const selectQuery = `SELECT COUNT(*) as count FROM water_logs WHERE date(timestamp, 'localtime') = ?`;
    db.get(selectQuery, [targetDate], (err, row) => {
      if (err) return res.status(500).json({ error: 'Failed to retrieve updated count' });
      res.json({ success: true, count: row.count });
    });
  });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
process.on('SIGINT', () => {
  db.close(() => process.exit(0));
});
