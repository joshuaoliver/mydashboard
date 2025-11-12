#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const PORT = 47392;
const MEDIA_DIR = '/Users/joshuaoliver/Library/Application Support/BeeperTexts/media';

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

const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Decode and sanitize the URL
  let filePath = decodeURIComponent(req.url);
  
  // Remove query parameters
  filePath = filePath.split('?')[0];
  
  // Resolve the full file path
  filePath = path.join(MEDIA_DIR, filePath);

  // Security check - prevent directory traversal
  const resolvedPath = path.resolve(filePath);
  const resolvedMediaDir = path.resolve(MEDIA_DIR);
  
  if (!resolvedPath.startsWith(resolvedMediaDir)) {
    console.log(`[403] Forbidden: ${req.url}`);
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err) {
      console.log(`[404] Not found: ${req.url}`);
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    if (stats.isDirectory()) {
      // List directory contents
      fs.readdir(filePath, (err, files) => {
        if (err) {
          res.writeHead(500);
          res.end('Error reading directory');
          return;
        }

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Directory listing for ${req.url}</title>
            <style>
              body { font-family: monospace; margin: 40px; }
              a { display: block; margin: 5px 0; }
            </style>
          </head>
          <body>
            <h1>Directory listing for ${req.url}</h1>
            <hr>
            ${files.map(file => `<a href="${path.join(req.url, file)}">${file}</a>`).join('')}
            <hr>
          </body>
          </html>
        `;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      });
      return;
    }

    // Serve the file
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const stream = fs.createReadStream(filePath);
    
    stream.on('open', () => {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size
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
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

