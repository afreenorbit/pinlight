# Pinlight

**Understand the board. Follow the connection. See what changes.**

Pinlight turns electronics PDFs into source-linked learning journeys, alongside prepared Raspberry Pi 5 and Arduino Uno R3 lessons. It brings a selectable 3D board, guided circuit activities, reference code and a source-linked AI tutor into one workspace.

Built for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19).

[Explore Pinlight](https://pinlight.afreenorbit.tech/learn)

![Pinlight learning desk with tutor chat, an interactive board and a guided trail](docs/blog/s2-trail-focus.png)

## Why it matters

A beginner's first circuit can mean switching between a datasheet, a pinout, wiring instructions and a code example. Pinlight keeps those pieces together: select a part, inspect its pins, follow a connection and ask why it works. The goal is to make starting electronics more approachable and let learners spend their effort understanding the circuit.

Today, the catalogue includes **2 boards, 5 experiment types per board and 20 guided experiment steps per board**. The Pi has 18 selectable board stops and a 40-position pin inspector that distinguishes physical pin numbers from BCM GPIO numbers. These are coverage counts; learning gains and time savings have not yet been measured.

## What you can do

- Explore the board in 3D, select parts and follow explanations linked to reference sources.
- Try **Blink an LED**, **Read a button press**, **Set the RGB balance**, **Tune a piezo tone** and **Position a servo**. Change controls and inspect the matching Python or Arduino reference code.
- Ask the tutor about the current lesson. Mastra orchestrates `gpt-oss-120b` through Groq; the server validates returned source IDs and component targets. A labelled curated guide is available when live AI is unavailable.
- Upload an electronics PDF to create a persistent processing job, extract device specifications with source citations, explore approximate 3D components, review pins and dimensions, try ideal voltage-divider or capacitor-charge experiments, and search for related manufacturer references through SerpApi.
- Sign in with Auth0 to save documents, chats, journeys and progress in My desk. Owner-scoped row-level security and private storage keep each account's files separate. Guests can explore; cloud saving needs an account.

![LED behaviour preview with reference code](docs/blog/s5-led-running-code.png)

## How it works

React and Vite power the interface, with Three.js for the original board illustrations. A Node API assembles lesson context, runs the Mastra tutor and processes uploads. PDF.js and Tesseract.js handle document text and OCR; Docling is an optional local table-layout worker. Supabase stores accounts, documents and saved journeys. Auth0 provides hosted sign-in and audience-bound API tokens. SerpApi supplies manufacturer reference links. The live deployment uses Vercel for the frontend, Render for the API, Groq for model inference and a `.tech` domain.

Open weights leave room to change inference providers, while the open agent framework makes the tutor workflow inspectable and adaptable. Current AI inference is hosted and requires internet access. Provider credentials stay on the server.

**Current limits:** generated geometry remains approximate. Source checks reduce unsupported claims but do not independently verify every extracted relationship. Uploaded devices do not automatically become electrically accurate simulations. The new experiments solve ideal teaching circuits with explicit example values. Browser clients cannot supply their own prompt or override the lesson evidence set.

See [the PDF pipeline](docs/pdf-pipeline.md) for processing, provider configuration, cloud storage, validation and deployment boundaries. See [Auth0 setup](docs/auth0-setup.md) for provider-side sign-in and Supabase ownership configuration.

## Run locally

Requires **Node.js 24+**. On a fresh checkout, copy `.env.example` to `.env` and configure the integrations you need. Preserve an existing `.env`. Set `GROQ_API_KEY` for live AI answers. Device extraction additionally requires `DEVICE_EXTRACTION_PROVIDER=groq` and `GROQ_VISION_MODEL` (or a text extraction model); this sends PDF content to Groq. Leave the provider local to keep device extraction on your server. Without a tutor key, the learning desk can use its curated guide.

```sh
npm install
npm run dev:api
```

In a second terminal:

```sh
npm run dev
```

Open [localhost:5173](http://localhost:5173/learn). The local API uses `127.0.0.1:4100`.

Optional accounts and saved desks need `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ACCOUNTS=on` and the Auth0 values in `.env.example`. Apply `supabase/migrations/0001_pinlight_desk.sql`, `0002_learning_artifacts.sql` and `0003_auth0_ownership.sql`, or run `npm run migrate:learning` with a server-only `DATABASE_URL`, `DATABASE_SSL_CA`, `VITE_SUPABASE_URL` (or `SUPABASE_URL`) and, when using Auth0, `AUTH0_DOMAIN`. The runner always applies the ownership migration so native Supabase accounts also get `current_owner_key()`. Back up the entire `data/` directory to preserve local PDFs, jobs and generated journeys.

## Checks and technical notes

```sh
npm test
npm run build
```

Optional provider checks, `npm run test:learning-live` and `npm run test:live`, require credentials and make real provider requests. They do not verify microphone conversation or hardware behaviour. `npm run test:live` sends a synthetic fixture to the configured device-extraction provider.

Board names belong to their owners. Pinlight is not affiliated with Raspberry Pi Ltd or Arduino.
