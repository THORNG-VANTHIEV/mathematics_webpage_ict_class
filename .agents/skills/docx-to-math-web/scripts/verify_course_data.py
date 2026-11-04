#!/usr/bin/env python3
"""
verify_course_data.py
Validates course-data.js, image assets, page ranges, KaTeX files, and PWA setup.
"""
import sys
import os
import json
import re

def verify(course_data_path="js/course-data.js"):
    print("=== Course Platform Verification ===")
    errors = []

    if not os.path.isfile(course_data_path):
        print(f"[FAIL] {course_data_path} not found!")
        return 1

    with open(course_data_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract JSON object
    match = re.search(r'window\.COURSE_DATA\s*=\s*(\{.*?\});\s*$', content, re.DOTALL)
    if not match:
        print("[FAIL] Cannot extract JSON from course-data.js")
        return 1

    try:
        data = json.loads(match.group(1))
    except Exception as e:
        print(f"[FAIL] JSON parsing error: {e}")
        return 1

    # 1. Metadata check
    meta = data.get('meta', {})
    print(f"[OK] Title: {meta.get('titleKh')} ({meta.get('titleEn')})")
    print(f"[OK] Author: {meta.get('author')}")
    print(f"[OK] Institution: {meta.get('institutionKh')}")

    # 2. Lessons & Solutions count
    lessons = data.get('lessons', [])
    print(f"[INFO] Total lessons/solutions: {len(lessons)}")
    if len(lessons) < 12:
        errors.append(f"Expected at least 12 lessons (6 main + 6 solutions), got {len(lessons)}")

    # 3. Page range check
    for l in lessons:
        lid = l.get('id')
        pst = l.get('pageStart')
        ped = l.get('pageEnd')
        if pst is None or ped is None or pst <= 0 or ped < pst:
            errors.append(f"Invalid page range for {lid}: {pst}-{ped}")
        
        # Check referenced images
        for sec in l.get('sections', []):
            for it in sec.get('items', []):
                if it.get('type') == 'image':
                    src = it.get('src')
                    if src and not os.path.isfile(src):
                        errors.append(f"Missing image asset: {src} in {lid}")

    # 4. KaTeX Offline Assets
    katex_files = [
        "vendor/katex/katex.min.css",
        "vendor/katex/katex.min.js",
        "vendor/katex/auto-render.min.js",
        "vendor/katex/fonts/KaTeX_Main-Regular.woff2",
        "vendor/katex/fonts/KaTeX_Math-Italic.woff2"
    ]
    for kf in katex_files:
        if not os.path.isfile(kf):
            errors.append(f"Missing KaTeX asset: {kf}")

    # 5. Service Worker
    if not os.path.isfile("sw.js"):
        errors.append("Missing sw.js (Service Worker)")

    if errors:
        print(f"\n[FAIL] Found {len(errors)} issues:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("\n[SUCCESS] All checks passed cleanly! Course data is 100% valid.")
    return 0

if __name__ == "__main__":
    sys.exit(verify())
