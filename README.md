# Polyglot.io

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Polyglot.io is a full-stack language learning app focused on lessons, synchronized subtitle reading, and vocabulary retention.

> Inspired by [LingQ](https://www.lingq.com/) and [Steve Kaufmann](https://www.thelinguist.com/).

## Getting Started

### 1) Prerequisites

- Node.js `>=18`
- Yarn `>=1.22`
- Docker + Docker Compose (for MySQL)
- OpenAI API key (required for OpenAI-only operations and current TTS;
  optional for supported Agent CLI operations when tmux runtime is enabled)
- AWS S3 credentials (required for uploads and file-based lessons)
- tmux and an Agent CLI such as Codex (optional, for backend-managed agent sessions)

### 2) Clone and install

```bash
git clone <repository-url>
cd polyglot-io
yarn install
```

### 3) Configure environment variables

```bash
cp backend/env.example backend/.env
cp frontend/env.example frontend/.env
```

In `backend/.env`, set your OpenAI API key for direct AI features:

```env
OPENAI_API_KEY=your-openai-api-key
```

The backend may start without this key when `AGENT_TMUX_ENABLED=true`. In that
mode, the Agent Session API can use an authenticated CLI, while direct OpenAI
routes return `503 openai_not_configured` until a real API key is supplied.
Lesson generation is the exception: `POST /api/lessons/generate` automatically
falls back to the configured Agent CLI batch mode when the key is missing or
OpenAI rejects it with HTTP 401. The fallback runs in an isolated tmux socket,
validates structured output, and stores the generated sentence/word analysis.

AI text execution is selected centrally with `AI_PROVIDER=auto|openai|agent_cli`.
`auto` prefers the OpenAI API and falls back to Agent CLI when the key is absent
or rejected with 401. Lesson generation, word pronunciation, sentence
translation, and word translation support Agent CLI execution. Image extraction
still requires OpenAI. TTS currently requires OpenAI and is intentionally not
run through Agent CLI/tmux because those components do not synthesize audio.

A dedicated TTS provider is planned with `TTS_PROVIDER=auto|openai|system`.
`system` will use an allowlisted local speech engine (macOS `say`, and Piper on
Linux); `auto` will retain OpenAI and fall back to system TTS when it is ready.
See [`docs/plans/tts-provider.md`](docs/plans/tts-provider.md).

In `backend/.env`, also set your AWS S3 credentials:

```env
AWS_REGION=your-aws-region
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=your-bucket
```

### 4) Start database and apply migrations

```bash
yarn docker:up
yarn workspace backend db:generate
yarn workspace backend db:migrate:deploy
```

### 5) Run the app

```bash
yarn dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

### Optional: tmux Agent CLI runtime

Agent sessions are a backend capability; no Agent Session page is added to the
web application. The backend chooses the CLI from trusted environment
configuration. Clients cannot submit an executable or API key.

Example using Codex with the same `OPENAI_API_KEY` used by the backend:

```env
AGENT_TMUX_ENABLED=true
AGENT_TMUX_BIN=tmux
AGENT_CLI_TYPE=codex
AGENT_CLI_BIN=codex
AGENT_CLI_AUTH_MODE=api_key
AGENT_CLI_ARGS_JSON=[]
AGENT_CLI_BATCH_TIMEOUT_MS=120000
```

The built-in CLI mappings are `codex` → `OPENAI_API_KEY`,
`claude`/`claude-code` → `ANTHROPIC_API_KEY`, and `cursor` → `CURSOR_API_KEY`.
For another CLI, set `AGENT_CLI_API_KEY_ENV` to the name of its API-key
environment variable. Only that key and explicitly allowlisted environment
variables are passed to the managed Agent CLI.

For a CLI already authenticated interactively (for example `codex login`), set
`AGENT_CLI_AUTH_MODE=login`. In this mode the child receives `HOME` and the
minimal safe environment needed to use the CLI's own credential store; an
invalid `OPENAI_API_KEY` is not required for the fallback.

Run a prompt through the configured Agent CLI, following the same daemon-style
flow as Thanos:

```bash
curl -X POST http://localhost:3001/api/agent-sessions \
  -H "Authorization: Bearer <polyglot-jwt>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: <unique-request-id>" \
  -d '{"languageCode":"ja","goal":"Practice a restaurant conversation with me"}'
```

The backend validates the language and optional `lessonId`, persists the
session, starts the configured CLI inside an isolated managed tmux socket, and
returns the session status. Use `GET /api/agent-sessions` to list sessions and
`POST /api/agent-sessions/:id/stop` to stop one.

## What You Can Do

- Create text, subtitle, manga (OCR), manual, and AI-generated lessons
- Watch videos with synchronized subtitles and clickable words
- Mark words with difficulty levels and personal notes
- Translate sentences and generate speech for words/sentences (currently OpenAI
  TTS; local system provider planned)
- Track lesson progress, word history, and learning charts
- Import vocabulary from LingQ

## Common Commands

```bash
# Run both apps
yarn dev

# Build all workspaces
yarn build

# Start backend in production mode
yarn start

# Database
yarn docker:up
yarn docker:down
yarn db:migrate                      # create a new migration during schema work
yarn workspace backend db:migrate:deploy
yarn workspace backend db:generate
yarn db:backup

# Quality
yarn format
yarn format:check
```

## Tech Stack

- Backend: Node.js, Express, TypeScript, Prisma, MySQL
- Frontend: React, TypeScript, Vite, Tailwind, Radix UI
- Infra: Docker Compose, AWS S3
- AI: OpenAI API or configured Agent CLI; TTS provider currently OpenAI

## Project Structure

```text
polyglot-io/
├── backend/            # API, services, Prisma schema + migrations
├── frontend/           # React app
├── scripts/            # utility scripts (including DB backup)
├── docker/             # MySQL init config
├── docker-compose.yml
└── README.md
```

## Troubleshooting (Quick)

- **Cannot connect to DB**: run `yarn docker:up`, then verify `DATABASE_URL` and `SHADOW_DATABASE_URL`.
- **Frontend cannot reach backend**: check `VITE_BACKEND_URL` and ensure backend is running on `3001`.
- **Uploads fail**: verify AWS keys, bucket name, and S3 CORS policy.
- **AI features fail**: verify `OPENAI_API_KEY`.
- **Need a quick server check**: `curl http://localhost:3001/health`

## Additional Docs

- [Backup script docs](scripts/README.md)

## License

MIT. See [LICENSE](LICENSE).
