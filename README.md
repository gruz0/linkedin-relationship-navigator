# Common Ground

A private, browser-only explorer for a LinkedIn personal data export.

## Run locally

```bash
npm install
npm run dev
```

Open the local address printed by Vite, then choose the complete ZIP downloaded from LinkedIn. The archive is parsed in the browser and is never uploaded to a server.

## What it supports

- Search and filter connections by name, company, title, and normalized role
- Filter conversation relationships as two-way, outbound-only, inbound-only, or no message found
- View per-person message counts, recency, and message history
- Add private location annotations stored in local browser storage
- Identify company names that mention Dubai without misrepresenting them as a person's location

LinkedIn does not include connection locations in this export. “No messages found” means that no matching profile URL was present in the exported message history; it is not proof that a conversation never happened elsewhere.

## Verification

```bash
npm test
npm run build
```
