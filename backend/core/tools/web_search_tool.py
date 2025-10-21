from tavily import AsyncTavilyClient
import httpx
from dotenv import load_dotenv
from core.agentpress.tool import Tool, ToolResult, openapi_schema, tool_metadata
from core.utils.config import config
from core.sandbox.tool_base import SandboxToolsBase
from core.agentpress.thread_manager import ThreadManager
import json
import datetime
import asyncio
import logging
from typing import Optional

# TODO: add subpages, etc... in filters as sometimes its necessary 

class TavilyRateLimitError(Exception):
    """Custom exception for Tavily API rate limit errors"""
    def __init__(self, message: str, retry_after: Optional[int] = None):
        super().__init__(message)
        self.retry_after = retry_after

class TavilyAPIError(Exception):
    """Custom exception for general Tavily API errors"""
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code

@tool_metadata(
    display_name="Web Search",
    description="Search the internet for information, news, and research",
    icon="Search",
    color="bg-green-100 dark:bg-green-800/50",
    weight=30,
    visible=True
)
class SandboxWebSearchTool(SandboxToolsBase):
    """Tool for performing web searches using Tavily API and web scraping using Firecrawl."""

    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        # Load environment variables
        load_dotenv()
        # Use API keys from config
        self.tavily_api_key = config.TAVILY_API_KEY
        self.firecrawl_api_key = config.FIRECRAWL_API_KEY
        self.firecrawl_url = config.FIRECRAWL_URL
        
        if not self.tavily_api_key:
            raise ValueError("TAVILY_API_KEY not found in configuration")
        if not self.firecrawl_api_key:
            raise ValueError("FIRECRAWL_API_KEY not found in configuration")

        # Tavily asynchronous search client
        self.tavily_client = AsyncTavilyClient(api_key=self.tavily_api_key)
        
        # Rate limiting configuration
        self.max_retries = 3
        self.base_delay = 1.0  # Base delay in seconds
        
        # API usage tracking
        self._usage_count = 0
        self._last_reset_time = datetime.datetime.now()

    def _track_api_usage(self):
        """Track API usage and log warnings if approaching limits"""
        self._usage_count += 1
        current_time = datetime.datetime.now()
        
        # Reset counter every hour
        if (current_time - self._last_reset_time).total_seconds() > 3600:
            self._usage_count = 1
            self._last_reset_time = current_time
        
        # Log usage every 10 requests
        if self._usage_count % 10 == 0:
            logging.info(f"Tavily API usage: {self._usage_count} requests in the last hour")
        
        # Warning at 50 requests (assuming free tier limit is around 100/hour)
        if self._usage_count == 50:
            logging.warning(f"Tavily API usage approaching limit: {self._usage_count} requests in the last hour")

    async def _tavily_search_with_retry(self, query: str, max_results: int) -> dict:
        """
        Execute Tavily search with retry logic and proper error handling.
        
        Args:
            query: Search query
            max_results: Maximum number of results to return
            
        Returns:
            Search response from Tavily API
            
        Raises:
            TavilyRateLimitError: When rate limit is exceeded
            TavilyAPIError: For other API errors
        """
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                # Track API usage
                self._track_api_usage()
                
                logging.info(f"Executing Tavily search (attempt {attempt + 1}/{self.max_retries + 1}) for query: '{query}'")
                
                search_response = await self.tavily_client.search(
                    query=query,
                    max_results=max_results,
                    include_images=True,
                    include_answer="advanced",
                    search_depth="advanced",
                )
                
                logging.info(f"Tavily search successful for query: '{query}'")
                return search_response
                
            except Exception as e:
                last_exception = e
                error_message = str(e)
                error_lower = error_message.lower()
                
                logging.warning(f"Tavily search attempt {attempt + 1} failed: {error_message}")
                
                # Check for rate limit errors
                if any(keyword in error_lower for keyword in ['rate limit', 'quota exceeded', 'too many requests', '429']):
                    if attempt < self.max_retries:
                        # Calculate exponential backoff delay
                        delay = self.base_delay * (2 ** attempt)
                        logging.warning(f"Rate limit detected, retrying in {delay} seconds...")
                        await asyncio.sleep(delay)
                        continue
                    else:
                        # Max retries exceeded
                        raise TavilyRateLimitError(
                            f"Tavily API rate limit exceeded after {self.max_retries + 1} attempts. "
                            f"Please try again later. Error: {error_message}"
                        )
                
                # Check for authentication errors
                elif any(keyword in error_lower for keyword in ['unauthorized', '401', 'invalid api key', 'authentication']):
                    raise TavilyAPIError(
                        f"Tavily API authentication failed: {error_message}",
                        status_code=401
                    )
                
                # Check for other HTTP errors
                elif any(keyword in error_lower for keyword in ['400', 'bad request', 'invalid request']):
                    raise TavilyAPIError(
                        f"Invalid request to Tavily API: {error_message}",
                        status_code=400
                    )
                
                # For other errors, retry if we haven't exceeded max attempts
                elif attempt < self.max_retries:
                    delay = self.base_delay * (2 ** attempt)
                    logging.warning(f"API error detected, retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    # Max retries exceeded for other errors
                    raise TavilyAPIError(
                        f"Tavily API error after {self.max_retries + 1} attempts: {error_message}"
                    )
        
        # This should never be reached, but just in case
        if last_exception:
            raise TavilyAPIError(f"Unexpected error in Tavily search: {str(last_exception)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for up-to-date information on a specific topic using the Tavily API. This tool allows you to gather real-time information from the internet to answer user queries, research topics, validate facts, and find recent developments. Results include titles, URLs, and publication dates. Use this tool for discovering relevant web pages before potentially crawling them for complete content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to find relevant web pages. Be specific and include key terms to improve search accuracy. For best results, use natural language questions or keyword combinations that precisely describe what you're looking for."
                    },
                    "num_results": {
                        "type": "integer",
                        "description": "The number of search results to return. Increase for more comprehensive research or decrease for focused, high-relevance results.",
                        "default": 20
                    }
                },
                "required": ["query"]
            }
        }
    })
    async def web_search(
        self, 
        query: str,
        num_results: int = 20
    ) -> ToolResult:
        """
        Search the web using the Tavily API to find relevant and up-to-date information.
        """
        try:
            # Ensure we have a valid query
            if not query or not isinstance(query, str):
                return self.fail_response("A valid search query is required.")
            
            # Normalize num_results
            if num_results is None:
                num_results = 20
            elif isinstance(num_results, int):
                num_results = max(1, min(num_results, 50))
            elif isinstance(num_results, str):
                try:
                    num_results = max(1, min(int(num_results), 50))
                except ValueError:
                    num_results = 20
            else:
                num_results = 20

            # Execute the search with Tavily using retry logic
            logging.info(f"Executing web search for query: '{query}' with {num_results} results")
            search_response = await self._tavily_search_with_retry(query, num_results)
            
            # Check if we have actual results or an answer
            results = search_response.get('results', [])
            answer = search_response.get('answer', '')
            
            # Return the complete Tavily response 
            # This includes the query, answer, results, images and more
            logging.info(f"Retrieved search results for query: '{query}' with answer and {len(results)} results")
            
            # Consider search successful if we have either results OR an answer
            if len(results) > 0 or (answer and answer.strip()):
                return ToolResult(
                    success=True,
                    output=json.dumps(search_response, ensure_ascii=False)
                )
            else:
                # No results or answer found
                logging.warning(f"No search results or answer found for query: '{query}'")
                return ToolResult(
                    success=False,
                    output=json.dumps(search_response, ensure_ascii=False)
                )
        
        except TavilyRateLimitError as e:
            error_message = str(e)
            logging.error(f"Tavily rate limit exceeded for query '{query}': {error_message}")
            return self.fail_response(
                f"Web search rate limit exceeded. Please try again in a few minutes. "
                f"Error: {error_message}"
            )
        
        except TavilyAPIError as e:
            error_message = str(e)
            logging.error(f"Tavily API error for query '{query}': {error_message}")
            if e.status_code == 401:
                return self.fail_response(
                    "Web search authentication failed. Please check API key configuration."
                )
            elif e.status_code == 400:
                return self.fail_response(
                    f"Invalid search request: {error_message}"
                )
            else:
                return self.fail_response(
                    f"Web search API error: {error_message}"
                )
        
        except Exception as e:
            error_message = str(e)
            logging.error(f"Unexpected error performing web search for '{query}': {error_message}")
            simplified_message = f"Error performing web search: {error_message[:200]}"
            if len(error_message) > 200:
                simplified_message += "..."
            return self.fail_response(simplified_message)

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "scrape_webpage",
            "description": "Extract full text content from multiple webpages in a single operation. IMPORTANT: You should ALWAYS collect multiple relevant URLs from web-search results and scrape them all in a single call for efficiency. This tool saves time by processing multiple pages simultaneously rather than one at a time. The extracted text includes the main content of each page without HTML markup by default, but can optionally include full HTML if needed for structure analysis.",
            "parameters": {
                "type": "object",
                "properties": {
                    "urls": {
                        "type": "string",
                        "description": "Multiple URLs to scrape, separated by commas. You should ALWAYS include several URLs when possible for efficiency. Example: 'https://example.com/page1,https://example.com/page2,https://example.com/page3'"
                    },
                    "include_html": {
                        "type": "boolean",
                        "description": "Whether to include the full raw HTML content alongside the extracted text. Set to true when you need to analyze page structure, extract specific HTML elements, or work with complex layouts. Default is false for cleaner text extraction.",
                        "default": False
                    }
                },
                "required": ["urls"]
            }
        }
    })
    async def scrape_webpage(
        self,
        urls: str,
        include_html: bool = False
    ) -> ToolResult:
        """
        Retrieve the complete text content of multiple webpages in a single efficient operation.
        
        ALWAYS collect multiple relevant URLs from search results and scrape them all at once
        rather than making separate calls for each URL. This is much more efficient.
        
        Parameters:
        - urls: Multiple URLs to scrape, separated by commas
        - include_html: Whether to include full HTML content alongside markdown (default: False)
        """
        try:
            logging.info(f"Starting to scrape webpages: {urls}")
            
            # Ensure sandbox is initialized
            await self._ensure_sandbox()
            
            # Parse the URLs parameter
            if not urls:
                logging.warning("Scrape attempt with empty URLs")
                return self.fail_response("Valid URLs are required.")
            
            # Split the URLs string into a list
            url_list = [url.strip() for url in urls.split(',') if url.strip()]
            
            if not url_list:
                logging.warning("No valid URLs found in the input")
                return self.fail_response("No valid URLs provided.")
                
            if len(url_list) == 1:
                logging.warning("Only a single URL provided - for efficiency you should scrape multiple URLs at once")
            
            logging.info(f"Processing {len(url_list)} URLs: {url_list}")
            
            # Process each URL concurrently and collect results
            tasks = [self._scrape_single_url(url, include_html) for url in url_list]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results, handling exceptions
            processed_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logging.error(f"Error processing URL {url_list[i]}: {str(result)}")
                    processed_results.append({
                        "url": url_list[i],
                        "success": False,
                        "error": str(result)
                    })
                else:
                    processed_results.append(result)
            
            results = processed_results

            
            # Summarize results
            successful = sum(1 for r in results if r.get("success", False))
            failed = len(results) - successful
            
            # Create success/failure message
            if successful == len(results):
                message = f"Successfully scraped all {len(results)} URLs. Results saved to:"
                for r in results:
                    if r.get("file_path"):
                        message += f"\n- {r.get('file_path')}"
            elif successful > 0:
                message = f"Scraped {successful} URLs successfully and {failed} failed. Results saved to:"
                for r in results:
                    if r.get("success", False) and r.get("file_path"):
                        message += f"\n- {r.get('file_path')}"
                message += "\n\nFailed URLs:"
                for r in results:
                    if not r.get("success", False):
                        message += f"\n- {r.get('url')}: {r.get('error', 'Unknown error')}"
            else:
                error_details = "; ".join([f"{r.get('url')}: {r.get('error', 'Unknown error')}" for r in results])
                return self.fail_response(f"Failed to scrape all {len(results)} URLs. Errors: {error_details}")
            
            return ToolResult(
                success=True,
                output=message
            )
        
        except Exception as e:
            error_message = str(e)
            logging.error(f"Error in scrape_webpage: {error_message}")
            return self.fail_response(f"Error processing scrape request: {error_message[:200]}")
    
    async def _scrape_single_url(self, url: str, include_html: bool = False) -> dict:
        """
        Helper function to scrape a single URL and return the result information.
        
        Parameters:
        - url: URL to scrape
        - include_html: Whether to include full HTML content alongside markdown
        """
        
        # # Add protocol if missing
        # if not (url.startswith('http://') or url.startswith('https://')):
        #     url = 'https://' + url
        #     logging.info(f"Added https:// protocol to URL: {url}")
            
        logging.info(f"Scraping single URL: {url}")
        
        try:
            # ---------- Firecrawl scrape endpoint ----------
            logging.info(f"Sending request to Firecrawl for URL: {url}")
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Bearer {self.firecrawl_api_key}",
                    "Content-Type": "application/json",
                }
                # Determine formats to request based on include_html flag
                formats = ["markdown"]
                if include_html:
                    formats.append("html")
                
                payload = {
                    "url": url,
                    "formats": formats
                }
                
                # Use longer timeout and retry logic for more reliability
                max_retries = 3
                timeout_seconds = 30
                retry_count = 0
                
                while retry_count < max_retries:
                    try:
                        logging.info(f"Sending request to Firecrawl (attempt {retry_count + 1}/{max_retries})")
                        response = await client.post(
                            f"{self.firecrawl_url}/v1/scrape",
                            json=payload,
                            headers=headers,
                            timeout=timeout_seconds,
                        )
                        response.raise_for_status()
                        data = response.json()
                        logging.info(f"Successfully received response from Firecrawl for {url}")
                        break
                    except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.ReadError) as timeout_err:
                        retry_count += 1
                        logging.warning(f"Request timed out (attempt {retry_count}/{max_retries}): {str(timeout_err)}")
                        if retry_count >= max_retries:
                            raise Exception(f"Request timed out after {max_retries} attempts with {timeout_seconds}s timeout")
                        # Exponential backoff
                        logging.info(f"Waiting {2 ** retry_count}s before retry")
                        await asyncio.sleep(2 ** retry_count)
                    except Exception as e:
                        # Don't retry on non-timeout errors
                        logging.error(f"Error during scraping: {str(e)}")
                        raise e

            # Format the response
            title = data.get("data", {}).get("metadata", {}).get("title", "")
            markdown_content = data.get("data", {}).get("markdown", "")
            html_content = data.get("data", {}).get("html", "") if include_html else ""
            
            logging.info(f"Extracted content from {url}: title='{title}', content length={len(markdown_content)}" + 
                        (f", HTML length={len(html_content)}" if html_content else ""))
            
            formatted_result = {
                "title": title,
                "url": url,
                "text": markdown_content
            }
            
            # Add HTML content if requested and available
            if include_html and html_content:
                formatted_result["html"] = html_content
            
            # Add metadata if available
            if "metadata" in data.get("data", {}):
                formatted_result["metadata"] = data["data"]["metadata"]
                logging.info(f"Added metadata: {data['data']['metadata'].keys()}")
            
            # Create a simple filename from the URL domain and date
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            
            # Extract domain from URL for the filename
            from urllib.parse import urlparse
            parsed_url = urlparse(url)
            domain = parsed_url.netloc.replace("www.", "")
            
            # Clean up domain for filename
            domain = "".join([c if c.isalnum() else "_" for c in domain])
            safe_filename = f"{timestamp}_{domain}.json"
            
            logging.info(f"Generated filename: {safe_filename}")
            
            # Save results to a file in the /workspace/scrape directory
            scrape_dir = f"{self.workspace_path}/scrape"
            await self.sandbox.fs.create_folder(scrape_dir, "755")
            
            results_file_path = f"{scrape_dir}/{safe_filename}"
            json_content = json.dumps(formatted_result, ensure_ascii=False, indent=2)
            logging.info(f"Saving content to file: {results_file_path}, size: {len(json_content)} bytes")
            
            await self.sandbox.fs.upload_file(
                json_content.encode(),
                results_file_path,
            )
            
            return {
                "url": url,
                "success": True,
                "title": title,
                "file_path": results_file_path,
                "content_length": len(markdown_content)
            }
        
        except Exception as e:
            error_message = str(e)
            logging.error(f"Error scraping URL '{url}': {error_message}")
            
            # Create an error result
            return {
                "url": url,
                "success": False,
                "error": error_message
            }


if __name__ == "__main__":
    async def test_web_search():
        """Test function for the web search tool"""
        # This test function is not compatible with the sandbox version
        print("Test function needs to be updated for sandbox version")
    
    async def test_scrape_webpage():
        """Test function for the webpage scrape tool"""
        # This test function is not compatible with the sandbox version
        print("Test function needs to be updated for sandbox version")
    
    async def run_tests():
        """Run all test functions"""
        await test_web_search()
        await test_scrape_webpage()
        
    asyncio.run(run_tests())