#!/usr/bin/env python3
"""
Audit MCP documentation against actual tool implementations.
Compares documented tools with registered tools to find discrepancies.
"""
import re
import glob
from pathlib import Path
from collections import defaultdict

# Extract tools from source code
def extract_tools_from_source():
    tool_files = glob.glob("packages/mcp/src/tools/**/*.ts", recursive=True)
    tool_files = [f for f in tool_files if not f.endswith(".test.ts")]
    
    tools = {}
    for file_path in sorted(tool_files):
        with open(file_path, 'r') as f:
            content = f.read()
            # Find all registerTool calls with their context
            pattern = r'server\.registerTool\(\s*["\']([^"\']+)["\'],\s*\{[^}]*?description:\s*["\']([^"\']+)'
            matches = re.finditer(pattern, content, re.DOTALL)
            for match in matches:
                tool_name = match.group(1)
                if tool_name.startswith("spectree__"):
                    # Check if deprecated
                    desc_start = match.start()
                    preceding = content[max(0, desc_start-500):desc_start]
                    deprecated = "DEPRECATED" in content[desc_start:desc_start+200] or "⚠️" in content[desc_start:desc_start+200]
                    
                    tools[tool_name] = {
                        "file": file_path,
                        "deprecated": deprecated,
                        "description": match.group(2)[:100] + "..." if len(match.group(2)) > 100 else match.group(2)
                    }
    return tools

# Extract tools mentioned in documentation
def extract_tools_from_docs():
    doc_files = glob.glob("docs/mcp/*.md")
    doc_mentions = defaultdict(list)
    
    for doc_file in sorted(doc_files):
        with open(doc_file, 'r') as f:
            content = f.read()
            # Find all mentions of spectree__ tools
            matches = re.findall(r'spectree__[a-z_]+', content)
            for tool_name in set(matches):
                doc_mentions[tool_name].append(Path(doc_file).name)
    
    return doc_mentions

# Main audit
print("=" * 80)
print("MCP TOOL DOCUMENTATION AUDIT")
print("=" * 80)
print()

source_tools = extract_tools_from_source()
doc_tools = extract_tools_from_docs()

print(f"📊 SUMMARY:")
print(f"  Tools in source code: {len(source_tools)}")
print(f"  Unique tools mentioned in docs: {len(doc_tools)}")
print(f"  Deprecated tools in source: {sum(1 for t in source_tools.values() if t['deprecated'])}")
print()

# Find tools mentioned in docs but not in source
print("=" * 80)
print("⚠️  TOOLS IN DOCS BUT NOT IN SOURCE (possible typos):")
print("=" * 80)
not_in_source = []
for tool_name in sorted(doc_tools.keys()):
    if tool_name not in source_tools:
        not_in_source.append(tool_name)
        print(f"  ❌ {tool_name}")
        print(f"     Mentioned in: {', '.join(doc_tools[tool_name])}")
        print()

if not not_in_source:
    print("  ✅ None found\n")

# Find deprecated tools still mentioned in docs
print("=" * 80)
print("⚠️  DEPRECATED TOOLS MENTIONED IN DOCS:")
print("=" * 80)
deprecated_in_docs = []
for tool_name in sorted(doc_tools.keys()):
    if tool_name in source_tools and source_tools[tool_name]['deprecated']:
        deprecated_in_docs.append(tool_name)
        print(f"  ⚠️  {tool_name}")
        print(f"     Mentioned in: {', '.join(doc_tools[tool_name])}")
        print(f"     Status: DEPRECATED in source")
        print()

if not deprecated_in_docs:
    print("  ✅ None found\n")

# Find tools in source but never mentioned in docs
print("=" * 80)
print("📝 TOOLS IN SOURCE BUT NOT DOCUMENTED:")
print("=" * 80)
not_documented = []
for tool_name in sorted(source_tools.keys()):
    if tool_name not in doc_tools:
        status = " [DEPRECATED]" if source_tools[tool_name]['deprecated'] else ""
        not_documented.append(tool_name)
        print(f"  {tool_name}{status}")
        print(f"     File: {source_tools[tool_name]['file']}")
        print()

if not not_documented:
    print("  ✅ All tools are documented\n")

# Summary stats
print("=" * 80)
print("AUDIT RESULTS:")
print("=" * 80)
print(f"  Tools with typos/errors in docs: {len(not_in_source)}")
print(f"  Deprecated tools in docs: {len(deprecated_in_docs)}")
print(f"  Undocumented tools: {len(not_documented)}")
print()

if not_in_source or deprecated_in_docs:
    print("❌ AUDIT FAILED: Found documentation issues")
else:
    print("✅ AUDIT PASSED: Documentation matches source")
