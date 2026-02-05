import { arrangeLayout, CanvasArrangerSettings } from './src/canvas/layout';

// 测试数据：模拟删除边后的场景
const testNodes = new Map<string, any>([
    ['1w5gj6f0', { id: '1w5gj6f0', x: 600, y: 0, width: 306, height: 400 }],
    ['uifktktz', { id: 'uifktktz', x: 0, y: 0, width: 400, height: 125 }],
    ['23n193mr', { id: '23n193mr', x: 1200, y: 63, width: 400, height: 80 }],
    ['j7d0dlue', { id: 'j7d0dlue', x: 1200, y: 183, width: 400, height: 154 }],
    ['meyjhvwg', { id: 'meyjhvwg', x: 1200, y: 1211, width: 400, height: 67 }],
    ['yeu7ch9s', { id: 'yeu7ch9s', x: 1200, y: 440, width: 400, height: 730 }],
    ['mkido7hn', { id: 'mkido7hn', x: 600, y: 440, width: 400, height: 96 }],
    ['9hz0tpea', { id: '9hz0tpea', x: 600, y: 1210, width: 400, height: 68 }]
]);

// 当前边（删除 uifktktz -> mkido7hn 后）
const currentEdges = [
    { fromNode: '1w5gj6f0', toNode: 'mkido7hn' },
    { fromNode: '1w5gj6f0', toNode: '9hz0tpea' },
    { fromNode: 'uifktktz', toNode: '23n193mr' },
    { fromNode: 'uifktktz', toNode: 'j7d0dlue' },
    { fromNode: 'uifktktz', toNode: 'meyjhvwg' },
    { fromNode: 'yeu7ch9s', toNode: 'meyjhvwg' }
];

// 原始边（包含已删除的边）
const originalEdges = [
    { fromNode: '1w5gj6f0', toNode: 'mkido7hn' },
    { fromNode: '1w5gj6f0', toNode: '9hz0tpea' },
    { fromNode: 'uifktktz', toNode: '23n193mr' },
    { fromNode: 'uifktktz', toNode: 'j7d0dlue' },
    { fromNode: 'uifktktz', toNode: 'meyjhvwg' },
    { fromNode: 'uifktktz', toNode: 'mkido7hn' }, // 已删除的边
    { fromNode: 'yeu7ch9s', toNode: 'meyjhvwg' }
];

// 模拟canvasData，包含浮动节点信息
const canvasData = {
    metadata: {
        floatingNodes: {
            'mkido7hn': { isFloating: true, originalParent: 'uifktktz' },
            '9hz0tpea': { isFloating: true, originalParent: 'mkido7hn' }
        }
    }
};

const settings: CanvasArrangerSettings = {
    horizontalSpacing: 200,
    verticalSpacing: 40,
    textNodeWidth: 400,
    textNodeMaxHeight: 800,
    imageNodeWidth: 400,
    imageNodeHeight: 400,
    formulaNodeWidth: 400,
    formulaNodeHeight: 80
};

console.log('开始测试浮动节点修复...');
const result = arrangeLayout(testNodes, currentEdges, settings, originalEdges, testNodes, canvasData);

console.log('布局结果:');
for (const [nodeId, position] of result.entries()) {
    console.log(`  节点 ${nodeId}: x=${position.x}, y=${position.y}`);
}

// 验证关键点：
// 1. mkido7hn 应该作为 uifktktz 的子节点（x应该在200-600范围内，y应该在合理位置）
// 2. 9hz0tpea 应该作为 mkido7hn 的子节点
// 3. 不应该出现在(0,0)位置

const mkido7hnPos = result.get('mkido7hn');
const uifktktzPos = result.get('uifktktz');

if (mkido7hnPos && uifktktzPos) {
    console.log('\n验证结果:');
    console.log(`uifktktz 位置: (${uifktktzPos.x}, ${uifktktzPos.y})`);
    console.log(`mkido7hn 位置: (${mkido7hnPos.x}, ${mkido7hnPos.y})`);
    
    // 检查 mkido7hn 是否在合理位置（不应该在0,0）
    if (mkido7hnPos.x === 0 && mkido7hnPos.y === 0) {
        console.log('❌ 失败: mkido7hn 仍在 (0,0) 位置');
    } else {
        console.log('✅ 成功: mkido7hn 不在 (0,0) 位置');
    }
    
    // 检查 mkido7hn 是否在 uifktktz 右侧（x坐标应该更大）
    if (mkido7hnPos.x > uifktktzPos.x) {
        console.log('✅ 成功: mkido7hn 在 uifktktz 右侧');
    } else {
        console.log('⚠️  注意: mkido7hn 可能不在 uifktktz 右侧');
    }
} else {
    console.log('❌ 错误: 未找到关键节点位置');
}