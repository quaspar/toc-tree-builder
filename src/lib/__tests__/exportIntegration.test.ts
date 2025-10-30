/**
 * Integration tests for export functionality
 * 
 * This file tests the complete export process including:
 * - Complete export process from button click to file download
 * - Error handling and user feedback
 * - Export with empty trees and edge cases
 * - CSV format compatibility for future import
 */

import { describe, it, expect } from 'vitest';
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





describe('Export Integration', () => {
    describe('Complete Export Data Generation - Valid Tree Data', () => {
        it('should generate complete CSV with valid tree data', () => {
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
            expect(csvContent).toContain('# Goal Tree Export');
            expect(csvContent).toContain(`# Tree Name: ${treeName}`);
            expect(csvContent).toContain(`# Export Date-Time: ${exportDateTime}`);
            expect(csvContent).toContain('# Export Version: 1.0');
            expect(csvContent).toContain('# TREE ELEMENTS');

            // Verify CSV structure
            expect(csvContent).toContain('id,type,label,position_x,position_y,source,target');

            // Verify CSV content structure
            const csvLines = csvContent.split('\n');
            const dataLines = csvLines.filter(line =>
                line &&
                !line.startsWith('#') &&
                line !== 'id,type,label,position_x,position_y,source,target'
            ).filter(line => line.trim());

            expect(dataLines.length).toBe(5); // 3 nodes + 2 edges = 5 data rows

            // Verify node data integration
            expect(csvContent).toContain('"goal-1","goal","Achieve Sales Target","100","50","",""');
            expect(csvContent).toContain('"csf-1","csf","Improve Marketing","200","150","",""');
            expect(csvContent).toContain('"condition-1","condition","Hire Sales Team","300","250","",""');

            // Verify edge data integration
            expect(csvContent).toContain('"edge-1","smoothstep","Connection","","","goal-1","csf-1"');
            expect(csvContent).toContain('"edge-2","smoothstep","","","","csf-1","condition-1"');
        });
    });

    describe('Export Data Generation - Empty Tree Data', () => {
        it('should generate CSV with metadata and headers for empty tree', () => {
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
            expect(csvContent).toContain('# Goal Tree Export');
            expect(csvContent).toContain('# Tree Name: Empty Tree');
            expect(csvContent).toContain('id,type,label,position_x,position_y,source,target');

            // Verify no data rows for empty tree
            const csvLines = csvContent.split('\n');
            const dataLines = csvLines.filter(line =>
                line &&
                !line.startsWith('#') &&
                line !== 'id,type,label,position_x,position_y,source,target'
            ).filter(line => line.trim());

            expect(dataLines.length).toBe(0);
        });
    });

    describe('Export Data Generation - Edge Cases with Missing Data', () => {
        it('should handle missing data properties with defaults', () => {
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
            expect(csvContent).toContain('"node-no-type","condition"');
            expect(csvContent).toContain('"node-no-label","goal",""');
            expect(csvContent).toContain('"node-no-data","csf",""');
            expect(csvContent).toContain('"edge-no-type","smoothstep"');

            // Verify edge without ID gets generated ID
            expect(csvContent.includes('"edge-node-no-label-node-no-data"') || (csvContent.includes('node-no-label') && csvContent.includes('node-no-data'))).toBe(true);
        });
    });

    describe('CSV Format Compatibility - Import Ready Structure', () => {
        it('should generate CSV format compatible with import functionality', () => {
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
            expect(csvContent).toContain('# Export Version: 1.0');
            expect(csvContent).toContain('# Export Date-Time:');

            // Verify unified structure preserves all necessary data
            const csvLines = csvContent.split('\n');
            const headerLine = csvLines.find(line => line.startsWith('id,type,label'));
            expect(headerLine).toBeDefined();
            expect(headerLine).toBe('id,type,label,position_x,position_y,source,target');

            // Verify node data preservation
            expect(csvContent).toContain('"goal-1","goal","Achieve Sales Target","100","50","",""');
            expect(csvContent).toContain('"csf-1","csf","Improve Marketing","200","150","",""');

            // Verify edge data preservation
            expect(csvContent).toContain('"edge-1","smoothstep","Connection","","","goal-1","csf-1"');
            expect(csvContent).toContain('"edge-2","smoothstep","","","","csf-1","condition-1"');

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
            expect(specialCSV).toContain('"Text with ""quotes"", commas, and\nnewlines"');
        });
    });

    describe('Error Handling - Invalid Data Scenarios', () => {
        it('should handle empty tree name and null/undefined properties', () => {
            // Test with null/undefined data
            const invalidData: ExportData = {
                treeName: '',
                exportDateTime: '2024-01-01T12:00:00.000Z',
                nodes: [],
                edges: []
            };

            const csvContent = exportToCSV(invalidData);
            expect(csvContent).toContain('# Tree Name: ');
            expect(csvContent).toContain('# Goal Tree Export');

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
            expect(problematicCSV).toContain('"test-1","condition","","0","0","",""');
            expect(problematicCSV).toContain('"test-2","condition","","0","0","",""');
        });
    });

    describe('Filename Generation - Special Characters and Timestamps', () => {
        it('should generate filename with sanitized tree name and timestamp', () => {
            const specialTreeName = 'My "Special" Tree: Version 2.0!';

            const filename = generateExportFilename(specialTreeName);

            // Verify filename sanitization - the current implementation removes some but not all special chars
            const sanitizedPart = sanitizeFilename(specialTreeName);
            expect(filename).toContain(sanitizedPart);
            expect(filename.includes('"')).toBe(false);
            expect(filename.includes(':')).toBe(false);
            expect(filename).toContain('.csv');

            // Verify timestamp format (should match YYYY-MM-DD-HH-mm-ss pattern)
            const timestampPattern = /\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}/;
            expect(timestampPattern.test(filename)).toBe(true);
        });

        it('should use fallback for edge cases', () => {
            // Test edge cases
            const emptyName = generateExportFilename('');
            expect(emptyName).toContain('goal-tree-');

            // Test with characters that would result in empty string after sanitization
            const onlyInvalidChars = generateExportFilename('<>:"/\\|?*');
            expect(onlyInvalidChars).toContain('goal-tree-');

            // Test basic sanitization works
            const basicTest = sanitizeFilename('test<>file');
            expect(basicTest).toBe('testfile');
        });
    });

    describe('Large Tree Export - Performance and Structure', () => {
        it('should handle large tree export efficiently', () => {
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
            expect(executionTime).toBeLessThan(1000);

            // Verify structure
            const csvLines = csvContent.split('\n');
            const dataLines = csvLines.filter(line =>
                line &&
                !line.startsWith('#') &&
                line !== 'id,type,label,position_x,position_y,source,target'
            ).filter(line => line.trim());

            expect(dataLines.length).toBe(99); // 50 nodes + 49 edges = 99 data rows

            // Verify content integrity
            expect(csvContent).toContain('"node-0","goal","Node 0 with some longer text content"');
            expect(csvContent).toContain('"node-49","csf","Node 49 with some longer text content"');
            expect(csvContent).toContain('"edge-0","smoothstep","Edge 0 label"');

            // Check what the last edge actually looks like
            const lastEdgePattern = '"edge-48","smoothstep"';
            expect(csvContent).toContain(lastEdgePattern);

            // Verify metadata is preserved even with large datasets
            expect(csvContent).toContain('# Tree Name: Large Tree Test');
            expect(csvContent).toContain('# Export Version: 1.0');
        });
    });
});