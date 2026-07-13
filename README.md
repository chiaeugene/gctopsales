# Ecommerce AI Assistant — starting point

This folder is a **documentation + reference-code starting point**, copied from the Mandy wedding-photography AI sales assistant (`../mandy`). Mandy itself is untouched and still fully working in production — everything here is a copy, not a move.

## Start here

1. **`ARCHITECTURE.md`** — read this first. A detailed explanation of the entire system: the AI engine pipeline, the guardrail/money-state pattern, multi-channel messaging, inbound image + payment-verification handling, the settings pattern, and the specific bugs/lessons learned building it. Written to explain *why*, not just *what*, so the reasoning transfers to a different industry.
2. **`ECOMMERCE_STARTER.md`** — concrete suggestions for this specific rebuild: suggested brain schemas, a model-rename table (`Lead`→`Order`, `Package`→`Product`, etc.), and what's likely needed on day one that Mandy only added incrementally.
3. **`reference/`** — verbatim copies of the actual reusable source files. Files ending in `.example` are the ones with wedding-specific content (read for the pattern, rewrite the content); everything else is close to industry-agnostic already. See the file-by-file table at the end of `ARCHITECTURE.md` for what to do with each one.

## What this is not (yet)

This is not a bootable Next.js app. It's a curated set of reference files plus documentation, meant to be the starting point when you scaffold the actual new project (new `package.json`, new Prisma schema, new pages). Copy files out of `reference/` into a real project structure as you build it, adapting per the notes in `ARCHITECTURE.md` §10.
