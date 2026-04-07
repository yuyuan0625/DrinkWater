const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
const SECRET_KEY = 'water-secret-key-123'; // Hardcoded for simplicity

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS water_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Migration step: simply try adding user_id in case this table already existed before without it
        db.run(`ALTER TABLE water_logs ADD COLUMN user_id INTEGER`, () => {});

        // Check and create default admin account
        db.get(`SELECT * FROM users WHERE username = 'admin'`, [], (err, row) => {
            if (!row) {
                bcrypt.hash('admin', 10, (err, hash) => {
                    if (!err) {
                        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, ['admin', hash], (e) => {
                            if (!e) console.log('Default admin account created (admin/admin)');
                        });
                    }
                });
            }
        });
    });
  }
});

// === Admin APIs ===
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  db.all(`SELECT id, username FROM users WHERE username != 'admin'`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
  });
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
  const targetUserId = req.params.id;
  db.run(`DELETE FROM water_logs WHERE user_id = ?`, [targetUserId], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to delete user logs' });
      db.run(`DELETE FROM users WHERE id = ?`, [targetUserId], function(err) {
          if (err) return res.status(500).json({ error: 'Failed to delete user' });
          if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
          res.json({ success: true });
      });
  });
});

// Middleware to protect routes
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // { id, username }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
}

function requireAdmin(req, res, next) {
    if (req.user && req.user.username === 'admin') {
        next();
    } else {
        return res.status(403).json({ error: 'Forbidden: Admin access only' });
    }
}

function getLocalToday() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

// === Auth API ===
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '請輸入帳號和密碼' });

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: '系統加密錯誤' });
        
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) return res.status(400).json({ error: '此帳號已被註冊' });
                return res.status(500).json({ error: '註冊失敗' });
            }
            res.json({ success: true, message: '註冊成功' });
        });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '請輸入帳號和密碼' });

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user) return res.status(400).json({ error: '帳號或密碼錯誤' });

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (!isMatch) return res.status(400).json({ error: '帳號或密碼錯誤' });

            const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
            res.json({ success: true, token, username: user.username });
        });
    });
});

// === Water APIs protected by requireAuth ===

app.get('/api/water/daily', requireAuth, (req, res) => {
  const targetDate = req.query.date || getLocalToday();
  const query = `
    SELECT COUNT(*) as count 
    FROM water_logs 
    WHERE user_id = ? AND date(timestamp, 'localtime') = ?
  `;
  
  db.get(query, [req.user.id, targetDate], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ count: row.count });
  });
});

app.get('/api/water/month', requireAuth, (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'Missing year or month' });
  const ym = `${year}-${month.toString().padStart(2, '0')}`;
  
  const query = `
    SELECT date(timestamp, 'localtime') as date, COUNT(*) as count 
    FROM water_logs 
    WHERE user_id = ? AND strftime('%Y-%m', timestamp, 'localtime') = ?
    GROUP BY date(timestamp, 'localtime')
  `;
  
  db.all(query, [req.user.id, ym], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.get('/api/water/leaderboard', requireAuth, (req, res) => {
  const targetDate = req.query.date || getLocalToday();
  const query = `
    SELECT u.username, COUNT(w.id) as count 
    FROM water_logs w
    JOIN users u ON w.user_id = u.id
    WHERE date(w.timestamp, 'localtime') = ?
    GROUP BY u.id
    ORDER BY count DESC, u.username ASC
    LIMIT 100
  `;
  
  db.all(query, [targetDate], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.post('/api/water/remove', requireAuth, (req, res) => {
  const targetDate = req.body.date || getLocalToday();
  const query = `
    DELETE FROM water_logs 
    WHERE id = (
      SELECT id 
      FROM water_logs 
      WHERE user_id = ? AND date(timestamp, 'localtime') = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    )
  `;
  db.run(query, [req.user.id, targetDate], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to remove data' });
    if (this.changes === 0) return res.status(400).json({ error: '該日無紀錄可撤銷' });
    
    const selectQuery = `SELECT COUNT(*) as count FROM water_logs WHERE user_id = ? AND date(timestamp, 'localtime') = ?`;
    db.get(selectQuery, [req.user.id, targetDate], (err, row) => {
      if (err) return res.status(500).json({ error: 'Failed to retrieve updated count' });
      res.json({ success: true, count: row.count });
    });
  });
});

app.post('/api/water/drink', requireAuth, (req, res) => {
  const targetDate = req.body.date || getLocalToday();
  const query = req.body.date 
    ? `INSERT INTO water_logs (user_id, timestamp) VALUES (?, ?)`
    : `INSERT INTO water_logs (user_id) VALUES (?)`;
  const params = req.body.date ? [req.user.id, `${targetDate} 12:00:00`] : [req.user.id];
  
  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: 'Failed to record data' });
    
    const selectQuery = `SELECT COUNT(*) as count FROM water_logs WHERE user_id = ? AND date(timestamp, 'localtime') = ?`;
    db.get(selectQuery, [req.user.id, targetDate], (err, row) => {
      if (err) return res.status(500).json({ error: 'Failed to retrieve updated count' });
      res.json({ success: true, count: row.count });
    });
  });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Render 的 Web Service 在啟動時會自動加入 RENDER_EXTERNAL_URL 的環境變數
// 我們將預設值綁定了您的專屬網址，確保能正確喚醒真實伺服器
const pingUrl = process.env.RENDER_EXTERNAL_URL || 'https://drinkwater-pp26.onrender.com/';

// 防止 Render 免費方案休眠的機制：每 14 分鐘執行一次
setInterval(() => {
    // 轉換當前時間為台灣時間 (UTC+8)
    const taiwanTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const hours = taiwanTime.getHours();
    const minutes = taiwanTime.getMinutes();
    
    const currentMins = hours * 60 + minutes;
    const startMins = 8 * 60 + 30; // 08:30
    const endMins = 22 * 60;       // 22:00
    
    if (currentMins >= startMins && currentMins <= endMins) {
        console.log(`[Keep-alive] 執行自我喚醒 ping -> ${pingUrl} , 台灣時間: ${taiwanTime.toLocaleTimeString()}`);
        fetch(pingUrl)
            .then(res => console.log(`[Keep-alive] 回應狀態碼: ${res.status}`))
            .catch(err => console.error(`[Keep-alive] 喚醒失敗:`, err.message));
    }
}, 14 * 60 * 1000); // 14 * 60 * 1000 = 14 分鐘

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
process.on('SIGINT', () => {
  db.close(() => process.exit(0));
});
