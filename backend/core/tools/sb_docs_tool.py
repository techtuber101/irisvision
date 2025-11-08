import base64
import json
import mimetypes
import os
from typing import Optional, Dict, Any, List
from urllib.parse import unquote

from bs4 import BeautifulSoup
from core.agentpress.thread_manager import ThreadManager
from core.agentpress.tool import ToolResult, openapi_schema, tool_metadata
from core.sandbox.tool_base import SandboxToolsBase
from core.tools.fonts import get_lmroman_data_uri
from core.utils.config import config
from core.utils.logger import logger
from datetime import datetime
from pathlib import Path
import html
import re
import uuid

@tool_metadata(
    display_name="Document Creator",
    description="Create and edit professional documents with rich formatting",
    icon="FileText",
    color="bg-violet-100 dark:bg-violet-800/50",
    weight=220,
    visible=True
)
class SandboxDocsTool(SandboxToolsBase):
    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        self.docs_dir = "/workspace/docs"
        self.metadata_file = "/workspace/docs/.metadata.json"
        
    async def _ensure_docs_directory(self):
        await self._ensure_sandbox()
        try:
            await self.sandbox.fs.make_dir(self.docs_dir)
        except:
            pass
            
    async def _load_metadata(self) -> Dict[str, Any]:
        try:
            await self._ensure_sandbox()
            content = await self.sandbox.fs.download_file(self.metadata_file)
            return json.loads(content.decode())
        except:
            return {"documents": {}}
            
    async def _save_metadata(self, metadata: Dict[str, Any]):
        await self._ensure_sandbox()
        content = json.dumps(metadata, indent=2)
        await self.sandbox.fs.upload_file(content.encode(), self.metadata_file)
        
    def _generate_doc_id(self) -> str:
        return f"doc_{uuid.uuid4().hex[:8]}"
    
    def _get_tiptap_template_example(self) -> str:
        return """
<h1>Document Title</h1>
<p>This is a paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>

<h2>Section with List</h2>
<p>Here's an unordered list:</p>
<ul>
  <li>First item</li>
  <li>Second item with <code>inline code</code></li>
  <li>Third item</li>
</ul>

<h2>Code Example</h2>
<p>Here's a code block:</p>
<pre><code>function hello() {
  console.log("Hello, World!");
}</code></pre>

<h2>Table Example</h2>
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

<blockquote>This is a blockquote for important notes.</blockquote>
"""
        
    def _sanitize_filename(self, title: str) -> str:
        filename = re.sub(r'[^\w\s-]', '', title.lower())
        filename = re.sub(r'[-\s]+', '-', filename)
        return filename[:50]
    
    def _validate_and_clean_tiptap_html(self, content: str) -> str:
        allowed_tags = {
            'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 
            'strong', 'em', 'u', 's', 'a', 'code', 'pre',
            'blockquote', 'img', 'table', 'thead', 'tbody',
            'tr', 'th', 'td', 'br', 'hr'
        }
        
        if not content.strip():
            return '<p></p>'
        
        content = content.strip()
        if not content.startswith('<'):
            content = f'<p>{html.escape(content)}</p>'
            
        content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'\s*on\w+\s*=\s*["\'][^"\']*["\']', '', content, flags=re.IGNORECASE)
        content = re.sub(r'javascript:', '', content, flags=re.IGNORECASE)
        
        content = re.sub(r'\s*style\s*=\s*["\'][^"\']*["\']', '', content, flags=re.IGNORECASE)
        
        content = re.sub(r'\s*class\s*=\s*["\'][^"\']*["\']', '', content, flags=re.IGNORECASE)
        
        content = re.sub(r'<code>([^<]+)</code>', r'<code>\1</code>', content)
        content = re.sub(r'<pre>([^<])', r'<pre><code>\1', content)
        content = re.sub(r'([^>])</pre>', r'\1</code></pre>', content)
        
        if '<li>' in content and not ('<ul>' in content or '<ol>' in content):
            content = re.sub(r'(<li>.*?</li>)+', r'<ul>\g<0></ul>', content, flags=re.DOTALL)
        
        if '<td>' in content or '<th>' in content:
            if '<table>' not in content:
                table_pattern = r'(<tr>.*?</tr>)+'
                content = re.sub(table_pattern, r'<table>\g<0></table>', content, flags=re.DOTALL)
        
        if not any(content.strip().startswith(f'<{tag}>') for tag in ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'blockquote', 'pre', 'table']):
            content = f'<p>{content}</p>'
        
        return content

    def _resolve_image_path(self, src: str) -> Optional[str]:
        if not src:
            return None

        cleaned_src = unquote(src.strip())
        if not cleaned_src:
            return None

        lowered = cleaned_src.lower()
        # Skip URLs and data URIs - these are already accessible
        if lowered.startswith(('data:', 'http://', 'https://', 'blob:', 'mailto:')):
            return None

        # Remove sandbox://, sandbox:/, sandbox: prefixes
        for prefix in ('sandbox://', 'sandbox:/', 'sandbox:'):
            if lowered.startswith(prefix):
                cleaned_src = cleaned_src[len(prefix):]
                lowered = cleaned_src.lower()
                break

        # Remove file://, file:/ prefixes
        for prefix in ('file://', 'file:/'):
            if lowered.startswith(prefix):
                cleaned_src = cleaned_src[len(prefix):]
                lowered = cleaned_src.lower()
                break

        cleaned_src = cleaned_src.replace('\\', '/')

        # Skip absolute URLs that start with //
        if cleaned_src.startswith('//'):
            return None

        # Normalize workspace/ prefix
        if cleaned_src.startswith('workspace/'):
            cleaned_src = f'/{cleaned_src}'
        elif not cleaned_src.startswith('/workspace') and not cleaned_src.startswith('/'):
            # If it's a relative path without /workspace, try multiple locations
            # First try in workspace root
            candidate = os.path.normpath(os.path.join(self.workspace_path, cleaned_src))
            if not candidate.startswith('/'):
                candidate = f'/{candidate.lstrip("/")}'
            return candidate

        # If it already starts with /workspace, use it directly
        if cleaned_src.startswith('/workspace'):
            normalized = os.path.normpath(cleaned_src)
            if not normalized.startswith('/'):
                normalized = f'/{normalized.lstrip("/")}'
            return normalized

        # If it starts with /, try to resolve it
        if cleaned_src.startswith('/'):
            normalized = os.path.normpath(cleaned_src)
            if not normalized.startswith('/'):
                normalized = f'/{normalized.lstrip("/")}'
            # Ensure it's within workspace
            if normalized.startswith(self.workspace_path):
                return normalized
            # Try joining with workspace
            candidate = os.path.normpath(os.path.join(self.workspace_path, normalized.lstrip('/')))
            if candidate.startswith(self.workspace_path):
                return candidate
            return None

        # For relative paths, try multiple locations
        # Try in workspace root first
        candidate = os.path.normpath(os.path.join(self.workspace_path, cleaned_src))
        if not candidate.startswith('/'):
            candidate = f'/{candidate.lstrip("/")}'
        if candidate.startswith(self.workspace_path):
            return candidate

        # Try in docs directory
        candidate = os.path.normpath(os.path.join(self.docs_dir, cleaned_src))
        if not candidate.startswith('/'):
            candidate = f'/{candidate.lstrip("/")}'
        if candidate.startswith(self.workspace_path):
            return candidate

        logger.debug(f"Could not resolve image path: {src} (cleaned: {cleaned_src})")
        return None

    async def _inline_local_images(self, content: str) -> str:
        if not content:
            return content

        await self._ensure_sandbox()

        try:
            soup = BeautifulSoup(content, 'html.parser')
        except Exception as exc:
            logger.warning(f"Failed to parse document HTML for image inlining: {exc}")
            return content

        images = soup.find_all('img')
        if not images:
            return content

        updated = False

        for img in images:
            src = img.get('src')
            if not src:
                continue

            # Skip if already a data URI or URL
            src_lower = src.lower().strip()
            if src_lower.startswith(('data:', 'http://', 'https://', 'blob:')):
                continue

            resolved_path = self._resolve_image_path(src)
            if not resolved_path:
                logger.debug(f"Could not resolve image path for inlining: {src}")
                continue

            try:
                # Check if file exists first
                try:
                    file_info = await self.sandbox.fs.get_file_info(resolved_path)
                    if file_info.is_dir:
                        logger.warning(f"Image path is a directory, not a file: {src}")
                        continue
                except Exception:
                    logger.debug(f"Could not get file info for image: {src} (resolved: {resolved_path})")
                    continue

                image_bytes = await self.sandbox.fs.download_file(resolved_path)
            except Exception as exc:
                logger.warning(f"Failed to inline image '{src}' (resolved: {resolved_path}): {exc}")
                continue

            if not isinstance(image_bytes, (bytes, bytearray)):
                if isinstance(image_bytes, str):
                    image_bytes = image_bytes.encode()
                else:
                    logger.warning(f"Image data is not bytes for '{src}': {type(image_bytes)}")
                    continue

            # Limit data URI size to avoid performance issues (max 10MB)
            max_size = 10 * 1024 * 1024  # 10MB
            if len(image_bytes) > max_size:
                logger.warning(f"Image '{src}' is too large ({len(image_bytes)} bytes) to inline as data URI. Consider using a URL instead.")
                continue

            mime_type, _ = mimetypes.guess_type(resolved_path)
            if not mime_type or not mime_type.startswith('image/'):
                # Try to detect from file extension
                ext = os.path.splitext(resolved_path)[1].lower()
                mime_map = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.svg': 'image/svg+xml',
                    '.bmp': 'image/bmp',
                }
                mime_type = mime_map.get(ext, 'image/png')

            try:
                data_uri = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"
                img['src'] = data_uri
                updated = True
                logger.debug(f"Successfully inlined image: {src} -> data URI ({len(image_bytes)} bytes)")
            except Exception as exc:
                logger.warning(f"Failed to create data URI for image '{src}': {exc}")
                continue

        return str(soup) if updated else content
        
    async def _generate_viewer_html(self, title: str, content: str, doc_id: str, 
                                   metadata: Optional[Dict] = None, updated_at: str = "") -> str:
       
        template_path = Path(__file__).parent / "templates" / "doc_viewer.html"
        try:
            with open(template_path, 'r') as f:
                template = f.read()
        except:
            template = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>{{title}}</title>
                <style>
                    body { font-family: sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; }
                    h1 { color: #333; }
                    .metadata { color: #666; font-size: 0.9rem; margin: 1rem 0; }
                    .content { line-height: 1.6; }
                    .content img { max-width: 85%; height: auto; display: block; margin: 1rem auto; }
                </style>
            </head>
            <body>
                <h1>{{title}}</h1>
                <div class="metadata">Document ID: {{doc_id}}</div>
                <div class="content">{{content}}</div>
            </body>
            </html>
            """
        
        html = template.replace("{{title}}", title)
        html = html.replace("{{doc_id}}", doc_id)
        html = html.replace("{{content}}", content)
        html = html.replace("{{updated_at}}", updated_at)
        
        if metadata:
            if metadata.get("author"):
                html = html.replace("{{author}}", metadata["author"])
            else:
                html = re.sub(r'{{#if author}}.*?{{/if}}', '', html, flags=re.DOTALL)
            
            if metadata.get("tags"):
                tags_html = ' '.join([f'<span class="tag">{tag}</span>' for tag in metadata["tags"]])
                html = html.replace("{{#each tags}}<span class=\"tag\">{{this}}</span>{{/each}}", tags_html)
            else:
                html = re.sub(r'{{#if tags}}.*?{{/if}}', '', html, flags=re.DOTALL)
        else:
            html = re.sub(r'{{#if.*?}}.*?{{/if}}', '', html, flags=re.DOTALL)
        
        html = re.sub(r'{{.*?}}', '', html)
        
        return html
        
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "create_document",
            "description": "Create a new document with rich text content. The content should be properly formatted HTML compatible with TipTap editor.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Title of the document"
                    },
                    "content": {
                        "type": "string",
                        "description": """HTML content for TipTap editor. Use only these supported elements:
- Paragraphs: <p>text</p>
- Headings: <h1>, <h2>, <h3> (levels 1-3 only)
- Lists: <ul><li>item</li></ul> or <ol><li>item</li></ol>
- Formatting: <strong>bold</strong>, <em>italic</em>, <u>underline</u>, <s>strikethrough</s>
- Links: <a href="url">text</a>
- Code: <code>inline code</code> or <pre><code>block code</code></pre>
- Blockquotes: <blockquote>quote</blockquote>
- Images: <img src="url" alt="description" />
- Tables: <table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>
- Line breaks: <br />
- Horizontal rules: <hr />

IMPORTANT: All content must be wrapped in proper HTML tags. Do not use unsupported tags or attributes like style, class (except for standard TipTap classes), or custom elements. Start with a paragraph or heading tag."""
                    },
                    "format": {
                        "type": "string",
                        "enum": ["html", "markdown", "json"],
                        "description": "Format of the document",
                        "default": "html"
                    },
                    "metadata": {
                        "type": "object",
                        "description": "Additional metadata for the document",
                        "properties": {
                            "description": {"type": "string"},
                            "tags": {"type": "array", "items": {"type": "string"}},
                            "author": {"type": "string"}
                        }
                    }
                },
                "required": ["title", "content"]
            }
        }
    })
    async def create_document(self, title: str, content: str, format: str = "html", metadata: Optional[Dict] = None) -> ToolResult:
        try:
            await self._ensure_docs_directory()

            doc_id = self._generate_doc_id()
            extension = "doc" if format == "html" else format
            filename = f"{self._sanitize_filename(title)}_{doc_id}.{extension}"
            file_path = f"{self.docs_dir}/{filename}"
            
            if format == "html":
                content = self._validate_and_clean_tiptap_html(content)
                content = await self._inline_local_images(content)
                logger.debug(f"Cleaned HTML content for TipTap: {content[:200]}...")
                
                document_wrapper = {
                    "type": "tiptap_document",
                    "version": "1.0",
                    "title": title,
                    "content": content,
                    "metadata": metadata or {},
                    "created_at": datetime.now().isoformat(),
                    "doc_id": doc_id
                }
                content_to_save = json.dumps(document_wrapper, indent=2)
            else:
                content_to_save = content
            
            await self.sandbox.fs.upload_file(content_to_save.encode(), file_path)
            
            all_metadata = await self._load_metadata()
            doc_info = {
                "id": doc_id,
                "title": title,
                "filename": filename,
                "format": format if format != "html" else "doc",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "metadata": metadata or {},
                "path": file_path,
                "is_tiptap_doc": format == "html",
                "doc_type": "tiptap_document" if format == "html" else "plain"
            }
            all_metadata["documents"][doc_id] = doc_info
            await self._save_metadata(all_metadata)
            
            preview_url = None
            if hasattr(self, '_sandbox_url') and self._sandbox_url:
                preview_url = f"{self._sandbox_url}/docs/{filename}"
            
            
            await self._ensure_sandbox()
            
            return self.success_response({
                "success": True,
                "document": doc_info,
                "content": content,
                "sandbox_id": self.sandbox_id,  
                "preview_url": preview_url,
                "message": f"Document '{title}' created successfully"
            })
            
        except Exception as e:
            logger.error(f"Error creating document: {str(e)}")
            return self.fail_response(f"Error creating document: {str(e)}")
            
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "read_document",
            "description": "Read the content of a document",
            "parameters": {
                "type": "object",
                "properties": {
                    "doc_id": {
                        "type": "string",
                        "description": "ID of the document to read"
                    }
                },
                "required": ["doc_id"]
            }
        }
    })
    async def read_document(self, doc_id: str) -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            all_metadata = await self._load_metadata()
            
            if doc_id not in all_metadata["documents"]:
                return self.fail_response(f"Document with ID '{doc_id}' not found")
            
            doc_info = all_metadata["documents"][doc_id]
            
            content_raw = await self.sandbox.fs.download_file(doc_info["path"])
            content_str = content_raw.decode()
            

            if doc_info.get("format") in ["tiptap", "html", "doc"] or doc_info.get("is_tiptap_doc") or doc_info.get("doc_type") == "tiptap_document":
                try:
                    document_wrapper = json.loads(content_str)
                    if document_wrapper.get("type") == "tiptap_document":
                        content = document_wrapper.get("content", "")
                        doc_info["title"] = document_wrapper.get("title", doc_info["title"])
                        doc_info["metadata"] = document_wrapper.get("metadata", doc_info.get("metadata", {}))
                        doc_info["doc_type"] = "tiptap_document"
                    else:
                        content = content_str
                except json.JSONDecodeError:
                    content = content_str
            else:
                content = content_str
            
            # Inline local images for proper display in iframe and editor
            # This ensures images work even if they weren't inlined during creation
            if content and isinstance(content, str):
                content = await self._inline_local_images(content)
            
            preview_url = None
            if hasattr(self, '_sandbox_url') and self._sandbox_url:
                preview_url = f"{self._sandbox_url}/docs/{doc_info['filename']}"
            
            await self._ensure_sandbox()
            
            return self.success_response({
                "success": True,
                "document": doc_info,
                "content": content,
                "sandbox_id": self.sandbox_id,
                "preview_url": preview_url
            })
            
        except Exception as e:
            logger.error(f"Error reading document: {str(e)}")
            return self.fail_response(f"Error reading document: {str(e)}")
            
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "list_documents",
            "description": "List all documents in the workspace",
            "parameters": {
                "type": "object",
                "properties": {
                    "tag": {
                        "type": "string",
                        "description": "Filter documents by tag (optional)"
                    }
                }
            }
        }
    })
    async def list_documents(self, tag: Optional[str] = None) -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            all_metadata = await self._load_metadata()
            documents = all_metadata.get("documents", {})
            
            if tag:
                documents = {
                    doc_id: doc_info 
                    for doc_id, doc_info in documents.items()
                    if tag in doc_info.get("metadata", {}).get("tags", [])
                }
            
            sorted_docs = sorted(
                documents.values(), 
                key=lambda x: x.get("updated_at", ""), 
                reverse=True
            )
            
            await self._ensure_sandbox()
            
            return self.success_response({
                "success": True,
                "documents": sorted_docs,
                "count": len(sorted_docs),
                "sandbox_id": self.sandbox_id
            })
            
        except Exception as e:
            logger.error(f"Error listing documents: {str(e)}")
            return self.fail_response(f"Error listing documents: {str(e)}")
            
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "delete_document",
            "description": "Delete a document from the workspace",
            "parameters": {
                "type": "object",
                "properties": {
                    "doc_id": {
                        "type": "string",
                        "description": "ID of the document to delete"
                    }
                },
                "required": ["doc_id"]
            }
        }
    })
    async def delete_document(self, doc_id: str) -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            all_metadata = await self._load_metadata()
            
            if doc_id not in all_metadata["documents"]:
                return self.fail_response(f"Document with ID '{doc_id}' not found")
            
            doc_info = all_metadata["documents"][doc_id]
            
            try:
                await self.sandbox.fs.delete_file(doc_info["path"])
            except:
                pass

            del all_metadata["documents"][doc_id]
            await self._save_metadata(all_metadata)
            
            return self.success_response({
                "success": True,
                "message": f"Document '{doc_info['title']}' deleted successfully"
            })
            
        except Exception as e:
            logger.error(f"Error deleting document: {str(e)}")
            return self.fail_response(f"Error deleting document: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "get_format_guide",
            "description": "Get a guide and example of TipTap-compatible HTML format for creating or updating documents",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    })
    async def get_format_guide(self) -> ToolResult:
        guide = {
            "description": "TipTap is a rich text editor that uses clean, semantic HTML. Follow these guidelines for proper formatting.",
            "supported_elements": {
                "text_structure": {
                    "paragraphs": "<p>Your text here</p>",
                    "headings": ["<h1>Main Title</h1>", "<h2>Section</h2>", "<h3>Subsection</h3>"],
                    "line_breaks": "<br />",
                    "horizontal_rules": "<hr />"
                },
                "text_formatting": {
                    "bold": "<strong>bold text</strong>",
                    "italic": "<em>italic text</em>",
                    "underline": "<u>underlined text</u>",
                    "strikethrough": "<s>strikethrough text</s>",
                    "inline_code": "<code>code snippet</code>"
                },
                "lists": {
                    "unordered": "<ul><li>Item 1</li><li>Item 2</li></ul>",
                    "ordered": "<ol><li>First</li><li>Second</li></ol>",
                    "nested": "<ul><li>Item<ul><li>Nested item</li></ul></li></ul>"
                },
                "blocks": {
                    "blockquote": "<blockquote>Important quote</blockquote>",
                    "code_block": "<pre><code>// Code block\nconst x = 10;</code></pre>"
                },
                "links_and_media": {
                    "link": '<a href="https://example.com">Link text</a>',
                    "image": '<img src="image-url.jpg" alt="Description" />'
                },
                "tables": {
                    "basic": "<table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>",
                    "complex": "<table><thead><tr><th>Col1</th><th>Col2</th></tr></thead><tbody><tr><td>Data1</td><td>Data2</td></tr></tbody></table>"
                }
            },
            "important_rules": [
                "Always wrap content in proper HTML tags",
                "Start with a heading or paragraph tag",
                "Do not use inline styles (style attribute)",
                "Do not use custom CSS classes",
                "Ensure all tags are properly closed",
                "List items must be within <ul> or <ol> tags",
                "Code blocks should use <pre><code> together",
                "Table cells must be within <tr> tags"
            ],
            "example": self._get_tiptap_template_example().strip()
        }
        
        return self.success_response({
            "success": True,
            "guide": guide,
            "message": "Use this guide to format HTML content for TipTap editor"
        })
    
    def _remove_first_heading(self, content: str) -> str:
        """Remove the first h1 heading from HTML content to avoid duplication with the document title."""
        import re
        # Match the first h1 tag and its content, including any whitespace
        # This regex handles h1 tags with or without attributes
        pattern = r'<h1[^>]*>.*?</h1>\s*'
        result = re.sub(pattern, '', content, count=1, flags=re.IGNORECASE | re.DOTALL)
        return result
    
    def _generate_pdf_html(self, title: str, content: str, metadata: Optional[Dict] = None) -> str:
        regular_font = get_lmroman_data_uri("regular")
        bold_font = get_lmroman_data_uri("bold")
        italic_font = get_lmroman_data_uri("italic")
        bold_italic_font = get_lmroman_data_uri("bolditalic")

        font_face_css = ""
        if all([regular_font, bold_font, italic_font, bold_italic_font]):
            font_face_css = f"""
            @font-face {{
                font-family: 'LMRoman';
                src: url('{regular_font}') format('opentype');
                font-weight: 400;
                font-style: normal;
                font-display: swap;
            }}
            @font-face {{
                font-family: 'LMRoman';
                src: url('{bold_font}') format('opentype');
                font-weight: 700;
                font-style: normal;
                font-display: swap;
            }}
            @font-face {{
                font-family: 'LMRoman';
                src: url('{italic_font}') format('opentype');
                font-weight: 400;
                font-style: italic;
                font-display: swap;
            }}
            @font-face {{
                font-family: 'LMRoman';
                src: url('{bold_italic_font}') format('opentype');
                font-weight: 700;
                font-style: italic;
                font-display: swap;
            }}
            """

        css_styles = """
        <style>
            {font_face_css}
            @page {
                size: A4;
                margin: 1in;
            }
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'LMRoman', 'Times New Roman', Times, serif;
                font-size: 14pt;
                line-height: 1.8;
                color: #000000;
                background: white;
                max-width: 100%;
            }
            .header {
                margin-bottom: 2rem;
                padding-bottom: 1rem;
                border-bottom: 2px solid #e5e7eb;
            }
            .title {
                font-size: 3rem;
                font-weight: 700;
                color: #111827;
                margin-bottom: 0.5rem;
            }
            .metadata {
                display: flex;
                gap: 1.5rem;
                color: #6b7280;
                font-size: 11pt;
                margin-top: 0.5rem;
            }
            .metadata-item {
                display: flex;
                align-items: center;
                gap: 0.25rem;
            }
            .tag {
                display: inline-block;
                padding: 0.125rem 0.5rem;
                background: #eff6ff;
                color: #1e40af;
                border-radius: 0.25rem;
                font-size: 11pt;
                margin-right: 0.25rem;
            }
            .content {
                margin-top: 2rem;
            }
            h1 { 
                font-family: 'LMRoman', 'Times New Roman', Times, serif;
                font-size: 24pt; 
                font-weight: 700; 
                margin: 1.5rem 0 0.75rem; 
                color: #111827;
                page-break-after: auto;
                page-break-before: avoid;
                orphans: 2;
                widows: 2;
            }
            h2 { 
                font-family: 'LMRoman', 'Times New Roman', Times, serif;
                font-size: 20pt; 
                font-weight: 700; 
                margin: 1.25rem 0 0.625rem; 
                color: #374151;
                page-break-after: auto;
                page-break-before: avoid;
                orphans: 2;
                widows: 2;
            }
            h3 { 
                font-family: 'LMRoman', 'Times New Roman', Times, serif;
                font-size: 18pt; 
                font-weight: 700; 
                margin: 1rem 0 0.5rem; 
                color: #4b5563;
                page-break-after: auto;
                page-break-before: avoid;
                orphans: 2;
                widows: 2;
            }
            p { 
                font-size: 14pt;
                margin-bottom: 1rem; 
                text-align: left;
                line-height: 1.8;
                orphans: 2;
                widows: 2;
                page-break-inside: avoid;
            }
            ul, ol { 
                font-size: 14pt;
                margin: 0.75rem 0 0.75rem 1.5rem; 
                page-break-inside: avoid;
                line-height: 1.8;
            }
            li { 
                margin-bottom: 0.5rem; 
                line-height: 1.8;
            }
            blockquote {
                font-size: 14pt;
                border-left: 4px solid #3b82f6;
                padding-left: 1rem;
                margin: 1rem 0;
                color: #4b5563;
                font-style: italic;
                background: #f9fafb;
                padding: 0.75rem 1rem;
                page-break-inside: avoid;
                line-height: 1.8;
            }
            pre {
                background: #1f2937;
                color: #f3f4f6;
                padding: 1rem;
                margin: 1rem 0;
                border-radius: 0.5rem;
                overflow-x: auto;
                font-family: 'Courier New', monospace;
                font-size: 12pt;
                page-break-inside: avoid;
                line-height: 1.6;
            }
            code {
                background: #f3f4f6;
                color: #dc2626;
                padding: 0.125rem 0.375rem;
                border-radius: 0.25rem;
                font-family: 'Courier New', monospace;
                font-size: 12pt;
            }
            pre code {
                background: transparent;
                color: inherit;
                padding: 0;
            }
            table {
                border-collapse: collapse;
                width: 100%;
                margin: 1rem 0;
                page-break-inside: avoid;
            }
            th, td {
                border: 1px solid #e5e7eb;
                padding: 0.75rem;
                text-align: left;
                font-size: 14pt;
                line-height: 1.8;
            }
            th {
                background: #f9fafb;
                font-weight: 700;
                color: #374151;
            }
            img {
                display: block;
                max-width: 65%;
                max-height: 400px;
                height: auto;
                margin: 1.5rem auto;
                border-radius: 0.25rem;
                page-break-inside: avoid;
                page-break-after: auto;
            }
            a {
                color: #2563eb;
                text-decoration: none;
                border-bottom: 1px solid transparent;
                font-size: 11pt;
            }
            a:hover {
                border-bottom-color: #2563eb;
            }
            hr {
                border: none;
                border-top: 1px solid #e5e7eb;
                margin: 1.5rem 0;
            }
            .footer {
                margin-top: 3rem;
                padding-top: 1rem;
                border-top: 1px solid #e5e7eb;
                color: #6b7280;
                font-size: 11pt;
                text-align: center;
            }
        </style>
        """.replace("{font_face_css}", font_face_css)
        
        current_time = datetime.now().strftime("%B %d, %Y at %I:%M %p")
        
        doc_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{html.escape(title)}</title>
            {css_styles}
        </head>
        <body>
            <div class="header">
                <div class="title">{html.escape(title)}</div>
                <div class="metadata">
                    <div class="metadata-item">
                        <span>Generated on {current_time}</span>
                    </div>
                    <div class="metadata-item">
                        <span>Created by <a href="https://irisvision.ai" target="_blank">Iris Intelligence</a> for You</span>
                    </div>
        """
        
        if metadata:
            if metadata.get("author"):
                doc_html += f"""
                    <div class="metadata-item">
                        <span>Author: {html.escape(metadata["author"])}</span>
                    </div>
                """
            
            if metadata.get("tags"):
                doc_html += """
                    <div class="metadata-item">
                        <span>Tags: </span>
                """
                for tag in metadata["tags"]:
                    doc_html += f'<span class="tag">{html.escape(tag)}</span>'
                doc_html += """
                    </div>
                """
        
        doc_html += f"""
                </div>
            </div>
            <div class="content">
                {self._remove_first_heading(content)}
            </div>
        </body>
        </html>
        """
        
        return doc_html
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "convert_to_pdf",
            "description": "Convert a document to PDF format. CRITICAL: After successful PDF conversion, you MUST immediately use the 'complete' tool to signal completion. Attach the generated PDF file path in the 'attachments' parameter of the 'complete' tool call. Include a good ending message in the 'complete' tool's text parameter. IMPORTANT: Do NOT write any text message before calling 'complete' - either stay silent or write something completely different (not duplicating what you'll say in the 'complete' tool). The 'complete' tool should be the final action after PDF conversion.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doc_id": {
                        "type": "string",
                        "description": "ID of the document to convert to PDF"
                    },
                    "download": {
                        "type": "boolean",
                        "description": "If true, returns the PDF file for download. If false, saves it in the workspace",
                        "default": False
                    }
                },
                "required": ["doc_id"]
            }
        }
    })
    async def convert_to_pdf(self, doc_id: str, download: bool = False) -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            all_metadata = await self._load_metadata()
            
            if doc_id not in all_metadata["documents"]:
                return self.fail_response(f"Document with ID '{doc_id}' not found")
            
            doc_info = all_metadata["documents"][doc_id]
            
            content_raw = await self.sandbox.fs.download_file(doc_info["path"])
            content_str = content_raw.decode()
            
            if doc_info.get("format") in ["tiptap", "html", "doc"] or doc_info.get("is_tiptap_doc") or doc_info.get("doc_type") == "tiptap_document":
                try:
                    document_wrapper = json.loads(content_str)
                    if document_wrapper.get("type") == "tiptap_document":
                        content = document_wrapper.get("content", "")
                        title = document_wrapper.get("title", doc_info["title"])
                        metadata = document_wrapper.get("metadata", doc_info.get("metadata", {}))
                    else:
                        content = content_str
                        title = doc_info["title"]
                        metadata = doc_info.get("metadata", {})
                except json.JSONDecodeError:
                    content = content_str
                    title = doc_info["title"]
                    metadata = doc_info.get("metadata", {})
            else:
                content = f"<pre>{html.escape(content_str)}</pre>"
                title = doc_info["title"]
                metadata = doc_info.get("metadata", {})
            
            complete_html = self._generate_pdf_html(title, content, metadata)
            
            temp_html_filename = f"temp_pdf_{doc_id}.html"
            temp_html_path = f"/workspace/{temp_html_filename}"
            await self.sandbox.fs.upload_file(complete_html.encode(), temp_html_path)
            
            logger.info(f"Creating PDF from document: {title}")
            
            pdf_filename = f'{self._sanitize_filename(title)}_{doc_id}.pdf'
            pdf_path_value = f'/workspace/docs/{pdf_filename}'
            
            # Build script with proper escaping to avoid f-string issues
            html_file_path = temp_html_path
            pdf_output_path = pdf_path_value
            
            pdf_generation_script = f"""import asyncio
from playwright.async_api import async_playwright
import sys
import os

async def html_to_pdf():
    try:
        # Ensure docs directory exists
        docs_dir = '/workspace/docs'
        os.makedirs(docs_dir, exist_ok=True)
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox']
            )
            
            page = await browser.new_page()
            
            # Navigate to the HTML file
            html_path = '{html_file_path}'
            await page.goto('file://' + html_path, wait_until='networkidle')
            
            # Wait for fonts to load - critical for LMRoman font rendering
            # Data URI fonts need time to decode and load
            try:
                # Wait for all fonts to be ready
                await page.evaluate('''() => {{
                    return new Promise((resolve) => {{
                        if (document.fonts && document.fonts.ready) {{
                            document.fonts.ready.then(() => {{
                                resolve(true);
                            }}).catch(() => resolve(true));
                        }} else {{
                            resolve(true);
                        }}
                    }});
                }}''')
                # Additional buffer time for font rendering
                await page.wait_for_timeout(1500)
            except Exception as font_error:
                # If font loading check fails, wait a safe amount of time
                error_msg_str = str(font_error)
                print("Font loading check completed with note: " + error_msg_str, file=sys.stderr)
                await page.wait_for_timeout(2000)
            
            pdf_path = '{pdf_output_path}'
            
            await page.pdf(
                path=pdf_path,
                format='A4',
                print_background=True,
                margin={{
                    'top': '0.5in',
                    'right': '0.5in',
                    'bottom': '0.5in',
                    'left': '0.5in'
                }}
            )
            
            await browser.close()
            
            print(pdf_path)
            return pdf_path
            
    except Exception as e:
        error_str = str(e)
        print("ERROR: " + error_str, file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    pdf_path = asyncio.run(html_to_pdf())
"""
            
            script_path = f"/workspace/temp_pdf_script_{doc_id}.py"
            await self.sandbox.fs.upload_file(pdf_generation_script.encode(), script_path)
            
            response = await self.sandbox.process.exec(
                f"cd /workspace && python {script_path}",
                timeout=30
            )
            
            await self.sandbox.fs.delete_file(temp_html_path)
            await self.sandbox.fs.delete_file(script_path)
            
            if response.exit_code != 0:
                logger.error(f"PDF generation failed: {response.result}")
                return self.fail_response(f"Failed to generate PDF: {response.result}")
            
            pdf_path = response.result.strip()
            pdf_filename = pdf_path.split('/')[-1]
            
            pdf_info = {
                "doc_id": doc_id,
                "title": title,
                "pdf_filename": pdf_filename,
                "pdf_path": pdf_path,
                "created_at": datetime.now().isoformat(),
                "source_document": doc_info
            }
            
            all_metadata["documents"][doc_id]["last_pdf_export"] = {
                "filename": pdf_filename,
                "path": pdf_path,
                "exported_at": datetime.now().isoformat()
            }
            await self._save_metadata(all_metadata)
            
            preview_url = None
            download_url = None
            if hasattr(self, '_sandbox_url') and self._sandbox_url:
                preview_url = f"{self._sandbox_url}/docs/{pdf_filename}"
                download_url = preview_url
            
            # Store technical info internally but return clean user-friendly message
            if download:
                pdf_content = await self.sandbox.fs.download_file(pdf_path)
                pdf_size_bytes = len(pdf_content)
                pdf_info["size_bytes"] = pdf_size_bytes

                MAX_INLINE_BYTES = 5 * 1024 * 1024  # 5 MB
                # Keep technical data for internal use but return clean message
                internal_data = {
                    "pdf_info": pdf_info,
                    "pdf_filename": pdf_filename,
                    "preview_url": preview_url,
                    "download_url": download_url,
                    "sandbox_id": self.sandbox_id
                }

                if pdf_size_bytes <= MAX_INLINE_BYTES:
                    import base64
                    pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
                    internal_data["pdf_base64"] = pdf_base64
                
                # Return clean user-friendly message
                return self.success_response({
                    "message": f"PDF Conversion Complete",
                    "pdf_filename": pdf_filename,
                    "pdf_path": pdf_path,
                    "title": title,
                    "_internal": internal_data  # Hidden technical data
                })

            # Return clean user-friendly message for non-download mode
            return self.success_response({
                "message": f"PDF Conversion Complete",
                "pdf_filename": pdf_filename,
                "pdf_path": pdf_path,
                "title": title,
                "_internal": {
                    "pdf_info": pdf_info,
                    "preview_url": preview_url,
                    "download_url": download_url,
                    "sandbox_id": self.sandbox_id
                }
            })
                
        except Exception as e:
            logger.error(f"Error converting document to PDF: {str(e)}")
            return self.fail_response(f"Error converting document to PDF: {str(e)}")
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "convert_to_docx",
            "description": "Convert a document to DOCX (Microsoft Word) format with professional formatting. Images will be embedded when possible.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doc_id": {
                        "type": "string",
                        "description": "ID of the document to convert to DOCX"
                    },
                    "download": {
                        "type": "boolean",
                        "description": "If true, returns the DOCX file for download. If false, saves it in the workspace",
                        "default": False
                    }
                },
                "required": ["doc_id"]
            }
        }
    })
    async def convert_to_docx(self, doc_id: str, download: bool = False) -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            all_metadata = await self._load_metadata()
            
            if doc_id not in all_metadata["documents"]:
                return self.fail_response(f"Document with ID '{doc_id}' not found")
            
            doc_info = all_metadata["documents"][doc_id]
            
            # Get the document path
            doc_path = doc_info["path"]
            
            # Make API call to sandbox server to convert to DOCX
            sandbox_url = getattr(self, '_sandbox_url', None)
            if not sandbox_url:
                return self.fail_response("Sandbox URL not available for DOCX conversion")
            
            convert_url = f"{sandbox_url}/document/convert-to-docx"
            
            import httpx
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    convert_url,
                    json={
                        "doc_path": doc_path,
                        "download": True  # Always get the file content
                    }
                )
                
                if response.status_code != 200:
                    error_detail = response.text
                    logger.error(f"DOCX conversion failed: {error_detail}")
                    return self.fail_response(f"Failed to convert to DOCX: {error_detail}")
                
                docx_content = response.content
                
                # Extract filename from Content-Disposition header or create one
                content_disposition = response.headers.get('Content-Disposition', '')
                if 'filename=' in content_disposition:
                    filename_match = re.search(r'filename="(.+?)"', content_disposition)
                    if filename_match:
                        docx_filename = filename_match.group(1)
                    else:
                        docx_filename = f"{self._sanitize_filename(doc_info['title'])}_{doc_id}.docx"
                else:
                    docx_filename = f"{self._sanitize_filename(doc_info['title'])}_{doc_id}.docx"
                
                # Save DOCX file to docs directory
                docx_path = f"/workspace/docs/{docx_filename}"
                await self.sandbox.fs.upload_file(docx_content, docx_path)
                
                # Update metadata
                all_metadata["documents"][doc_id]["last_docx_export"] = {
                    "filename": docx_filename,
                    "path": docx_path,
                    "exported_at": datetime.now().isoformat()
                }
                await self._save_metadata(all_metadata)
                
                preview_url = None
                download_url = None
                if hasattr(self, '_sandbox_url') and self._sandbox_url:
                    preview_url = f"{self._sandbox_url}/docs/{docx_filename}"
                    download_url = preview_url
                
                return self.success_response({
                    "message": f"DOCX Conversion Complete",
                    "docx_filename": docx_filename,
                    "docx_path": docx_path,
                    "title": doc_info["title"],
                    "_internal": {
                        "preview_url": preview_url,
                        "download_url": download_url,
                        "sandbox_id": self.sandbox_id
                    }
                })
                
        except Exception as e:
            logger.error(f"Error converting document to DOCX: {str(e)}")
            return self.fail_response(f"Error converting document to DOCX: {str(e)}")
    
