import { arrangeLayout, CanvasArrangerSettings } from './src/canvas/layout';

// 测试数据
const testNodes = new Map<string, any>([
    ['root', { id: 'root', x: 0, y: 0, width: 250, height: 80, text: 'Root Node' }],
    ['child1', { id: 'child1', x: 300, y: -50, width: 250, height: 80, text: 'Child 1' }],
    ['child2', { id: 'child2', x: 300, y: 50, width: 250, height: 80, text: 'Child 2 (Floating)' }],
    ['grandchild', { id: 'grandchild', x: 600, y: 50, width: 250, height: 80, text: 'Grandchild (Floating)' }]
]);

const testEdges = [
    { fromNode: 'root', toNode: 'child1' }
];

const testCanvasData = {
    nodes: [
        { id: 'root', type: 'text', text: 'Root Node', x: 0, y: 0, width: 250, height: 80 },
        { id: 'child1', type: 'text', text: 'Child 1', x: 300, y: -50, width: 250, height: 80 },
        { id: 'child2', type: 'text', text: 'Child 2 (Floating)', x: 300, y: 50, width: 250, height: 80 },
        { id: 'grandchild', type: 'text', text: 'Grandchild (Floating)', x: 600, y: 50, width: 250, height: 80 }
    ],
    edges: [
        { id: 'edge1', fromNode: 'root', toNode: 'child1' }
    ],
    metadata: {
        floatingNodes: {
            'child2': true,
            'grandchild': true
        }
    }
};

const settings: CanvasArrangerSettings = {
    horizontalSpacing: 200,
    verticalSpacing: 40,
    textNodeWidth: 250,
    textNodeMaxHeight: 800,
    imageNodeWidth: 400,
    imageNodeHeight: 400,
    formulaNodeWidth: 400,
    formulaNodeHeight: 80
};

console.log('Testing layout with floating nodes...');
const result = arrangeLayout(testNodes, testEdges, settings, testEdges, testNodes, testCanvasData);

console.log('Layout result:');
result.forEach((pos, nodeId) => {
    console.log(`  ${nodeId}: x=${pos.x}, y=${pos.y}`);
});

// 验证浮动子树是否保持正确的相对位置
const child2Pos = result.get('child2');
const grandchildPos = result.get('grandchild');

if (child2Pos && grandchildPos) {
    const expectedY = child2Pos.y + (child2Pos.height / 2) - (grandchildPos.height / 2);
    console.log(`\nFloating subtree validation:`);
    console.log(`Child2 Y: ${child2Pos.y}`);
    console.log(`Grandchild Y: ${grandchildPos.y}`);
    console.log(`Expected Grandchild Y: ${expectedY}`);
    console.log(`Is correctly aligned: ${Math.abs(grandchildPos.y - expectedY) < 1}`);
}