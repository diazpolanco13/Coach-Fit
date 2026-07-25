# Coach Fit — Implement the "Coach Fit.dc.html" redesign

## Context

The user exported a design mockup from claude.ai/design (`Coach_Fit.dc.html`) and asked to
implement it. It's not runnable code — it's pseudo-HTML (`<sc-if>`/`<sc-for>` templating) plus a
mock `Component extends DCLogic` class with hardcoded/fake data, meant as a spec for layout,
interaction, and (partially) business logic. It has no access to its own design-system stylesheet
(`_ds/modernist-*/styles.css`), so exact colors are undefined — only semantic tokens like
`var(--color-accent)`.

The mock is a substantial redesign of the current app (single-file `frontend/src/App.tsx`,
FastAPI+SQLite backend): new navigation (Hoy, Semana, **Fuerza**, **Cardio**, Ejercicios, Equipo),
a new coral/orange visual identity, new muscle-coverage/PR/stale-group analytics, and a brand-new
**full-screen guided Training Mode** (set-by-set flow with a rest timer) that doesn't exist today.

Three product decisions were confirmed with the user before planning:
1. **Accent color**: naranja/coral intenso (bold orange-coral).
2. **Registrar tab**: keep the existing manual per-set entry flow (recently rebuilt into a
   card-grid + per-exercise detail view) **as-is, unmodified** — Training Mode is additive, not a
   replacement.
3. **New analytics** (14-day muscle coverage, PRs this month, stale muscle groups, per-muscle
   trend %): implement with **real SQL queries** against actual session data, not mocked/simplified
   approximations.

Two research agents mapped the current frontend (`App.tsx`, `lib/api.ts`, `components/ui/*`,
`index.css`) and backend (`main.py`, `db.py`, `catalog.py`) in full. A planning agent then produced
a concrete, file-level plan (below), which I verified by reading `index.css` and
`components.json` directly.

Given the size, this lands as **Phase 1 only** in this work session (theming + refactor + new
backend stats + restyled Hoy/Semana/Ejercicios/Equipo), each step as its own small commit/PR with a
Playwright screenshot check, matching how this project has shipped so far. **Fuerza/Cardio tabs
(Phase 2)** and **Training Mode (Phase 3)** are substantial standalone features — scope them as
follow-up work after Phase 1 is reviewed, rather than trying to land all ~11 slices in one pass.

## Phase 1 — Foundation + reskin (this pass)

### 1. Theme: coral accent, drop the old gradient wash
File: `frontend/src/index.css`.
- Repaint `--primary`/`--primary-foreground`/`--ring`/`--sidebar-primary`/`--sidebar-primary-foreground`/`--sidebar-ring`/`--chart-1` in both `:root` and `.dark` to a coral hue (~oklch hue 42 — sits between orange-500 and red-500, far enough from `--destructive`'s hue 27.3/22.2 that warnings and CTAs stay visually distinct):
  ```
  :root { --primary: oklch(0.64 0.19 42); --primary-foreground: oklch(0.99 0.01 90);
           --ring: oklch(0.64 0.19 42 / 50%); --sidebar-primary: oklch(0.64 0.19 42);
           --sidebar-primary-foreground: oklch(0.99 0.01 90); --sidebar-ring: oklch(0.64 0.19 42 / 50%);
           --chart-1: oklch(0.64 0.19 42); }
  .dark  { --primary: oklch(0.72 0.16 42); --primary-foreground: oklch(0.18 0.02 42);
           --ring: oklch(0.72 0.16 42 / 50%); --sidebar-primary: oklch(0.72 0.16 42);
           --sidebar-primary-foreground: oklch(0.18 0.02 42); --sidebar-ring: oklch(0.72 0.16 42 / 50%);
           --chart-1: oklch(0.72 0.16 42); }
  ```
- Delete the two decorative green/amber `radial-gradient(...)` lines on `body` (lines 128-131) — they clash with coral and the mock has flat, divider-based cards, not gradient washes.
- Reuse `primary` at varying opacity (`/5`, `/10`, `/20`, `/30`) for every "accent-tinted" surface the mock shows (stale-row tint, warning stats, coach panel bg) — same convention the header's "Carga semanal" card already uses (`border-primary/20 bg-primary/5`). **Do not** introduce a second warning/accent CSS variable.
- Add one `@layer components` utility for the mock's uppercase eyebrow labels: `.kicker { @apply text-xs font-semibold uppercase tracking-wider text-muted-foreground; }`.
- Add a `brand` variant to `frontend/src/components/ui/badge.tsx`'s `badgeVariants` map: `border-primary/20 bg-primary/10 text-primary [a]:hover:bg-primary/20` — used for role/muscle tag chips.
- Verify visually with a Playwright screenshot of a couple of screens before moving on — this is a pure repaint, should show zero layout change.

### 2. Refactor: extract shared components (no behavior change)
Move out of `App.tsx` into new files, verbatim (pure move, re-verify build + a screenshot to confirm zero visual diff):
- `components/ExerciseCard.tsx` (currently `App.tsx` lines ~134-164)
- `components/MediaImg.tsx` (currently ~102-132)
- `components/GuideModal.tsx` (currently ~166-203) — while moving, rebuild it on a newly-scaffolded shadcn `Dialog` (`npx shadcn@latest add dialog` from `frontend/`) instead of the hand-rolled `fixed inset-0` backdrop div, keeping the accent top border (`className="border-t-4 border-t-primary"` on `DialogContent`) and existing click-outside-closes / click-inside-doesn't behavior (native to Dialog).
- `lib/muscle.ts` — `MUSCLE_ES`/`muscleES()`/`todayISO()`.

This de-risks every later diff by separating "moved code" from "changed code."

### 3. Backend: 3 new analytics endpoints
Files: `backend/app/db.py`, `backend/app/main.py`, `frontend/src/lib/api.ts`.

Add to `db.py` (same join pattern as existing `get_volume_by_muscle`/`get_exercise_history`):
- `get_muscle_stats(start, end)` — per-muscle `{volume_kg, sessions, last_date}` for every muscle target in the catalog (zero-filled for untrained ones, not just ones with rows), via one query on `session_sets JOIN sessions WHERE date BETWEEN ? AND ? AND done=1 AND completed=1`, grouped through `catalog.exercise_map()[id]["target"]`.
- `coverage_pct(sessions, window_days)` — `min(100, round(100 * sessions / (TARGET_SESSIONS_PER_14D * window_days/14)))`, with `TARGET_SESSIONS_PER_14D = 2`.
- `count_prs_this_month(month_start, month_end)` — one query comparing each exercise's max weight inside the window vs. its max weight strictly before it; count exercises where the in-window max beats (or is the first) prior max.

Add to `main.py`:
- `GET /api/dashboard/muscle-coverage?days=14` → `{window_days, groups: [{muscle, sessions, volume_kg, days_since_last, pct}]}` — feeds Hoy's coverage bars.
- `GET /api/dashboard/muscle-trends?days=28` → `{window_days, groups: [{muscle, sessions, volume_kg, days_since_last, trend_pct}], stale_count}` — computed from two `get_muscle_stats` calls (current window vs. prior window of equal length); `stale_count` (groups with 0 sessions) directly answers "Grupos atrasados", no 4th endpoint needed. Feeds Fuerza's muscle table (Phase 2).
- `GET /api/dashboard/prs?month=YYYY-MM` (optional, defaults to current month) → `{month, pr_count}`. Feeds Fuerza's PR stat (Phase 2).

Add to `lib/api.ts`: `MuscleCoverageItem`/`MuscleTrendItem` types + `api.muscleCoverage(days)` / `api.muscleTrends(days)` / `api.prsThisMonth(month?)`. Note: backend returns raw catalog keys (`"pectorals"`) — reuse the existing frontend `muscleES()` map for display, don't duplicate translation server-side.

Verify each new route independently with `curl` before wiring any UI to it.

### 4. Hoy tab restyle
File: new `components/tabs/HoyTab.tsx` (extracted from `App.tsx` ~lines 466-540), plus new `components/StatRow.tsx` (reusable 4-stat header grid) and `components/ExerciseRow.tsx` (table row: thumbnail | name+meta | "3×N" | last-weight | role tag, click → `GuideModal`) and `components/CoachPanel.tsx` (extracted "Tu coach" panel, wired to the real `api.coachAdvise`/`askCoach`, not the mock's canned-message cycling).
- 4-stat header row: días esta semana (X/4), volumen, RPE medio, carrera km — reuse `load` (WeekLoad) already fetched in `refresh()`.
- Today's exercises as a table (`ExerciseRow` per exercise) instead of the current `ExerciseCard` grid, plus "Empezar entrenamiento" button — **for this pass, since Training Mode is Phase 3, this button can be disabled/hidden or simply not added yet** (don't ship a dead button) — and the existing "Marcar entrenado"/"Registrar series" buttons stay as-is.
- New "Cobertura muscular · 14 días" panel: list of muscle groups from `api.muscleCoverage(14)`, each as a label + `Progress` bar (scaffold via `npx shadcn@latest add progress`) + a right-aligned note ("N ses." normally, "N días sin" in `text-primary font-semibold` when `sessions === 0`), plus a footer hint sentence naming the stalest groups (derive client-side: sort by `days_since_last` desc, name the top 1-2).

### 5. Semana tab restyle
File: new `components/tabs/SemanaTab.tsx` (extracted from `App.tsx` ~lines 542-594).
- Responsive card grid, one card per `WeekDay`: date+title, status tag (`Hecho`/`Pendiente`/`Cardio · descanso` using the new `brand` badge variant when done), up to 4 exercise thumbnails + "+N" chip, meta line, "Marcar/Desmarcar" button.
- **No "Entrenar" button yet** (Phase 3 dependency) — keep the existing "Registrar" button that sets `sessionDate`+switches to the `sesion` tab.

### 6. Ejercicios + Equipo restyle
Files: new `components/tabs/EjerciciosTab.tsx`, `components/tabs/EquipoTab.tsx`, new `lib/settings.ts`.
- Ejercicios: add the segmented role-filter button group (Todos/Empuje/Tirón/Piernas/Core) above the existing card grid (grid itself barely changes — `ExerciseCard` already matches the mock's look).
- Equipo: keep the existing equipment form+table (optionally swap the raw `<select>` for a scaffolded shadcn `Select` — low priority, bundle in if time allows), add a new read-only "Preferencias de entrenamiento" panel (rest-between-sets, progression rule text, weekly plan name, coach description) plus a **real, adjustable** rest-seconds control using the existing-but-unused `components/ui/slider.tsx`, persisted via new `lib/settings.ts` (`getRestSeconds()`/`setRestSeconds()` over `localStorage`, default `90`) — no backend change for this single setting, ready for Phase 3's Training Mode to consume.

## Explicitly deferred (raise with the user again before starting)

- **Phase 2 — Fuerza tab** (replaces "Dashboard": 4-stat header incl. PRs/stale-groups, muscle table with trend %, progressive-load chart with an exercise-picker) and **Cardio tab** (replaces "Métricas": stat header, run form/history, weight chart/history). Keep using recharts for charts (already a dependency, consistent with the current Dashboard tab) rather than the mock's hand-drawn SVG polylines.
- **Phase 3 — Training Mode**: full-screen guided workout overlay (work/rest/done phases, rest timer, set chips, +/- steppers for reps/kg/rpe). Planned architecture (for when this is picked up):
  - `lib/training.ts`: pure `useReducer` state machine — `TrainingState = {exs, ti, si, phase: 'work'|'rest'|'done', restLeft, startedAt, finishedAt}`, actions `COMPLETE_SET`/`TICK`/`SKIP_REST`/`ADD_REST`/`ADJUST`. Rest countdown via a `useEffect` + `setTimeout` re-fired on every `restLeft` change (not the mock's raw instance-field `setInterval`).
  - Seed each exercise's starting reps/kg from real data via the existing `api.dashboardExerciseHistory(exerciseId)` (no new backend endpoint), falling back to 10 reps / 0 kg.
  - `components/TrainingMode.tsx`, mounted as a `fixed inset-0 z-50` overlay from `App.tsx` (`trainingDay` state), same pattern as `GuideModal`; on finish, reuse the **existing** `api.saveSession(...)` + `api.toggleDay(...)` (same `SessionSet` shape Registrar already uses) — no new session-state backend endpoint.
  - Exit uses a plain `window.confirm(...)` (no confirm-dialog infra exists yet for a single button).
  - Wire "Empezar entrenamiento" (Hoy) and "Entrenar" (Semana, any actionable day not just today) to open it once built.

## Verification (each Phase 1 step)

- `cd frontend && npx tsc -b && npx vite build` after every change — must pass with no errors.
- For backend changes: `curl` the new routes directly (e.g. `curl 'localhost:8755/api/dashboard/muscle-coverage?days=14'`) before wiring UI.
- For UI changes: restart the server (`SKIP_BUILD=1 ./run.sh` after `vite build`, or full `./run.sh`), then use the existing Playwright script pattern (`chromium.launch({executablePath: '/opt/pw-browsers/chromium', args:['--no-sandbox']})`) to screenshot each touched tab, and send the screenshot to the user before committing — matches the verification workflow already used earlier in this session.
- Commit each numbered step as its own commit; open one draft PR per logical group (or per step, following the existing pattern of small focused PRs) against `main`, same as the prior `Registrar` redesign PRs.
