require('dotenv').config();
const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// ====================== MIDDLEWARE SETUP ======================
app.use(cors());
app.use(express.json());

// ====================== FILE UPLOAD CONFIG ======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ====================== EMAIL TRANSPORTER ======================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-password-or-app-password'
  }
});

// ====================== API ENDPOINT ======================
app.post('/api/zip-and-send', upload.array('pdfs', 2), async (req, res) => {
  try {
    const { email } = req.body;
    const files = req.files;

    // Validate input
    if (!files || files.length < 2) {
      return res.status(400).json({ error: 'Please upload exactly 2 PDF files' });
    }

    // ========== ZIP CREATION ==========
    const zip = new AdmZip();
    
    // Add both PDFs to the zip with their original names
    files.forEach(file => {
      zip.addLocalFile(file.path, '', file.originalname);
    });

    const zipPath = path.join(__dirname, 'pdf_files.zip');
    zip.writeZip(zipPath);

    // ========== EMAIL SENDING ==========
    await transporter.sendMail({
      from: `"PDF Zipper" <${process.env.EMAIL_USER || 'your@gmail.com'}>`,
      to: email,
      subject: 'Your PDF Files',
      text: 'Please find your PDF files attached in a zip archive.',
      attachments: [{
        filename: 'pdf_files.zip',
        path: zipPath
      }]
    });

    // ========== CLEANUP ==========
    files.forEach(file => fs.unlinkSync(file.path));
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    res.json({ 
      success: true, 
      message: 'PDFs zipped and sent successfully!',
      fileNames: files.map(file => file.originalname) 
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to process your request',
      details: error.message 
    });
  }
});

// ====================== SERVER START ======================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Endpoint: http://localhost:${PORT}/api/zip-and-send`);
});