# V5 Issue Tracker by Shareque

Zomato-inspired issue highlighter for Advisors & Supervisors.

## Features

### Advisor page (`/advisor`)
- Submit issue with **Email ID**, **TL Name**, and optional **Chat Link**
- View personal daily entry count (total / open / fixed)

### Supervisor page (`/supervisor`)
- Live list of issues with status (Open / Fixed)
- Notification banner for new/open issues
- Auto-refresh every 15 seconds
- Mark issues as Fixed
- **Export day-wise data to Excel** (CSV with BOM – opens cleanly in Excel)
- Filters by status and date

## Design
- Zomato red (#E23744) primary colour
- Clean modern cards, sticky header, responsive

## Tech
- Pure Node.js (no external dependencies)
- JSON file storage (`data/issues.json`)
- HTTP server with static + REST API

## How to run

```bash
cd v5-issue-tracker
node server.js
# or
npm start
```

Server starts on **http://localhost:3100** (or set `V5_PORT` env var).

- Home:     http://localhost:3100/
- Advisor:  http://localhost:3100/advisor
- Supervisor: http://localhost:3100/supervisor

## Hosting
Deploy on any Node-capable host (Railway, Render, VPS, Heroku, etc.).

Set environment variable if needed:
```
V5_PORT=8080
```

Data persists in `data/issues.json`. For production you may want to mount a volume or switch to a real database later.

## API (for reference)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | /api/issues | Create issue `{email, tlName, chatLink?}` |
| GET    | /api/issues?status=&date=&email= | List / filter |
| PATCH  | /api/issues/:id | Mark fixed `{status:"fixed"}` |
| GET    | /api/stats/advisor?email= | Daily stats for advisor |
| GET    | /api/stats/summary | Open counts for notifications |
| GET    | /api/export?date=YYYY-MM-DD | CSV download |

---

Made with ❤️ for Shareque · V5 Issue Tracker
