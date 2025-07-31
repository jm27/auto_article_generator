# File: /api/agents/[...slug].py

import json
import logging
import importlib.util
import os
from http.server import BaseHTTPRequestHandler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AgentRouter")

# Map sub-paths to Python files in the sibling `agents-apis` directory
AGENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../agents-apis'))
AGENT_MAP = {
    'research': 'research.py',
    'draft': 'draft.py',
    'editor': 'editor.py',
    'distribute': 'distribute.py',
}

def load_agent_handler(file_name):
    try:
        file_path = os.path.join(AGENT_DIR, file_name)
        logger.info(f"Loading agent file: {file_path}")

        spec = importlib.util.spec_from_file_location("agent_module", file_path)
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            return getattr(module, 'handler', None)
        else:
            logger.error(f"Could not load spec for {file_path}")
            return None
    except Exception as e:
        logger.error(f"Error loading agent module: {e}")
        return None

class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        logger.info(f"[Router] POST to path: {self.path}")
        path_parts = self.path.strip("/").split("/")

        # Expecting /api/agents/<agent_name>
        if len(path_parts) < 3 or path_parts[0] != 'api' or path_parts[1] != 'agents':
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error": "Invalid path"}')
            return

        agent_name = path_parts[2]
        agent_file = AGENT_MAP.get(agent_name)

        if not agent_file:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error": "Unknown agent"}')
            return

        agent_handler = load_agent_handler(agent_file)
        if not agent_handler:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b'{"error": "Agent handler not found"}')
            return

        logger.info(f"[Router] Delegating to agent: {agent_name}")
        # Delegate the request
        response = agent_handler(self)

        # Optional: You could normalize the response here
        if response and isinstance(response, dict):
            self.send_response(response.get("statusCode", 200))
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response.get("body", {})).encode())
        else:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"message": "Agent executed"}')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        self.send_response(405)
        self.end_headers()
        self.wfile.write(b'{"error": "GET not supported"}')
