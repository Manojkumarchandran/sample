# NexTask AI

NexTask AI is a Next.js workspace dashboard with a FastAPI backend. The frontend includes a sample-project mode, and workspace routes require a Supabase-authenticated user in both sample and live modes.

## Run the sample dashboard

From PowerShell, open two terminals or run the frontend in one terminal:

```powershell
cd frontend
npm install
npm run dev
```

Configure the Supabase URL and anon key below, then open [http://localhost:3000](http://localhost:3000) and sign in with GitHub. Set `NEXT_PUBLIC_DEMO_MODE=true` to use sample projects, which are stored in your browser's local storage. The local settings file is ignored by Git.

## Connect Supabase

1. Create a Supabase project and configure GitHub OAuth under **Authentication → Providers**.
2. Run `supabase/migrations/0001_core.sql`, then migrations `0002` through `0006` in order in the Supabase SQL editor. Existing projects should run only migrations they have not applied yet. Migration 0005 enables project developers and task assignment by account; migration 0006 stores task subtasks.
3. In `frontend/.env.local`, set:

   ```env
   NEXT_PUBLIC_DEMO_MODE=true
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. Set `NEXT_PUBLIC_DEMO_MODE=false` when you want the dashboard to read and write real projects. The backend reads `backend/.env`; add `SUPABASE_SECRET_KEY=sb_secret_...` there so it can create developer accounts. Never expose that key in frontend settings. Add `GEMINI_API_KEY` for LLM responses. `TAVILY_API_KEY` enables web search tools. Keep credentials out of source control.

Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) and put it directly in `backend/.env` as `GEMINI_API_KEY=...`. The app uses `gemini-flash-lite-latest` by default. Do not put the key in a `NEXT_PUBLIC_` frontend variable or paste it into chat.

## Run the full stack

Install Node.js, npm, and [uv](https://docs.astral.sh/uv/). Install the root and frontend packages, then put the backend credentials in `backend/.env`:

```powershell
npm install
cd frontend
npm install
cd ..
npm run dev
```

The frontend runs on port 3000 and the API on port 8000. The backend starts an MCP subprocess with `uv`, so `uv` must be available on `PATH` as well.

The dashboard PDF analyzer accepts text-based PDFs up to 10 MB, extracts text, and asks the configured Gemini model for an evidence-based summary and ordered story, task, and subtask breakdown. Review the suggestions and choose a project to save them. In live mode, project owners can add developers with a username and password, assign tasks to them, and remove them from that project. Removing a developer revokes only that project's access; the account remains available for other projects. Scanned PDFs need OCR before they can be analyzed.
