require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const bcrypt = require('bcrypt');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
const port = process.env.PORT || 3000;

// In-memory user store (load from users.json)
let users = [];
try {
  const usersData = fs.readFileSync('users.json', 'utf8');
  users = JSON.parse(usersData);
  console.log('Users loaded from users.json');
} catch (error) {
  console.error('Error loading users.json, starting with empty user list:', error.message);
  // Optional: create an empty users.json if it doesn't exist
  // fs.writeFileSync('users.json', '[]', 'utf8');
}

// In-memory active sessions store
const activeSessions = {}; // { token: username }

app.use(cors());
app.use(express.json()); // To parse JSON request bodies

// Middleware to authenticate token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['x-auth-token'];
  const token = authHeader && authHeader;

  if (token == null) return res.status(401).send('Access Denied: No Token Provided');

  const username = activeSessions[token];
  if (!username) {
    return res.status(403).send('Access Denied: Invalid Token');
  }
  req.user = { username: username };
  next();
}

// Parse credentials from environment variable
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

app.get('/api/kpis', authenticateToken, async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: process.env.GOOGLE_SHEET_RANGE_KPIS,
    });
    const rows = response.data.values;
    // rows[0] is the header: ['Label', 'Value', 'Trend', 'Format']
    // rows[1..] are the KPIs

    // Map the KPIs by label for easy access
    const kpis = {};
    for (let i = 1; i < rows.length; i++) {
      const [label, value, trend, format] = rows[i];
      if (label && value) {
        // Create a camelCase key from the label
        const key = label
          .toLowerCase()
          .replace(/[^a-z0-9]+(.)/g, (m, chr) => chr.toUpperCase())
          .replace(/[^a-z0-9]/g, '');
        kpis[key] = { label, value, trend, format };
      }
    }

    res.json(kpis);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching KPI data');
  }
});

app.get('/api/batch-attendance', authenticateToken, async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: process.env.GOOGLE_SHEET_RANGE_BATCH_ATTENDANCE,
    });
    const rows = response.data.values;
    // rows[0] is the header: ['Batch', 'Attended', 'Total', 'Percent']
    // rows[1..] are the data
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const [batch, attended, total, percent] = rows[i];
      if (batch && percent) {
        data.push({
          batch,
          attended: attended ? Number(attended) : null,
          total: total ? Number(total) : null,
          percent: percent ? Number(percent) : null
        });
      }
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching batch attendance data');
  }
});

app.get('/api/absentees', authenticateToken, async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: process.env.GOOGLE_SHEET_RANGE_ABSENTEES, // should be Absentees!A1:E1000
    });
    const rows = response.data.values;
    // rows[0] is the header: ['studentName', 'mobile', 'Batch Name', 'Absent', 'Absent D-2', 'Last Attended']
    // rows[1..] are the data
    const data = [];
    const header = rows[0];
    const idx = {
      studentName: header.indexOf('studentName'),
      batchName: header.indexOf('Batch Name'),
      absent: header.indexOf('Absent'),
      absentD2: header.indexOf('Absent D-2'),
      lastAttended: header.indexOf('Last Attended')
    };
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const absentValue = row[idx.absent] ? row[idx.absent].toLowerCase() : '';
      const absentD2Value = row[idx.absentD2] ? row[idx.absentD2].toLowerCase() : '';
      data.push({
        studentName: row[idx.studentName],
        batchName: row[idx.batchName],
        absent: absentValue === 'yes' || absentValue === 'true',
        absentRaw: row[idx.absent],
        consecutive: absentD2Value === 'yes' || absentD2Value === 'true',
        absentD2: row[idx.absentD2],
        lastAttended: row[idx.lastAttended]
      });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching absentees data');
  }
});

app.get('/api/attendance-heatmap', authenticateToken, async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: process.env.GOOGLE_SHEET_RANGE_HEATMAP, // should be M0_Heatmap!C1:AI
    });
    const rows = response.data.values;
    // rows[0] is the header: ['Student Name', 'Batch Name', '1-Jun', ...]
    // rows[1..] are the data
    const header = rows[0];
    const idx = {
      studentName: header.indexOf('Student Name'),
      batchName: header.indexOf('Batch Name')
    };
    const dateColumns = header.slice(2); // Dates start from column 2
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const attendance = {};
      for (let j = 0; j < dateColumns.length; j++) {
        const date = dateColumns[j];
        const value = row[j + 2];
        attendance[date] = value && Number(value) > 0;
      }
      data.push({
        studentName: row[idx.studentName],
        batchName: row[idx.batchName],
        attendance
      });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching attendance heatmap data');
  }
});

app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    const { query, batch } = req.query; // Unified search/filter
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: process.env.GOOGLE_SHEET_RANGE_STUDENTS,
    });
    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.json([]);
    }
    const header = rows[0];
    const idx = {
      studentName: header.indexOf('Student Name'),
      batchName: header.indexOf('Batch 1'),
      studentContact: header.indexOf('Student Contact'),
      sid: header.indexOf('Sid'),
      attended: header.indexOf('Attended'),
      classes: header.indexOf('Classes'),
      percent: header.indexOf('Percent')
    };
    let data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      data.push({
        studentName: row[idx.studentName],
        batchName: row[idx.batchName],
        studentContact: row[idx.studentContact],
        sid: row[idx.sid],
        attended: row[idx.attended] ? Number(row[idx.attended]) : null,
        classes: row[idx.classes] ? Number(row[idx.classes]) : null,
        percent: row[idx.percent] ? Number(row[idx.percent]) : null
      });
    }
    function normalize(str) {
      return str ? str.trim().replace(/\s+/g, ' ').toLowerCase() : '';
    }
    // Apply unified search/filter if provided
    if (query) {
      const q = normalize(query);
      data = data.filter(s => {
        const nameNorm = normalize(s.studentName);
        const contactNorm = normalize(s.studentContact);
        return nameNorm.includes(q) || contactNorm.includes(q);
      });
    }
    if (batch) {
      data = data.filter(s =>
        s.batchName && s.batchName.toLowerCase() === batch.toLowerCase()
      );
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching students data');
  }
});

// Endpoint to get unique list of all batch names
app.get('/api/batches', authenticateToken, async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: process.env.GOOGLE_SHEET_RANGE_STUDENTS,
    });
    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.json([]);
    }
    const header = rows[0];
    const batchIdx = header.indexOf('Batch 1');
    const batchesSet = new Set();
    for (let i = 1; i < rows.length; i++) {
      const batchName = rows[i][batchIdx];
      if (batchName) {
        batchesSet.add(batchName);
      }
    }
    res.json(Array.from(batchesSet));
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching batch list');
  }
});

// Endpoint to get batch info for batches tab
app.get('/api/batches-info', authenticateToken, async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: process.env.GOOGLE_SHEET_RANGE_BATCHES_INFO,
    });
    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.json([]);
    }
    const header = rows[0];
    const idx = {
      batch: header.indexOf('Batch'),
      attended: header.indexOf('Attended'),
      total: header.indexOf('Total'),
      percent: header.indexOf('Percent')
    };
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      data.push({
        batch: row[idx.batch],
        attended: row[idx.attended] ? Number(row[idx.attended]) : null,
        total: row[idx.total] ? Number(row[idx.total]) : null,
        percent: row[idx.percent] ? Number(row[idx.percent]) : null
      });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching batches info');
  }
});

// Endpoint to get MTD attendance credits info for batches tab
app.get('/api/batch-credits-info', authenticateToken, async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: process.env.GOOGLE_SHEET_RANGE_BATCH_CREDITS,
    });
    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.json([]);
    }
    const header = rows[0];
    const idx = {
      batch: header.indexOf('Batch'),
      attendedCredits: header.indexOf('Attended Credits'),
      totalCredits: header.indexOf('Total Credits'),
      percent: header.indexOf('Percent')
    };
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      data.push({
        batch: row[idx.batch],
        attendedCredits: row[idx.attendedCredits] ? Number(row[idx.attendedCredits]) : null,
        totalCredits: row[idx.totalCredits] ? Number(row[idx.totalCredits]) : null,
        percent: row[idx.percent] ? Number(row[idx.percent]) : null
      });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching batch credits info');
  }
});

app.get('/api/SSM-performance', authenticateToken, async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: process.env.GOOGLE_SHEET_RANGE_SSM_PERFORMANCE,
    });
    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.json([]);
    }
    const header = rows[0];
    const idx = {
      id: header.indexOf('Id'),
      ssm: header.indexOf('SSM'),
      emiCollected: header.indexOf('emiCollected'),
      emiTarget: header.indexOf('emiTarget'),
      referralRevenue: header.indexOf('referralRevenue'),
      referralTarget: header.indexOf('referralTarget'),
      loanConversions: header.indexOf('loanConversions'),
      loanTarget: header.indexOf('loanTarget'),
    };

    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      data.push({
        managerId: row[idx.id],
        managerName: row[idx.ssm],
        emiCollected: row[idx.emiCollected] ? Number(row[idx.emiCollected]) : null,
        emiTarget: row[idx.emiTarget] ? Number(row[idx.emiTarget]) : null,
        referralRevenue: row[idx.referralRevenue] ? Number(row[idx.referralRevenue]) : null,
        referralTarget: row[idx.referralTarget] ? Number(row[idx.referralTarget]) : null,
        loanConversions: row[idx.loanConversions] ? Number(row[idx.loanConversions]) : null,
        loanTarget: row[idx.loanTarget] ? Number(row[idx.loanTarget]) : null,
      });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching SSM performance data');
  }
});


app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).send('Invalid username or password');
  }

  try {
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (isMatch) {
      const token = crypto.randomBytes(32).toString('hex'); // Generate a random token
      activeSessions[token] = username;
      console.log(`User ${username} logged in. Token: ${token}`);
      res.json({ token });
    } else {
      res.status(401).send('Invalid username or password');
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send('Server error during login');
  }
});

app.post('/api/logout', authenticateToken, (req, res) => {
  const token = req.headers['x-auth-token'];
  if (activeSessions[token]) {
    delete activeSessions[token];
    console.log(`User ${req.user.username} logged out.`);
    res.status(200).send('Logged out successfully');
  } else {
    res.status(400).send('No active session found for this token');
  }
});

app.get('/', (req, res) => {
  res.send('Attendance Backend is running. Use /api/login, /api/kpis, /api/batch-attendance, or /api/absentees.');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 