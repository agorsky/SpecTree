#!/usr/bin/env python3
"""
Extract all MCP tool names from tool registration files.
"""
import re
import glob
from pathlib import Path

tool_files = glob.glob("packages/mcp/src/tools/**/*.ts", recursive=True)
tool_files = [f for f in tool_files if not f.endswith(".test.ts")]

tools = []

for file_path in sorted(tool_files):
    with open(file_path, 'r') as f:
        content = f.read()
        # Find all registerTool calls
        matches = re.findall(r'server\.registerTool\(\s*["\']([^"\']+)["\']', content)
        for match in matches:
            if match.startswith("spectree__"):
                deprecated = "DEPRECATED" in content[:content.find(match)]
                tools.append({
                    "name": match,
                    "file": file_path,
                    "deprecated": deprecated
                })

print("=" * 80)
print(f"Found {len(tools)} tools:")
print("=" * 80)
for tool in sorted(tools, key=lambda x: x["name"]):
    status = " [DEPRECATED]" if tool["deprecated"] else ""
    print(f"{tool['name']}{status}")
    print(f"  File: {tool['file']}")
    print()
