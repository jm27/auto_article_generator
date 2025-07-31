import json
import os
import logging
from http.server import BaseHTTPRequestHandler
from typing import Any, TypedDict

from langgraph.graph import StateGraph, END
from openai import OpenAI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)
logger.info("[Research Agent] Initialized")

# Define your state
class ResearchState(TypedDict):
    query: str
    research_data: list[dict]
    analysis: str
    final_report: str

# Initialize OpenAI client
openai_api_key = os.environ.get("OPENAI_API_KEY")
logger.info(f"[Research] OpenAI API key present: {bool(openai_api_key)}")

if not openai_api_key:
    logger.error("[Research] No OpenAI API key found!")
    openai_client = None
else:
    openai_client = OpenAI(api_key=openai_api_key)
    logger.info("[Research] OpenAI client initialized successfully")

# Define node functions
def fetch_trending_topics_node(state: ResearchState) -> ResearchState:
    """Fetch trending topics related to the query"""
    logger.info(f'[Research] Fetching trending topics for query: {state["query"]}')
    query = state.get("query", "")
    
    if not query:
        logger.warning("[Research] No query provided")
        return {"research_data": []}
    
    if not openai_client:
        logger.error("[Research] OpenAI client not available")
        return {"research_data": []}
    
    try:
        logger.info(f"[Research] Making OpenAI request for query: {query}")
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a research assistant. Find current trending topics and return them as a comma-separated list. Focus on newsworthy, relevant topics."
                },
                {
                    "role": "user", 
                    "content": f"Find 5 current trending topics related to '{query}'. Return only the topic names separated by commas, no explanations."
                }
            ],
            max_tokens=300,
            temperature=0.3
        )
        
        trending_topics_text = response.choices[0].message.content.strip()
        logger.info(f'[Research] Raw trending topics response: {trending_topics_text}')
        
        # Enhanced parsing with validation
        topics_list = []
        for topic in trending_topics_text.split(","):
            topic = topic.strip()
            if topic and len(topic) > 2:
                topics_list.append({"topic": topic})
        
        logger.info(f'[Research] Parsed {len(topics_list)} valid trending topics')
        
        if not topics_list:
            logger.warning("[Research] No valid topics found in response")
            topics_list = [{"topic": f"General trends in {query}"}]
        
        return {"research_data": topics_list}
        
    except Exception as e:
        logger.error(f"[Research] Error fetching trending topics: {str(e)}")
        logger.error(f"[Research] Exception type: {type(e).__name__}")
        return {"research_data": []}

def summarize_sentiment_node(state: ResearchState) -> ResearchState:
    """Summarize sentiment of the research data"""
    logger.info(f'[Research] Summarizing sentiment for {len(state.get("research_data", []))} topics')
    
    research_data = state.get("research_data", [])
    query = state.get("query", "")
    
    if not research_data:
        logger.warning("[Research] No research data available for sentiment analysis")
        return {
            "analysis": "No data available for sentiment analysis.",
            "final_report": f"No research data was found to analyze for query: '{query}'"
        }
    
    if not openai_client:
        logger.error("[Research] OpenAI client not available")
        return {
            "analysis": "OpenAI client not available",
            "final_report": f"Analysis failed for '{query}' - OpenAI client not available"
        }
    
    # Extract topics for analysis
    topics = "\n".join(f"- {topic['topic']}" for topic in research_data)
    logger.info(f'[Research] Topics to analyze:\n{topics}')
    
    try:
        logger.info("[Research] Making OpenAI request for sentiment analysis")
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": """You are a research analyst specialized in sentiment analysis. 
                    Provide a comprehensive analysis including:
                    1. Overall sentiment (positive/negative/neutral/mixed)
                    2. Key themes and patterns
                    3. Potential implications
                    4. Brief actionable insights
                    Keep it concise but informative."""
                },
                {
                    "role": "user", 
                    "content": f"Analyze the sentiment and provide insights for these trending topics related to '{query}':\n\n{topics}"
                }
            ],
            max_tokens=600,
            temperature=0.3            
        )
        
        sentiment_analysis = response.choices[0].message.content.strip()
        logger.info(f'[Research] Sentiment analysis completed: {len(sentiment_analysis)} characters')
        
        # Enhanced final report
        final_report = f"""Research Analysis Report
{'='*60}

Query: {query}
Topics Analyzed: {len(research_data)}

Trending Topics Found:
{topics}

Sentiment Analysis & Insights:
{sentiment_analysis}

{'='*60}
End of Report"""
        
        return {
            "analysis": sentiment_analysis,
            "final_report": final_report
        }
        
    except Exception as e:
        logger.error(f"[Research] Error in sentiment analysis: {str(e)}")
        logger.error(f"[Research] Exception type: {type(e).__name__}")
        return {
            "analysis": f"Error during sentiment analysis: {str(e)}",
            "final_report": f"Analysis failed for '{query}' due to error: {str(e)}"
        }

# Build the graph (only if OpenAI client is available)
if openai_client:
    logger.info("[Research Agent] Building state graph")
    research_graph = StateGraph(ResearchState)

    # Add nodes
    research_graph.add_node("fetch_trending_topics", fetch_trending_topics_node)
    research_graph.add_node("summarize_sentiment", summarize_sentiment_node)

    # Define the flow
    logger.info("[Research Agent] Defining graph flow")
    research_graph.add_edge("fetch_trending_topics", "summarize_sentiment")
    research_graph.add_edge("summarize_sentiment", END)

    # Set entry point and compile
    research_graph.set_entry_point("fetch_trending_topics")
    compiled_graph = research_graph.compile()
    logger.info("[Research Agent] State graph compiled successfully")
else:
    compiled_graph = None
    logger.error("[Research Agent] Graph not compiled - OpenAI client unavailable")

# Vercel handler class following the reference pattern
class handler(BaseHTTPRequestHandler):
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        logger.info("[Research Agent] Handling OPTIONS request")
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        return
    
    def do_POST(self):
        """Handle POST requests for research"""
        logger.info("[Research Agent] Handling POST request")
        
        # Set CORS headers
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        # Check if graph is compiled
        if not compiled_graph:
            logger.error("[Research Agent] Graph not compiled")
            self.end_headers()
            error_response = json.dumps({"error": "Research agent not properly initialized"})
            self.wfile.write(error_response.encode())
            return
        
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                logger.error("[Research Agent] Empty request body")
                self.end_headers()
                error_response = json.dumps({"error": "Empty request body"})
                self.wfile.write(error_response.encode())
                return
            
            request_data = self.rfile.read(content_length)
            logger.info(f"[Research Agent] Request data length: {len(request_data)} bytes")
            
            # Parse JSON payload
            payload = json.loads(request_data.decode('utf-8'))
            logger.info(f"[Research Agent] Payload: {payload}")
            
            # Extract and validate query
            query = payload.get('query', payload.get('topic', '')).strip()
            logger.info(f"[Research Agent] Query: '{query}'")
            
            if not query:
                logger.warning("[Research Agent] No query provided")
                self.end_headers()
                error_response = json.dumps({
                    "error": "Query or topic is required",
                    "example": {"query": "artificial intelligence"}
                })
                self.wfile.write(error_response.encode())
                return
            
            if len(query) > 200:
                logger.warning(f"[Research Agent] Query too long: {len(query)} chars")
                self.end_headers()
                error_response = json.dumps({"error": "Query too long (max 200 characters)"})
                self.wfile.write(error_response.encode())
                return
            
            # Execute the research graph
            logger.info("[Research Agent] Executing graph...")
            initial_state = {"query": query}
            result = compiled_graph.invoke(initial_state)
            logger.info("[Research Agent] Graph execution completed successfully")
            
            # Build response
            response_data = {
                "success": True,
                "query": query,
                "research_data": result.get("research_data", []),
                "analysis": result.get("analysis", ""),
                "final_report": result.get("final_report", ""),
                "metadata": {
                    "topics_found": len(result.get("research_data", [])),
                    "timestamp": logger.name
                }
            }
            
            # Send response
            self.end_headers()
            response_body = json.dumps(response_data, indent=2)
            self.wfile.write(response_body.encode())
            logger.info(f"[Research Agent] Success response sent ({len(response_body)} chars)")
            return
            
        except json.JSONDecodeError as e:
            logger.error(f"[Research Agent] JSON decode error: {e}")
            self.end_headers()
            error_response = json.dumps({"error": "Invalid JSON format"})
            self.wfile.write(error_response.encode())
            return
            
        except Exception as e:
            logger.error(f"[Research Agent] Unexpected error: {e}")
            logger.error(f"[Research Agent] Error type: {type(e).__name__}")
            self.end_headers()
            error_response = json.dumps({"error": f"Internal server error: {str(e)}"})
            self.wfile.write(error_response.encode())
            return
    
    def do_GET(self):
        """Handle GET requests - return method not allowed"""
        logger.warning("[Research Agent] GET request received - not allowed")
        self.send_response(405)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        error_response = json.dumps({"error": "Method not allowed. Use POST."})
        self.wfile.write(error_response.encode())
        return

# Add this at the very end of your research.py file, after the existing handler class:

def process_research_request(payload):
    """Function-based handler for direct calls"""
    logger.info(f"[Research Agent] Direct function call with payload: {payload}")
    
    if not compiled_graph:
        logger.error("[Research Agent] Graph not compiled")
        return {"error": "Research agent not properly initialized"}
    
    try:
        # Extract and validate query
        query = payload.get('query', payload.get('topic', '')).strip()
        logger.info(f"[Research Agent] Query: '{query}'")
        
        if not query:
            logger.warning("[Research Agent] No query provided")
            return {
                "error": "Query or topic is required",
                "example": {"query": "artificial intelligence"}
            }
        
        if len(query) > 200:
            logger.warning(f"[Research Agent] Query too long: {len(query)} chars")
            return {"error": "Query too long (max 200 characters)"}
        
        # Execute the research graph
        logger.info("[Research Agent] Executing graph...")
        initial_state = {"query": query}
        result = compiled_graph.invoke(initial_state)
        logger.info("[Research Agent] Graph execution completed successfully")
        
        # Build response
        response_data = {
            "success": True,
            "query": query,
            "research_data": result.get("research_data", []),
            "analysis": result.get("analysis", ""),
            "final_report": result.get("final_report", ""),
            "metadata": {
                "topics_found": len(result.get("research_data", [])),
                "processed_via": "direct_function_call"
            }
        }
        
        logger.info(f"[Research Agent] Success response prepared")
        return response_data
        
    except Exception as e:
        logger.error(f"[Research Agent] Unexpected error: {e}")
        logger.error(f"[Research Agent] Error type: {type(e).__name__}")
        return {"error": f"Internal server error: {str(e)}"}

# Add this line to export the function
handler.process_research_request = process_research_request


logger.info("[Research] ✅ Module ready for Vercel deployment!")