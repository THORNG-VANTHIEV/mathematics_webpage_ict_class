# Mathematical Formula Mapping Reference (OMML to KaTeX)

This document details how OpenXML Math Markup Language (OMML) elements from Microsoft Word (.docx) map to KaTeX-compatible LaTeX in this course platform.

## 1. Logic Symbols (មេរៀនទី១៖ តក្កវិទ្យា)

| Symbol | Name (Khmer) | Name (English) | LaTeX Syntax | Unicode Fallback |
| :--- | :--- | :--- | :--- | :--- |
| $\land$ | ឈ្នាប់ «និង» (ឈ្នាប់ឈាន) | Conjunction (AND) | `\land` | `∧` (`\u2227`) |
| $\lor$ | ឈ្នាប់ «ឬ» (ឈ្នាប់រាយ) | Disjunction (OR) | `\lor` | `∨` (`\u2228`) |
| $\sim$ or $\neg$ | ឈ្នាប់ «មិន» (បដិសេធ) | Negation (NOT) | `\sim` or `\neg` | `∼` (`\u223c`), `¬` |
| $\to$ | ឈ្នាប់ «នាំឱ្យ» (លក្ខខណ្ឌ) | Conditional (Implies) | `\to` or `\rightarrow` | `→` (`\u2192`) |
| $\leftrightarrow$ | ឈ្នាប់ «សមមូល» (ទ្វេលក្ខខណ្ឌ) | Biconditional (IFF) | `\leftrightarrow` | `↔` (`\u2194`) |
| $\equiv$ | សមមូលតក្កវិទ្យា | Logical Equivalence | `\equiv` | `≡` (`\u2261`) |
| $\forall$ | បរិមាណករសកល | Universal Quantifier | `\forall` | `∀` (`\u2200`) |
| $\exists$ | បរិមាណករអត្ថិភាព | Existential Quantifier | `\exists` | `∃` (`\u2203`) |
| $T$ / $F$ | តម្លៃភាពពិត (ពិត / មិនពិត) | Truth Values | `T` / `F` or `1` / `0` | - |

## 2. Set Theory Symbols (មេរៀនទី២៖ ទ្រឹស្តីសំណុំ)

| Symbol | Name (Khmer) | Name (English) | LaTeX Syntax | Notes |
| :--- | :--- | :--- | :--- | :--- |
| $\in$ | ជារបស់ | Element of | `\in` | `x \in A` |
| $\notin$ | មិនជារបស់ | Not an element of | `\notin` | `x \notin A` |
| $\subseteq$ | សំណុំរង | Subset | `\subseteq` | `A \subseteq B` |
| $\subset$ | សំណុំរងពិត | Proper Subset | `\subset` | `A \subset B` |
| $\cup$ | ប្រមាណវិធីប្រជុំ | Union | `\cup` | `A \cup B` |
| $\cap$ | ប្រមាណវិធីប្រសព្វ | Intersection | `\cap` | `A \cap B` |
| $\setminus$ / $-$ | ផលដកសំណុំ | Difference | `\setminus` or `-` | `A \setminus B` |
| $A'$ / $\overline{A}$ | សំណុំបំពេញ | Complement of Set | `A'` or `\overline{A}` | `\overline{A}` maps from `<m:bar>` |
| $\emptyset$ | សំណុំទទេ | Empty Set | `\emptyset` | `\emptyset` |
| $U$ | សំណុំសកល | Universal Set | `U` | - |
| $\mathcal{P}(A)$ | សំណុំស្វ័យគុណ | Power Set | `\mathcal{P}(A)` | - |
| $n(A)$ / $|A|$ | កាឌីណាល់នៃសំណុំ | Cardinality | `n(A)` or `|A|` | - |

## 3. Boolean Algebra & Logic Gates (មេរៀនទី៣៖ ពីជគណិតប៊ូលៀន)

| Expression | Meaning | LaTeX Syntax | OMML XML Tag |
| :--- | :--- | :--- | :--- |
| $\overline{A}$ | NOT A (Inversion) | `\overline{A}` | `<m:bar>` with `<m:pos m:val="top"/>` |
| $A \cdot B$ or $AB$ | AND (Conjunction) | `A \cdot B` | `<m:r>` with `\cdot` |
| $A + B$ | OR (Disjunction) | `A + B` | - |
| $A \oplus B$ | XOR (Exclusive OR) | `A \oplus B` | `<m:r>` with `\oplus` |
| $\overline{A \cdot B}$ | NAND | `\overline{A \cdot B}` | `<m:bar>` wrapping expression |
| $\overline{A + B}$ | NOR | `\overline{A + B}` | `<m:bar>` wrapping expression |

## 4. Number Systems & Binary (មេរៀនទី៤ & ទី៥)

| Expression | Meaning | LaTeX Syntax |
| :--- | :--- | :--- |
| $(1011)_2$ | ចំនួនក្នុងគោលពីរ | `(1011)_2` or `(1011)_{\text{bin}}` |
| $(75)_8$ | ចំនួនក្នុងគោលប្រាំបី | `(75)_8` or `(75)_{\text{oct}}` |
| $(255)_{10}$ | ចំនួនក្នុងគោលដប់ | `(255)_{10}` or `(255)_{\text{dec}}` |
| $(2\text{AF})_{16}$ | ចំនួនក្នុងគោលដប់ប្រាំមួយ | `(2\text{AF})_{16}` or `(2\text{AF})_{\text{hex}}` |
| $2^n$ | ស្វ័យគុណ | `2^n` |
| $a \equiv b \pmod{m}$ | នព្វន្តម៉ូឌុល | `a \equiv b \pmod{m}` |

## 5. Mathematical Proofs & Series (មេរៀនទី៦៖ វិធីសាស្ត្រសម្រាយបញ្ជាក់)

| Expression | Meaning | LaTeX Syntax | OMML XML Tag |
| :--- | :--- | :--- | :--- |
| $\sum_{i=1}^n i$ | ផលបូកស៊េរី (Summation) | `\sum_{i=1}^n i` | `<m:nary>` with `<m:naryPr><m:chr m:val="∑"/>` |
| $\lim_{n \to \infty}$ | លីមីត | `\lim_{n \to \infty}` | `<m:limLow>` with base `lim` |
| $\sqrt{x^2 + 1}$ | ឫសការ៉េ | `\sqrt{x^2 + 1}` | `<m:rad>` |
| $\frac{a}{b}$ | ប្រភាគ | `\frac{a}{b}` | `<m:f>` |
| $a_n = a_{n-1} + d$ | ស៊ីតនព្វន្ត | `a_n = a_{n-1} + d` | `<m:sSub>` |
| $a \mid b$ | ចែកដាច់ ($a$ ចែកដាច់ $b$) | `a \mid b` | `\mid` |
| $a \nmid b$ | មិនចែកដាច់ | `a \nmid b` | `\nmid` |
| $\blacksquare$ or $\text{Q.E.D.}$ | សញ្ញាបញ្ជាក់ចប់សម្រាយបញ្ជាក់ | `\blacksquare` | `\blacksquare` |

