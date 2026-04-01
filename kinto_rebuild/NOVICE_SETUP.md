# Kinto Global — Complete Setup Guide
### Written for someone who has never deployed a web app before

**What this guide does:**
Takes you from a zip file on your computer to a live web app online,
accessible from anywhere, with login, that you can use with real clients.

**How long it takes:** About 2 hours the first time.

**What it costs:** R0/month (free tiers of three services).

---

## Before you start — what you need

You need four things installed on your computer. Each one has a simple installer.

### 1. Node.js
This runs the main app.

Go to: **nodejs.org**
Click the big green button that says "LTS". Download and run the installer.
Accept all defaults. Click Next through everything.

To confirm it worked, open Terminal (Mac) or Command Prompt (Windows) and type:
```
node --version
```
You should see something like `v20.11.0`. Any number above 18 is fine.

### 2. Python
This generates Word and PowerPoint report files.

Go to: **python.org/downloads**
Download the latest version (3.12 or higher).
**Important on Windows:** During installation, tick the box that says "Add Python to PATH" before clicking Install.

To confirm it worked, type:
```
python3 --version
```
or on Windows:
```
python --version
```
You should see something like `Python 3.12.0`.

### 3. Git
This lets you upload your code to GitHub so it can be deployed online.

Go to: **git-scm.com**
Download and install. Accept all defaults.

To confirm it worked, type:
```
git --version
```

### 4. A code editor (optional but helpful)
Go to: **code.visualstudio.com**
Download and install Visual Studio Code. You'll use this to edit one small file.

---

## Part A — Set up your online accounts

You need three free accounts. Set these up before touching the code.

### Account 1 — GitHub (stores your code)

Go to: **github.com**
Click Sign Up. Use any email and password.
Choose the free plan.
Confirm your email.

### Account 2 — Supabase (your database)

Go to: **supabase.com**
Click "Start your project" and sign in with your GitHub account (easier — no new password needed).
Once in, click **New project**.

Fill in:
- **Name:** `kinto-global`
- **Database password:** Make a strong password. Save it somewhere — you'll need it if you ever need direct database access.
- **Region:** Choose the one closest to you (South Africa → any EU region is fine)

Click "Create new project". It takes about 2 minutes to set up.

**While it's setting up, do not close the tab.**

When it's ready, go to: **Project Settings → API** (in the left sidebar, click the gear icon at the bottom, then API).

You'll see three values. Copy each one into a text file or notepad — you'll need them shortly:

```
Project URL:       https://abcdefghijklm.supabase.co   ← copy this
anon/public key:   eyJhbGciOiJ...                      ← copy this (long string)
service_role key:  eyJhbGciOiJ...                      ← copy this (different long string)
```

⚠️ **The service_role key is sensitive.** Never share it publicly or put it in any message.

### Account 3 — Vercel (hosts the web app)

Go to: **vercel.com**
Click "Sign Up" and sign in with your GitHub account.
You don't need to do anything else here yet.

---

## Part B — Set up the files on your computer

### Step 1 — Unzip the build

Find the file `kinto_v100_rc4.zip` you downloaded.
Unzip it. You'll get a folder called `kinto_rebuild`.
Rename that folder to `kinto-global`.

Put it somewhere sensible, like your Desktop or Documents folder.

### Step 2 — Open it in Terminal

**On Mac:**
Open the Terminal app (search for "Terminal" in Spotlight).
Type this and press Enter, then drag the `kinto-global` folder into the terminal window after the `cd ` — it fills in the path automatically:
```
cd 
```
Press Enter.

**On Windows:**
Open the `kinto-global` folder in File Explorer.
Click in the address bar at the top, type `cmd`, and press Enter.
This opens a Command Prompt already inside that folder.

### Step 3 — Install the JavaScript packages

In your terminal, type:
```
npm install
```
Press Enter. This downloads all the code the app needs. It takes 2–3 minutes.
You'll see a lot of text scrolling — that's normal. Wait for it to finish.

### Step 4 — Install the Python packages

In the same terminal, type:
```
pip install -r python_engine/requirements.txt
```
Press Enter. If that gives an error, try:
```
pip3 install -r python_engine/requirements.txt
```
This installs the tools that generate Word and PowerPoint files.

### Step 5 — Create your settings file

In your `kinto-global` folder, find the file called `.env.example`.

**On Mac:** This file may be hidden. Press `Cmd + Shift + .` in Finder to show hidden files.

Copy that file and rename the copy to `.env.local` (exactly — with the dot at the start).

Open `.env.local` in Visual Studio Code (or any text editor).

You'll see this at the top:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Replace the placeholder values with the three values you copied from Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklm.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJ...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...
```

Leave everything else as-is for now. Save the file.

---

## Part C — Set up the database

### Step 6 — Run the database migrations

Go to your Supabase project in your browser.
Click **SQL Editor** in the left sidebar (it looks like a database icon with a cursor).

You're going to paste and run five files, one at a time.

Open the `supabase/migrations` folder inside your `kinto-global` folder.
You'll see five files numbered 001 through 005.

**For each file, in order:**
1. Open the file in a text editor
2. Select all the text (Ctrl+A or Cmd+A)
3. Copy it (Ctrl+C or Cmd+C)
4. Go back to Supabase SQL Editor
5. Click the editor area and paste (Ctrl+V or Cmd+V)
6. Click the green **Run** button
7. You should see "Success. No rows returned" — that's correct
8. Clear the editor before pasting the next file

Do this for all five files:
- `001_platform_foundation.sql`
- `002_interoperability_foundation.sql`
- `003_report_delivery_layer.sql`
- `004_shared_persistence_snapshot_layer.sql`
- `005_auth_and_rls.sql`

If you see any error that is not "already exists", stop and note what it says.

### Step 7 — Load the module content

Go back to your terminal (still in the `kinto-global` folder).

Type:
```
npm run seed:reference
```
Press Enter.

Wait for it to finish. You should see a line ending with something like:
```
Seeded 847 reference records.
```

This loads all the questions, findings, and recommendations into the database.
You only do this once.

---

## Part D — Test it on your computer

### Step 8 — Start the app

In your terminal, type:
```
npm run dev:full
```
Press Enter.

You'll see two sets of output start appearing. Wait until you see:
```
✓ Ready in Xs
```

### Step 9 — Open it in your browser

Go to: **http://localhost:3000**

You should see a login page with the Kinto Global logo.
Click "Create account", enter your email and password, and sign in.

If it redirects you to the workspace — everything is working.

### Step 10 — Test the basics

1. Click "+ Client" in the top bar. Enter a test client name. Click Save.
2. Click "+ Assessment". Enter a name. Click Save.
3. Click "Operational Audit" in the sidebar. You should see questions with 1–5 score buttons.
4. Score a few questions. Check that the score updates immediately.
5. Go to the Advisory tab. You should see findings appear.

If all five steps worked, the app is running correctly.

---

## Part E — Get it online

### Step 11 — Put your code on GitHub

In your terminal, type these commands one at a time, pressing Enter after each:

```
git init
git add .
git commit -m "Kinto Global v1.0.0-rc.4"
```

Now go to **github.com**.
Click the **+** button in the top right → "New repository".
Name it `kinto-global`.
Select **Private** (so your code is not public).
Click "Create repository".

GitHub will show you a page with some commands. Find the section that says
"push an existing repository" and copy the two commands shown.
They will look like this (with your own username):

```
git remote add origin https://github.com/YOUR-USERNAME/kinto-global.git
git push -u origin main
```

Paste and run them in your terminal.

You may be asked to log in to GitHub. Follow the prompts.

### Step 12 — Deploy on Vercel

Go to **vercel.com** and sign in.
Click **Add New Project**.
Click **Import** next to your `kinto-global` repository.

Before clicking Deploy, you need to add your settings.
Click **Environment Variables** and add these one at a time:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_URL` | Leave blank for now — you'll fill this in after deploy |

To add each one: type the name in the Name field, paste the value in the Value field, click Add.

Click **Deploy**.

Wait 2–3 minutes. Vercel builds and deploys the app.

When it finishes, you'll see a URL like: `https://kinto-global-abc123.vercel.app`

Click Visit to open it. You should see the login page.

### Step 13 — Update the app URL

Go back to Vercel → Your project → Settings → Environment Variables.
Find `NEXT_PUBLIC_APP_URL` and set it to your actual Vercel URL:
```
https://kinto-global-abc123.vercel.app
```

Then go to Settings → General and scroll to find "Project Name."
Change it to `kinto-global` to get a cleaner URL.

Click Save. Vercel will redeploy automatically.

Your final URL will be: `https://kinto-global.vercel.app`

### Step 14 — Set up email login (so confirmation emails work)

Go to your **Supabase project → Authentication → URL Configuration**.

Set:
- **Site URL:** `https://kinto-global.vercel.app`
- **Redirect URLs:** Click Add, paste `https://kinto-global.vercel.app/auth/callback`

Click Save.

Now when someone creates an account, the confirmation email will link back to your live site.

### Step 15 — Deploy the Python report engine

The Python engine generates Word and PowerPoint files. You need this for reports.

Go to **railway.app** and sign in with your GitHub account.

Click **New Project → Deploy from GitHub repo**.
Select your `kinto-global` repository.

Once it appears, click on the service it created.
Go to **Settings**.

Find **Root Directory** and set it to: `python_engine`

Find **Start Command** and set it to:
```
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Click Save. Railway will deploy it (takes 2–3 minutes).

When it's done, go to **Settings → Networking** and click **Generate Domain**.
You'll get a URL like: `https://kinto-python-engine.up.railway.app`
Copy it.

Now go back to **Vercel → Your project → Settings → Environment Variables**.
Add:

| Name | Value |
|------|-------|
| `PYTHON_API_BASE_URL` | `https://kinto-python-engine.up.railway.app` |

Click Save. Vercel redeploys automatically.

---

## Part F — Create your account on the live site

### Step 16 — Sign up on the live URL

Go to your live URL: `https://kinto-global.vercel.app`

Click **Create account**.
Enter your email address and choose a password (8+ characters).
Click **Create account**.

Check your email — you'll get a confirmation link from Supabase.
Click the link. It takes you back to the app and logs you in.

You are now logged into your live platform.

### Step 17 — You're done

Your platform is live. Test it the same way you did locally:
- Create a client
- Create an assessment
- Open a module and score some questions
- Check the Advisory tab
- Try generating a report

---

## If something goes wrong

**"Module not found" or "Cannot find package" when running npm install**
Run `npm install` again. Sometimes it fails on slow internet.

**"Python is not recognized" on Windows**
Re-install Python and make sure you tick "Add Python to PATH" during installation.
Then close and reopen your terminal.

**The Supabase SQL editor shows an error**
Read the error message. If it says "already exists" that's fine — skip it.
If it says something else, copy the error and search it. Most SQL errors are about running migrations in the wrong order.

**Vercel shows a build error**
Go to Vercel → Your project → Deployments → click the failed deployment → View Build Logs.
The last red line tells you what failed. The most common cause is a missing environment variable.

**The app loads but shows "No client selected" and nothing works**
The reference data probably wasn't seeded. Run `npm run seed:reference` again from your terminal
with the correct `.env.local` values in place.

**Reports fail to generate**
The Python engine on Railway might not be running. Go to Railway, check the service logs.
If it shows an error, click Redeploy.

**I forgot my password**
Go to the login page and click "Forgot password?" — it sends a reset link to your email.

---

## What you have when you're done

- A live web app at `kinto-global.vercel.app` (or your custom domain)
- Login and account creation working
- Each person who signs up sees only their own clients and assessments
- All five diagnostic modules working
- Advisory outputs, roadmap, and reports working
- Reports generating as Word and PowerPoint files
- The AI assistant working (if you add an API key)
- Total monthly cost: R0

