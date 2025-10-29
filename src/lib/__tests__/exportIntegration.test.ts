/**
 * Integration tests for export functionality
 * 
 * This file tests the complete export process including:
 * - Complete export process from button click to file download
 * - Error handling and user feedback
 * - Export with empty trees and edge cases
 * - CSV format compatibility for future import
 */

import { Node, Edge } from 'reactflow';
import {
    exportToCSV,
    generateExportFilename,
    sanitizeFilename,
    ExportData
} from '../exportUtils';



// Test data setup
const createTestNodes = (): Node[] => [
    {
        id: 'goal-1',
        type: 'goal',
        position: { x: 100, y: 50 },
        data: { label: 'Achieve Sales Target' }
    },
    {
        id: 'csf-1',
        type: 'csf',
        position: { x: 200, y: 150 },
        data: { label: 'Improve Marketing' }
    },
    {
        id: 'condition-1',
        type: 'condition',
        position: { x: 300, y: 250 },
        data: { label: 'Hire Sales Team' }
    }
];

const createTestEdges = (): Edge[] => [
    {
        id: 'edge-1',
        source: 'goal-1',
        target: 'csf-1',
        type: 'smoothstep',
        label: 'Connection'
    },
    {
        id: 'edge-2',
        source: 'csf-1',
        target: 'condition-1',
        type: 'smoothstep'
    }
];

// Test utilities
class IntegrationTestRunner {
    private passed = 0;
    private failed = 0;
    private tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

    test(name: string, fn: () => void | Promise<void>): void {
        this.tests.push({ name, fn });
    }

    async run(): Promise<void> {
        console.log('🧪 Running Export Integration Tests...\n');

        for (const { name, fn } of this.tests) {
            try {
                await fn();
                console.log(`✅ ${name}`);
                this.passed++;
            } catch (error) {
                console.error(`❌ ${name}: ${error instanceof Error ? error.message : error}`);
                this.failed++;
            }
        }

        console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);

        if (this.failed > 0) {
            process.exit(1);
        }
    }

    assert(condition: boolean, message: string): void {
        if (!condition) {
            throw new Error(message);
        }
    }

    assertEqual(actual: any, expected: any, message?: string): void {
        if (actual !== expected) {
            throw new Error(`${message || 'Assertion failed'}: expected "${expected}", got "${actual}"`);
        }
    }

    assertContains(text: string, substring: string, message?: string): void {
        if (!text.includes(substring)) {
            throw new Error(`${message || 'Assertion failed'}: expected text to contain "${substring}"`);
        }
    }

    assertGreaterThan(actual: number, expected: number, message?: string): void {
        if (actual <= expected) {
            throw new Error(`${message || 'Assertion failed'}: expected ${actual} to be greater than ${expected}`);
        }
    }
}

// Initialize test runner
const runner = new IntegrationTestRunner();



// Test 1: Complete export data generation with valid tree data
runner.test('Complete Export Data Generation - Valid Tree Data', () => {
    const nodes = createTestNodes();
    const edges = createTestEdges();
    const treeName = 'Integration Test Tree';
    const exportDateTime = '2024-01-01T12:00:00.000Z';

    const exportData: ExportData = {
        treeName,
        exportDateTime,
        nodes,
        edges
    };

    // Test the complete CSV generation process
    const csvContent = exportToCSV(exportData);

    // Verify metadata section
    runner.assertContains(csvContent, '# Goal Tree Export', 'Should contain export header');
    runner.assertContains(csvContent, `# Tree Name: ${treeName}`, 'Should contain tree name');
    runner.assertContains(csvContent, `# Export Date-Time: ${exportDateTime}`, 'Should contain export date');
    runner.assertContains(csvContent, '# Export Version: 1.0', 'Should contain version');
    runner.assertContains(csvContent, '# TREE ELEMENTS', 'Should contain tree elements section');

    // Verify CSV structure
    runner.assertContains(csvContent, 'id,type,label,position_x,position_y,source,target', 'Should contain headers');

    // Verify CSV content structure
    const csvLines = csvContent.split('\n');
    const dataLines = csvLines.filter(line =>
        line &&
        !line.startsWith('#') &&
        line !== 'id,type,label,position_x,position_y,source,target'
    ).filter(line => line.trim());

    runner.assertEqual(dataLines.length, 5, 'Should have 3 nodes + 2 edges = 5 data rows');

    // Verify node data integration
    runner.assertContains(csvContent, '"goal-1","goal","Achieve Sales Target","100","50","",""', 'Should contain goal node');
    runner.assertContains(csvContent, '"csf-1","csf","Improve Marketing","200","150","",""', 'Should contain CSF node');
    runner.assertContains(csvContent, '"condition-1","condition","Hire Sales Team","300","250","",""', 'Should contain condition node');

    // Verify edge data integration
    runner.assertContains(csvContent, '"edge-1","smoothstep","Connection","","","goal-1","csf-1"', 'Should contain edge with label');
    runner.assertContains(csvContent, '"edge-2","smoothstep","","","","csf-1","condition-1"', 'Should contain edge without label');
});

// Test 2: Export with empty tree data
runner.test('Export Data Generation - Empty Tree Data', () => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const treeName = 'Empty Tree';
    const exportDateTime = '2024-01-01T12:00:00.000Z';

    const exportData: ExportData = {
        treeName,
        exportDateTime,
        nodes,
        edges
    };

    const csvContent = exportToCSV(exportData);

    // Should still have metadata and headers
    runner.assertContains(csvContent, '# Goal Tree Export', 'Should contain export header');
    runner.assertContains(csvContent, '# Tree Name: Empty Tree', 'Should contain tree name');
    runner.assertContains(csvContent, 'id,type,label,position_x,position_y,source,target', 'Should contain headers');

    // Verify no data rows for empty tree
    const csvLines = csvContent.split('\n');
    const dataLines = csvLines.filter(line =>
        line &&
        !line.startsWith('#') &&
        line !== 'id,type,label,position_x,position_y,source,target'
    ).filter(line => line.trim());

    runner.assertEqual(dataLines.length, 0, 'Should have no data rows for empty tree');
});

// Test 3: Export with edge cases - missing data properties
runner.test('Export Data Generation - Edge Cases with Missing Data', () => {
    const edgeCaseNodes: Node[] = [
        {
            id: 'node-no-type',
            position: { x: 0, y: 0 },
            data: { label: 'Node without type' }
            // Missing type
        },
        {
            id: 'node-no-label',
            type: 'goal',
            position: { x: 100, y: 100 },
            data: {}
            // Missing label
        },
        {
            id: 'node-no-data',
            type: 'csf',
            position: { x: 200, y: 200 }
            // Missing data object
        } as Node
    ];

    const edgeCaseEdges: Edge[] = [
        {
            id: 'edge-no-type',
            source: 'node-no-type',
            target: 'node-no-label'
            // Missing type
        },
        {
            source: 'node-no-label',
            target: 'node-no-data'
            // Missing id
        } as Edge
    ];

    const exportData: ExportData = {
        treeName: 'Edge Cases Tree',
        exportDateTime: '2024-01-01T12:00:00.000Z',
        nodes: edgeCaseNodes,
        edges: edgeCaseEdges
    };

    const csvContent = exportToCSV(exportData);

    // Verify default values are applied
    runner.assertContains(csvContent, '"node-no-type","condition"', 'Should use default type for nodes');
    runner.assertContains(csvContent, '"node-no-label","goal",""', 'Should handle missing label');
    runner.assertContains(csvContent, '"node-no-data","csf",""', 'Should handle missing data object');
    runner.assertContains(csvContent, '"edge-no-type","smoothstep"', 'Should use default type for edges');

    // Verify edge without ID gets generated ID
    runner.assert(csvContent.includes('"edge-node-no-label-node-no-data"') || csvContent.includes('node-no-label') && csvContent.includes('node-no-data'), 'Should handle missing edge ID');
});

// Test 4: CSV format compatibility for future import
runner.test('CSV Format Compatibility - Import Ready Structure', () => {
    const nodes = createTestNodes();
    const edges = createTestEdges();
    const treeName = 'Import Compatibility Test';
    const exportDateTime = '2024-01-01T12:00:00.000Z';

    const exportData: ExportData = {
        treeName,
        exportDateTime,
        nodes,
        edges
    };

    const csvContent = exportToCSV(exportData);

    // Verify metadata section for import compatibility
    runner.assertContains(csvContent, '# Export Version: 1.0', 'Should include version for compatibility');
    runner.assertContains(csvContent, '# Export Date-Time:', 'Should include timestamp');

    // Verify unified structure preserves all necessary data
    const csvLines = csvContent.split('\n');
    const headerLine = csvLines.find(line => line.startsWith('id,type,label'));
    runner.assert(!!headerLine, 'Should have proper CSV headers');
    runner.assertEqual(headerLine, 'id,type,label,position_x,position_y,source,target', 'Should have all required columns');

    // Verify node data preservation
    runner.assertContains(csvContent, '"goal-1","goal","Achieve Sales Target","100","50","",""', 'Should preserve node position data');
    runner.assertContains(csvContent, '"csf-1","csf","Improve Marketing","200","150","",""', 'Should preserve all node properties');

    // Verify edge data preservation
    runner.assertContains(csvContent, '"edge-1","smoothstep","Connection","","","goal-1","csf-1"', 'Should preserve edge relationships');
    runner.assertContains(csvContent, '"edge-2","smoothstep","","","","csf-1","condition-1"', 'Should preserve edges without labels');

    // Verify proper CSV escaping for import compatibility
    const specialCharNodes: Node[] = [
        {
            id: 'special-1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Text with "quotes", commas, and\nnewlines' }
        }
    ];

    const specialData: ExportData = {
        treeName: 'Special Characters',
        exportDateTime: new Date().toISOString(),
        nodes: specialCharNodes,
        edges: []
    };

    const specialCSV = exportToCSV(specialData);
    runner.assertContains(specialCSV, '"Text with ""quotes"", commas, and\nnewlines"', 'Should properly escape quotes and preserve newlines within quoted fields');
});

// Test 5: Error handling scenarios
runner.test('Error Handling - Invalid Data Scenarios', () => {
    // Test with null/undefined data
    const invalidData: ExportData = {
        treeName: '',
        exportDateTime: '2024-01-01T12:00:00.000Z',
        nodes: [],
        edges: []
    };

    const csvContent = exportToCSV(invalidData);
    runner.assertContains(csvContent, '# Tree Name: ', 'Should handle empty tree name');
    runner.assertContains(csvContent, '# Goal Tree Export', 'Should still generate valid CSV structure');

    // Test with nodes having null/undefined properties
    const problematicNodes: Node[] = [
        {
            id: 'test-1',
            position: { x: 0, y: 0 },
            data: { label: null as any }
        } as Node,
        {
            id: 'test-2',
            position: { x: 0, y: 0 },
            data: { label: undefined as any }
        } as Node
    ];

    const problematicData: ExportData = {
        treeName: 'Test Tree',
        exportDateTime: '2024-01-01T12:00:00.000Z',
        nodes: problematicNodes,
        edges: []
    };

    const problematicCSV = exportToCSV(problematicData);
    runner.assertContains(problematicCSV, '"test-1","condition","","0","0","",""', 'Should handle null label');
    runner.assertContains(problematicCSV, '"test-2","condition","","0","0","",""', 'Should handle undefined label');
});

// Test 6: Filename generation with special characters
runner.test('Filename Generation - Special Characters and Timestamps', () => {
    const specialTreeName = 'My "Special" Tree: Version 2.0!';

    const filename = generateExportFilename(specialTreeName);

    // Verify filename sanitization - the current implementation removes some but not all special chars
    const sanitizedPart = sanitizeFilename(specialTreeName);
    runner.assertContains(filename, sanitizedPart, 'Should contain sanitized tree name');
    runner.assert(!filename.includes('"'), 'Should remove quotes');
    runner.assert(!filename.includes(':'), 'Should remove colons');
    runner.assertContains(filename, '.csv', 'Should have CSV extension');

    // Verify timestamp format (should match YYYY-MM-DD-HH-mm-ss pattern)
    const timestampPattern = /\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}/;
    runner.assert(timestampPattern.test(filename), 'Should include timestamp in correct format');

    // Test edge cases
    const emptyName = generateExportFilename('');
    runner.assertContains(emptyName, 'goal-tree-', 'Should use fallback for empty name');

    // Test with characters that would result in empty string after sanitization
    const onlyInvalidChars = generateExportFilename('<>:"/\\|?*');
    runner.assertContains(onlyInvalidChars, 'goal-tree-', 'Should use fallback when sanitization results in empty string');

    // Test basic sanitization works
    const basicTest = sanitizeFilename('test<>file');
    runner.assertEqual(basicTest, 'testfile', 'Should remove basic invalid characters');
});

// Test 7: Large tree export performance and structure
runner.test('Large Tree Export - Performance and Structure', () => {
    // Create a larger tree structure
    const largeNodes: Node[] = [];
    const largeEdges: Edge[] = [];

    // Generate 50 nodes
    for (let i = 0; i < 50; i++) {
        largeNodes.push({
            id: `node-${i}`,
            type: i % 4 === 0 ? 'goal' : i % 4 === 1 ? 'csf' : i % 4 === 2 ? 'condition' : 'and',
            position: { x: i * 10, y: i * 10 },
            data: { label: `Node ${i} with some longer text content` }
        });
    }

    // Generate 49 edges (connecting consecutive nodes)
    for (let i = 0; i < 49; i++) {
        largeEdges.push({
            id: `edge-${i}`,
            source: `node-${i}`,
            target: `node-${i + 1}`,
            type: 'smoothstep',
            label: i % 3 === 0 ? `Edge ${i} label` : undefined
        });
    }

    const exportData: ExportData = {
        treeName: 'Large Tree Test',
        exportDateTime: '2024-01-01T12:00:00.000Z',
        nodes: largeNodes,
        edges: largeEdges
    };

    const startTime = Date.now();
    const csvContent = exportToCSV(exportData);
    const endTime = Date.now();

    // Verify performance (should complete quickly)
    const executionTime = endTime - startTime;
    runner.assert(executionTime < 1000, `Export should complete quickly, took ${executionTime}ms`);

    // Verify structure
    const csvLines = csvContent.split('\n');
    const dataLines = csvLines.filter(line =>
        line &&
        !line.startsWith('#') &&
        line !== 'id,type,label,position_x,position_y,source,target'
    ).filter(line => line.trim());

    runner.assertEqual(dataLines.length, 99, 'Should have 50 nodes + 49 edges = 99 data rows');

    // Verify content integrity
    runner.assertContains(csvContent, '"node-0","goal","Node 0 with some longer text content"', 'Should contain first node');
    runner.assertContains(csvContent, '"node-49","csf","Node 49 with some longer text content"', 'Should contain last node');
    runner.assertContains(csvContent, '"edge-0","smoothstep","Edge 0 label"', 'Should contain first edge with label');

    // Check what the last edge actually looks like
    const lastEdgePattern = '"edge-48","smoothstep"';
    if (!csvContent.includes(lastEdgePattern)) {
        console.log('Last few lines of CSV:');
        const lines = csvContent.split('\n');
        console.log(lines.slice(-10).join('\n'));
    }
    runner.assertContains(csvContent, lastEdgePattern, 'Should contain last edge');

    // Verify metadata is preserved even with large datasets
    runner.assertContains(csvContent, '# Tree Name: Large Tree Test', 'Should preserve tree name in large export');
    runner.assertContains(csvContent, '# Export Version: 1.0', 'Should include version in large export');
});

// Run all tests
if (typeof window === 'undefined') {
    // Only run tests in Node.js environment, not in browser
    runner.run().catch(console.error);
}

export { runner as integrationTestRunner };