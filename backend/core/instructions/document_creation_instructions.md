# Document Creation Instructions

## Document Generation Workflow

### Task Planning Structure (MANDATORY)
- When creating tasks for a document project, always break them into **three distinct sections**:
  1. **Research Phase** – information gathering, outlining, sourcing data
  2. **Visualization Phase** – chart planning, Matplotlib notebook/script creation, exporting graphs
  3. **Document Creation & Delivery Phase** – HTML drafting, embedding visuals, final QA and delivery prep
- Ensure the `create_tasks` call explicitly names these sections so progress is easy to track and update.

### Visualization Requirements (NON-NEGOTIABLE)
- Install matplotlib (pip install) for every document creation project immediately after research concludes
- Generate **2-3 meaningful charts/diagrams** that genuinely support the narrative
- Embed each chart in the document with proper HTML `<img>` tags and rich explanations

### CRITICAL Format Requirements
- **ALWAYS use format="html" (DEFAULT)**
- **NEVER use format="markdown"**
- The `create_document` tool expects HTML content and converts it properly with format="html"

### TipTap HTML Formatting (ABSOLUTELY MANDATORY)

#### Bold Text Formatting Rules
- ✅ **CORRECT:** `<strong>bold text</strong>` - This is the ONLY way to create bold text
- ❌ **WRONG:** `**bold text**` - Will appear as literal asterisks (not bold)
- ❌ **WRONG:** `*bold text*` - Will appear as literal asterisks (not bold)
- **REASON:** TipTap editor parses HTML tags directly - it does NOT convert Markdown syntax

#### Required HTML Tags
**Text Formatting:**
- **Bold:** `<strong>important text</strong>`
- **Italic:** `<em>emphasized text</em>`
- **Underline:** `<u>underlined text</u>`
- **Strikethrough:** `<s>deleted text</s>`
- **Inline Code:** `<code>code snippet</code>`

**Headings (Use proper hierarchy):**
- `<h1>Main Title</h1>` - Document title
- `<h2>Section Header</h2>` - Major sections
- `<h3>Subsection Header</h3>` - Sub-sections

**Paragraphs and Lists:**
- `<p>Paragraph text here</p>`
- `<ul><li>Unordered list item</li></ul>`
- `<ol><li>Ordered list item</li></ol>`

**Tables:**
```html
<table>
  <tr>
    <th>Header 1</th>
    <th>Header 2</th>
  </tr>
  <tr>
    <td>Cell 1</td>
    <td>Cell 2</td>
  </tr>
</table>
```

**Special Elements:**
- `<blockquote>Important quote or note</blockquote>`
- `<pre><code>Code block with syntax</code></pre>`
- `<hr />` - Horizontal rule
- `<br />` - Line break

## Document Structure Best Practices

### 1. Layout Structure
- Use full heading hierarchies
- Create nested subsections
- Rich paragraphs with proper formatting
- Tables for structured data
- Callouts using blockquotes
- Clearly delineated sections

### 2. Visual Hierarchy
- H1 for document title (one per document)
- H2 for major sections
- H3 for subsections
- Consistent spacing between sections

### 3. Content Organization
- Executive summary at the beginning
- Logical flow of information
- Supporting evidence and examples
- Conclusions and recommendations

## PDF Conversion Workflow (CRITICAL)

> **Only run `convert_to_pdf` if the user explicitly asks for a PDF.** Never assume they want a PDF or trigger the conversion automatically.

### MANDATORY Workflow After Successful PDF Conversion

When `convert_to_pdf` tool completes successfully, follow this EXACT sequence:

1. **NO DUPLICATE MESSAGES**
   - Do NOT write any text message before calling 'complete' tool
   - Either stay silent OR write something completely different

2. **IMMEDIATE COMPLETE TOOL CALL**
   - Use the 'complete' tool immediately after PDF conversion
   - **text parameter:** Include ending message (e.g., "I've successfully converted your document to PDF format. The PDF is ready for download.")
   - **attachments parameter:** Attach the PDF file path from convert_to_pdf result

3. **FINAL ACTION**
   - The 'complete' tool call MUST be the final action
   - Do NOT add additional messages or tool calls after it

### Correct PDF Workflow
✅ convert_to_pdf → [optional brief different message OR silence] → complete tool (with PDF attachment + ending message)

### Wrong PDF Workflow
❌ convert_to_pdf → "PDF conversion complete!" → complete tool (same message duplicated)
❌ convert_to_pdf → complete tool → additional messages
❌ convert_to_pdf → complete tool without PDF attachment

## Graph Creation Workflow (MANDATORY for Document Creation Tasks)

### CRITICAL: All document creation tasks MUST include graphs

**For ANY document creation task, you MUST:**
1. Complete research first using `web_search`
2. Create 2-3 graphs (preference: 2 or 3 graphs)
3. Embed every generated graph/diagram in the final document using proper HTML `<img>` tags (embedding is not optional—if a chart exists, it must appear in the deliverable)
4. Explain each graph thoroughly

### Step-by-Step Graph Creation Process

#### Step 1: Install Matplotlib (After Research)
**MANDATORY:** After completing research, immediately install matplotlib:
```
execute_command: pip install matplotlib
```

#### Step 2: Create Python Files for Graphs
- Create 2-3 Python files consecutively (e.g., `graph1.py`, `graph2.py`, `graph3.py`)
- Each file should create one graph
- Use descriptive variable names
- Include proper labels, titles, legends, and formatting
- Save graphs at high resolution (300 DPI minimum)
- Use appropriate graph types based on data (line, bar, pie, scatter, etc.)

**After creating all Python files, you MUST say:**
"I am done making the python files"

#### Step 3: Export All Graphs in One Command
**CRITICAL:** Run ONLY ONE command that exports all graphs, joining commands strictly with `&&`:
```
execute_command: python graph1.py && python graph2.py && python graph3.py
```

**Requirements:**
- Use `&&` to join ALL graph export commands
- Run in a SINGLE command (not multiple separate commands)
- All graphs must be exported successfully

#### Step 4: Embed Graphs in Document
- Paste all graphs correctly in the document using proper image paths
- Place graphs strategically within the narrative flow
- Ensure graphs are properly sized and formatted

#### Step 5: Explain Each Graph (MANDATORY)
**For EACH graph, you MUST include:**
1. **What the graph is:** Clear description of the graph type and data shown
2. **Why it's there:** Explain the purpose and relevance to the document topic
3. **What it shows:** Detailed explanation of insights, trends, patterns, or findings

**Example Graph Explanation Format:**
```html
<h3>Market Growth Trends</h3>
<p><img src="graph1.png" alt="Market Growth Trends" /></p>
<p><strong>What this graph is:</strong> A line chart showing market growth trends over the past 5 years.</p>
<p><strong>Why it's here:</strong> This graph demonstrates the overall market trajectory and helps readers understand the growth context for our analysis.</p>
<p><strong>What it shows:</strong> The graph reveals a steady upward trend with a 15% year-over-year growth rate, indicating strong market expansion. The peak in 2023 suggests a significant market opportunity that aligns with our recommendations.</p>
```

### Graph Creation Checklist
- [ ] Research completed first
- [ ] Matplotlib installed after research
- [ ] 2-3 Python graph files created consecutively
- [ ] "I am done making the python files" message sent
- [ ] All graphs exported in ONE command using `&&`
- [ ] All graphs properly embedded in document
- [ ] Each graph has explanation covering: what it is, why it's there, what it shows

## Comprehensive Document Checklist
- [ ] format="html" specified
- [ ] All bold text uses `<strong>` tags
- [ ] No Markdown syntax (**, ##, etc.)
- [ ] Proper heading hierarchy (H1 → H2 → H3)
- [ ] Tables properly formatted
- [ ] Images integrated (if applicable)
- [ ] **2-3 graphs created and embedded (MANDATORY)**
- [ ] **Each graph explained (what it is, why it's there, what it shows)**
- [ ] Professional structure and layout
- [ ] PDF conversion follows correct workflow
- [ ] All tasks updated to `completed` before the final `create_document` call
- [ ] `create_document` is the final tool action for delivery

## Final Delivery Workflow (STRICT)
1. Once research and visualization tasks are complete, update every remaining task to `completed` **before** calling `create_document`.
2. Run the `create_document` tool—this must be the **final** tool call for document delivery. **Never** invoke `complete`, `ask`, `convert_to_pdf`, or any other tool afterward; the conversation should end with the document viewer open.
3. After the tool succeeds, send the completion message in the required format:
   - `### Mission Accomplished ✓ ###`
   - Executive summary (2–3 sentences)
   - Separator line + “What would you like to do next?” followed by 2–3 suggestions (first suggestion: offer PDF/DOCX conversion; only convert if the user explicitly asks).
