---
name: docx-to-math-web
description: >-
  Extracts, parses, and updates mathematics course lessons from Microsoft Word (.docx) books into this responsive web learning platform. Handles recursive OMML-to-KaTeX math formula conversion, extracts diagrams and circuits to optimized WebP images, aligns printed book page ranges, and compiles js/course-data.js. Use whenever the user wants to update lesson content, rebuild the course from a Word document, add new exercises, or maintain mathematical rendering on this website.
---

# Word (.docx) to Mathematics Web Platform Builder

This skill provides the comprehensive procedure for parsing Microsoft Word (`.docx`) mathematics textbooks, converting complex math formulas and diagrams into clean web representations, and generating `js/course-data.js` for this offline-ready PWA platform.

## Architecture & File Roles

```text
math_website/
├── គណិតវិទ្យាសម្រាប់កុំព្យូទ័រ.docx      # Source Word textbook (OpenXML + OMML)
├── tools/
│   └── build_course_data.py            # Main OpenXML parser & compiler
├── js/
│   ├── course-data.js                  # Generated course database
│   └── app.js                          # SPA router, UI engine, KaTeX renderer
├── vendor/katex/                       # Offline KaTeX (CSS, JS, 20 WOFF2 fonts)
├── images/lessons/                     # Extracted WebP diagrams & circuits
└── sw.js                               # Service Worker offline caching (v4)
```

---

## Step-by-Step Workflow

### Step 1: Prepare the Source Word Document
Place the latest `.docx` file in the project root directory (e.g., `គណិតវិទ្យាសម្រាប់កុំព្យូទ័រ.docx`). Ensure the document contains:
1. Standard Word headings (`Heading 1` for `មេរៀនទីX` and `អត្រាកំណែលំហាត់`, `Heading 2` for sections).
2. Clean OMML equations (`<m:oMath>` or `<m:oMathPara>`).
3. Embedded diagrams and figures in DrawingML (`<a:blip>`) or VML (`<v:imagedata>`).

### Step 2: Run the Course Data Compiler
Execute the compilation script targeting the Word document:

```bash
python3 tools/build_course_data.py "គណិតវិទ្យាសម្រាប់កុំព្យូទ័រ.docx"
```

The script will:
* Recursively traverse paragraph runs and hyperlinks (`w:hyperlink`) to collect all text without losing inline content.
* Translate OMML math elements to KaTeX LaTeX strings wrapped in `$ ... $`.
* Extract diagram images from `word/media/`, convert them to WebP format using `sips` / `cwebp`, and store them in `images/lessons/lesson-XX/` and `solution-XX/`.
* Parse printed Table of Contents (TOC) entries to assign accurate `pageStart` and `pageEnd` matching the physical book.
* Output structured JSON into `js/course-data.js`.

### Step 3: Verify Mathematical Formula Syntax
Refer to [Mathematical Formula Mapping Reference](./references/math-mappings.md) to ensure proper symbol conversions:
* **Logic:** $\land, \lor, \sim, \to, \leftrightarrow, \forall, \exists$.
* **Sets:** $\cup, \cap, \subseteq, \setminus, \emptyset$.
* **Boolean:** Inversion overbars $\overline{A}$, XOR $\oplus$, NAND, NOR.
* **Proofs & Calculus:** Fractions $\frac{a}{b}$, square roots $\sqrt{x}$, summations $\sum$, limits $\lim$.

### Step 4: Validate Course Data & Asset Integrity
Run the built-in validation script:

```bash
python3 .agents/skills/docx-to-math-web/scripts/verify_course_data.py
```

Ensure all 12 items (6 lessons + 6 solution guides) pass, image assets exist, and page numbers are sequential.

### Step 5: Test UI & Search Index in Browser
Start a local HTTP server to verify the changes:

```bash
python3 -m http.server 8000
```

1. Navigate to `http://localhost:8000/#lesson-01`.
2. Verify KaTeX renders without LaTeX errors or unescaped tokens.
3. Test the search modal (`Cmd+K` or search bar) with Khmer terms (e.g. `តារាងភាពពិត`, `ប៊ូលៀន`, `ដ្យាក្រាមវិន`) and English terms (`De Morgan`, `BCD`).
4. Check that dark/light theme toggle, font resizing, and completion checkboxes work seamlessly.

### Step 6: Commit and Push Updates
Commit updated `course-data.js`, images, and source scripts to Git:

```bash
git add js/course-data.js images/lessons/
git commit -m "Update mathematics lessons from Word document"
git push origin main
```

---

## Important Constraints & Best Practices

1. **Khmer Typography:** Always retain `'Kantumruy Pro'` as the primary font in `css/style.css` to prevent subscript and vowel glyph overlapping.
2. **Offline KaTeX:** Do not point KaTeX script tags to external CDNs. Always load from `vendor/katex/katex.min.js` to support completely offline study.
3. **Zero-Width Spaces:** When searching Khmer text, always strip `\u200b`, `\u200c`, and `\ufeff` so user typed keywords match document text.
