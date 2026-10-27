const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const PORT = process.env.PORT || process.env.V5_PORT || 3100;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'issues.json');
const PUBLIC_DIR = __dirname;   // ← fixed for your upload structure

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readIssues() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function writeIssues(issues) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(issues, null, 2), 'utf8');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getToday() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        if (req.headers['content-type']?.includes('application/json')) {
          resolve(JSON.parse(body || '{}'));
        } else {
          resolve(querystring.parse(body));
        }
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (pathname === '/advisor' || pathname === '/supervisor') {
        const page = pathname.slice(1) + '.html';
        fs.readFile(path.join(PUBLIC_DIR, page), (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data2);
          }
        });
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/issues' && req.method === 'POST') {
    const body = await parseBody(req);
    const email = (body.email || '').trim();
    const tlName = (body.tlName || body.tl_name || '').trim();
    const chatLink = (body.chatLink || body.chat_link || '').trim();

    if (!email || !tlName) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Email ID and TL Name are required' }));
      return;
    }

    const issues = readIssues();
    const newIssue = {
      id: generateId(),
      email,
      tlName,
      chatLink: chatLink || null,
      status: 'open',
      createdAt: new Date().toISOString(),
      fixedAt: null
    };
    issues.unshift(newIssue);
    writeIssues(issues);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(newIssue));
    return;
  }

  if (pathname === '/api/issues' && req.method === 'GET') {
    const parsed = url.parse(req.url, true);
    const { status, date, email } = parsed.query;
    let issues = readIssues();

    if (status) issues = issues.filter(i => i.status === status);
    if (date) issues = issues.filter(i => i.createdAt.startsWith(date));
    if (email) issues = issues.filter(i => i.email.toLowerCase() === email.toLowerCase());

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(issues));
    return;
  }

  if (pathname.startsWith('/api/issues/') && req.method === 'PATCH') {
    const id = pathname.split('/')[3];
    const issues = readIssues();
    const idx = issues.findIndex(i => i.id === id);
    if (idx === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return;
    }
    const body = await parseBody(req);
    if (body.status === 'fixed') {
      issues[idx].status = 'fixed';
      issues[idx].fixedAt = new Date().toISOString();
    }
    writeIssues(issues);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(issues[idx]));
    return;
  }

  if (pathname === '/api/stats/advisor' && req.method === 'GET') {
    const parsed = url.parse(req.url, true);
    const email = (parsed.query.email || '').trim();
    if (!email) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'email required' }));
      return;
    }
    const today = getToday();
    const issues = readIssues().filter(i =>
      i.email.toLowerCase() === email.toLowerCase() &&
      i.createdAt.startsWith(today)
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      email,
      date: today,
      count: issues.length,
      open: issues.filter(i => i.status === 'open').length,
      fixed: issues.filter(i => i.status === 'fixed').length
    }));
    return;
  }

  if (pathname === '/api/export' && req.method === 'GET') {
    const parsed = url.parse(req.url, true);
    const date = parsed.query.date || getToday();
    let issues = readIssues().filter(i => i.createdAt.startsWith(date));

    const header = ['ID', 'Email ID', 'TL Name', 'Chat Link', 'Status', 'Created At', 'Fixed At'];
    const rows = issues.map(i => [
      i.id,
      `"${(i.email || '').replace(/"/g, '""')}"`,
      `"${(i.tlName || '').replace(/"/g, '""')}"`,
      `"${(i.chatLink || '').replace(/"/g, '""')}"`,
      i.status,
      i.createdAt,
      i.fixedAt || ''
    ]);

    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const filename = `V5_Issues_${date}.csv`;

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    res.end('\uFEFF' + csv);
    return;
  }

  if (pathname === '/api/stats/summary' && req.method === 'GET') {
    const issues = readIssues();
    const today = getToday();
    const openToday = issues.filter(i => i.status === 'open' && i.createdAt.startsWith(today)).length;
    const totalOpen = issues.filter(i => i.status === 'open').length;
    const totalToday = issues.filter(i => i.createdAt.startsWith(today)).length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ totalOpen, openToday, totalToday, lastUpdated: new Date().toISOString() }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, pathname);
    } catch (e) {
      console.error(e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server error' }));
    }
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`V5 Issue Tracker by Shareque running at http://localhost:${PORT}`);
  console.log(`Advisor:  http://localhost:${PORT}/advisor`);
  console.log(`Supervisor: http://localhost:${PORT}/supervisor`);
});
