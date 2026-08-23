#!/usr/bin/env python3
"""Validate the wizard content corpus against the phase-4 schema.

Spec: docs/hosting/phase-4-design.md section 4. Run:  py engine/validate_content.py

Exits 0 when there are no errors, 1 otherwise. Warnings never fail the build.
Also importable:  validate(root: Path) -> (errors, warnings), both lists of str.

Every message reads "<file>: <doctrine id>: <what is wrong>", because phase 5's
sessions read these messages without reading this code.

Standard library only - requirements.txt stays empty.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TIERS = {"T1", "T1.5", "T2", "T2.5", "T3", "T4"}
TIER_ORDER = ["T1", "T1.5", "T2", "T2.5", "T3", "T4"]
CONFIDENCES = {"certain", "confident", "leaning", "open", "rejected"}
ORTHODOXY = {"historic", "contested", "outside"}
STANCES = {"confessional", "majority", "permitted", "minority", "historic"}
KINDS = {"choice", "settled"}

SECOND_PERSON = re.compile(r"\b(you|your|yours|yourself)\b", re.I)
FIRST_PERSON = re.compile(r"\b(i|my|we|our)\b", re.I)

# Design section 4.7, made mechanical. Second person is rejected everywhere in
# the first list; first person additionally in the second.
NO_SECOND_PERSON_FIELDS = ("question", "framing", "hold", "why", "vs", "label", "note")
NO_FIRST_PERSON_FIELDS = ("hold", "why", "vs", "question")

MAX_HOLD_CHARS = 320
TERMINAL_PUNCTUATION = ".!?”\"')"


def slugify(text):
    """Byte-for-byte the algorithm in engine/editor-core.js and engine/render.py.

    A drift here is the bug rule 4 exists to catch, so it cannot be approximate.
    """
    t = (text or "").lower().replace("&", "and")
    t = re.sub(r"['’]", "", t)
    t = re.sub(r"[^a-z0-9]+", "-", t)
    return t.strip("-")


def map_domain_names():
    """The `# ` headings of theology-map.md - the fourteen real domain names.

    Rule 2 checks corpus domain names against these: matching names are what
    make a wizard-built map, Thomas's map and a tradition map comparable.
    """
    path = ROOT / "theology-map.md"
    if not path.exists():
        return set()
    return {line[2:].strip()
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.startswith("# ")}


def load(root):
    """Read the corpus once into the shape every rule reads.

    Never raises: a missing or unparsable file becomes an entry in
    ctx["load_errors"] and the rules run over whatever did load.

    ctx keys:
      root           Path to content/wizard (or a fixture directory)
      load_errors    list[str] - files missing or not parsing as JSON
      manifest       dict or None
      traditions_doc dict or None
      traditions     {id: tradition_entry}
      domains        {domain_id: manifest_entry}
      files          {file_name: parsed_domain_file}   only those that loaded
      missing_files  [file_name] listed in the manifest but absent
      doctrines      [(file_name, doctrine)]           every doctrine, in file order
      positions      [(file_name, doctrine, position)] every position
      map_names      set[str] - the # headings of theology-map.md
    """
    ctx = {
        "root": root,
        "load_errors": [],
        "manifest": None,
        "traditions_doc": None,
        "traditions": {},
        "domains": {},
        "files": {},
        "missing_files": [],
        "doctrines": [],
        "positions": [],
        "map_names": map_domain_names(),
    }

    def read(name):
        path = root / name
        if not path.exists():
            return None, "missing"
        try:
            return json.loads(path.read_text(encoding="utf-8")), None
        except ValueError as exc:
            return None, f"is not valid JSON ({exc})"

    manifest, problem = read("manifest.json")
    if problem:
        ctx["load_errors"].append(f"manifest.json: {problem}")
    else:
        ctx["manifest"] = manifest
        for entry in manifest.get("domains") or []:
            if isinstance(entry, dict) and entry.get("id"):
                ctx["domains"][entry["id"]] = entry

    traditions_doc, problem = read("traditions.json")
    if problem:
        ctx["load_errors"].append(f"traditions.json: {problem}")
    else:
        ctx["traditions_doc"] = traditions_doc
        for entry in traditions_doc.get("traditions") or []:
            if isinstance(entry, dict) and entry.get("id"):
                ctx["traditions"][entry["id"]] = entry

    for entry in (ctx["manifest"] or {}).get("domains") or []:
        name = (entry or {}).get("file")
        if not name:
            continue
        parsed, problem = read(name)
        if problem == "missing":
            ctx["missing_files"].append(name)
            continue
        if problem:
            ctx["load_errors"].append(f"{name}: {problem}")
            continue
        ctx["files"][name] = parsed
        for doctrine in parsed.get("doctrines") or []:
            if not isinstance(doctrine, dict):
                ctx["load_errors"].append(f"{name}: a doctrine is not an object")
                continue
            ctx["doctrines"].append((name, doctrine))
            for position in doctrine.get("positions") or []:
                if isinstance(position, dict):
                    ctx["positions"].append((name, doctrine, position))

    return ctx


def where(file_name, doctrine=None, extra=None):
    """The message prefix every rule uses: "<file>: <doctrine id>: "."""
    parts = [file_name]
    if doctrine is not None:
        parts.append(str((doctrine or {}).get("id") or "<no id>"))
    if extra:
        parts.append(str(extra))
    return ": ".join(parts) + ": "


def validate(root):
    """Run every rule. Returns (errors, warnings)."""
    root = Path(root)
    ctx = load(root)
    errors = list(ctx["load_errors"])
    warnings = []
    check_rules_1_to_10(ctx, errors, warnings)
    check_rules_11_to_20(ctx, errors, warnings)
    corpus_warnings(ctx, warnings)
    return errors, warnings


def _a_check_schema_version(name, doc, errors):
    if doc is None:
        return
    if doc.get("schema_version") != 1:
        errors.append(where(name) + f"schema_version is {doc.get('schema_version')!r}, expected 1")


def _a_all_slugs(ctx):
    return {d.get("slug") for _, d in ctx["doctrines"] if d.get("slug")}


def check_rules_1_to_10(ctx, errors, warnings):
    """Design section 4.10, errors 1-10."""

    # --- rule 1: schema_version == 1 everywhere ---
    _a_check_schema_version("manifest.json", ctx["manifest"], errors)
    _a_check_schema_version("traditions.json", ctx["traditions_doc"], errors)
    for name, parsed in ctx["files"].items():
        _a_check_schema_version(name, parsed, errors)

    # --- rule 2: manifest files exist (warning only), domain ids and names match ---
    for name in ctx["missing_files"]:
        warnings.append(where(name) + "listed in manifest.json but the file does not exist on disk")

    for entry in (ctx["manifest"] or {}).get("domains") or []:
        if not isinstance(entry, dict):
            continue
        entry_name = entry.get("name")
        if entry_name is not None and entry_name not in ctx["map_names"]:
            errors.append(where("manifest.json") + f"domain name {entry_name!r} has no matching heading in theology-map.md")
        file_name = entry.get("file")
        parsed = ctx["files"].get(file_name) if file_name else None
        if parsed is not None and parsed.get("domain") != entry.get("id"):
            errors.append(where(file_name) + f"domain is {parsed.get('domain')!r}, manifest says {entry.get('id')!r}")

    # --- rule 3: doctrine.id and position.id globally unique; position.id prefixed by its doctrine's id ---
    doctrine_id_locations = {}
    for name, doctrine in ctx["doctrines"]:
        did = doctrine.get("id")
        if not did:
            errors.append(where(name, doctrine) + "id is missing")
            continue
        doctrine_id_locations.setdefault(did, []).append(name)
    for did, locations in doctrine_id_locations.items():
        if len(locations) > 1:
            errors.append(f"{did}: doctrine id is not unique, used in {', '.join(locations)}")

    position_id_locations = {}
    for name, doctrine, position in ctx["positions"]:
        pid = position.get("id")
        if not pid:
            errors.append(where(name, doctrine) + "a position id is missing")
            continue
        position_id_locations.setdefault(pid, []).append(name)
        did = doctrine.get("id")
        if did and not pid.startswith(f"{did}/"):
            errors.append(where(name, doctrine) + f"position id {pid!r} does not start with {did!r} + '/'")
    for pid, locations in position_id_locations.items():
        if len(locations) > 1:
            errors.append(f"{pid}: position id is not unique, used in {', '.join(locations)}")

    # --- rule 4: doctrine.slug matches slugify(node_title) ---
    for name, doctrine in ctx["doctrines"]:
        title = doctrine.get("node_title")
        if not title:
            errors.append(where(name, doctrine) + "node_title is missing")
            continue
        expected = slugify(title)
        if doctrine.get("slug") != expected:
            errors.append(where(name, doctrine) + f"slug is {doctrine.get('slug')!r}, expected {expected!r} from node_title")

    # --- rule 5: doctrine.slug unique across the corpus ---
    slug_locations = {}
    for name, doctrine in ctx["doctrines"]:
        slug = doctrine.get("slug")
        if slug:
            slug_locations.setdefault(slug, []).append(name)
    for slug, locations in slug_locations.items():
        if len(locations) > 1:
            errors.append(f"{slug}: doctrine slug is not unique, used in {', '.join(locations)}")

    # --- rule 6: doctrine.links resolve to some doctrine.slug in the corpus ---
    all_slugs = _a_all_slugs(ctx)
    for name, doctrine in ctx["doctrines"]:
        for link in doctrine.get("links") or []:
            if link not in all_slugs:
                errors.append(where(name, doctrine) + f"links to slug {link!r}, which does not exist")

    # --- rule 7: tiers are valid ---
    for name, doctrine in ctx["doctrines"]:
        tier = doctrine.get("suggested_tier")
        if tier not in TIERS:
            errors.append(where(name, doctrine) + f"suggested_tier is {tier!r}, not one of {sorted(TIERS)}")
    for name, doctrine, position in ctx["positions"]:
        tier = position.get("tier")
        if tier is not None and tier not in TIERS:
            errors.append(where(name, doctrine) + f"position {position.get('id')!r} has tier {tier!r}, not one of {sorted(TIERS)}")

    # --- rule 8: confidences are valid ---
    for name, doctrine, position in ctx["positions"]:
        conf = position.get("confidence_default")
        if conf not in CONFIDENCES:
            errors.append(where(name, doctrine) + f"position {position.get('id')!r} has confidence_default {conf!r}, not one of {sorted(CONFIDENCES)}")
    for name, doctrine in ctx["doctrines"]:
        for trad_id, override in (doctrine.get("tradition_overrides") or {}).items():
            if not isinstance(override, dict):
                continue
            oconf = override.get("confidence")
            if oconf is not None and oconf not in CONFIDENCES:
                errors.append(where(name, doctrine) + f"tradition_overrides[{trad_id!r}].confidence is {oconf!r}, not one of {sorted(CONFIDENCES)}")

    # --- rule 9: kind is valid, choice needs 2+ positions, settled needs 1+ ---
    for name, doctrine in ctx["doctrines"]:
        kind = doctrine.get("kind")
        if kind not in KINDS:
            errors.append(where(name, doctrine) + f"kind is {kind!r}, not one of {sorted(KINDS)}")
            continue
        n_positions = len(doctrine.get("positions") or [])
        if kind == "choice" and n_positions < 2:
            errors.append(where(name, doctrine) + f"kind is 'choice' but has {n_positions} position(s), needs at least 2")
        if kind == "settled" and n_positions < 1:
            errors.append(where(name, doctrine) + "kind is 'settled' but has no positions")

    # --- rule 10: held_by traditions/stances and tradition_overrides keys resolve ---
    for name, doctrine, position in ctx["positions"]:
        for held in position.get("held_by") or []:
            if not isinstance(held, dict):
                continue
            trad = held.get("tradition")
            if trad not in ctx["traditions"]:
                errors.append(where(name, doctrine) + f"position {position.get('id')!r} held_by references unknown tradition {trad!r}")
            stance = held.get("stance")
            if stance not in STANCES:
                errors.append(where(name, doctrine) + f"position {position.get('id')!r} held_by stance is {stance!r}, not one of {sorted(STANCES)}")
    for name, doctrine in ctx["doctrines"]:
        for trad_id in (doctrine.get("tradition_overrides") or {}):
            if trad_id not in ctx["traditions"]:
                errors.append(where(name, doctrine) + f"tradition_overrides references unknown tradition {trad_id!r}")


def _b_nonempty_str(v):
    return isinstance(v, str) and v.strip() != ""


def _b_voice_check(text, field, prefix, errors, check_first_person):
    """Scan one string field for second/first person. `text` may be anything - not
    every field is guaranteed to actually be a string by the time rule 18 runs."""
    if not isinstance(text, str):
        return
    m = SECOND_PERSON.search(text)
    if m:
        errors.append(f"{prefix}{field} uses second person (\"{m.group(0)}\")")
    if check_first_person:
        m = FIRST_PERSON.search(text)
        if m:
            errors.append(f"{prefix}{field} uses first person (\"{m.group(0)}\")")


def _b_voice_fields(obj, prefix, errors, exempt=()):
    """Run the voice rule over every NO_SECOND_PERSON_FIELDS key present on obj."""
    if not isinstance(obj, dict):
        return
    for field in NO_SECOND_PERSON_FIELDS:
        if field in exempt:
            continue
        _b_voice_check(obj.get(field), field, prefix, errors, field in NO_FIRST_PERSON_FIELDS)


def _b_hold_format(text, field, prefix, errors):
    """Rule 19: terminal punctuation and length, only when the field is actually set."""
    if text is None:
        return
    if not isinstance(text, str) or text.strip() == "":
        return
    if text[-1] not in TERMINAL_PUNCTUATION:
        errors.append(f"{prefix}{field} does not end in terminal punctuation")
    if len(text) > MAX_HOLD_CHARS:
        errors.append(f"{prefix}{field} is longer than {MAX_HOLD_CHARS} characters")


def _b_check_sources(sources, prefix, errors):
    if not sources:
        errors.append(f"{prefix}has no sources")
        return
    if not isinstance(sources, list):
        errors.append(f"{prefix}sources is not a list")
        return
    for src in sources:
        if not isinstance(src, dict):
            errors.append(f"{prefix}a sources entry is not an object")
            continue
        if not _b_nonempty_str(src.get("label")):
            errors.append(f"{prefix}a sources entry has no label")
        if not _b_nonempty_str(src.get("citation")):
            errors.append(f"{prefix}a sources entry has no citation")


def _b_check_refs(refs, prefix, errors):
    """Rule 17. refs is optional, so absent/empty is not itself an error here -
    corpus_warnings' rule 4 is what flags a doctrine that never sourced its texts."""
    if refs is None:
        return
    if not isinstance(refs, str):
        errors.append(f"{prefix}refs is not a string")
        return
    if refs.strip() == "":
        return
    parts = refs.split(";")
    if len(parts) > 4:
        errors.append(f"{prefix}refs has more than four semicolon-separated parts")
    for part in parts:
        if part.strip() == "":
            errors.append(f"{prefix}refs has an empty semicolon-separated part")


def check_rules_11_to_20(ctx, errors, warnings):
    """Design section 4.10, errors 11-20."""

    # --- doctrine-level checks: sources (12), open.todo (14), refs (17), voice (18) ---
    for file_name, doctrine in ctx["doctrines"]:
        prefix = where(file_name, doctrine)

        _b_check_sources(doctrine.get("sources"), prefix, errors)

        open_block = doctrine.get("open")
        if not isinstance(open_block, dict):
            errors.append(f"{prefix}doctrine.open is required")
        elif not _b_nonempty_str(open_block.get("todo")):
            errors.append(f"{prefix}open.todo is required and must be non-empty")

        _b_check_refs(doctrine.get("refs"), prefix, errors)

        _b_voice_fields(doctrine, prefix, errors)
        # open.hold is a "hold" field too and is not exempted - only open.todo is.
        if isinstance(open_block, dict):
            _b_voice_check(open_block.get("hold"), "open.hold", prefix, errors, True)

        positions = doctrine.get("positions") or []
        position_ids = {p.get("id") for p in positions if isinstance(p, dict)}

        # rule 15/16 groundwork: which traditions hold which positions
        tradition_holders = {}  # tradition -> [position_id, ...]
        for position in positions:
            if not isinstance(position, dict):
                continue
            for hb in position.get("held_by") or []:
                if isinstance(hb, dict) and hb.get("tradition"):
                    tradition_holders.setdefault(hb["tradition"], []).append(position.get("id"))

        overrides = doctrine.get("tradition_overrides")
        if not isinstance(overrides, dict):
            overrides = {}

        # rule 15 - ambiguity
        for tradition, holding in tradition_holders.items():
            if len(holding) >= 2 and tradition not in overrides:
                errors.append(
                    f"{prefix}tradition '{tradition}' holds {len(holding)} positions "
                    f"of this doctrine with no tradition_overrides entry - "
                    f"add a tradition_overrides entry for it"
                )

        # rule 16 - overrides validity
        for tradition, override in overrides.items():
            if not isinstance(override, dict):
                errors.append(f"{prefix}tradition_overrides['{tradition}'] is not an object")
                continue
            override_prefix = f"{prefix}tradition_overrides['{tradition}']: "
            listed = override.get("positions")
            if not isinstance(listed, list):
                errors.append(f"{override_prefix}positions must be a list")
                listed = []
            for pid in listed:
                if pid not in position_ids:
                    errors.append(f"{override_prefix}position id '{pid}' does not exist on this doctrine")
            if tradition not in tradition_holders or not (set(tradition_holders[tradition]) & set(listed)):
                errors.append(f"{override_prefix}'{tradition}' is not in held_by of any of its listed positions")
            for field in ("hold", "note", "citation"):
                if not _b_nonempty_str(override.get(field)):
                    errors.append(f"{override_prefix}{field} is required and must be non-empty")
            _b_voice_fields(override, override_prefix, errors)
            _b_hold_format(override.get("hold"), "hold", override_prefix, errors)

        # --- position-level checks ---
        for position in positions:
            if not isinstance(position, dict):
                continue
            pos_prefix = f"{prefix}position '{position.get('id') or '<no id>'}': "

            _b_check_sources(position.get("sources"), pos_prefix, errors)

            orthodoxy = position.get("orthodoxy")
            if orthodoxy not in ORTHODOXY:
                errors.append(f"{pos_prefix}orthodoxy '{orthodoxy}' is not one of {sorted(ORTHODOXY)}")
            elif orthodoxy != "historic" and not _b_nonempty_str(position.get("orthodoxy_note")):
                errors.append(f"{pos_prefix}orthodoxy_note is required when orthodoxy is not 'historic'")

            _b_check_refs(position.get("refs"), pos_prefix, errors)

            _b_voice_fields(position, pos_prefix, errors)
            for field in ("hold", "why", "vs"):
                _b_hold_format(position.get(field), field, pos_prefix, errors)

            for hb in position.get("held_by") or []:
                if not isinstance(hb, dict):
                    errors.append(f"{pos_prefix}a held_by entry is not an object")
                    continue
                if not _b_nonempty_str(hb.get("citation")):
                    errors.append(f"{pos_prefix}held_by '{hb.get('tradition')}' has no citation")
                _b_voice_check(hb.get("note"), "held_by.note", pos_prefix, errors, False)

    # --- rule 20: in_scorecard traditions need a real map entry ---
    for tid, tradition in ctx["traditions"].items():
        if not tradition.get("in_scorecard"):
            continue
        prefix = where("traditions.json", extra=tid)
        m = tradition.get("map")
        if not isinstance(m, dict):
            errors.append(f"{prefix}in_scorecard tradition has no map object")
            continue
        if not _b_nonempty_str(m.get("title")):
            errors.append(f"{prefix}map.title is required and must be non-empty")
        if not _b_nonempty_str(m.get("intro")):
            errors.append(f"{prefix}map.intro is required and must be non-empty")


def corpus_warnings(ctx, warnings):
    """Design section 4.10, the four warnings."""
    doctrine_count = len(ctx["doctrines"])

    scorecard_traditions = {tid: t for tid, t in ctx["traditions"].items() if t.get("in_scorecard")}
    scorecard_hits = {tid: 0 for tid in scorecard_traditions}

    for file_name, doctrine in ctx["doctrines"]:
        prefix = where(file_name, doctrine)
        positions = doctrine.get("positions") or []

        doctrine_traditions = set()
        for position in positions:
            if not isinstance(position, dict):
                continue
            held_by = position.get("held_by") or []
            if not held_by:
                warnings.append(f"{prefix}position '{position.get('id') or '<no id>'}' has no held_by")
            for hb in held_by:
                if isinstance(hb, dict) and hb.get("tradition"):
                    doctrine_traditions.add(hb["tradition"])

        for tid in doctrine_traditions & scorecard_hits.keys():
            scorecard_hits[tid] += 1

        if not any(ctx["traditions"].get(t, {}).get("in_ui") for t in doctrine_traditions):
            warnings.append(f"{prefix}no in_ui tradition holds any position of this doctrine")

        doctrine_refs = doctrine.get("refs")
        has_doctrine_refs = isinstance(doctrine_refs, str) and doctrine_refs.strip() != ""
        missing_position_refs = any(
            isinstance(p, dict) and not (isinstance(p.get("refs"), str) and p.get("refs").strip() != "")
            for p in positions
        )
        if not has_doctrine_refs and missing_position_refs:
            warnings.append(f"{prefix}no doctrine-level refs and at least one position lacks refs")

    if doctrine_count:
        for tid, count in scorecard_hits.items():
            pct = 100 * count / doctrine_count
            if pct < 60:
                warnings.append(
                    f"traditions.json: {tid}: in_scorecard tradition holds positions in only "
                    f"{pct:.0f}% of doctrines"
                )


def print_coverage_matrix(ctx):
    """Doctrines down, in_scorecard traditions across."""
    traditions = sorted(
        (t for t in ctx["traditions"].values() if t.get("in_scorecard")),
        key=lambda t: t.get("order") if isinstance(t.get("order"), (int, float)) else 0,
    )

    if not ctx["doctrines"] or not traditions:
        print("No doctrines or no in_scorecard traditions yet - nothing to cover.")
        return

    doctrine_col = max([len("doctrine")] + [len(d.get("id") or "?") for _, d in ctx["doctrines"]])
    headers = [(t.get("short_name") or t.get("id") or "?") for t in traditions]
    col_widths = [max(len(h), 3) for h in headers]

    header_row = "doctrine".ljust(doctrine_col) + "  " + "  ".join(
        h.ljust(w) for h, w in zip(headers, col_widths)
    )
    print(header_row)
    print("-" * len(header_row))

    for file_name, doctrine in ctx["doctrines"]:
        positions = doctrine.get("positions") or []
        overrides = doctrine.get("tradition_overrides")
        overrides = overrides if isinstance(overrides, dict) else {}

        counts = {}
        for position in positions:
            if not isinstance(position, dict):
                continue
            for hb in position.get("held_by") or []:
                if isinstance(hb, dict) and hb.get("tradition"):
                    counts[hb["tradition"]] = counts.get(hb["tradition"], 0) + 1

        cells = []
        for t, w in zip(traditions, col_widths):
            tid = t.get("id")
            if tid in overrides:
                cell = "!"
            elif counts.get(tid, 0) == 1:
                cell = "Y"
            else:
                cell = "-"
            cells.append(cell.ljust(w))
        print((doctrine.get("id") or "?").ljust(doctrine_col) + "  " + "  ".join(cells))

    print("legend: Y = exactly one position names this tradition, "
          "! = covered by tradition_overrides, - = no position names it")


def main():
    root = ROOT / "content" / "wizard"
    errors, warnings = validate(root)
    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    print(f"{len(errors)} errors, {len(warnings)} warnings")
    if not errors:
        print_coverage_matrix(load(root))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
