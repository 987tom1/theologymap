# tests/fixtures/corpus/ — a scratch corpus, not the seed

Four doctrines across two domains. It exists so `tests/wizard-generate.test.js`
can run **before** the real seed content lands.

## Why the generator's tests do not read `content/wizard/`

`phase-4-plan.md`'s Task 4 test calls `WG.loadCorpusSync('content/wizard')` and
asserts on `church.baptism`, `church.lords-supper` and `scripture.canon`. Those
doctrines are written by **Task 6**, which is session 10's work — Task 4 is
session 9's. As written, Task 4 could not be verified in the session the plan
assigns it to. Session 9 pointed the tests at this fixture instead of pulling
Task 6 forward.

That turns out to be the better arrangement anyway: the generator is a pure
function over a schema, so its tests should pin the schema, not the content.
Without this fixture every phase-5 domain file that lands would shift
`orderedDoctrines`' output and break tests that have nothing to do with content.

**Task 8's verification suite runs the validator and the generator against the
real corpus.** This fixture never substitutes for that.

## What it is not

It is **not** seed content and must never be copied into `content/wizard/`. The
seed is written to phase 5's standard — real citations, real sourcing, no
placeholders (design §5.7). The entries here are deliberately thin: enough shape
to exercise tier ordering, the open answer, cross-domain links in both
directions, and the "never modify an existing node" rule. Nothing here is
sourced to the standard the shipped corpus requires.
