# Document Creation Instructions

## Document Generation Workflow

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

## Comprehensive Document Checklist
- [ ] format="html" specified
- [ ] All bold text uses `<strong>` tags
- [ ] No Markdown syntax (**, ##, etc.)
- [ ] Proper heading hierarchy (H1 → H2 → H3)
- [ ] Tables properly formatted
- [ ] Images integrated (if applicable)
- [ ] Professional structure and layout
- [ ] PDF conversion follows correct workflow
