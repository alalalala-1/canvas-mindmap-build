# Canvas Mindmap Build - Floating Node Issue Analysis

## Current Problems
1. Red border (floating indicator) doesn't appear after edge deletion
2. Floating nodes are乱排 (randomly arranged) after arrange command
3. Floating nodes don't maintain their relationship with original parent

## Root Causes
1. **LayoutManager.arrangeCanvas()** incorrectly clears all floating node states before layout calculation
2. **Layout algorithm** doesn't properly handle floating subtrees as children of their original parents
3. **Edge deletion logic** marks nodes as floating but the arrange process removes this state

## User Requirements
- After edge deletion: node becomes floating with red border
- Floating node + all its children = floating subtree
- Floating subtree should be treated as child of original parent (no connection line, but participates in layout)
- During arrange: floating subtree participates in overall layout like regular nodes
- When dragging parent: floating subtree moves with parent (like regular children)
- When floating node gets connected to new parent: participates in new parent's layout
- When connected: red border is removed
- Proper flag management: add flag on edge deletion, remove flag on edge creation

## Solution Strategy
1. **Remove clearing of floating states** in LayoutManager.arrangeCanvas()
2. **Enhance layout algorithm** to treat floating subtrees as virtual children of original parents
3. **Ensure proper event handling** for edge creation/deletion to manage floating states
4. **Maintain floating node metadata** throughout the layout process