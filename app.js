// app.js (Backend Server)

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'uploads'))); // Serve uploaded photos if needed

// Ensure uploads directory exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// Multer setup for photo upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  }
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student_admissions', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Student Schema
const studentSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  dob: { type: Date, required: true },
  gender: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  previousSchool: { type: String },
  result: { type: String, required: true },
  classApplying: { type: String, required: true },
  photo: { type: String }, // Path to uploaded photo
  agreed: { type: Boolean, required: true }
});

const Student = mongoose.model('Student', studentSchema);

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/submit', upload.single('photo'), async (req, res) => {
  try {
    const { fullName, dob, gender, email, phone, address, previousSchool, result, classApplying, agreed } = req.body;
    
    // Server-side basic validation (though client handles most)
    if (!fullName || !dob || !gender || !email || !phone || !address || !result || !classApplying || agreed !== 'on') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Age check (server-side for safety)
    const birthDate = new Date(dob);
    const age = (new Date() - birthDate) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 18) {
      return res.status(400).json({ error: 'Must be at least 18 years old' });
    }

    // Email format
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Phone format
    if (!/^\d{3}-\d{3}-\d{4}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone format' });
    }

    const newStudent = new Student({
      fullName,
      dob: birthDate,
      gender,
      email,
      phone,
      address,
      previousSchool,
      result,
      classApplying,
      photo: req.file ? req.file.path : null,
      agreed: true
    });

    await newStudent.save();

    // Send email notification
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.ADMIN_EMAIL || 'admin@example.com',
      subject: 'New Student Admission Submission',
      text: `
        New submission:
        Full Name: ${fullName}
        DOB: ${dob}
        Gender: ${gender}
        Email: ${email}
        Phone: ${phone}
        Address: ${address}
        Previous School: ${previousSchool || 'N/A'}
        Result: ${result}
        Class Applying: ${classApplying}
        Photo: ${req.file ? 'Attached' : 'None'}
      `,
      attachments: req.file ? [{ path: req.file.path }] : []
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Submission successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});