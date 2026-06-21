#!/usr/bin/env node
// Local dev server: static files + /api/llm + /api/transcribe (same as Vercel).
// Usage: node scripts/dev-server.js  →  http://localhost:3000?mode=live

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function makeRes(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(obj) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(obj));
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

async function handleApi(req, res, relPath) {
  const handlerPath = path.join(ROOT, relPath);
  if (!fs.existsSync(handlerPath)) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  const body = await readBody(req);
  const handler = require(handlerPath);
  await handler(
    { method: req.method, headers: req.headers, body },
    makeRes(res)
  );
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath.replace(/^\//, '').replace(/\.\./g, ''));
  if (!filePath.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  try {
    if (req.url.startsWith('/api/llm')) return handleApi(req, res, 'api/llm.js');
    if (req.url.startsWith('/api/transcribe')) return handleApi(req, res, 'api/transcribe.js');
    serveStatic(req, res);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end(String(e.message || e));
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Scheduling Agent — local dev');
  console.log('  ─────────────────────────────');
  console.log('  App:    http://localhost:' + PORT + '/?mode=live');
  console.log('  Voice:  Settings → enable AI + OpenAI Whisper key');
  console.log('');
});
