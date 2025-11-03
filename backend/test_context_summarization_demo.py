#!/usr/bin/env python3
"""
Demo test for context summarization functionality.

Creates demo messages with enough content to trigger summarization
and verifies that messages get properly summarized.

Run with: uv run python test_context_summarization_demo.py
"""

import asyncio
import sys
import os
from typing import List, Dict, Any

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from litellm.utils import token_counter
    from core.agentpress.context_manager import ContextManager, SUMMARIZATION_TOKEN_THRESHOLD
    from core.utils.logger import logger
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("\nPlease run this script with uv:")
    print("  uv run python test_context_summarization_demo.py")
    print("\nOr make sure you're in the backend directory and dependencies are installed.")
    sys.exit(1)


def generate_long_text(topic: str, length: int = 5000) -> str:
    """Generate a long text message about a topic."""
    paragraphs = []
    base_text = f"""
    {topic} is a fascinating subject that requires deep exploration and understanding.
    Throughout history, {topic} has played a crucial role in shaping human civilization.
    The fundamental principles of {topic} are based on several key concepts that interrelate
    in complex ways. Understanding these relationships is essential for anyone seeking to
    master the subject.
    
    One of the most important aspects of {topic} is its practical application in real-world scenarios.
    Many professionals rely on {topic} to solve complex problems and make informed decisions.
    The theoretical foundations of {topic} provide a framework for understanding how different
    elements interact and influence each other.
    
    Research in {topic} has revealed numerous insights that continue to shape our understanding.
    These discoveries have led to new methodologies and approaches that enhance our ability to
    work with {topic} effectively. The field is constantly evolving, with new research emerging
    regularly that challenges existing paradigms and introduces innovative concepts.
    
    When working with {topic}, it's important to consider multiple perspectives and approaches.
    Different schools of thought offer unique insights that can enrich our understanding.
    By exploring these various viewpoints, we can develop a more comprehensive and nuanced
    appreciation of {topic} and its applications.
    """
    
    # Repeat and vary the text to reach desired length
    while len(base_text) < length:
        base_text += base_text.replace(topic, f"{topic} (continued)")
        if len(base_text) > length:
            base_text = base_text[:length]
    
    return base_text.strip()


def create_demo_messages(num_messages: int = 50) -> List[Dict[str, Any]]:
    """Create a list of demo messages that will trigger summarization."""
    messages = []
    topics = [
        "Machine Learning", "Artificial Intelligence", "Software Engineering",
        "Data Science", "Web Development", "Cloud Computing", "DevOps",
        "Cybersecurity", "Blockchain Technology", "Quantum Computing",
        "Natural Language Processing", "Computer Vision", "Robotics",
        "Internet of Things", "Mobile App Development"
    ]
    
    for i in range(num_messages):
        role = "user" if i % 2 == 0 else "assistant"
        topic = topics[i % len(topics)]
        
        # Create increasingly long messages to ensure we exceed threshold
        message_length = 3000 + (i * 200)  # Start at 3k, grow by 200 per message
        
        content = generate_long_text(topic, message_length)
        
        message = {
            "role": role,
            "content": content,
            "message_id": f"msg_{i:04d}",
            "created_at": f"2024-01-{(i % 28) + 1:02d}T10:00:00Z"
        }
        
        messages.append(message)
    
    return messages


async def test_summarization():
    """Test the summarization functionality."""
    print("=" * 70)
    print("Context Summarization Demo Test")
    print("=" * 70)
    
    # Create demo messages
    print("\n📝 Creating demo messages...")
    messages = create_demo_messages(num_messages=50)
    print(f"   Created {len(messages)} messages")
    
    # Calculate initial token count
    llm_model = "gemini/gemini-2.0-flash-exp"  # Use a model with large context window
    initial_token_count = token_counter(model=llm_model, messages=messages)
    
    print(f"   Total messages: {len(messages)}")
    print(f"   Initial token count: {initial_token_count:,}")
    print(f"   Summarization threshold: {SUMMARIZATION_TOKEN_THRESHOLD:,}")
    print(f"   Will trigger summarization: {'✅ YES' if initial_token_count >= SUMMARIZATION_TOKEN_THRESHOLD else '❌ NO (adding more messages)'}")
    
    # If we haven't reached threshold, add more messages
    if initial_token_count < SUMMARIZATION_TOKEN_THRESHOLD:
        additional_messages = create_demo_messages(num_messages=100)
        messages.extend(additional_messages)
        initial_token_count = token_counter(model=llm_model, messages=messages)
        print(f"   New token count: {initial_token_count:,}")
        print(f"   Total messages: {len(messages)}")
    
    if initial_token_count < SUMMARIZATION_TOKEN_THRESHOLD:
        # Create a few extremely long messages
        for i in range(20):
            long_message = {
                "role": "user" if i % 2 == 0 else "assistant",
                "content": generate_long_text(f"Topic {i}", length=25000),  # 25k chars per message
                "message_id": f"long_msg_{i:04d}",
                "created_at": f"2024-01-{(i % 28) + 1:02d}T10:00:00Z"
            }
            messages.append(long_message)
        
        initial_token_count = token_counter(model=llm_model, messages=messages)
        print(f"   Final token count: {initial_token_count:,}")
        print(f"   Total messages: {len(messages)}")
    
    # Show sample message before compression
    if messages:
        sample_before = messages[0]
        print(f"   Role: {sample_before.get('role')}")
        print(f"   Content length: {len(str(sample_before.get('content', '')))} chars")
        print(f"   Content preview: {str(sample_before.get('content', ''))[:150]}...")
        print(f"   Has _summarized flag: {sample_before.get('_summarized', False)}")
    
    # Initialize ContextManager
    context_manager = ContextManager()
    
    # Run compression (this should trigger summarization)
    print(f"   This will summarize messages that exceed the {SUMMARIZATION_TOKEN_THRESHOLD:,} token threshold...")
    
    try:
        compressed_messages, compression_report = await context_manager.compress_messages(
            messages=messages,
            llm_model=llm_model,
            max_tokens=None,  # Let it use model defaults
            actual_total_tokens=initial_token_count,
            system_prompt=None,
            return_report=True,
        )
        
        
        # Calculate final token count
        final_token_count = token_counter(model=llm_model, messages=compressed_messages)
        
        # Count summarized messages
        summarized_count = sum(1 for msg in compressed_messages if msg.get('_summarized', False))
        
        # Check message content lengths
        original_lengths = [len(str(msg.get('content', ''))) for msg in messages]
        compressed_lengths = [len(str(msg.get('content', ''))) for msg in compressed_messages]
        
        print(f"   Messages before: {len(messages)}")
        print(f"   Messages after: {len(compressed_messages)}")
        print(f"   Messages summarized: {summarized_count}")
        print(f"   Token count before: {initial_token_count:,}")
        print(f"   Token count after: {final_token_count:,}")
        print(f"   Tokens saved: {initial_token_count - final_token_count:,}")
        print(f"   Compression ratio: {(1 - final_token_count / initial_token_count) * 100:.1f}%")
        if compression_report:
            print(f"\n🧮 Compression report: {compression_report.summary_line()}")
        
        # Show sample message after compression
        if compressed_messages:
            sample_after = compressed_messages[0]
            print(f"   Role: {sample_after.get('role')}")
            print(f"   Content length: {len(str(sample_after.get('content', '')))} chars")
            print(f"   Content preview: {str(sample_after.get('content', ''))[:150]}...")
            print(f"   Has _summarized flag: {sample_after.get('_summarized', False)}")
            
            # Show length comparison
            if messages:
                original_len = len(str(messages[0].get('content', '')))
                compressed_len = len(str(sample_after.get('content', '')))
        
        # Verify summarization occurred
        if summarized_count > 0:
            print(f"   {summarized_count} messages were successfully summarized")
        else:
            print(f"   This might mean:")
            print(f"   - Token count didn't reach threshold ({SUMMARIZATION_TOKEN_THRESHOLD:,})")
            print(f"   - Or summarization failed silently")
        
        return summarized_count > 0 and final_token_count < initial_token_count
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return False


async def test_individual_message_summarization():
    """Test summarizing a single message."""
    print("\n" + "=" * 70)
    print("Individual Message Summarization Test")
    print("=" * 70)
    
    context_manager = ContextManager()
    
    # Create a long message
    long_content = generate_long_text("Python Programming", length=10000)
    message = {
        "role": "user",
        "content": long_content,
        "message_id": "test_msg_001"
    }
    
    print(f"   Length: {len(long_content)} chars")
    print(f"   Preview: {long_content[:200]}...")
    
    try:
        summary = await context_manager.summarize_message(message, max_summary_tokens=150)
        
        print(f"   Length: {len(summary)} chars")
        print(f"   Content: {summary}")
        
        # Calculate compression
        original_tokens = token_counter(model="gemini/gemini-2.0-flash-exp", messages=[message])
        summary_message = {**message, "content": summary}
        summary_tokens = token_counter(model="gemini/gemini-2.0-flash-exp", messages=[summary_message])
        
        print(f"   Original tokens: {original_tokens}")
        print(f"   Summary tokens: {summary_tokens}")
        print(f"   Tokens saved: {original_tokens - summary_tokens}")
        print(f"   Compression: {(1 - summary_tokens/original_tokens) * 100:.1f}%")
        
        return len(summary) < len(long_content) and summary_tokens < original_tokens
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests."""
    print("\n🚀 Starting Context Summarization Tests\n")
    
    # Test 1: Individual message summarization (faster, good for quick test)
    print("TEST 1: Individual Message Summarization")
    test1_result = await test_individual_message_summarization()
    
    # Test 2: Full context compression with many messages
    print("\n\nTEST 2: Full Context Compression")
    test2_result = await test_summarization()
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    print(f"Individual Summarization: {'✅ PASSED' if test1_result else '❌ FAILED'}")
    print(f"Full Context Compression:  {'✅ PASSED' if test2_result else '❌ FAILED'}")
    
    if test1_result and test2_result:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print("\n⚠️  Some tests failed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)