const fs = require('fs').promises;
const path = require('path');

const LOGS_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'server.log');

// Ensure log folder and file exist
async function initLogger() {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    try {
      await fs.access(LOG_FILE);
    } catch {
      await fs.writeFile(LOG_FILE, '');
    }
  } catch (err) {
    console.error('Error initializing logger:', err);
  }
}

initLogger();

// Array of active Server-Sent Event clients
let clients = [];

// Log request info
async function logMessage(method, url, status, duration) {
  const timestamp = new Date().toISOString();
  const cleanUrl = url.split('?')[0]; // Remove query params for cleaner logs
  const logLine = `[${timestamp}] [${method.toUpperCase()}] ${cleanUrl} - Status: ${status} - Latency: ${duration}ms\n`;
  
  // Write to log file asynchronously
  try {
    // Append to file (we don't wait for write before returning to keep API fast)
    await fs.appendFile(LOG_FILE, logLine, 'utf8');
  } catch (err) {
    console.error('Error writing log file:', err);
  }

  // Send to all connected SSE clients
  const logObject = {
    timestamp,
    method,
    url: cleanUrl,
    status,
    duration
  };

  clients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(logObject)}\n\n`);
  });
}

// Express Middleware to intercept and log traffic
function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Hook the response finish event to capture actual status code and duration
  res.on('finish', () => {
    const duration = Date.now() - start;
    logMessage(req.method, req.originalUrl, res.statusCode, duration);
  });
  
  next();
}

// SSE stream handler
function registerSseClient(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  // Send initial welcome message or history logs
  res.write(`data: ${JSON.stringify({ type: 'info', message: 'Connected to AWS PM2/Nginx System Log Stream' })}\n\n`);

  // Log connection
  console.log(`SSE Client connected: ${clientId}`);

  // Handle client disconnection
  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
    console.log(`SSE Client disconnected: ${clientId}`);
  });
}

// Read log file history
async function getLogHistory() {
  try {
    const data = await fs.readFile(LOG_FILE, 'utf8');
    // Return last 100 lines
    const lines = data.trim().split('\n');
    return lines.slice(-100).map(line => {
      // Parse basic lines back into objects or return as raw string
      const match = line.match(/^\[(.*?)\] \[(.*?)\] (.*?) - Status: (.*?) - Latency: (.*?)ms/);
      if (match) {
        return {
          timestamp: match[1],
          method: match[2],
          url: match[3],
          status: parseInt(match[4]),
          duration: parseInt(match[5])
        };
      }
      return { raw: line };
    });
  } catch (err) {
    console.error('Error reading log history:', err);
    return [];
  }
}

module.exports = {
  requestLogger,
  registerSseClient,
  getLogHistory,
  logMessage
};
