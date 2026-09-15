# Common Ground

A private, browser-only explorer for a LinkedIn personal data export.

## Run locally

Requires [Bun](https://bun.sh/) 1.3.14 or later.

```bash
bun install
bun run dev
```

Open the local address printed by Vite, then choose the complete ZIP downloaded from LinkedIn. The archive is parsed in the browser and is never uploaded to a server.

## What it supports

- Search and filter connections by name, company, title, and normalized role
- Filter conversation relationships as two-way, outbound-only, inbound-only, or no message found
- View per-person message counts, recency, and message history
- Add private locations, tags, and notes stored locally in the browser
- Export and restore annotations with a versioned Common Ground workspace file
- Start safely with Privacy mode enabled, masking names, companies, raw titles, annotations, profile links, and message content until you choose to reveal them
- Identify company names that mention Dubai without misrepresenting them as a person's location

LinkedIn does not include connection locations in this export. “No messages found” means that no matching profile URL was present in the exported message history; it is not proof that a conversation never happened elsewhere.

Workspace exports contain annotations and basic source-archive metadata. They do not contain LinkedIn message bodies.

Privacy mode is presentation-layer masking intended for screenshots, videos, and demonstrations. Every opened archive starts masked; revealing data applies only to the current session. Privacy mode does not alter the uploaded archive or exported workspace, and it is not a substitute for sanitizing files before sharing them.

## Verification

```bash
bun run test
bun run build
```
