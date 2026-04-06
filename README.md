# Charlie Admissions: Capacity Circus & Dispatch

An enterprise-grade, real-time workforce management and dispatch system designed for clinical intake and overflow reassignment.

## 🚀 Features

* **Live Dispatch Board:** Real-time WebSocket subscriptions routing Available ICs to Open Room Slots.
* **Automated Queue Management (Sweepers):** Background processes automatically clear stale queues (25m timeout) and unconfirmed assignments (5m timeout).
* **Consolidated Capacity Planner:** Admins can dynamically calculate necessary overflow rooms (Calc % logic) based on aggregated daily schedules from individual Managers.
* **Hybrid Authentication:** Supports both secure Supabase Magic Links (OTP) for live users and legacy PIN-based routing for QA/Test users.
* **Performance Analytics:** Real-time statistics tracking total dispatches, tier-based assignment frequency, and IC participation metrics across dynamic date ranges.

## 🏗 Architecture

This application follows strict React componentization and Custom Hook patterns to separate Business Logic from UI presentation.

* **`/components`**: Granular, single-responsibility UI elements (e.g., `WaitingQueue`, `OpenSlots`, `TeamScheduleInput`).
* **`/hooks`**: Extracted Supabase data-fetching and state management logic (`useDispatchData`, `useCapacityPlanner`, `useManagerStats`).
* **`/pages`**: Top-level layout wrappers (`ManagerCenter`, `AdminPanel`, `ICDashboard`).
* **`/context`**: Global state management (`AuthContext`).
* **`/__tests__`**: Automated Vitest/React Testing Library lifecycle tests.

## 💻 Tech Stack

* **Frontend:** React (Vite), Tailwind CSS, Lucide React (Icons)
* **Backend / Database:** Supabase (PostgreSQL, Realtime WebSockets, Row Level Security)
* **Testing:** Vitest, React Testing Library, JSDOM
* **Deployment:** Vercel / Netlify (Recommended)

## 🛠 Local Setup & Development

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-org/ch_cat-circus.git](https://github.com/your-org/ch_cat-circus.git)
   cd ch_cat-circus