# Botsy Studios Client Portal — setup

This repository contains the secure database and webhook scaffold. GitHub Pages is static hosting; Supabase provides authentication, database access and the trusted webhook endpoint.

## 1. Create a Supabase project
Create a project and copy its Project URL and publishable/anon key from Project Settings → API. Never put the service-role key or webhook secret in website files or GitHub.

## 2. Configure Discord OAuth
1. Create/select an OAuth2 application in the Discord Developer Portal.
2. In Supabase, open Authentication → Providers → Discord and enable Discord.
3. Enter the Discord OAuth Client ID and Client Secret in Supabase only.
4. In Supabase Authentication → URL Configuration, set Site URL to https://botsystudios.github.io.
5. Add https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback as an allowed redirect URL in Supabase and use the exact callback shown by Supabase in the Discord OAuth application.
6. Request only the identify scope.

## 3. Configure the website
Set SUPABASE_URL and SUPABASE_ANON_KEY in supabase-config.js. These are public browser configuration values. Never put a service-role key there.

## 4. Create the database
Run schema.sql in Supabase SQL Editor. Row Level Security restricts clients to orders whose client_discord_id matches provider_id in their authenticated Discord user metadata. Clients have no write permissions.

## 5. Deploy the webhook
Install the Supabase CLI, then run:
    supabase login
    supabase link --project-ref YOUR_SUPABASE_PROJECT_ID
    supabase secrets set BOTSY_WEBHOOK_SECRET="YOUR_LONG_RANDOM_SECRET"
    supabase functions deploy inventor-order-event

Supabase supplies SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the Edge Function. Keep the service-role key private.

## 6. Inventor V2 request contract
POST to:
https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/inventor-order-event

Headers:
    Content-Type: application/json
    x-botsy-webhook-secret: YOUR_WEBHOOK_SECRET

When management presses Approve Order, send:
    {
      "event_id": "unique-discord-interaction-id",
      "event_type": "order_approved",
      "external_order_id": "BS-001",
      "client_discord_id": "CLIENT_DISCORD_USER_ID",
      "client_discord_username": "ClientName",
      "service_name": "Custom Discord Bot",
      "ticket_channel_id": "DISCORD_TICKET_CHANNEL_ID",
      "actor_discord_id": "MANAGER_DISCORD_USER_ID",
      "actor_name": "ManagerName"
    }

For later events send a new unique event_id and the same external_order_id. Supported event_type values:
- staff_claimed
- staff_released
- work_started
- quality_check
- awaiting_review
- revision_requested
- revision_started
- order_completed
- order_cancelled
- progress_updated (include a valid status)

For staff_claimed include actor_discord_id and actor_name. Optional description appears in the client activity timeline. Orders must be approved before later events are accepted. Repeated event_id values are safely ignored.

## 7. Test
Configure the website URL/key, sign in with the Discord account tied to an approved order, and send a test approval event from the bot. Verify that the client sees only their own order and timeline.

Do not send OAuth client secrets, service-role keys or webhook secrets in chat or commit them to GitHub.
