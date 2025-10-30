/**
 * Unit tests for export utilities
 * 
 * This file tests the core functionality of the export utilities including:
 * - CSV generation with various tree structures
 * - Proper quoting and escaping of special characters
 * - Filename sanitization edge cases
 * - Unified node and edge data mapping
 */

import { describe, it, expect } from 'vitest';
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

describe('Export Utils', () => {
    describe('CSV Generation - Basic Structure', () => {
        it('should generate CSV with proper metadata and structure', () => {
            const mockData = createMockExportData();
            const csv = exportToCSV(mockData);
            
            // Check metadata section
            expect(csv).toContain('# Goal Tree Export');
            expect(csv).toContain('# Tree Name: Test Tree');
            expect(csv).toContain('# Export Date-Time: 2024-01-01T12:00:00.000Z');
            expect(csv).toContain('# Export Version: 1.0');
            
            // Check tree elements section
            expect(csv).toContain('# TREE ELEMENTS');
            expect(csv).toContain('id,type,label,position_x,position_y,source,target');
            
            // Check node data
            expect(csv).toContain('"goal-1","goal","Achieve Sales Target","100","50","",""');
            expect(csv).toContain('"condition-1","condition","Hire Sales Team\nWith Experience","300","250","",""');
            
            // Check edge data
            expect(csv).toContain('"edge-1","smoothstep","Connection Label","","","goal-1","csf-1"');
            expect(csv).toContain('"edge-2","smoothstep","","","","csf-1","condition-1"');
        });
    });

    describe('CSV Generation - Empty Tree', () => {
        it('should generate CSV with metadata and headers for empty tree', () => {
            const emptyData: ExportData = {
                treeName: 'Empty Tree',
                exportDateTime: '2024-01-01T12:00:00.000Z',
                nodes: [],
                edges: []
            };
            
            const csv = exportToCSV(emptyData);
            
            // Should still have metadata and headers
            expect(csv).toContain('# Goal Tree Export');
            expect(csv).toContain('# Tree Name: Empty Tree');
            expect(csv).toContain('id,type,label,position_x,position_y,source,target');
            
            // Should not have any data rows beyond headers
            const lines = csv.split('\n').filter(line => line && !line.startsWith('#') && line !== 'id,type,label,position_x,position_y,source,target');
            const nonEmptyLines = lines.filter(line => line.trim());
            expect(nonEmptyLines.length).toBe(0);
        });
    });

    describe('CSV Generation - Without Headers', () => {
        it('should generate CSV without column headers when option is set', () => {
            const mockData = createMockExportData();
            const options: CSVExportOptions = { includeHeaders: false };
            const csv = exportToCSV(mockData, options);
            
            // Should have metadata but no column headers
            expect(csv).toContain('# Goal Tree Export');
            expect(csv).not.toContain('id,type,label,position_x,position_y,source,target');
            
            // Should still have data rows
            expect(csv).toContain('"goal-1","goal","Achieve Sales Target","100","50","",""');
        });
    });

    describe('Special Character Escaping', () => {
        it('should properly escape quotes, newlines, and special characters', () => {
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
            expect(csv).toContain('"Text with ""quotes"" and commas, here"');
            
            // Check newlines and tabs are preserved within quotes
            expect(csv).toContain('"Text with\nnewlines\nand\ttabs"');
            
            // Check empty label handling
            expect(csv).toContain('"test-3","condition","","0","0","",""');
        });

        it('should escape backslashes and quotes properly', () => {
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
            expect(backslashCSV).toContain('"Path\\\\to\\\\file and ""quoted"" text"');
        });
    });

    describe('Filename Sanitization', () => {
        it('should remove invalid characters', () => {
            expect(sanitizeFilename('file<>:"/\\|?*name')).toBe('filename');
        });

        it('should replace spaces with hyphens', () => {
            expect(sanitizeFilename('file name with spaces')).toBe('file-name-with-spaces');
        });

        it('should remove trailing dots', () => {
            expect(sanitizeFilename('filename...')).toBe('filename');
        });

        it('should handle empty string', () => {
            expect(sanitizeFilename('')).toBe('');
        });

        it('should trim whitespace properly', () => {
            expect(sanitizeFilename('  filename  ')).toBe('filename');
        });

        it('should handle complex filename', () => {
            expect(sanitizeFilename('  My "Project" File: Version 2.0  ')).toBe('My-Project-File-Version-2.0');
        });

        it('should remove leading and trailing hyphens', () => {
            expect(sanitizeFilename('  - filename -  ')).toBe('filename');
        });

        it('should handle multiple spaces', () => {
            expect(sanitizeFilename('file   name   with   spaces')).toBe('file-name-with-spaces');
        });
    });

    describe('Export Filename Generation', () => {
        it('should generate filename with sanitized tree name', () => {
            const filename1 = generateExportFilename('My Goal Tree');
            expect(filename1).toContain('My-Goal-Tree-');
            expect(filename1).toContain('.csv');
        });

        it('should use fallback name for empty string', () => {
            const filename2 = generateExportFilename('');
            expect(filename2).toContain('goal-tree-');
            expect(filename2).toContain('.csv');
        });

        it('should sanitize invalid characters', () => {
            const filename3 = generateExportFilename('Tree/Name<>:"|?*');
            expect(filename3).toContain('TreeName-');
            expect(filename3).toContain('.csv');
            expect(filename3).not.toContain('/');
            expect(filename3).not.toContain('<');
            expect(filename3).not.toContain('>');
        });
    });

    describe('Unified Data Mapping', () => {
        it('should map nodes and edges correctly in unified format', () => {
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
            expect(dataLines.length).toBe(6); // 3 nodes + 2 edges = 5 logical rows (6 physical lines due to newline in condition node)
            
            // Check node mapping (should have position, empty source/target)
            const goalNodeLine = dataLines.find(line => line.includes('"goal-1"'));
            expect(goalNodeLine).toBeDefined();
            expect(goalNodeLine!).toContain('"100","50","",""');
            
            // Check edge mapping (should have source/target, empty position)
            const edgeLine = dataLines.find(line => line.includes('"edge-1"'));
            expect(edgeLine).toBeDefined();
            expect(edgeLine!).toContain('"","","goal-1","csf-1"');
        });
    });

    describe('Node Types and Defaults', () => {
        it('should handle missing types and labels with defaults', () => {
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
            expect(csv).toContain('"node-no-type","condition"');
            
            // Check empty label handling
            expect(csv).toContain('"node-no-label","goal","","0","0"');
            
            // Check default type for edge
            expect(csv).toContain('"edge-no-type","smoothstep"');
        });
    });

    describe('Quote Escaping in Mock Data', () => {
        it('should properly escape quotes in CSF node', () => {
            const mockData = createMockExportData();
            const csv = exportToCSV(mockData);
            
            // The CSF node has: 'Improve Marketing, "Boost Sales"'
            // Should be escaped as: "Improve Marketing, ""Boost Sales"""
            expect(csv).toContain('"csf-1","csf","Improve Marketing, ""Boost Sales""","200","150","",""');
        });
    });
});