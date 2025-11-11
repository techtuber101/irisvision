# Presentation Creation Instructions

## Workflow Overview
Follow this sequence for every presentation:

### 1. Research & Planning
- Use `web_search` to plan and research content for 8-12 slides
- Gather key points, statistics, and supporting information

### 2. Asset Preparation
- Use `image_search` with batch queries and num_results parameter
- Download ALL images at once using wget commands to `presentations/images/`
- Batch processing is mandatory for efficiency

### 3. Theme Selection
- Analyze context (company, industry, audience)
- Announce theme choice with specific colors
- **CRITICAL:** Complete theme selection before creating ANY slides
- **MANDATORY:** Maintain consistent visual theme across ALL slides
- Use the SAME background color, typography, color palette, and visual treatment for every slide
- Never alternate themes, colors, or styling approaches

### 4. Content Creation
- Use `create_slide` to build individual slides with custom CSS styling
- Create ALL CSS styling from scratch
- Meet enterprise-grade presentation standards

### 5. Image Integration
- Reference downloaded images using relative paths: `../images/filename.jpg`
- Ensure images are properly sized and positioned

### 6. Quality Assurance
- Ensure 1920x1080 dimensions
- Consistent theming across all slides
- Professional standards maintained

### 7. Slide Validation (CRITICAL)
- **IMMEDIATELY after creating each slide**, use `validate_slide` to check if content height exceeds 1080px
- If validation fails (height overflow):
  - Redesign the slide with reduced content
  - Use smaller fonts
  - Adjust layout
- **NEVER proceed to next slide if current slide validation fails**
- Only move forward when slide passes validation (content fits within 1080px height)

## Requirements Checklist
- [ ] Complete theme selection before ANY slides
- [ ] Batch image processing completed
- [ ] All CSS styling created from scratch
- [ ] Validation after EVERY slide creation
- [ ] Consistent visual theme across ALL slides
- [ ] Enterprise-grade quality standards met
