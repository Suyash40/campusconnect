# CampusConnect.ai

*Your very own campus buddy.* A campus opportunity platform for a B.Tech CSE (AI & ML) major project. Coordinators paste an existing WhatsApp/email message and the AI drafts a structured announcement. Students get personalised, explained recommendations, register for events, track applications, and ask CampusBot questions answered from published records.

## Architecture

```
client/       React + TypeScript + Vite + Tailwind (PWA: manifest, service worker, offline page)
server/       Node.js + Express + TypeScript + Mongoose (auth, RBAC, REST API, registrations, notifications)
ai-service/   Python FastAPI (announcement extraction, CampusBot answer generation)
```

- The browser talks only to `server/` (`/api/*`). The AI service is internal and called only by the API, with a shared bearer token.
- Every authorization decision is enforced in `server/`, not in the frontend.
- The AI service has a deterministic rule-based extractor. An optional OpenAI-compatible LLM is used when `LLM_BASE_URL` and `LLM_API_KEY` are set. LLM output is checked against the source text, and invented links or organizers are dropped.

## Quick start (local, no Docker)

Requirements: Node 22+, Python 3.12+, MongoDB 7 (local or Atlas).

```bash
# 1. Backend API
cd server
cp ../.env.example .env        # then edit JWT_SECRET, ADMIN_SEED_*, MONGO_URI
npm install
npm run seed                   # demo data (see Demo accounts)
npm run dev                    # http://localhost:4000

# 2. AI service
cd ../ai-service
cp .env.example .env           # SERVICE_TOKEN must equal AI_SERVICE_TOKEN in server/.env
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --port 8000

# 3. Frontend
cd ../client
npm install
npm run dev                    # http://localhost:5173 (proxies /api to :4000)
```

With Docker: `docker compose up --build` starts MongoDB, the API and the AI service. Run the frontend with `npm run dev` in `client/`.

## Environment variables

All secrets come from environment variables. See `.env.example` for the full list.

| Variable | Service | Purpose |
|---|---|---|
| `MONGO_URI` | server | MongoDB connection string |
| `JWT_SECRET` | server | Signs session tokens (16+ chars) |
| `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` | server | Location and shared secret of the AI service |
| `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` | server | Creates the first admin once, if none exists |
| `SERVICE_TOKEN` | ai-service | Must match `AI_SERVICE_TOKEN` |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | ai-service | Optional LLM provider. Empty = rule-based only |
| `VITE_API_URL` | client | Deployed API base URL (empty in dev) |

## Demo accounts

Created by `npm run seed` (all use password `Demo@12345`):

| Role | Email |
|---|---|
| Student (CSE, AI & ML, year 3) | `student@demo.campusconnect.test` |
| Student (ECE, year 2, not eligible for CSE-only events) | `student2@demo.campusconnect.test` |
| Coordinator (Coding Club, AI & ML Society) | `coordinator@demo.campusconnect.test` |
| Admin | `admin@demo.campusconnect.test` |

Demo records are labelled `(Demo)` or `DEMO:` so they can be removed.

## Roles and permissions

| Capability | Student | Coordinator | Admin |
|---|:-:|:-:|:-:|
| Browse, save, register, recommendations | ✔ | | |
| Application tracker (own) | ✔ | | ✔ |
| Create / edit / publish / archive announcements for own clubs | | ✔ | ✔ (any club) |
| AI extraction | | ✔ | ✔ |
| Attendee lists for own clubs | | ✔ | ✔ |
| Verified application updates | | | ✔ |
| Users, role changes, clubs, moderation, audit log | | | ✔ |

Public registration only creates students. Coordinator and admin roles are assigned by an admin through `PATCH /api/admin/users/:id/role`, which is audited. An admin cannot remove their own admin role.

## Announcement workflow

1. Coordinator pastes a message and clicks **Analyse with AI**.
2. The AI service returns drafts. Missing fields are listed as `missingFields`. Uncertain ones (assumed year, numeric dates, ambiguous category) are listed as `uncertainFields`. Nothing is invented.
3. Multi-opportunity messages are split. The coordinator picks one draft at a time.
4. The coordinator edits and **saves the draft** (`POST`/`PATCH /api/announcements`). Warnings are computed on the server: missing deadline or date, invalid URL, contradictory dates, incomplete eligibility, potential duplicate.
5. **Publish** requires `confirm: true` and no blocking errors (a date and valid http(s) links). Publishing notifies eligible students and followers of the club.
6. Archiving with a reason notifies registered students.

## Recommendation engine

Implemented in `server/src/services/recommender.ts`. It is a transparent weighted heuristic. **No machine-learning model is trained.**

Hard filters, applied before scoring: published, not expired, mandatory branch/year eligibility, not marked "not relevant".

Score (each part in [0, 1]):

| Component | Weight | Signal |
|---|---:|---|
| Interest match | 0.30 | Student interests found in title, description, tags, category |
| Skill similarity | 0.20 | Overlap with required skills (0.5 if none required) |
| Category preference | 0.15 | Category in the student's preferred categories |
| Recency | 0.10 | `exp(-ageDays / 30)` since publication |
| Deadline relevance | 0.15 | Closer registration deadline within 14 days scores higher |
| Club follow | 0.10 | Organizer club is followed |

"More like this" adds +0.10. With no profile data, ranking falls back to recency and deadline, and the explanation says so. Each result includes human-readable reasons.

Unit tests: `server/src/services/recommender.test.ts`.

## API overview

All responses use `{ "data": ..., "meta"?: ... }` on success and `{ "error": { "message", "details"? } }` on failure. List endpoints accept `page` and `limit`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Profile | `GET /api/users/me`, `PATCH /api/users/me` |
| Clubs | `GET /api/clubs`, `GET /api/clubs/managed`, `POST /api/clubs` (admin), `POST /api/clubs/:id/follow`, `POST /api/clubs/:id/unfollow` |
| Opportunities | `GET /api/opportunities` (filters: `q`, `category`, `branch`, `year`, `mode`, `status`, `sort`, `from`, `to`), `GET /api/opportunities/:id`, `POST`/`DELETE /api/opportunities/:id/register`, `POST`/`DELETE /api/opportunities/:id/save` |
| Recommendations | `GET /api/recommendations`, `POST /api/recommendations/feedback` |
| Student lists | `GET /api/registrations/mine`, `GET /api/saved`, `GET`/`POST /api/applications`, `PATCH`/`DELETE /api/applications/:id`, `PATCH /api/applications/:id/verify` (admin) |
| Notifications | `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` |
| Dashboards | `GET /api/dashboard/student`, `GET /api/coordinator/dashboard`, `GET /api/admin/analytics` |
| Coordinator | `GET /api/announcements`, `POST /api/announcements`, `GET`/`PATCH /api/announcements/:id`, `POST /api/announcements/:id/publish`, `POST /api/announcements/:id/archive`, `POST /api/announcements/ai/extract`, `GET /api/coordinator/events`, `GET /api/coordinator/events/:id/attendees` |
| Admin | `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`, `GET /api/admin/moderation`, `GET /api/admin/audit`, `POST /api/admin/reminders/run` |
| CampusBot | `POST /api/assistant` |

AI service: `POST /v1/extract` (`{text}` → `{provider, announcements[], splitSuggested, notes[]}`), `POST /v1/assistant` (`{question, records[]}` → `{answer, provider}`), `GET /health`. Interactive docs at `http://localhost:8000/docs`.

CampusBot retrieves from MongoDB first. It parses known phrases ("open for registration", "tomorrow", "this week", "third-year", category words) into a query, then removes records the student is not eligible for. The AI service only phrases an answer from the retrieved records. If the AI service is down, a plain summary is returned.

## Notifications and reminders

- In-app notifications: new matching publications, club updates, registration confirmations, changed event times, cancellations.
- Deadline reminders: a sweep every `REMINDER_INTERVAL_MINUTES` notifies students who registered or saved an opportunity whose deadline is within 24 hours. A unique `dedupeKey` index means each reminder is sent once.
- Email and web push are not implemented. The settings page labels email as requiring a configured mail service.

## Security notes

- Passwords: bcrypt (cost 12). Login errors do not reveal whether an email exists.
- Authorization: `requireAuth` reloads the user on every request, so role changes take effect immediately. `requireRole` and per-resource ownership checks (club membership) run on the server.
- Validation: Zod on every request body and query. URLs must be http(s).
- Rate limiting on the whole API, on auth, and on AI extraction.
- Helmet, restricted CORS, JSON body size limit, safe error messages (stack traces and AI-service details are never returned).
- Pasted messages are untrusted. They are sent to the AI service as quoted data, the LLM prompt tells the model to ignore instructions inside them, and output is verified against the source text.
- Service worker caches only the app shell and static assets. `/api/*` requests and anything with an `Authorization` header bypass the cache.
- Known limitation: the session token is kept in `localStorage`. Production should move it to an httpOnly, secure, SameSite cookie.

## Testing

```bash
cd server && npm test            # unit tests: recommender, eligibility, announcement rules
                                 # integration tests run only when MONGO_URI is set
cd ai-service && .venv/bin/python -m pytest -q   # extractor, verification, API tests
cd client && npm run build       # typecheck + production build
```

Integration tests (`server/src/routes/integration.test.ts`) cover role enforcement, publish gating, eligibility blocking, duplicate-registration prevention, and draft visibility. They need a MongoDB instance:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/campusconnect_test npm test
```

## Deployment

- **Frontend (Vercel or similar):** build command `npm run build`, output `client/dist`. Set `VITE_API_URL` to the API's public URL. Add the frontend origin to `CORS_ORIGIN`.
- **API (Render, Railway, Fly.io or similar):** build from `server/Dockerfile`. Set all server variables. Use a managed MongoDB (Atlas) for `MONGO_URI`.
- **AI service:** build from `ai-service/Dockerfile`. Reachable only from the API, not publicly. Set `SERVICE_TOKEN`.
- Run `npm run seed` only against a non-production database.

## Limitations

- The rule-based extractor is intentionally conservative. It handles common phrasing well but will miss unusual layouts. Coordinators must review every draft, and the UI highlights what needs checking.
- Recommendations are heuristic. There is no training data or model.
- Email and web push notifications are not implemented.
- Frontend UI uses hand-written Tailwind components instead of the shadcn/ui CLI, to keep dependencies small.
- The `client` bundle is about 900 kB minified because of Recharts. Route-level code splitting would reduce this.
