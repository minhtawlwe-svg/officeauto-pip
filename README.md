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

### 🧰 Skills: everyday office work in one click
Click **🧰 Skills**, pick a skill, and type or paste. Results go straight into **Word, Excel, PowerPoint or an email draft**.

| ✍️ Write | 📊 Excel & data | 📄 Documents | 🗓️ Plan my day |
|---|---|---|---|
| Write email · Reply to email · Polish my text · Translate EN⇄MY · Reply to customer (Viber/FB) · Letter / memo / notice · Report draft · Meeting minutes (+ action-item table) | Excel formula helper · Text → Excel table · Analyze Excel + exact charts | Summarize file · Proofread document · Read screenshot text (OCR) · Make PowerPoint · Explain simply · Checklist / SOP | Plan my day (time-blocked) · Reminders (pop up + speak, survive restarts) · My reminders · 🍅 Focus 25 min |

**📋 Clipboard (Ctrl+Alt+C)** works with any app: copy text or a screenshot (Win+Shift+S), press Ctrl+Alt+C, and choose Fix / Make formal / Translate / Summarize / Reply / Explain / To Excel table. Polished and translated text is copied back automatically, so just press **Ctrl+V**.

Buttons that appear on answers automatically:
- **Email draft** on emails (they have a `Subject:` line)
- **Open in Word** on letters, reports and minutes
- **Open in Excel** / **Copy for Excel** on tables
- **Create PowerPoint** on slides

The PC tasks (Tidy Downloads, Backup, Folder to PDF, Find duplicates, Clean temp, Today's note, Morning start) are in the Skills sheet too.

| Do this | What happens |
|---|---|
| Click Pip | Opens the chat (emails, Excel formulas, translation, planning, "explain this error") |
| Drag Pip | Moves it anywhere |
| Drop a PDF, DOCX, TXT, CSV or image on Pip, or use 📎 | Summary, key points, action items |
| **📊 Excel chart**, or say "read my Excel data and show a chart" | Reads the workbook **open in Excel** (or a file you pick: .xlsx / .xls / .csv), explains it, and draws charts in the chat. Gemini only chooses the chart; **Pip calculates every number from all rows**, so totals are exact. Buttons: **Add to Excel** (new sheet with the numbers + a real, editable Excel chart, not saved until you press Ctrl+S), Copy image (white background for Word/email), Save PNG, Numbers. Say "show it in Excel too" and it is added automatically |
| **✨ Daily report** | Turns today's note into a report email for your manager (Copy / Email draft) |
| 🎤 or **Ctrl+Alt+V** | Talk to Pip; press again to send. Pip reads its answer aloud |
| **Ctrl+Alt+Space** | Show / hide Pip |
| Say "open YouTube" / "search YouTube for lofi music" / "open Excel" | Opens the website or program right away (Excel, Word, PowerPoint, Outlook, Notepad, Calculator, Explorer, Edge, Chrome, Teams, Paint, Snip) |
| Say "organize my downloads" | Pip shows a **▶ Run** button. Nothing runs until you click it |
| **Right-click the character**, **Ctrl+Alt+S**, or ⚙ in the chat | Opens Settings (you can come back and change anything at any time) |
| ⚙ Settings → Character | **Pip** (office buddy) · **Mocha & Milk** (bear couple) · **Mango** (orange cat) · **Kopi** (puppy) · **Capy** (chill capybara with a yuzu) · **Pebble** (penguin in a scarf). All are original designs with their own personality |
| Tray icon (right-click) | Settings / API keys, Start with Windows, Reset position, Quit |

Pip also changes expression, falls asleep when you're away, reminds you at lunch, and offers to write your daily report near home time.

### AI providers: use any AI, with your own keys
**Settings → AI providers → + Add** lets you add, edit, test, delete and switch between:

| Provider | Key | Notes |
|---|---|---|
| **Google Gemini** | free ([get key](https://aistudio.google.com/apikey)) | **Relay** mode works in Myanmar with no VPN; **Direct** mode connects to Google directly. Needed for 🎤 voice |
| **Claude (Anthropic)** | paid | Official Anthropic SDK; default model `claude-opus-5-5`. Great for long documents and writing |
| **OpenAI** | paid | Click **Load models** after adding the key |
| **OpenRouter** | some models free | One key for hundreds of models |
| **Groq** | free tier | Very fast |
| **DeepSeek** | low cost | |
| **Ollama** | none | Runs **offline on your PC** (install from ollama.com) |
| **Custom** | depends | Any OpenAI-compatible `/chat/completions` API |

- The radio button picks which provider answers first. With **"If one provider fails, try the next one"** turned on, Pip moves to your other providers automatically (for example when the Gemini free quota runs out), and the chat shows "↪ Answered by …".
- Each provider can hold **several keys** (one per line), and Pip rotates through them. **Test** checks each key before you save; **Load models** lists the models your key can use.
- Keys are stored **encrypted** with Windows DPAPI in `%APPDATA%\officeauto-buddy\settings.json`. Gemini keys can also come from `buddy\api-key.txt` or the `GEMINI_API_KEY` environment variable.
- **Proxy** (optional): if a service is blocked where you are, enter a proxy such as `http://127.0.0.1:8118`.
- 🎤 Voice always uses a Gemini provider, because the other providers can't take audio.

### Burmese documents
Slides, Word documents and Excel tables that contain Burmese automatically use the built-in **Myanmar Text** font, with taller line spacing so stacked characters aren't clipped. Ask in Burmese and the slides are written in Burmese.

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
