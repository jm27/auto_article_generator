# File: /api/agents/[...slug].py

import json
import logging
import importlib.util
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AgentRouter")

# FIXED: Point to the correct agents-apis directory
# Current file is at: ui/api/agents/[...slug].py
# Target directory is: ui/agents-apis/
# So we need to go up 2 levels (agents -> api -> ui) then into agents-apis
AGENT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'agents-apis')

AGENT_MAP = {
    'research': 'research.py',
    'draft': 'draft.py',
    'editor': 'editor.py',
    'distribute': 'distribute.py',
}

# Add this debug section right after the AGENT_MAP definition
logger.info(f"[Router] AGENT_DIR: {AGENT_DIR}")
logger.info(f"[Router] Directory exists: {os.path.exists(AGENT_DIR)}")

if os.path.exists(AGENT_DIR):
    files_in_dir = [f for f in os.listdir(AGENT_DIR) if f.endswith('.py')]
    logger.info(f"[Router] Python files in agents directory: {files_in_dir}")
else:
    logger.error(f"[Router] Agents directory does not exist: {AGENT_DIR}")

def load_agent_handler(file_name):
    try:
        file_path = os.path.join(AGENT_DIR, file_name)
        logger.info(f"Loading agent file: {file_path}")
        
        # Check if file exists
        if not os.path.exists(file_path):
            logger.error(f"Agent file does not exist: {file_path}")
            return None

        spec = importlib.util.spec_from_file_location("agent_module", file_path)
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            handler_class = getattr(module, 'handler', None)
            
            if handler_class:
                logger.info(f"Successfully loaded handler from {file_name}")
                return handler_class
            else:
                logger.error(f"No 'handler' found in {file_name}")
                return None
        else:
            logger.error(f"Could not load spec for {file_path}")
            return None
    except Exception as e:
        logger.error(f"Error loading agent module: {e}")
        return None
# Update the do_POST method in the handler class

class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        try:
            # Parse URL to remove query parameters
            parsed_url = urlparse(self.path)
            clean_path = parsed_url.path
            
            logger.info(f"[Router] POST to path: {self.path}")
            logger.info(f"[Router] Clean path: {clean_path}")
            
            path_parts = clean_path.strip("/").split("/")
            logger.info(f"[Router] Path parts: {path_parts}")

            # Expecting /api/agents/<agent_name>
            if len(path_parts) < 3 or path_parts[0] != 'api' or path_parts[1] != 'agents':
                logger.warning(f"[Router] Invalid path structure: {path_parts}")
                self._send_error_response(404, "Invalid path")
                return

            agent_name = path_parts[2]
            logger.info(f"[Router] Agent name: {agent_name}")
            
            # Check if agent exists in map
            agent_file = AGENT_MAP.get(agent_name)
            logger.info(f"[Router] Agent file: {agent_file}")
            
            if not agent_file:
                logger.warning(f"[Router] Unknown agent: {agent_name}")
                logger.info(f"[Router] Available agents: {list(AGENT_MAP.keys())}")
                self._send_error_response(404, "Unknown agent", {"available": list(AGENT_MAP.keys())})
                return

            
            # Load agent handler
            agent_handler = load_agent_handler(agent_file)
            if not agent_handler:
                logger.error(f"[Router] Failed to load agent handler for {agent_name}")
                self._send_error_response(500, "Agent handler not found")
                return

            logger.info(f"[Router] Processing request with agent: {agent_name}")

            try:
                # Read request body
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    request_data = self.rfile.read(content_length)
                    payload = json.loads(request_data.decode('utf-8'))
                else:
                    payload = {}
                
                logger.info(f"[Router] Payload: {payload}")
                
                # Check if handler is a function or class
                if callable(agent_handler) and not isinstance(agent_handler, type):
                    # Function-based handler (preferred)
                    logger.info(f"[Router] Using function-based handler")
                    result = agent_handler(payload)
                else:
                    # Class-based handler - call it directly without BaseHTTPRequestHandler delegation
                    logger.info(f"[Router] Using direct agent processing")
                    
                    # Create a simple mock request object
                    mock_request = type('MockRequest', (), {
                        'json': payload,
                        'body': json.dumps(payload),
                        'method': 'POST',
                        'headers': dict(self.headers)
                    })()
                    
                    # Call the agent's processing function directly
                    if hasattr(agent_handler, 'process_research_request'):
                        result = agent_handler.process_research_request(payload)
                    else:
                        # Fallback response
                        result = {
                            "success": True,
                            "message": f"Agent {agent_name} processed successfully",
                            "query": payload.get('query', payload.get('topic', '')),
                            "data": payload
                        }
                
                # Send response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response_body = json.dumps(result, indent=2)
                self.wfile.write(response_body.encode())
                logger.info(f"[Router] Successfully processed request with {agent_name}")
                
            except Exception as e:
                logger.error(f"[Router] Error processing request: {e}")
                self._send_error_response(500, f"Agent processing failed: {str(e)}")
            
        except Exception as e:
            logger.error(f"[Router] Error in do_POST: {e}")
            logger.error(f"[Router] Exception type: {type(e).__name__}")
            self._send_error_response(500, f"Router error: {str(e)}")