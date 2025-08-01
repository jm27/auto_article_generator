# File: api/generate_posts.py

import os
import json
import logging
from http.server import BaseHTTPRequestHandler
from typing import TypedDict, Any, List

from langgraph.graph import StateGraph, END
from openai import OpenAI

# ──────────────────────────────────────────────────────────────────────────────
# Logging Setup
# ──────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s: %(message)s"
)
logger = logging.getLogger("generate-posts")
logger.info("[Orchestrator] Initializing generate_posts pipeline")

# ──────────────────────────────────────────────────────────────────────────────
# Shared State Definition
# ──────────────────────────────────────────────────────────────────────────────
class PipelineState(TypedDict, total=False):
    topic: str
    raw_topics: List[str]
    selected_topics: List[str]
    drafts: List[str]
    finals: List[str]
    sources: List[List[str]]

# ──────────────────────────────────────────────────────────────────────────────
# OpenAI Client (GPT-4o-mini + web_search)
# ──────────────────────────────────────────────────────────────────────────────
API_KEY = os.getenv("OPENAI_API_KEY", "")
if not API_KEY:
    logger.error("[Orchestrator] OPENAI_API_KEY missing!")
    openai = None
else:
    openai = OpenAI(api_key=API_KEY)
    logger.info("[Orchestrator] OpenAI client ready")

# ──────────────────────────────────────────────────────────────────────────────
# 1) Research Agent: fetch ~5 topics via web search
# ──────────────────────────────────────────────────────────────────────────────
def research_node(state: PipelineState) -> PipelineState:
    topic = state["topic"]
    resp = openai.responses.create(
        model="gpt-4o-mini",
        input=f"Find 5 current, newsworthy subtopics related to '{topic}'.",
        tools=[{"type": "web_search_preview"}],
    )
    text = resp.output_text.strip()
    raw = [t.strip() for t in text.replace(",", "\n").splitlines() if t.strip()]
    return {"raw_topics": raw[:5]}

# ──────────────────────────────────────────────────────────────────────────────
# 2) TopicSelector Agent: pick 2 engaging + 1 odd
# ──────────────────────────────────────────────────────────────────────────────
def select_topics_node(state: PipelineState) -> PipelineState:
    raws = state["raw_topics"]
    prompt = (
        "From these topics, pick the 2 most engaging (positive sentiment) and 1 odd/unusual:\n\n"
        + "\n".join(f"- {t}" for t in raws)
    )
    resp = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a savvy editor selecting best content topics."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
    )
    chosen = [c.strip() for c in resp.choices[0].message.content.split("\n") if c.strip()]
    return {"selected_topics": chosen[:3]}

# ──────────────────────────────────────────────────────────────────────────────
# 3) Draft Agent: for each topic, build a draft + collect sources
# ──────────────────────────────────────────────────────────────────────────────
def draft_node(state: PipelineState) -> PipelineState:
    drafts: List[str] = []
    sources_list: List[List[str]] = []

    for sub in state["selected_topics"]:
        resp = openai.responses.create(
            model="gpt-4o-mini",
            input=f"Using web search, write a concise draft summary about '{sub}'.",
            tools=[{"type": "web_search_preview"}],
        )
        draft_text = resp.output_text.strip()
        drafts.append(draft_text)

        # Extract URL citations from response output_items
        urls: List[str] = []
        for item in getattr(resp, "output_items", []):
            if item.get("type") == "message":
                for ann in item.get("annotations", []):
                    if ann.get("type") == "url_citation":
                        url = ann.get("url")
                        if url and url not in urls:
                            urls.append(url)
        sources_list.append(urls)

    return {"drafts": drafts, "sources": sources_list}

# ──────────────────────────────────────────────────────────────────────────────
# 4) Editor Agent: polish each draft for tone & clarity
# ──────────────────────────────────────────────────────────────────────────────
def edit_node(state: PipelineState) -> PipelineState:
    finals: List[str] = []
    for draft in state["drafts"]:
        resp = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a friendly, human-like editor."},
                {"role": "user", "content":
                    "Please refine this draft into a final concise, engaging post:\n\n" + draft}
            ],
            temperature=0.5,
        )
        finals.append(resp.choices[0].message.content.strip())
    return {"finals": finals}

# ──────────────────────────────────────────────────────────────────────────────
# 5) Publisher Agent: package into JSON response
# ──────────────────────────────────────────────────────────────────────────────
def publish_node(state: PipelineState) -> PipelineState:
    posts = []
    for topic, draft, final, srcs in zip(
        state["selected_topics"],
        state["drafts"],
        state["finals"],
        state["sources"]
    ):
        posts.append({
            "topic": topic,
            "draft": draft,
            "final": final,
            "sources": srcs
        })
    return {"posts": posts}

# ──────────────────────────────────────────────────────────────────────────────
# Build & Compile LangGraph
# ──────────────────────────────────────────────────────────────────────────────
graph = StateGraph(PipelineState)
graph.add_node("research", research_node)
graph.add_node("select_topics", select_topics_node)
graph.add_node("draft", draft_node)
graph.add_node("edit", edit_node)
graph.add_node("publish", publish_node)

graph.add_edge("research", "select_topics")
graph.add_edge("select_topics", "draft")
graph.add_edge("draft", "edit")
graph.add_edge("edit", "publish")
graph.add_edge("publish", END)

graph.set_entry_point("research")
compiled = graph.compile()

# ──────────────────────────────────────────────────────────────────────────────
# Vercel Serverless Handler
# ──────────────────────────────────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            body = json.loads(raw.decode())
            topic = body.get("topic", "").strip()
        except Exception:
            return self._error("Invalid JSON payload")

        if not topic:
            return self._error("`topic` is required")

        try:
            result = compiled.invoke({"topic": topic})
        except Exception as e:
            return self._error(f"Pipeline error: {e}")

        self.wfile.write(json.dumps({"posts": result["posts"]}).encode())

    def do_GET(self):
        self.send_response(405)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"error":"Use POST"}')

    def _error(self, msg: str):
        logger.error(f"[Orchestrator] {msg}")
        self.wfile.write(json.dumps({"error": msg}).encode())

logger.info("[Orchestrator] generate_posts handler ready")
