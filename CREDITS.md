# Credits and licences

Pinlight is built on open-source software and published reference material. Everything listed here is used within its licence terms. All 3D part models in the build views are drawn in Pinlight's own code; no third-party 3D model files are included.

## Software

| Project | Used for | Licence |
|---|---|---|
| [three.js](https://threejs.org/) | All 3D views: learning desk, build view, enclosure and product views | MIT |
| [manifold](https://github.com/elalish/manifold) (`manifold-3d`) | Building printable enclosure solids in the browser | Apache-2.0 |
| [React](https://react.dev/) | Interface | MIT |
| [Vite](https://vite.dev/) | Development server and build | MIT |
| [Mastra](https://mastra.ai/) (`@mastra/core`) | AI agent framework for reviews, the 3D scene description and Arena grading | Apache-2.0 |
| [zod](https://zod.dev/) | Checking AI responses against fixed formats | MIT |
| [KaTeX](https://katex.org/) | Maths in questions | MIT |
| [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`) | Reading datasheet PDFs | Apache-2.0 |
| [pdf-lib](https://pdf-lib.js.org/) | PDF processing | MIT |
| [Tesseract.js](https://github.com/naptha/tesseract.js) and its English data | Reading text from scanned pages | Apache-2.0 / MIT |
| [Hugeicons](https://hugeicons.com/) free icons | Icons | MIT |
| [Supabase JS](https://github.com/supabase/supabase-js) | Accounts, saved work and Arena progress | MIT |
| [node-postgres](https://github.com/brianc/node-postgres) (`pg`) | Database access | MIT |
| [jose](https://github.com/panva/jose) | Verifying sign-in tokens | MIT |
| [Auth0 SPA SDK](https://github.com/auth0/auth0-spa-js) | Sign-in | MIT |
| [Bolna web call](https://www.npmjs.com/package/@bolna/web-call) | Spoken replies | MIT |
| [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) | Server-side page rendering | MIT |

`occt-import-js` (LGPL-2.1) is listed as a development dependency but is not used by the app and is not shipped to visitors.

## Fonts

[Bowlby One](https://fonts.google.com/specimen/Bowlby+One), [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), [DM Sans](https://fonts.google.com/specimen/DM+Sans) and [Manrope](https://fonts.google.com/specimen/Manrope), served by Google Fonts under the SIL Open Font License 1.1.

## Reference data

- **Raspberry Pi 5 dimensions and mounting holes:** the official [Raspberry Pi 5 mechanical drawing](https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-mechanical-drawing.pdf). Port positions in the enclosure generator are approximations; check them against the drawing.
- **Arduino Uno R3 dimensions and pins:** [Arduino Uno Rev3 documentation](https://docs.arduino.cc/hardware/uno-rev3/).
- **Practice questions:** [EEE-Bench](https://huggingface.co/datasets/afdsafas/EEE-Bench) (the dataset card declares MIT).
- **Board and component facts** in the learning desk link to their sources in the app.

## AI services

Reviews, the 3D scene description, Arena grading and the coach's verdict use models hosted by [Groq](https://groq.com/). Their output is checked against fixed rules before it is shown; see `docs/build-review.md`.
