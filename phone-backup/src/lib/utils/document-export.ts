import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export type ExportFormat = 'pdf' | 'docx' | 'html' | 'markdown' | 'txt' | 'png' | 'jpg' | 'images';

export interface DocumentExportOptions {
  content: string;
  fileName: string;
  format: ExportFormat;
}

// Helper function to clean CSS for html2canvas compatibility
function cleanCSSForCanvas(html: string): string {
  return html
    // Remove oklch color functions (case-insensitive)
    .replace(/oklch\s*\([^)]+\)/gi, '#ffffff')
    .replace(/color:\s*oklch\s*\([^)]+\);?/gi, 'color: #222222;')
    .replace(/background(?:-color)?:\s*oklch\s*\([^)]+\);?/gi, 'background: #ffffff;')
    // Remove CSS variables
    .replace(/var\(--[^)]+\)/gi, '#ffffff')
    // Remove backdrop-filter (not supported by html2canvas)
    .replace(/backdrop-filter:[^;]+;?/gi, '')
    // Remove complex gradients that might cause issues
    .replace(/background:[^;]*gradient[^;]+;?/gi, 'background: #ffffff;')
    // Clean up any remaining complex CSS
    .replace(/filter:[^;]+;?/gi, '')
    .replace(/mix-blend-mode:[^;]+;?/gi, '');
}

export async function exportDocument({ content, fileName, format }: DocumentExportOptions): Promise<void> {
  let htmlContent = content;
  if (typeof content === 'string' && !content.includes('<')) {
    htmlContent = content.split('\n').map(line => line.trim() ? `<p>${line}</p>` : '').join('');
  }
  
  // Clean the HTML content for canvas compatibility
  htmlContent = cleanCSSForCanvas(htmlContent);

  const standardDocumentStyles = `
    <style>
      body { 
        font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #000;
        background: #fff;
        margin: 0;
        padding: 0;
      }
      h1 { font-size: 2em; margin: 0.67em 0; }
      h2 { font-size: 1.5em; margin: 0.83em 0; }
      h3 { font-size: 1.17em; margin: 1em 0; }
      h4 { font-size: 1.1em; margin: 1.33em 0; font-weight: 600; }
      h5 { font-size: 1em; margin: 1.67em 0; font-weight: 600; }
      h6 { font-size: 0.9em; margin: 2em 0; font-weight: 600; }
      p { margin: 1em 0; }
      ul, ol { margin: 1em 0; padding-left: 40px; }
      li { margin-bottom: 0.5em; }
      blockquote { 
        margin: 1em 0; 
        padding-left: 1em; 
        border-left: 3px solid #ddd; 
        color: #666; 
        font-style: italic;
      }
      pre { 
        background: #f4f4f4; 
        padding: 1em; 
        border-radius: 4px; 
        overflow-x: auto; 
        margin: 1em 0;
        font-family: 'Geist Mono', 'SF Mono', Monaco, 'Courier New', monospace;
        font-size: 0.9em;
      }
      code { 
        background: #f4f4f4; 
        padding: 0.2em 0.4em; 
        border-radius: 3px; 
        font-family: 'Geist Mono', 'SF Mono', Monaco, 'Courier New', monospace;
        font-size: 0.9em;
      }
      pre code {
        background: none;
        padding: 0;
      }
      table { 
        border-collapse: collapse; 
        width: 100%; 
        margin: 1.5em 0; 
      }
      th, td { 
        border: 1px solid #ddd; 
        padding: 10px 12px; 
        text-align: left; 
      }
      th { 
        background-color: #f2f2f2; 
        font-weight: 600;
      }
      tr:nth-child(even) {
        background-color: #f8f9fa;
      }
      img { 
        max-width: 100%; 
        height: auto; 
        display: block;
        margin: 1em 0;
      }
      a { 
        color: #0066cc; 
        text-decoration: none; 
      }
      a:hover {
        text-decoration: underline;
      }
      hr {
        border: none;
        border-top: 2px solid #e0e0e0;
        margin: 2em 0;
      }
    </style>
  `;

  try {
    switch (format) {
      case 'pdf': {
        const element = document.createElement('div');
        element.innerHTML = `${standardDocumentStyles}${htmlContent}`;
        
        const options = {
          margin: 1,
          filename: `${fileName}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        
        await html2pdf().from(element).set(options).save();
        toast.success('PDF exported successfully');
        break;
      }

      case 'docx': {
        const response = await fetch('/api/export/docx', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: htmlContent,
            fileName: fileName,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to export DOCX');
        }

        const blob = await response.blob();
        saveAs(blob, `${fileName}.docx`);
        toast.success('DOCX exported successfully');
        break;
      }

      case 'html': {
        const fullHtmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body { 
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #fff;
    }
    h1 { 
      font-size: 2.5em; 
      margin-top: 0.67em; 
      margin-bottom: 0.67em;
      font-weight: 600;
      color: #111;
    }
    h2 { 
      font-size: 2em; 
      margin-top: 0.83em; 
      margin-bottom: 0.83em;
      font-weight: 600;
      color: #222;
    }
    h3 { 
      font-size: 1.5em; 
      margin-top: 1em; 
      margin-bottom: 1em;
      font-weight: 600;
      color: #333;
    }
    h4 { 
      font-size: 1.2em; 
      margin-top: 1.33em; 
      margin-bottom: 1.33em;
      font-weight: 600;
    }
    h5 { 
      font-size: 1em; 
      margin-top: 1.67em; 
      margin-bottom: 1.67em;
      font-weight: 600;
    }
    h6 { 
      font-size: 0.9em; 
      margin-top: 2.33em; 
      margin-bottom: 2.33em;
      font-weight: 600;
    }
    p { 
      margin-top: 1em; 
      margin-bottom: 1em; 
    }
    ul, ol { 
      margin-top: 1em; 
      margin-bottom: 1em; 
      padding-left: 40px; 
    }
    li {
      margin-bottom: 0.5em;
    }
    blockquote { 
      margin: 1em 0; 
      padding-left: 1em; 
      border-left: 4px solid #e0e0e0; 
      color: #666; 
      font-style: italic;
    }
    pre { 
      background: #f8f8f8; 
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 1em; 
      overflow-x: auto; 
      margin: 1em 0;
      font-family: 'Geist Mono', 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 0.9em;
    }
    code { 
      background: #f5f5f5; 
      padding: 0.2em 0.4em; 
      border-radius: 3px; 
      font-family: 'Geist Mono', 'SF Mono', Monaco, 'Courier New', monospace; 
      font-size: 0.9em;
    }
    pre code {
      background: none;
      padding: 0;
    }
    table { 
      border-collapse: collapse; 
      width: 100%; 
      margin: 1em 0; 
      overflow-x: auto;
      display: block;
    }
    th, td { 
      border: 1px solid #ddd; 
      padding: 12px 16px; 
      text-align: left; 
    }
    th { 
      background-color: #f8f9fa; 
      font-weight: 600; 
    }
    tr:nth-child(even) {
      background-color: #f8f9fa;
    }
    img { 
      max-width: 100%; 
      height: auto; 
      display: block;
      margin: 1em 0;
    }
    a { 
      color: #0066cc; 
      text-decoration: none; 
    }
    a:hover {
      text-decoration: underline;
    }
    hr {
      border: none;
      border-top: 2px solid #e0e0e0;
      margin: 2em 0;
    }
    .task-list-item {
      list-style: none;
      margin-left: -20px;
    }
    .task-list-item input {
      margin-right: 8px;
    }
    @media print {
      body {
        max-width: none;
      }
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
        const htmlBlob = new Blob([fullHtmlContent], { type: 'text/html;charset=utf-8' });
        saveAs(htmlBlob, `${fileName}.html`);
        toast.success('HTML exported successfully');
        break;
      }

      case 'markdown': {
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          bulletListMarker: '-',
          codeBlockStyle: 'fenced',
          emDelimiter: '*',
          strongDelimiter: '**',
          linkStyle: 'inlined',
          preformattedCode: true,
        });
        
        turndownService.use(gfm);
        
        const markdown = turndownService.turndown(htmlContent);
        const finalMarkdown = markdown.startsWith('#') ? markdown : `# ${fileName}\n\n${markdown}`;
        
        const mdBlob = new Blob([finalMarkdown], { type: 'text/markdown;charset=utf-8' });
        saveAs(mdBlob, `${fileName}.md`);
        toast.success('Markdown exported successfully');
        break;
      }

      case 'txt': {
        // Convert HTML to plain text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const text = tempDiv.textContent || tempDiv.innerText || '';
        
        const formattedText = text
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        
        const txtContent = `${fileName}\n${'='.repeat(fileName.length)}\n\n${formattedText}`;
        const txtBlob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        saveAs(txtBlob, `${fileName}.txt`);
        toast.success('Text file exported successfully');
        break;
      }

      case 'png':
      case 'jpg': {
        const element = document.createElement('div');
        element.innerHTML = `
          <style>
            body { 
              font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #ffffff;
              margin: 0;
              padding: 20px;
              background: #070a11;
            }
            h1 { font-size: 2em; margin: 0.67em 0; }
            h2 { font-size: 1.5em; margin: 0.83em 0; }
            h3 { font-size: 1.17em; margin: 1em 0; }
            h4 { font-size: 1.2em; margin: 1.33em 0; font-weight: 600; }
            h5 { font-size: 1em; margin: 1.67em 0; font-weight: 600; }
            h6 { font-size: 0.9em; margin: 2.33em 0; font-weight: 600; }
            p { margin: 1em 0; }
            ul, ol { margin: 1em 0; padding-left: 40px; }
            li { margin-bottom: 0.5em; }
            blockquote { 
              margin: 1em 0; 
              padding-left: 1em; 
              border-left: 3px solid #ddd; 
              color: #666; 
              font-style: italic;
            }
            pre { 
              background: #f4f4f4; 
              padding: 1em; 
              border-radius: 4px; 
              overflow-x: auto; 
              margin: 1em 0;
              font-family: 'Geist Mono', 'SF Mono', Monaco, 'Courier New', monospace;
              font-size: 0.9em;
            }
            code { 
              background: #f4f4f4; 
              padding: 0.2em 0.4em; 
              border-radius: 3px; 
              font-family: 'Geist Mono', 'SF Mono', Monaco, 'Courier New', monospace;
              font-size: 0.9em;
            }
            pre code {
              background: none;
              padding: 0;
            }
            table { 
              border-collapse: collapse; 
              width: 100%; 
              margin: 1em 0; 
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: left; 
            }
            th { 
              background-color: #f2f2f2; 
            }
            tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            img { 
              max-width: 100%; 
              height: auto; 
              display: block;
              margin: 1em 0;
            }
            a { 
              color: #0066cc; 
              text-decoration: none; 
            }
            a:hover {
              text-decoration: underline;
            }
            hr {
              border: none;
              border-top: 2px solid #e0e0e0;
              margin: 2em 0;
            }
          </style>
          ${htmlContent}
        `;
        element.style.cssText = `
          position: absolute;
          left: -9999px;
          top: -9999px;
          width: 800px;
          background: #070a11;
          padding: 20px;
          font-family: 'Geist', sans-serif;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
        `;
        document.body.appendChild(element);

        const canvas = await html2pdf().from(element).set({
          image: { type: format === 'jpg' ? 'jpeg' : 'png', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'px', format: [element.scrollWidth, element.scrollHeight] }
        }).output('canvas');

        const dataURL = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`, 0.95);
        const blob = await fetch(dataURL).then(res => res.blob());
        saveAs(blob, `${fileName}.${format}`);
        
        document.body.removeChild(element);
        toast.success(`${format.toUpperCase()} exported successfully`);
        break;
      }

      case 'images': {
        const container = document.createElement('div');
        container.innerHTML = `${standardDocumentStyles}<div id="iris-document-export">${htmlContent}</div>`;

        const element = document.createElement('div');
        element.style.cssText = `
          position: absolute;
          left: -9999px;
          top: 0;
          width: 794px;
          background: #ffffff;
          padding: 48px;
          box-sizing: border-box;
          color: #000000;
        `;
        element.appendChild(container);
        document.body.appendChild(element);

        try {
          const scale = 2;
          const canvas = await html2canvas(element, {
            scale,
            useCORS: true,
            backgroundColor: '#ffffff',
          });

          const pageHeightPx = Math.floor(1122 * scale);
          const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));
          const zip = new JSZip();

          for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
            const startY = pageIndex * pageHeightPx;
            const sliceHeight = Math.min(pageHeightPx, canvas.height - startY);
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = sliceHeight;
            const ctx = pageCanvas.getContext('2d');
            if (!ctx) continue;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(
              canvas,
              0,
              startY,
              canvas.width,
              sliceHeight,
              0,
              0,
              canvas.width,
              sliceHeight
            );

            const blob: Blob | null = await new Promise((resolve) =>
              pageCanvas.toBlob((b) => resolve(b), 'image/png', 0.95)
            );

            if (blob) {
              zip.file(`${fileName}_page_${pageIndex + 1}.png`, blob);
            }
          }

          const zipBlob = await zip.generateAsync({ type: 'blob' });
          saveAs(zipBlob, `${fileName}_images.zip`);
          toast.success(`${totalPages} page${totalPages > 1 ? 's' : ''} exported as images`);
        } finally {
          document.body.removeChild(element);
        }
        break;
      }
    }
  } catch (error) {
    console.error(`Export error (${format}):`, error);
    toast.error(`Failed to export as ${format.toUpperCase()}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function createExportHandler(getContent: () => string, getFileName: () => string) {
  return (format: ExportFormat) => {
    const content = getContent();
    const fileName = getFileName();
    return exportDocument({ content, fileName, format });
  };
} 
