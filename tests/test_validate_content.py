"""The validator's own gate. Three deliberate faults in tests/fixtures/bad-corpus:

  * `slug` ("in-errancy") does not match slugify(node_title) -> rule 4
  * `held_by.tradition` "calvinist" is not in the registry           -> rule 10
  * `framing` says "you"                                             -> rule 18

Run: py tests/test_validate_content.py
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "engine"))
from validate_content import validate  # noqa: E402


def main():
    errors, warnings = validate(pathlib.Path("tests/fixtures/bad-corpus"))
    joined = " | ".join(errors)
    assert any("slug" in e for e in errors), joined
    assert any("calvinist" in e for e in errors), joined
    assert any("second person" in e for e in errors), joined
    assert len(errors) >= 3, joined
    print("OK", len(errors), "errors,", len(warnings), "warnings")


main()
