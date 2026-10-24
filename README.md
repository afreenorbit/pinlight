# Pinlight

**Understand the board. Follow the connection. See what changes.**

Pinlight is an interactive electronics learning desk for Raspberry Pi 5 and Arduino Uno R3. It brings a selectable 3D board, guided circuit activities, reference code and a source-linked AI tutor into one workspace.

[Explore Pinlight](https://pinlight.afreenorbit.tech/learn)

![Pinlight learning desk with tutor chat, an interactive board and a guided trail](docs/blog/s2-trail-focus.png)

## Why it matters

A beginner's first circuit can mean switching between a datasheet, a pinout, wiring instructions and a code example. Pinlight keeps those pieces together: select a part, inspect its pins, follow a connection and ask why it works. The goal is to make starting electronics more approachable and let learners spend their effort understanding the circuit.

Today, the catalogue includes **2 boards, 5 experiment types per board and 20 guided experiment steps per board**. The Pi has 18 selectable board stops and a 40-position pin inspector that distinguishes physical pin numbers from BCM GPIO numbers. These are coverage counts; learning gains and time savings have not yet been measured.

## What you can do

- Explore the board in 3D, select parts and follow explanations linked to reference sources.
- Try **Blink an LED**, **Read a button press**, **Set the RGB balance**, **Tune a piezo tone** and **Position a servo**. Change controls and inspect the matching Python or Arduino reference code.
- Ask the tutor about the current lesson. Mastra orchestrates `gpt-oss-120b` through Groq; the server validates returned source IDs and component targets. A labelled curated guide is available when live AI is unavailable.
- Type or dictate questions with Wispr Flow. Optional Bolna tutor controls support English and Hindi; real two-way microphone testing remains pending.
- Upload a datasheet for text-based identification of supported boards.

![LED behaviour preview with reference code](docs/blog/s5-led-running-code.png)

## How it works

React and Vite power the interface, with Three.js for the original board illustrations. A Node API assembles lesson context and runs the Mastra tutor. PDF.js and Tesseract.js handle document text and OCR. The live deployment uses Vercel for the frontend, Render for the API and Groq for model inference.

Open weights leave room to change inference providers, while the open agent framework makes the tutor workflow inspectable and adaptable. Current AI inference is hosted and requires internet access. Provider credentials stay on the server.

**Current limits:** the 3D models are learning illustrations, not official CAD. Circuit activities preview fixed behaviours rather than solve electrical circuits or execute code on physical hardware. Arbitrary PDFs do not generate 3D models or lessons. Source links help learners check answers; validating a source ID does not guarantee every sentence is correct.

## Where Pinlight goes next

The next step is a database-backed personal learning library: upload an electronics-related PDF, have it organised by board, chip, module or topic, and turn its source material into a guided learning journey. The planned journey would break concepts into small lessons, link explanations back to the PDF, and save the document, questions and progress so you can return where you left off.

The aim is to support a broad range of electronics PDFs, beyond the two prepared board packages. Document organisation and optional database integration have a starting foundation; reliable PDF-to-journey generation and saved end-to-end learning journeys are future work.

## Run locally

Requires **Node.js 24+**. On a fresh checkout, copy `.env.example` to `.env` and configure the integrations you need. Preserve an existing `.env`. Set `GROQ_API_KEY` for live AI answers; without it, the learning desk can use its curated guide. Wispr Flow is a separate desktop application.

```sh
npm install
npm run dev:api
```

In a second terminal:

```sh
npm run dev
```

Open [localhost:5173](http://localhost:5173/learn). The local API uses `127.0.0.1:4100`. Optional Supabase accounts and saved chats require the variables in `.env.example` and the migration in `supabase/migrations/`; cloud persistence should be verified against your own project before use. Back up the entire `data/` directory to preserve local PDFs, records and reports.

## Checks and technical notes

```sh
npm test
npm run build
```

Optional provider checks, `npm run test:learning-live` and `npm run test:bolna`, require credentials and make real provider requests. They do not verify microphone conversation or hardware behaviour.

Board names belong to their owners. Pinlight is not affiliated with Raspberry Pi Ltd or Arduino.
