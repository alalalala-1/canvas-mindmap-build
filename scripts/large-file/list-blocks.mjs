#!/usr/bin/env node
/**
 * List all blocks in a file with BLOCK markers
 * 
 * Usage:
 *   node scripts/large-file/list-blocks.mjs --file <path>
 *   node scripts/large-file/list-blocks.mjs --file src/dev/large-file-edit-fixture.ts
 */

import fs from 'fs';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');

if (fileIndex < 0 || !args[fileIndex + 1]) {
  console.error('❌ Usage: node list-blocks.mjs --file <path>');
  process.exit(1);
}

const filePath = args[fileIndex + 1];

// Block marker patterns
const START_PATTERN = /^\/\/\s*>>>\s*BLOCK:([^:]+):START\s*$/;
const END_PATTERN = /^\/\/\s*<<<\s*BLOCK:([^:]+):END\s*$/;

/**
 * Parse file and extract all blocks
 */
function listBlocks(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const blocks = [];
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for START marker
    const startMatch = line.match(START_PATTERN);
    if (startMatch) {
      if (currentBlock) {
        console.warn(`⚠️  Warning: Found START marker at line ${lineNum} while block "${currentBlock.name}" is still open (started at line ${currentBlock.startLine})`);
      }
      currentBlock = {
        name: startMatch[1],
        startLine: lineNum,
        endLine: null,
        lineCount: 0,
      };
      continue;
    }

    // Check for END marker
    const endMatch = line.match(END_PATTERN);
    if (endMatch) {
      const blockName = endMatch[1];
      if (!currentBlock) {
        console.warn(`⚠️  Warning: Found END marker for "${blockName}" at line ${lineNum} without matching START`);
        continue;
      }
      if (currentBlock.name !== blockName) {
        console.warn(`⚠️  Warning: END marker "${blockName}" at line ${lineNum} doesn't match START marker "${currentBlock.name}" at line ${currentBlock.startLine}`);
      }
      currentBlock.endLine = lineNum;
      currentBlock.lineCount = currentBlock.endLine - currentBlock.startLine + 1;
      blocks.push(currentBlock);
      currentBlock = null;
    }
  }

  if (currentBlock) {
    console.warn(`⚠️  Warning: Block "${currentBlock.name}" started at line ${currentBlock.startLine} but never closed`);
  }

  return blocks;
}

/**
 * Format blocks for display
 */
function formatBlocks(blocks, filePath) {
  console.log(`\n📄 File: ${filePath}`);
  console.log(`📦 Found ${blocks.length} block(s):\n`);

  if (blocks.length === 0) {
    console.log('   (no blocks found)');
    return;
  }

  // Calculate column widths
  const maxNameLength = Math.max(...blocks.map(b => b.name.length), 10);
  const maxLineNumLength = Math.max(...blocks.map(b => String(b.endLine).length), 5);

  // Print header
  console.log(`   ${'Block Name'.padEnd(maxNameLength)}  ${'Start'.padStart(maxLineNumLength)}  ${'End'.padStart(maxLineNumLength)}  Lines`);
  console.log(`   ${'-'.repeat(maxNameLength)}  ${'-'.repeat(maxLineNumLength)}  ${'-'.repeat(maxLineNumLength)}  -----`);

  // Print each block
  for (const block of blocks) {
    const name = block.name.padEnd(maxNameLength);
    const start = String(block.startLine).padStart(maxLineNumLength);
    const end = String(block.endLine).padStart(maxLineNumLength);
    const lines = String(block.lineCount).padStart(5);
    console.log(`   ${name}  ${start}  ${end}  ${lines}`);
  }

  // Print summary
  const totalLines = blocks.reduce((sum, b) => sum + b.lineCount, 0);
  console.log(`\n   Total lines in blocks: ${totalLines}`);
}

// Main execution
try {
  const blocks = listBlocks(filePath);
  formatBlocks(blocks, filePath);
  process.exit(0);
} catch (error) {
  console.error('❌ Error listing blocks:', error.message);
  process.exit(1);
}
