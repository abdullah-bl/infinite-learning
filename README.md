# Infinite Learning

Type any topic and an AI writes you a short course: lessons, a quiz for each, and four ideas for what to learn next. Every course ends by offering the next one, so there is always something to start.

Each lesson is a chapter in its own flat colour. The interface is in English and Arabic (right to left, with an Arabic typeface); it follows the browser's language and can be switched from the header or Settings. Courses are written in the interface language, whatever script the topic is typed in; Settings can pick another language for them.

## How it works

- **Web:** React 19 with [TanStack Router](https://tanstack.com/router) (file routes in `src/routes`), built by Vite into static files: `index.html` and its assets. It has no database and no AI key, and OneBase serves it, so there is no web server to run.
- **Backend:** [OneBase](https://abdullah-bl.github.io/onebase/), a Convex-style backend in one binary with SQLite. The functions in [`onebase/`](onebase) store courses and call the AI. The browser holds a live connection, so a course fills in on the page as it is written.
- **AI:** the free models on [OpenRouter](https://openrouter.ai). The key stays on the backend. `openrouter/free` is the default, with two fallbacks.
- **A shared library.** Every finished course is kept once. The same request (same topic, language, level and length) is answered from it instantly, with no model call, and similar courses are offered while you type, matched by meaning across languages ([`onebase/library.ts`](onebase/library.ts): OneBase vector search, its action cache for embeddings, full-text search as the fallback). Learners rate courses; a version enough of them find poor stops being handed out, and "write a better version" rewrites it from what was marked ([`onebase/feedback.ts`](onebase/feedback.ts)).
- **A knowledge map per learner.** Lessons name their key ideas; quiz answers and finished lessons say how well each is known ([`onebase/graph.ts`](onebase/graph.ts)). New courses build on known ideas and re-explain shaky ones, and such personal courses are not shared. Every quiz question comes back for review on a Leitner schedule: tomorrow after a wrong answer, then 3, 7, 16 and 35 days ([`onebase/reviews.ts`](onebase/reviews.ts), the review page).
- **The sky.** Every shared course is drawn as a constellation and every key idea as a star, on the home page and the sky page ([`src/components/Sky.tsx`](src/components/Sky.tsx), layout in [`src/lib/sky.ts`](src/lib/sky.ts), data from `graph.atlas`). A learner's own stars are lit, flicker when their answers were wrong, and fade when a review is due. Drag, pinch or zoom to explore; picking a course or idea opens it beside the sky, and any shared course opens at once. Topics no course covers yet sit at the edges, ready to be written. Courses that share ideas are pulled together, and positions are kept per browser so the sky stays put between visits. To look at a full sky locally, run the mock model (`bun tests/mock-openrouter.ts`), a server pointed at it, and `bun tests/seed-sky.ts <url>`.
- **No accounts.** The browser makes up a random key and sends it with every call; it is the only thing that unlocks that person's courses. Settings shows the key so it can be copied to another device. Per-visitor and shared daily limits (in [`onebase/components.ts`](onebase/components.ts)) protect the free quota.

```
src/            the web app (routes, components, styles)
onebase/        the backend: schema, queries, mutations, OpenRouter actions
tests/          backend test against a mock OpenRouter
Dockerfile      builds one executable: backend + web app
fly.toml        the Fly app
```

## Run it

You need [Bun](https://bun.sh) 1.4.4 or later and a free [OpenRouter key](https://openrouter.ai/keys).

```bash
bun install
cp .env.example .env.local   # then put your OPENROUTER_API_KEY in it
bun run dev                  # backend on :8090, web on http://localhost:3000
```

```bash
bun test          # starts a mock OpenRouter and the backend, runs the API end to end
bun run doctor    # OneBase's own check of the schema and functions
bun run typecheck
```

## Deploy to Fly.io

One Fly app, one machine, one executable. The [`Dockerfile`](Dockerfile) builds the web app to static files and compiles them into the OneBase binary together with the functions. OneBase serves the pages (any path that isn't a file gets `index.html`, and the router takes over in the browser), the live connection and the dashboard on one port. SQLite lives on a Fly volume. It uses about 15 MB of memory.

Change the app name in [`fly.toml`](fly.toml) to one nobody has taken, and keep the two URLs in `[env]` in step with it.

```bash
fly apps create infinite-learning
fly volumes create infinite_data -a infinite-learning -r fra -n 1 --size 1
fly secrets set -a infinite-learning OPENROUTER_API_KEY=sk-or-... ONEBASE_ADMIN_KEY=$(openssl rand -hex 24)
fly deploy
```

SQLite allows one writer, so keep exactly one machine; don't scale it out. The dashboard is at `/_admin` and asks for `ONEBASE_ADMIN_KEY`. Add `ONEBASE_BACKUP=s3://...` to keep snapshots off the volume (see the OneBase backups guide).

**Changing the model.** Set `OPENROUTER_MODELS` (up to three ids, comma separated): `fly secrets set -a infinite-learning OPENROUTER_MODELS=openrouter/free,google/gemma-4-31b-it:free`.

**Trying the image locally** (the backend needs a key; add `-e OPENROUTER_API_KEY=...`):

```bash
docker build -t infinite-learning .
docker run --rm -p 8080:8080 -e OPENROUTER_API_KEY=sk-or-... infinite-learning
```

## Design

Colour chapters: full-bleed flat fields (ultramarine, black, yellow, pink) on one grid, one typeface ([Pilcrow Rounded](https://www.fontshare.com/fonts/pilcrow-rounded)), no gradients, shadows or cards. The masthead pictures are public-domain scans from Wikimedia Commons (credited in the footer). The title card in the masthead sets whatever you type.

## Languages

The interface strings are in [`src/lib/i18n.ts`](src/lib/i18n.ts), one table per language. To add a language, add a table there and a button in Settings. The backend sends error codes, not sentences, so every message is worded in the visitor's language by the web app.

## History

The first version ran a small model in the browser with WebLLM and kept courses in local storage. Small local models weren't good enough, so this version moved the writing to hosted free models and the storage to a backend. That code is in the git history.

MIT licence.
