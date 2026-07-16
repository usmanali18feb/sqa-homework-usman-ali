AI tools used
- GitHub Copilot (GPT-5.3-Codex) for rapid test scaffolding, helper refactors, and concise artifact drafting.
- I chose it over switching tools because context stayed in-editor and iteration speed was better for a small suite.

What AI generated vs what I rewrote
- AI generated the initial Playwright helper structure and first-pass assertions.
- I rewrote selectors, wait logic, and all artifact prose to be app-specific and less generic.
- I manually tightened the suite to exactly 8 tests and mapped each test to challenge requirements.

One AI mistake I caught
- Initial suggestion-topic logic assumed chips were always present as obvious buttons. In this environment, chips were inconsistent. I replaced it with explicit discovery + fallback + annotation and documented the tradeoff.

What I built by hand / did not trust AI with
- Final waiting strategy for non-deterministic responses (`new bubble + stabilized text`) was hand-tuned.
- Final SQL checks were written by hand from observed product behavior; I did not trust generic AI SQL templates.
- Prioritization in UX recommendations was hand-authored based on user impact/risk, not auto-generated ranking.
