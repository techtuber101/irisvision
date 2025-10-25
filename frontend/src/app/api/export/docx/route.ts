import { NextRequest, NextResponse } from 'next/server';
import HTMLtoDOCX from 'html-to-docx';

export const dynamic = 'force-static';

export async function POST(request: NextRequest) {
  try {
    const { content, fileName } = await request.json();

    if (!content || !fileName) {
      return NextResponse.json(
        { error: 'Content and fileName are required' },
        { status: 400 }
      );
    }

    // Enhanced HTML content with comprehensive styling for better DOCX conversion
    const docxContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: 'Calibri', Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #000000;
            margin: 0;
            padding: 0;
          }
          
          /* Headings with proper hierarchy */
          h1 { 
            font-size: 18pt; 
            font-weight: bold; 
            margin: 18pt 0 12pt 0; 
            color: #2c3e50;
            page-break-after: avoid;
          }
          h2 { 
            font-size: 16pt; 
            font-weight: bold; 
            margin: 16pt 0 10pt 0; 
            color: #34495e;
            page-break-after: avoid;
          }
          h3 { 
            font-size: 14pt; 
            font-weight: bold; 
            margin: 14pt 0 8pt 0; 
            color: #34495e;
            page-break-after: avoid;
          }
          
          /* Paragraphs */
          p { 
            margin: 6pt 0; 
            text-align: justify;
            orphans: 2;
            widows: 2;
          }
          
          /* Lists with proper indentation */
          ul, ol { 
            margin: 6pt 0; 
            padding-left: 36pt; 
            page-break-inside: avoid;
          }
          li { 
            margin: 3pt 0; 
            line-height: 1.4;
          }
          
          /* Blockquotes */
          blockquote { 
            margin: 12pt 0 12pt 36pt; 
            font-style: italic; 
            color: #555555;
            border-left: 3pt solid #3498db;
            padding-left: 12pt;
            background-color: #f8f9fa;
            page-break-inside: avoid;
          }
          
          /* Code blocks */
          pre { 
            font-family: 'Courier New', monospace;
            font-size: 10pt;
            background-color: #f5f5f5;
            border: 1pt solid #e0e0e0;
            padding: 12pt;
            margin: 12pt 0;
            white-space: pre-wrap;
            word-wrap: break-word;
            page-break-inside: avoid;
          }
          
          /* Inline code */
          code { 
            font-family: 'Courier New', monospace;
            font-size: 10pt;
            background-color: #f5f5f5;
            padding: 2pt 4pt;
            border-radius: 2pt;
            border: 1pt solid #e0e0e0;
          }
          
          /* Tables with professional styling */
          table { 
            border-collapse: collapse; 
            width: 100%; 
            margin: 12pt 0;
            page-break-inside: avoid;
            font-size: 10pt;
          }
          th, td { 
            border: 1pt solid #d0d0d0; 
            padding: 6pt 8pt; 
            text-align: left;
            vertical-align: top;
          }
          th { 
            background-color: #f0f0f0; 
            font-weight: bold;
            color: #2c3e50;
            font-size: 11pt;
          }
          tr:nth-child(even) {
            background-color: #fafafa;
          }
          
          /* Text formatting */
          strong, b { 
            font-weight: bold; 
            color: #2c3e50;
          }
          em, i { 
            font-style: italic; 
            color: #555555;
          }
          u { 
            text-decoration: underline; 
            color: #0066cc;
          }
          s, strike, del { 
            text-decoration: line-through; 
            color: #999999;
          }
          
          /* Links */
          a { 
            color: #0066cc; 
            text-decoration: underline; 
          }
          a:hover {
            color: #004499;
          }
          
          /* Horizontal rules */
          hr { 
            border: none; 
            border-top: 1pt solid #cccccc; 
            margin: 18pt 0; 
            page-break-after: avoid;
          }
          
          /* Images */
          img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 12pt auto;
            page-break-inside: avoid;
          }
          
          /* Page breaks */
          .page-break {
            page-break-before: always;
          }
          
          /* Avoid orphans and widows */
          p, li, td, th {
            orphans: 2;
            widows: 2;
          }
        </style>
      </head>
      <body>
        ${content}
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