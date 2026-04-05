const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/resume-download', (req, res) => {
  const filePath = path.join(__dirname, 'Prateek_Agarwal.pdf');
  res.download(filePath, 'Prateek_Agarwal_Resume.pdf', (err) => {
    if (err && !res.headersSent) {
      res.status(500).send('Unable to download resume.');
    }
  });
});

app.get('*', (req, res, next) => {
  if (req.path.includes('.')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Portfolio running on http://localhost:${PORT}`);
});
