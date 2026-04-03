# SpendMind 💸

> A personal expense tracker built by an APM tired of Excel sheets.

**[Live Demo](https://rad-kleicha-98bb94.netlify.app)**


## Why I built this

I kept losing track of where my money went every month. Bank statements are overwhelming, spreadsheets are boring, and most finance apps want access to your bank account. I wanted something fast, beautiful, and private — so I built it.


## Features

- **📥 Bulk Import** — Upload your bank or UPI statements via Excel/CSV
- **📤 Export Report** — Download your monthly spending summary as a shareable image
- **🧠 Money Intelligence** — Auto-generated insights including:
  - Week-over-week spending comparison
  - Spike detection (days you overspent)
  - Top spending category
  - Credit card ratio warning
  - Over-budget alerts
- **💰 Budget Tracking** — Set monthly limits per category with live progress bars
- **🔐 PIN Lock** — Each PIN is its own account with isolated data
- **📊 5 Charts:**
  - Daily Timeline — every day of the month, spikes highlighted
  - Spending by Category — horizontal bar breakdown
  - Cash vs Credit Card — donut chart with % labels
  - Daily Trend (Last 30 days) — line chart
  - Weekly Spending — week-by-week bar chart


## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Charts | Chart.js v4 |
| Excel Import | SheetJS (xlsx) |
| Export | html2canvas |
| Data Storage | localStorage (per-PIN namespaced) |
| Hosting | Netlify |

No frameworks. No backend. No database. Everything runs in the browser.


## Screenshots

> PIN lock screen → Dashboard → Export


## Running locally

No build step needed. Just open the file:

```bash
git clone https://github.com/nandinimahadesh/SpendMind.git
cd SpendMind
open index.html
```


## What I learned

This was my first time building a complete product from scratch as an APM. Key takeaways:

- How localStorage works and its limitations (no cross-device sync)
- How Chart.js renders data and why re-renders matter
- Why CSS `backdrop-filter` breaks in html2canvas (and how to work around it)
- The difference between frontend state and persistent storage
- What a data model is and how changing it has downstream consequences


## What's next

- [ ] Supabase backend for cross-device sync
- [ ] User login (replace PIN with email auth)
- [ ] Custom categories per account
- [ ] PWA support (installable on phone)
- [ ] Recurring expense auto-logging

