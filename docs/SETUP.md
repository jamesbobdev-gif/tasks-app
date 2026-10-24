# Setting up Tasks

Tasks works the moment you install it: a to-do list on your computer, nothing to sign up for. Everything else is optional and switched on from **⚙ Settings**. This guide walks through each piece, in the order most people want them.

1. [Install](#1-install)
2. [Connect an AI](#2-connect-an-ai) (for the Agent tab)
3. [Sync with your phone](#3-sync-with-your-phone)
4. [Calendars](#4-calendars)
5. [Where your keys live](#5-where-your-keys-live)
6. [If something doesn't work](#6-if-something-doesnt-work)

## 1. Install

**Windows:** download `Romulus-Setup-<version>.exe` from the [releases page](https://github.com/jamesbobdev-gif/tasks-releases/releases) and run it. The installer is not code-signed yet, so Windows shows an "unrecognized app" warning: click **More info → Run anyway**. Tasks starts when you log in and lives in the tray near the clock; closing the window hides it there. To pin it: Start menu → right-click **Tasks** → Pin to taskbar.

**Mac / Linux:** build it yourself for now (`npm install && npm run dist`; see the [README](../README.md)).

**From source:** `npm install` then `npm start` (Node 18 or newer).

Updates on Windows arrive on their own: the app checks every few hours and installs the next version when your computer has been idle.

## 2. Connect an AI

The **Agent** tab hands tasks to an AI that can search the web, read your inbox, fill forms and shop for you. It needs at least one AI connected. The Agent tab says so until you do, with a **Connect an AI** button; or open **⚙ Settings → Agent & AI → AI connections**. Each AI is a card; switch it on, follow the button on the card, and it's connected. When several are on, the app tries them top to bottom.

Pick whichever of these you already have.

### Claude (recommended if you have a Claude Pro or Max plan)

Claude runs through **Claude Code**, a small program from Anthropic that signs in with your Claude account.

1. On the Claude card press **Install Claude Code**. It runs Anthropic's installer; a minute or two.
2. Press **Sign in to Claude**. A terminal window opens and your browser asks you to sign in to claude.ai. Come back when it says you're signed in; the card updates on its own.
3. Press **Check**. Claude answers one word to prove it works.

No Claude plan? Paste an **Anthropic API key** instead (button on the card takes you to console.anthropic.com). Runs are then billed to that key, pay as you go.

Claude is the only AI that can read your Gmail and open your photos, so inbox tasks always go to Claude.

### OpenRouter (easiest; one account, hundreds of models, some free)

Press **Connect with OpenRouter**. Your browser opens openrouter.ai; sign in or make a free account and approve. OpenRouter hands the app a key, nothing to paste. Turn on **Try free models first** to spend nothing until the free ones are busy.

### ChatGPT

Two ways: **your ChatGPT plan** (press Install Codex, then Sign in with ChatGPT) or an **OpenAI API key** (paste it from platform.openai.com/api-keys).

### Gemini

Gemini needs a free API key: press **Open Google AI Studio**, click Create API key, paste it, Save key. Use a key with billing turned on if you don't want Google using your tasks to improve its models.

### Grok, Groq, Cloudflare, NVIDIA (free tiers)

Each card has a **Get a free key** button to the right page and a **Test key** button. They answer questions and write, but don't browse unless you switch the browser on for them.

### A local model (private; nothing leaves your machines)

Install [Ollama](https://ollama.com/download) on this computer (or any computer on your network), pull a model (`ollama pull qwen3:8b` is a reasonable start; bigger is smarter), then in **⚙ Settings → Local model**:

1. Leave the address as `http://localhost:11434`, or type the other computer's address.
2. Press **Find models**, pick one, press **Use it**.

If Ollama is already running on this computer the panel notices and says so. Tasks that contain private words (bank, medical, password…) only ever go to the local model; see **Who does Agent tasks** to tune the words and rules.

## 3. Sync with your phone

Your lists can be shared between your computer and your phone through a free [Supabase](https://supabase.com) project of your own. Your data lives in your project, under a sync key only your devices know. About ten minutes, once.

### Make the project

1. Sign up at supabase.com and press **New project**. Any name, any region; write down the database password it asks for (you won't need it again, but keep it).
2. When the project is ready, open **SQL Editor → New query**, paste the whole of [`supabase/setup.sql`](../supabase/setup.sql), press **Run**. It makes the one table the app uses and the functions that guard it. Run it again any time; it only adds what's missing.
3. Open **Project Settings → API**. Copy the **Project URL** (`https://xxxx.supabase.co`) and the **anon / publishable** key. (Never use the secret or service_role key in the app.)

### Connect the computer

In **⚙ Settings → Device sync**:

1. Paste the Project URL and the anon key.
2. Press **Generate key** to make a sync key. This is the password to your list: anyone with it can read and change the list, so treat it like one.
3. Press **Save & sync**.

That's every list: Work, Agent and School sync through the same project under keys made from your sync key, so the three values are all a second device needs. (Settings → Per-list keys lets you give one list a different key, for example a Work list shared with a colleague.)

### Connect the phone

Open the same Settings panel on the phone and enter the same three values. Keep them handy: the sync key is a long random string, so send it to yourself through something you trust (a password manager note, not a group chat).

The Android app is built from the `mobile/` folder; see the README for the build steps.

## 4. Calendars

**⚙ Settings → Calendars** connects Google or Microsoft calendars (events become to-dos, tasks can go onto the calendar) or any calendar link (Blackboard, D2L, iCloud…).

- Press **+ Google** or **+ Microsoft** and sign in. The official installer has its own sign-in built in.
- If your copy says it has no Google sign-in of its own (a build from source), make a free Google Cloud OAuth credential of type **Desktop app** and paste its Client ID and Secret where the panel asks. Developers: see `oauth-clients.example.json` for shipping your own.
- For a link, press **+ Calendar link** and paste the subscribe link (`.ics` or `webcal://`). Read-only.

Then choose, per calendar, whether its events become to-dos and whether your tasks appear on it.

## 5. Where your keys live

Everything you connect stays on the computer where you connected it, in the app's config file (`%APPDATA%\Tasks\config.json` on Windows). API keys, sign-in tokens, sync keys and private calendar links are stored encrypted with your operating system's own encryption, so the file is useless if copied to another account or machine. The Settings page only ever shows a key's first and last characters.

Keys are never synced between devices and never leave the app except to the service they belong to. The one thing you do share by hand is the sync key, which is meant to be the same on every device.

## 6. If something doesn't work

- **The Claude card says "not installed" after installing.** Press **I already have it**: the app looks again. If `claude` works in a terminal but not here, restart Tasks so it sees the new PATH.
- **Sign in to Claude never finishes.** Close the terminal window it opened, run `claude auth login` yourself in any terminal, then press Sign in again (or just restart Tasks: it checks on start).
- **"not reachable" on the Local model panel.** Ollama isn't running or isn't allowed from this computer. On the machine running it, `ollama serve` should be up; for another computer, Ollama must listen on the network (`OLLAMA_HOST=0.0.0.0`).
- **Device sync says "fill in the three personal fields".** All three are needed: URL, anon key, sync key.
- **The phone and computer show different lists.** Check the sync key matches exactly on both; one character off is a different (empty) list.
- **Something else.** The app keeps a short diary at `%APPDATA%\Tasks\agent-runner.log`; it usually names the problem. Open an issue with the relevant lines (strip anything personal).
