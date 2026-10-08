# Polyglot.io

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Polyglot.io is a full-stack language learning app focused on lessons, synchronized subtitle reading, and vocabulary retention.

> Inspired by [LingQ](https://www.lingq.com/) and [Steve Kaufmann](https://www.thelinguist.com/).

## Getting Started

### 1) Prerequisites

- Node.js `>=18`
- Yarn `>=1.22`
- Docker + Docker Compose (for MySQL)
- OpenAI API key (required for translations, lesson generation, and TTS)
- AWS S3 credentials (required for uploads and file-based lessons)

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

In `backend/.env`, set your OpenAI API key:

```env
OPENAI_API_KEY=your-openai-api-key
```

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

## What You Can Do

- Create text, subtitle, manga (OCR), manual, and AI-generated lessons
- Read a lesson as text, as video with synchronized subtitles, or as manga pages
- Click a word for its gloss, pronunciation, and your mark
- Mark words from ignore through known, with notes and an action history
- Show a sentence translation, and play speech for a word or sentence
- Set a daily score target and review progress on charts
- Import vocabulary from LingQ
- Use the site in English, Vietnamese, or Chinese, separately from the language you are studying
- Connect Claude Desktop or Cursor over MCP to create lessons, add or delete sentences, mark words, and list lessons, sentences, and words

## Languages

Study languages are Japanese, Korean, English, Chinese, and Vietnamese.

The site interface is English, Vietnamese (`vi`), or Chinese (`zh`). That setting is stored on the account with no study language. The login page keeps the last choice in the browser.

Word and sentence translations use the site language. If it is missing, or it is the same language you are studying, the translation is English. Splitting a lesson saves each word gloss in that same language. Opening a word that has no gloss yet generates one and saves it.

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
- AI: OpenAI API

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
