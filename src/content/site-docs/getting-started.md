---
title: Get started
area: get-started
---

# Get started

Install the memQL Cockpit, connect to an engine, and run your first agent. This
takes about five minutes.

> This page is written for the site and is pending an official version in the
> memQL engine repository. The install command is real and hosted at
> memql.io/install.sh; it requires a published memQL Cockpit release to download.

## Requirements

memQL Cockpit currently supports **macOS and Linux**. There is no Windows
installer yet; on Windows, use WSL2 (a Linux environment) in the meantime.

- macOS 13+ (Apple Silicon or Intel), or a modern Linux distribution (x86-64 or arm64)
- A terminal

## Install

Run this in your terminal — it downloads and installs the Cockpit:

```bash
curl -fsSL https://memql.io/install.sh | sh
```

This drops the `memql` command on your `PATH`. Verify it:

```bash
memql --version
```

## Your first agent

1. **Start the Cockpit.**

   ```bash
   memql cockpit
   ```

   The Cockpit is the terminal-native console for driving memQL — clusters,
   chat, concepts, workers, and safety in one place.

2. **Connect to an engine.** On first launch the Cockpit walks you through
   pointing at an engine (local or remote) and authenticating.

3. **Write your first memory.** From the chat tab, send a message. memQL records
   it as an episodic memory in the graph — durable across turns and restarts.

4. **Run a turn.** Ask the agent to do something. Watch the agent loop run in
   the Cockpit: plan, step, observe — with the cost and safety spine bounding it.

5. **Recall.** Ask a follow-up. The agent recalls what it learned rather than
   starting from scratch — that is the memory substrate doing its job.

## Where to go next

- **Why it's a harness, not a library** — the proof behind the positioning.
- **The language (MQL)** — every behavior in the system is a typed construct.
- **Concepts** — the data model, events, and the graph the memory lives in.
