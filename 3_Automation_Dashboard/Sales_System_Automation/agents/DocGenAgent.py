import os
import json
import subprocess
from google import genai

class DocGenAgent:
    def __init__(self):
        self.model = 'gemini-3.5-flash'
        # Assumes GEMINI_API_KEY env var is set for genai.Client()
        self.client = genai.Client()
        self.system_instruction = """You are DocGenAgent.
Analyze the latest sales updates and determine which documents need to be generated (e.g. B1 daily sales, B2 daily sales).
Return a JSON array of commands to execute (e.g. python3 generate_populated_sales.py)."""

    def generate_docs(self, data_changes):
        print("[DocGenAgent] Planning document generation...")
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=f"Data changed: {json.dumps(data_changes)}. Which docs to build?",
                config=genai.types.GenerateContentConfig(
                    system_instruction=self.system_instruction,
                    response_mime_type="application/json"
                )
            )
            commands = json.loads(response.text)
            for cmd in commands:
                print(f"[DocGenAgent] Executing: {cmd}")
                subprocess.run(cmd.get('command', '').split(), check=True)
            return {"status": "success", "docs_generated": len(commands)}
        except Exception as e:
            print(f"[DocGenAgent] Error: {e}")
            return {"status": "error", "error": str(e)}

if __name__ == "__main__":
    agent = DocGenAgent()
    agent.generate_docs({"event": "daily_update", "date": "2026-05-20"})
