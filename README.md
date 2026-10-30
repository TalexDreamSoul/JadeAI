<div align="center">

# JadeAI

**AI-powered career workspace**

Create and tailor resumes, track applications, prepare for interviews, and manage career progress in one workspace.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/GHCR-Ready-2496ed)](https://github.com/TalexDreamSoul/jadeai/pkgs/container/jadeai-resume)

[中文文档](./README.zh-CN.md)

</div>

---

## Community

Join our groups for discussion and support:

[![Linux.do](https://img.shields.io/badge/Linux.do-Community-blue)](https://linux.do/)


## Recent Updates

### v0.4.2 · Production Readiness & Career Workflow
- Added application tracking, result follow-up, commercial entitlements, Stripe Checkout, and first-party funnel analytics
- Hardened authentication, encrypted stored secrets, durable login rate limiting, and transactional payment/wallet writes
- Added database backups, readiness telemetry, deployment gates, legal pages, and a cloud-backed Electron client
- Expanded the gallery to 58 templates and load template renderers on demand

### v0.3.4 · Brand Color System & Theme Switching
- Introduced semantic `--brand-*` CSS tokens; replaced hardcoded `pink-*` across 60+ files
- New brand switcher in the user menu with three presets: **Mint** (default), **Blue**, **Pink**
- SSR-safe anti-flicker hydration; legacy values auto-migrated via `localStorage`
- Added a Mint resume preset to the theme editor
- Export pipelines (PDF / HTML / DOCX) now read from `src/lib/brand-constants.ts`

### v0.3.3 · Mobile Experience & Interview Report Stability
- Mobile-friendly template preview and bottom action bars for preview/share pages
- Fixed mobile scroll: canvas/preview roots use `h-full` instead of `flex-1`
- Improved stability of interview report generation

### v0.3.2 · Runtime Environment Variables
- Removed all `NEXT_PUBLIC_*` build-time variables in favor of runtime env

### v0.3.1 · Auth Runtime Flag
- Changed `NEXT_PUBLIC_AUTH_ENABLED` to runtime `AUTH_ENABLED`

## Screenshots

| Template Gallery | Resume Editor |
|:---:|:---:|
| ![Template Gallery](images/template-list.png) | ![Resume Editor](images/resume-edit.png) |

| AI Resume Generation | AI Resume Parsing (Image) |
|:---:|:---:|
| ![AI Resume Generation](images/AI%20填充简历.gif) | ![AI Resume Parsing](images/图片简历解析.gif) |

| AI Optimization | Grammar Check |
|:---:|:---:|
| ![AI Optimization](images/ai%20优化.png) | ![Grammar Check](images/AI%20语法检查.png) |

| Grammar Auto-Fix | JD Match Analysis |
|:---:|:---:|
| ![Grammar Auto-Fix](images/AI%20语法检查一键修复.png) | ![JD Match Analysis](images/JD%20匹配分析.png) |

| Multi-Format Export | Share Link |
|:---:|:---:|
| ![Multi-Format Export](images/多项导出.png) | ![Share Link](images/创建分享链接.png) |

| Shared Resume Page | AI Professional Photo |
|:---:|:---:|
| ![Shared Resume Page](images/简历分享页.png) | ![AI Professional Photo](images/职业照生成.png) |

| QR Code Section |
|:---:|
| ![QR Code Section](images/二维码.png) |

| Interview Setup | Mock Interview |
|:---:|:---:|
| ![Interview Setup](images/新建面试.png) | ![Mock Interview](images/模拟面试.png) |

| Interview List | Interview Report |
|:---:|:---:|
| ![Interview List](images/面试列表.png) | ![Interview Report](images/面试报告.png) |

## Deployment Video

Watch the full deployment walkthrough on Bilibili:

[![Deployment Video](https://i0.hdslb.com/bfs/archive/deployment-preview.jpg)](https://www.bilibili.com/video/BV1h7wQzSEYe/)

> [Watch on Bilibili →](https://www.bilibili.com/video/BV1h7wQzSEYe/)

## Features

### Resume Editing

- **Drag & Drop Editor** — Visually arrange and reorder resume sections and items
- **Inline Editing** — Click any field to edit directly on the canvas
- **58 Professional Templates** — Classic, Modern, Minimal, Creative, ATS-Friendly, Timeline, Nordic, Swiss, and more
- **Theme Customization** — Colors, fonts, spacing, and margins with live preview
- **Undo / Redo** — Full edit history (up to 50 steps)
- **Auto Save** — Configurable interval (0.3s–5s), with manual save option
- **Markdown Support** — Use Markdown syntax in text fields to format content (e.g., `**bold**` for **bold text**)

### Markdown Formatting

The following resume sections support Markdown syntax:

| Section | Supported Fields |
|---------|-----------------|
| Summary | Content text |
| Work Experience | Description, Highlights |
| Education | Highlights |
| Projects | Description, Highlights |
| Custom Section | Description |
| Languages | Description |
| GitHub | Description |

**Supported syntax:**

```
**bold text**    → bold
`code text`      → inline code
- item           → bullet list
```

> Skills, Certifications, and Personal Info fields do not support Markdown.

### AI Capabilities

- **AI Chat Assistant** — Conversational AI integrated in the editor, with multi-session support and persistent history
- **AI Resume Generation** — Generate a complete resume from job title, experience, and skills
- **Resume Parsing** — Upload an existing PDF or image, AI extracts all content automatically
- **JD Match Analysis** — Compare resume against a job description: keyword matching, ATS score, and improvement suggestions
- **Cover Letter Generation** — AI-tailored cover letter based on resume and JD, with tone selection (formal / friendly / confident)
- **Grammar & Writing Check** — Detect weak verbs, vague descriptions, and grammar issues; returns a quality score
- **Translation** — Translate resume content across 10 languages while preserving technical terms
- **Flexible AI Provider** — Supports OpenAI, Anthropic, and custom API endpoints; each user configures their own key in-app

### Mock Interview

- **JD-Based Interview Simulation** — Paste a job description, AI plays different interviewer roles in sequence
- **6 Preset Interviewers** — HR, Technical, Scenario, Behavioral, Project Deep Dive, Leader — each with unique personality and questioning style
- **Custom Interviewers** — Create your own interviewer with custom focus areas and style
- **Smart Follow-ups** — AI adapts questions based on answer quality, probing deeper when needed
- **Interview Controls** — Skip questions, request hints, mark for review, pause/resume
- **Detailed Report** — Per-question scoring, competency radar chart, improvement plan with resources
- **History Comparison** — Track score trends and dimension progress across interviews
- **PDF & Markdown Export** — Export interview reports for offline review

### Export & Sharing

- **Multi-Format Export** — PDF (Puppeteer + Chromium), Smart One-Page PDF (auto-fit to single page), DOCX, HTML, TXT, JSON
- **JSON Import** — Import a previously exported JSON file to restore or create a resume; supported both in the editor (overwrite current) and on the dashboard (create new)
- **Link Sharing** — Token-based shareable links with optional password protection
- **View Counter** — Track how many times a shared resume has been viewed

### Management

- **Multi-Resume Dashboard** — Grid and list views, search, sort (by date, name)
- **Import from JSON** — Create a new resume from a JSON export directly on the dashboard
- **Duplicate & Rename** — Quick resume management actions
- **Interactive Tours** — Step-by-step onboarding for first-time users
- **Application Tracker** — Paginated application records, interview stages, outcomes, and follow-up dates
- **Career Workspace** — Resume tailoring, job templates, application status, and interview preparation in one flow

### Commerce & Operations

- **Membership & Entitlements** — Membership tiers, AI credits, points, purchased content, and redemption codes
- **Payments** — Stripe Checkout with signed webhooks; mock payments are restricted to explicit development/test use
- **Operations Console** — Products, orders, users, storage, growth programs, audit history, and funnel metrics

### Other

- **Bilingual UI** — Full Chinese (zh) and English (en) interface
- **Dark Mode** — Light, dark, and system theme support
- **Flexible Auth** — Password login, administrator-managed OIDC providers, or browser fingerprint mode
- **Dual Database** — SQLite (default, zero-config) or PostgreSQL

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| Drag & Drop | @dnd-kit |
| State | Zustand |
| Database | Drizzle ORM (SQLite / PostgreSQL) |
| Auth | NextAuth.js v5 + FingerprintJS |
| AI | Vercel AI SDK v6 + OpenAI / Anthropic |
| PDF | Puppeteer Core + @sparticuz/chromium |
| i18n | next-intl |
| Validation | Zod v4 |

## Getting Started

### Docker (Recommended)

```bash
# Generate independent session and data-encryption keys
export AUTH_SECRET="$(openssl rand -base64 32)"
export DATA_ENCRYPTION_KEY="$(openssl rand -base64 32)"

docker run -d -p 3000:3000 \
  --env AUTH_SECRET \
  --env DATA_ENCRYPTION_KEY \
  -v jadeai-data:/app/data \
  ghcr.io/talexdreamsoul/jadeai-resume:production-latest
```

Open [http://localhost:3000](http://localhost:3000). Database auto-migrates and seeds on first start.

> **`AUTH_SECRET`** encrypts sessions. **`DATA_ENCRYPTION_KEY`** encrypts stored service credentials. Generate and protect them independently.

> **AI Configuration:** You can configure a unified server-side AI provider via `AI_PROVIDER`, `AI_OPENAI_ENDPOINT`, `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`. Users can choose **Unified Config** or enter their own custom key in **Settings > AI**.

<details>
<summary>With PostgreSQL</summary>

```bash
docker run -d -p 3000:3000 \
  --env AUTH_SECRET \
  --env DATA_ENCRYPTION_KEY \
  -e DB_TYPE=postgresql \
  -e DATABASE_URL=postgresql://user:pass@host:5432/jadeai \
  ghcr.io/talexdreamsoul/jadeai-resume:production-latest
```

</details>

<details>
<summary>With account authentication</summary>

```bash
docker run -d -p 3000:3000 \
  -e AUTH_ENABLED=true \
  --env AUTH_SECRET \
  --env DATA_ENCRYPTION_KEY \
  -e AUTH_PASSWORD_ENABLED=true \
  -e AUTH_PASSWORD_REGISTER_ENABLED=true \
  -v jadeai-data:/app/data \
  ghcr.io/talexdreamsoul/jadeai-resume:production-latest
```

</details>

### Local Development

#### Prerequisites

- Node.js 20.9+
- pnpm 10+

#### Installation

```bash
git clone https://github.com/TalexDreamSoul/jadeai.git
cd jadeai

pnpm install
cp .env.example .env.local
```

#### Configure Environment

Edit `.env.local`:

```bash
# Database (defaults to SQLite, no config needed)
DB_TYPE=sqlite

# Auth (defaults to fingerprint mode, no config needed)
AUTH_ENABLED=false
```

> **AI Configuration:** Optionally configure unified server-side AI env vars. Users can choose the unified config or their own API Key, Base URL, and Model in **Settings > AI**.

See `.env.example` for all available options. OIDC providers are configured in the administrator console after the first account is created.

#### Initialize Database & Run

```bash
# Generate and run migrations
pnpm db:generate
pnpm db:migrate

# (Optional) Seed with sample data
pnpm db:seed

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_SECRET` | Yes | — | Random secret of at least 32 characters for session encryption |
| `DATA_ENCRYPTION_KEY` | Production | — | Base64-encoded 32-byte key for encrypting stored service credentials |
| `DB_TYPE` | No | `sqlite` | Database type: `sqlite` or `postgresql` |
| `DATABASE_URL` | When PostgreSQL | — | PostgreSQL connection string |
| `SQLITE_PATH` | No | `./data/touchresume.db` | SQLite database file path |
| `AI_PROVIDER` | No | `openai` | Unified AI provider: `openai`, `anthropic`, or `gemini` |
| `AI_OPENAI_ENDPOINT` | No | `chat` | OpenAI endpoint mode: `chat` or `responses` (only when `AI_PROVIDER=openai`) |
| `AI_API_KEY` | No | — | Unified server-side AI API key. If set, users can use Unified Config. |
| `AI_BASE_URL` | No | Provider default | Unified AI base URL / OpenAI-compatible endpoint |
| `AI_MODEL` | No | Provider default | Unified AI model |
| `IMAGE_AI_API_KEY` | No | — | Unified Gemini image API key for LinkedIn/professional photo generation |
| `IMAGE_AI_BASE_URL` | No | Google Gemini API | Unified image AI base URL |
| `IMAGE_AI_MODEL` | No | `gemini-3.1-flash-image-preview` | Unified image AI model |
| `AUTH_ENABLED` | No | `false` | Enable account authentication (`true`) or use fingerprint mode (`false`) |
| `AUTH_PASSWORD_ENABLED` | No | `true` | Enable password sign-in when account authentication is active |
| `AUTH_PASSWORD_REGISTER_ENABLED` | No | `true` | Allow users to register with email and password |
| `APP_NAME` | No | `JadeAI` | Application display name |
| `DEFAULT_LOCALE` | No | `zh` | Default language: `zh` or `en` |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm dev:desktop` | Start the local Electron development client |
| `pnpm dist:mac` | Build the cloud-backed macOS DMG and update ZIP |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm type-check` | TypeScript type checking |
| `pnpm db:generate` | Generate Drizzle migrations (SQLite) |
| `pnpm db:generate:pg` | Generate Drizzle migrations (PostgreSQL) |
| `pnpm db:migrate` | Execute database migrations |
| `pnpm db:studio` | Open Drizzle Studio (database GUI) |
| `pnpm db:seed` | Seed database with sample data |

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── [locale]/               # i18n routes (/zh/..., /en/...)
│   │   ├── dashboard/          # Resume list & management
│   │   ├── editor/[id]/        # Resume editor
│   │   ├── preview/[id]/       # Full-screen preview
│   │   ├── templates/          # Template gallery
│   │   └── share/[token]/      # Public shared resume viewer
│   └── api/
│       ├── ai/                 # AI endpoints
│       │   ├── chat/           #   Streaming chat with tool calls
│       │   ├── generate-resume/#   AI resume generation
│       │   ├── jd-analysis/    #   JD match analysis
│       │   ├── grammar-check/  #   Grammar & writing check
│       │   ├── cover-letter/   #   Cover letter generation
│       │   ├── translate/      #   Resume translation
│       │   └── models/         #   List available AI models
│       ├── resume/             # Resume CRUD, export, parse, share
│       ├── share/              # Public share access
│       ├── user/               # User profile & settings
│       └── auth/               # NextAuth handlers
├── components/
│   ├── ui/                     # shadcn/ui base components
│   ├── editor/                 # Editor canvas, sections, fields, dialogs
│   ├── ai/                     # AI chat panel & bubble
│   ├── preview/templates/      # 58 resume templates
│   ├── dashboard/              # Dashboard cards, grid, dialogs
│   └── layout/                 # Header, theme provider, locale switcher
├── lib/
│   ├── db/                     # Schema, repositories, migrations, adapters
│   ├── auth/                   # Auth configuration
│   └── ai/                     # AI prompts, tools, model config
├── hooks/                      # Custom React hooks (7 hooks)
├── stores/                     # Zustand stores (resume, editor, settings, UI, tour)
└── types/                      # TypeScript type definitions
```

## Templates

JadeAI includes **58 professionally designed resume templates** covering a wide range of styles and industries:

<details>
<summary>View all 58 templates</summary>

| # | Template | # | Template | # | Template |
|---|----------|---|----------|---|----------|
| 1 | Classic | 18 | Clean | 35 | Material |
| 2 | Modern | 19 | Bold | 36 | Medical |
| 3 | Minimal | 20 | Timeline | 37 | Luxe |
| 4 | Professional | 21 | Nordic | 38 | Retro |
| 5 | Two-Column | 22 | Gradient | 39 | Card |
| 6 | ATS | 23 | Magazine | 40 | Rose |
| 7 | Academic | 24 | Corporate | 41 | Teacher |
| 8 | Creative | 25 | Consultant | 42 | Coder |
| 9 | Elegant | 26 | Swiss | 43 | Zigzag |
| 10 | Executive | 27 | Metro | 44 | Neon |
| 11 | Developer | 28 | Architect | 45 | Scientist |
| 12 | Designer | 29 | Japanese | 46 | Blocks |
| 13 | Startup | 30 | Artistic | 47 | Ribbon |
| 14 | Formal | 31 | Sidebar | 48 | Engineer |
| 15 | Infographic | 32 | Finance | 49 | Watercolor |
| 16 | Compact | 33 | Berlin | 50 | Mosaic |
| 17 | Euro | 34 | Legal | | |
| 51 | Touch Pure | 52 | Touch Simple | 53 | Touch Flat |
| 54 | Touch Line | 55 | Touch Compact | 56 | Touch Card |
| 57 | Touch Grid | 58 | Touch Focus | | |

</details>

## API Reference

<details>
<summary>View all API endpoints</summary>

### Resume

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/resume` | List all resumes for current user |
| `POST` | `/api/resume` | Create a new resume |
| `GET` | `/api/resume/[id]` | Get resume detail with all sections |
| `PUT` | `/api/resume/[id]` | Update resume metadata or sections |
| `DELETE` | `/api/resume/[id]` | Delete a resume |
| `POST` | `/api/resume/[id]/duplicate` | Duplicate a resume |
| `GET` | `/api/resume/[id]/export` | Export resume (pdf, docx, html, txt, json) |
| `POST` | `/api/resume/parse` | Parse resume from PDF or image upload |
| `POST` | `/api/resume/[id]/share` | Create share link |
| `GET` | `/api/resume/[id]/share` | Get share settings |
| `DELETE` | `/api/resume/[id]/share` | Remove share link |

### Share

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/share/[token]` | Access a publicly shared resume |

### AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/chat` | Stream chat messages with resume context |
| `GET` | `/api/ai/chat/sessions` | List chat sessions for a resume |
| `POST` | `/api/ai/chat/sessions` | Create a new chat session |
| `GET` | `/api/ai/chat/sessions/[id]` | Get paginated messages for a session |
| `DELETE` | `/api/ai/chat/sessions/[id]` | Delete a chat session |
| `POST` | `/api/ai/generate-resume` | Generate resume from job title & experience |
| `POST` | `/api/ai/jd-analysis` | Analyze resume against a job description |
| `POST` | `/api/ai/grammar-check` | Check grammar and writing quality |
| `POST` | `/api/ai/cover-letter` | Generate a tailored cover letter |
| `POST` | `/api/ai/translate` | Translate resume content |
| `GET` | `/api/ai/models` | List available AI models |

### User

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/user` | Get current user profile |
| `PUT` | `/api/user` | Update user profile |
| `GET` | `/api/user/settings` | Get user settings |
| `PUT` | `/api/user/settings` | Update user settings |

</details>

## Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

## FAQ

<details>
<summary><b>How does AI configuration work?</b></summary>

JadeAI supports two modes. Admins can configure a unified server-side AI provider with `AI_PROVIDER`, `AI_OPENAI_ENDPOINT`, `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`; users may select **Unified Config** in **Settings > AI** without entering a personal key. Users can also select **Custom Config** and provide their own provider, API key, base URL, and model. Personal API keys are stored locally in the browser and are not persisted to the app database.

</details>

<details>
<summary><b>Can I switch between SQLite and PostgreSQL?</b></summary>

Yes. Set the `DB_TYPE` environment variable to `sqlite` or `postgresql`. SQLite is the default and requires zero configuration. For PostgreSQL, also set `DATABASE_URL`. Note that data is not automatically migrated between database types.

</details>

<details>
<summary><b>How does authentication work without OAuth?</b></summary>

When `AUTH_ENABLED=false` (default), JadeAI uses browser fingerprinting via FingerprintJS. A unique fingerprint ID is generated for each browser and used as the user identifier. When authentication is enabled, password login and administrator-managed OIDC providers are available.

</details>

<details>
<summary><b>How is PDF export implemented?</b></summary>

PDF export uses Puppeteer Core with @sparticuz/chromium. Each template has a dedicated server-side export handler that renders the resume to high-fidelity PDF. DOCX, HTML, TXT, and JSON exports are also supported.

</details>

## Star History

<a href="https://www.star-history.com/?repos=TalexDreamSoul%2Fjadeai&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=TalexDreamSoul/jadeai&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=TalexDreamSoul/jadeai&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=TalexDreamSoul/jadeai&type=date&legend=top-left" />
 </picture>
</a>

## License

[Apache License 2.0](LICENSE)
