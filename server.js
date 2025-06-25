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
    res.json(response.data.values);
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
    res.json(response.data.values);
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
      range: process.env.GOOGLE_SHEET_RANGE_ABSENTEES,
    });
    res.json(response.data.values);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching absentees data');
  }
});

app.get('/', (req, res) => {
  res.send('Attendance Backend is running. Use /api/kpis, /api/batch-attendance, or /api/absentees.');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 