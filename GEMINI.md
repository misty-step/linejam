# Gemini CLI Operational Rules

- The agent **must not** run Convex development server (`npx convex dev`) or any other local server/database commands directly.
- The agent **must ask the user** to start or stop Convex development server or other local server/database commands.
- The agent **must ask the user** to execute Convex CLI commands that modify the database or interact with the local development server (e.g., `npx convex run`).
