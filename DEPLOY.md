# Deploy V5 Issue Tracker – Super Simple Guide

You don’t need to know coding. Just follow these steps one by one.

---

## Method 1: Render.com (Recommended – Free)

### Step 1: Create a free GitHub account (if you don’t have one)
1. Go to https://github.com
2. Click **Sign up**
3. Create account with your email

### Step 2: Upload the project to GitHub
1. Go to https://github.com/new
2. Repository name: `v5-issue-tracker`
3. Keep it **Public**
4. Click **Create repository**
5. On the next page, click **uploading an existing file**
6. Drag and drop **all files** from the `v5-issue-tracker` folder  
   (or select all files and upload)
7. Scroll down → click **Commit changes**

### Step 3: Deploy on Render
1. Go to https://dashboard.render.com
2. Sign up with your **GitHub** account (easiest)
3. Click **New +** → **Web Service**
4. Find your `v5-issue-tracker` repo and click **Connect**
5. Fill these exact values:

| Setting          | What to write                  |
|------------------|--------------------------------|
| Name             | `v5-issue-tracker`             |
| Region           | Choose closest to you          |
| Runtime          | **Node**                       |
| Build Command    | leave empty or type `echo ok`  |
| Start Command    | `node server.js`               |
| Instance Type    | **Free**                       |

6. Click **Advanced** → **Add Disk**
   - Name: `data`
   - Mount Path: `/opt/render/project/src/data`
   - Size: 1 GB

7. Click **Create Web Service**

### Step 4: Wait 2–3 minutes
Render will build and start the app.  
You will get a link like:

**https://v5-issue-tracker-xxxx.onrender.com**

- Advisor page: `https://your-link.onrender.com/advisor`
- Supervisor page: `https://your-link.onrender.com/supervisor`

**Done!** Share these two links with your team.

---

## Method 2: Even easier – Railway.app

1. Go to https://railway.app
2. Login with GitHub
3. Click **New Project** → **Deploy from GitHub repo**
4. Select `v5-issue-tracker`
5. Railway will detect it automatically
6. Click on the service → **Settings** → **Networking** → **Generate Domain**
7. (Optional) Add a Volume and mount it to `/app/data`

You will get a live link immediately.

---

## Important Notes

- On the **free plan of Render**, the site sleeps after 15 minutes of no use. First open after sleep may take 30–50 seconds. This is normal.
- Data is saved. Once you added the disk, issues will not disappear.
- You can change the name later or add a custom domain if you want.

---

Need help? Just tell me at which step you are stuck and I will guide you further.
