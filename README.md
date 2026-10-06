# Juniper Salon Waitlist System

A waitlist outreach prototype built with Temporal for the Upskilling Together
post-assessment. When a last-minute appointment opens at Juniper Salon, the
system contacts eligible waitlisted clients one at a time, waits durably for
each response, and confirms the slot the moment someone accepts.

## Requirements

- Node.js 20 or newer
- Docker Desktop (must be running before you start)

## Run
npm run dev

Open the staff dashboard at http://localhost:3000
Inspect all workflow executions at http://localhost:8233

## How to use

1. Fill in the open slot details on the left panel and click Notify Waitlist
2. Toggle Demo mode on for a 20-second response window, or off for the real
   15-minute window Lena described
3. Use the Simulate link on the dashboard to open the client response page
4. Accept or decline from the client page and watch the dashboard update live

## How Temporal is used

- Each outreach run is a single durable Workflow that owns the full offer
  sequence from start to finish
- Temporal timers enforce the 15-minute response deadline per client without
  any polling or cron jobs
- Signals carry accept and decline responses from the client page into the
  running Workflow
- A Query exposes the full live state so the staff dashboard can reflect what
  Temporal knows without touching a database
- The Workflow survives a server restart mid-outreach and resumes exactly
  where it left off

## Notes

- Waitlist data is simulated with eight sample clients in src/workflows.ts
- The client response page lives at public/respond.html and receives the
  workflow ID and client ID as URL parameters
- No changes to worker.ts are needed — it registers all exported workflows
  automatically

## Evidence

A Temporal Web UI screenshot showing a completed workflow execution is saved
under evidence/