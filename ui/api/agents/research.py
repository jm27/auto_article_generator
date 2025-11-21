import json
import logging
import os
import re
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler
from typing import List, TypedDict

from langgraph.graph import END, StateGraph
from langsmith.wrappers import wrap_openai
from openai import OpenAI

# ──────────────────────────────────────────────────────────────────────────────
# Enhanced Logging Configuration
# ──────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG,  # Changed to DEBUG for maximum verbosity
    format="%(asctime)s %(name)s %(levelname)s: %(message)s",
)
logger = logging.getLogger("research-agent")
logger.info("[System] 🚀 Research Agent starting up...")

# ──────────────────────────────────────────────────────────────────────────────
# Environment Variable Loading in local Development
# ──────────────────────────────────────────────────────────────────────────────
#  Uncomment the following block if you want to load .env files in local development.

# from dotenv import load_dotenv

# try:
#     logger.info("[Environment] 🔍 Beginning environment variable loading process...")

#     dotenv_paths = [
#         os.path.join(os.path.dirname(__file__), "..", "..", ".env.local"),
#         os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env.local"),
#         os.path.join(os.path.dirname(__file__), "..", ".env.local"),
#         os.path.join(os.path.dirname(__file__), ".env.local"),
#         ".env.local",
#         ".env",
#     ]

#     logger.info(
#         f"[Environment] 📁 Checking {len(dotenv_paths)} potential .env file locations..."
#     )

#     for i, path in enumerate(dotenv_paths, 1):
#         full_path = os.path.abspath(path)
#         logger.debug(f"[Environment] {i}/{len(dotenv_paths)} Checking: {full_path}")

#         if os.path.exists(path):
#             load_dotenv(dotenv_path=path)
#             logger.info(
#                 f"[Environment] ✅ Successfully loaded environment from: {full_path}"
#             )

#             # List loaded variables (without exposing secrets)
#             env_vars = [
#                 key
#                 for key in os.environ.keys()
#                 if any(keyword in key.upper() for keyword in ["OPENAI", "API", "KEY"])
#             ]
#             logger.debug(f"[Environment] 📋 Relevant env vars found: {len(env_vars)}")
#             break
#         else:
#             logger.debug(f"[Environment] ❌ File not found: {full_path}")
#     else:
#         logger.warning("[Environment] ⚠️ No .env file found in any expected location")

#         # Debug: Show what files are available
#         current_dir = os.path.dirname(__file__)
#         parent_dir = os.path.join(current_dir, "..", "..")
#         if os.path.exists(parent_dir):
#             files = [f for f in os.listdir(parent_dir) if f.startswith(".env")]
#             logger.info(
#                 f"[Environment] 📄 .env files in {os.path.abspath(parent_dir)}: {files}"
#             )

# except ImportError as e:
#     logger.warning(f"[Environment] ⚠️ python-dotenv not available: {e}")

# ──────────────────────────────────────────────────────────────────────────────
# OpenAI Client Initialization
# ──────────────────────────────────────────────────────────────────────────────
logger.info("[OpenAI] 🔑 Initializing OpenAI client...")

openai_api_key = os.environ.get("OPENAI_API_KEY")
if openai_api_key:
    logger.info(
        f"[OpenAI] ✅ API key found (length: {len(openai_api_key)} chars, starts with: {openai_api_key[:10]}...)"
    )
    openai_client = wrap_openai(OpenAI(api_key=openai_api_key))
    logger.info("[OpenAI] ✅ OpenAI client successfully initialized")
else:
    logger.error("[OpenAI] ❌ OPENAI_API_KEY not found in environment variables")
    logger.debug("[OpenAI] 🔍 Available environment variables:")
    for key in sorted(os.environ.keys()):
        if any(keyword in key.upper() for keyword in ["API", "KEY", "OPENAI"]):
            logger.debug(f"[OpenAI]   - {key}")
    openai_client = None

# ──────────────────────────────────────────────────────────────────────────────
# Prompts and Configuration
# ──────────────────────────────────────────────────────────────────────────────
logger.info("[Config] 📝 Setting up prompts and regex patterns...")


RESEARCH_PROMPT = """
Find 5 current, newsworthy topics strictly related to movies and the film industry that connect to the movie '{topic}', from {current_year} onwards.

IMPORTANT: You MUST find movie/film industry news related to the movie '{topic}'. Consider:
- News about the movie '{topic}' itself (sequels, reboots, anniversaries, streaming releases)
- Actors from the movie '{topic}' (new projects, casting news, interviews, career updates)
- Directors/crew from the movie '{topic}' (new projects, retrospectives, behind-the-scenes reveals)
- Similar movies in the same genre/franchise as '{topic}' (box office comparisons, trend analysis)
- Cultural impact or legacy of the movie '{topic}' (retrospectives, influence on new films)
- Streaming platform news related to the movie '{topic}' (new releases, removals, exclusive content)
- Box office data, reviews, or awards related to the movie '{topic}' or similar films
- Remakes, spiritual successors, or films inspired by the movie '{topic}'

Requirements:
- Every topic MUST have a clear, direct connection to the movie '{topic}' or the broader film industry
- Information must be from {current_year} onwards (or recent developments about older films like '{topic}')
- Each topic should include context and key details for article creation
- Focus on news that movie fans aged 18-35 would find engaging

Return JSON array with exactly 5 topics in this format:
[
  {{
    "title": "Movie-focused title/hook",
    "details": "Key details: what movie/film news happened, which actors/directors/studios are involved, how it connects to '{topic}', why it's significant to movie fans, recent developments (75-120 words)",
    "source": "Source URL from your research"
  }},
  {{
    "title": "Another movie-focused title/hook",
    "details": "More key details about the movie news...",
    "source": "Another source URL"
  }}
]

Make each entry substantial (75-120 words) with enough movie-specific context for content creation.
""".strip()

TOPIC_SELECTOR_SYSTEM = """You are an expert content curator for entertainment news targeting pop-culture fans aged 18-35.

Your task: Analyze the provided movie news topics and select exactly 3 topics that will maximize engagement:
- 2 positive/exciting topics (sequels, casting news, box office success, streaming releases)  
- 1 controversial/odd topic (delays, flops, casting controversies, industry drama)

Consider:
- Click-worthy potential for the target demographic
- Social media shareability  
- Current trending relevance
- Story development potential

Respond with only the numbers of your selected topics (e.g., "1, 3, 5")."""

EDITOR_PROMPT = """
You are an experienced entertainment news editor creating engaging articles for mainstream pop culture fans aged 18–35.

Your task:
1. Create an SEO-optimized, clickbait-worthy title (under 60 characters)
2. Polish the draft into a concise, engaging article with clear structure, relatable analogies, and light humor
3. Focus on storytelling, personality, and the human side of the news
4. Avoid legal jargon and AI ethics debates
5. Return the article in short paragraphs (2–4 sentences each), Add subheadings (##) for clarity.

Output MUST be valid JSON in this exact format:
{
  "title": "Your SEO-Optimized Clickbait Title Here",
  "content": "Your polished article content here..."
}

Make sure the title is:
- Attention-grabbing and click-worthy
- SEO-optimized with relevant keywords
- Under 60 characters for social media
- Engaging for 18-35 year olds
- Reflects the article's main hook
"""

TOPIC_ITEM_RE = re.compile(r'^(?:\d+\.\s*|\-\s*)(?:\*\*|["\']?)(.+?)(?:\*\*|["\']?)$')

logger.debug(f"[Config] ✅ Research prompt length: {len(RESEARCH_PROMPT)} chars")
logger.debug(
    f"[Config] ✅ Topic selector system prompt length: {len(TOPIC_SELECTOR_SYSTEM)} chars"
)
logger.debug(f"[Config] ✅ Regex pattern compiled: {TOPIC_ITEM_RE.pattern}")

SEO_PROMPT = """
You are an expert SEO copywriter specializing in entertainment news for pop-culture fans aged 18–35.
Create:
- An SEO-friendly, click-worthy title under 60 characters that clearly references the movie/topic.
- A meta description under 155 characters that summarizes the article, highlights the hook, and includes the movie/topic plus one related keyword.

The topic refers to the movie or subject that inspired the article.

Use the input below to craft both fields.

Input:
Title: {title}
Topic: {topic}
Content: {content}

Return JSON in this exact shape:
{{
  "seo_title": "...",
  "seo_description": "..."
}}"""

DRAFT_PROMPT = """
You are an entertainment news writer creating engaging article drafts for pop culture fans aged 18-35.

Write a compelling, well-structured draft article based on the provided research and additional web findings:

ORIGINAL MOVIE REFERENCE: {original_topic}

PRIMARY RESEARCH:
Title: {research_title}
Details: {research_details}
Source: {research_url}

ADDITIONAL CONTEXT: Use web search to find complementary information about this topic from different sources (avoid using {avoid_domain}). Look for:
- Additional quotes or statements
- Industry expert opinions
- Fan reactions or social media buzz
- Box office implications or market analysis
- Historical context or comparisons
- Behind-the-scenes information

WRITING GUIDELINES:
- Start with an attention-grabbing hook that connects to '{original_topic}'
- Integrate information from both the primary research and additional findings
- Write in a conversational, engaging tone with personality
- Use short paragraphs (2-4 sentences each) for easy reading
- Include relevant quotes and specific details
- Reference the connection to '{original_topic}' and why this matters to movie fans
- Add subheadings (##) to break up the content
- End with a forward-looking statement or question to engage readers

ARTICLE STRUCTURE:
1. Hook/Opening (connects to '{original_topic}')
2. Main news/development (primary research)
3. Additional context/expert opinions (web findings)
4. Industry impact/fan significance
5. Closing thought/call to action

Keep the draft between 300-500 words. Write as if you're talking to a friend who loves movies.

CRITICAL: You MUST respond ONLY with valid JSON. Do NOT include any text before or after the JSON. Do NOT use markdown code blocks. Do NOT add explanations.

REQUIRED OUTPUT FORMAT - RETURN EXACTLY THIS STRUCTURE:
{{
  "draft": "Your complete article draft here as a single string with \\n for line breaks and ## for subheadings...",
  "sources": ["url1", "url2", "url3"]
}}

The "draft" field must contain the complete article as ONE string. Use \\n for line breaks and ## for subheadings within the string.
The "sources" array must include the primary research URL: {research_url} plus any additional URLs you found during web search.

RESPOND WITH JSON ONLY - NO OTHER TEXT OR FORMATTING.
""".strip()


# ──────────────────────────────────────────────────────────────────────────────
# State Definitions
# ──────────────────────────────────────────────────────────────────────────────
logger.info("[State] 📋 Defining pipeline state structure...")


class PipelineState(TypedDict):
    topic: str
    raw_topics: List[str]
    selected_topics: List[str]
    drafts: List[str]
    finals: List[dict]
    sources: List[str]
    posts: List[dict]
    research_context: List[dict]
    selected_research: List[dict]


logger.info("[State] ✅ PipelineState TypedDict defined successfully")

# ──────────────────────────────────────────────────────────────────────────────
# AGENT NODES
# ──────────────────────────────────────────────────────────────────────────────


def research_node(state: PipelineState) -> PipelineState:
    logger.info("[Research] 🔍 === RESEARCH NODE STARTING ===")

    topic = state["topic"]
    logger.info(f"[Research] 🎯 Topic received: '{topic}' (length: {len(topic)} chars)")

    if not openai_client:
        logger.error("[Research] ❌ OpenAI client not available - cannot proceed")
        return {"raw_topics": [], "research_context": []}

    current_year = datetime.now().year
    logger.info(f"[Research] 📅 Current year determined: {current_year}")

    prompt = RESEARCH_PROMPT.format(topic=topic, current_year=current_year)
    logger.debug(
        f"[Research] 📝 Formatted prompt ({len(prompt)} chars): {prompt[:200]}..."
    )

    try:
        logger.info("[Research] 📡 Making OpenAI API call with web search...")
        logger.debug(
            "[Research] 🔧 API parameters: model=gpt-4o-mini, tools=[web_search_preview]"
        )

        resp = openai_client.responses.create(
            model="gpt-4o-mini", input=prompt, tools=[{"type": "web_search_preview"}]
        )

        logger.info("[Research] ✅ OpenAI API call completed successfully")
        raw_text = resp.output_text
        logger.info(f"[Research] 📄 Raw response received ({len(raw_text)} chars)")
        logger.debug(f"[Research] 📄 Response preview: {raw_text[:300]}...")

        def extract_json_from_response(text):
            """Extract JSON from response, handling various formats"""
            text = text.strip()

            # Method 1: Remove markdown code blocks completely
            if text.startswith("```"):
                # Find the actual JSON content between code fences
                lines = text.split("\n")
                start_idx = 0
                end_idx = len(lines)

                # Find start of JSON (skip ```json or just ```
                for i, line in enumerate(lines):
                    if line.strip().startswith("```"):
                        start_idx = i + 1
                        break

                # Find end of JSON (look for closing ```
                for i in range(len(lines) - 1, -1, -1):
                    if lines[i].strip() == "```":
                        end_idx = i
                        break

                # Extract JSON content
                json_lines = lines[start_idx:end_idx]
                text = "\n".join(json_lines).strip()
                logger.debug(
                    f"[Research] 🔧 Extracted JSON from markdown: {len(text)} chars"
                )

            # Method 2: Find JSON array boundaries
            first_bracket = text.find("[")
            last_bracket = text.rfind("]")

            if (
                first_bracket != -1
                and last_bracket != -1
                and first_bracket < last_bracket
            ):
                text = text[first_bracket : last_bracket + 1]
                logger.debug(f"[Research] 🔧 Extracted JSON array: {len(text)} chars")

            # Method 3: Clean up any remaining artifacts
            text = re.sub(r"```[a-z]*\n?", "", text)  # Remove any remaining code fences
            text = re.sub(r"\n```$", "", text)  # Remove trailing code fence
            text = text.strip()

            return text

        try:
            # Use robust JSON extraction
            cleaned_text = extract_json_from_response(raw_text)
            logger.debug(
                f"[Research] 🧹 Cleaned text ({len(cleaned_text)} chars): {cleaned_text[:200]}..."
            )

            # Parse JSON response
            research_data = json.loads(cleaned_text)
            logger.info(f"[Research] ✅ Parsed JSON with {len(research_data)} entries")

            research_context = []
            raw_topics = []

            for i, entry in enumerate(research_data[:5], 1):
                title = entry.get("title", f"Untitled {i}")
                details = entry.get("details", "")
                source = entry.get("source", "")

                # Clean up the source URL (extract from markdown if needed)
                url_match = re.search(r"https?://[^\s)]+", source)
                url = url_match.group(0) if url_match else source

                research_context.append(
                    {"title": title, "details": details, "url": url}
                )
                raw_topics.append(f"{title} - {details}")

                logger.info(f"[Research]   Parsed Topic {i}: '{title}'")
                logger.debug(f"[Research]   Details {i}: {details[:100]}...")
                logger.debug(f"[Research]   URL {i}: {url}")

            logger.info(
                f"[Research] ✅ Successfully parsed {len(research_context)} topics"
            )
            return {"raw_topics": raw_topics, "research_context": research_context}

        except json.JSONDecodeError as json_error:
            logger.error(f"[Research] 💥 JSON parse error: {json_error}")
            logger.debug(f"[Research] 💥 Cleaned text was: {cleaned_text[:500]}...")

            # Enhanced fallback parsing for numbered lists
            logger.warning("[Research] 🔄 Falling back to enhanced text parsing...")

            # Split by numbered entries and parse each one
            entries = re.split(r"\n(?=\d+\.)", raw_text.strip())
            entries = [
                entry.strip()
                for entry in entries
                if entry.strip() and re.match(r"^\d+\.", entry)
            ]

            research_context = []
            raw_topics = []

            for i, entry in enumerate(entries[:5], 1):
                # Extract title from quotes or first line
                title_match = re.search(r'"([^"]+)"', entry) or re.search(
                    r"\*\*([^*]+)\*\*", entry
                )
                if title_match:
                    title = title_match.group(1).strip()
                else:
                    # Fallback: use first 50 chars after number
                    first_line = entry.split("\n")[0]
                    title = re.sub(r"^\d+\.\s*", "", first_line)[:50] + "..."

                # Extract URL
                url_match = re.search(r"https?://[^\s)]+", entry)
                url = url_match.group(0) if url_match else ""

                # Extract details (everything except title and URL)
                details = entry
                if title_match:
                    details = details.replace(title_match.group(0), "")
                if url_match:
                    details = details.replace(url_match.group(0), "")

                # Clean up details
                details = re.sub(r"^\d+\.\s*", "", details)  # Remove number
                details = re.sub(
                    r"\([^)]*\)$", "", details
                )  # Remove trailing citations
                details = details.strip(" -.,")

                research_context.append(
                    {"title": title, "details": details, "url": url}
                )
                raw_topics.append(f"{title} - {details}")

                logger.info(f"[Research]   Fallback Topic {i}: '{title}'")

            return {"raw_topics": raw_topics, "research_context": research_context}

    except Exception as e:
        logger.error(f"[Research] 💥 Error during research: {e}")
        logger.error(f"[Research] 💥 Error type: {type(e).__name__}")
        import traceback

        logger.error(f"[Research] 💥 Full traceback: {traceback.format_exc()}")
        logger.error("[Research] 🏁 === RESEARCH NODE FAILED ===")
        return {"raw_topics": [], "research_context": []}


def select_topics_node(state: PipelineState) -> PipelineState:
    logger.info("[TopicSelector] 🎯 === TOPIC SELECTOR NODE STARTING ===")

    research_context = state.get("research_context", [])
    raws = state.get("raw_topics", [])

    logger.info(
        f"[TopicSelector] 📥 Received {len(research_context)} research context items"
    )
    logger.info(f"[TopicSelector] 📥 Received {len(raws)} raw topics (fallback)")

    # Primary check: research_context must be available
    if not research_context:
        logger.warning(
            "[TopicSelector] ⚠️ No research context available - cannot proceed"
        )
        logger.warning(
            "[TopicSelector] 🏁 === TOPIC SELECTOR NODE COMPLETED (EMPTY) ==="
        )
        return {"selected_topics": [], "selected_research": []}

    if not openai_client:
        logger.error("[TopicSelector] ❌ OpenAI client not available")
        logger.error("[TopicSelector] 🏁 === TOPIC SELECTOR NODE FAILED ===")
        return {"selected_topics": [], "selected_research": []}

    # Build selection prompt using research_context (richer data)
    prompt = "Analyze these movie news topics and select the 3 most engaging ones:\n\n"

    for i, ctx in enumerate(research_context, 1):
        title = ctx["title"]
        details = (
            ctx["details"][:120] + "..."
            if len(ctx["details"]) > 120
            else ctx["details"]
        )
        prompt += f"{i}. {title}\n   Details: {details}\n\n"

    prompt += "Select exactly 3 topics (2 positive + 1 controversial) that will generate the most clicks and engagement."

    try:
        logger.debug("[TopicSelector] 📡 Making API call for topic selection...")

        resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": TOPIC_SELECTOR_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )

        response_content = resp.choices[0].message.content
        logger.info(f"[TopicSelector] 📄 Selection response: {response_content}")

        # Parse selected topic numbers
        selected_indices = []

        # Look for comma-separated numbers or individual numbers
        numbers = re.findall(r"\b([1-5])\b", response_content)
        for num_str in numbers:
            idx = int(num_str) - 1  # Convert to 0-based index
            if 0 <= idx < len(research_context) and idx not in selected_indices:
                selected_indices.append(idx)
                if len(selected_indices) >= 3:  # Stop after finding 3
                    break

        # Fallback: select first 3 if parsing failed
        if len(selected_indices) < 3:
            selected_indices = [0, 1, 2][: len(research_context)]
            logger.warning("[TopicSelector] ⚠️ Using fallback selection: first 3 topics")

        # Extract selected research context and build topics
        selected_research = [research_context[i] for i in selected_indices[:3]]
        selected_topics = [
            ctx["title"] + " - " + ctx["details"] for ctx in selected_research
        ]

        logger.info(
            f"[TopicSelector] ✅ Selected {len(selected_research)} topics with full context"
        )
        for i, ctx in enumerate(selected_research, 1):
            logger.info(f"[TopicSelector]   Selected {i}: '{ctx['title']}'")
            logger.debug(f"[TopicSelector]     Details {i}: {ctx['details'][:80]}...")
            logger.debug(f"[TopicSelector]     URL {i}: {ctx['url']}")

        logger.info("[TopicSelector] 🏁 === TOPIC SELECTOR NODE COMPLETED ===")

        return {
            "selected_topics": selected_topics,
            "selected_research": selected_research,
        }

    except Exception as e:
        logger.error(f"[TopicSelector] 💥 Error selecting topics: {e}")
        logger.error(f"[TopicSelector] 💥 Error type: {type(e).__name__}")
        logger.error("[TopicSelector] 🏁 === TOPIC SELECTOR NODE FAILED ===")
        return {"selected_topics": [], "selected_research": []}


# Update the draft_node function
def draft_node(state: PipelineState) -> PipelineState:
    logger.info("[Draft] ✍️ === DRAFT NODE STARTING ===")

    selected_topics = state.get("selected_topics", [])
    selected_research = state.get(
        "selected_research", []
    )  # This comes from select_topics_node
    original_topic = state.get("topic", "")  # Get the original movie topic

    logger.info(f"[Draft] 📥 Received {len(selected_topics)} selected topics to draft")
    logger.info(f"[Draft] 📥 Received {len(selected_research)} research context items")
    logger.info(f"[Draft] 🎬 Original topic: '{original_topic}'")

    if not selected_topics:
        logger.warning("[Draft] ⚠️ No selected topics available for drafting")
        logger.warning("[Draft] 🏁 === DRAFT NODE COMPLETED (EMPTY) ===")
        return {"drafts": [], "sources": []}

    if not openai_client:
        logger.error("[Draft] ❌ OpenAI client not available")
        logger.error("[Draft] 🏁 === DRAFT NODE FAILED ===")
        return {"drafts": [], "sources": []}

    drafts, sources = [], []

    for i, topic in enumerate(selected_topics, 1):
        logger.info(
            f"[Draft] ✍️ {i}/{len(selected_topics)} Drafting content for: '{topic[:60]}...'"
        )

        try:
            # Get corresponding research context from selected_research
            research_context = (
                selected_research[i - 1] if i <= len(selected_research) else {}
            )
            research_title = research_context.get("title", "No title available")
            research_details = research_context.get("details", "No details available")
            research_url = research_context.get("url", "")

            # Extract domain from research URL to avoid duplicates
            avoid_domain = ""
            if research_url:
                import urllib.parse

                parsed_url = urllib.parse.urlparse(research_url)
                avoid_domain = parsed_url.netloc
                logger.debug(f"[Draft] 🚫 Will avoid domain: {avoid_domain}")

            logger.debug(f"[Draft] 📋 Research context for draft {i}:")
            logger.debug(f"[Draft]   Title: {research_title}")
            logger.debug(f"[Draft]   Details: {research_details[:100]}...")
            logger.debug(f"[Draft]   URL: {research_url}")

            # Create enhanced prompt with structured JSON output request
            detailed_prompt = DRAFT_PROMPT.format(
                original_topic=original_topic,
                research_title=research_title,
                research_details=research_details,
                research_url=research_url,
                avoid_domain=avoid_domain,
            )

            logger.debug(
                f"[Draft] 📝 Using enhanced JSON prompt ({len(detailed_prompt)} chars)"
            )
            logger.debug(f"[Draft] 📡 Making API call with web search for topic {i}...")

            # Make API call with web search enabled for additional context
            resp = openai_client.responses.create(
                model="gpt-4o-mini",
                input=detailed_prompt,
                tools=[{"type": "web_search_preview"}],
            )

            response_text = resp.output_text.strip()
            logger.info(
                f"[Draft] ✅ Draft response {i} received ({len(response_text)} chars)"
            )
            logger.debug(
                f"[Draft] 📄 Raw response {i} preview: {response_text[:200]}..."
            )

            try:
                # Parse the structured JSON response
                def extract_json_from_draft_response(text):
                    """Extract JSON from draft response, handling various formats"""
                    text = text.strip()

                    # Remove markdown code blocks if present
                    if text.startswith("```"):
                        lines = text.split("\n")
                        start_idx = 0
                        end_idx = len(lines)

                        # Find start of JSON (skip ```json or just ```)
                        for i, line in enumerate(lines):
                            if line.strip().startswith("```"):
                                start_idx = i + 1
                                break

                        # Find end of JSON (look for closing ```)
                        for i in range(len(lines) - 1, -1, -1):
                            if lines[i].strip() == "```":
                                end_idx = i
                                break

                        # Extract JSON content
                        json_lines = lines[start_idx:end_idx]
                        text = "\n".join(json_lines).strip()
                        logger.debug(
                            f"[Draft] 🔧 Extracted JSON from markdown: {len(text)} chars"
                        )

                    # Find JSON object boundaries
                    first_brace = text.find("{")
                    last_brace = text.rfind("}")

                    if (
                        first_brace != -1
                        and last_brace != -1
                        and first_brace < last_brace
                    ):
                        text = text[first_brace : last_brace + 1]
                        logger.debug(
                            f"[Draft] 🔧 Extracted JSON object: {len(text)} chars"
                        )

                    return text

                # Extract and parse JSON
                cleaned_response = extract_json_from_draft_response(response_text)
                logger.debug(
                    f"[Draft] 🧹 Cleaned JSON response ({len(cleaned_response)} chars)"
                )

                draft_data = json.loads(cleaned_response)

                # Validate required fields
                if "draft" in draft_data and "sources" in draft_data:
                    draft_content = draft_data["draft"].strip()
                    draft_sources = draft_data.get("sources", [])

                    # Ensure sources is a list
                    if isinstance(draft_sources, str):
                        draft_sources = [draft_sources]
                    elif not isinstance(draft_sources, list):
                        draft_sources = []

                    # Add research URL if not already included
                    if research_url and research_url not in draft_sources:
                        draft_sources.insert(0, research_url)

                    # Add any additional sources from API response annotations
                    api_urls = []
                    try:
                        for item in getattr(resp, "output_items", []):
                            if item.get("type") == "message":
                                for ann in item.get("annotations", []):
                                    if ann.get("type") == "url_citation":
                                        url = ann.get("url", "")
                                        if url and url not in draft_sources:
                                            # Check if this URL is from a different domain
                                            try:
                                                parsed_new_url = urllib.parse.urlparse(
                                                    url
                                                )
                                                new_domain = parsed_new_url.netloc

                                                if new_domain != avoid_domain:
                                                    api_urls.append(url)
                                                    logger.debug(
                                                        f"[Draft]   Additional API source: {url}"
                                                    )
                                                else:
                                                    logger.debug(
                                                        f"[Draft]   Skipped duplicate domain: {url}"
                                                    )
                                            except Exception:
                                                api_urls.append(url)
                    except Exception as e:
                        logger.debug(f"[Draft] ⚠️ Error extracting API URLs: {e}")

                    # Combine all sources and remove duplicates
                    all_sources = draft_sources + api_urls
                    unique_sources = list(dict.fromkeys(all_sources))  # Preserves order

                    drafts.append(draft_content)
                    sources.append(unique_sources)

                    logger.info(f"[Draft] ✅ Draft {i} parsed successfully")
                    logger.debug(
                        f"[Draft] 📄 Draft {i} content: {len(draft_content)} chars"
                    )
                    logger.info(
                        f"[Draft] 🔗 Draft {i} sources: {len(unique_sources)} URLs"
                    )

                    # Log sources with their types
                    for j, url in enumerate(unique_sources, 1):
                        if url == research_url:
                            source_type = "Primary Research"
                        elif url in draft_data.get("sources", []):
                            source_type = "Draft Referenced"
                        else:
                            source_type = "API Additional"
                        logger.debug(f"[Draft]   Source {j} ({source_type}): {url}")

                else:
                    logger.warning(
                        f"[Draft] ⚠️ Invalid JSON structure for draft {i}, missing 'draft' or 'sources'"
                    )
                    # Fallback: treat entire response as draft
                    drafts.append(response_text)
                    sources.append([research_url] if research_url else [])

            except json.JSONDecodeError as json_error:
                logger.error(f"[Draft] 💥 JSON parse error for draft {i}: {json_error}")
                logger.debug(
                    f"[Draft] 💥 Unparseable response: {cleaned_response[:300]}..."
                )

                # Fallback: treat entire response as draft and use research URL
                drafts.append(response_text)
                sources.append([research_url] if research_url else [])
                logger.warning(f"[Draft] 🔄 Using fallback parsing for draft {i}")

        except Exception as e:
            logger.error(f"[Draft] 💥 Error drafting topic {i}: {e}")
            logger.error(f"[Draft] 💥 Error type: {type(e).__name__}")
            import traceback

            logger.debug(f"[Draft] 💥 Traceback: {traceback.format_exc()}")

            # Ultimate fallback: add empty draft and research URL
            drafts.append(f"Error generating draft for topic: {topic}")
            if i <= len(selected_research):
                research_url = selected_research[i - 1].get("url", "")
                sources.append([research_url] if research_url else [])
            else:
                sources.append([])

    logger.info(
        f"[Draft] ✅ Draft creation completed: {len(drafts)} drafts, {len(sources)} source lists"
    )
    logger.info(f"[Draft] 📊 Total sources collected: {sum(len(s) for s in sources)}")

    # Log source diversity statistics
    total_research_sources = 0
    total_api_sources = 0

    for i, source_list in enumerate(sources, 1):
        research_count = (
            1
            if len(source_list) > 0
            and selected_research
            and i <= len(selected_research)
            and selected_research[i - 1].get("url") in source_list
            else 0
        )
        api_count = len(source_list) - research_count

        total_research_sources += research_count
        total_api_sources += api_count

        logger.debug(
            f"[Draft] Draft {i}: {research_count} research + {api_count} additional sources"
        )

    logger.info(
        f"[Draft] 📊 Source diversity: {total_research_sources} research + {total_api_sources} additional sources"
    )
    logger.info("[Draft] 🏁 === DRAFT NODE COMPLETED ===")

    return {"drafts": drafts, "sources": sources}


def edit_node(state: PipelineState) -> PipelineState:
    logger.info("[Editor] ✨ === EDITOR NODE STARTING ===")

    drafts = state.get("drafts", [])
    logger.info(f"[Editor] 📥 Received {len(drafts)} drafts to edit")

    if not drafts:
        logger.warning("[Editor] ⚠️ No drafts available for editing")
        logger.warning("[Editor] 🏁 === EDITOR NODE COMPLETED (EMPTY) ===")
        return {"finals": []}

    if not openai_client:
        logger.error("[Editor] ❌ OpenAI client not available")
        logger.error("[Editor] 🏁 === EDITOR NODE FAILED ===")
        return {"finals": []}

    finals = []

    for i, draft in enumerate(drafts, 1):
        logger.info(f"[Editor] ✨ {i}/{len(drafts)} Editing draft ({len(draft)} chars)")
        logger.debug(f"[Editor] 📄 Draft {i} preview: {draft[:150]}...")

        try:
            logger.debug(f"[Editor] 📡 Making API call to edit draft {i}...")

            resp = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": EDITOR_PROMPT},
                    {
                        "role": "user",
                        "content": f"Polish this draft and create an engaging title:\n\n{draft}",
                    },
                ],
                temperature=0.3,
            )

            response_content = resp.choices[0].message.content.strip()
            logger.info(
                f"[Editor] ✅ Draft {i} edited successfully ({len(response_content)} chars)"
            )
            logger.debug(f"[Editor] 📄 Raw response {i}: {response_content[:200]}...")

            try:
                # Parse JSON response
                parsed_result = json.loads(response_content)

                # Validate required fields
                if "title" in parsed_result and "content" in parsed_result:
                    final_article = {
                        "title": parsed_result["title"].strip(),
                        "content": parsed_result["content"].strip(),
                    }

                    logger.info(f"[Editor] 📰 Title {i}: '{final_article['title']}'")
                    logger.debug(
                        f"[Editor] 📄 Content {i} preview: {final_article['content'][:150]}..."
                    )

                    finals.append(final_article)

                else:
                    logger.warning(
                        f"[Editor] ⚠️ Invalid JSON structure for draft {i}, missing title or content"
                    )
                    # Fallback: create structure from raw response
                    fallback_article = {
                        "title": f"Breaking News: Article {i}",
                        "content": response_content,
                    }
                    finals.append(fallback_article)

            except json.JSONDecodeError as json_error:
                logger.error(
                    f"[Editor] 💥 JSON parse error for draft {i}: {json_error}"
                )
                logger.debug(f"[Editor] 💥 Unparseable response: {response_content}")

                # Fallback: try to extract title and content manually
                lines = response_content.split("\n")
                title = f"Breaking: {lines[0][:50]}..." if lines else f"Article {i}"
                content = response_content

                fallback_article = {"title": title, "content": content}
                finals.append(fallback_article)
                logger.warning(f"[Editor] 🔄 Using fallback structure for draft {i}")

        except Exception as e:
            logger.error(f"[Editor] 💥 Error editing draft {i}: {e}")
            logger.error(f"[Editor] 💥 Error type: {type(e).__name__}")

            # Ultimate fallback: use original draft with generated title
            fallback_article = {
                "title": f"Breaking News: Article {i}",
                "content": draft,
            }
            finals.append(fallback_article)
            logger.warning(f"[Editor] 🔄 Using original draft {i} as ultimate fallback")

    logger.info(f"[Editor] ✅ Editing completed: {len(finals)} final articles created")
    for i, final in enumerate(finals, 1):
        logger.info(
            f"[Editor]   Final {i}: '{final['title']}' ({len(final['content'])} chars)"
        )

    logger.info("[Editor] 🏁 === EDITOR NODE COMPLETED ===")

    return {"finals": finals}


def post_node(state: PipelineState) -> PipelineState:
    logger.info("[Post] 📦 === POST NODE STARTING ===")

    # Get all arrays safely
    selected_topics = state.get("selected_topics", [])
    drafts = state.get("drafts", [])
    finals = state.get("finals", [])
    sources = state.get("sources", [])

    logger.info("[Post] 📊 Input array lengths:")
    logger.info(f"[Post]   - Topics: {len(selected_topics)}")
    logger.info(f"[Post]   - Drafts: {len(drafts)}")
    logger.info(f"[Post]   - Finals: {len(finals)}")
    logger.info(f"[Post]   - Sources: {len(sources)}")

    posts = []

    # Use the minimum length to avoid index errors
    max_items = (
        min(len(selected_topics), len(drafts), len(finals), len(sources))
        if all([selected_topics, drafts, finals, sources])
        else 0
    )

    logger.info(f"[Post] 🧮 Maximum processable items: {max_items}")

    if max_items == 0:
        logger.warning("[Post] ⚠️ Cannot create posts - one or more arrays are empty")
        logger.warning("[Post] 🏁 === POST NODE COMPLETED (EMPTY) ===")
        return {"posts": []}

    logger.info(f"[Post] 📦 Creating {max_items} posts...")

    for i in range(max_items):
        logger.debug(f"[Post] 🔄 Processing item {i+1}/{max_items}")

        try:
            # Extract final article data
            final_article = (
                finals[i] if i < len(finals) else {"title": "Untitled", "content": ""}
            )

            post = {
                "topic": selected_topics[i],
                "title": final_article.get(
                    "title", f"Article {i+1}"
                ),  # NEW: SEO-optimized title
                "draft": drafts[i],
                "final": final_article.get(
                    "content", ""
                ),  # Extract content from finals
                "sources": sources[i] if i < len(sources) else [],
            }
            posts.append(post)

            logger.info(f"[Post] ✅ Post {i+1} created:")
            logger.info(f"[Post]   📰 Title: '{post['title']}'")
            logger.info(f"[Post]   🎯 Topic: '{selected_topics[i][:50]}...'")
            logger.debug(f"[Post]   📄 Draft length: {len(drafts[i])} chars")
            logger.debug(f"[Post]   📄 Final length: {len(post['final'])} chars")
            logger.debug(f"[Post]   🔗 Sources count: {len(post['sources'])}")

        except IndexError as e:
            logger.error(f"[Post] 💥 Index error at position {i}: {e}")
            logger.error(
                f"[Post] 💥 Available indices - topics:{len(selected_topics)-1}, drafts:{len(drafts)-1}, finals:{len(finals)-1}, sources:{len(sources)-1}"
            )
            break
        except Exception as e:
            logger.error(f"[Post] 💥 Unexpected error processing item {i}: {e}")
            break

    logger.info(f"[Post] ✅ Post creation completed: {len(posts)} posts created")
    logger.info("[Post] 🏁 === POST NODE COMPLETED ===")

    return {"posts": posts}


def seo_generator_node(state: PipelineState) -> PipelineState:
    logger.info("[SEO] 🚀 === SEO GENERATOR NODE STARTING ===")

    posts = state.get("posts", [])
    logger.info(f"[SEO] 📥 Received {len(posts)} posts for SEO enhancement")

    if not posts:
        logger.warning("[SEO] ⚠️ No posts available for SEO enhancement")
        logger.warning("[SEO] 🏁 === SEO GENERATOR NODE COMPLETED (EMPTY) ===")
        return {"posts": []}

    if not openai_client:
        logger.error("[SEO] ❌ OpenAI client not available")
        logger.error("[SEO] 🏁 === SEO GENERATOR NODE FAILED ===")
        return {"posts": posts}

    updated_posts = []

    for i, post in enumerate(posts, 1):
        title = post.get("title", "")
        topic = post.get("topic", "")
        content = post.get("final", "")

        logger.info(
            f"[SEO] 🔍 {i}/{len(posts)} Generating SEO for post titled: '{title[:50]}...'"
        )
        logger.debug(f"[SEO] 📄 Post {i} topic: {topic[:80]}...")
        logger.debug(f"[SEO] 📄 Post {i} content length: {len(content)} chars")

        try:
            logger.debug(f"[SEO] 📡 Making API call for SEO generation {i}...")

            prompt = SEO_PROMPT.format(title=title, topic=topic, content=content)
            logger.debug(
                f"[SEO] 📝 SEO prompt ({len(prompt)} chars): {prompt[:200]}..."
            )

            resp = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert SEO copywriter."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
            )

            response_content = resp.choices[0].message.content.strip()
            logger.info(
                f"[SEO] ✅ SEO {i} generated successfully ({len(response_content)} chars)"
            )
            logger.debug(f"[SEO] 📄 Raw response {i}: {response_content[:200]}...")

            try:
                # Remove markdown code blocks if present
                if response_content.startswith("```"):
                    lines = response_content.split("\n")
                    response_content = (
                        "\n".join(lines[1:-1]) if len(lines) > 2 else response_content
                    )
                    response_content = response_content.strip()
                    logger.debug(f"[SEO] 🔧 Removed markdown code blocks for post {i}")

                # Parse JSON response
                seo_data = json.loads(response_content)

                # Validate required fields
                if "seo_title" in seo_data and "seo_description" in seo_data:
                    updated_post = {**post, **seo_data}

                    logger.info(f"[SEO] 🏷️ SEO Title {i}: '{seo_data['seo_title']}'")
                    logger.debug(
                        f"[SEO] 📝 SEO Description {i}: {seo_data['seo_description'][:100]}..."
                    )

                    updated_posts.append(updated_post)

                else:
                    logger.warning(
                        f"[SEO] ⚠️ Invalid JSON structure for post {i}, missing seo_title or seo_description"
                    )
                    # Fallback: use original post without SEO enhancement
                    updated_posts.append(post)

            except json.JSONDecodeError as json_error:
                logger.error(f"[SEO] 💥 JSON parse error for post {i}: {json_error}")
                logger.debug(f"[SEO] 💥 Unparseable response: {response_content}")

                # Fallback: use original post without SEO enhancement
                updated_posts.append(post)
                logger.warning(
                    f"[SEO] 🔄 Using original post {i} without SEO enhancement"
                )

        except Exception as e:
            logger.error(f"[SEO] 💥 Error generating SEO for post {i}: {e}")
            logger.error(f"[SEO] 💥 Error type: {type(e).__name__}")

            # Ultimate fallback: use original post
            updated_posts.append(post)
            logger.warning(f"[SEO] 🔄 Using original post {i} as ultimate fallback")

    logger.info(
        f"[SEO] ✅ SEO generation completed: {len(updated_posts)} posts processed"
    )
    for i, post in enumerate(updated_posts, 1):
        has_seo = "seo_title" in post and "seo_description" in post
        status = "✅ Enhanced" if has_seo else "⚠️ Original"
        logger.info(
            f"[SEO]   Post {i}: {status} - '{post.get('title', 'Unknown')[:40]}...'"
        )

    logger.info("[SEO] 🏁 === SEO GENERATOR NODE COMPLETED ===")

    return {"posts": updated_posts}


# ──────────────────────────────────────────────────────────────────────────────
# Build LangGraph
# ──────────────────────────────────────────────────────────────────────────────
logger.info("[Graph] 🏗️ Building LangGraph pipeline...")

graph = StateGraph(PipelineState)

logger.info("[Graph] ➕ Adding nodes to graph...")
graph.add_node("research", research_node)
logger.debug("[Graph]   ✅ Added 'research' node")

graph.add_node("select_topics", select_topics_node)
logger.debug("[Graph]   ✅ Added 'select_topics' node")

graph.add_node("draft", draft_node)
logger.debug("[Graph]   ✅ Added 'draft' node")

graph.add_node("edit", edit_node)
logger.debug("[Graph]   ✅ Added 'edit' node")

graph.add_node("post", post_node)
logger.debug("[Graph]   ✅ Added 'post' node")

graph.add_node("seo_generator", seo_generator_node)
logger.debug("[Graph]   ✅ Added 'seo_generator' node")

logger.info("[Graph] 🔗 Adding edges to graph...")
graph.add_edge("research", "select_topics")
logger.debug("[Graph]   ✅ Added edge: research → select_topics")

graph.add_edge("select_topics", "draft")
logger.debug("[Graph]   ✅ Added edge: select_topics → draft")

graph.add_edge("draft", "edit")
logger.debug("[Graph]   ✅ Added edge: draft → edit")

graph.add_edge("edit", "post")
logger.debug("[Graph]   ✅ Added edge: edit → post")

graph.add_edge("post", "seo_generator")
logger.debug("[Graph]   ✅ Added edge: post → seo_generator")

graph.add_edge("seo_generator", END)
logger.debug("[Graph]   ✅ Added edge: seo_generator → END")

logger.info("[Graph] 🚀 Setting entry point to 'research'...")
graph.set_entry_point("research")

logger.info("[Graph] ⚙️ Compiling graph...")
compiled_graph = graph.compile()
logger.info("[Graph] ✅ Graph compilation completed successfully!")

# ──────────────────────────────────────────────────────────────────────────────
# HTTP Handler
# ──────────────────────────────────────────────────────────────────────────────
logger.info("[Handler] 🌐 Setting up HTTP request handler...")


class handler(BaseHTTPRequestHandler):
    def _cors(self):
        logger.debug("[Handler] 🔧 Setting CORS headers")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        logger.info("[Handler] 🔧 Handling OPTIONS preflight request")
        self.send_response(200)
        self._cors()
        self.end_headers()
        logger.info("[Handler] ✅ OPTIONS response sent")

    def do_POST(self):
        logger.info("[Handler] 📨 === POST REQUEST STARTING ===")
        start_time = time.time()  # Placeholder for timing

        logger.info("[Handler] ⏳ Request timing started")
        logger.debug(f"[Handler] 🕒 Start time: {start_time}")

        my_daily_api_key = self.headers.get("X-API-KEY", "")

        MY_DAILY_API_KEY = os.getenv("MY_DAILY_API_KEY", "")

        if not my_daily_api_key:
            logger.error("[Handler] ❌ API key not configured")
            self._send_error("API key not configured", status_code=500)
            logger.error("[Handler] 🏁 === POST REQUEST FAILED (NO API KEY) ===")
            return

        if my_daily_api_key != MY_DAILY_API_KEY:
            logger.error("[Handler] ❌ Invalid API key provided")
            self._send_error("Invalid API key", status_code=403)
            logger.error("[Handler] 🏁 === POST REQUEST FAILED (INVALID API KEY) ===")
            return

        try:
            # Read request body
            content_length = int(self.headers.get("Content-Length", 0))
            logger.info(f"[Handler] 📥 Reading request body ({content_length} bytes)")

            body_data = self.rfile.read(content_length)
            logger.debug(f"[Handler] 📄 Raw body data: {body_data[:200]}...")

            body = json.loads(body_data.decode("utf-8"))
            logger.info(f"[Handler] 📋 Parsed JSON body: {body}")

            topic = body.get("topic", "").strip()
            logger.info(
                f"[Handler] 🎯 Extracted topic: '{topic}' (length: {len(topic)})"
            )

            # Validation
            if not topic:
                logger.warning("[Handler] ⚠️ No topic provided in request")
                self._send_error("No topic provided")
                return

            if len(topic) > 200:
                logger.warning(f"[Handler] ⚠️ Topic too long: {len(topic)} characters")
                self._send_error("Topic too long, must be under 200 characters")
                return

            # Execute pipeline
            logger.info(
                f"[Handler] 🚀 Starting pipeline execution for topic: '{topic}'"
            )
            logger.info("[Handler] ⏰ Pipeline execution beginning...")

            result = compiled_graph.invoke({"topic": topic})

            logger.info("[Handler] ✅ Pipeline execution completed successfully")
            logger.info(f"[Handler] 📊 Pipeline result keys: {list(result.keys())}")

            # Extract results
            posts = result.get("posts", [])
            logger.info(f"[Handler] 📋 Generated {len(posts)} posts")

            if posts:
                for i, post in enumerate(posts, 1):
                    topic_preview = post.get("topic", "Unknown")[:40]
                    sources_count = len(post.get("sources", []))
                    logger.debug(
                        f"[Handler]   Post {i}: '{topic_preview}...' ({sources_count} sources)"
                    )

            # Send successful response
            response_data = {
                "status": "success",
                "message": "Research completed successfully",
                "posts": posts,
                "topic_count": len(posts),
                "original_topic": topic,
            }

            logger.info("[Handler] 📤 Sending success response...")
            self._send_success(response_data)
            logger.info("[Handler] 🏁 === POST REQUEST COMPLETED SUCCESSFULLY ===")
            end_time = time.time()
            logger.info(
                f"[Handler] ⏱️ Total request time: {end_time - start_time:.2f} seconds"
            )

        except json.JSONDecodeError as e:
            logger.error(f"[Handler] 💥 JSON decode error: {e}")
            logger.error(f"[Handler] 💥 Raw body was: {body_data}")
            self._send_error("Invalid JSON in request body")
            logger.error("[Handler] 🏁 === POST REQUEST FAILED (JSON ERROR) ===")

        except Exception as e:
            logger.error(f"[Handler] 💥 Pipeline execution error: {e}")
            logger.error(f"[Handler] 💥 Error type: {type(e).__name__}")
            import traceback

            logger.error(f"[Handler] 💥 Full traceback: {traceback.format_exc()}")
            self._send_error(f"Pipeline error: {str(e)}")
            logger.error("[Handler] 🏁 === POST REQUEST FAILED (PIPELINE ERROR) ===")

    def do_GET(self):
        logger.info("[Handler] 🚫 GET request received (not supported)")
        self._send_error(
            "GET method not allowed, use POST with JSON body", status_code=405
        )
        logger.info("[Handler] ❌ GET request rejected")

    def _send_success(self, data):
        """Send a successful JSON response"""
        logger.debug("[Handler] ✅ Preparing success response...")

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()

        response_json = json.dumps(data, indent=2)
        logger.info(
            f"[Handler] 📤 Sending success response ({len(response_json)} chars)"
        )
        logger.debug(f"[Handler] 📄 Response preview: {response_json[:300]}...")

        self.wfile.write(response_json.encode("utf-8"))
        logger.info("[Handler] ✅ Success response sent successfully")

    def _send_error(self, message, status_code=400):
        """Send an error JSON response"""
        logger.debug(f"[Handler] ❌ Preparing error response: {message}")

        self.send_response(status_code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()

        error_data = {
            "status": "error",
            "message": message,
            "timestamp": str(logger.name),  # Placeholder for timestamp
        }

        response_json = json.dumps(error_data, indent=2)
        logger.error(f"[Handler] 📤 Sending error response ({status_code}): {message}")

        self.wfile.write(response_json.encode("utf-8"))
        logger.error(f"[Handler] ❌ Error response sent: {message}")


# ──────────────────────────────────────────────────────────────────────────────
# Local Development Server
# ──────────────────────────────────────────────────────────────────────────────
# if __name__ == "__main__":
#     logger.info("[LocalServer] 🏠 Starting local development server...")
#     from http.server import HTTPServer

#     try:
#         httpd = HTTPServer(("localhost", 3001), handler)
#         logger.info("[LocalServer] 🚀 HTTP server initialized on localhost:3001")
#         logger.info("[LocalServer] 📋 Server ready to accept requests")
#         print("🚀 Running locally at http://localhost:3001")
#         print("📋 Send POST requests with JSON: {'topic': 'your topic here'}")
#         print("🔍 Check logs for detailed execution information")

#         logger.info("[LocalServer] 🔄 Starting server loop...")
#         httpd.serve_forever()

#     except KeyboardInterrupt:
#         logger.info("[LocalServer] 🛑 Server stopped by user (Ctrl+C)")
#         print("\n👋 Server stopped gracefully")

#     except Exception as e:
#         logger.error(f"[LocalServer] 💥 Server startup error: {e}")
#         logger.error(f"[LocalServer] 💥 Error type: {type(e).__name__}")
#         import traceback

#         logger.error(f"[LocalServer] 💥 Traceback: {traceback.format_exc()}")
#         print(f"❌ Server failed to start: {e}")

# logger.info("[System] ✅ Research Agent module loaded successfully")
