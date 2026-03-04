#!/usr/bin/env python3
"""Simulate the matchNodeToSource logic to find why matching fails."""
import json, re

def strip_invisible_markup(text):
    """Mirrors stripInvisibleMarkup from canvas-utils.ts"""
    if not text:
        return ""
    text = re.sub(r'<!--[\s\S]*?-->', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    return text

def normalize_for_match(text):
    """Mirrors normalizeForMatch from fromlink-repair-service.ts"""
    text = strip_invisible_markup(text or '')
    text = text.replace('\r', '')
    text = re.sub(r'^\s*>+\s?', '', text, flags=re.MULTILINE)  # strip > prefixes
    text = re.sub(r'^\s*(?:[-*+]\s+|\d+\.\s+)', '', text, flags=re.MULTILINE)  # strip list markers
    text = re.sub(r'\s+', ' ', text)  # collapse whitespace
    text = text.strip().lower()
    return text

# Load canvas data
with open("4-Canvas.canvas", "r") as f:
    canvas = json.load(f)

# Load source MD
with open("4-Optics.md", "r") as f:
    source_lines = f.read().split('\n')

# Build normalized line index
line_index = []
for raw in source_lines:
    line_index.append({"raw": raw, "normalized": normalize_for_match(raw)})

# Get target nodes (no fromLink)
nodes = canvas.get("nodes", [])
no_link = []
for n in nodes:
    if n.get("type", "text") != "text":
        continue
    txt = n.get("text", "")
    color = n.get("color", "")
    if "fromLink:" not in txt and not color.startswith("fromLink:"):
        no_link.append(n)

print(f"Target nodes: {len(no_link)}")
print(f"Source lines: {len(source_lines)}")
print()

# Try matching each node
matched = 0
unmatched = 0

for node in no_link:
    raw_text = re.sub(r'<!--[\s\S]*?-->', '', node.get("text", ""))
    normalized_node = normalize_for_match(raw_text)
    
    if not normalized_node:
        print(f"  SKIP empty: ID={node['id']}")
        continue
    
    # Split into lines for longest-line matching
    node_lines = [normalize_for_match(l) for l in raw_text.split('\n') if normalize_for_match(l)]
    longest_line = max(node_lines, key=len) if node_lines else ""
    
    # Pick key phrase
    clean = re.sub(r'\s+', ' ', normalized_node).strip()
    if len(clean) <= 32:
        key_phrase = clean
    else:
        key_phrase = clean[:32].strip()
    
    best_score = 0
    best_line = -1
    best_method = ""
    
    for i, entry in enumerate(line_index):
        norm = entry["normalized"]
        if not norm:
            continue
        
        score = 0
        method = ""
        
        if norm.find(normalized_node) >= 0:
            score = 100
            method = "L1:source-contains-node"
        elif normalized_node.find(norm) >= 0 and len(norm) >= 20:
            score = 86
            method = "L2:node-contains-source"
        elif longest_line and norm.find(longest_line) >= 0 and len(longest_line) >= 12:
            score = 80
            method = "L3:longest-line"
        elif key_phrase and norm.find(key_phrase) >= 0:
            score = 72
            method = "L4:key-phrase"
        
        if score > best_score:
            best_score = score
            best_line = i
            best_method = method
    
    nid = node.get("id", "?")
    short_text = node.get("text", "")[:60]
    
    if best_score > 0:
        matched += 1
        print(f"  MATCH: ID={nid} score={best_score} line={best_line} method={best_method}")
        print(f"    node_norm: {repr(normalized_node[:80])}")
        print(f"    src_norm:  {repr(line_index[best_line]['normalized'][:80])}")
    else:
        unmatched += 1
        print(f"  MISS:  ID={nid} text={repr(short_text)}")
        print(f"    node_norm: {repr(normalized_node[:100])}")
        print(f"    key_phrase: {repr(key_phrase[:50])}")
        # Show closest partial matches
        best_partial = 0
        best_partial_line = -1
        for i, entry in enumerate(line_index):
            norm = entry["normalized"]
            if not norm:
                continue
            # Check how many chars overlap
            overlap = 0
            for klen in range(min(len(normalized_node), len(norm)), 3, -1):
                if normalized_node[:klen] in norm or norm[:klen] in normalized_node:
                    overlap = klen
                    break
            if overlap > best_partial:
                best_partial = overlap
                best_partial_line = i
        if best_partial_line >= 0:
            print(f"    closest_partial: line={best_partial_line} overlap={best_partial}")
            print(f"    closest_norm: {repr(line_index[best_partial_line]['normalized'][:100])}")

print(f"\nRESULT: matched={matched}, unmatched={unmatched}")
