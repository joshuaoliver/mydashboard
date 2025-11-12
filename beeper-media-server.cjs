#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 47392;
const MEDIA_DIR = '/Users/joshuaoliver/Library/Application Support/BeeperTexts/media';
const AUTH_TOKEN = '1c265ccc683ee3a761d38ecadaee812d18a6404a582150044ec3973661e016c9';

// Rate limiting: simple in-memory store
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
};

// Clean up old rate limit entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (now - data.timestamp > RATE_LIMIT_WINDOW) {
      requestCounts.delete(ip);
    }
  }
}, 60000);

const server = http.createServer((req, res) => {
  const clientIP = req.socket.remoteAddress || 'unknown';
  
  // Add security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    console.log(`[405] Method not allowed: ${req.method} from ${clientIP}`);
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  // Rate limiting
  const rateLimitData = requestCounts.get(clientIP) || { count: 0, timestamp: Date.now() };
  const now = Date.now();
  
  if (now - rateLimitData.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitData.count = 1;
    rateLimitData.timestamp = now;
  } else {
    rateLimitData.count++;
  }
  
  requestCounts.set(clientIP, rateLimitData);
  
  if (rateLimitData.count > MAX_REQUESTS_PER_WINDOW) {
    console.log(`[429] Rate limit exceeded: ${clientIP}`);
    res.writeHead(429);
    res.end('Too many requests');
    return;
  }

  // Parse URL to get query parameters
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Check authorization token - support both header and query string
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader?.replace('Bearer ', '');
  const queryToken = url.searchParams.get('token');
  const token = headerToken || queryToken;
  
  if (token !== AUTH_TOKEN) {
    console.log(`[401] Unauthorized access attempt from ${clientIP}: ${req.url}`);
    res.writeHead(401);
    res.end('Unauthorized');
    return;
  }

  // Decode and sanitize the URL path (without query parameters)
  let filePath = decodeURIComponent(url.pathname);
  
  // Block root directory access
  if (filePath === '/' || filePath === '') {
    console.log(`[403] Root directory access blocked: ${clientIP}`);
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  // Resolve the full file path
  filePath = path.join(MEDIA_DIR, filePath);

  // Security check - prevent directory traversal
  const resolvedPath = path.resolve(filePath);
  const resolvedMediaDir = path.resolve(MEDIA_DIR);
  
  if (!resolvedPath.startsWith(resolvedMediaDir)) {
    console.log(`[403] Directory traversal attempt from ${clientIP}: ${req.url}`);
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err) {
      console.log(`[404] Not found: ${req.url} from ${clientIP}`);
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    // DISABLE directory listings - only serve files
    if (stats.isDirectory()) {
      console.log(`[403] Directory listing blocked: ${req.url} from ${clientIP}`);
      res.writeHead(403);
      res.end('Forbidden: Directory listing disabled');
      return;
    }

    // Serve the file
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const stream = fs.createReadStream(filePath);
    
    stream.on('open', () => {
      console.log(`[200] Serving: ${req.url} to ${clientIP}`);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Cache-Control': 'private, max-age=3600'
      });
      stream.pipe(res);
    });

    stream.on('error', (err) => {
      console.error(`[500] Error serving file: ${filePath}`, err);
      res.writeHead(500);
      res.end('Error serving file');
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Beeper Media Server running at http://127.0.0.1:${PORT}/`);
  console.log(`Serving files from: ${MEDIA_DIR}`);
  console.log(`Authorization: Token-based (required in Authorization header)`);
  console.log(`Security: Directory listings DISABLED, Rate limiting ENABLED`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

