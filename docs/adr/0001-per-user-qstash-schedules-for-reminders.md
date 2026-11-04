# Per-user QStash schedules for the daily reminder

The daily reminder must fire at each user's chosen local time, but Vercel Hobby crons run at most once per day with ±59 min precision, and anything more frequent fails to deploy. Instead of a polling cron, saving a reminder time creates (or replaces) one Upstash QStash schedule for that user, with the expression `CRON_TZ=<user timezone> <m> <h> * * *`, which calls `/api/remind`. QStash handles timezones and DST and fires within the minute, it's free at our volume, and it scales one schedule per user when the app opens to others.

## Considered Options

- **Vercel Pro + 15-min cron:** $20/mo for a single-user app; still needs our own due-time maths.
- **GitHub Actions cron:** free, but runs routinely start 10–30 min late, so it fails "at the time you pick".

## Consequences

The QStash schedule id is stored on the user row and must be kept in sync whenever the reminder time, timezone or push opt-in changes. `/api/remind` must verify the QStash signature.
