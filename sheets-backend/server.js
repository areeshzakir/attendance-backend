const express = require('express');
const { google } = require('googleapis');
const app = express();
const port = 3000;

// This is the path to your downloaded JSON key
const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/classplus/Desktop/My Projects/attendance-backend/plutus-458212-0440289864bf.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

app.get('/data', async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: '1BBgF0Gtn1SrIx_UxaWThaTWwVSB8UGt939X-tZwEdkw', // Replace with your sheet ID
      range: 'export_for_dash!A1:D3',         // Replace with your desired range
    });
    res.json(response.data.values);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching data');
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 