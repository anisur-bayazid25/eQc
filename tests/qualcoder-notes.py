"""Exercise QualCoder's actual parse_notes method without its Qt application.

Provide an unmodified upstream refi.py path; project payload arrives on stdin.
Only the method is compiled, using an isolated journal and temporary sources.
"""
import ast
import datetime
import json
from pathlib import Path
from random import randint
import sqlite3
import sys
import tempfile
from types import SimpleNamespace
import xml.etree.ElementTree as ET

sys.stdin.reconfigure(encoding='utf-8')
payload = json.load(sys.stdin)
source = ast.parse(Path(sys.argv[1]).read_text(encoding='utf-8'))
importer = next(n for n in source.body if isinstance(n, ast.ClassDef) and n.name == 'RefiImport')
method = next(n for n in importer.body if isinstance(n, ast.FunctionDef) and n.name == 'parse_notes')
namespace = {'datetime': datetime, 'randint': randint, '_': lambda text: text}
exec(compile(ast.Module(body=[method], type_ignores=[]), sys.argv[1], 'exec'), namespace)
root = ET.fromstring(payload['qdeXml'])
notes = root.find('{urn:QDA-XML:project:1.0}Notes')
assert notes is not None and len(notes)
with tempfile.TemporaryDirectory(prefix='eqc-qualcoder-notes-') as directory:
    folder = Path(directory) / 'sources'
    folder.mkdir()
    for note in notes:
        name = note.get('plainTextPath').removeprefix('internal://')
        assert Path(name).name == name
        (folder / name).write_text(payload['sourceFiles']['sources/' + name], encoding='utf-8')
    connection = sqlite3.connect(':memory:')
    connection.execute('CREATE TABLE journal(name TEXT UNIQUE, jentry TEXT, owner TEXT, date TEXT)')
    messages = []
    fake = SimpleNamespace(app=SimpleNamespace(conn=connection), xmlns_version='1.0',
        folder_name=directory, sources_name='/sources', annotations=[], links=[],
        parent_textedit=SimpleNamespace(append=messages.append),
        users=[{'guid': u.get('guid'), 'name': u.get('name')} for u in root.findall('.//{urn:QDA-XML:project:1.0}User')])
    # Reproduce the screenshot using an old-style note with no dates.
    broken = ET.fromstring(ET.tostring(notes))
    for note in broken:
        note.attrib.pop('creationDateTime', None)
        note.attrib.pop('modifiedDateTime', None)
    try:
        namespace['parse_notes'](fake, broken)
        raise AssertionError('Expected the missing-date AttributeError')
    except AttributeError as error:
        assert 'replace' in str(error)
    count = namespace['parse_notes'](fake, notes)
    assert count == len(notes)
    rows = connection.execute('SELECT name,jentry,owner,date FROM journal').fetchall()
    assert len(rows) == len(notes) and not messages, messages
    for note, row in zip(notes, rows):
        assert row[0] == note.get('name')
        assert row[1] == payload['sourceFiles']['sources/' + note.get('plainTextPath').removeprefix('internal://')]
        assert row[2] != 'default' and row[3]
    connection.close()
print(json.dumps({'importedNotes': count, 'missingDateCrashReproduced': True}))
