#!/usr/bin/env node
/**
 * Generate a ~3000-line TypeScript fixture file for testing large file editing strategies
 * 
 * Usage:
 *   node scripts/large-file/generate-fixture.mjs [--output path] [--sections N]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const sectionsIndex = args.indexOf('--sections');

const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : path.join(__dirname, '../../src/dev/large-file-edit-fixture.ts');
const sectionCount = sectionsIndex >= 0 ? parseInt(args[sectionsIndex + 1], 10) : 50;

// Template generation functions
function generateFileHeader() {
  return `/**
 * Large File Edit Fixture
 * 
 * This is a ~3000-line test fixture for validating large file editing strategies.
 * It contains multiple blocks with unique markers for precise replacement testing.
 * 
 * DO NOT use this file in production. It's for testing LFRP (Large File Refactor Protocol) only.
 * 
 * Generated: ${new Date().toISOString()}
 */

// >>> BLOCK:imports:START
interface HandlerContext {
  nodeId: string;
  timestamp: number;
  source: string;
  metadata?: Record<string, unknown>;
}

interface ProcessorResult {
  success: boolean;
  nodeId: string;
  duration: number;
  errors?: string[];
}

type EventType = 'mounted' | 'updated' | 'deleted' | 'focused' | 'blurred';
type Priority = 'high' | 'normal' | 'low';
// <<< BLOCK:imports:END

`;
}

function generateSection(id) {
  const paddedId = String(id).padStart(3, '0');
  return `
// >>> BLOCK:section-${paddedId}:START
/**
 * Handler Section ${paddedId}
 * This section processes events for a specific node type
 */
class EventHandler${paddedId} {
  private nodeId: string;
  private priority: Priority;
  private isActive: boolean;
  private eventQueue: HandlerContext[];
  private processedCount: number;

  constructor(nodeId: string, priority: Priority = 'normal') {
    this.nodeId = nodeId;
    this.priority = priority;
    this.isActive = true;
    this.eventQueue = [];
    this.processedCount = 0;
  }

  async handleEvent(context: HandlerContext): Promise<ProcessorResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    if (!this.isActive) {
      errors.push('Handler is not active');
      return {
        success: false,
        nodeId: this.nodeId,
        duration: Date.now() - startTime,
        errors,
      };
    }

    try {
      // Simulate some processing logic
      await this.processContext(context);
      this.processedCount++;

      return {
        success: true,
        nodeId: this.nodeId,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        nodeId: this.nodeId,
        duration: Date.now() - startTime,
        errors,
      };
    }
  }

  private async processContext(context: HandlerContext): Promise<void> {
    // Validate context
    if (!context.nodeId || !context.source) {
      throw new Error('Invalid context: missing required fields');
    }

    // Add to queue if high priority
    if (this.priority === 'high') {
      this.eventQueue.push(context);
    }

    // Simulate async operation
    await this.delay(Math.random() * 10);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      nodeId: this.nodeId,
      priority: this.priority,
      isActive: this.isActive,
      queueSize: this.eventQueue.length,
      processedCount: this.processedCount,
    };
  }

  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }

  clearQueue(): void {
    this.eventQueue = [];
  }
}
// <<< BLOCK:section-${paddedId}:END
`;
}

function generateRegistry() {
  return `
// >>> BLOCK:registry:START
/**
 * Event Handler Registry
 * Manages all event handlers and routes events to appropriate handlers
 */
class EventHandlerRegistry {
  private handlers: Map<string, EventHandler001>;
  private eventLog: HandlerContext[];
  private maxLogSize: number;

  constructor(maxLogSize: number = 1000) {
    this.handlers = new Map();
    this.eventLog = [];
    this.maxLogSize = maxLogSize;
  }

  registerHandler(nodeId: string, priority: Priority = 'normal'): void {
    if (this.handlers.has(nodeId)) {
      throw new Error(\`Handler already registered for node: \${nodeId}\`);
    }
    this.handlers.set(nodeId, new EventHandler001(nodeId, priority));
  }

  unregisterHandler(nodeId: string): boolean {
    return this.handlers.delete(nodeId);
  }

  async dispatchEvent(context: HandlerContext): Promise<ProcessorResult | null> {
    this.logEvent(context);

    const handler = this.handlers.get(context.nodeId);
    if (!handler) {
      return null;
    }

    return await handler.handleEvent(context);
  }

  private logEvent(context: HandlerContext): void {
    this.eventLog.push(context);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }
  }

  getHandlerStats(nodeId: string) {
    const handler = this.handlers.get(nodeId);
    return handler ? handler.getStats() : null;
  }

  getAllStats() {
    const stats: Record<string, ReturnType<EventHandler001['getStats']>> = {};
    for (const [nodeId, handler] of this.handlers.entries()) {
      stats[nodeId] = handler.getStats();
    }
    return stats;
  }

  getEventLog(): HandlerContext[] {
    return [...this.eventLog];
  }

  clearEventLog(): void {
    this.eventLog = [];
  }

  getHandlerCount(): number {
    return this.handlers.size;
  }
}
// <<< BLOCK:registry:END
`;
}

function generateExports() {
  return `
// >>> BLOCK:exports:START
/**
 * Public API exports
 */
export {
  EventHandler001,
  EventHandlerRegistry,
};

export type {
  HandlerContext,
  ProcessorResult,
  EventType,
  Priority,
};
// <<< BLOCK:exports:END
`;
}

// Generate the fixture file
function generateFixture() {
  let content = generateFileHeader();

  // Generate handler sections
  for (let i = 1; i <= sectionCount; i++) {
    content += generateSection(i);
  }

  content += generateRegistry();
  content += generateExports();

  return content;
}

// Main execution
try {
  const content = generateFixture();
  const lineCount = content.split('\n').length;

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write the fixture file
  fs.writeFileSync(outputPath, content, 'utf-8');

  console.log(`✅ Generated large file fixture:`);
  console.log(`   Path: ${outputPath}`);
  console.log(`   Lines: ${lineCount}`);
  console.log(`   Sections: ${sectionCount}`);
  console.log(`   Blocks: ${sectionCount + 3} (sections + imports + registry + exports)`);
} catch (error) {
  console.error('❌ Error generating fixture:', error);
  process.exit(1);
}
