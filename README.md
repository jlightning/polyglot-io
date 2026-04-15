# Polyglot.io

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Polyglot.io is a full-stack language learning app for learning through lessons, videos with synced subtitles, and vocabulary tracking.

> Inspired by [LingQ](https://www.lingq.com/) and [Steve Kaufmann](https://www.thelinguist.com/).

## Getting Started

### 1) Prerequisites

- Node.js `>=18`
- Yarn `>=1.22`
- Docker + Docker Compose (for MySQL)
- OpenAI API key (translations, AI lesson generation, TTS)
- AWS S3 credentials (file uploads)

### 2) Install dependencies

```bash
yarn install
```

### 3) Configure environment variables

```bash
cp backend/env.example backend/.env
cp frontend/env.example frontend/.env
```

Update `backend/.env` with your credentials and keep these values:

```env
DATABASE_URL="mysql://polyglotio_user:polyglotio_password@localhost:3307/polyglotio"
SHADOW_DATABASE_URL="mysql://polyglotio_user:polyglotio_password@localhost:3307/polyglotio_shadow"
PORT=3001
CORS_ORIGIN=http://localhost:5173
OPENAI_API_KEY=your-openai-api-key
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=your-bucket
```

`frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:3001
```

### 4) Start database and run migrations

```bash
yarn docker:up
yarn workspace backend db:generate
yarn db:migrate
```

### 5) Run the app

```bash
yarn dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## What You Can Do

- Create text, subtitle, manga (OCR), manual, and AI-generated lessons
- Watch videos with synchronized subtitles and clickable words
- Mark words with difficulty levels and personal notes
- Translate sentences and generate speech for words/sentences (OpenAI TTS)
- Track lesson progress and vocabulary growth over time
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
yarn db:migrate
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

## Additional Docs

- [Backup script docs](scripts/README.md)

## License

MIT. See [LICENSE](LICENSE).
