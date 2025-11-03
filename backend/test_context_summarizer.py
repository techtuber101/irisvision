#!/usr/bin/env python3
"""
Test script for the context summarizer endpoints.

Usage:
    python test_context_summarizer.py <thread_id> [jwt_token]

If JWT token is not provided, the script will attempt to read it from environment variable JWT_TOKEN
or prompt for it.
"""

import asyncio
import sys
import os
import json
from typing import Optional

try:
    import httpx
except ImportError:
    print("Error: httpx is required. Install it with: pip install httpx")
    sys.exit(1)


# Configuration
BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
TEST_ENDPOINT = f"{BASE_URL}/threads/{{thread_id}}/summarize/test"
STREAM_ENDPOINT = f"{BASE_URL}/threads/{{thread_id}}/summarize/stream"


async def test_summarize_test_endpoint(thread_id: str, jwt_token: str) -> bool:
    """Test the GET /threads/{thread_id}/summarize/test endpoint."""
    print(f"\n{'='*60}")
    print(f"Testing: GET /threads/{thread_id}/summarize/test")
    print(f"{'='*60}")
    
    url = TEST_ENDPOINT.format(thread_id=thread_id)
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            
            print(f"Status Code: {response.status_code}")
            print(f"Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Success! Response: {json.dumps(data, indent=2)}")
                return True
            else:
                print(f"❌ Failed! Status: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
    except httpx.RequestError as e:
        print(f"❌ Request Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


async def test_summarize_stream_endpoint(thread_id: str, jwt_token: str) -> bool:
    """Test the POST /threads/{thread_id}/summarize/stream endpoint."""
    print(f"\n{'='*60}")
    print(f"Testing: POST /threads/{thread_id}/summarize/stream")
    print(f"{'='*60}")
    
    url = STREAM_ENDPOINT.format(thread_id=thread_id)
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers) as response:
                print(f"Status Code: {response.status_code}")
                print(f"Content-Type: {response.headers.get('content-type', 'unknown')}")
                
                if response.status_code != 200:
                    error_text = await response.aread()
                    print(f"❌ Failed! Status: {response.status_code}")
                    print(f"Response: {error_text.decode('utf-8', errors='ignore')}")
                    return False
                
                print("\n📡 Streaming response (Server-Sent Events):\n")
                print("-" * 60)
                
                full_content = []
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix
                        try:
                            data = json.loads(data_str)
                            event_type = data.get("type", "unknown")
                            if event_type == "content":
                                content = data.get("content", "")
                                print(content, end="", flush=True)
                                full_content.append(content)
                            elif event_type == "done":
                                print("\n✅ Stream completed successfully!")
                                break
                            elif event_type == "error":
                                error_msg = data.get("error", "Unknown error")
                                print(f"\n❌ Error from stream: {error_msg}")
                                return False
                        except json.JSONDecodeError:
                            # If not JSON, just print it
                            print(f"[Non-JSON data]: {data_str}")
                
                print("\n" + "-" * 60)
                summary = "".join(full_content)
                print(f"\n📝 Full Summary ({len(summary)} chars):")
                print(summary)
                
                return True
                
    except httpx.RequestError as e:
        print(f"❌ Request Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def check_backend_health() -> bool:
    """Check if backend is running."""
    health_url = f"{BASE_URL}/api/health"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(health_url)
            if response.status_code == 200:
                return True
    except Exception:
        pass
    return False


async def main():
    """Main test function."""
    # Get thread_id from command line
    if len(sys.argv) < 2:
        print("="*60)
        print("Context Summarizer Endpoint Test Script")
        print("="*60)
        print("\nUsage: python test_context_summarizer.py <thread_id> [jwt_token]")
        print("\nOptions:")
        print("  <thread_id>    - The thread ID to test (required)")
        print("  [jwt_token]    - JWT token for authentication (optional)")
        print("\nEnvironment Variables:")
        print("  JWT_TOKEN      - Set this to provide JWT token")
        print("  BACKEND_URL    - Backend base URL (default: http://localhost:8000)")
        print("\nExample:")
        print("  export JWT_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
        print("  python test_context_summarizer.py abc123-thread-id")
        print("\nEndpoints being tested:")
        print(f"  1. GET  {BASE_URL}/threads/<thread_id>/summarize/test")
        print(f"  2. POST {BASE_URL}/threads/<thread_id>/summarize/stream")
        sys.exit(1)
    
    thread_id = sys.argv[1]
    
    # Check if backend is running
    print(f"\n🔍 Checking if backend is running at {BASE_URL}...")
    backend_running = await check_backend_health()
    if not backend_running:
        print(f"⚠️  Warning: Backend does not appear to be running at {BASE_URL}")
        print("   Make sure your backend server is started:")
        print("     docker-compose -f docker-compose.local.yaml up -d backend")
        print("   Or check if BACKEND_URL is set correctly")
        response = input("\nContinue anyway? (y/n): ").strip().lower()
        if response != 'y':
            sys.exit(1)
    else:
        print("✅ Backend is running")
    
    # Get JWT token
    jwt_token = None
    if len(sys.argv) >= 3:
        jwt_token = sys.argv[2]
    elif os.getenv("JWT_TOKEN"):
        jwt_token = os.getenv("JWT_TOKEN")
    else:
        print("\n📝 JWT Token Required")
        print("   You can get your JWT token from:")
        print("   - Browser DevTools: Application > Cookies > session.access_token")
        print("   - Supabase Dashboard > Authentication > Users")
        print("   - Or set JWT_TOKEN environment variable")
        jwt_token = input("\nEnter your JWT token: ").strip()
    
    if not jwt_token:
        print("❌ Error: JWT token is required")
        sys.exit(1)
    
    print(f"\n🚀 Testing Context Summarizer Endpoints")
    print(f"Base URL: {BASE_URL}")
    print(f"Thread ID: {thread_id}")
    print(f"Token: {jwt_token[:20]}..." if len(jwt_token) > 20 else f"Token: {jwt_token}")
    
    # Test 1: Test endpoint
    test1_success = await test_summarize_test_endpoint(thread_id, jwt_token)
    
    # Test 2: Stream endpoint (only if test endpoint passed)
    test2_success = False
    if test1_success:
        test2_success = await test_summarize_stream_endpoint(thread_id, jwt_token)
    else:
        print("\n⚠️  Skipping stream endpoint test because test endpoint failed")
    
    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    print(f"Backend Health:        {'✅ ONLINE' if backend_running else '⚠️  OFFLINE'}")
    print(f"Test Endpoint (GET):    {'✅ PASSED' if test1_success else '❌ FAILED'}")
    print(f"Stream Endpoint (POST): {'✅ PASSED' if test2_success else '❌ FAILED' if test1_success else '⏭️  SKIPPED'}")
    
    if test1_success and test2_success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed")
        print("\nTroubleshooting:")
        if not test1_success:
            print("  - Verify the thread_id exists and you have access to it")
            print("  - Check that your JWT token is valid and not expired")
            print("  - Ensure you're authenticated as the thread owner")
        if test1_success and not test2_success:
            print("  - Check backend logs for streaming errors")
            print("  - Verify Gemini API key is configured")
            print("  - Ensure thread has messages to summarize")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

