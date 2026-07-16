# Permission.io SQA Take-Home (Pre-Login Automation + Product Review)

## Setup
```bash
npm install
npx playwright install chromium
npm test
```

Open the report:
```bash
npm run report
```

## Test strategy (TL;DR)
I kept the automated suite to 8 pre-login tests and optimized for signal over breadth. I covered the 4 required behaviors (initial suggestion affordance, quick-topic flow, free-text flow, Shift+Enter newline) plus auth entry points, input-state UX, and a mobile viewport sanity check. For AI-output validation, I assert semantic anchors and response quality rather than exact strings. I skipped deep visual assertions and post-signup automation to avoid brittle checks and keep runtime fast; post-signup findings are in UX review.

## Key decisions
- Used Playwright for fast setup, built-in retries, trace/video/screenshot capture.
- Chose one spec file with helper functions instead of page-object overhead for 8 tests.
- Implemented response waiting by “new assistant bubble + stabilized text” to handle streaming/non-determinism.
- Enforced strict suggested-topic coverage: tests 1 and 2 require visible pills and click a real topic.
- Asserted semantic signals (`permission`, `data`, `earn`, etc.) and minimum content depth, not exact phrasing.
- Added 1 mobile pre-login test for horizontal overflow + core controls visibility.
- Kept retries at 1 to reduce noise while tolerating transient network issues.
- Report output is generated to `artifacts/report/` for easy review.

## Rejected alternatives
- I rejected exact-text assertions for agent answers because streaming output is non-deterministic and would create flaky failures.
- I rejected a full page-object model because it adds ceremony for an 8-test suite and slows iteration without meaningful quality gain.

## AI disclosure
See `artifacts/ai-workflow.md`.

## Next steps
With 1-2 extra days, I would: (1) stabilize auth redirect assertions with known expected domains/paths, (2) add network-level checks for request/response contracts on chat sends, (3) add CI via GitHub Actions with artifact upload and failure trace retention, (4) add optional eval-based semantic scoring for AI response regression tracking.

## Submission checklist
- [x] Repo named sqa-homework-<first-last> and default branch is main
- [x] README includes exact Setup + run commands (verified from a clean clone)
- [x] README word count <= 500 (excluding commands/checkboxes)
- [x] Max 8 tests; all 4 required behaviors covered
- [x] artifacts/assertions.md included (<= 300 words)
- [x] artifacts/ux-review.md included (<= 400 words, desktop + mobile, post-signup exploration, 3-5 prioritized improvements)
- [x] artifacts/data-checks.md included (<= 300 words + SQL: expected data, verification queries, one pipeline integrity check)
- [x] artifacts/ai-workflow.md included (<= 300 words, all 4 questions answered)
- [x] artifacts/report/ included (or hosted link + screenshot)
- [ ] artifacts/demo.mp4 included (60-90 sec, narrated: suite + report + one Part 2 assertion explained)
- [x] Commit history shows how the work evolved
