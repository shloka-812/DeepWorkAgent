#!/usr/bin/env python3
"""
Simple mock backend for testing Person B's Chrome extension in HOUR 1-2.
Runs on localhost:8000 and responds to /event POST requests with test responses.

Usage:
    1. Make sure Python 3 is installed
    2. Run: python3 mock_backend.py
    3. Open http://localhost:8000/health to verify it's running
    4. Install extension in Chrome and start monitoring
    5. Tab changes will hit /event endpoint
"""

import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import random

class MockBackendHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok'}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/event':
            # Read the event payload
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            try:
                event_data = json.loads(body)
                print(f"\n📨 Received event:")
                print(f"   URL: {event_data.get('url', 'N/A')}")
                print(f"   Domain: {event_data.get('domain', 'N/A')}")
                print(f"   Title: {event_data.get('title', 'N/A')[:50]}")
                print(f"   Dwell time: {event_data.get('dwell_seconds', 0)}s")
                
                # Determine response based on domain heuristics
                domain = event_data.get('domain', '').lower()
                
                # Mock AI decision logic
                response = self._decide_action(domain, event_data)
                
                # Send response
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                
                response_json = json.dumps(response)
                self.wfile.write(response_json.encode())
                
                print(f"   → Action: {response.get('action')}")
                print(f"   → Message: {response.get('message', '')}")
                
            except json.JSONDecodeError:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Invalid JSON'}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def _decide_action(self, domain, event_data):
        """Mock AI decision: classify domain and return nudge/block/log"""
        
        # Distraction domains (mock list)
        high_distraction = ['youtube.com', 'tiktok.com', 'instagram.com', 'twitter.com', 
                           'reddit.com', 'facebook.com', 'twitch.tv', 'x.com']
        medium_distraction = ['news.google.com', 'bbc.com', 'cnn.com', 'espn.com']
        
        for high in high_distraction:
            if high in domain:
                # Block decision
                return {
                    'action': 'block',
                    'message': f'🚫 {domain} is a known distraction.\nTake a moment to refocus on your deep work.',
                    'display_duration': 300,  # 5 minutes
                    'metadata': {'severity': 'high', 'category': 'social_media'}
                }
        
        for medium in medium_distraction:
            if medium in domain:
                # Nudge decision  
                return {
                    'action': 'nudge',
                    'message': f'⏰ You\'re on {domain}. Remember your focus goal!',
                    'display_duration': 5000,  # 5 seconds
                    'metadata': {'severity': 'medium', 'category': 'news'}
                }
        
        # Default: just log (no UI action)
        return {
            'action': 'log',
            'message': f'Visiting {domain}',
            'metadata': {'severity': 'low', 'category': 'work'}
        }
    
    def log_message(self, format, *args):
        """Suppress default logging"""
        pass


def run_server(port=8000):
    """Start the mock backend server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, MockBackendHandler)
    
    print(f"""
╔════════════════════════════════════════════════════════════════╗
║          🤖 Mock Backend Server (HOUR 1-2 Testing)           ║
╚════════════════════════════════════════════════════════════════╝

✅ Server running at http://localhost:8000

Endpoints:
  GET  /health          Check server status
  POST /event           Receive tab change events from extension

Test events hitting /event with tab URLs:
  • youtube.com  → ⬛ BLOCK response
  • twitter.com  → ⬛ BLOCK response  
  • reddit.com   → ⬛ BLOCK response
  • news sites   → 💬 NUDGE response
  • unknown      → 📝 LOG response

To stop: Press Ctrl+C

────────────────────────────────────────────────────────────────
    """)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
        httpd.server_close()


if __name__ == '__main__':
    run_server()
