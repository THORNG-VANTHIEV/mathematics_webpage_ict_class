#!/usr/bin/env python3
"""
Rebuild js/course-data.js and images/lessons/ from the Word source of the mathematics course book.

Usage (from the project root):
    python3 tools/build_course_data.py "គណិតវិទ្យាសម្រាប់កុំព្យូទ័រ.docx"
"""
import io
import json
import os
import re
import shutil
import sys
import zipfile
import xml.etree.ElementTree as ET

try:
    from PIL import Image, features
    if not features.check('webp'):
        raise ImportError('Pillow was built without WebP support')
except ImportError as e:
    sys.exit(f'Pillow with WebP support is required ({e}). Install it with: python3 -m pip install Pillow')

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
V = '{urn:schemas-microsoft-com:vml}'
M = '{http://schemas.openxmlformats.org/officeDocument/2006/math}'

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, 'js', 'course-data.js')
IMG_DIR = os.path.join(ROOT, 'images', 'lessons')
MAX_IMG_WIDTH = 1600

KH2AR = str.maketrans('០១២៣៤៥៦៧៨៩', '0123456789')
AR2KH = str.maketrans('0123456789', '០១២៣៤៥៦៧៨៩')
ZW = re.compile(r'[​‌‍﻿]')


# --------------------------------------------------------------------------- text helpers
def plain(t):
    """Text without zero-width spaces (for matching / search)."""
    return ZW.sub('', t or '').strip()


def clean(t):
    """Display text: keep Khmer zero-width word breaks, tidy everything else."""
    t = (t or '').replace(' ', ' ').replace('\t', ' ')
    t = re.sub(r'[ ​]*\n[ ​]*', '\n', t)
    t = re.sub(r' {2,}', ' ', t)
    t = re.sub(r'​*( )​*', r'\1', t)
    return t.strip(' ​\n')


def has_khmer(t):
    return re.search(r'[ក-៿]', t or '') is not None


# --------------------------------------------------------------------------- OMML Math to LaTeX
def omml_to_latex(el):
    """Recursively converts an OMML Element into clean LaTeX math syntax."""
    if el is None:
        return ''
    tag = el.tag.replace(M, '').replace(W, '')
    if tag in ('oMath', 'oMathPara'):
        return ''.join(omml_to_latex(c) for c in el if not c.tag.endswith('Pr'))
    elif tag == 'r':
        return ''.join(c.text or '' for c in el if c.tag.endswith('t'))
    elif tag == 't':
        return el.text or ''
    elif tag == 'f':
        num = omml_to_latex(el.find(f'{M}num'))
        den = omml_to_latex(el.find(f'{M}den'))
        return f'\\frac{{{num}}}{{{den}}}'
    elif tag == 'sSup':
        base = omml_to_latex(el.find(f'{M}e'))
        sup = omml_to_latex(el.find(f'{M}sup'))
        return f'{{{base}}}^{{{sup}}}'
    elif tag == 'sSub':
        base = omml_to_latex(el.find(f'{M}e'))
        sub = omml_to_latex(el.find(f'{M}sub'))
        return f'{{{base}}}_{{{sub}}}'
    elif tag == 'sSubSup':
        base = omml_to_latex(el.find(f'{M}e'))
        sub = omml_to_latex(el.find(f'{M}sub'))
        sup = omml_to_latex(el.find(f'{M}sup'))
        return f'{{{base}}}_{{{sub}}}^{{{sup}}}'
    elif tag == 'bar':
        base = omml_to_latex(el.find(f'{M}e'))
        return f'\\overline{{{base}}}'
    elif tag == 'acc':
        acc_chr = el.find(f'{M}accPr/{M}chr')
        ch = acc_chr.get(f'{M}val') if acc_chr is not None else '^'
        base = omml_to_latex(el.find(f'{M}e'))
        return f'\\hat{{{base}}}' if ch == '^' else f'\\bar{{{base}}}'
    elif tag == 'rad':
        deg = el.find(f'{M}deg')
        base = omml_to_latex(el.find(f'{M}e'))
        deg_txt = omml_to_latex(deg) if deg is not None else ''
        if deg_txt and deg_txt.strip():
            return f'\\sqrt[{deg_txt}]{{{base}}}'
        return f'\\sqrt{{{base}}}'
    elif tag == 'd':
        beg_chr = el.find(f'{M}dPr/{M}begChr')
        end_chr = el.find(f'{M}dPr/{M}endChr')
        b = beg_chr.get(f'{M}val') if beg_chr is not None else '('
        e = end_chr.get(f'{M}val') if end_chr is not None else ')'
        base = omml_to_latex(el.find(f'{M}e'))
        b_esc = '\\' + b if b in ('{', '}') else b
        e_esc = '\\' + e if e in ('{', '}') else e
        return f'\\left{b_esc}{base}\\right{e_esc}'
    elif tag == 'nary':
        chr_el = el.find(f'{M}naryPr/{M}chr')
        op = chr_el.get(f'{M}val') if chr_el is not None else '∑'
        op_latex = {'∑': '\\sum', '∏': '\\prod', '∫': '\\int', '⋃': '\\bigcup', '⋂': '\\bigcap'}.get(op, op)
        sub = omml_to_latex(el.find(f'{M}sub')) if el.find(f'{M}sub') is not None else ''
        sup = omml_to_latex(el.find(f'{M}sup')) if el.find(f'{M}sup') is not None else ''
        base = omml_to_latex(el.find(f'{M}e'))
        lim = ''
        if sub and sup:
            lim = f'_{{{sub}}}^{{{sup}}}'
        elif sub:
            lim = f'_{{{sub}}}'
        return f'{op_latex}{lim} {{{base}}}'
    elif tag == 'limLow':
        base = omml_to_latex(el.find(f'{M}e'))
        lim = omml_to_latex(el.find(f'{M}lim'))
        if base.strip() == 'lim':
            return f'\\lim_{{{lim}}}'
        return f'{{{base}}}_{{{lim}}}'
    elif tag == 'func':
        fname = omml_to_latex(el.find(f'{M}fName'))
        base = omml_to_latex(el.find(f'{M}e'))
        return f'{fname} {{{base}}}'
    else:
        return ''.join(omml_to_latex(c) for c in el if not c.tag.endswith('Pr'))


# --------------------------------------------------------------------------- docx reading
class Docx:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.doc = ET.fromstring(self.z.read('word/document.xml'))
        rels = ET.fromstring(self.z.read('word/_rels/document.xml.rels'))
        self.rels = {r.get('Id'): r.get('Target') for r in rels}
        self.styles = {}
        st = ET.fromstring(self.z.read('word/styles.xml'))
        for s in st.iter(W + 'style'):
            n = s.find(W + 'name')
            self.styles[s.get(W + 'styleId')] = n.get(W + 'val') if n is not None else s.get(W + 'styleId')
        self._load_numbering()

    def _load_numbering(self):
        self.num_fmt = {}
        try:
            num = ET.fromstring(self.z.read('word/numbering.xml'))
        except KeyError:
            return
        abstract = {}
        for a in num.findall(W + 'abstractNum'):
            lv = {}
            for l in a.findall(W + 'lvl'):
                f = l.find(W + 'numFmt'); s = l.find(W + 'start')
                lv[l.get(W + 'ilvl')] = (f.get(W + 'val') if f is not None else 'decimal',
                                         int(s.get(W + 'val')) if s is not None else 1)
            abstract[a.get(W + 'abstractNumId')] = lv
        for n in num.findall(W + 'num'):
            lv = dict(abstract.get(n.find(W + 'abstractNumId').get(W + 'val'), {}))
            for o in n.findall(W + 'lvlOverride'):
                so = o.find(W + 'startOverride')
                il = o.get(W + 'ilvl')
                if so is not None and il in lv:
                    lv[il] = (lv[il][0], int(so.get(W + 'val')))
            self.num_fmt[n.get(W + 'numId')] = lv

    def media(self, target):
        return self.z.read('word/' + target if not target.startswith('word/') else target)

    def para(self, p):
        texts, images = [], []
        bold_chars, all_chars = 0, 0
        has_math = False

        def _walk(nodes):
            nonlocal bold_chars, all_chars, has_math
            for c in nodes:
                tag = c.tag
                if tag == W + 'r':
                    rpr = c.find(W + 'rPr')
                    is_bold = rpr is not None and rpr.find(W + 'b') is not None and \
                        rpr.find(W + 'b').get(W + 'val') not in ('0', 'false')
                    for node in c.iter():
                        if node.tag == W + 't':
                            txt = node.text or ''
                            texts.append(txt)
                            n = len(txt.strip())
                            all_chars += n
                            bold_chars += n if is_bold else 0
                        elif node.tag == W + 'tab':
                            texts.append('\t')
                        elif node.tag in (W + 'br', W + 'cr'):
                            texts.append('\n')
                        elif node.tag == A + 'blip':
                            rid = node.get(R + 'embed')
                            if rid in self.rels:
                                images.append(self.rels[rid])
                        elif node.tag == V + 'imagedata':
                            rid = node.get(R + 'id')
                            if rid in self.rels:
                                images.append(self.rels[rid])
                elif tag in (M + 'oMath', M + 'oMathPara'):
                    has_math = True
                    ltx = omml_to_latex(c).strip()
                    if ltx:
                        texts.append(f' ${ltx}$ ')
                elif tag in (W + 'hyperlink', W + 'sdt', W + 'sdtContent', W + 'fldSimple', W + 'smartTag'):
                    _walk(c)
                else:
                    for blip in c.iter(A + 'blip'):
                        rid = blip.get(R + 'embed')
                        if rid in self.rels:
                            images.append(self.rels[rid])

        _walk(p)

        ppr = p.find(W + 'pPr')
        style, num = None, None
        if ppr is not None:
            ps = ppr.find(W + 'pStyle')
            if ps is not None:
                style = self.styles.get(ps.get(W + 'val'), ps.get(W + 'val'))
            npr = ppr.find(W + 'numPr')
            if npr is not None and npr.find(W + 'numId') is not None:
                nid = npr.find(W + 'numId').get(W + 'val')
                il = npr.find(W + 'ilvl')
                if nid != '0':
                    num = (nid, il.get(W + 'val') if il is not None else '0')

        return {
            'k': 'p',
            'text': ''.join(texts),
            'style': style or '',
            'num': num,
            'images': images,
            'bold': all_chars > 0 and bold_chars == all_chars,
            'has_math': has_math
        }

    def blocks(self):
        body = self.doc.find(W + 'body')
        for child in body:
            if child.tag == W + 'p':
                yield self.para(child)
            elif child.tag == W + 'tbl':
                rows = []
                for tr in child.findall(W + 'tr'):
                    cells = []
                    for tc in tr.findall(W + 'tc'):
                        ps = [self.para(p) for p in tc.iter(W + 'p')]
                        span = tc.find(W + 'tcPr/' + W + 'gridSpan')
                        cells.append({
                            'text': '\n'.join(p['text'] for p in ps if plain(p['text'])),
                            'span': int(span.get(W + 'val')) if span is not None else 1,
                            'images': [i for p in ps for i in p['images']],
                            'bold': all(p['bold'] for p in ps if plain(p['text'])) and any(plain(p['text']) for p in ps)
                        })
                    rows.append(cells)
                yield {'k': 'tbl', 'rows': rows}


# --------------------------------------------------------------------------- images
WEBP_QUALITY = 85


def to_webp(data, max_width=MAX_IMG_WIDTH):
    img = Image.open(io.BytesIO(data))
    img.load()
    has_alpha = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
    img = img.convert('RGBA' if has_alpha else 'RGB')
    if img.width > max_width:
        img = img.resize((max_width, round(img.height * max_width / img.width)), Image.LANCZOS)
    lossy = io.BytesIO()
    img.save(lossy, 'WEBP', quality=WEBP_QUALITY, method=6, alpha_quality=95)
    candidates = [lossy.getvalue()]
    if img.width * img.height <= 400_000:
        lossless = io.BytesIO()
        img.save(lossless, 'WEBP', lossless=True, quality=85, method=4)
        candidates.append(lossless.getvalue())
    return min(candidates, key=len)


class ImageWriter:
    def __init__(self, docx):
        self.docx = docx
        self.done = {}
        self.counters = {}
        self.bytes_in = self.bytes_out = 0

    def write(self, target, lesson_id):
        if target in self.done:
            return self.done[target]
        data = self.docx.media(target)
        self.bytes_in += len(data)
        self.counters[lesson_id] = self.counters.get(lesson_id, 0) + 1
        rel = f'images/lessons/{lesson_id}/fig-{self.counters[lesson_id]:02d}.webp'
        os.makedirs(os.path.join(IMG_DIR, lesson_id), exist_ok=True)
        webp = to_webp(data)
        open(os.path.join(ROOT, rel), 'wb').write(webp)
        self.bytes_out += len(webp)
        self.done[target] = rel
        return rel


# --------------------------------------------------------------------------- lesson builder
MANUAL_BULLET = re.compile(r'^\s*(o|\+|🖌|Y|•|-)\t')
MANUAL_LETTER = re.compile(r'^\s*([a-z])\.\t')


def heading_for_caption(t):
    t = plain(re.sub(r'<[^>]+>', '', t))
    t = re.sub(r'^[\s➢❖✓•▪\-\*]+', '', t)
    t = re.sub(r'^[០-៩0-9]+(?:\.[០-៩0-9]+)*\.?\s*', '', t)
    return t.strip().rstrip('៖:').strip()


class LessonBuilder:
    def __init__(self, docx, images, lesson_id):
        self.docx, self.images, self.lesson_id = docx, images, lesson_id
        self.objectives = []
        self.sections = []
        self.cur = None
        self.list_block = None
        self.counters = {}
        self.in_objectives = False

    def section(self, title):
        self.cur = {'title': clean(title), 'items': []}
        self.sections.append(self.cur)
        self.list_block = None

    def add(self, item):
        if self.cur is None:
            self.section('សេចក្តីផ្តើមនៃមេរៀន')
        self.cur['items'].append(item)
        if item['type'] not in ('steps', 'bullets'):
            self.list_block = None

    def list_item(self, kind, key, text):
        if self.list_block and self.list_block[0] == (kind, key) and self.cur['items'] and \
                self.cur['items'][-1] is self.list_block[1]:
            blk = self.list_block[1]
        else:
            blk = {'type': kind, ('steps' if kind == 'steps' else 'items'): []}
            self.add(blk)
            self.list_block = ((kind, key), blk)
        blk['steps' if kind == 'steps' else 'items'].append(text)

    def number_label(self, nid, ilvl):
        fmt, start = self.docx.num_fmt.get(nid, {}).get(ilvl, ('decimal', 1))
        lvl_counts = self.counters.setdefault(nid, {})
        lvl_counts[ilvl] = lvl_counts.get(ilvl, start - 1) + 1
        for deeper in [k for k in lvl_counts if int(k) > int(ilvl)]:
            del lvl_counts[deeper]
        n = lvl_counts[ilvl]
        if fmt == 'bullet':
            return 'bullet', None
        if fmt in ('lowerLetter', 'upperLetter'):
            c = chr(ord('a') + n - 1)
            return 'steps', c.upper() if fmt == 'upperLetter' else c
        return 'steps', str(n)

    def image(self, target):
        rel = self.images.write(target, self.lesson_id)
        self.add({'type': 'image', 'src': rel, 'caption': ''})

    def paragraph(self, b):
        raw = b['text']
        text = clean(raw)
        p = plain(raw)
        style = b['style']
        if not p and not b['images']:
            return
        if p.startswith('គោលបំណងនៃមេរៀន'):
            self.in_objectives = True
            return
        if self.in_objectives:
            if style == 'List Paragraph' or b['num'] or re.match(r'^[០-៩0-9]+\.', p):
                self.objectives.append(re.sub(r'^[០-៩0-9]+\.\s*', '', text))
                return
            self.in_objectives = False
        if style == 'heading 2':
            self.section(text)
            return
        if style == 'heading 3':
            self.add({'type': 'subsection', 'title': text})
            return
        if p:
            # check if purely block formula
            pure_math = re.match(r'^\s*\$([^\$]+)\$\s*$', raw.strip())
            if pure_math and not has_khmer(raw):
                self.add({'type': 'formula', 'text': pure_math.group(1).strip()})
                return

            if b['num']:
                nid, ilvl = b['num']
                kind, label = self.number_label(nid, ilvl)
                if kind == 'bullet':
                    self.list_item('bullets', nid + ':' + ilvl, text)
                else:
                    self.list_item('steps', nid + ':' + ilvl, f'{label}. {text}')
            elif MANUAL_LETTER.match(raw.replace('​', '')):
                m = MANUAL_LETTER.match(raw.replace('​', ''))
                self.list_item('steps', 'manual-letter', f'{m.group(1)}. {clean(raw.replace(chr(0x200b), "")[m.end():])}')
            elif MANUAL_BULLET.match(raw.replace('​', '')):
                m = MANUAL_BULLET.match(raw.replace('​', ''))
                self.list_item('bullets', 'manual', clean(raw.replace('​', '')[m.end():]))
            elif p.startswith('ចំណាំ') or p.startswith('សម្គាល់'):
                self.add({'type': 'callout', 'kind': 'note', 'text': text})
            else:
                self.add({'type': 'paragraph', 'text': text})
        for img in b['images']:
            self.image(img)

    def table(self, t):
        rows = t['rows']
        cells = [c for r in rows for c in r]
        images = [i for c in cells for i in c['images']]
        if len(rows) == 1 and len(rows[0]) == 1:
            txt = rows[0][0]['text']
            p = plain(txt)
            if p:
                if (not has_khmer(p)) and re.search(r'^\s*\$', p):
                    self.add({'type': 'formula', 'text': plain(txt).strip('$ ')})
                else:
                    self.add({'type': 'callout', 'kind': 'note', 'text': clean(txt)})
            for img in images:
                self.image(img)
            return

        def is_header_row(row):
            texts = [plain(c['text']) for c in row]
            if not any(texts):
                return False
            if texts[0] in ('ល.រ', 'ល.រ.', 'លរ', 'p', 'A', 'X', 'កូដ', 'ទម្រង់', 'គោល'):
                return True
            return all(c['bold'] for c in row if plain(c['text']))

        def cell(c):
            t = clean(c['text'])
            return {'text': t, 'colspan': c['span']} if c.get('span', 1) > 1 else t

        header = None
        if len(rows) > 1 and is_header_row(rows[0]):
            header = [cell(c) for c in rows[0]]
            body = rows[1:]
        else:
            body = rows
        body_rows = [[cell(c) for c in r] for r in body]

        self.add({'type': 'table', 'headers': header or [], 'rows': body_rows})
        for img in images:
            self.image(img)


# --------------------------------------------------------------------------- main
def main(docx_path):
    docx = Docx(docx_path)
    blocks = list(docx.blocks())

    # table of contents -> page numbers
    toc_pages = {}
    ref_page = 179
    in_sol_toc = False
    for b in blocks:
        if b['k'] == 'p' and b['style'].lower().startswith('toc'):
            t = plain(b['text'])
            if 'អត្រាកំណែ' in t:
                in_sol_toc = True
                m_sol = re.search(r'(\d+)\s*$', t)
                if m_sol:
                    toc_pages['solutions'] = int(m_sol.group(1))
            elif 'ឯកសារយោង' in t:
                m_ref = re.search(r'(\d+)\s*$', t)
                if m_ref:
                    ref_page = int(m_ref.group(1))
            else:
                m_les = re.search(r'មេរៀន​?ទី([០-៩0-9]+).*?(\d+)\s*$', t)
                if m_les:
                    num = int(m_les.group(1).translate(KH2AR))
                    pg = int(m_les.group(2))
                    if in_sol_toc:
                        toc_pages[f"solution-{num:02d}"] = pg
                    else:
                        toc_pages[f"lesson-{num:02d}"] = pg

    h1_indices = [i for i, b in enumerate(blocks) if b['k'] == 'p' and b['style'] == 'heading 1']

    # ---- Preface (first heading 1) ----
    front = [b for b in blocks[:h1_indices[1]] if b['k'] == 'p' and not b['style'].startswith('toc')]
    pref_paras = []
    sign_off = {
        'location': 'សៀមរាប',
        'date': 'ខែតុលា ឆ្នាំ២០២៦',
        'role': 'កែសម្រួល និងរៀបចំទម្រង់ឡើងវិញដោយ',
        'author': 'ថង វ៉ាន់ធៀវ'
    }

    collecting = False
    for b in front:
        p = plain(b['text'])
        t = clean(b['text'])
        if p == 'អារម្ភកថា':
            collecting = True
            continue
        if collecting:
            if 'សៀមរាប' in p:
                break
            if t:
                pref_paras.append(t)

    preface = {
        'title': 'អារម្ភកថា',
        'content': '\n\n'.join(pref_paras),
        'signOff': sign_off
    }

    # ---- Course Intro ----
    course_intro_content = (
        "## ១. ការពិពណ៌នាអំពីមុខវិជ្ជា\n\n"
        "មុខវិជ្ជា **គណិតវិទ្យាសម្រាប់កុំព្យូទ័រ (Mathematics for Computing)** គឺជាមុខវិជ្ជាគ្រឹះមួយដ៏សំខាន់បំផុត "
        "សម្រាប់និស្សិតដែលសិក្សាផ្នែកព័ត៌មានវិទ្យា និងបច្ចេកវិទ្យាព័ត៌មាន និងគមនាគមន៍ (ICT) នៅវិទ្យាស្ថានពហុបច្ចេកទេសភូមិភាគតេជោសែនសៀមរាប។\n\n"
        "ចំណេះដឹងដូចជា **តក្កវិទ្យា**, **ទ្រឹស្តីសំណុំ**, **ពីជគណិតប៊ូលៀន**, **ប្រព័ន្ធរាប់** និង **វិធីសាស្ត្រសម្រាយបញ្ជាក់** "
        "គឺជាមូលដ្ឋានគ្រឹះដែលកុំព្យូទ័រប្រើប្រាស់ក្នុងការគណនា ការរក្សាទុកទិន្នន័យ ការរចនាសៀគ្វីឌីជីថល (Digital Logic Design) "
        "និងជាគ្រឹះនៃក្បួនដោះស្រាយ (Algorithms) ព្រមទាំងការសរសេរកម្មវិធីកម្រិតខ្ពស់។\n\n"
        "## ២. គោលបំណងនៃមុខវិជ្ជា\n\n"
        "ក្រោយពីបានសិក្សាបញ្ចប់មុខវិជ្ជានេះ និស្សិតនឹងទទួលបានចំណេះដឹង និងសមត្ថភាពជាក់ស្តែងដូចខាងក្រោម៖\n"
        "- ចេះប្រើប្រាស់ឈ្នាប់តក្កវិទ្យា សង់តារាងភាពពិត និងវិភាគសុពលភាពនៃវិចារ\n"
        "- យល់ច្បាស់ពីប្រមាណវិធីលើសំណុំ និងការប្រើប្រាស់ដ្យាក្រាមវិនដោះស្រាយបញ្ហាជាក់ស្តែង\n"
        "- ចេះរចនា និងសម្រួលសៀគ្វីតក្កវិទ្យាដោយប្រើពីជគណិតប៊ូលៀន\n"
        "- ស្ទាត់ជំនាញក្នុងការបម្លែង និងគណនានព្វន្តលើប្រព័ន្ធរាប់ (គោលពីរ គោលប្រាំបី គោលដប់ និងគោលដប់ប្រាំមួយ)\n"
        "- យល់ពីរបៀបដែលកុំព្យូទ័ររក្សាទុកទិន្នន័យ (Sign-magnitude, 2's Complement, Floating Point និង BCD)\n"
        "- ចេះប្រើវិធីសាស្ត្រសម្រាយបញ្ជាក់បែបគណិតវិទ្យា និងវិចារកំណើនគណិតវិទ្យា (Mathematical Induction)\n\n"
        "## ៣. រចនាសម្ព័ន្ធមេរៀនទាំង ៦\n\n"
        "ឯកសារនេះត្រូវបានចងក្រងជា ៦ មេរៀនធំៗ អមដោយលំហាត់អនុវត្ត និងអត្រាកំណែដំណោះស្រាយលម្អិត៖\n"
        "1. **មេរៀនទី១៖ តក្កវិទ្យា (Logic)**\n"
        "2. **មេរៀនទី២៖ ទ្រឹស្តីសំណុំ (Set Theory)**\n"
        "3. **មេរៀនទី៣៖ ពីជគណិតប៊ូលៀន (Boolean Algebra)**\n"
        "4. **មេរៀនទី៤៖ ប្រព័ន្ធរាប់ (Number Systems)**\n"
        "5. **មេរៀនទី៥៖ ការអនុវត្តប្រព័ន្ធរាប់ (Applications of Number Systems)**\n"
        "6. **មេរៀនទី៦៖ វិធីសាស្ត្រសម្រាយបញ្ជាក់ (Methods of Proof)**"
    )
    course_intro = {
        'title': 'សេចក្តីផ្តើមនៃមុខវិជ្ជា',
        'content': course_intro_content
    }

    # ---- Clean and prepare image directory ----
    if os.path.isdir(IMG_DIR):
        shutil.rmtree(IMG_DIR)
    images = ImageWriter(docx)

    # ---- Lessons parsing (Heading 1 with មេរៀនទីX) ----
    lessons = []
    sol_h1_index = None
    ref_h1_index = None

    for idx, start in enumerate(h1_indices):
        title_block = blocks[start]
        t = plain(title_block['text'])
        m_les = re.match(r'មេរៀន​?ទី([០-៩]+)\s*៖?\s*(.*)', t)
        if m_les:
            num = int(m_les.group(1).translate(KH2AR))
            lesson_id = f'lesson-{num:02d}'
            end = h1_indices[idx + 1] if idx + 1 < len(h1_indices) else len(blocks)

            # English subtitle often on the next block
            next_text = plain(blocks[start + 1]['text']) if start + 1 < end else ''
            en_sub = ''
            if next_text.startswith('(') and next_text.endswith(')'):
                en_sub = f" {next_text}"

            kh_title = clean(m_les.group(2)).strip(' ៖')
            full_title = f"{kh_title}{en_sub}" if en_sub else kh_title

            lb = LessonBuilder(docx, images, lesson_id)
            for b in blocks[start + 1:end]:
                if b['k'] == 'p':
                    # Skip English subtitle paragraph if already handled
                    if plain(b['text']) == next_text and en_sub:
                        continue
                    lb.paragraph(b)
                else:
                    lb.table(b)

            # Assign caption to figures from nearest heading
            for sec in lb.sections:
                heading = heading_for_caption(sec['title'])
                seen, per, imgs = {}, {}, []
                for it in sec['items']:
                    if it['type'] == 'subsection':
                        heading = heading_for_caption(it['title'])
                    elif it['type'] == 'image':
                        imgs.append((it, heading))
                        per[heading] = per.get(heading, 0) + 1
                for it, h in imgs:
                    seen[h] = seen.get(h, 0) + 1
                    it['caption'] = h + (f' រូបទី{str(seen[h]).translate(AR2KH)}' if per[h] > 1 else '')

            # Add solution link in exercise section if exists
            for sec in lb.sections:
                if 'លំហាត់' in sec['title']:
                    sec['items'].append({
                        'type': 'callout',
                        'kind': 'tip',
                        'text': f'💡 **អត្រាកំណែលំហាត់៖** អ្នកអាចផ្ទៀងផ្ទាត់ចម្លើយ និងដំណោះស្រាយលម្អិតនៃលំហាត់ទាំងនេះបាននៅ [អត្រាកំណែមេរៀនទី{str(num).translate(AR2KH)}](#solution-{num:02d})។'
                    })

            # Map to chapter
            if num in (1, 2):
                chap_id = 'chapter-1'
                chap_title = 'ជំពូកទី១៖ តក្កវិទ្យា និងទ្រឹស្តីសំណុំ'
                icon = 'check-circle'
            elif num == 3:
                chap_id = 'chapter-2'
                chap_title = 'ជំពូកទី២៖ ពីជគណិតប៊ូលៀន និងសៀគ្វីឌីជីថល'
                icon = 'cpu'
            elif num in (4, 5):
                chap_id = 'chapter-3'
                chap_title = 'ជំពូកទី៣៖ ប្រព័ន្ធរាប់ និងការអនុវត្តក្នុងកុំព្យូទ័រ'
                icon = 'hash'
            else:
                chap_id = 'chapter-4'
                chap_title = 'ជំពូកទី៤៖ វិធីសាស្ត្រសម្រាយបញ្ជាក់'
                icon = 'compass'

            page_st = toc_pages.get(lesson_id, 1)

            lessons.append({
                'id': lesson_id,
                'number': num,
                'chapterId': chap_id,
                'chapterTitle': chap_title,
                'title': full_title,
                'pageStart': page_st,
                'pageEnd': None,
                'icon': icon,
                'objectives': lb.objectives,
                'sections': lb.sections
            })

        elif 'អត្រាកំណែ' in t:
            sol_h1_index = start
        elif 'ឯកសារយោង' in t:
            ref_h1_index = start

    # ---- Exercise Solutions (Heading 1: អត្រាកំណែលំហាត់) ----
    if sol_h1_index is not None:
        sol_end = ref_h1_index if ref_h1_index else len(blocks)
        sol_blocks = blocks[sol_h1_index:sol_end]

        # Find heading 2 inside solutions: មេរៀនទី១ ដល់ មេរៀនទី៦
        h2_sol = [i for i, b in enumerate(sol_blocks) if b['k'] == 'p' and b['style'] == 'heading 2']
        for idx, start in enumerate(h2_sol):
            t = plain(sol_blocks[start]['text'])
            m_sol = re.match(r'មេរៀន​?ទី([០-៩]+)\s*៖?\s*(.*)', t)
            if not m_sol:
                continue
            num = int(m_sol.group(1).translate(KH2AR))
            sol_id = f'solution-{num:02d}'
            end = h2_sol[idx + 1] if idx + 1 < len(h2_sol) else len(sol_blocks)

            lb = LessonBuilder(docx, images, sol_id)
            # Add top navigation callout
            lb.add({
                'type': 'callout',
                'kind': 'tip',
                'text': f'📘 **ខ្លឹមសារមេរៀន៖** ត្រឡប់ទៅមើល [មេរៀនទី{str(num).translate(AR2KH)}៖ {lessons[num-1]["title"]}](#lesson-{num:02d})។'
            })

            for b in sol_blocks[start + 1:end]:
                if b['k'] == 'p':
                    # If this paragraph starts with an exercise number (e.g. ១.១, ១.២), treat as section
                    txt = plain(b['text'])
                    if re.match(r'^[០-៩0-9]+\.[០-៩0-9]+\b', txt):
                        lb.section(b['text'])
                    else:
                        lb.paragraph(b)
                else:
                    lb.table(b)

            # Captions for images in solutions
            for sec in lb.sections:
                heading = heading_for_caption(sec['title'])
                seen, per, imgs = {}, {}, []
                for it in sec['items']:
                    if it['type'] == 'image':
                        imgs.append((it, heading))
                        per[heading] = per.get(heading, 0) + 1
                for it, h in imgs:
                    seen[h] = seen.get(h, 0) + 1
                    it['caption'] = h + (f' រូបទី{str(seen[h]).translate(AR2KH)}' if per[h] > 1 else '')

            page_st = toc_pages.get(sol_id, 100 + num * 12)
            lessons.append({
                'id': sol_id,
                'number': num,
                'chapterId': 'chapter-solutions',
                'chapterTitle': 'ផ្នែកពិសេស៖ អត្រាកំណែលំហាត់',
                'title': f'អត្រាកំណែមេរៀនទី{str(num).translate(AR2KH)} ({lessons[num-1]["title"]})',
                'pageStart': page_st,
                'pageEnd': None,
                'icon': 'check-square',
                'objectives': [
                    f'ពិនិត្យ និងផ្ទៀងផ្ទាត់ដំណោះស្រាយលម្អិតនៃលំហាត់អនុវត្តមេរៀនទី{str(num).translate(AR2KH)}',
                    'ស្វែងយល់ពីរបៀបសរសេរសម្រាយបញ្ជាក់ និងការសង់តារាងភាពពិតឱ្យបានត្រឹមត្រូវ'
                ],
                'sections': lb.sections
            })

    # Set pageEnd for each lesson and solution
    for i, l in enumerate(lessons):
        if i + 1 < len(lessons):
            nxt = lessons[i + 1]['pageStart']
            l['pageEnd'] = (nxt - 1) if nxt else l['pageStart']
        else:
            l['pageEnd'] = (ref_page - 1) if ref_page else l['pageStart']

    # ---- References ----
    references = [
        {
            'author': 'Seymour Lipschutz',
            'year': '1982',
            'title': 'Essential Computer Mathematics',
            'publisher': "Schaum's Outline Series, McGraw-Hill, USA"
        },
        {
            'author': 'Kenneth H. Rosen',
            'year': '2007',
            'title': 'Discrete Mathematics and Its Applications',
            'publisher': 'Sixth Edition, McGraw-Hill'
        },
        {
            'author': 'យឹម អាយុវឌ្ឍនៈ',
            'year': '២០១១',
            'title': 'ពីជគណិតអរូបីទី១',
            'publisher': 'សាកលវិទ្យាល័យអង្គរខេមរា'
        }
    ]

    # ---- Chapters definition ----
    chapters = [
        {
            'id': 'chapter-1',
            'number': 'ជំពូកទី១',
            'title': 'តក្កវិទ្យា និងទ្រឹស្តីសំណុំ',
            'lessonRange': 'មេរៀនទី១ និង ទី២',
            'description': 'មូលដ្ឋានគ្រឹះតក្កវិទ្យា សំណើ ឈ្នាប់តក្កវិទ្យា សមមូល និងប្រមាណវិធីលើសំណុំ',
            'icon': 'check-circle',
            'lessons': ['lesson-01', 'lesson-02']
        },
        {
            'id': 'chapter-2',
            'number': 'ជំពូកទី២',
            'title': 'ពីជគណិតប៊ូលៀន និងសៀគ្វីឌីជីថល',
            'lessonRange': 'មេរៀនទី៣',
            'description': 'ច្រកតក្កវិទ្យា OR, AND, NOT, NAND, NOR សៀគ្វីកុងតាក់ និងការសម្រួលអនុគមន៍ប៊ូលៀន',
            'icon': 'cpu',
            'lessons': ['lesson-03']
        },
        {
            'id': 'chapter-3',
            'number': 'ជំពូកទី៣',
            'title': 'ប្រព័ន្ធរាប់ និងការអនុវត្តក្នុងកុំព្យូទ័រ',
            'lessonRange': 'មេរៀនទី៤ និង ទី៥',
            'description': 'ប្រព័ន្ធគោល ២, ៨, ១០, ១៦ វិធីនព្វន្តកុំព្យូទ័រ ការរក្សាទុកទិន្នន័យ (Sign-magnitude, 2\'s Complement) និងកូដ BCD',
            'icon': 'hash',
            'lessons': ['lesson-04', 'lesson-05']
        },
        {
            'id': 'chapter-4',
            'number': 'ជំពូកទី៤',
            'title': 'វិធីសាស្ត្រសម្រាយបញ្ជាក់',
            'lessonRange': 'មេរៀនទី៦',
            'description': 'ចំនួនគត់ តម្លៃដាច់ខាត ភាពចែកដាច់ ស៊ីត ស៊េរី និងវិធីសាស្ត្រសម្រាយបញ្ជាក់បែបគណិតវិទ្យា',
            'icon': 'compass',
            'lessons': ['lesson-06']
        },
        {
            'id': 'chapter-solutions',
            'number': 'ផ្នែកពិសេស',
            'title': 'អត្រាកំណែលំហាត់',
            'lessonRange': 'កំណែមេរៀនទី១ ដល់ ទី៦',
            'description': 'ដំណោះស្រាយលម្អិតជាជំហានៗ និងតារាងភាពពិតសម្រាប់លំហាត់អនុវត្តទាំងអស់',
            'icon': 'check-square',
            'lessons': ['solution-01', 'solution-02', 'solution-03', 'solution-04', 'solution-05', 'solution-06']
        }
    ]

    meta = {
        'titleKh': 'គណិតវិទ្យាសម្រាប់កុំព្យូទ័រ',
        'titleEn': 'Mathematics for Computing',
        'author': 'ថង វ៉ាន់ធៀវ',
        'institutionKh': 'វិទ្យាស្ថានពហុបច្ចេកទេសភូមិភាគតេជោសែនសៀមរាប',
        'institutionEn': 'Regional Polytechnic Institute Techo Sen Siem Reap (RPITSSR)',
        'year': '២០២៦',
        'coverImage': 'images/cover.webp',
        'logoImage': 'images/logo.webp',
        'totalLessons': len(lessons),
        'totalChapters': len(chapters),
        'totalPages': ref_page
    }

    data = {
        'meta': meta,
        'preface': preface,
        'courseIntro': course_intro,
        'chapters': chapters,
        'lessons': lessons,
        'references': references
    }

    header = ('/* Course content generated from the Word book by tools/build_course_data.py.\n'
              '   Edit the Word file and re-run the script instead of editing this file by hand. */\n')
    open(DATA_PATH, 'w', encoding='utf-8').write(
        header + 'window.COURSE_DATA = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')

    print(f'Done! Lessons & Solutions: {len(lessons)} | Images: {len(images.done)} '
          f'({images.bytes_in / 1e6:.2f} MB -> {images.bytes_out / 1e6:.2f} MB) | References: {len(references)}')


if __name__ == '__main__':
    docx_file = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'គណិតវិទ្យាសម្រាប់កុំព្យូទ័រ.docx')
    main(docx_file)
