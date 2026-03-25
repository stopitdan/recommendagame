# Recommend a Game — Project Documentation

This folder contains all planning, tracking, and architectural documentation for the Recommend a Game project.

## Contents

| File | Purpose |
|------|---------|
| [ROADMAP.md](ROADMAP.md) | High-level phases and milestones |
| [TASKS.md](TASKS.md) | Granular task tracking with status |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture and tech decisions |
| [DATA-SOURCES.md](DATA-SOURCES.md) | API research, endpoints, rate limits, auth |
| [DECISIONS.md](DECISIONS.md) | Architecture Decision Records (ADRs) |
| [RECOMMENDATION-ENGINE.md](RECOMMENDATION-ENGINE.md) | How the recommendation engine evolves from filtering to ML |
| [playbooks/](playbooks/) | Reusable guides for repeatable tasks |

## Playbooks

Step-by-step guides so we do things consistently every time:

| Playbook | When to Use |
|----------|-------------|
| [API-ADAPTER.md](playbooks/API-ADAPTER.md) | Hooking up a new external API/data source |
| [DATA-SCHEMA.md](playbooks/DATA-SCHEMA.md) | Defining or extending a TypeScript data schema |
| [NEW-PAGE.md](playbooks/NEW-PAGE.md) | Adding a new page/route to the app |
| [NEW-COMPONENT.md](playbooks/NEW-COMPONENT.md) | Creating a new reusable UI component |
| [API-ROUTE.md](playbooks/API-ROUTE.md) | Adding a new Next.js API route |
| [TESTING.md](playbooks/TESTING.md) | Writing and running tests |
| [SUPABASE.md](playbooks/SUPABASE.md) | Database queries, migrations, client usage |

## Status Legend (used in TASKS.md)

- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Complete
- `[!]` — Blocked
