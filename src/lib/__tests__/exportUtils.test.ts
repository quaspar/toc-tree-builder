/**
 * Unit tests for export utilities
 * 
 * This file tests the core functionality of the export utilities including:
 * - CSV generation with various tree structures
 * - Proper quoting and escaping of special characters
 * - Filename sanitization edge cases
 * - Unified node and edge data mapping
 */

import { Node, Edge } from 'reactflow';
import {
    exportToCSV,
    sanitizeFilename,
    generateExportFilename,
    ExportData,
    CSVExportOptions
} from '../exportUtils';

// Test data setup
const createMockNodes = (): Node[] => [
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
        data: { label: 'Improve Marketing, "Boost Sales"' }
    },
    {
        id: 'condition-1',
        type: 'condition',
        position: { x: 300, y: 250 },
        data: { label: 'Hire Sales Team\nWith Experience' }
    }
];

const createMockEdges = (): Edge[] => [
    {
        id: 'edge-1',
        source: 'goal-1',
        target: 'csf-1',
        type: 'smoothstep',
        label: 'Connection Label'
    },
    {
        id: 'edge-2',
        source: 'csf-1',
        target: 'condition-1',
        type: 'smoothstep'
    }
];

const createMockExportData = (): ExportData => ({
    treeName: 'Test Tree',
    exportDateTime: '2024-01-01T12:00:00.000Z',
    nodes: createMockNodes(),
    edges: createMockEdges()
});

// Test utilities
class TestRunner {
    private passed = 0;
    private failed = 0;
    private tests: Array<{ name: string; fn: () => void }> = [];

    test(name: string, fn: () => void): void {
        this.tests.push({ name, fn });
    }

    run(): void {
        console.log('🧪 Running Export Utils Tests...\n');

        for (const { name, fn } of this.tests) {
            try {
                fn();
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

    assertNotContains(text: string, substring: string, message?: string): void {
        if (text.includes(substring)) {
            throw new Error(`${message || 'Assertion failed'}: expected text to not contain "${substring}"`);
        }
    }
}

// Initialize test runner
const runner = new TestRunner();

// Test 1: CSV generation with basic tree structure
runner.test('CSV Generation - Basic Structure', () => {
    const mockData = createMockExportData();
    const csv = exportToCSV(mockData);
    
    // Check metadata section
    runner.assertContains(csv, '# Goal Tree Export', 'Should contain export header');
    runner.assertContains(csv, '# Tree Name: Test Tree', 'Should contain tree name');
    runner.assertContains(csv, '# Export Date-Time: 2024-01-01T12:00:00.000Z', 'Should contain export date');
    runner.assertContains(csv, '# Export Version: 1.0', 'Should contain version');
    
    // Check tree elements section
    runner.assertContains(csv, '# TREE ELEMENTS', 'Should contain tree elements header');
    runner.assertContains(csv, 'id,type,label,position_x,position_y,source,target', 'Should contain CSV headers');
    
    // Check node data
    runner.assertContains(csv, '"goal-1","goal","Achieve Sales Target","100","50","",""', 'Should contain goal node');
    runner.assertContains(csv, '"condition-1","condition","Hire Sales Team\nWith Experience","300","250","",""', 'Should contain condition node with preserved newline');
    
    // Check edge data
    runner.assertContains(csv, '"edge-1","smoothstep","Connection Label","","","goal-1","csf-1"', 'Should contain edge with label');
    runner.assertContains(csv, '"edge-2","smoothstep","","","","csf-1","condition-1"', 'Should contain edge without label');
});

// Test 2: CSV generation with empty tree
runner.test('CSV Generation - Empty Tree', () => {
    const emptyData: ExportData = {
        treeName: 'Empty Tree',
        exportDateTime: '2024-01-01T12:00:00.000Z',
        nodes: [],
        edges: []
    };
    
    const csv = exportToCSV(emptyData);
    
    // Should still have metadata and headers
    runner.assertContains(csv, '# Goal Tree Export', 'Should contain export header');
    runner.assertContains(csv, '# Tree Name: Empty Tree', 'Should contain tree name');
    runner.assertContains(csv, 'id,type,label,position_x,position_y,source,target', 'Should contain CSV headers');
    
    // Should not have any data rows beyond headers
    const lines = csv.split('\n').filter(line => line && !line.startsWith('#') && line !== 'id,type,label,position_x,position_y,source,target');
    const nonEmptyLines = lines.filter(line => line.trim());
    runner.assertEqual(nonEmptyLines.length, 0, 'Should have no data rows for empty tree');
});

// Test 3: CSV generation without headers
runner.test('CSV Generation - Without Headers', () => {
    const mockData = createMockExportData();
    const options: CSVExportOptions = { includeHeaders: false };
    const csv = exportToCSV(mockData, options);
    
    // Should have metadata but no column headers
    runner.assertContains(csv, '# Goal Tree Export', 'Should contain export header');
    runner.assertNotContains(csv, 'id,type,label,position_x,position_y,source,target', 'Should not contain CSV headers');
    
    // Should still have data rows
    runner.assertContains(csv, '"goal-1","goal","Achieve Sales Target","100","50","",""', 'Should contain goal node');
});

// Test 4: Special character escaping
runner.test('Special Character Escaping', () => {
    const specialNodes: Node[] = [
        {
            id: 'test-1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Text with "quotes" and commas, here' }
        },
        {
            id: 'test-2',
            type: 'csf',
            position: { x: 0, y: 0 },
            data: { label: 'Text with\nnewlines\nand\ttabs' }
        },
        {
            id: 'test-3',
            type: 'condition',
            position: { x: 0, y: 0 },
            data: { label: '' } // Empty label
        }
    ];
    
    const testData: ExportData = {
        treeName: 'Special Characters Test',
        exportDateTime: '2024-01-01T12:00:00.000Z',
        nodes: specialNodes,
        edges: []
    };
    
    const csv = exportToCSV(testData);
    
    // Check proper quote escaping
    runner.assertContains(csv, '"Text with ""quotes"" and commas, here"', 'Should escape quotes properly');
    
    // Check newlines and tabs are preserved within quotes
    runner.assertContains(csv, '"Text with\nnewlines\nand\ttabs"', 'Should preserve newlines and tabs within quotes');
    
    // Check empty label handling
    runner.assertContains(csv, '"test-3","condition","","0","0","",""', 'Should handle empty labels');
    
    // Test backslash escaping
    const backslashNode: Node[] = [
        {
            id: 'test-backslash',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Path\\to\\file and "quoted" text' }
        }
    ];
    
    const backslashData: ExportData = {
        treeName: 'Backslash Test',
        exportDateTime: '2024-01-01T12:00:00.000Z',
        nodes: backslashNode,
        edges: []
    };
    
    const backslashCSV = exportToCSV(backslashData);
    runner.assertContains(backslashCSV, '"Path\\\\to\\\\file and ""quoted"" text"', 'Should escape backslashes and quotes properly');
});

// Test 5: Filename sanitization edge cases
runner.test('Filename Sanitization', () => {
    // Test invalid characters removal
    runner.assertEqual(sanitizeFilename('file<>:"/\\|?*name'), 'filename', 'Should remove invalid characters');
    
    // Test space replacement
    runner.assertEqual(sanitizeFilename('file name with spaces'), 'file-name-with-spaces', 'Should replace spaces with hyphens');
    
    // Test trailing dots removal
    runner.assertEqual(sanitizeFilename('filename...'), 'filename', 'Should remove trailing dots');
    
    // Test empty string
    runner.assertEqual(sanitizeFilename(''), '', 'Should handle empty string');
    
    // Test whitespace trimming
    runner.assertEqual(sanitizeFilename('  filename  '), 'filename', 'Should trim whitespace properly');
    
    // Test complex case
    runner.assertEqual(sanitizeFilename('  My "Project" File: Version 2.0  '), 'My-Project-File-Version-2.0', 'Should handle complex filename');
    
    // Test leading/trailing hyphens removal
    runner.assertEqual(sanitizeFilename('  - filename -  '), 'filename', 'Should remove leading and trailing hyphens');
    
    // Test multiple spaces
    runner.assertEqual(sanitizeFilename('file   name   with   spaces'), 'file-name-with-spaces', 'Should handle multiple spaces');
});

// Test 6: Export filename generation
runner.test('Export Filename Generation', () => {
    // Test normal tree name - check format without exact timestamp
    const filename1 = generateExportFilename('My Goal Tree');
    runner.assertContains(filename1, 'My-Goal-Tree-', 'Should contain sanitized tree name');
    runner.assertContains(filename1, '.csv', 'Should have CSV extension');
    
    // Test empty tree name fallback
    const filename2 = generateExportFilename('');
    runner.assertContains(filename2, 'goal-tree-', 'Should use fallback name for empty string');
    runner.assertContains(filename2, '.csv', 'Should have CSV extension');
    
    // Test tree name with invalid characters
    const filename3 = generateExportFilename('Tree/Name<>:"|?*');
    runner.assertContains(filename3, 'TreeName-', 'Should sanitize invalid characters');
    runner.assertContains(filename3, '.csv', 'Should have CSV extension');
    runner.assertNotContains(filename3, '/', 'Should not contain invalid characters');
    runner.assertNotContains(filename3, '<', 'Should not contain invalid characters');
    runner.assertNotContains(filename3, '>', 'Should not contain invalid characters');
});

// Test 7: Unified node and edge data mapping
runner.test('Unified Data Mapping', () => {
    const mockData = createMockExportData();
    const csv = exportToCSV(mockData);
    const lines = csv.split('\n');
    
    // Find data lines (skip metadata and headers)
    const dataLines = lines.filter(line => 
        line && 
        !line.startsWith('#') && 
        line !== 'id,type,label,position_x,position_y,source,target'
    ).filter(line => line.trim()); // Remove empty lines
    
    // Note: The condition node has a newline in its label, which creates an additional physical line in CSV
    // This is correct CSV behavior - newlines within quoted fields are preserved
    runner.assertEqual(dataLines.length, 6, 'Should have 3 nodes + 2 edges = 5 logical rows (6 physical lines due to newline in condition node)');
    
    // Check node mapping (should have position, empty source/target)
    const goalNodeLine = dataLines.find(line => line.includes('"goal-1"'));
    runner.assert(!!goalNodeLine, 'Should find goal node line');
    runner.assertContains(goalNodeLine!, '"100","50","",""', 'Goal node should have position, empty source/target');
    
    // Check edge mapping (should have source/target, empty position)
    const edgeLine = dataLines.find(line => line.includes('"edge-1"'));
    runner.assert(!!edgeLine, 'Should find edge line');
    runner.assertContains(edgeLine!, '"","","goal-1","csf-1"', 'Edge should have source/target, empty position');
});

// Test 8: Node types and defaults
runner.test('Node Types and Defaults', () => {
    const nodesWithDefaults: Node[] = [
        {
            id: 'node-no-type',
            position: { x: 0, y: 0 },
            data: { label: 'No Type Node' }
            // No type specified
        },
        {
            id: 'node-no-label',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: {}
            // No label specified
        }
    ];
    
    const edgesWithDefaults: Edge[] = [
        {
            id: 'edge-no-type',
            source: 'node-no-type',
            target: 'node-no-label'
            // No type specified
        }
    ];
    
    const testData: ExportData = {
        treeName: 'Defaults Test',
        exportDateTime: '2024-01-01T12:00:00.000Z',
        nodes: nodesWithDefaults,
        edges: edgesWithDefaults
    };
    
    const csv = exportToCSV(testData);
    
    // Check default type for node
    runner.assertContains(csv, '"node-no-type","condition"', 'Should use default type "condition" for nodes');
    
    // Check empty label handling
    runner.assertContains(csv, '"node-no-label","goal","","0","0"', 'Should handle missing label');
    
    // Check default type for edge
    runner.assertContains(csv, '"edge-no-type","smoothstep"', 'Should use default type "smoothstep" for edges');
});

// Test 9: Quote escaping in CSF node (from mock data)
runner.test('Quote Escaping in Mock Data', () => {
    const mockData = createMockExportData();
    const csv = exportToCSV(mockData);
    
    // The CSF node has: 'Improve Marketing, "Boost Sales"'
    // Should be escaped as: "Improve Marketing, ""Boost Sales"""
    runner.assertContains(csv, '"csf-1","csf","Improve Marketing, ""Boost Sales""","200","150","",""', 'Should properly escape quotes in CSF node');
});

// Run all tests
if (typeof window === 'undefined') {
    // Only run tests in Node.js environment, not in browser
    runner.run();
}

export { runner };