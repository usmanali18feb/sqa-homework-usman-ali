For the non-deterministic check, I validate the “What is Permission?” flow in `tests/prelogin.spec.ts` (test: “2) selecting a suggested topic produces an agent response”).

What I assert:
- A new assistant bubble appears after the topic action (`waitForNewAssistantResponse`), so we know a real response was generated.
- The response text stabilizes before assertion (`waitForStableText`), avoiding false passes/failures during streaming.
- Response quality floor: text length > 100 chars.
- Semantic anchor: response must contain “permission”.
- Meaning coverage: at least 2 signal terms present from `permission, data, earn, agent, consent, ask`.

What I deliberately do not assert:
- Exact response string, sentence order, or punctuation.
- Exact response time.
- Specific branding tagline text.

Why:
- The model output is intentionally variable run-to-run.
- Exact-string assertions would be flaky and would reject valid answers.
- These checks still fail broken responses (empty, off-topic, or too shallow) while staying robust to wording variation.

Bonus idea (not implemented):
- Add a DeepEval or RAGAS-style semantic relevance check using a fixed prompt set and a threshold score, then trend score drift across builds.
