# SpendMind — Product Requirements Document (PRD)

**Version:** 1.0
**Status:** Live (v1 shipped)
**Author:** Nandini
**Last Updated:** March 2026
**Product Type:** Personal Finance Web App

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Target User & Persona](#3-target-user--persona)
4. [Goals & Success Metrics](#4-goals--success-metrics)
5. [User Stories](#5-user-stories)
6. [Feature Requirements](#6-feature-requirements)
7. [Technical Constraints](#7-technical-constraints)
8. [Out of Scope (v1)](#8-out-of-scope-v1)
9. [Risks & Assumptions](#9-risks--assumptions)
10. [Future Roadmap](#10-future-roadmap)

---

## 1. Executive Summary

SpendMind is a zero-friction, browser-based personal expense tracker designed for young Indian professionals who want to be mindful of their spending without the overhead of complex finance apps. It requires no login, no download, and no internet after the first load. Users log expenses, track spending patterns across categories and payment methods, set monthly budgets, and get automatic financial insights — all from a single beautiful web page.

**The core insight:** Most people don't fail at budgeting because they lack willpower. They fail because logging expenses feels like too much work. SpendMind removes every possible barrier.

---

## 2. Problem Statement

### The Pain
Young professionals (especially in India) have increasing disposable income but little visibility into where it actually goes. Common alternatives fall short:

| Alternative | Why it fails |
|---|---|
| Spreadsheets | Requires manual effort, intimidating to set up |
| Bank statements | Show what happened, not patterns or insights |
| Apps like Walnut / Money View | Require SMS permissions, account linking, login |
| Mental tracking | Inaccurate, forgotten by end of month |

### The Gap
There is no tool that is:
- **Instant** (no signup)
- **Private** (no data leaves your device)
- **Visual** (charts, not just numbers)
- **Smart** (tells you something you didn't notice)
- **Beautiful** (feels good to open every day)

SpendMind fills this gap.

---

## 3. Target User & Persona

### Primary Persona — "The Aware Spender"

> **Nandini, 24, Associate Product Manager, Bangalore**
>
> Just got her first real salary. Lives in a PG, spends on metro, food deliveries, occasional travel, and skincare. Uses UPI for almost everything but has a credit card for big purchases. She's not irresponsible with money — she just has no idea where it goes. She doesn't want a finance course, she wants a mirror.

**Key traits:**
- Comfortable with apps, but low patience for complexity
- Wants insight, not just data entry
- Checks spending retrospectively (end of week / month), not in real-time
- Uses both cash/UPI and credit card
- Cares about aesthetics — ugly apps don't get opened

### Secondary Persona — "The Student Logger"
A college student tracking pocket money, internship stipend, and parental transfers. Simpler spending, same desire for visibility.

---

## 4. Goals & Success Metrics

### Product Goals

| Goal | Why it matters |
|---|---|
| Make logging an expense take < 15 seconds | Friction kills habits |
| Surface patterns the user didn't consciously notice | This is the "aha" value |
| Work on mobile without a native app | Users are on their phones |
| Feel premium enough to use daily | Aesthetics = retention |

### Success Metrics (KPIs)

> Note: Since v1 has no backend, these would be tracked manually or via analytics if added later.

| Metric | Target | How to measure |
|---|---|---|
| Time to log first expense | < 30 seconds | User testing |
| Daily active usage (sessions/week) | 4+ | localStorage session count |
| Entries per user per month | 20+ | Entry count in localStorage |
| Budget feature adoption | 50% of active users set ≥1 budget | Budget key presence in localStorage |
| Mobile usability score | No horizontal scroll, all features accessible | Manual QA on iOS/Android |

---

## 5. User Stories

User stories follow the format: **As a [user], I want to [action] so that [outcome].**

### Core Logging
- As a user, I want to log an expense with category, amount, date, and note so that I have a complete record without opening a spreadsheet.
- As a user, I want to select "Credit Card" vs "Cash/UPI" so that I can track what I owe vs what I've spent.
- As a user, I want to log income entries so that I can see them in my transaction history even if they don't affect my expense totals.
- As a user, I want my data to persist after I close the browser so that I don't lose my history.

### Viewing & Filtering
- As a user, I want to see this month's expenses by default so that I'm not overwhelmed by historical data.
- As a user, I want to navigate to past months so that I can review what I spent in January vs February.
- As a user, I want to filter transactions by category or payment method so that I can answer specific questions ("how much did I spend on food this month?").
- As a user, I want to see my highest spending day and week so that I notice patterns around weekends or paydays.

### Insights & Intelligence
- As a user, I want automatic insights (not just numbers) so that the app tells me something I didn't already know.
- As a user, I want to know if my spending this week is higher than last week so that I can adjust before the month ends.
- As a user, I want to be warned if I'm approaching or over a budget limit so that I don't get surprised at month end.

### Budgets
- As a user, I want to set a monthly budget per category so that I have a spending target to work toward.
- As a user, I want to see a visual progress bar for each budget so that I know at a glance how close I am.

### Import
- As a user, I want to bulk-import past transactions from Excel so that I don't have to manually enter weeks of historical data.

### Housekeeping
- As a user, I want to delete individual transactions so that I can fix mistakes without clearing everything.
- As a user, I want to clear all data for a fresh start so that I can reset if I want to.

---

## 6. Feature Requirements

### Priority System
- **P0** — Must have. Product doesn't work without it.
- **P1** — Should have. Significantly reduces value if missing.
- **P2** — Nice to have. Improves experience but not blocking.

---

### P0 — Core (Shipped in v1)

| # | Feature | Description |
|---|---|---|
| F01 | Add expense | Form with category, note, amount, date, payment method |
| F02 | Expense categories | 18 predefined categories (Food, Metro, Subscriptions, etc.) |
| F03 | Payment method toggle | Cash/UPI vs Credit Card |
| F04 | Transaction list | Scrollable list with delete per item |
| F05 | Persistent storage | Data saved in browser (localStorage) |
| F06 | Total spent card | Running total for selected month |
| F07 | Credit card total card | Separate total for CC spend |

### P1 — High Value (Shipped in v1)

| # | Feature | Description |
|---|---|---|
| F08 | Month navigator | ‹ March 2026 › — filter all views by month |
| F09 | Highest day / week cards | Spot anomaly days at a glance |
| F10 | Category breakdown chart | Horizontal bar chart by category |
| F11 | Cash vs Credit donut chart | Payment method split |
| F12 | Daily timeline chart | Current month day-by-day bar chart |
| F13 | Daily trend chart | Last 30 days line chart |
| F14 | Weekly spending chart | Week-by-week bar chart |
| F15 | Money Intelligence | Auto-insights: week comparison, spike, CC ratio, top category |
| F16 | Budget per category | Set monthly limit, see progress bars |
| F17 | Bulk import | Excel/CSV upload with preview and validation |
| F18 | Income logging | Log income in form; shows in list but excluded from expense totals |

### P2 — Nice to Have (Not yet shipped)

| # | Feature | Description |
|---|---|---|
| F19 | Data export | Download all entries as CSV/Excel |
| F20 | Recurring entries | Auto-log fixed monthly expenses (rent, subscriptions) |
| F21 | Push notifications | Daily reminder to log expenses |
| F22 | Cross-device sync | Same data on phone and laptop |
| F23 | User login | Account-based access |
| F24 | Spending goals | Target monthly spend, not just per-category |
| F25 | Dark/light mode toggle | User preference |
| F26 | Tags | Free-form tagging beyond categories |

---

## 7. Technical Constraints

> This section is for PMs to understand what the engineering team is working with. You don't need to know the code — just the implications.

### What we're using and why it matters to you as PM

| Technology | What it is (plain English) | PM implication |
|---|---|---|
| Vanilla HTML/CSS/JS | The app is built with just the basic building blocks of the web, no frameworks | Fast to load, easy to host, any dev can read it |
| localStorage | Data is stored in the user's own browser | **No server costs, but no sync.** Data is lost if the user clears browser data or switches device |
| Chart.js (CDN) | A charting library loaded from the internet | App needs internet on first load; charts won't work offline |
| SheetJS (CDN) | A library for reading Excel/CSV files | Same — needs internet on first load |
| No backend / no database | There is no server storing data | **Zero infra cost, zero privacy risk**, but limits features like sync, sharing, notifications |
| No build step | The code runs directly in the browser, no compilation needed | Faster development, but harder to scale to a large team |

### Hard limits in v1
- **No accounts** — data is not tied to a person, just a browser
- **No sync** — phone and laptop have separate, unconnected data
- **No notifications** — browser-based apps can't push notifications without a service worker
- **Single currency** — INR only

---

## 8. Out of Scope (v1)

The following were explicitly decided against for v1 to keep scope tight:

| Feature | Reason not included |
|---|---|
| User authentication / login | Would require a backend; adds complexity and privacy surface area |
| Cloud sync | Requires backend + database |
| Bank/UPI integration | Regulatory complexity (PCI DSS, RBI norms); privacy risk |
| Multi-currency | Not needed for target persona |
| Shared/family accounts | Different use case entirely |
| AI-based categorisation | Requires ML model or external API |
| Investment tracking | Different domain (wealth management vs. expense tracking) |

---

## 9. Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| User loses all data by clearing browser cache | Medium | High | Add CSV export (F19) so users can back up |
| App breaks on older browsers | Low | Medium | Test on Safari iOS, Chrome Android |
| Users don't return after first session (no habit formed) | High | High | Consider daily reminder PWA notification (F21) |
| Data privacy concern (even though local) | Low | Low | Clearly communicate "data never leaves your device" |

### Assumptions
- Users are on modern browsers (Chrome, Safari, Firefox — last 2 years)
- Primary device is laptop for data entry, phone for quick checks
- Users are comfortable entering data manually (no bank-link expectation)
- INR is the only currency needed

---

## 10. Future Roadmap

### Phase 2 — Sync & Access (3–6 months out)
**Goal:** Same data everywhere
- Add Supabase backend (free tier, open source)
- User login via Google OAuth
- Data syncs across devices in real time
- **Key decision needed:** How do we handle existing localStorage data migration when a user signs up?

### Phase 3 — Smarter Insights (6–9 months out)
**Goal:** The app should feel like a financial advisor
- Month-on-month comparison view
- Predicted end-of-month spend based on current pace
- Anomaly detection improvements (contextual, not just spike %)
- Category trend lines

### Phase 4 — Mobile Native (9–12 months out)
**Goal:** Make logging feel native on phone
- Convert to a PWA (Progressive Web App) — installable on home screen, works offline
- Bottom nav optimised for thumb navigation
- Quick-log widget

### Phase 5 — Social / Accountability (12+ months)
**Goal:** Help users stay accountable
- Monthly spending summary shareable card
- Split expense tracking (going Dutch with friends)
- Optional spending streaks / gamification

---

*This PRD was written retrospectively for v1 of SpendMind, which was built as a learning and portfolio project. It follows standard PRD conventions used at product teams across the industry.*
