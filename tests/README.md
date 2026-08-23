# tests/

Run everything from the repo root.

    node tests/wizard-generate.test.js     # 9 checks; writes tests/out/prefix-*.md
    py tests/check_generated_map.py        # reads tests/out/, needs the line above first
    py tests/test_validate_content.py      # the validator's own gate
    py engine/validate_content.py          # the real corpus; 0 errors, warnings expected

`tests/out/` is generated and gitignored.

Fixtures are scratch maps. `theology-map.md` at the repo root is Thomas's own map
and is never read or written by a test.

`fixtures/corpus/` is a small synthetic content corpus — four doctrines across two
domains — that exists so `wizard-generate.test.js` can run before the real seed
content lands in Task 6. See `fixtures/corpus/README.md` for why the generator's
tests do not read `content/wizard/`.
