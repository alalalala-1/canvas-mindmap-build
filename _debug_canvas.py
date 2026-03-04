#!/usr/bin/env python3
import json, sys

with open("4-Canvas.canvas", "r") as f:
    data = json.load(f)

nodes = data.get("nodes", [])

# Find nodes without fromLink
no_link = []
with_link = []
for n in nodes:
    if n.get("type", "text") != "text":
        continue
    txt = n.get("text", "")
    color = n.get("color", "")
    if "fromLink:" in txt or color.startswith("fromLink:"):
        with_link.append(n)
    else:
        no_link.append(n)

print(f"Total text nodes: {len(no_link) + len(with_link)}")
print(f"With fromLink: {len(with_link)}")
print(f"Without fromLink: {len(no_link)}")

print("\n=== SAMPLES WITHOUT fromLink (first 8) ===")
for n in no_link[:8]:
    txt = n.get("text", "")
    nid = n.get("id", "?")
    # Show first 150 chars with repr to see hidden chars
    print(f"\nID={nid}, len={len(txt)}")
    print(f"  TEXT={repr(txt[:200])}")

print("\n=== SAMPLES WITH fromLink (first 3) ===")
for n in with_link[:3]:
    txt = n.get("text", "")
    nid = n.get("id", "?")
    print(f"\nID={nid}, len={len(txt)}")
    print(f"  TEXT={repr(txt[:300])}")

# Also check what source file paths are referenced
import re
file_paths = {}
for n in with_link:
    m = re.search(r'fromLink:(.*?)-->', n.get("text", ""))
    if m:
        try:
            link = json.loads(m.group(1).strip())
            fp = link.get("file", "")
            file_paths[fp] = file_paths.get(fp, 0) + 1
        except:
            pass
print(f"\n=== Source file references ===")
for fp, cnt in file_paths.items():
    print(f"  {fp}: {cnt} nodes")
