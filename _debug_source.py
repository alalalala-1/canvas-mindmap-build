#!/usr/bin/env python3
import os, glob

# Find the source MD file in the vault
# The canvas references "4-Optics/4-Optics.md"
# Let's check if it exists in the project or find it

candidates = []
for root, dirs, files in os.walk("."):
    for f in files:
        if f == "4-Optics.md":
            candidates.append(os.path.join(root, f))

print("=== Found 4-Optics.md candidates ===")
for c in candidates:
    size = os.path.getsize(c)
    print(f"  {c} ({size} bytes)")

if not candidates:
    print("No 4-Optics.md found in project dir")
    # Check vault location
    vault_base = os.path.expanduser("~")
    print(f"\nSearching broader... (not doing full search)")
else:
    # Read the first candidate and show relevant lines
    with open(candidates[0], "r") as f:
        lines = f.readlines()
    
    print(f"\nTotal lines: {len(lines)}")
    
    # Show lines around where nodes should be
    # The existing fromLinks reference lines like 288, 290
    # Let's find where our target texts appear
    targets = [
        "4 光的传播",
        "4.1 简介",
        "三大宏观现象",
        "透射 (Transmission)",
        "反射 (Reflection)",
        "折射 (Refraction)",
        "三大理论描述工具",
        "几何光学与波动光学",
    ]
    
    print("\n=== Searching for target texts in source ===")
    for t in targets:
        found = False
        for i, line in enumerate(lines):
            if t in line:
                print(f"\n  Target: '{t}'")
                print(f"  Found at line {i}: {repr(line.rstrip()[:200])}")
                found = True
                break
        if not found:
            print(f"\n  Target: '{t}' -- NOT FOUND")
    
    # Show first 20 lines to understand structure
    print("\n=== First 30 lines of source ===")
    for i, line in enumerate(lines[:30]):
        print(f"  L{i:4d}: {repr(line.rstrip()[:150])}")
    
    # Show lines 280-295 (where existing fromLinks point)
    print(f"\n=== Lines 280-300 (existing fromLink area) ===")
    for i in range(min(280, len(lines)), min(300, len(lines))):
        print(f"  L{i:4d}: {repr(lines[i].rstrip()[:200])}")
