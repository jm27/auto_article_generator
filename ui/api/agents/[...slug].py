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

class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        # FIXED: Parse URL to remove query parameters
        parsed_url = urlparse(self.path)
        clean_path = parsed_url.path
        
        logger.info(f"[Router] POST to path: {self.path}")
        logger.info(f"[Router] Clean path: {clean_path}")
        
        path_parts = clean_path.strip("/").split("/")
        logger.info(f"[Router] Path parts: {path_parts}")

        # Expecting /api/agents/<agent_name>
        if len(path_parts) < 3 or path_parts[0] != 'api' or path_parts[1] != 'agents':
            logger.warning(f"[Router] Invalid path structure: {path_parts}")
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"error": "Invalid path"}')
            return

        agent_name = path_parts[2]
        logger.info(f"[Router] Agent name: {agent_name}")
        
        # Check if agent exists in map
        agent_file = AGENT_MAP.get(agent_name)
        logger.info(f"[Router] Agent file: {agent_file}")
        
        if not agent_file:
            logger.warning(f"[Router] Unknown agent: {agent_name}")
            logger.info(f"[Router] Available agents: {list(AGENT_MAP.keys())}")
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Unknown agent", "available": list(AGENT_MAP.keys())}).encode())
            return

        # Load agent handler
        agent_handler_class = load_agent_handler(agent_file)
        if not agent_handler_class:
            logger.error(f"[Router] Failed to load agent handler for {agent_name}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"error": "Agent handler not found"}')
            return

        logger.info(f"[Router] Delegating to agent: {agent_name}")
        
        try:
            # Create instance of the agent handler and delegate
            agent_instance = agent_handler_class(self.rfile, self.wfile, self.server)
            agent_instance.command = self.command
            agent_instance.path = clean_path  # Use clean path without query params
            agent_instance.request_version = self.request_version
            agent_instance.headers = self.headers
            agent_instance.rfile = self.rfile
            agent_instance.wfile = self.wfile
            agent_instance.server = self.server
            agent_instance.client_address = self.client_address
            
            # Call the agent's POST handler
            agent_instance.do_POST()
            
        except Exception as e:
            logger.error(f"[Router] Error delegating to agent: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({"error": f"Agent execution failed: {str(e)}"})
            self.wfile.write(error_response.encode())

    def do_OPTIONS(self):
        logger.info(f"[Router] OPTIONS to path: {self.path}")
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        logger.info(f"[Router] GET to path: {self.path}")
        self.send_response(405)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"error": "GET not supported"}')