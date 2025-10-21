# Web Search API Limits Fix

## Problem Analysis

The web search API was hitting rate limits due to insufficient error handling and lack of retry mechanisms. The original implementation had basic exception handling that didn't specifically address Tavily API rate limit errors.

## Root Causes Identified

1. **Insufficient Error Handling**: Generic exception handling without specific rate limit detection
2. **No Retry Logic**: No exponential backoff for temporary rate limit issues
3. **No Usage Monitoring**: No tracking of API usage patterns
4. **Poor Error Messages**: Generic error messages that didn't help users understand the issue

## Solutions Implemented

### 1. Custom Exception Classes

Added specific exception classes for better error handling:

```python
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
```

### 2. Retry Logic with Exponential Backoff

Implemented `_tavily_search_with_retry()` method that:

- Retries up to 3 times for rate limit errors
- Uses exponential backoff (1s, 2s, 4s delays)
- Detects specific error types (rate limit, auth, bad request)
- Provides detailed logging for each attempt

### 3. Improved Error Handling

The web search method now handles:

- **Rate Limit Errors**: Specific handling with user-friendly messages
- **Authentication Errors**: Clear messages about API key issues
- **Bad Request Errors**: Validation error messages
- **General API Errors**: Fallback error handling

### 4. API Usage Monitoring

Added usage tracking that:

- Counts API requests per hour
- Logs usage every 10 requests
- Warns when approaching limits (50 requests)
- Resets counter hourly

## Key Features

### Retry Configuration
```python
self.max_retries = 3
self.base_delay = 1.0  # Base delay in seconds
```

### Usage Tracking
```python
def _track_api_usage(self):
    """Track API usage and log warnings if approaching limits"""
    self._usage_count += 1
    # ... implementation details
```

### Error Detection
The system now detects:
- Rate limit errors (429, "rate limit", "quota exceeded")
- Authentication errors (401, "unauthorized", "invalid api key")
- Bad request errors (400, "bad request", "invalid request")

## Monitoring and Debugging

### Log Messages to Watch For

1. **Normal Operation**:
   ```
   INFO: Executing Tavily search (attempt 1/4) for query: 'example'
   INFO: Tavily search successful for query: 'example'
   INFO: Tavily API usage: 10 requests in the last hour
   ```

2. **Rate Limit Warnings**:
   ```
   WARNING: Rate limit detected, retrying in 2 seconds...
   WARNING: Tavily API usage approaching limit: 50 requests in the last hour
   ```

3. **Rate Limit Errors**:
   ```
   ERROR: Tavily rate limit exceeded for query 'example': Tavily API rate limit exceeded after 4 attempts
   ```

4. **Authentication Errors**:
   ```
   ERROR: Tavily API error for query 'example': Tavily API authentication failed
   ```

### How to Check API Limits

1. **Check Logs**: Look for usage warnings and rate limit errors
2. **Monitor Usage Count**: The system logs usage every 10 requests
3. **Check Tavily Dashboard**: Verify your API key limits in Tavily's dashboard
4. **Review Error Messages**: Users will now see specific error messages

## Configuration

### Environment Variables
Ensure these are properly set in your `.env` file:

```env
TAVILY_API_KEY=your-tavily-api-key
```

### Rate Limiting Settings
You can adjust these in the `SandboxWebSearchTool` class:

```python
self.max_retries = 3          # Number of retry attempts
self.base_delay = 1.0         # Base delay for exponential backoff
```

## Testing the Fix

To test the improved error handling:

1. **Rate Limit Test**: Make many rapid requests to trigger rate limits
2. **Auth Test**: Use an invalid API key to test authentication error handling
3. **Retry Test**: Monitor logs to see retry attempts with exponential backoff

## Benefits

1. **Better User Experience**: Clear error messages instead of generic failures
2. **Automatic Recovery**: Retry logic handles temporary rate limit issues
3. **Proactive Monitoring**: Usage tracking helps prevent hitting limits
4. **Detailed Logging**: Better debugging information for developers
5. **Graceful Degradation**: System continues to work even with API issues

## Next Steps

1. Monitor the logs for any remaining issues
2. Adjust retry settings if needed based on usage patterns
3. Consider implementing a more sophisticated rate limiting strategy if needed
4. Add metrics collection for API usage analytics

## Files Modified

- `backend/core/tools/web_search_tool.py`: Main implementation with all improvements

The web search API should now handle rate limits much more gracefully and provide better feedback when issues occur.
