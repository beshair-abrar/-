# Jadwa 360 — binding rules for Claude Code

Read `JADWA360_BUILD_PLAN.md` for scope and phasing. These rules take precedence over convenience.

## 1. One engine, no duplicates
- `lib/feasibility-engine.ts` is the **only** place financial numbers are computed (depreciation, working capital, loan schedule, NPV/IRR/payback/ARR/PI).
- Server code (save/report/export) and client code (live sliders) both call `computeFeasibility`. Never re-implement any formula in a component, SQL, or export template.
- Scenarios, sensitivity/tornado, and rule-based strengths/warnings are built **on top of** the engine by transforming `FeasibilityInput` and re-running it. They don't fork its logic.
- The engine stays pure: no I/O, no `Date`, no randomness. Any change to it requires updating `lib/feasibility-engine.test.ts` and, if a methodology choice changes, `docs/engine-assumptions.md`.

## 2. Compute-then-narrate (AI layer)
- The AI layer receives the computed `FeasibilityOutput` JSON (plus tornado data and `RiskItem[]` when available). It never receives raw `FeasibilityInput`, and it has no tool or ability to recompute numbers.
- Its system prompt MUST contain, verbatim:
  > لا تحسب أو تقدّر أي رقم غير موجود في البيانات المُرسلة إليك. إذا احتجت رقمًا غير متوفر، اطلبه صراحة بدل تخمينه.
- Strengths/attention points on the decision dashboard are deterministic if/then rules over engine output, not model-generated text. Every displayed claim must trace back to a computed number. No market-growth claim without a market-growth input field.
- Build the AI layer last (phase 5), once the `FeasibilityOutput` shape is stable.

## 3. Data & caching
- Soft multi-tenancy: every project-scoped table carries `user_id` (directly or via `projects`), and every query filters on it (Supabase RLS).
- `project_results` is a cache of `FeasibilityOutput`. Any write to `project_inputs` MUST invalidate or recompute it in the same operation. Stale results are a correctness bug.

## 4. Process
- Ask before deciding anything the plan leaves open (scenario multipliers, default risk lists, feasibility-score formula, market-growth field, tax handling).
- Run `npm run typecheck && npm test` before every commit.
