# OfficeAuto + Pip 🤖

Free automation for office workers on Windows, plus **Pip**, a friendly AI desktop buddy (Google Gemini) that lives above your taskbar.

- **OfficeAuto**: one PowerShell script that sorts Downloads, backs up your files, converts Office files to PDF, finds duplicates, keeps a daily to-do note, and more.
- **Pip**: click the character to chat, drop a file on it to summarize it, talk to it with your voice, have it write your end-of-day report, and run the automations with one click.

Works in English and Burmese (မြန်မာ).

---

## Install (5 minutes)

**Requirements:** Windows 10/11, [Node.js 18+](https://nodejs.org) (needed only for Pip), and Microsoft Office (needed only for "convert to PDF").

1. Click **Code → Download ZIP** and unzip it anywhere, for example `C:\OfficeAuto`.
   (or `git clone https://github.com/minhtawlwe-svg/officeauto-pip.git`)
2. Get a **free Gemini API key**: https://aistudio.google.com/apikey
3. Double-click **`Start-Buddy.cmd`**. The first run downloads Electron (~100 MB), then Pip appears bottom-right.
4. Pip opens **Settings**. Paste your key, click **Test keys**, then **Save**. Done.

Pip starts automatically with Windows from now on. To turn that off, untick *Start Pip when Windows starts* in Settings or in the tray menu.

---

## Pip, the AI buddy

| Do this | What happens |
|---|---|
| Click Pip | Opens the chat (emails, Excel formulas, translation, planning, "explain this error") |
| Drag Pip | Moves it anywhere |
| Drop a PDF, DOCX, TXT, CSV or image on Pip, or use 📎 | Summary, key points, action items |
| **📊 Excel chart**, or say "read my Excel data and show a chart" | Reads the workbook **open in Excel** (or a file you pick: .xlsx / .xls / .csv), explains it, and draws charts in the chat. Gemini only chooses the chart; **Pip calculates every number from all rows**, so totals are exact. Buttons: Copy image (white background for Word/email), Save PNG, Numbers, Copy numbers |
| **✨ Daily report** | Turns today's note into a report email for your manager (Copy / Email draft) |
| 🎤 or **Ctrl+Alt+V** | Talk to Pip; press again to send. Pip reads its answer aloud |
| **Ctrl+Alt+Space** | Show / hide Pip |
| Say "open YouTube" / "search YouTube for lofi music" / "open Excel" | Opens the website or program right away (Excel, Word, PowerPoint, Outlook, Notepad, Calculator, Explorer, Edge, Chrome, Teams, Paint, Snip) |
| Say "organize my downloads" | Pip shows a **▶ Run** button. Nothing runs until you click it |
| Tray icon (right-click) | Settings / API keys, Start with Windows, Reset position, Quit |

Pip also changes expression, falls asleep when you're away, reminds you at lunch, and offers to write your daily report near home time.

### API keys: add them yourself
Pip uses **your own** Gemini key. Nothing is built in. There are three ways to add keys:

1. **Settings** (recommended): paste a key; you can paste several, one per line. Keys are stored **encrypted** (Windows DPAPI) in `%APPDATA%\officeauto-buddy\settings.json`.
2. **File**: copy `buddy\api-key.example.txt` to `buddy\api-key.txt` and put your keys inside, one per line. This file is plain text, so keep it private.
3. **Environment variable**: `GEMINI_API_KEY`.

With several keys (for example from several Google accounts), Pip switches to the next key automatically when one runs out of free quota. **Test keys** checks each one and shows ✔ or ✖.

### Connection
- **Relay** (default): requests go through a small US relay (`interview-relay.vercel.app`) that only forwards your request with your key, so it works where Gemini is blocked (for example Myanmar) without a VPN. You can host your own relay and change the URL in Settings.
- **Direct**: talks to Google directly. Use it if Gemini works in your country or you have a VPN. You can set an optional proxy such as `http://127.0.0.1:8118`.

---

## OfficeAuto (PowerShell toolkit)

Open the menu:
```powershell
powershell -ExecutionPolicy Bypass -File .\OfficeAuto.ps1
```

| # | Task | What it does |
|---|------|--------------|
| 1 | Organize | Sorts Downloads into Documents / Images / Spreadsheets / ... (skips files still downloading) |
| 2 | Backup | Zips Documents + Desktop to `%USERPROFILE%\OfficeAuto-Backups`, keeps the newest 7 |
| 3 | CleanTemp | Deletes temp files older than 7 days (files in use are skipped) |
| 4 | Rename | Bulk rename to `Prefix_date_001.ext`, with a preview and an undo list |
| 5 | ToPdf | Converts all Word/Excel/PowerPoint files in a folder to PDF (needs MS Office) |
| 6 | Morning | Opens your apps and websites, then today's note |
| 7 | DailyNote | `Documents\DailyNotes\YYYY-MM-DD.md`; unfinished to-dos carry over to the next day |
| 8 | Duplicates | Finds identical files and writes a CSV report. It never deletes anything |
| 9 / 10 | Schedule | Turns on/off: Organize at 18:00, Backup at 18:30, Morning at logon |
| A | Pip | Launches the AI buddy |

- Run one task: `.\OfficeAuto.ps1 -Task Backup`
- Preview without changing anything: add `-WhatIf` (Organize, Backup, CleanTemp)
- Folder tasks: `.\OfficeAuto.ps1 -Task ToPdf -Folder "C:\Reports"`
- Change folders, file types, morning apps/sites and times in **`config.json`**. Logs are written to `logs\`.

---

## Project layout
```
OfficeAuto.ps1        PowerShell toolkit (ASCII-only so Windows PowerShell 5.1 can read it)
config.json           settings for the toolkit
Start-Buddy.cmd       installs (first time) and starts Pip
buddy/
  main.js             window, tray, hotkeys, autostart, Gemini (relay/direct), file reading, task runner
  renderer.js         chat, voice, daily report, character moods
  index.html, style.css   the Pip character (SVG) and UI
  api-key.example.txt template for the optional key file
```

## Privacy
- Your keys stay on your PC (encrypted). Chats go only to Google Gemini (through the relay if you pick Relay mode).
- OfficeAuto runs locally and never uploads your files. Only a file you choose to summarize is sent to Gemini.
- AI can make mistakes. Check important emails and reports before sending them.

## License
MIT. Free to use, change and share.
