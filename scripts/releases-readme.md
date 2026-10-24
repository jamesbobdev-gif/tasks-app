# Romulus

**Romulus killed Remus. This should kill your need for Meta Muse.** Think of it as an open-source Meta Muse.

**A to-do list with an agent in it.** Write a task the way you'd tell a person ("find me the cheapest flight to Denver the weekend of the 14th", "order the groceries", "apply to these three internships", "draft a reply to the landlord"), hand it to the Agent, and it goes and does it: searches the web, reads pages, fills forms, compares prices, builds the cart, drafts the email. It comes back to you only when it needs a decision, and it **never buys, sends, submits or books anything until you reply "yes"** to the exact thing it described.

**Bring your own model.** The Agent is not tied to one AI company. Plug in whatever you already pay for or can run: your Claude or ChatGPT plan, an OpenRouter account (hundreds of models, some free), a Gemini key, the free tiers from Grok, Groq, Cloudflare or NVIDIA, or **your own model on your own hardware** through Ollama, on this computer or a box in the closet. Connect several and the app tries them in your order, falling to the next when one is busy or out of credit. Tasks that touch private things (bank, medical, passwords…) only ever go to your local model, never a cloud one.

**Your money, without the subscription.** The Finance tab does what people pay Rocket Money, Monarch or Copilot for: every account in one place, recurring bills and subscriptions found automatically, net worth over time, statements, receipts from your inbox, live stock prices. Read-only, about $15 a year for the bank connection, and the data lives in an encrypted vault on your computer rather than on someone's server.

**And a School list, a phone app, and more.** Read on.

This repository holds the **installers**. Download the latest from the [Releases](../../releases/latest) page.

---

## What it does

### The lists
- **Human**: your own to-dos. Due dates, times, tags, subtasks, repeats, drag to reorder, search.
- **Agent**: tasks the AI does for you. Each one shows what it's working on live, its questions, its results, and the conversation so far. Reply in the task to steer it.
- **School**: assignments, with due dates pulled in automatically from Blackboard or D2L calendar links; the class is the tag.
- **Work**: a second list that can sync with a separate project.
- **Calendar**, **Ideas** (a board of sortable note cards), **Hours** (log time per day for school or work): extra views of the same data.

### The Agent
What it can do today, with the right AI connected:
- **Research and answers**: web search, read pages, compare options, summarize, write and rewrite.
- **Shopping**: Amazon, Walmart groceries (including a fortnightly groceries task it opens on its own), price comparison. It builds the order and asks before placing it.
- **Flights, tickets, bookings**: searches, picks seats on a seat map you can override, books after your yes.
- **Forms and applications**: job portals, questionnaires, sign-ups, filled from a **Locked** profile (resume, address, IDs) that only your local model is allowed to read.
- **Email** (Claude only): reads your Gmail for context and drafts replies; nothing is sent without a yes.
- **Morning look-ahead**: each morning it reads the next two weeks of your calendar and last week's email and suggests what needs doing. It only suggests.
- **Memory**: it keeps notes of what you've told it and what worked on which site, and tidies them weekly.
- **Its own browser**: a headless Chrome you can watch and take over in a live view.

Rules you set decide which AI gets which task: a word list, first-match rules, or "auto". Private words always route to the local model.

### Finance (optional, desktop only)
The parts of Rocket Money, Monarch, Copilot or Mint that most people actually use, on your own computer:

- **Every account in one place**, read **read-only** through [SimpleFIN Bridge](https://bridge.simplefin.org) (about $15 a year, which pays the bank-connection cost; compare $100+ a year for the apps above).
- **Recurring bills and subscriptions found automatically**: anything charged in two or more months for about the same amount (rent, insurance, phone, streaming), shown as fixed costs against everything else, and dropped from the list when it stops coming, so a cancelled subscription shows as cancelled. Correct a payee with one tap if it guessed wrong.
- **Net worth over time**: assets against debts, charted back through your transaction history.
- **Statements like a company's**: an income statement by month and a balance sheet against 30 and 90 days ago.
- **Receipts from your Gmail** matched to purchases, and **live prices** for the stocks you hold.
- **Ask your local model** a money question ("what did I spend on food last month?") and it answers from this data, in a run with no web access.

What it doesn't do: budgets with envelopes, bill negotiation, or cancelling subscriptions for you. Those are the paid apps' upsells; the information to do them yourself is all here.

Everything is kept in one file encrypted twice: AES-256 under a passphrase that is never saved, then again with your operating system's own encryption. It locks after 30 minutes, when the screen locks and when the computer sleeps. Windows Hello can unlock it. The cloud AIs can never read it; your local model can answer a money question from it, in a run with no web access, while it's unlocked.

### Phone (Android)
The same lists on your phone, kept in sync, with home-screen widgets, a quick-add widget, and an optional **wake word** so you can speak a task to it. The Agent runs on your computer; the phone is where you reply from the couch.

### Where things run
- Everything runs on your computer by default.
- Optionally, a second machine (a mini PC or old laptop on your network) can run the Agent, its browser and the local model, with your laptop just showing results. That's the **bring your own compute** part: a $300 box with 32 GB of RAM runs a 30B-parameter model well enough to fill forms and write for you, for free, forever.

---

## Install

**Windows**
1. Download `Romulus-Setup-<version>.exe` from the [latest release](../../releases/latest).
2. Run it. Windows shows an "unrecognized app" warning because the installer isn't code-signed yet: click **More info → Run anyway**.
3. Tasks opens. From then on it starts when you log in and lives in the tray by the clock. Closing the window hides it there; right-click the tray icon to quit.
4. Optional: Start menu → right-click **Tasks** → Pin to taskbar.

**Mac and Linux**: no installer yet. Build from source (a few minutes): clone the code, `npm install`, `npm run dist`.

**Updates** arrive by themselves. Installed copies check here every few hours and install the next version when your computer has been idle. The tray menu has **Restart to update** if you don't want to wait.

---

## Setup

The first time it opens, a welcome card asks what you want: **just tasks**, **an AI assistant**, or **sync with my phone**. Pick one and it takes you to the right place. Everything below is also reachable from **⚙ Settings** (the gear, top right) at any time.

### 1. Just tasks
Nothing to do. Add a task above the list. Due date and time are optional; a tag groups tasks and becomes a filter chip. Drag to reorder. Click a task to expand it for subtasks, notes and repeats.

### 2. Connect an AI
Open **⚙ Settings → Agent & AI → AI connections**, or press **Connect an AI** on the Agent tab. Each AI is a card with a switch. Switch one on and follow the button on the card. When several are on, the app tries them top to bottom; the ↑ arrows change the order.

**Claude** (best if you have a Claude Pro or Max plan; the only one that can read your Gmail and your photos)
1. **Install Claude Code**: one button, runs Anthropic's installer, a minute or two.
2. **Sign in to Claude**: a terminal window opens and your browser asks you to sign in to claude.ai. Come back when it's done; the card updates by itself.
3. **Check**: Claude answers one word to prove it works.
   No plan? Press **Get an API key**, paste the key from console.anthropic.com, and runs are billed to it pay-as-you-go.

**OpenRouter** (the easiest start: one account, hundreds of models, a free tier)
Press **Connect with OpenRouter**. Your browser opens; sign in or make a free account and approve. OpenRouter hands the app a key, nothing to paste. Turn on **Try free models first** to spend nothing until the free ones are busy.

**ChatGPT**
Either **your ChatGPT plan** (press Install Codex, then Sign in with ChatGPT) or an **OpenAI API key** (paste from platform.openai.com/api-keys).

**Gemini**
Press **Open Google AI Studio**, click Create API key, paste it, Save key. Use a key with billing on if you don't want Google using your tasks to improve its models.

**Grok, Groq, Cloudflare, NVIDIA** (free tiers)
**Get a free key** takes you to the right page; paste; **Test key** confirms it. They answer questions and write; they don't browse unless you switch the browser on for that card.

**Your own model** (private, free, offline)
1. Install [Ollama](https://ollama.com/download) on this computer or any machine on your network.
2. Pull a model: `ollama pull qwen3:8b` to start (fits in 8 GB of RAM); `qwen3:30b-a3b` or similar if you have 32 GB and want it to handle forms and long documents.
3. In **⚙ Settings → Local model**, leave the address as `http://localhost:11434` (or type the other machine's address), press **Find models**, pick one, press **Use it**.
   If Ollama is already running on this computer, the panel notices and says so.

Then under **Who does Agent tasks**, decide which AI gets what: the default is "auto" (web and shopping to the cloud, writing and forms to the local model, private words always local). Add rules like "apply, form → local" if you like.

**Tell it about you.** **⚙ Settings → About you**: preferences it reads before every task (how to sign emails, what time of day suits you); the **Locked** profile (resume, address, phone, IDs for forms; cloud AIs never see it); and **Files for forms** (your resume as a PDF).

### 3. Sync with your phone
Your lists are shared through a free [Supabase](https://supabase.com) project of your own, so the data is in your account, not ours. About ten minutes, once.

**Make the project**
1. Sign up at supabase.com, press **New project**. Any name and region. Keep the database password it asks for.
2. When it's ready, open **SQL Editor → New query**, paste the whole of [`supabase/setup.sql`](https://github.com/jamesbobdev-gif/tasks-app/blob/main/supabase/setup.sql) from the source repository, press **Run**. It makes the one table the app uses and the functions that guard it. Safe to run again.
3. Open **Project Settings → API**. Copy the **Project URL** (`https://xxxx.supabase.co`) and the **anon / publishable** key. Never the secret or service_role key.

**Connect the computer**: **⚙ Settings → Device sync**. Paste the URL and the anon key, press **Generate key** for a sync key, press **Save & sync**. The sync key is the password to your list; anyone with it can read and change it.

**Connect the phone**: install the Android app, open the same Settings panel, enter the same three values. The sync key is long, so send it to yourself through something you trust (a password-manager note), not a group chat.

That's every list: Work, Agent and School sync through the same project under keys made from your sync key, so the three values are all a second device needs. (Settings → Per-list keys lets you give one list a different key, for example a Work list shared with a colleague.)

### 4. Calendars
**⚙ Settings → Calendars.** Press **+ Google** or **+ Microsoft** and sign in; the official installer has sign-in built in. Or **+ Calendar link** for any subscribe link (iCloud, a shared calendar). For **course calendars** (Blackboard: Calendar → ⚙ → Share Calendar; D2L: Calendar → Subscribe), paste the link under Course calendars and due dates land on School. Per calendar, choose whether events become to-dos and whether your tasks appear on it.

### 5. Finance
Open the **Finance** tab; the first visit is the setup. Make an account at bridge.simplefin.org (about $15 a year) and connect your banks there, choose **New connection** and copy the setup token, paste it into the tab, and choose a passphrase. From then on the tab asks for the passphrase (or Windows Hello, once you turn it on) and locks itself after 30 minutes. Receipts from Gmail and stock prices are set up from the same tab.

---

## Where your keys live

Everything you connect stays on the computer where you connected it, in the app's config file (`%APPDATA%\Tasks\config.json` on Windows). API keys, sign-in tokens, sync keys and private calendar links are stored encrypted with your operating system's own encryption, so the file is useless copied elsewhere. Settings only ever shows a key's first and last characters. Keys are never synced between devices and never leave the app except to the service they belong to.

## What's in a release

| File | What it is |
|---|---|
| `Romulus-Setup-<version>.exe` | The installer. The only file most people need. |
| `latest.yml` | What installed copies read to find out a new version exists. |
| `*.blockmap` | Lets an update download only the parts that changed. |

## If something doesn't work

- **Claude card says "not installed" after installing**: press **I already have it**, or restart Tasks so it sees the new PATH.
- **Sign in to Claude never finishes**: close its window, run `claude auth login` in any terminal, then restart Tasks.
- **Local model "not reachable"**: Ollama isn't running, or on another machine it isn't listening on the network (`OLLAMA_HOST=0.0.0.0`).
- **Phone and computer show different lists**: the sync key differs by a character.
- **Anything else**: the app keeps a short diary at `%APPDATA%\Tasks\agent-runner.log` that usually names the cause. Open an issue here with the relevant lines (strip anything personal).

## Source code

The code lives at [jamesbobdev-gif/tasks-app](https://github.com/jamesbobdev-gif/tasks-app), which is being prepared for an open-source release. Until it is public, report problems in this repository's Issues.
