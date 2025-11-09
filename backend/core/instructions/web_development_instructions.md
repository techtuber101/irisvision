# Web Development Instructions

## Website Creation & Deployment Protocol

### MANDATORY Steps for ALL Website Creation

1. **START SERVER ON PORT 3000**
   - At the very start, immediately start web server on port 3000
   - Use appropriate server (Python SimpleHTTPServer, Node.js, etc.)

2. **BUILD ON PORT 3000**
   - Build entire website on port 3000
   - Create all HTML, CSS, JS files
   - Serve files on port 3000

3. **DELIVER ON PORT 3000**
   - Use `expose_port` tool with port 3000
   - Make website accessible (NOT port 8080)

4. **PROVIDE USER LINK**
   - Give user direct access link on port 3000

5. **PACKAGE IN ZIP**
   - Create zip file containing all website files
   - Include all assets, styles, scripts

6. **ATTACH ZIP FILE**
   - Include zip as message attachment for download

## CRITICAL HTML Tag Formatting Requirements

### ABSOLUTELY FORBIDDEN
- **NEVER use HTML entities** like `&lt;`, `&gt;`, `&amp;`
- **NEVER encode HTML tags** - always use actual angle brackets

### MANDATORY Format
- **ALWAYS use real HTML tags** with normal angle brackets
- **CORRECT:** `<html>`, `<div>`, `<p>`, `<h1>`, `<script>`
- **WRONG:** `&lt;html&gt;`, `&lt;div&gt;`, `&lt;p&gt;`

### File Creation Rule
- When writing HTML files, always write tags with actual `<` and `>` characters
- Never use HTML entity encodings
- Verify all tags use proper angle brackets before saving

## UI Excellence Standards

### ABSOLUTELY NO BASIC OR PLAIN DESIGNS
- Every UI must be stunning, modern, and professional
- Use sophisticated design patterns and techniques

### Tech Stack Flexibility
- Use whatever UI framework user requests
- Component libraries: Material-UI, Ant Design, Bootstrap, etc.
- Modern CSS: Grid, Flexbox, custom properties

### UI Requirements

**Visual Design:**
- Sophisticated color schemes with proper contrast
- Smooth animations and transitions
- Micro-interactions for ALL interactive elements
- Modern design patterns:
  - Glass morphism
  - Subtle gradients
  - Proper shadows and depth
  - Responsive spacing

**Layout & Typography:**
- Proper visual hierarchy
- Consistent spacing and alignment
- Appropriate color schemes
- Responsive layouts for all devices
- Proper accessibility features

**Component Design Patterns:**
- **Cards:** Well-structured layouts with proper hierarchy
- **Forms:** Proper validation and user feedback
- **Buttons:** Appropriate styles and states
- **Navigation:** Intuitive navigation patterns
- **Modals:** Accessible modal/dialog patterns
- **Tables:** Responsive tables with proper data presentation
- **Alerts:** Clear user feedback and notifications

**Advanced Features:**
- Loading states and skeleton screens
- Error boundaries and error handling
- Dark mode support (when requested)
- Mobile-first responsive design
- Performance optimization

## Image Usage Guidelines

### Real Images Required
- Use real image URLs from:
  - unsplash.com
  - pexels.com
  - pixabay.com
  - giphy.com
  - wikimedia.org
- Use placeholder.com only as last resort
- Never use broken or placeholder images in production

## React Development Standards

### Component Structure
- Use functional components with hooks
- Proper component hierarchy
- Reusable, modular components
- Clear prop types and documentation

### State Management
- Use appropriate state management (Context, Redux, etc.)
- Proper state lifting and data flow
- Avoid prop drilling

### Best Practices
- Error boundaries for error handling
- Proper loading and error states
- Code splitting for performance
- Lazy loading for routes and components

## Website Deployment Checklist
- [ ] Server started on port 3000
- [ ] All files created with proper HTML tags (no entities)
- [ ] Website exposed using expose_port tool
- [ ] Direct link provided to user
- [ ] Zip file created with all assets
- [ ] Zip file attached to message
- [ ] Professional, modern design implemented
- [ ] Responsive design working on all devices
- [ ] All images loading correctly
- [ ] No console errors or warnings
