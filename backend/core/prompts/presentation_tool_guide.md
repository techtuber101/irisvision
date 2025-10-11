# Professional Presentation Tool - Complete Guide

## Overview
The Professional Presentation Tool creates stunning, professional-grade presentations with beautiful themes and layouts. It's designed to be simple, reliable, and produce amazing results.

## Available Tools

### 1. `create_slide` - Create Individual Slides
Creates or updates a single slide in a presentation.

**Parameters:**
- `presentation_id` (required): Unique identifier (e.g., "company_overview", "sales_pitch_2024")
- `slide_number` (required): Slide number starting from 1
- `title` (required): Short descriptive title for the slide
- `content` (required): HTML content for the slide body
- `theme` (optional): Visual theme - "modern" (default), "minimal", "dark", "corporate", or "vibrant"

**Example:**
```python
create_slide(
    presentation_id="product_launch",
    slide_number=1,
    title="Welcome",
    content="""
        <h1>Welcome to Our Product Launch</h1>
        <p class="text-large text-center">Revolutionizing the Industry</p>
        <div class="text-center icon-large">
            <i class="fas fa-rocket"></i>
        </div>
    """,
    theme="modern"
)
```

### 2. `list_slides` - View All Slides
Lists all slides in a presentation with their metadata.

**Parameters:**
- `presentation_id` (required): ID of the presentation

### 3. `list_presentations` - View All Presentations
Lists all presentations in the workspace.

### 4. `finalize_presentation` - Complete the Presentation
Finalizes the presentation, updates all slide footers, and prepares it for delivery.

**Parameters:**
- `presentation_id` (required): ID of the presentation
- `presentation_title` (required): Human-readable title
- `description` (optional): Brief description

## Themes

### Modern (Default)
- Beautiful gradient purple background
- White text on colorful backdrop
- Perfect for tech, startups, innovation
- High contrast, professional look

### Minimal
- Clean white background
- Dark text, simple borders
- Perfect for corporate, reports, data
- Professional and understated

### Dark
- Dark gradient blue-grey background
- Light text, cyan accents
- Perfect for technical, evening presentations
- Easy on the eyes, modern

### Corporate
- Navy blue solid background  
- White text, orange accents
- Perfect for business, formal presentations
- Traditional yet modern

### Vibrant
- Gradient pink-red background
- White text, gold accents
- Perfect for creative, energetic topics
- Eye-catching and bold

## Content Styling

### HTML Elements
Always wrap content in proper HTML tags:
- `<h1>` - Main slide title (72px, bold)
- `<h2>` - Section headers (48px, semi-bold)
- `<p>` - Paragraphs (32px)
- `<ul>`/`<ol>` and `<li>` - Lists
- `<strong>` - Bold text (shows in accent color)
- `<em>` - Italic text (shows in accent color)
- `<code>` - Inline code
- `<pre><code>` - Code blocks

### Helper Classes

**Cards** - Beautiful content containers:
```html
<div class="card">
    <h2>Card Title</h2>
    <p>Card content goes here</p>
</div>
```

**Grids** - Multi-column layouts:
```html
<div class="grid grid-2">
    <div class="card">Column 1</div>
    <div class="card">Column 2</div>
</div>

<div class="grid grid-3">
    <div class="card">Column 1</div>
    <div class="card">Column 2</div>
    <div class="card">Column 3</div>
</div>
```

**Highlights** - Emphasized content blocks:
```html
<div class="highlight">
    <p>Important information highlighted with accent border</p>
</div>
```

**Text Utilities**:
- `.text-center` - Center-aligned text
- `.text-large` - Larger text (48px)
- `.text-huge` - Huge text (64px)

**Icons** - Font Awesome icons:
```html
<i class="fas fa-rocket icon-large"></i>
<i class="fas fa-chart-line icon-large"></i>
<i class="fas fa-users icon-large"></i>
```

Common icons: rocket, chart-line, users, lightbulb, check-circle, star, trophy, heart, cog, globe, database, shield, bolt, fire, cloud, mobile

## Best Practices

### 1. Title Slide (Slide 1)
```html
<h1>Presentation Title</h1>
<p class="text-large text-center">Subtitle or tagline</p>
<div class="text-center icon-large">
    <i class="fas fa-relevant-icon"></i>
</div>
```

### 2. Content Slides with Bullets
```html
<h1>Key Points</h1>
<ul>
    <li><strong>Point 1:</strong> Description</li>
    <li><strong>Point 2:</strong> Description</li>
    <li><strong>Point 3:</strong> Description</li>
</ul>
```

### 3. Two-Column Comparison
```html
<h1>Comparison</h1>
<div class="grid grid-2">
    <div class="card">
        <h2><i class="fas fa-check-circle"></i> Before</h2>
        <ul>
            <li>Point 1</li>
            <li>Point 2</li>
        </ul>
    </div>
    <div class="card">
        <h2><i class="fas fa-star"></i> After</h2>
        <ul>
            <li>Improvement 1</li>
            <li>Improvement 2</li>
        </ul>
    </div>
</div>
```

### 4. Feature Showcase (3 columns)
```html
<h1>Our Features</h1>
<div class="grid grid-3">
    <div class="card text-center">
        <i class="fas fa-rocket icon-large"></i>
        <h2>Fast</h2>
        <p>Lightning-fast performance</p>
    </div>
    <div class="card text-center">
        <i class="fas fa-shield icon-large"></i>
        <h2>Secure</h2>
        <p>Bank-level security</p>
    </div>
    <div class="card text-center">
        <i class="fas fa-users icon-large"></i>
        <h2>Collaborative</h2>
        <p>Work together seamlessly</p>
    </div>
</div>
```

### 5. Highlighted Quote or Key Message
```html
<h1>Remember</h1>
<div class="highlight text-center">
    <p class="text-huge"><strong>"Key quote or message"</strong></p>
    <p class="text-large"><em>- Attribution</em></p>
</div>
```

### 6. Thank You / Closing Slide
```html
<div class="text-center">
    <h1 class="text-huge">Thank You!</h1>
    <p class="text-large">Questions?</p>
    <div class="icon-large">
        <i class="fas fa-heart"></i>
    </div>
</div>
```

## Complete Workflow Example

```python
# Step 1: Create title slide
create_slide(
    presentation_id="sales_pitch_2024",
    slide_number=1,
    title="Title",
    content="""
        <h1>Revolutionizing Sales in 2024</h1>
        <p class="text-large text-center">The Future is Here</p>
        <div class="text-center icon-large">
            <i class="fas fa-rocket"></i>
        </div>
    """,
    theme="modern"
)

# Step 2: Create problem slide
create_slide(
    presentation_id="sales_pitch_2024",
    slide_number=2,
    title="The Problem",
    content="""
        <h1>The Problem</h1>
        <ul>
            <li><strong>Challenge 1:</strong> Current solutions are too slow</li>
            <li><strong>Challenge 2:</strong> High costs prevent adoption</li>
            <li><strong>Challenge 3:</strong> Complex implementation</li>
        </ul>
        <div class="highlight">
            <p><strong>Companies are losing millions annually due to these issues.</strong></p>
        </div>
    """,
    theme="modern"
)

# Step 3: Create solution slide
create_slide(
    presentation_id="sales_pitch_2024",
    slide_number=3,
    title="Our Solution",
    content="""
        <h1>Our Solution</h1>
        <div class="grid grid-3">
            <div class="card text-center">
                <i class="fas fa-bolt icon-large"></i>
                <h2>10x Faster</h2>
                <p>Revolutionary speed improvements</p>
            </div>
            <div class="card text-center">
                <i class="fas fa-dollar-sign icon-large"></i>
                <h2>50% Cheaper</h2>
                <p>Reduce costs dramatically</p>
            </div>
            <div class="card text-center">
                <i class="fas fa-magic icon-large"></i>
                <h2>Dead Simple</h2>
                <p>Setup in minutes, not months</p>
            </div>
        </div>
    """,
    theme="modern"
)

# Step 4: Finalize presentation
finalize_presentation(
    presentation_id="sales_pitch_2024",
    presentation_title="Revolutionizing Sales in 2024",
    description="A comprehensive pitch showcasing our innovative solution"
)
```

## Pro Tips

1. **One Idea Per Slide**: Keep slides focused on a single concept
2. **Use Visual Hierarchy**: Start with h1, use h2 for sections, p for details
3. **Leverage Icons**: Icons make slides more engaging and memorable
4. **White Space is Good**: Don't overcrowd slides with content
5. **Consistent Theme**: Use the same theme throughout a presentation
6. **Cards for Organization**: Use cards to group related information
7. **Grids for Comparison**: Use grid layouts when comparing multiple items
8. **Highlights for Emphasis**: Use highlights for key takeaways
9. **Sequential Numbers**: Always use sequential slide numbers (1, 2, 3...)
10. **Finalize at End**: Always call finalize_presentation when done

## Troubleshooting

### Slides Not Appearing
- Ensure presentation_id is consistent across all slides
- Use sequential slide numbers
- Always finalize presentation when complete

### Theme Not Applied
- Check theme name spelling (must be exact)
- Theme is case-sensitive: use lowercase

### Content Formatting Issues
- Always wrap text in HTML tags (p, h1, h2, etc.)
- Close all HTML tags properly
- Use double quotes for HTML attributes

### Icons Not Showing
- Use "fas" prefix: `<i class="fas fa-icon-name"></i>`
- Check icon name exists in Font Awesome 6.4.0
- Add "icon-large" class for big icons


