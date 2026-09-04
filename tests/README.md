# tests/

Run everything from the repo root.

    py engine/validate_content.py          # validates the corpus against twenty error rules
    node tests/compare-core.test.js        # tests position comparison and normalization
    node tests/build-traditions.test.js    # verifies tradition maps build deterministically
    node tests/wizard-generate.test.js     # 9 checks; validates wizard question generation
    node tests/refs.test.js                # validates scripture reference resolution and citations
    py tests/check_tradition_maps.py       # verifies generated tradition maps match corpus
    py tests/test_validate_content.py      # the validator's own unit tests
    py api/_test_lib.py                    # tests database helper functions
    py engine/render.py                    # generates theology-map.html and documentation files

`tests/out/` is generated and gitignored.

Fixtures are scratch maps. `theology-map.md` at the repo root is Thomas's own map
and is never read or written by a test.

`fixtures/corpus/` is a small synthetic content corpus — four doctrines across two
domains — that exists so `wizard-generate.test.js` can run before the real seed
content lands in Task 6. See `fixtures/corpus/README.md` for why the generator's
tests do not read `content/wizard/`.
