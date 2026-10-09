# Tasks

A clean, minimal to-do app. Simple list with due dates, tags, subtasks, and drag-to-reorder.

## Run it (dev mode)

You need Node.js (v18 or newer). Then, in this folder:

```
npm install
npm start
```

## Install it properly (do this for auto-start + pinning)

```
npm run dist
```

The installer lands in `dist/` — `Tasks Setup.exe` on Windows, `Tasks.dmg` on Mac, an AppImage on Linux. Run it once and you have a real installed app with its own icon. The auto-start and tray behavior below apply to the **installed** app, not dev mode.

## Opens when your screen turns on

Two things handle this, both automatic after install:

1. **Starts when you log in.** Registered on first launch. Toggle it any time via the tray icon menu ("Start when I log in"), or in Task Manager → Startup on Windows.
2. **Reappears when your PC wakes or unlocks.** The app keeps running in the background — closing the window just hides it to the tray (near the clock). When the screen comes back on, the window pops back up.

To fully quit: right-click the tray icon → Quit Tasks.

## Pin it to the taskbar

Windows doesn't let apps pin themselves (deliberately), so it's a one-time manual step after installing: open the Start menu, find **Tasks**, right-click → **Pin to taskbar**. Or while it's running, right-click its taskbar icon → Pin to taskbar.

On a Mac: right-click the Dock icon → Options → **Keep in Dock**.

## Phone app (Android)

The `mobile/` folder wraps the same UI in Capacitor. To rebuild the APK after changing `renderer/index.html`:

```
cd mobile
node prepare-www.js        # copies renderer + bakes in sync-config.json
npx cap sync android
cd android && .\gradlew.bat assembleDebug
```

Requires `JAVA_HOME=C:\Users\James\android-dev\jdk21` and `ANDROID_HOME=C:\Users\James\android-dev\sdk`. The APK lands in `mobile/android/app/build/outputs/apk/debug/app-debug.apk` — copy it to the phone and tap to install (it updates in place, data survives).

Desktop and phone stay in sync through the Supabase project configured in `mobile/sync-config.json` (phone) and `%APPDATA%\Tasks\config.json` (desktop).

## Make it yours (custom theme)

Open ⚙ Settings → **Theme** and paste CSS. The whole look is driven by CSS variables, so a full re-skin is just overriding values, e.g. a dark theme:

```css
:root{
  --bg:#16161D; --surface:#1F1F28; --ink:#E6E6EA;
  --muted:#9C9CA8; --faint:#6E6E7A; --hairline:#33333E;
  --chip:#2A2A35; --accent:#8FA3FF;
}
```

Hit **Apply** to see it instantly; **Reset** returns to the default. Your theme persists across restarts (stored per device).

## Sharing the app

Give people `dist/Tasks Setup 1.0.0.exe` — it contains no personal data or credentials. They get their own empty task list, and can optionally connect their own Google Calendar and their own device sync in ⚙ Settings. (Windows may show an "unrecognized app" warning since the installer is unsigned — "More info → Run anyway".)

Do **not** share your built APK from `mobile/` — your private sync credentials are baked into it.

## Where your data lives

Tasks are saved to a `tasks.json` file in the app's user-data folder (e.g. `%APPDATA%/tasks` on Windows, `~/Library/Application Support/tasks` on Mac). They survive restarts and updates, and you can back up that one file.

## Ideas

The **Ideas** tab holds ideas as note cards, as long as you like, that you sort into groups.

- Tap **+ Add an idea** in a group and write. Enter starts a new line; click away (or Esc) to save, or Ctrl+Enter to save and start another. New ideas can start in **Unsorted**.
- Long ideas show their first few lines; click (tap) a card to read all of it and edit it. Clear the text or press **Delete** to remove it.
- **+ Group** makes a new group; click its name to rename it, the dot to change its colour, and × to remove it (its ideas go back to Unsorted).
- Drag a card into another group, or above/below another card to reorder; the others slide aside. On a phone, press and hold a card to pick it up.

Ideas sync across devices with the personal channel, in their own row (`<personal sync key>:ideas`), so they never show up as tasks or in Claude's task tools.

## Quick reference

- Enter — add a task (date, time, and tag are optional and stay sticky for batch entry)
- / — jump to the input
- Ctrl+F (Cmd+F on Mac) — search tasks
- ↑/↓ — select a task · Space completes it · Enter expands it · Delete removes it · Esc deselects
- Drag the dots on the left edge of a row to reorder
- Click a row to expand it: subtasks, change date, time, or tag
- Click a tag chip to filter by it
- Hover a row for edit / expand / delete — overdue and due-today tasks also get a snooze (clock) button that pushes them to today / tomorrow
- The tray icon's tooltip shows how many tasks are overdue or due today
