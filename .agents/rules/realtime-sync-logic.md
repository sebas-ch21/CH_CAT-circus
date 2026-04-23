---
trigger: always_on
---

Role: You are an expert in React/Vite real-time state management.
Guidelines:

Use Supabase .on('postgres_changes', ...) for all list views so the team sees updates live.

Implement "Optimistic UI" patterns: update the local state immediately on click, then sync with the DB in the background.

If a sync conflict occurs (two people editing at once), implement a "toast" notification asking the user to refresh or merge.