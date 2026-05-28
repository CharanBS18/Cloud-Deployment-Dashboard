import { Router } from 'itty-router';
import { json, cors } from 'itty-router';
import { sign, verify } from '@tsndr/cloudflare-worker-jwt';

const router = Router();

// Apply CORS
router.all('*', cors());

// Constants
const JWT_SECRET = 'cloud_deployment_dashboard_secret_key_123';

// Helper: Parse JWT
async function verifyToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.split(' ')[1];
  if (!token) return null;

  try {
    const decoded = await verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}

// Helper: Create JWT
async function createToken(payload) {
  return sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

// Helper: Hash password (simple bcrypt simulation)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

async function comparePassword(password, hash) {
  const hashed = await hashPassword(password);
  return hashed === hash;
}

// ============ AUTHENTICATION ROUTES ============

// Signup
router.post('/api/auth/signup', async (request, env) => {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return json({ error: 'Username and password are required' }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await env.DB.get(`user:${username}`);
    if (existingUser) {
      return json({ error: 'Username already exists' }, { status: 400 });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      username,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    await env.DB.put(`user:${username}`, JSON.stringify(user));
    await env.DB.put(`user_id:${userId}`, JSON.stringify(user));

    // Generate token
    const token = await createToken({ id: userId, username });

    return json({
      token,
      user: { id: userId, username, createdAt: user.createdAt }
    }, { status: 201 });
  } catch (err) {
    console.error(err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
});

// Login
router.post('/api/auth/login', async (request, env) => {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return json({ error: 'Username and password are required' }, { status: 400 });
    }

    // Get user
    const userStr = await env.DB.get(`user:${username}`);
    if (!userStr) {
      return json({ error: 'Invalid username or password' }, { status: 400 });
    }

    const user = JSON.parse(userStr);

    // Verify password
    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return json({ error: 'Invalid username or password' }, { status: 400 });
    }

    // Generate token
    const token = await createToken({ id: user.id, username: user.username });

    return json({
      token,
      user: { id: user.id, username: user.username, createdAt: user.createdAt }
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
});

// Get current user
router.get('/api/auth/me', async (request, env) => {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userStr = await env.DB.get(`user_id:${user.id}`);
    if (!userStr) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    const userData = JSON.parse(userStr);
    return json({ 
      id: userData.id, 
      username: userData.username, 
      createdAt: userData.createdAt 
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ============ FILE UPLOADS ROUTES ============

// List uploads
router.get('/api/uploads', async (request, env) => {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uploadsStr = await env.DB.get(`uploads:${user.id}`);
    const uploads = uploadsStr ? JSON.parse(uploadsStr) : [];

    return json(uploads);
  } catch (err) {
    console.error(err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
});

// Create dummy upload (Cloudflare Workers has file upload limitations)
router.post('/api/upload', async (request, env) => {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For Cloudflare Workers, we'll store file metadata only
    const uploadId = crypto.randomUUID();
    const upload = {
      id: uploadId,
      userId: user.id,
      originalName: 'demo-file.txt',
      filename: uploadId,
      mimeType: 'text/plain',
      size: 0,
      url: 'https://via.placeholder.com/150',
      isS3: false,
      createdAt: new Date().toISOString()
    };

    const uploadsStr = await env.DB.get(`uploads:${user.id}`);
    const uploads = uploadsStr ? JSON.parse(uploadsStr) : [];
    uploads.push(upload);
    await env.DB.put(`uploads:${user.id}`, JSON.stringify(uploads));

    return json(upload, { status: 201 });
  } catch (err) {
    console.error(err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
});

// Delete upload
router.delete('/api/uploads/:id', async (request, env) => {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = request.params;
    const uploadsStr = await env.DB.get(`uploads:${user.id}`);
    const uploads = uploadsStr ? JSON.parse(uploadsStr) : [];

    const filtered = uploads.filter(u => u.id !== id);
    if (filtered.length === uploads.length) {
      return json({ error: 'File not found' }, { status: 404 });
    }

    await env.DB.put(`uploads:${user.id}`, JSON.stringify(filtered));
    return json({ message: 'File deleted successfully', id });
  } catch (err) {
    console.error(err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ============ MONITORING ROUTES ============

// Server stats
router.get('/api/monitor/stats', async (request, env) => {
  return json({
    status: 'online',
    system: {
      platform: 'Cloudflare Workers',
      uptime: 0,
      cpuUsage: Math.floor(Math.random() * 15) + 5,
      memory: {
        total: 128,
        used: Math.floor(Math.random() * 64),
        percentage: Math.floor(Math.random() * 50)
      }
    },
    cloud: {
      database: 'healthy',
      s3: {
        configured: false,
        region: 'not-configured',
        bucket: 'not-configured'
      }
    }
  });
});

// Logs stream (simplified)
router.get('/api/monitor/logs/stream', async (request, env) => {
  return new Response(
    new ReadableStream({
      start(controller) {
        const interval = setInterval(() => {
          const log = {
            timestamp: new Date().toISOString(),
            method: 'GET',
            path: '/api/test',
            statusCode: 200,
            duration: Math.random() * 100
          };
          controller.enqueue(`data: ${JSON.stringify(log)}\n\n`);
        }, 2000);

        request.signal.addEventListener('abort', () => {
          clearInterval(interval);
          controller.close();
        });
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    }
  );
});

// 404 handler
router.all('*', () => {
  return json({ error: 'Not found' }, { status: 404 });
});

export default router;
