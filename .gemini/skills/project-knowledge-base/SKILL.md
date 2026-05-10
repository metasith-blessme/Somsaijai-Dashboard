---
name: project-knowledge-base
description: A long-term memory system for the workspace. Use this skill to record, retrieve, and organize project-specific context, technical decisions, and business rules in the /MEMORY directory to maintain continuity across sessions.
---

# Project Knowledge Base

This skill enables a persistent "Obsidian-style" memory within the workspace. It manages a structured `/MEMORY` directory that acts as the long-term context for the project.

## Core Mandates
- **Always Check Memory:** At the start of a new complex task, check `/MEMORY/INDEX.md` for relevant context.
- **Atomic Notes:** Each note should cover a single concept (e.g., `OCR_Fixes.md`, `Branch_Rules.md`).
- **Linking:** Use Markdown links `[[Note_Name]]` to connect related concepts.
- **No Redundancy:** Do not duplicate information found in `GEMINI.md`. Use the Knowledge Base for transient learning, project history, and specific technical deep-dives.

## Directory Structure
- `/MEMORY/INDEX.md`: The Map of Content (MOC). Lists all available notes by category.
- `/MEMORY/ARCHIVE/`: For deprecated notes or old session logs.
- `/MEMORY/*.md`: Individual atomic notes.

## Workflows

### 1. Initializing Memory
If `/MEMORY` does not exist:
1. Create the directory.
2. Create `INDEX.md` using the template.

### 2. Adding New Knowledge
When a new pattern or rule is discovered:
1. Create a new atomic note in `/MEMORY/`.
2. Add a link to it in `/MEMORY/INDEX.md` under the appropriate category.

### 3. Retrieving Context
1. Search `/MEMORY/` using `grep_search` or `glob`.
2. Read `INDEX.md` to see the organizational structure.

## Templates

### Note Template
```markdown
# [Title]
**Date:** [YYYY-MM-DD]
**Tags:** #tag1 #tag2

## Context
[Why this note exists]

## Details
[The actual information]

## Related
- [[Link_To_Other_Note]]
```
