# Project provenance

Pinlight was developed in this workspace. The React interface, learning desk, procedural 3D board illustrations, PDF-to-journey pipeline and local API were written for this project. No complete third-party application or UI template was imported.

The project deliberately uses third-party building blocks: React, Vite, Three.js, Mastra, Zod, Mozilla PDF.js, pdf-lib, Tesseract.js, `@napi-rs/canvas`, Supabase, the Auth0 SPA SDK and SerpApi. Integration shapes and SDK usage follow their public documentation. These are dependencies and API examples, not a copied application; their own licenses still apply. The optional Docling worker is installed separately and is not part of `npm install`.

The board and breadboard models are original procedural Three.js learning illustrations. They are not official CAD, and they are not generated from an uploaded datasheet. The experiments are ideal teaching circuits with explicit example values, not electrical simulators.

The demonstration PDFs are published by Arduino and SparkFun. They are third-party source documents, not drawings created for Pinlight. Their original attribution remains in the displayed or exported documents. Screenshots in `docs/blog/` were captured from Pinlight during local testing.

This records what was used in this build. It is not a claim that no similar learning product exists elsewhere, nor an exhaustive external similarity or legal review.
