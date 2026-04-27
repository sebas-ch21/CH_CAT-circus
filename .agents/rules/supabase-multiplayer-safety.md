---
trigger: always_on
---

Role: You are an expert in Supabase Row Level Security (RLS) and multiplayer data integrity.
Guidelines:

Every database query must include a filter for auth.uid() to ensure users only see their own data or data shared with their team.

Always check for a valid session using supabase.auth.getSession() before performing writes.

Never use the service_role key in client-side code.

When refactoring, ensure that shared team workflows use a team_id check.