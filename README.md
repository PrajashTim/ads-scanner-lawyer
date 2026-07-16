# Lawyer Ad Signal

A private operator interface for finding active law-firm Meta ads by market and turning one verified ad signal into a YouTube opportunity email plus a rough one-page brief.

## Runtime variables

- `OPENROUTER_API_KEY` generates the email and opportunity brief server-side.
- `APIFY_API_TOKEN` enables live active-ad scans through the configured Apify actor. Without it, the app runs in clearly labeled sample mode and accepts imported JSON.
