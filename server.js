const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const PORT = 3000;

// A place to store codes and file info (temporary)
const codes = {};

// Setup where files are saved
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Allow HTML and form to work
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// 🔐 Function to make a 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 📤 Upload file and generate code
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');

  const code = generateCode();
  const option = req.body.expiryOption;

  let expiresAt;
  let oneTime = false;

  if (option === '24h') {
    expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  } else if (option === '48h') {
    expiresAt = Date.now() + 48 * 60 * 60 * 1000;
  } else if (option === 'once') {
    expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // give 7 days in case user never downloads
    oneTime = true;
  }

  codes[code] = {
    filePath: req.file.path,
    fileName: req.file.originalname,
    createdAt: Date.now(),
    expiryType: option,  // use the correct variable
    expiresAt,
    downloads: 0
  };
  
    


  res.send(`
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Upload Successful - ZipKey</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #e8f0fe; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .box { background: #fff; padding: 30px 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
          h2 { color: #1d4ed8; }
          .code { font-size: 28px; font-weight: bold; color: #10b981; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>✅ File Uploaded!</h2>
          <p>Share this code with your friend:</p>
          <div class="code">${code}</div>
          <p><a href="/download.html">Go to Download Page</a></p>
          <p><a href="/index.html">Go to Home</a></p>
        </div>
      </body>
    </html>
  `);
});

// 📥 Download file using code
const fs = require('fs');


app.get('/download/:code', (req, res) => {
  const code = req.params.code;
  const data = codes[code];

  if (!data) {
    return res.status(404).send(`
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Invalid Code - ZipKey</title>
          <style>
            body {
              font-family: 'Segoe UI', sans-serif;
              background: #fef2f2;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
            }
            .box {
              background: #fff;
              padding: 30px 40px;
              border-radius: 12px;
              text-align: center;
              box-shadow: 0 4px 16px rgba(0,0,0,0.1);
            }
            h2 {
              color: #dc2626;
              font-size: 22px;
            }
            p {
              font-size: 16px;
              color: #333;
            }
            a {
              text-decoration: none;
              color: #3b82f6;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>Invalid or Expired Code</h2>
            <p>This file code doesn’t exist or has already expired.</p>
            <p><a href="/">Back to Home</a></p>
          </div>
        </body>
      </html>
    `);
  }
  

  // For one-time download
  if (data.expiryType === 'once') {
    // Send file first, THEN delete after sending completes
    res.download(data.filePath, data.fileName, (err) => {
      if (err) {
        console.error('Error during file download:', err);
        return res.status(500).send('Error sending the file.');
      }
    
      fs.unlink(data.filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('❌ Error deleting file:', unlinkErr);
        } else {
          console.log('✅ File deleted after one-time download');
        }
      });
    
      delete codes[code];
    });
    

  } else {
    // For 24hr or 48hr (multi-downloads allowed)
    data.downloads = (data.downloads || 0) + 1;
    res.download(data.filePath, data.fileName);
  }
});


setInterval(() => {
  const now = Date.now();

  for (const code in codes) {
    const data = codes[code];

    // Skip 'once' — they get deleted on download
    if (data.expiryType === 'one') continue;

    if (data.expiresAt && now > data.expiresAt) {
      fs.unlink(data.filePath, (err) => {
        if (err) {
          console.error(`Error deleting expired file [${code}]:`, err);
        } else {
          console.log(`🗑️ Deleted expired file [${code}]`);
        }
      });

      delete codes[code];
    }
  }
}, 60 * 60 * 1000); // runs every 1 hour



app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
