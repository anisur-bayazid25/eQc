"""Offline XSD, archive-path, reference and text-position validation."""
import json
import sys
from pathlib import Path
from lxml import etree

sys.stdin.reconfigure(encoding='utf-8')
payload = json.load(sys.stdin)
schema = etree.XMLSchema(etree.parse(str(Path(__file__).parent / 'fixtures/refi-qda/Project.xsd')))
root = etree.fromstring(payload['qdeXml'].encode('utf-8'))
schema.assertValid(root)
ns = {'q': 'urn:QDA-XML:project:1.0'}
guids = root.xpath('//@guid')
assert len(guids) == len(set(guids)), 'GUIDs must be unique'
for ref in root.xpath('//@targetGUID | //@creatingUser | //@creatingUserGUID'):
    assert ref in guids, f'Unresolved GUID {ref}'
files = {**payload['sourceFiles'], **payload.get('sourceBytes', {})}
selections = []
for source in root.xpath('//q:TextSource | //q:Representation | //q:PDFSource | //q:PictureSource | //q:Note', namespaces=ns):
    for key in ['plainTextPath', 'richTextPath', 'path']:
        uri = source.get(key)
        if not uri:
            continue
        assert uri.startswith('internal://')
        filename = 'sources/' + uri.removeprefix('internal://')
        assert filename in files, f'Missing case-sensitive archive path {filename}'
        if key == 'plainTextPath':
            text = files[filename]
            for selection in source.findall('q:PlainTextSelection', ns):
                start, end = int(selection.get('startPosition')), int(selection.get('endPosition'))
                assert 0 <= start <= end < len(text), 'Invalid inclusive codepoint range'
                selections.append(text[start:end + 1])
for picture in root.xpath('//q:PictureSelection', namespaces=ns):
    assert int(picture.get('firstX')) >= 0 and int(picture.get('secondX')) > int(picture.get('firstX'))
    assert int(picture.get('firstY')) >= 0 and int(picture.get('secondY')) > int(picture.get('firstY'))
print(json.dumps({'valid': True, 'selectedText': selections}, ensure_ascii=True))
