# tests/

Run everything from the repo root.

    py engine/validate_content.py          # validates the corpus against twenty error rules
    node --test tests/*.test.js            # runs all four JS suites below via node:test
    py tests/check_tradition_maps.py       # verifies generated tradition maps match corpus
    py tests/test_validate_content.py      # the validator's own unit tests
    py api/_test_lib.py                    # tests database helper functions
    py engine/render.py                    # generates theology-map.html and documentation files

The four JS suites `node --test` picks up:

- `compare-core.test.js` — position comparison and normalization
- `build-traditions.test.js` — tradition maps build deterministically
- `wizard-generate.test.js` — wizard question generation
- `refs.test.js` — scripture reference resolution and citations

`tests/out/` is generated and gitignored.

Fixtures are scratch maps. `theology-map.md` at the repo root is Thomas's own map
and is never read or written by a test.

`fixtures/corpus/` is a small synthetic content corpus — four doctrines across two
domains — that exists so `wizard-generate.test.js` can run before the real seed
content lands in Task 6. See `fixtures/corpus/README.md` for why the generator's
tests do not read `content/wizard/`.
