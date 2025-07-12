require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// Parse credentials from environment variable
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

app.get('/api/kpis', async (req, res) => {
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

app.get('/api/batch-attendance', async (req, res) => {
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

app.get('/api/absentees', async (req, res) => {
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

app.get('/api/attendance-heatmap', async (req, res) => {
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

app.get('/api/students', async (req, res) => {
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
    // Apply unified search/filter if provided
    if (query) {
      const q = query.toLowerCase();
      console.log('Search Query (lowercase):', q); // Debug log
      data = data.filter(s =>{
        const matchesName = s.studentName && s.studentName.toLowerCase().includes(q);
        const matchesContact = s.studentContact && s.studentContact.toLowerCase().includes(q);
        console.log(`Student: ${s.studentName || 'N/A'}, Contact: ${s.studentContact || 'N/A'} - Name Match: ${matchesName}, Contact Match: ${matchesContact}`); // Debug log
        return matchesName || matchesContact;
      }
      );
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
app.get('/api/batches', async (req, res) => {
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
app.get('/api/batches-info', async (req, res) => {
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
app.get('/api/batch-credits-info', async (req, res) => {
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

app.get('/', (req, res) => {
  res.send('Attendance Backend is running. Use /api/kpis, /api/batch-attendance, or /api/absentees.');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 