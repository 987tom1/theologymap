"""Apply phase-9 correction files to the wizard corpus.

Subagents fan out by source document, which crosses domain files, so they emit
typed ops instead of editing JSON concurrently. This applies them in one pass.
Usage: py engine/apply_corrections.py <corrections.json> [...]   (--dry to preview)
"""
import json, sys, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WD = os.path.join(ROOT, 'content', 'wizard')
SKIP = {'manifest.json', 'traditions.json'}


def load():
    files = {}
    for f in sorted(glob.glob(os.path.join(WD, '*.json'))):
        if os.path.basename(f) in SKIP:
            continue
        files[f] = json.load(open(f, encoding='utf-8'))
    return files


def find_doctrine(files, did):
    for f, d in files.items():
        for doc in d['doctrines']:
            if doc['id'] == did:
                return f, doc
    raise KeyError('no doctrine ' + did)


def find_position(files, pid):
    did = pid.rsplit('/', 1)[0]
    f, doc = find_doctrine(files, did)
    for p in doc['positions']:
        if p['id'] == pid:
            return f, doc, p
    raise KeyError('no position ' + pid)


def held(p, trad):
    for h in p.get('held_by', []):
        if h['tradition'] == trad:
            return h
    return None


def apply_op(files, op, dirty, log):
    kind = op['op']
    if kind == 'held_by.set':
        f, _, p = find_position(files, op['position'])
        h = held(p, op['tradition'])
        if h is None:
            raise KeyError(f"{op['position']} has no held_by {op['tradition']}")
        for k, v in op['fields'].items():
            if k not in ('citation', 'note', 'stance'):
                raise ValueError('held_by.set may only touch citation/note/stance, not ' + k)
            h[k] = v
        log.append(f"set    {op['position']} :: {op['tradition']} ({','.join(op['fields'])})")
    elif kind == 'held_by.remove':
        f, _, p = find_position(files, op['position'])
        h = held(p, op['tradition'])
        if h is None:
            raise KeyError(f"{op['position']} has no held_by {op['tradition']}")
        p['held_by'].remove(h)
        log.append(f"REMOVE {op['position']} :: {op['tradition']} — {op.get('reason','')}")
    elif kind == 'held_by.add':
        f, _, p = find_position(files, op['position'])
        if held(p, op['tradition']):
            raise ValueError(f"{op['position']} already has {op['tradition']}")
        p.setdefault('held_by', []).append({
            'tradition': op['tradition'], 'stance': op['stance'],
            'note': op.get('note'), 'citation': op['citation']})
        log.append(f"ADD    {op['position']} :: {op['tradition']} ({op['stance']})")
    elif kind == 'position.sources':
        f, _, p = find_position(files, op['position'])
        p['sources'] = op['sources']
        log.append(f"src    {op['position']} ({len(op['sources'])})")
    elif kind == 'doctrine.sources':
        f, doc = find_doctrine(files, op['doctrine'])
        doc['sources'] = op['sources']
        log.append(f"src    {op['doctrine']} ({len(op['sources'])})")
    elif kind == 'position.hold':
        f, _, p = find_position(files, op['position'])
        old = p['hold']
        if old == op['hold']:
            log.append(f"hold   {op['position']} unchanged, skipped")
            return
        p.setdefault('superseded_holds', []).append(old)
        p['hold'] = op['hold']
        log.append(f"HOLD   {op['position']}\n         old: {old}\n         new: {op['hold']}")
    elif kind == 'override.set':
        f, doc = find_doctrine(files, op['doctrine'])
        ov = (doc.get('tradition_overrides') or {}).get(op['tradition'])
        if ov is None:
            raise KeyError(f"{op['doctrine']} has no override for {op['tradition']}")
        for k, v in op['fields'].items():
            if k == 'hold':
                if ov['hold'] != v:
                    ov.setdefault('superseded_holds', []).append(ov['hold'])
                    log.append(f"HOLD   {op['doctrine']}/@override:{op['tradition']}\n"
                               f"         old: {ov['hold']}\n         new: {v}")
                ov['hold'] = v
            else:
                ov[k] = v
        log.append(f"ovr    {op['doctrine']} :: {op['tradition']} ({','.join(op['fields'])})")
    elif kind == 'override.positions':
        f, doc = find_doctrine(files, op['doctrine'])
        doc['tradition_overrides'][op['tradition']]['positions'] = op['positions']
        log.append(f"ovr    {op['doctrine']} :: {op['tradition']} positions")
    elif kind == 'override.remove':
        f, doc = find_doctrine(files, op['doctrine'])
        del doc['tradition_overrides'][op['tradition']]
        if not doc['tradition_overrides']:
            del doc['tradition_overrides']
        log.append(f"OVR-RM {op['doctrine']} :: {op['tradition']}")
    else:
        raise ValueError('unknown op ' + kind)
    dirty.add(f)


def main(argv):
    dry = '--dry' in argv
    paths = [a for a in argv if not a.startswith('--')]
    files = load()
    dirty, log, errs = set(), [], []
    for path in paths:
        ops = json.load(open(path, encoding='utf-8'))
        for i, op in enumerate(ops):
            try:
                apply_op(files, op, dirty, log)
            except Exception as e:
                errs.append(f"{os.path.basename(path)}[{i}] {op.get('op')}: {e}")
    print('\n'.join(log))
    if errs:
        print('\n--- ERRORS, nothing written ---')
        print('\n'.join(errs))
        return 1
    print(f"\n{len(log)} ops, {len(dirty)} files touched")
    if not dry:
        for f in sorted(dirty):
            with open(f, 'w', encoding='utf-8', newline='\n') as fh:
                json.dump(files[f], fh, ensure_ascii=False, indent=2)
                fh.write('\n')
        print('written')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
