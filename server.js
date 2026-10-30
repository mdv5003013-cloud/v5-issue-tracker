const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3100;
const MONGODB_URI = process.env.MONGODB_URI || '';
const PUBLIC_DIR = __dirname;

let issuesCollection = null;

async function connectDB() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set!');
    return;
  }
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('v5tracker');
    issuesCollection = db.collection('issues');
    console.log('Connected to MongoDB successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
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

  if (!issuesCollection) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Database not connected yet' }));
    return;
  }

  // POST /api/issues
  if (pathname === '/api/issues' && req.method === 'POST') {
    const body = await parseBody(req);
    const email = (body.email || '').trim();
    const tlName = (body.tlName || body.tl_name || '').trim();
    const chatLink = (body.chatLink || body.chat_link || '').trim();
    const issueFacing = (body.issueFacing || body.issue_facing || '').trim();

    if (!email || !tlName || !issueFacing) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Email ID, TL Name and Issue Facing are required' }));
      return;
    }

    const newIssue = {
      id: generateId(),
      email,
      tlName,
      chatLink: chatLink || null,
      issueFacing: issueFacing || null,
      status: 'open',
      pickedBy: null,
      pickedAt: null,
      createdAt: new Date().toISOString(),
      fixedAt: null
    };

    await issuesCollection.insertOne(newIssue);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(newIssue));
    return;
  }

  // GET /api/issues
  if (pathname === '/api/issues' && req.method === 'GET') {
    const parsed = url.parse(req.url, true);
    const { status, date, email } = parsed.query;

    let filter = {};
    if (status) filter.status = status;
    if (date) filter.createdAt = { $regex: '^' + date };
    if (email) filter.email = { $regex: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };

    const issues = await issuesCollection.find(filter).sort({ createdAt: -1 }).toArray();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(issues));
    return;
  }

  // PATCH /api/issues/:id  (Mark Fixed or Pick Issue)
  if (pathname.startsWith('/api/issues/') && req.method === 'PATCH') {
    const id = pathname.split('/')[3];
    const body = await parseBody(req);

    const update = {};

    if (body.status === 'fixed') {
      update.status = 'fixed';
      update.fixedAt = new Date().toISOString();
    }

    if (body.pickedBy) {
      update.pickedBy = body.pickedBy.trim();
      update.pickedAt = new Date().toISOString();
    }

    if (Object.keys(update).length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Nothing to update' }));
      return;
    }

    try {
      const result = await issuesCollection.findOneAndUpdate(
        { id: id },
        { $set: update },
        { returnDocument: 'after' }
      );

      // Handle different MongoDB driver return formats
      const updatedDoc = result?.value || result;

      if (!updatedDoc) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Issue not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(updatedDoc));
      return;
    } catch (err) {
      console.error('Update error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Update failed' }));
      return;
    }
  }

  // GET /api/stats/advisor
  if (pathname === '/api/stats/advisor' && req.method === 'GET') {
    const parsed = url.parse(req.url, true);
    const email = (parsed.query.email || '').trim();
    if (!email) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'email required' }));
      return;
    }

    const today = getToday();
    const issues = await issuesCollection.find({
      email: { $regex: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
      createdAt: { $regex: '^' + today }
    }).toArray();

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

  // GET /api/export
  if (pathname === '/api/export' && req.method === 'GET') {
    const parsed = url.parse(req.url, true);
    const date = parsed.query.date || getToday();

    const issues = await issuesCollection.find({
      createdAt: { $regex: '^' + date }
    }).sort({ createdAt: -1 }).toArray();

    const header = ['ID', 'Email ID', 'TL Name', 'Chat Link', 'Issue Facing', 'Status', 'Picked By', 'Picked At', 'Created At', 'Fixed At'];
    const rows = issues.map(i => [
      i.id,
      `"${(i.email || '').replace(/"/g, '""')}"`,
      `"${(i.tlName || '').replace(/"/g, '""')}"`,
      `"${(i.chatLink || '').replace(/"/g, '""')}"`,
      `"${(i.issueFacing || '').replace(/"/g, '""')}"`,
      i.status,
      `"${(i.pickedBy || '').replace(/"/g, '""')}"`,
      i.pickedAt || '',
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

  // GET /api/stats/summary
  if (pathname === '/api/stats/summary' && req.method === 'GET') {
    const today = getToday();
    const allIssues = await issuesCollection.find({}).toArray();

    const openToday = allIssues.filter(i => i.status === 'open' && i.createdAt.startsWith(today)).length;
    const totalOpen = allIssues.filter(i => i.status === 'open').length;
    const totalToday = allIssues.filter(i => i.createdAt.startsWith(today)).length;

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

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`V5 Issue Tracker by Shareque running on port ${PORT}`);
  });
});
