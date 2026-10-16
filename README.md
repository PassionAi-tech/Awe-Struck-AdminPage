# Awe-Struck Admin

Responsive dashboard for planning and tracking the Awe-Struck women's Western and Indo-Western clothing store.

## Dashboard features
- Budget planner and expense ledger
- Clothing inventory (Western / Indo-Western, sizes, colours, quantity, cost and sale price)
- Supplier directory
- Sales and gross-profit estimates
- Launch checklist
- JSON backup export/import

## Supabase cloud setup

The frontend integration is prepared, but the database must be installed in the Awe-Struck Supabase project before cloud login will work.

1. Open the [Awe-Struck project](https://supabase.com/dashboard/project/knnviulwnsoynxfznhck).
2. Open **SQL Editor**, create a new query, paste the complete contents of [supabase/schema.sql](./supabase/schema.sql), and run it.
3. Open **Project Settings → API Keys** and copy the **publishable key** (starts with `sb_publishable_`). Do not copy a secret or service_role key.
4. Edit `supabase-config.js` and replace `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` with that publishable key. The project URL is already set.
5. Ensure the Supabase Data API is enabled for the `public` schema and the three `awestruck_*` tables are exposed. RLS policies are enabled by the schema.
6. Commit the updated `supabase-config.js` and reload the dashboard.

Supabase JS is loaded from its CDN. Authentication uses email/password. The first account created gets a new private Awe-Struck workspace; records are saved to Supabase and load on other devices after signing in.

### Share the same workspace with a family member

1. Have the family member create their own account in the dashboard and confirm their email if asked.
2. In Supabase **SQL Editor**, find the new user's UUID under **Authentication → Users** and run the query below, replacing both UUID placeholders. The owner UUID is the account that created the workspace first.

```sql
insert into public.awestruck_members (workspace_id, user_id, role)
select owner_membership.workspace_id, 'FAMILY_USER_UUID'::uuid, 'member'
from public.awestruck_members as owner_membership
where owner_membership.user_id = 'OWNER_USER_UUID'::uuid
  and owner_membership.role = 'owner'
on conflict (workspace_id, user_id) do nothing;
```

Only share the workspace with people who should see the store's business records.

## Existing browser data

Older dashboard records are stored in that browser's localStorage. After connecting Supabase, export a JSON backup first from **Settings & Backup**. If the new workspace is empty, the integration seeds it from the current browser's data. Once a cloud workspace already contains data, cloud data takes priority.

## Security notes
- Use only the publishable key in the browser; never expose a Supabase secret/service_role key.
- RLS limits access to authenticated workspace members.
- Keep backups of business data and verify that only intended family members have accounts.
- This is a planning dashboard, not accounting or tax advice.

## Deployment
This is a static site. GitHub Pages can host it after Pages is enabled in repository settings.
