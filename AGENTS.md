# AGENTS.md

## Project

This is a learning project for building a chess application.

Current frontend:
- React
- TypeScript
- Vite

A Python/FastAPI backend may be added later.

## Working style

- Prefer simple, direct solutions unless additional complexity solves a real problem.
- Avoid premature abstractions and unnecessary dependencies.
- Do not overengineer small features, but use more sophisticated designs when the problem genuinely requires them.
- Favor readable, maintainable, and extensible code.
- Follow established patterns in the existing codebase unless there is a clear reason to improve them.

## Correctness and assumptions

- Prefer explicit assumptions over defensive code that silently handles many hypothetical input formats.
- When data is expected to have a particular shape or schema, model and validate that shape clearly.
- If an assumption is violated, fail clearly rather than guessing alternative field names, formats, or structures.
- Do not add fallback branches for scenarios that are not part of the actual requirements.

## TypeScript / React

- Use TypeScript types to express expected data structures.
- Prefer straightforward React patterns and functional components.
- Keep state as local as reasonably possible.
- Avoid introducing state-management libraries or abstractions unless the application actually needs them.
- Keep UI components focused and move non-UI logic out of components when that improves clarity.

## Teaching

This project is also being used to learn software development.

When making a non-trivial change:
- Briefly explain the important design decisions.
- Explain unfamiliar React, TypeScript, Python, or FastAPI concepts when introducing them.
- Prefer explanations of *why* a pattern is used rather than narrating every line of code.
- Keep explanations concise unless more detail is requested.

Do not sacrifice code quality merely to make the implementation easier to explain.

## Changes

- Before making a large architectural change, explain why it is needed.
- Prefer incremental changes over broad rewrites.
- Preserve unrelated existing behavior.
- After making changes, run the relevant checks or tests when available.