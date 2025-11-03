import { NextRequest, NextResponse } from 'next/server';
import HTMLtoDOCX from 'html-to-docx';

export const dynamic = 'force-static';

const baseTypography = `
  body { 
    font-family: 'Calibri', 'Segoe UI', 'Inter', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #111827;
    margin: 0;
    padding: 0;
  }

  main {
    max-width: 7.5in;
    margin: 0 auto;
    padding: 0;
  }
  
  h1, h2, h3, h4, h5, h6 {
    font-weight: 700;
    color: #111827;
    margin-top: 1.2rem;
    margin-bottom: 0.6rem;
    line-height: 1.2;
  }
  
  h1 { font-size: 24pt; color: #0f172a; border-bottom: 1pt solid #cbd5f5; padding-bottom: 6pt; }
  h2 { font-size: 20pt; color: #1d4ed8; }
  h3 { font-size: 16pt; color: #1e293b; }
  h4 { font-size: 14pt; color: #1f2937; }
  h5 { font-size: 12pt; color: #334155; }
  h6 { font-size: 11pt; color: #475569; letter-spacing: 0.04em; text-transform: uppercase; }

  p { 
    margin: 0 0 12pt 0; 
    text-align: justify;
    orphans: 2;
    widows: 2;
  }

  strong, b { font-weight: 700; color: #0f172a; }
  em, i { font-style: italic; color: #374151; }
  u { text-decoration: underline; text-decoration-color: #0ea5e9; }
  mark { background-color: #fef08a; }

  ul, ol {
    margin: 6pt 0 12pt 0;
    padding-left: 28pt;
  }
  li { margin-bottom: 6pt; }
  li > ul, li > ol { margin-top: 6pt; }

  blockquote {
    margin: 12pt 0;
    padding: 12pt 18pt;
    border-left: 4pt solid #60a5fa;
    background: #f1f5f9;
    color: #1f2937;
    font-style: italic;
  }

  pre {
    font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
    background: #0f172a;
    color: #e2e8f0;
    padding: 14pt 18pt;
    border-radius: 6pt;
    border: 1pt solid #1e293b;
    margin: 14pt 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  pre code {
    background: transparent;
    padding: 0;
    border: none;
    color: inherit;
  }

  code {
    font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
    background: #f1f5f9;
    color: #dc2626;
    padding: 2pt 4pt;
    border-radius: 3pt;
    border: 1pt solid #e2e8f0;
  }

  table { 
    width: 100%; 
    border-collapse: collapse;
    margin: 18pt 0;
    font-size: 10.5pt;
  }
  th, td {
    border: 1pt solid #e2e8f0;
    padding: 8pt 10pt;
    vertical-align: top;
  }
  th {
    background: #eff6ff;
    font-weight: 600;
    color: #0f172a;
  }
  tr:nth-child(even) td {
    background: #fafafa;
  }

  figure {
    margin: 18pt 0;
    text-align: center;
  }
  figcaption {
    font-size: 9pt;
    color: #6b7280;
    margin-top: 6pt;
  }

  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 12pt auto;
    border-radius: 4pt;
  }

  hr {
    border: none;
    border-top: 1pt solid #e5e7eb;
    margin: 24pt 0;
  }

  a {
    color: #2563eb;
    text-decoration: underline;
    text-decoration-color: #93c5fd;
  }
  a:hover { color: #1d4ed8; }

  .page-break { page-break-before: always; }
`;

const tailwindUtilityStyles = `
  .text-xs { font-size: 9pt !important; }
  .text-sm { font-size: 10pt !important; }
  .text-base { font-size: 11pt !important; }
  .text-lg { font-size: 12pt !important; }
  .text-xl { font-size: 14pt !important; }
  .text-2xl { font-size: 16pt !important; }
  .text-3xl { font-size: 18pt !important; }
  .text-4xl { font-size: 24pt !important; }

  .font-light { font-weight: 300 !important; }
  .font-normal { font-weight: 400 !important; }
  .font-medium { font-weight: 500 !important; }
  .font-semibold { font-weight: 600 !important; }
  .font-bold { font-weight: 700 !important; }
  .italic { font-style: italic !important; }
  .uppercase { text-transform: uppercase !important; letter-spacing: 0.08em; }
  .capitalize { text-transform: capitalize !important; }
  .tracking-wide { letter-spacing: 0.05em !important; }
  .tracking-tight { letter-spacing: -0.02em !important; }

  .leading-none { line-height: 1 !important; }
  .leading-tight { line-height: 1.2 !important; }
  .leading-snug { line-height: 1.35 !important; }
  .leading-normal { line-height: 1.5 !important; }
  .leading-relaxed { line-height: 1.75 !important; }

  .text-center { text-align: center !important; }
  .text-right { text-align: right !important; }
  .text-left { text-align: left !important; }
  .text-justify { text-align: justify !important; }

  .text-gray-500 { color: #6b7280 !important; }
  .text-gray-600 { color: #4b5563 !important; }
  .text-gray-700 { color: #374151 !important; }
  .text-gray-800 { color: #1f2937 !important; }
  .text-gray-900 { color: #111827 !important; }
  .text-slate-500 { color: #64748b !important; }
  .text-slate-600 { color: #475569 !important; }
  .text-slate-700 { color: #334155 !important; }
  .text-blue-500 { color: #3b82f6 !important; }
  .text-blue-600 { color: #2563eb !important; }
  .text-emerald-600 { color: #059669 !important; }
  .text-rose-600 { color: #e11d48 !important; }
  .text-amber-600 { color: #d97706 !important; }

  .bg-white { background-color: #ffffff !important; }
  .bg-gray-50 { background-color: #f9fafb !important; }
  .bg-gray-100 { background-color: #f3f4f6 !important; }
  .bg-gray-200 { background-color: #e5e7eb !important; }
  .bg-blue-50 { background-color: #eff6ff !important; }
  .bg-emerald-50 { background-color: #ecfdf5 !important; }
  .bg-amber-50 { background-color: #fffbeb !important; }

  .border { border: 1pt solid #e5e7eb !important; }
  .border-0 { border: none !important; }
  .border-b { border-bottom: 1pt solid #e5e7eb !important; }
  .border-t { border-top: 1pt solid #e5e7eb !important; }
  .border-l { border-left: 1pt solid #e5e7eb !important; }
  .border-r { border-right: 1pt solid #e5e7eb !important; }
  .border-gray-200 { border-color: #e5e7eb !important; }
  .border-gray-300 { border-color: #d1d5db !important; }
  .border-blue-200 { border-color: #bfdbfe !important; }

  .rounded { border-radius: 4pt !important; }
  .rounded-md { border-radius: 6pt !important; }
  .rounded-lg { border-radius: 8pt !important; }
  .rounded-xl { border-radius: 12pt !important; }

  .shadow { box-shadow: 0 4pt 12pt rgba(15,23,42,0.08) !important; }
  .shadow-md { box-shadow: 0 8pt 16pt rgba(15,23,42,0.12) !important; }

  .p-2 { padding: 6pt !important; }
  .p-3 { padding: 9pt !important; }
  .p-4 { padding: 12pt !important; }
  .p-6 { padding: 18pt !important; }
  .px-4 { padding-left: 12pt !important; padding-right: 12pt !important; }
  .px-6 { padding-left: 18pt !important; padding-right: 18pt !important; }
  .px-8 { padding-left: 24pt !important; padding-right: 24pt !important; }
  .py-2 { padding-top: 6pt !important; padding-bottom: 6pt !important; }
  .py-3 { padding-top: 9pt !important; padding-bottom: 9pt !important; }
  .py-4 { padding-top: 12pt !important; padding-bottom: 12pt !important; }
  .py-6 { padding-top: 18pt !important; padding-bottom: 18pt !important; }

  .m-0 { margin: 0 !important; }
  .mt-2 { margin-top: 6pt !important; }
  .mt-3 { margin-top: 9pt !important; }
  .mt-4 { margin-top: 12pt !important; }
  .mt-6 { margin-top: 18pt !important; }
  .mt-8 { margin-top: 24pt !important; }
  .mb-2 { margin-bottom: 6pt !important; }
  .mb-4 { margin-bottom: 12pt !important; }
  .mb-6 { margin-bottom: 18pt !important; }
  .mb-8 { margin-bottom: 24pt !important; }
  .my-4 { margin-top: 12pt !important; margin-bottom: 12pt !important; }
  .my-6 { margin-top: 18pt !important; margin-bottom: 18pt !important; }
  .space-y-2 > * + * { margin-top: 6pt !important; }
  .space-y-4 > * + * { margin-top: 12pt !important; }

  .list-disc { list-style-type: disc !important; padding-left: 28pt !important; }
  .list-decimal { list-style-type: decimal !important; padding-left: 28pt !important; }
  .list-none { list-style: none !important; padding-left: 0 !important; }

  .grid { display: block !important; }
  .flex, .inline-flex { display: block !important; }

  .text-balance { text-wrap: balance; }
  .text-wrap { text-wrap: wrap; }
  .break-words { word-break: break-word !important; }
`;

function polishContent(raw: string): string {
  if (!raw) return '';

  return raw
    .replace(/<hr\s*\/?>/gi, '<hr />')
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<p>&nbsp;</p>')
    .replace(/<div([^>]*)>/gi, '<section$1>')
    .replace(/<\/div>/gi, '</section>');
}

export async function POST(request: NextRequest) {
  try {
    const { content, fileName } = await request.json();

    if (!content || !fileName) {
      return NextResponse.json(
        { error: 'Content and fileName are required' },
        { status: 400 }
      );
    }

    const styledContent = polishContent(content);

    // Enhanced HTML content with comprehensive styling for better DOCX conversion
    const docxContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${baseTypography}
          ${tailwindUtilityStyles}
        </style>
      </head>
      <body class="docx-body">
        <main>
          ${styledContent}
        </main>
      </body>
      </html>
    `;

    // Enhanced DOCX options for better formatting
    const docxOptions = {
      orientation: 'portrait',
      margins: {
        top: 720,    // 0.5 inch
        bottom: 720, // 0.5 inch
        left: 720,   // 0.5 inch
        right: 720,  // 0.5 inch
      },
      title: fileName,
      creator: 'Iris Intelligence For You',
      description: 'Professional document exported from Iris Intelligence',
      font: 'Calibri',
      fontSize: 22,
      table: {
        row: {
          cantSplit: true,
        },
      },
      footer: true,
      header: true,
      pageNumber: true,
    };

    // Convert HTML to DOCX with enhanced options
    const docxBuffer = await HTMLtoDOCX(docxContent, null, docxOptions);
    
    return new NextResponse(docxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}.docx"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('DOCX export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate DOCX file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
