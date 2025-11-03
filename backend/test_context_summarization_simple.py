#!/usr/bin/env python3
"""
Simple demo test for context summarization - faster version.

Tests the summarization functionality with a smaller set of messages.

Run with: uv run python test_context_summarization_simple.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from litellm.utils import token_counter
    from core.agentpress.context_manager import ContextManager
    from core.utils.logger import logger
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("\nPlease run this script with uv:")
    print("  uv run python test_context_summarization_simple.py")
    sys.exit(1)


def create_demo_message(topic: str, num_paragraphs: int = 20) -> dict:
    """Create a long demo message."""
    paragraphs = []
    for i in range(num_paragraphs):
        paragraphs.append(f"""
        {topic} is a crucial topic in modern technology. Paragraph {i+1} discusses various 
        aspects of {topic} including its fundamental principles, practical applications, and 
        theoretical foundations. Understanding {topic} requires a deep comprehension of its 
        core concepts, which include several key components that interact in complex ways.
        
        Researchers and practitioners continue to explore new dimensions of {topic}, discovering
        innovative approaches and methodologies. The field evolves rapidly, with new insights
        emerging regularly that challenge existing paradigms and introduce fresh perspectives.
        """)
    
    content = "\n".join(paragraphs)
    return {
        "role": "user",
        "content": content,
        "message_id": f"msg_{topic.replace(' ', '_')}"
    }


async def test_individual_summarization():
    """Test summarizing a single long message."""
    print("=" * 70)
    print("TEST: Individual Message Summarization")
    print("=" * 70)
    
    context_manager = ContextManager()
    
    # Create a long message (about 5000 chars)
    message = create_demo_message("Machine Learning Algorithms", num_paragraphs=15)
    original_content = message["content"]
    original_length = len(original_content)
    
    print(f"\n📝 Original Message:")
    print(f"   Length: {original_length:,} characters")
    print(f"   Preview: {original_content[:200]}...")
    
    # Count tokens
    original_tokens = token_counter(model="gemini/gemini-2.0-flash-exp", messages=[message])
    print(f"   Tokens: {original_tokens:,}")
    
    # Summarize
    print(f"\n⚙️  Summarizing...")
    summary = await context_manager.summarize_message(message, max_summary_tokens=150)
    
    print(f"\n📄 Summary:")
    print(f"   Length: {len(summary):,} characters")
    print(f"   Content: {summary}")
    
    # Count summary tokens
    summary_message = {**message, "content": summary}
    summary_tokens = token_counter(model="gemini/gemini-2.0-flash-exp", messages=[summary_message])
    print(f"\n📊 Results:")
    print(f"   Original: {original_tokens:,} tokens, {original_length:,} chars")
    print(f"   Summary:  {summary_tokens:,} tokens, {len(summary):,} chars")
    print(f"   Reduction: {original_tokens - summary_tokens:,} tokens ({((1 - summary_tokens/original_tokens) * 100):.1f}%)")
    
    success = len(summary) < original_length and summary_tokens < original_tokens and len(summary) > 0
    print(f"\n{'✅ SUCCESS' if success else '❌ FAILED'}")
    return success


async def test_multiple_messages():
    """Test summarizing multiple messages."""
    print("\n" + "=" * 70)
    print("TEST: Multiple Messages Compression")
    print("=" * 70)
    
    # Create 15 long messages (more messages to trigger summarization at 100k threshold)
    messages = []
    topics = [
        "Python Programming", "Web Development", "Cloud Computing",
        "Data Science", "Machine Learning", "DevOps", "Cybersecurity",
        "Blockchain", "AI Research", "Software Architecture",
        "Database Design", "API Development", "System Architecture",
        "Network Security", "Software Testing"
    ]
    
    for i, topic in enumerate(topics):
        msg = create_demo_message(topic, num_paragraphs=15)  # Longer messages
        msg["role"] = "user" if i % 2 == 0 else "assistant"
        messages.append(msg)
    
    total_chars = sum(len(msg["content"]) for msg in messages)
    total_tokens = token_counter(model="gemini/gemini-2.0-flash-exp", messages=messages)
    
    print(f"\n📝 Created {len(messages)} messages:")
    print(f"   Total characters: {total_chars:,}")
    print(f"   Total tokens: {total_tokens:,}")
    
    # Show first message
    if messages:
        first_msg = messages[0]
        print(f"\n📄 Sample message (first):")
        print(f"   Role: {first_msg['role']}")
        print(f"   Length: {len(first_msg['content']):,} chars")
        print(f"   Preview: {first_msg['content'][:150]}...")
    
    # Test individual summarization on enough messages to achieve 50%+ savings
    # We'll summarize ~60% of messages (10 out of 15) to meet the 50% target
    messages_to_summarize = int(len(messages) * 0.6)  # 60% of messages
    print(f"\n⚙️  Testing summarization on {messages_to_summarize} messages to achieve 50%+ savings (using new aggressive settings)...")
    context_manager = ContextManager()
    
    for i in range(min(messages_to_summarize, len(messages))):
        msg = messages[i]
        original_len = len(msg["content"])
        print(f"\n   Message {i+1}: {len(msg['content']):,} chars -> ", end="", flush=True)
        
        summary = await context_manager.summarize_message(msg, max_summary_tokens=80)  # Using new 80 token limit
        new_len = len(summary)
        reduction = ((original_len - new_len) / original_len * 100) if original_len > 0 else 0
        
        print(f"{new_len:,} chars ({reduction:.1f}% reduction)")
        messages[i]["content"] = summary
        messages[i]["_summarized"] = True
    
    # Show results
    summarized_count = sum(1 for msg in messages if msg.get("_summarized", False))
    final_chars = sum(len(msg["content"]) for msg in messages)
    final_tokens = token_counter(model="gemini/gemini-2.0-flash-exp", messages=messages)
    
    token_reduction = ((total_tokens - final_tokens) / total_tokens * 100) if total_tokens > 0 else 0
    
    print(f"\n📊 Results:")
    print(f"   Messages summarized: {summarized_count}/{len(messages)}")
    print(f"   Characters: {total_chars:,} -> {final_chars:,} ({((1 - final_chars/total_chars) * 100):.1f}% reduction)")
    print(f"   Tokens: {total_tokens:,} -> {final_tokens:,} ({token_reduction:.1f}% reduction)")
    
    # Check if we achieved at least 50% savings
    achieved_50_percent = token_reduction >= 50.0
    success = summarized_count > 0 and final_tokens < total_tokens
    
    if achieved_50_percent:
        print(f"\n🎯 Target achieved: {token_reduction:.1f}% reduction >= 50% target!")
    else:
        print(f"\n⚠️  Target not met: {token_reduction:.1f}% reduction < 50% target")
    
    print(f"\n{'✅ SUCCESS' if success and achieved_50_percent else '⚠️  PARTIAL' if success else '❌ FAILED'}")
    return success and achieved_50_percent


async def main():
    """Run all tests."""
    print("\n🚀 Context Summarization Demo Test\n")
    
    # Test 1: Individual message
    test1 = await test_individual_summarization()
    
    # Test 2: Multiple messages
    test2 = await test_multiple_messages()
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    print(f"Individual Summarization: {'✅ PASSED' if test1 else '❌ FAILED'}")
    print(f"Multiple Messages Test:    {'✅ PASSED' if test2 else '❌ FAILED'}")
    
    if test1 and test2:
        print("\n🎉 All tests passed! Summarization is working correctly.")
        return 0
    else:
        print("\n⚠️  Some tests failed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

