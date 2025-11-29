# Polyglot.io

A full-stack language learning platform that helps users learn languages through interactive lessons, video content with synchronized subtitles, and comprehensive vocabulary tracking.

## Features

### Lesson Management

Create and manage lessons in three different formats, each optimized for different learning styles:

- **Text Lessons**: Plain text lessons for reading practice. Upload `.txt` files that are automatically parsed into sentences. Perfect for articles, stories, or any written content.
- **Subtitle Lessons**: Video-based lessons with synchronized subtitles. Upload `.srt` subtitle files that are automatically parsed with timestamps. Sentences are linked to specific time ranges in videos, enabling synchronized playback.
- **Manga Lessons**: Image-based lessons with OCR (Optical Character Recognition) processing. Upload manga pages as images, and the system extracts text using OCR technology. Perfect for learning from visual content like comics or manga.

All lesson types support:

- Multiple languages per lesson
- Associated images and audio files
- Automatic sentence extraction and word segmentation
- Processing status tracking (pending, completed, failed)

### Video Watching with Synchronized Subtitles

An immersive video learning experience with real-time subtitle synchronization:

- **Real-time Subtitle Display**: Subtitles automatically appear and update based on video playback time, perfectly synchronized with the audio
- **Interactive Word Clicking**: Click any word in the subtitle overlay to instantly view its translation, pronunciation, and related information
- **Video Controls**: Full video player controls including play/pause, seek bar, and time display. Keyboard shortcuts supported (Spacebar for play/pause)
- **Sentence Context**: View previous and next sentences in a sidebar, providing context for the current sentence
- **Progress Restoration**: Automatically resume video playback from your last watched position when returning to a lesson
- **Subtitle Toggle**: Show or hide subtitles with a single click
- **Drag & Drop Support**: Easily load video files by dragging and dropping them into the player

### Interactive Word Marking

Mark and track vocabulary words while watching videos or reading lessons:

- **Click-to-Mark**: Simply click any word in a sentence to open the word sidebar and mark it
- **Real-time Marking**: Mark words without interrupting your learning flow - the video pauses automatically when you click a word
- **Visual Feedback**: Words are color-coded based on your difficulty rating, making it easy to identify which words need more practice
- **Context-Aware**: Word marks are associated with the specific lesson and sentence where you encountered them

### Vocabulary Tracking System

A comprehensive vocabulary tracking system with a detailed difficulty scale:

- **6-Level Difficulty Scale**:
  - **0 (Ignore)**: Words you want to ignore or skip
  - **1 (Don't Remember)**: Words you don't remember at all
  - **2 (Hard to Remember)**: Words that are difficult to recall
  - **3 (Remembered)**: Words you can remember with effort
  - **4 (Easy to Remember)**: Words you remember easily
  - **5 (No Problem)**: Words you know perfectly

- **Personal Notes**: Add custom notes to any word for additional context, mnemonics, or reminders
- **Source Tracking**: Track where you learned each word (lesson, import, or LingQ)
- **Cross-Lesson Tracking**: Your vocabulary marks persist across all lessons, so you can see your progress over time
- **Word Statistics**: View statistics about your vocabulary, including total words marked, difficulty distribution, and progress over time

### Word Translation Sidebar

A comprehensive word information panel that appears when you click any word:

- **Translations**: View all available translations for the word in your target language
- **Pronunciations**: See multiple pronunciation formats (e.g., hiragana, romanji, IPA) when available
- **Word Stems**: View related word stems and variations
- **Your Mark**: See and update your difficulty rating for the word directly in the sidebar
- **Personal Notes**: View and edit your personal notes for the word
- **Quick Actions**: Quickly mark the word with any difficulty level using color-coded buttons
- **Word History**: See when you last marked the word and track your progress over time

### Sentence Translations

Get instant translations for entire sentences:

- **On-Demand Translation**: Click a button to fetch and display the translation of any sentence
- **Toggle Display**: Show or hide translations with a single click
- **Context Preservation**: Translations appear inline with the original sentence, maintaining reading flow
- **AI-Powered**: Uses OpenAI API for high-quality, context-aware translations

### User Progress Tracking

Detailed progress tracking that helps you pick up exactly where you left off:

- **Sentence-by-Sentence Tracking**: Progress is tracked at the individual sentence level, not just lesson completion
- **Automatic Resume**: When you return to a lesson, the system automatically identifies where you left off
- **Video Position Sync**: For video lessons, playback automatically resumes from the timestamp of your last sentence
- **Progress Status**: Track whether you're currently reading a lesson or have finished it
- **Visual Indicators**: See your progress visually with indicators showing which sentences you've read

### File Uploads and Storage

Upload and manage various file types for your lessons:

- **Supported File Types**:
  - **Images**: JPEG, PNG, GIF, WebP, SVG (max 10MB) - for lesson covers and manga pages
  - **Text Files**: TXT files (max 5MB) - for text lessons
  - **Subtitle Files**: SRT files (max 5MB) - for subtitle lessons with timestamps
  - **Audio Files**: MP3, OGG, AAC (max 50MB) - for audio accompaniment

- **AWS S3 Integration**: All files are securely stored in AWS S3 with presigned URLs for secure access
- **Automatic Processing**: Files are automatically processed upon upload (text extraction, OCR, subtitle parsing)

### Vocabulary Imports

Import your existing vocabulary from external sources:

- **LingQ Integration**: Import your vocabulary directly from LingQ, including word marks and notes
- **Batch Import**: Import hundreds of words at once with progress tracking
- **Source Attribution**: Imported words are tagged with their source (LingQ, manual import, etc.)
- **Validation**: Validate API keys before importing to ensure successful imports
- **Language Support**: Import words for any language supported by the source platform

### User Action Logging

Comprehensive logging of user interactions for analytics and learning insights:

- **Action Types**:
  - **Word Marks**: Logs when you mark words, including old and new difficulty ratings
  - **Reading Actions**: Logs when you read words in sentences, tracking your reading patterns

- **Analytics Data**: Track reading frequency, word encounter patterns, and learning progress
- **Language-Specific**: All actions are tagged with language codes for multi-language learning
- **Sentence Context**: Reading actions include sentence context for better analytics

### Sentence Reconstruction

Interactive sentence display that makes vocabulary learning engaging:

- **Clickable Words**: Every word in a sentence is clickable, making it easy to look up translations
- **Visual Marking**: Words are color-coded based on your difficulty rating, providing instant visual feedback
- **Word Segmentation**: Sentences are automatically split into individual words for precise interaction
- **Fallback Support**: If word segmentation fails, the original sentence text is displayed
- **Context Preservation**: Maintains sentence structure and spacing while enabling word-level interaction

## Tech Stack

### Backend

- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: MySQL 8.0 with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: AWS S3
- **AI Integration**: OpenAI API for translations and processing
- **Image Processing**: Sharp
- **Subtitle Processing**: subsrt-ts

### Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Routing**: React Router DOM
- **HTTP Client**: Axios

### Infrastructure

- **Containerization**: Docker & Docker Compose
- **Database**: MySQL 8.0 (containerized)
- **Package Management**: Yarn workspaces (monorepo)

### Development Tools

- **Code Quality**: Prettier, ESLint
- **Git Hooks**: Husky
- **Commit Linting**: Commitlint (Conventional Commits)
- **Task Runner**: Concurrently

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0
- **Yarn** >= 1.22.0
- **Docker** and **Docker Compose** (for database)
- **AWS Account** (for S3 file storage)
- **OpenAI API Key** (for translation and processing features)

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd polyglot-io
```

### 2. Install Dependencies

```bash
yarn install
```

This will install dependencies for both the backend and frontend workspaces.

### 3. Environment Configuration

#### Backend Environment Variables

Copy the example environment file and configure it:

```bash
cp backend/env.example backend/.env
```

Edit `backend/.env` with your configuration:

```env
# Database
DATABASE_URL="mysql://polyglotio_user:polyglotio_password@localhost:3307/polyglotio"
SHADOW_DATABASE_URL="mysql://polyglotio_user:polyglotio_password@localhost:3307/polyglotio_shadow"

# Server
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_S3_BUCKET_NAME=your-s3-bucket-name

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
```

#### Frontend Environment Variables

Copy the example environment file and configure it:

```bash
cp frontend/env.example frontend/.env
```

Edit `frontend/.env`:

```env
# Backend API URL
VITE_BACKEND_URL=http://localhost:3001
```

### 4. Database Setup

Start the MySQL database using Docker Compose:

```bash
yarn docker:up
```

This will start a MySQL 8.0 container on port 3307 with the following default credentials:

- Database: `polyglotio`
- User: `polyglotio_user`
- Password: `polyglotio_password`

### 5. Database Migrations

Generate Prisma client and run migrations:

```bash
# Generate Prisma client
yarn workspace backend db:generate

# Run migrations
yarn db:migrate
```

## Running the Project

### Development Mode

Run both backend and frontend concurrently:

```bash
yarn dev
```

This will start:

- Backend server on `http://localhost:3001`
- Frontend development server on `http://localhost:5173`

### Production Build

Build both backend and frontend:

```bash
yarn build
```

Start the production server:

```bash
yarn start
```

### Docker Commands

```bash
# Start database container
yarn docker:up

# Stop database container
yarn docker:down
```

### Database Operations

```bash
# Create a new migration
yarn workspace backend db:migrate

# Deploy migrations (production)
yarn workspace backend db:migrate:deploy

# Generate Prisma client
yarn workspace backend db:generate

# Backup database
yarn db:backup
```

## Project Structure

```
polyglot-io/
├── backend/                 # Express.js backend
│   ├── prisma/             # Prisma schema and migrations
│   │   ├── schema.prisma   # Database schema
│   │   └── migrations/     # Database migration files
│   ├── src/
│   │   ├── index.ts        # Application entry point
│   │   ├── middleware/     # Express middleware (auth, etc.)
│   │   ├── routes/         # API route handlers
│   │   └── services/       # Business logic services
│   ├── env.example         # Backend environment template
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── App.tsx         # Main application component
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts (Auth, Language, WordMark)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   └── constants/      # Application constants
│   ├── env.example         # Frontend environment template
│   └── package.json
├── scripts/                # Utility scripts
│   ├── backup-database.js  # Database backup script
│   └── README.md           # Scripts documentation
├── docker/                 # Docker configuration
│   └── init.sql            # Database initialization script
├── docker-compose.yml      # Docker Compose configuration
├── package.json            # Root package.json (workspace config)
└── README.md               # This file
```

## Available Scripts

### Root Level Scripts

```bash
# Development
yarn dev                    # Run backend and frontend concurrently

# Build
yarn build                  # Build both backend and frontend

# Start
yarn start                  # Start production backend server

# Docker
yarn docker:up              # Start Docker containers
yarn docker:down            # Stop Docker containers

# Database
yarn db:migrate             # Create new migration
yarn db:backup              # Backup database

# Code Quality
yarn format                 # Format code with Prettier
yarn format:check          # Check code formatting
yarn commitlint:check       # Check commit messages
```

### Backend Scripts

```bash
yarn workspace backend dev              # Start development server with hot reload
yarn workspace backend build            # Build TypeScript to JavaScript
yarn workspace backend start            # Start production server
yarn workspace backend db:generate      # Generate Prisma client
yarn workspace backend db:migrate       # Create new migration
yarn workspace backend db:migrate:deploy # Deploy migrations (production)
yarn workspace backend type-check       # Type check without building
```

### Frontend Scripts

```bash
yarn workspace frontend dev      # Start Vite development server
yarn workspace frontend build    # Build for production
yarn workspace frontend preview   # Preview production build
yarn workspace frontend type-check # Type check without building
```

## Database

### Prisma Schema Overview

The application uses Prisma ORM with MySQL. Key models include:

- **User**: User accounts and authentication
- **Lesson**: Learning lessons (text, subtitle, manga types)
- **Sentence**: Individual sentences within lessons
- **Word**: Vocabulary words with translations and pronunciations
- **WordUserMark**: User's vocabulary tracking (difficulty marks)
- **UserLessonProgress**: Track user progress through lessons
- **UserActionLog**: Log user interactions for analytics

### Migration Commands

```bash
# Create a new migration
yarn workspace backend db:migrate

# Apply migrations in production
yarn workspace backend db:migrate:deploy

# Generate Prisma client after schema changes
yarn workspace backend db:generate
```

### Backup and Restore

#### Creating a Backup

```bash
yarn db:backup
```

Backups are stored in the `backups/` directory with timestamps.

#### Restoring from Backup

```bash
# Using docker exec
docker exec -i polyglotio-mysql mysql -u polyglotio_user -ppolyglotio_password polyglotio < backups/polyglotio_backup_YYYY-MM-DD_HH-MM-SS.sql

# Or using local mysql client
mysql -h localhost -P 3307 -u polyglotio_user -ppolyglotio_password polyglotio < backups/polyglotio_backup_YYYY-MM-DD_HH-MM-SS.sql
```

For more details, see [scripts/README.md](scripts/README.md).

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Lessons

- `GET /api/lessons` - Get all lessons
- `POST /api/lessons` - Create a new lesson
- `GET /api/lessons/:id` - Get lesson details
- `GET /api/lessons/:id/sentences` - Get lesson sentences (paginated)
- `POST /api/lessons/:id/progress/sentence` - Update lesson progress
- `GET /api/lessons/:id/progress` - Get user progress for lesson

### Words

- `GET /api/words` - Get words with filters
- `GET /api/words/:id` - Get word details
- `POST /api/words/mark` - Mark a word with difficulty
- `GET /api/words/marks` - Get user's word marks

### File Upload

- `POST /api/s3/upload-file` - Get presigned URL for file upload

### Import

- `POST /api/import/lingq` - Import words from LingQ
- `POST /api/import/lingq/validate` - Validate LingQ API key

### User Statistics

- `GET /api/user-score/getUserStats` - Get user statistics
- `GET /api/user-score/getUserScoreHistory` - Get score history

### Configuration

- `GET /api/config/languages` - Get enabled languages

## Development Guidelines

### Commit Message Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commit messages must follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Changes to build process or auxiliary tools
- `ci`: Changes to CI configuration
- `build`: Changes to build system or dependencies
- `revert`: Reverts a previous commit

**Example:**

```
feat(lessons): add video subtitle synchronization

Implement real-time subtitle display synchronized with video playback.
Add word click functionality to open translation sidebar.

Closes #123
```

### Code Formatting

The project uses Prettier for code formatting. Format code before committing:

```bash
yarn format
```

Prettier will automatically format code on commit via Husky hooks.

### Type Checking

Run type checking without building:

```bash
# Backend
yarn workspace backend type-check

# Frontend
yarn workspace frontend type-check
```

## Troubleshooting

### Database Connection Issues

**Problem**: Cannot connect to database

**Solutions**:

1. Ensure Docker is running: `docker ps`
2. Check if MySQL container is running: `yarn docker:up`
3. Verify database credentials in `backend/.env`
4. Check database port (default: 3307)

### S3 Upload Issues

**Problem**: File uploads fail

**Solutions**:

1. Verify AWS credentials in `backend/.env`
2. Check S3 bucket name and region
3. Ensure IAM user has proper S3 permissions
4. Check CORS configuration on S3 bucket

### Frontend Cannot Connect to Backend

**Problem**: Frontend shows connection errors

**Solutions**:

1. Verify `VITE_BACKEND_URL` in `frontend/.env`
2. Ensure backend server is running on the correct port
3. Check CORS configuration in `backend/.env`
4. Verify backend server is accessible: `curl http://localhost:3001/health`

### Video Playback Issues (macOS)

**Problem**: Video files won't play in browser

**Solutions**:

1. Move video file to Downloads or Desktop folder
2. Grant Chrome file access: System Preferences → Security & Privacy → Files and Folders
3. Convert MKV files with HEVC/H.265 codec to MP4 with H.264 codec
4. Try a different browser (Safari may have better file access on macOS)

### Migration Issues

**Problem**: Migrations fail

**Solutions**:

1. Ensure database is running: `yarn docker:up`
2. Check `DATABASE_URL` and `SHADOW_DATABASE_URL` in `backend/.env`
3. Verify Prisma client is generated: `yarn workspace backend db:generate`
4. Check migration files for syntax errors

## Additional Resources

- [Database Backup Scripts Documentation](scripts/README.md)
- [Prisma Documentation](https://www.prisma.io/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

## License

[Add your license information here]

## Contributing

[Add contributing guidelines here]
