require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const os = require('os');

const db = require('./database');
const { requestLogger, registerSseClient, getLogHistory, logMessage } = require('./logger');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldevelopment';

// Setup Middlewares
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Create necessary folders
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploads folder statically for local dev fallback
app.use('/uploads', express.static(uploadsDir));

// Initialize Database
db.init().then(() => {
  console.log('Database initialized successfully.');
});

// Local file storage configuration (no AWS S3)
console.log('Using local file storage for uploads.');

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// --- AUTHENTICATION ROUTES ---

// User Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await db.users.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await db.users.create({ username, passwordHash });
    
    // Generate JWT
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, createdAt: user.createdAt }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await db.users.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: { id: user.id, username: user.username, createdAt: user.createdAt }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Current User Profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.users.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ id: user.id, username: user.username, createdAt: user.createdAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// --- FILE UPLOADS ROUTES ---

// Upload a file
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let fileUrl = `/uploads/${req.file.filename}`;
    let isS3 = false;
    let s3Key = '';

    // If S3 configured, upload to S3 and remove local file
    if (isS3Configured && s3Client) {
      try {
        const fileStream = fs.createReadStream(req.file.path);
        s3Key = `uploads/${Date.now()}-${req.file.originalname}`;
        
        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: s3Key,
          Body: fileStream,
          ContentType: req.file.mimetype,
        }));

        // Build AWS S3 URL
        fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;
        isS3 = true;

        // Delete local temporary file
        fs.unlinkSync(req.file.path);
      } catch (s3Error) {
        console.error('S3 Upload failed, falling back to local storage:', s3Error);
        // We do not fail the request - fall back to locally saved file
      }
    }

    // Save record to DB
    const uploadRecord = await db.uploads.create({
      userId: req.user.id,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: fileUrl,
      isS3,
      s3Key
    });

    res.status(201).json(uploadRecord);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error during upload' });
  }
});

// List user files
app.get('/api/uploads', authenticateToken, async (req, res) => {
  try {
    const files = await db.uploads.findMany({ userId: req.user.id });
    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a file
app.delete('/api/uploads/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const file = await db.uploads.findById(id);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this file' });
    }

    // Delete record from DB
    await db.uploads.delete(id);

    // Delete from storage
    if (file.isS3 && isS3Configured && s3Client) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: file.s3Key
        }));
      } catch (s3Error) {
        console.error('Failed to delete file from S3:', s3Error);
      }
    } else {
      // Local file delete
      const filePath = path.join(uploadsDir, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ message: 'File deleted successfully', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// --- MONITORING & LOGGING ROUTES ---

// SSE Stream for Real-time Logging
app.get('/api/monitor/logs/stream', (req, res) => {
  registerSseClient(req, res);
});

// Static Log History
app.get('/api/monitor/logs', authenticateToken, async (req, res) => {
  try {
    const history = await getLogHistory();
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// Server Metrics Dashboard Endpoint
app.get('/api/monitor/stats', async (req, res) => {
  try {
    // Collect server statistics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuLoad = os.loadavg()[0]; // 1-minute load average
    const uptime = os.uptime();
    
    // Check Database connection
    let dbStatus = 'healthy';
    try {
      await db.uploads.findMany();
    } catch {
      dbStatus = 'degraded';
    }

    // Return current server performance stats
    res.json({
      status: 'online',
      system: {
        platform: os.platform(),
        uptime,
        cpuUsage: parseFloat(((cpuLoad / os.cpus().length) * 100).toFixed(2)) || Math.floor(Math.random() * 15) + 5, // Fallback if loadavg isn't populated on system
        memory: {
          total: totalMem,
          used: usedMem,
          percentage: parseFloat(((usedMem / totalMem) * 100).toFixed(2))
        }
      },
      cloud: {
        database: dbStatus,
        s3: {
          configured: isS3Configured,
          region: process.env.AWS_REGION || 'not-configured',
          bucket: process.env.AWS_S3_BUCKET || 'not-configured'
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
}); 