# SpendMind — Technical Overview for Product Managers

> **Who this is for:** PMs and APMs who want to understand how SpendMind works under the hood — not to write code, but to have intelligent conversations with engineers, write better tickets, and spot edge cases before they become bugs.

---

## Table of Contents
1. [The 30-Second Mental Model](#1-the-30-second-mental-model)
2. [The Three Files — What They Each Do](#2-the-three-files--what-they-each-do)
3. [How Data Flows (End-to-End)](#3-how-data-flows-end-to-end)
4. [The Data Model — What We Actually Store](#4-the-data-model--what-we-actually-store)
5. [Tech Stack, Explained Without Jargon](#5-tech-stack-explained-without-jargon)
6. [Key Concepts Every PM Should Know](#6-key-concepts-every-pm-should-know)
7. [Features & How They Work Technically](#7-features--how-they-work-technically)
8. [Known Limitations & Why They Exist](#8-known-limitations--why-they-exist)
9. [Vocabulary Cheat Sheet](#9-vocabulary-cheat-sheet)
10. [Questions to Ask Your Dev Team](#10-questions-to-ask-your-dev-team)

---

## 1. The 30-Second Mental Model

Think of SpendMind like a physical notebook that lives in your browser.

- **The notebook** = `localStorage` (browser storage)
- **The pages** = entries (expense and income records)
- **The index** = the transaction list you see on screen
- **The graphs** = Chart.js drawing pictures from your notebook data
- **The pen** = the form you fill out to add entries

When you add an expense, the data is written to the notebook. When you open the app, it reads from the notebook and draws everything on screen. When you close the browser, the notebook stays put. If you wipe the browser's storage, the notebook is gone — permanently.

There is no cloud. No server. No one else can see your notebook.

---

## 2. The Three Files — What They Each Do

SpendMind is made of exactly three files. Understanding what each one owns is the foundation of all technical conversations.

---

### `index.html` — The Blueprint

**What it is:** A text file that describes the structure of the page.

**Analogy:** Think of it as the **wireframe made real**. Every box, button, section, and label that you can see on screen exists in this file as a text tag.

**What's in it:**
- The top navigation bar (brand name, month arrows, Budgets button, Import button)
- The four summary cards (Total Spent, Credit Card, Highest Day, Highest Week)
- The Money Intelligence section
- The Log Expense form
- The Transactions list
- The five chart containers
- The Budget modal (the popup)
- The Import modal (the popup)

**PM takeaway:** When a designer hands you a mockup and you want to ask "is this easy to build?", HTML is why layout changes are usually fast. Moving a button or adding a new card is a small HTML change. Changing what data a button shows requires JS changes too.

**Example of what HTML looks like:**
```html
<button id="open-budget">Budgets</button>
```
This is just text saying "put a button here, call it open-budget." The button doesn't *do* anything yet — that's JavaScript's job.

---

### `style.css` — The Visual Design System

**What it is:** A text file of rules that tell the browser how everything should look.

**Analogy:** Think of it as the **design token file + component library**. Every color, font size, spacing, animation, and layout rule lives here.

**What's in it:**
- **Color palette** — every color in the app is defined once at the top as a variable (e.g. `--blue: #5B8DEF`). Change it once, it updates everywhere.
- **Layout rules** — how cards sit next to each other, how the grid snaps on mobile, how the nav sticks to the top
- **Glassmorphism effects** — the frosted-glass look on cards (achieved with `backdrop-filter: blur`)
- **Animations** — the orbs drifting in the background, the beam pulsing, cards glowing on hover
- **Responsive rules** — how the layout changes when the screen gets smaller (mobile view)

**PM takeaway:** CSS is why "make it look like this" can range from a 5-minute fix to a 3-day refactor. Tweaking a color = easy. Overhauling the layout grid = hard. If a designer asks for a drastic visual overhaul, the CSS file is what needs to be rewritten.

---

### `app.js` — The Brain

**What it is:** A text file of instructions that makes the app actually work.

**Analogy:** Think of it as the **backend logic + state management + event handlers**, all in one file.

**What's in it:**
- **Data operations:** load entries from storage, save new entries, delete entries
- **Rendering functions:** take data → build the transaction list on screen
- **Chart logic:** take data → calculate totals → draw charts
- **Insights logic:** take data → run calculations → output smart sentences
- **Event listeners:** "when user clicks Submit, do X. When user clicks Delete, do Y."
- **Month navigation:** track which month is selected, filter all data through that lens
- **Budget logic:** load budgets, save budgets, calculate over/under for each category
- **Import logic:** read an uploaded Excel file, validate it, preview it, add valid rows to entries

**PM takeaway:** When a feature involves new behaviour (not just looks), app.js is where the work happens. This is where bugs mostly live, and where new features require the most thought.

---

## 3. How Data Flows (End-to-End)

Here is exactly what happens when a user adds an expense, from click to screen:

```
User fills form → clicks "Add Expense"
        ↓
app.js reads the form values
(category, note, amount, date, payment method, type)
        ↓
Creates a new entry object:
{ id, type, category, description, amount, date, payment }
        ↓
Adds it to the entries array (in memory)
        ↓
Saves the updated array to localStorage
(this is the "write to notebook" step)
        ↓
Calls render()
        ↓
render() calls every display function:
  → updateSummary()       → recalculates the 4 cards
  → renderList()          → rebuilds the transaction list
  → updateInsights()      → recalculates money intelligence + budgets
  → updateTimelineChart() → redraws the daily timeline
  → updateCategoryChart() → redraws the category breakdown
  → updatePaymentChart()  → redraws the donut chart
  → updateDailyChart()    → redraws the 30-day trend
  → updateWeeklyChart()   → redraws the weekly chart
        ↓
User sees updated screen instantly
```

**PM insight:** Notice that every display function is called on every change. This is called a "re-render everything" approach. It's simple and works well for small data sets. If this app had 100,000 entries, it would start to feel slow — that's when engineers introduce optimisations like "only update what changed."

---

## 4. The Data Model — What We Actually Store

The data model is the structure of the information we save. This is one of the most important things a PM can understand — it determines what's possible.

### Entries (expenses + income)

Each entry looks like this:

```json
{
  "id": 1743075600000,
  "type": "expense",
  "category": "Food - Me",
  "description": "Swiggy lunch",
  "amount": 285,
  "date": "2026-03-27",
  "payment": "cash"
}
```

**Field by field:**

| Field | What it stores | Possible values |
|---|---|---|
| `id` | A unique identifier (timestamp of when entry was created) | Any number — used to find and delete a specific entry |
| `type` | Whether it's spending or earning | `"expense"` or `"income"` |
| `category` | Which spending bucket | One of 18 expense categories or 5 income categories |
| `description` | Optional note | Any text, max 60 characters |
| `amount` | How much, in rupees | Any positive number |
| `date` | When it happened | Date string in `YYYY-MM-DD` format |
| `payment` | How it was paid | `"cash"` (includes UPI) or `"credit"` |

**PM insight — what this means for features:**
- **"Add a subcategory"** — requires adding a new field to the model and updating every function that reads entries
- **"Track tax separately"** — new field needed
- **"Add a photo receipt"** — very complex; photos can't go in localStorage, would need file storage
- **"Split an expense with someone"** — would need new fields + a second person's account (backend needed)

### Budgets

Budgets are stored as a simple key-value object:

```json
{
  "Food - Me": 3000,
  "Coffee": 800,
  "Metro": 1500
}
```

This means: "I want to spend at most ₹3,000 on Food - Me this month."

**PM insight:** Budgets are currently not month-specific. If you set a budget, it applies to all months. A future enhancement would be to structure this as `{ "2026-03": { "Food - Me": 3000 } }` so you can have different budgets per month.

---

## 5. Tech Stack, Explained Without Jargon

| What | Technical name | Plain English explanation | Why we chose it |
|---|---|---|---|
| The language everything runs in | JavaScript | Instructions the browser understands | It's the only language browsers natively execute |
| The thing that structures the page | HTML | Like a Word document, but for web pages | Foundation of all web development |
| The thing that styles the page | CSS | Rules for fonts, colors, layout | Standard web styling |
| The charting library | Chart.js | Pre-built chart components we configure with data | Writing charts from scratch would take weeks |
| The Excel-reading library | SheetJS (xlsx) | Reads .xlsx and .csv files and converts them to data our app can use | Parsing Excel format manually is extremely complex |
| Where data is saved | localStorage | A small storage area inside your browser (5–10MB limit) | Zero setup, zero cost, completely private |
| Where the app is hosted | Your computer (local file) / Netlify | Either runs directly from your Downloads folder, or from a free Netlify server | No cost, instant to deploy |
| The fonts | Google Fonts (Inter) | The clean sans-serif font — loaded from Google's servers | Free, fast, professional |

### The "CDN" concept — important for PM

CDN stands for Content Delivery Network. When we write `<script src="https://cdn.jsdelivr.net/...">` in our HTML, we're saying "go download this library from the internet when the page loads."

**PM implication:**
- The app requires internet for the first load (to download Chart.js and SheetJS)
- After that, browsers usually cache these (remember them), so it works faster on repeat visits
- If those CDN URLs ever go down, charts and import break
- For a production app, we'd want to "bundle" these (include the libraries in our own files) — this is what a build step (Webpack, Vite) does

---

## 6. Key Concepts Every PM Should Know

### localStorage vs. a Database

| | localStorage | Database (e.g. Supabase, PostgreSQL) |
|---|---|---|
| Where data lives | Inside the user's browser | On a server in a data centre |
| Who can access it | Only that browser, on that device | Anyone with the right credentials, from any device |
| What happens if cleared | Data gone forever | Data safe |
| Cost | Free | Usually free up to a limit, then paid |
| Required for sync | No | Yes |
| Setup complexity | None | Moderate |

**SpendMind v1 uses localStorage.** That's why there's no sync, no login, and no server cost.

### State

"State" is the current condition of the app — all the data it's holding in memory right now. In SpendMind, the state includes:
- All the entries
- The currently selected month (`activeMonth`, `activeYear`)
- The budgets
- Which charts are currently drawn

When the state changes (e.g. you add an entry), the UI re-renders to reflect the new state.

**Why PMs care:** When a user reports "the chart didn't update," the question is "did the state update?" — meaning was the data actually saved, or did the rendering function fail to run?

### Event Listeners

An event listener is JavaScript saying "wait for something to happen, then do X."

Examples in SpendMind:
- "When the form is submitted, run the add-entry function"
- "When the ‹ button is clicked, go back one month"
- "When a file is dropped on the drop zone, read it"

**Why PMs care:** Every interactive element in your design requires at least one event listener in the code. A button that does 3 things on click = 3 things the developer needs to wire up. This affects complexity estimates.

### Responsive Design

SpendMind adjusts its layout based on screen width. The CSS has "breakpoints" — specific pixel widths where the layout changes.

For example: at 768px wide (roughly tablet width), the two-column form+list layout collapses into one column.

**Why PMs care:** "Works on mobile" is not free. Every layout decision needs to be tested at multiple screen sizes. Complex dashboards are the hardest to make mobile-friendly.

### Asynchronous Operations

Most things in SpendMind happen instantly (synchronously). But the Excel import is asynchronous — meaning:

1. User drops a file
2. JavaScript starts reading it (this takes a moment)
3. JavaScript says "let me know when you're done" and moves on
4. When reading is done, the preview appears

**Why PMs care:** Loading states, error states, and success states all need to be designed for async operations. "What does the user see while the file is being read?" is a PM question.

---

## 7. Features & How They Work Technically

### Month Navigator (‹ March 2026 ›)

**What it does:** Filters all data to show only the selected month.

**How it works:** Two variables `activeYear` and `activeMonth` store the current selection. Every function that reads entries first calls `getViewEntries()`, which filters the full entries array to only entries from that month. When you click ‹ or ›, these variables update and `render()` runs again.

**PM implication:** The raw data always stores all months. We never delete old data when navigating — we just filter. This means historical data is always accessible by navigating back.

---

### Money Intelligence (Insights)

**What it does:** Surfaces 5 auto-generated observations about your spending.

**How the logic works:**

| Insight | Calculation |
|---|---|
| Week vs. last week | Sum entries from current week, sum entries from last week, compare |
| Top category | Group all expense entries by category, find the highest total |
| Spike detection | Calculate average daily spend; if any day is 1.8× the average, flag it |
| CC ratio | (total CC spend ÷ total spend) × 100; warn if > 60% |
| Over-budget alert | For each category with a budget set, if total spend > budget, flag it |

**PM implication:** The "1.8×" multiplier for spike detection is a hardcoded threshold. If you want users to customise sensitivity, that becomes a settings feature. Also note: these insights are always calculating — they just hide themselves if there are no entries.

---

### Bulk Import (Excel/CSV)

**What it does:** Lets users upload a spreadsheet of past transactions instead of entering them one by one.

**How it works:**
1. User drops a file onto the drop zone (or clicks to browse)
2. SheetJS reads the file and converts it to a JavaScript array of rows
3. The app validates each row (does it have a valid date? a valid category? a positive amount?)
4. Valid rows are shown in a preview table; invalid rows show an error message
5. User clicks "Import" → valid rows are added to the entries array and saved

**PM implication:** The import feature is strict about column names (`Date`, `Category`, `Note`, `Amount`, `Paid Via`) — if a user's spreadsheet uses different column names, it will fail silently or import incorrectly. This is a UX improvement opportunity.

---

### Budget Feature

**What it does:** Lets users set a monthly spending limit per category and see how close they are.

**How it works:**
1. User opens Budget modal, enters a number next to each category
2. Numbers are saved to `localStorage` under a separate key (`spendmind_budgets`)
3. In `updateInsights()`, the app reads current month's actual spend per category and compares to the budget
4. Colour of the progress bar: blue (< 75%), gold (75–99%), red (≥ 100%)

**PM implication:** Budgets are global (not per-month). This is a known v1 limitation. A user who sets a ₹3,000 Food budget in March will see the same ₹3,000 budget in April. To fix this, we'd change the data model to store budgets per month.

---

### Interactive Beam (Visual Feature)

**What it does:** The light beam on the left side of the screen reacts to your mouse movement.

**How it works:** JavaScript listens for `mousemove` events. It tracks the mouse Y (vertical) position and smoothly animates the beam to follow it using a lerp (linear interpolation) function — this creates the "lazy drift" feel rather than instant snapping.

**PM implication:** This is a pure delight feature — no functional value, but significantly improves the "feel" of the product. In a real product team, this kind of work goes in the "polish" sprint. The lerp animation runs 60 times per second using `requestAnimationFrame` — the most performance-friendly way to animate in a browser.

---

## 8. Known Limitations & Why They Exist

| Limitation | Root cause | What's needed to fix it |
|---|---|---|
| No sync across devices | localStorage is per-browser | A backend database + user authentication |
| Data lost if browser cache cleared | localStorage is not persistent storage | Cloud sync (same fix as above) |
| No push notifications | Browser security prevents it without service workers | Convert to PWA + add notification permission request |
| No offline mode for first load | Chart.js and SheetJS are loaded from CDN | Bundle the libraries into the project files |
| Budgets not per-month | Simple data model — budgets stored as flat key-value | Restructure budget data model to include month keys |
| Import column names are rigid | Column matching is exact-string | Add fuzzy column matching or a mapping step in the import UI |
| No data export | Not built yet | ~1 day of dev work — serialize entries array to CSV, trigger download |

---

## 9. Vocabulary Cheat Sheet

Use this to stop nodding along in meetings and actually know what's being said.

| Term | What it means in plain English |
|---|---|
| **Frontend** | Everything the user sees and interacts with (HTML, CSS, JS in our case) |
| **Backend** | The server-side code and database (SpendMind v1 has none) |
| **API** | A way for two systems to talk to each other ("give me this user's data") |
| **localStorage** | Storage built into every browser; stores data as text; max ~5MB |
| **State** | All the data the app is holding in memory right now |
| **Render** | The act of drawing UI on screen from data |
| **Event listener** | Code that waits for something to happen (click, scroll, type) then reacts |
| **CDN** | A server that delivers shared files fast (we use it for Chart.js, SheetJS, fonts) |
| **Responsive** | The app adjusts its layout for different screen sizes |
| **Breakpoint** | A specific screen width at which the layout changes |
| **Async / asynchronous** | An operation that takes time; the app doesn't freeze waiting for it |
| **Refactor** | Rewriting code to be cleaner/faster without changing what it does |
| **Deploy** | Making the app live on the internet |
| **Bundle** | Packaging all files into one for faster loading |
| **Cache** | Storing a copy of something so it loads faster next time |
| **PWA** | Progressive Web App — a website that can be installed like an app |
| **Lerp** | Linear interpolation — smooth transition between two values over time |
| **localStorage key** | The "label" under which data is saved (like a folder name) |
| **Data model** | The structure/shape of data you store — what fields, what types |
| **Migration** | Moving data from one structure to another (e.g. when you change the data model) |
| **Hardcoded** | A value written directly in the code rather than coming from config or user input |
| **Edge case** | An unusual situation the code might not handle (e.g. what if amount is 0?) |

---

## 10. Questions to Ask Your Dev Team

These are the questions that make PMs look sharp in technical discussions.

### Before starting any feature:
- "What does this do to the data model?"
- "Does this require a backend or can it live on the frontend?"
- "Is there an edge case where this could show wrong data?"
- "What's the failure state — what does the user see if something goes wrong?"
- "Is there existing code we can reuse, or is this net new?"

### When reviewing a feature spec:
- "How will this behave for a user with 0 entries? 1,000 entries?"
- "If the user refreshes mid-action, what happens?"
- "Does this work offline?"
- "How does this look on a 375px wide screen (iPhone SE)?"
- "Is any of this data we store personally identifiable? (PII)"

### When debugging a reported bug:
- "Is this reproducible every time, or intermittent?"
- "What browser and OS is the user on?"
- "What was the last action taken before the bug appeared?"
- "Is it a display bug (looks wrong) or a data bug (wrong data)?"

### When estimating effort:
- "Is this a UI change, a logic change, or a data model change?"
- "Does this require any new third-party libraries?"
- "Do we need to handle backwards compatibility?" (i.e. existing user data must keep working)
- "Is there a simpler version of this that solves 80% of the user need?"

---

*Written for SpendMind v1 — March 2026*
*If you're an APM reading this: the best way to get better at this is to open `app.js`, pick one function, and try to trace exactly what it does. You don't need to write code to read it.*
