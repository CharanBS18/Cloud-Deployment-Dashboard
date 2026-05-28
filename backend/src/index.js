const JWT_SECRET = 'cloud_deployment_dashboard_secret_key_123';

// Helper: Hash password
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function comparePassword(password, hash) {
  const hashed = await hashPassword(password);
  return hashed === hash;
}

// Simple JWT
function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 }));
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  const sig = base64url(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${header}.${body}.${sig}`;
}

async function verifyToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.split(' ')[1];
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const isValid = await crypto.subtle.verify('HMAC', key, new Uint8Array(atob(signature.replace(/-/g, '+').replace(/_/g, '/') + '===').split('').map(c => c.charCodeAt(0))), encoder.encode(`${header}.${body}`));
    
    if (!isValid) return null;

    const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    
    return payload;
  } catch (err) {
    return null;
  }
}

// Response helpers
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// Router
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  // Authentication routes
  if (pathname === '/api/auth/signup' && method === 'POST') {
    return handleSignup(request, env);
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    return handleLogin(request, env);
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    return handleGetMe(request, env);
  }

  // File routes
  if (pathname === '/api/uploads' && method === 'GET') {
    return handleListUploads(request, env);
  }

  if (pathname === '/api/upload' && method === 'POST') {
    return handleUpload(request, env);
  }

  if (pathname.startsWith('/api/uploads/') && method === 'DELETE') {
    const id = pathname.split('/').pop();
    return handleDeleteUpload(id, request, env);
  }

  // Monitoring routes
  if (pathname === '/api/monitor/stats' && method === 'GET') {
    return handleStats(request, env);
  }

  if (pathname === '/api/monitor/logs/stream' && method === 'GET') {
    return handleLogsStream(request, env);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ============ AUTHENTICATION HANDLERS ============

async function handleSignup(request, env) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return jsonResponse({ error: 'Username and password are required' }, 400);
    }

    const existingUser = await env.DB.get(`user:${username}`);
    if (existingUser) {
      return jsonResponse({ error: 'Username already exists' }, 400);
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      username,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    await env.DB.put(`user:${username}`, JSON.stringify(user));
    await env.DB.put(`user_id:${userId}`, JSON.stringify(user));

    const token = await createToken({ id: userId, username });

    return jsonResponse({
      token,
      user: { id: userId, username, createdAt: user.createdAt }
    }, 201);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleLogin(request, env) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return jsonResponse({ error: 'Username and password are required' }, 400);
    }

    const userStr = await env.DB.get(`user:${username}`);
    if (!userStr) {
      return jsonResponse({ error: 'Invalid username or password' }, 400);
    }

    const user = JSON.parse(userStr);
    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return jsonResponse({ error: 'Invalid username or password' }, 400);
    }

    const token = await createToken({ id: user.id, username: user.username });

    return jsonResponse({
      token,
      user: { id: user.id, username: user.username, createdAt: user.createdAt }
    });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleGetMe(request, env) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userStr = await env.DB.get(`user_id:${user.id}`);
    if (!userStr) {
      return jsonResponse({ error: 'User not found' }, 404);
    }

    const userData = JSON.parse(userStr);
    return jsonResponse({ 
      id: userData.id, 
      username: userData.username, 
      createdAt: userData.createdAt 
    });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

// ============ FILE HANDLERS ============

async function handleListUploads(request, env) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const uploadsStr = await env.DB.get(`uploads:${user.id}`);
    const uploads = uploadsStr ? JSON.parse(uploadsStr) : [];

    return jsonResponse(uploads);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleUpload(request, env) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

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

    return jsonResponse(upload, 201);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleDeleteUpload(id, request, env) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const uploadsStr = await env.DB.get(`uploads:${user.id}`);
    const uploads = uploadsStr ? JSON.parse(uploadsStr) : [];

    const filtered = uploads.filter(u => u.id !== id);
    if (filtered.length === uploads.length) {
      return jsonResponse({ error: 'File not found' }, 404);
    }

    await env.DB.put(`uploads:${user.id}`, JSON.stringify(filtered));
    return jsonResponse({ message: 'File deleted successfully', id });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

// ============ MONITORING HANDLERS ============

async function handleStats(request, env) {
  return jsonResponse({
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
}

async function handleLogsStream(request, env) {
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
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}

// Export handler
export default {
  fetch: handleRequest
};
