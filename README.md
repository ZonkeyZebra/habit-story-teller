# Habit Storyteller

A habit tracker where completing real-life tasks writes an AI-generated story. Hit your habits and the campaign ends well; slack off and it doesn't.

## How it works
- **Habits:** add tasks with a frequency (daily, certain weekdays, every N days) and an effort rating (1-5 points). Edit them any time; the score is recalculated across the whole campaign from your current habits.
- **Campaigns:** pick a main character, genre, notes and a length in days. Check off habits on **Today**, then press **Tell the next beat**; the completed tasks become in-story deeds.
- **Memory:** each beat sends the AI a rolling story summary plus the last three beats, so the plot stays consistent. The AI updates the summary each time.
- **Chaos:** every beat rolls a d20 plus a bonus from the chaos meter. High rolls trigger a twist and reset the meter; calm beats raise it, so twists get more likely the longer the story is steady. Adjust the 0-100 meter on **Today** to tune the next beat's twist chance.
- **Endings:** at the finale, performance of 75%+ gives a good ending, 45%+ mid, below that bad.
- **Summary:** score, highlights, collected items, and a read-the-whole-story view.

## Structure
```
index.html          page shell
css/styles.css      look and responsive layout (bottom nav on mobile, sidebar on desktop)
js/config.js        your public IDs (Google client ID, Worker URL)
js/app.js           startup, sign-in gate, events
js/ui.js            views
js/engine.js        schedules, scoring, chaos, endings
js/story.js         prompt building and AI reply parsing
js/store.js         state + sync     js/api.js  Worker calls     js/auth.js  Google sign-in
worker/index.js     Cloudflare Worker (auth check, data storage, Anthropic proxy)
worker/wrangler.toml Worker settings (no secrets)
```
The site (GitHub Pages) never sees the Anthropic key. Browser -> Worker -> Anthropic.

## Setup

### 1. Anthropic key
Create a key at console.anthropic.com (API keys). Set a monthly spend limit there. You'll paste it into Cloudflare in step 3; never into the repo.

### 2. Google sign-in
1. console.cloud.google.com: create a project, then **APIs & Services > OAuth consent screen** (External; add your friends as Test users while in testing mode).
2. **Credentials > Create credentials > OAuth client ID > Web application**.
3. Under **Authorized JavaScript origins** add `https://YOUR-GITHUB-USERNAME.github.io` and `http://localhost:8000` (for local testing). No redirect URI is needed.
4. Copy the Client ID into `js/config.js` and `worker/wrangler.toml`. A client ID is public, not a secret.

### 3. Cloudflare Worker
```bash
npm i -g wrangler && wrangler login
cd worker
wrangler kv namespace create DATA        # paste the returned id into wrangler.toml
# set ALLOWED_ORIGIN and GOOGLE_CLIENT_ID in wrangler.toml
wrangler secret put ANTHROPIC_API_KEY    # paste key when prompted
wrangler secret put ALLOWED_EMAILS       # e.g. you@gmail.com,friend@gmail.com
wrangler deploy
```
Copy the printed `https://habit-story.<you>.workers.dev` URL into `js/config.js` as `WORKER_URL`. `ALLOWED_EMAILS` is a secret so friends' emails don't land in a public repo. Leave it unset to allow any Google account (not recommended).

### 4. GitHub Pages
Push the repo, then **Settings > Pages > Deploy from branch > main / root**. Your site appears at `https://YOUR-GITHUB-USERNAME.github.io/REPO/`. The origin (without the path) is what goes in steps 2 and 3.

### Local testing
`python3 -m http.server 8000` in the repo root, then open http://localhost:8000. Temporarily set the Worker's `ALLOWED_ORIGIN` to `http://localhost:8000` (redeploy) or run `wrangler dev`.

## Security checklist
- The only secrets are `ANTHROPIC_API_KEY` and `ALLOWED_EMAILS`, stored as Worker secrets. `.gitignore` blocks `.dev.vars` and `.env`.
- The Worker rejects other origins, verifies the Google token and email allowlist, caps each user at `DAILY_LIMIT` stories per day, fixes the model and token limit server-side, and caps stored data size.
- If a key is ever committed, revoke it in the Anthropic console immediately; deleting the commit is not enough.

## Known prototype limits
- Google ID tokens last about an hour; after that you are asked to sign in again.
- Cloud sync is last-write-wins (one device at a time).
- Starting a new campaign replaces the old one (no history yet).
- Only the allowlist and daily cap limit usage; there is no billing per user.
