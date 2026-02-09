# Project Rules

## Required Tools

**ALWAYS use MCP context7** to fetch up-to-date documentation and context before implementing any solution. This ensures you're using the latest APIs, best practices, and library versions.

## Project Context

**At the start of every new chat** — read `PROJECT.md` in the project root. It contains the full architecture, implementation details, and function descriptions. This eliminates the need to re-analyze the codebase from scratch.

## Keep PROJECT.md Up-to-Date

**After ANY code change** (new feature, refactor, bug fix, new file, deleted file, changed API, etc.) — update `PROJECT.md` to reflect those changes. This includes:
- New or removed files/components/routes
- Changed function signatures, props, or behavior
- New dependencies or removed ones
- Changed DB schema
- New or modified state management patterns
- Any architectural change

This is critical — `PROJECT.md` must always match the actual code so it can be used as the single source of truth in new sessions.
