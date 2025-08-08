import os 
import json 
import logging
from typing import List, TypedDict
import re
from http.server import BaseHTTPRequestHandler
from typing import TypedDict, List

from langgraph.graph import StateGraph, END
from openai import OpenAI

# ──────────────────────────────────────────────────────────────────────────────
# Enhanced Logging Configuration
# ──────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG,  # Changed to DEBUG for maximum verbosity
    format="%(asctime)s %(name)s %(levelname)s: %(message)s"
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
#         os.path.join(os.path.dirname(__file__), '..', '..', '.env.local'),
#         os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env.local'),
#         os.path.join(os.path.dirname(__file__), '..', '.env.local'),
#         os.path.join(os.path.dirname(__file__), '.env.local'),
#         '.env.local',
#         '.env'
#     ]
    
#     logger.info(f"[Environment] 📁 Checking {len(dotenv_paths)} potential .env file locations...")
    
#     for i, path in enumerate(dotenv_paths, 1):
#         full_path = os.path.abspath(path)
#         logger.debug(f"[Environment] {i}/{len(dotenv_paths)} Checking: {full_path}")
        
#         if os.path.exists(path):
#             load_dotenv(dotenv_path=path)
#             logger.info(f"[Environment] ✅ Successfully loaded environment from: {full_path}")
            
#             # List loaded variables (without exposing secrets)
#             env_vars = [key for key in os.environ.keys() if any(keyword in key.upper() for keyword in ['OPENAI', 'API', 'KEY'])]
#             logger.debug(f"[Environment] 📋 Relevant env vars found: {len(env_vars)}")
#             break
#         else:
#             logger.debug(f"[Environment] ❌ File not found: {full_path}")
#     else:
#         logger.warning("[Environment] ⚠️ No .env file found in any expected location")
        
#         # Debug: Show what files are available
#         current_dir = os.path.dirname(__file__)
#         parent_dir = os.path.join(current_dir, '..', '..')
#         if os.path.exists(parent_dir):
#             files = [f for f in os.listdir(parent_dir) if f.startswith('.env')]
#             logger.info(f"[Environment] 📄 .env files in {os.path.abspath(parent_dir)}: {files}")
        
# except ImportError as e:
#     logger.warning(f"[Environment] ⚠️ python-dotenv not available: {e}")

# ──────────────────────────────────────────────────────────────────────────────
# OpenAI Client Initialization
# ──────────────────────────────────────────────────────────────────────────────
logger.info("[OpenAI] 🔑 Initializing OpenAI client...")

openai_api_key = os.environ.get("OPENAI_API_KEY")
if openai_api_key:
    logger.info(f"[OpenAI] ✅ API key found (length: {len(openai_api_key)} chars, starts with: {openai_api_key[:10]}...)")
    openai_client = OpenAI(api_key=openai_api_key)
    logger.info("[OpenAI] ✅ OpenAI client successfully initialized")
else:
    logger.error("[OpenAI] ❌ OPENAI_API_KEY not found in environment variables")
    logger.debug("[OpenAI] 🔍 Available environment variables:")
    for key in sorted(os.environ.keys()):
        if any(keyword in key.upper() for keyword in ['API', 'KEY', 'OPENAI']):
            logger.debug(f"[OpenAI]   - {key}")
    openai_client = None

# ──────────────────────────────────────────────────────────────────────────────
# Prompts and Configuration
# ──────────────────────────────────────────────────────────────────────────────
logger.info("[Config] 📝 Setting up prompts and regex patterns...")

RESEARCH_PROMPT = """
Find 5 current, newsworthy topics related to '{topic}'.
Requirements:
- Recent (last 30 days), diverse perspectives
Output exactly 5 lines:
1. Subtopic Title
2. Subtopic Title
...
""".strip()

TOPICSELECTOR_SYSTEM = "You are a savvy topic selector, sentiment analyst, and editor," \
"selecting the 2 most engaging (positive) and 1 odd/controversial topic from the list provided."

TOPIC_ITEM_RE = re.compile(r'^(?:\d+\.\s*|\-\s*)(?:\*\*|["\']?)(.+?)(?:\*\*|["\']?)$')

logger.debug(f"[Config] ✅ Research prompt length: {len(RESEARCH_PROMPT)} chars")
logger.debug(f"[Config] ✅ Topic selector system prompt length: {len(TOPICSELECTOR_SYSTEM)} chars")
logger.debug(f"[Config] ✅ Regex pattern compiled: {TOPIC_ITEM_RE.pattern}")

# ──────────────────────────────────────────────────────────────────────────────
# State Definitions
# ──────────────────────────────────────────────────────────────────────────────
logger.info("[State] 📋 Defining pipeline state structure...")

class PipelineState(TypedDict):
    topic: str
    raw_topics: List[str]
    selected_topics: List[str]
    drafts: List[str]
    finals: List[str]
    sources: List[str]
    posts: List[str]

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
        return {"raw_topics": []}
    
    prompt = RESEARCH_PROMPT.format(topic=topic)
    logger.debug(f"[Research] 📝 Formatted prompt ({len(prompt)} chars): {prompt[:200]}...")

    try:
        logger.info("[Research] 📡 Making OpenAI API call with web search...")
        logger.debug("[Research] 🔧 API parameters: model=gpt-4o-mini, tools=[web_search_preview]")
        
        resp = openai_client.responses.create(
            model="gpt-4o-mini",
            input=prompt,
            tools=[{"type": "web_search_preview"}]
        )
        
        logger.info("[Research] ✅ OpenAI API call completed successfully")
        raw_text = resp.output_text
        logger.info(f"[Research] 📄 Raw response received ({len(raw_text)} chars)")
        logger.debug(f"[Research] 📄 Response preview: {raw_text[:300]}...")
        
        # Parse numbered lines
        lines = [line.strip() for line in raw_text.splitlines() if re.match(r'^\d+\.', line)]
        logger.info(f"[Research] 🔍 Found {len(lines)} numbered lines in response")
        
        for i, line in enumerate(lines, 1):
            logger.debug(f"[Research]   Line {i}: {line[:100]}...")
        
        result_topics = lines[:5]
        logger.info(f"[Research] ✅ Returning {len(result_topics)} topics to pipeline")
        logger.info("[Research] 🏁 === RESEARCH NODE COMPLETED ===")
        
        return {"raw_topics": result_topics}
        
    except Exception as e:
        logger.error(f"[Research] 💥 Error during research: {e}")
        logger.error(f"[Research] 💥 Error type: {type(e).__name__}")
        import traceback
        logger.error(f"[Research] 💥 Full traceback: {traceback.format_exc()}")
        logger.error("[Research] 🏁 === RESEARCH NODE FAILED ===")
        return {"raw_topics": []}

def select_topics_node(state: PipelineState) -> PipelineState:
    logger.info("[TopicSelector] 🎯 === TOPIC SELECTOR NODE STARTING ===")
    
    raws = state.get("raw_topics", [])
    logger.info(f"[TopicSelector] 📥 Received {len(raws)} raw topics")
    
    if not raws:
        logger.warning("[TopicSelector] ⚠️ No raw topics available - returning empty state")
        logger.warning("[TopicSelector] 🏁 === TOPIC SELECTOR NODE COMPLETED (EMPTY) ===")
        return {"selected_topics": []}
    
    for i, topic in enumerate(raws, 1):
        logger.debug(f"[TopicSelector]   Raw {i}: {topic[:80]}...")
    
    if not openai_client:
        logger.error("[TopicSelector] ❌ OpenAI client not available")
        logger.error("[TopicSelector] 🏁 === TOPIC SELECTOR NODE FAILED ===")
        return {"selected_topics": []}
    
    logger.info("[TopicSelector] 📝 Building selection prompt...")
    prompt = "From these, pick 2 positive and 1 odd/controversial topic:\n" + "\n".join(raws)
    logger.debug(f"[TopicSelector] 📝 Selection prompt ({len(prompt)} chars): {prompt[:200]}...")
    
    try:
        logger.info("[TopicSelector] 📡 Making OpenAI API call for topic selection...")
        logger.debug("[TopicSelector] 🔧 API parameters: model=gpt-4o-mini, temperature=0.3")
        
        resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": TOPICSELECTOR_SYSTEM},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
        )
        
        logger.info("[TopicSelector] ✅ OpenAI API call completed")
        response_content = resp.choices[0].message.content
        logger.info(f"[TopicSelector] 📄 Selection response ({len(response_content)} chars): {response_content}")
        
        # Parse selected topics
        entries = [
            m.group(1).strip()
            for line in response_content.splitlines()
            if (m := TOPIC_ITEM_RE.match(line.strip()))
        ]
        
        logger.info(f"[TopicSelector] 🔍 Parsed {len(entries)} selected topics:")
        for i, entry in enumerate(entries, 1):
            logger.info(f"[TopicSelector]   Selected {i}: {entry}")
        
        # Fallback to raw topics if parsing failed
        final_selection = (entries or raws)[:3]
        logger.info(f"[TopicSelector] ✅ Returning {len(final_selection)} selected topics")
        logger.info("[TopicSelector] 🏁 === TOPIC SELECTOR NODE COMPLETED ===")
        
        return {"selected_topics": final_selection}
        
    except Exception as e:
        logger.error(f"[TopicSelector] 💥 Error selecting topics: {e}")
        logger.error(f"[TopicSelector] 💥 Error type: {type(e).__name__}")
        import traceback
        logger.error(f"[TopicSelector] 💥 Full traceback: {traceback.format_exc()}")
        logger.error("[TopicSelector] 🏁 === TOPIC SELECTOR NODE FAILED ===")
        return {"selected_topics": []}

def draft_node(state: PipelineState) -> PipelineState:
    logger.info("[Draft] ✍️ === DRAFT NODE STARTING ===")
    
    selected_topics = state.get("selected_topics", [])
    logger.info(f"[Draft] 📥 Received {len(selected_topics)} selected topics to draft")
    
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
        logger.info(f"[Draft] ✍️ {i}/{len(selected_topics)} Drafting content for: '{topic[:60]}...'")
        
        try:
            logger.debug(f"[Draft] 📡 Making API call for topic {i}...")
            
            resp = openai_client.responses.create(
                model="gpt-4o-mini",
                input=f"Write a concise, engaging draft with a hook for the topic: {topic}",
                tools=[{"type": "web_search_preview"}]
            )
            
            text = resp.output_text.strip()
            logger.info(f"[Draft] ✅ Draft {i} completed ({len(text)} chars)")
            logger.debug(f"[Draft] 📄 Draft {i} preview: {text[:150]}...")
            
            if text:
                drafts.append(text)
                logger.debug(f"[Draft] ✅ Draft {i} added to collection")
                
                # Extract sources
                logger.debug(f"[Draft] 🔗 Extracting sources for draft {i}...")
                urls = [
                    ann["url"]
                    for item in getattr(resp, "output_items", [])
                    if item["type"] == "message"
                    for ann in item.get("annotations", [])
                    if ann.get("type") == "url_citation"
                ]
                
                unique_urls = list(dict.fromkeys(urls))
                sources.append(unique_urls)
                logger.info(f"[Draft] 🔗 Draft {i} sources: {len(unique_urls)} unique URLs")
                
                for j, url in enumerate(unique_urls, 1):
                    logger.debug(f"[Draft]   Source {j}: {url}")
            else:
                logger.warning(f"[Draft] ⚠️ Draft {i} returned empty content")
                
        except Exception as e:
            logger.error(f"[Draft] 💥 Error drafting topic {i}: {e}")
            logger.error(f"[Draft] 💥 Error type: {type(e).__name__}")
    
    logger.info(f"[Draft] ✅ Draft creation completed: {len(drafts)} drafts, {len(sources)} source lists")
    logger.info(f"[Draft] 📊 Total sources collected: {sum(len(s) for s in sources)}")
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
                    {"role": "user", "content": "You are a friendly, human-like editor."},
                    {"role": "user", "content": f"Polish this draft to be more engaging and concise:\n\n{draft}"}
                ],
                temperature=0.3,
            )
            
            final_content = resp.choices[0].message.content.strip()
            logger.info(f"[Editor] ✅ Draft {i} edited successfully ({len(final_content)} chars)")
            logger.debug(f"[Editor] 📄 Final {i} preview: {final_content[:150]}...")
            
            finals.append(final_content)
            
        except Exception as e:
            logger.error(f"[Editor] 💥 Error editing draft {i}: {e}")
            logger.error(f"[Editor] 💥 Error type: {type(e).__name__}")
            logger.warning(f"[Editor] 🔄 Using unedited draft {i} as fallback")
            finals.append(draft)
    
    logger.info(f"[Editor] ✅ Editing completed: {len(finals)} final articles created")
    logger.info("[Editor] 🏁 === EDITOR NODE COMPLETED ===")
    
    return {"finals": finals}

def post_node(state: PipelineState) -> PipelineState:
    logger.info("[Post] 📦 === POST NODE STARTING ===")
    
    # Get all arrays safely
    selected_topics = state.get("selected_topics", [])
    drafts = state.get("drafts", [])
    finals = state.get("finals", [])
    sources = state.get("sources", [])
    
    logger.info(f"[Post] 📊 Input array lengths:")
    logger.info(f"[Post]   - Topics: {len(selected_topics)}")
    logger.info(f"[Post]   - Drafts: {len(drafts)}")
    logger.info(f"[Post]   - Finals: {len(finals)}")
    logger.info(f"[Post]   - Sources: {len(sources)}")
    
    posts = []
    
    # Use the minimum length to avoid index errors
    max_items = min(len(selected_topics), len(drafts), len(finals), len(sources)) if all([selected_topics, drafts, finals, sources]) else 0
    
    logger.info(f"[Post] 🧮 Maximum processable items: {max_items}")
    
    if max_items == 0:
        logger.warning("[Post] ⚠️ Cannot create posts - one or more arrays are empty")
        logger.warning("[Post] 🏁 === POST NODE COMPLETED (EMPTY) ===")
        return {"posts": []}
    
    logger.info(f"[Post] 📦 Creating {max_items} posts...")
    
    for i in range(max_items):
        logger.debug(f"[Post] 🔄 Processing item {i+1}/{max_items}")
        
        try:
            post = {
                "topic": selected_topics[i],
                "draft": drafts[i],
                "final": finals[i],
                "sources": sources[i] if i < len(sources) else []
            }
            posts.append(post)
            
            topic_preview = selected_topics[i][:50] + "..." if len(selected_topics[i]) > 50 else selected_topics[i]
            logger.info(f"[Post] ✅ Post {i+1} created: '{topic_preview}'")
            logger.debug(f"[Post]   - Draft length: {len(drafts[i])} chars")
            logger.debug(f"[Post]   - Final length: {len(finals[i])} chars")
            logger.debug(f"[Post]   - Sources count: {len(sources[i]) if i < len(sources) else 0}")
            
        except IndexError as e:
            logger.error(f"[Post] 💥 Index error at position {i}: {e}")
            logger.error(f"[Post] 💥 Available indices - topics:{len(selected_topics)-1}, drafts:{len(drafts)-1}, finals:{len(finals)-1}, sources:{len(sources)-1}")
            break
    
    logger.info(f"[Post] ✅ Post creation completed: {len(posts)} posts created")
    logger.info("[Post] 🏁 === POST NODE COMPLETED ===")
    
    return {"posts": posts}

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

logger.info("[Graph] 🔗 Adding edges to graph...")
graph.add_edge("research", "select_topics")
logger.debug("[Graph]   ✅ Added edge: research → select_topics")

graph.add_edge("select_topics", "draft")
logger.debug("[Graph]   ✅ Added edge: select_topics → draft")

graph.add_edge("draft", "edit")
logger.debug("[Graph]   ✅ Added edge: draft → edit")

graph.add_edge("edit", "post")
logger.debug("[Graph]   ✅ Added edge: edit → post")

graph.add_edge("post", END)
logger.debug("[Graph]   ✅ Added edge: post → END")

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
        start_time = logger.name  # Placeholder for timing
        
        try:
            # Read request body
            content_length = int(self.headers.get("Content-Length", 0))
            logger.info(f"[Handler] 📥 Reading request body ({content_length} bytes)")
            
            body_data = self.rfile.read(content_length)
            logger.debug(f"[Handler] 📄 Raw body data: {body_data[:200]}...")
            
            body = json.loads(body_data.decode('utf-8'))
            logger.info(f"[Handler] 📋 Parsed JSON body: {body}")
            
            topic = body.get("topic", "").strip()
            logger.info(f"[Handler] 🎯 Extracted topic: '{topic}' (length: {len(topic)})")
            
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
            logger.info(f"[Handler] 🚀 Starting pipeline execution for topic: '{topic}'")
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
                    logger.debug(f"[Handler]   Post {i}: '{topic_preview}...' ({sources_count} sources)")
            
            # Send successful response
            response_data = {
                "status": "success",
                "message": "Research completed successfully",
                "posts": posts,
                "topic_count": len(posts),
                "original_topic": topic
            }
            
            logger.info("[Handler] 📤 Sending success response...")
            self._send_success(response_data)
            logger.info("[Handler] 🏁 === POST REQUEST COMPLETED SUCCESSFULLY ===")
            
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
        self._send_error("GET method not allowed, use POST with JSON body", status_code=405)
        logger.info("[Handler] ❌ GET request rejected")

    def _send_success(self, data):
        """Send a successful JSON response"""
        logger.debug("[Handler] ✅ Preparing success response...")
        
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        
        response_json = json.dumps(data, indent=2)
        logger.info(f"[Handler] 📤 Sending success response ({len(response_json)} chars)")
        logger.debug(f"[Handler] 📄 Response preview: {response_json[:300]}...")
        
        self.wfile.write(response_json.encode('utf-8'))
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
            "timestamp": str(logger.name)  # Placeholder for timestamp
        }
        
        response_json = json.dumps(error_data, indent=2)
        logger.error(f"[Handler] 📤 Sending error response ({status_code}): {message}")
        
        self.wfile.write(response_json.encode('utf-8'))
        logger.error(f"[Handler] ❌ Error response sent: {message}")

# ──────────────────────────────────────────────────────────────────────────────
# Local Development Server
# ──────────────────────────────────────────────────────────────────────────────
# if __name__ == "__main__":
#     logger.info("[LocalServer] 🏠 Starting local development server...")
#     from http.server import HTTPServer
    
#     try:
#         httpd = HTTPServer(('localhost', 3001), handler)
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