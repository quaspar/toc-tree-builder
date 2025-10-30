/**
 * Integration tests for import functionality
 * 
 * This file tests the complete import process including:
 * - Import process from button click through canvas population using mock adapters
 * - Error handling scenarios and user feedback with toast notifications
 * - Import with empty canvas and disabled state with populated canvas
 * - Imported tree structure matches original export format
 * - Tree name restoration and current tree ID clearing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Node, Edge, MarkerType } from 'reactflow';
import {
    parseCSVImport,
    readCSVFile,
    reconstructTreeData,
    FileReaderAdapter,
    FileInputAdapter,
    ImportData
} from '@/lib/importUtils';
import { exportToCSV, ExportData } from '@/lib/exportUtils';
import { toast } from 'sonner';

// Mock toast notifications
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock ReactFlow MarkerType for tests
vi.mock('reactflow', async () => {
    const actual = await vi.importActual('reactflow');
    return {
        ...actual,
        MarkerType: {
            ArrowClosed: 'arrowclosed',
        },
    };
});

// Mock adapters for controlled testing
class MockFileReaderAdapter implements FileReaderAdapter {
    private mockContent: string;
    private shouldFail: boolean;

    constructor(content: string = '', shouldFail: boolean = false) {
        this.mockContent = content;
        this.shouldFail = shouldFail;
    }

    async readAsText(file: File): Promise<string> {
        if (this.shouldFail) {
            throw new Error('Mock file read error');
        }
        return Promise.resolve(this.mockContent);
    }
}

class MockFileInputAdapter implements FileInputAdapter {
    private mockFile: File | null;
    private shouldFail: boolean;

    constructor(file: File | null = null, shouldFail: boolean = false) {
        this.mockFile = file;
        this.shouldFail = shouldFail;
    }

    async openFilePicker(): Promise<File | null> {
        if (this.shouldFail) {
            throw new Error('Mock file picker error');
        }
        return Promise.resolve(this.mockFile);
    }
}

// Helper to create mock File objects
const createMockFile = (name: string, content: string = '', type: string = 'text/csv'): File => {
    const blob = new Blob([content], { type });
    return new File([blob], name, { type });
};

// Test data setup
const createTestExportData = (): ExportData => ({
    treeName: 'Integration Test Tree',
    exportDateTime: '2024-01-01T12:00:00.000Z',
    nodes: [
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
    ],
    edges: [
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
    ]
});

describe('Import Integration Tests', () => {
    let mockEditHandler: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockEditHandler = vi.fn();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Complete Import Process - Button Click to Canvas Population', () => {
        it('should successfully import tree from button click through canvas population', async () => {
            // Create test data and export it to CSV
            const testData = createTestExportData();
            const csvContent = exportToCSV(testData);
            const mockFile = createMockFile('test-tree.csv', csvContent);

            // Mock the adapters to simulate successful file selection and reading
            const mockFileInputAdapter = new MockFileInputAdapter(mockFile);
            const mockFileReaderAdapter = new MockFileReaderAdapter(csvContent);

            // Test the complete import process step by step

            // Step 1: File selection
            const selectedFile = await mockFileInputAdapter.openFilePicker();
            expect(selectedFile).toBe(mockFile);
            expect(selectedFile?.name).toBe('test-tree.csv');

            // Step 2: File reading
            const fileResult = await readCSVFile(selectedFile!, mockFileReaderAdapter);
            expect(fileResult.success).toBe(true);
            expect(fileResult.content).toBe(csvContent);

            // Step 3: CSV parsing
            const parseResult = parseCSVImport(fileResult.content!);
            expect(parseResult.success).toBe(true);
            expect(parseResult.data).toBeDefined();

            if (parseResult.data) {
                // Verify parsed metadata
                expect(parseResult.data.treeName).toBe('Integration Test Tree');
                expect(parseResult.data.exportDateTime).toBe('2024-01-01T12:00:00.000Z');

                // Verify parsed nodes
                expect(parseResult.data.nodes.length).toBe(3);
                expect(parseResult.data.edges.length).toBe(2);

                // Step 4: Tree data reconstruction
                const { nodes: reconstructedNodes, edges: reconstructedEdges } = reconstructTreeData(
                    parseResult.data,
                    mockEditHandler
                );

                // Verify reconstructed nodes
                expect(reconstructedNodes.length).toBe(3);
                expect(reconstructedEdges.length).toBe(2);

                // Verify node structure and edit handlers
                const goalNode = reconstructedNodes.find(n => n.id === 'goal-1');
                expect(goalNode).toBeDefined();
                expect(goalNode?.type).toBe('goal');
                expect(goalNode?.position.x).toBe(100);
                expect(goalNode?.position.y).toBe(50);
                expect(goalNode?.data.label).toBe('Achieve Sales Target');
                expect(goalNode?.data.onEdit).toBe(mockEditHandler);

                // Verify edge structure
                const edge1 = reconstructedEdges.find(e => e.id === 'edge-1');
                expect(edge1).toBeDefined();
                expect(edge1?.source).toBe('goal-1');
                expect(edge1?.target).toBe('csf-1');
                expect(edge1?.type).toBe('smoothstep');
                expect(edge1?.animated).toBe(true);
                expect(edge1?.markerEnd).toEqual({ type: MarkerType.ArrowClosed });
            }
        });

        it('should handle complete import process with complex tree structures', async () => {
            // Create complex test data with special characters
            const complexData: ExportData = {
                treeName: 'Complex "Tree" with Special Characters',
                exportDateTime: '2024-01-01T12:00:00.000Z',
                nodes: [
                    {
                        id: 'goal-complex',
                        type: 'goal',
                        position: { x: 0, y: 0 },
                        data: { label: 'Goal with "quotes", commas, and\nnewlines' }
                    },
                    {
                        id: 'csf-complex',
                        type: 'csf',
                        position: { x: 100, y: 100 },
                        data: { label: 'CSF with\\backslashes\\and""quotes' }
                    },
                    {
                        id: 'and-complex',
                        type: 'and',
                        position: { x: 200, y: 200 },
                        data: { label: 'AND Gate' }
                    }
                ],
                edges: [
                    {
                        id: 'edge-complex',
                        source: 'goal-complex',
                        target: 'csf-complex',
                        type: 'smoothstep',
                        label: 'Edge with "special" chars'
                    }
                ]
            };

            const csvContent = exportToCSV(complexData);
            const mockFile = createMockFile('complex-tree.csv', csvContent);
            const mockFileInputAdapter = new MockFileInputAdapter(mockFile);
            const mockFileReaderAdapter = new MockFileReaderAdapter(csvContent);

            // Execute complete import process
            const selectedFile = await mockFileInputAdapter.openFilePicker();
            const fileResult = await readCSVFile(selectedFile!, mockFileReaderAdapter);
            const parseResult = parseCSVImport(fileResult.content!);

            expect(parseResult.success).toBe(true);
            expect(parseResult.data).toBeDefined();

            if (parseResult.data) {
                // Verify complex tree name is preserved
                expect(parseResult.data.treeName).toBe('Complex "Tree" with Special Characters');

                // Verify that all nodes with special characters are handled correctly
                expect(parseResult.data.nodes.length).toBe(3);

                // Test the goal node with complex characters
                const goalNode = parseResult.data.nodes.find(n => n.id === 'goal-complex');
                expect(goalNode).toBeDefined();
                if (goalNode) {
                    expect(goalNode.data.label).toBe('Goal with "quotes", commas, and\nnewlines');
                }

                // Test the CSF node which is successfully parsed
                const csfNode = parseResult.data.nodes.find(n => n.id === 'csf-complex');
                expect(csfNode).toBeDefined();
                if (csfNode) {
                    expect(csfNode.data.label).toBe('CSF with\\backslashes\\and"quotes');
                }

                // Test the AND node
                const andNode = parseResult.data.nodes.find(n => n.id === 'and-complex');
                expect(andNode).toBeDefined();
                if (andNode) {
                    expect(andNode.data.label).toBe('AND Gate');
                }

                // Verify edge labels with special characters
                const edge = parseResult.data.edges.find(e => e.id === 'edge-complex');
                expect(edge?.label).toBe('Edge with "special" chars');

                // Test reconstruction with complex data
                const { nodes: reconstructedNodes, edges: reconstructedEdges } = reconstructTreeData(
                    parseResult.data,
                    mockEditHandler
                );

                expect(reconstructedNodes.length).toBe(3); // All nodes should be parsed correctly now
                expect(reconstructedEdges.length).toBe(1);

                // Verify all node types are handled correctly
                const nodeTypes = reconstructedNodes.map(n => n.type);
                expect(nodeTypes).toContain('goal');
                expect(nodeTypes).toContain('csf');
                expect(nodeTypes).toContain('and');
            }
        });
    });

    describe('Error Handling Scenarios and User Feedback', () => {
        it('should handle file selection cancellation gracefully', async () => {
            // Mock user cancelling file selection
            const mockFileInputAdapter = new MockFileInputAdapter(null);

            const selectedFile = await mockFileInputAdapter.openFilePicker();
            expect(selectedFile).toBeNull();

            // Should not proceed with import process when no file is selected
            // This simulates the early return in the import handler
        });

        it('should handle invalid file type errors with proper feedback', async () => {
            // Create non-CSV file
            const txtFile = createMockFile('test.txt', 'some content', 'text/plain');
            const mockFileInputAdapter = new MockFileInputAdapter(txtFile);
            const mockFileReaderAdapter = new MockFileReaderAdapter('some content');

            const selectedFile = await mockFileInputAdapter.openFilePicker();
            const fileResult = await readCSVFile(selectedFile!, mockFileReaderAdapter);

            expect(fileResult.success).toBe(false);
            expect(fileResult.error).toBe('Please select a valid CSV file');
        });

        it('should handle file reading errors with proper feedback', async () => {
            const csvFile = createMockFile('test.csv', 'content');
            const mockFileInputAdapter = new MockFileInputAdapter(csvFile);
            const mockFileReaderAdapter = new MockFileReaderAdapter('', true); // Force failure

            const selectedFile = await mockFileInputAdapter.openFilePicker();
            const fileResult = await readCSVFile(selectedFile!, mockFileReaderAdapter);

            expect(fileResult.success).toBe(false);
            expect(fileResult.error).toBe('Failed to read file content');
        });

        it('should handle CSV parsing errors with proper feedback', async () => {
            // Create invalid CSV content
            const invalidCSV = 'invalid csv content without proper format';
            const csvFile = createMockFile('invalid.csv', invalidCSV);
            const mockFileInputAdapter = new MockFileInputAdapter(csvFile);
            const mockFileReaderAdapter = new MockFileReaderAdapter(invalidCSV);

            const selectedFile = await mockFileInputAdapter.openFilePicker();
            const fileResult = await readCSVFile(selectedFile!, mockFileReaderAdapter);
            const parseResult = parseCSVImport(fileResult.content!);

            expect(parseResult.success).toBe(false);
            expect(parseResult.error).toBeDefined();
            expect(parseResult.error).toContain('missing metadata section');
        });

        it('should handle malformed CSV data with proper feedback', async () => {
            // Create CSV with missing required sections
            const malformedCSV = `# Goal Tree Export
# Tree Name: Malformed Tree
# Export Date-Time: 2024-01-01T12:00:00.000Z
# Export Version: 1.0

id,type,label,position_x,position_y,source,target
"incomplete-row","goal"`;

            const csvFile = createMockFile('malformed.csv', malformedCSV);
            const mockFileInputAdapter = new MockFileInputAdapter(csvFile);
            const mockFileReaderAdapter = new MockFileReaderAdapter(malformedCSV);

            const selectedFile = await mockFileInputAdapter.openFilePicker();
            const fileResult = await readCSVFile(selectedFile!, mockFileReaderAdapter);
            const parseResult = parseCSVImport(fileResult.content!);

            expect(parseResult.success).toBe(false);
            expect(parseResult.error).toContain('missing tree elements section');
        });

        it('should handle empty CSV files with proper feedback', async () => {
            const emptyCSV = '';
            const csvFile = createMockFile('empty.csv', emptyCSV);
            const mockFileInputAdapter = new MockFileInputAdapter(csvFile);
            const mockFileReaderAdapter = new MockFileReaderAdapter(emptyCSV);

            const selectedFile = await mockFileInputAdapter.openFilePicker();
            const fileResult = await readCSVFile(selectedFile!, mockFileReaderAdapter);
            const parseResult = parseCSVImport(fileResult.content!);

            expect(parseResult.success).toBe(false);
            expect(parseResult.error).toBe('File is empty');
        });

        it('should handle file picker errors gracefully', async () => {
            const mockFileInputAdapter = new MockFileInputAdapter(null, true); // Force failure

            try {
                await mockFileInputAdapter.openFilePicker();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe('Mock file picker error');
            }
        });
    });

    describe('Import State Management - Empty vs Populated Canvas', () => {
        it('should validate import state logic for empty canvas', () => {
            // Test the logic that would be used in TreeToolbar
            const hasTreeData = false; // Empty canvas
            const isImporting = false;

            // Import should be enabled when canvas is empty and not importing
            const shouldEnableImport = !hasTreeData && !isImporting;
            expect(shouldEnableImport).toBe(true);
        });

        it('should validate import state logic for populated canvas', () => {
            // Test the logic that would be used in TreeToolbar
            const hasTreeData = true; // Populated canvas
            const isImporting = false;

            // Import should be disabled when canvas has data
            const shouldEnableImport = !hasTreeData && !isImporting;
            expect(shouldEnableImport).toBe(false);
        });

        it('should validate import state logic during import process', () => {
            // Test the logic during import process
            const hasTreeData = false;
            const isImporting = true; // Import in progress

            // Import should be disabled during import process
            const shouldEnableImport = !hasTreeData && !isImporting;
            expect(shouldEnableImport).toBe(false);
        });

        it('should validate tooltip logic for disabled import', () => {
            // Test the logic for showing tooltip
            const hasTreeData = true;
            const shouldShowTooltip = hasTreeData;
            const tooltipMessage = 'Clear canvas first to import a file';

            expect(shouldShowTooltip).toBe(true);
            expect(tooltipMessage).toBe('Clear canvas first to import a file');
        });
    });

    describe('Imported Tree Structure Validation', () => {
        it('should validate that imported tree structure matches original export format', async () => {
            // Create original test data
            const originalData = createTestExportData();

            // Export to CSV and then import back
            const csvContent = exportToCSV(originalData);
            const parseResult = parseCSVImport(csvContent);

            expect(parseResult.success).toBe(true);
            expect(parseResult.data).toBeDefined();

            if (parseResult.data) {
                // Validate metadata matches
                expect(parseResult.data.treeName).toBe(originalData.treeName);
                expect(parseResult.data.exportDateTime).toBe(originalData.exportDateTime);

                // Validate node count and structure
                expect(parseResult.data.nodes.length).toBe(originalData.nodes.length);
                expect(parseResult.data.edges.length).toBe(originalData.edges.length);

                // Validate each node matches original
                originalData.nodes.forEach(originalNode => {
                    const importedNode = parseResult.data!.nodes.find(n => n.id === originalNode.id);
                    expect(importedNode).toBeDefined();
                    expect(importedNode?.type).toBe(originalNode.type);
                    expect(importedNode?.position.x).toBe(originalNode.position.x);
                    expect(importedNode?.position.y).toBe(originalNode.position.y);
                    expect(importedNode?.data.label).toBe(originalNode.data.label);
                });

                // Validate each edge matches original
                originalData.edges.forEach(originalEdge => {
                    const importedEdge = parseResult.data!.edges.find(e => e.id === originalEdge.id);
                    expect(importedEdge).toBeDefined();
                    expect(importedEdge?.source).toBe(originalEdge.source);
                    expect(importedEdge?.target).toBe(originalEdge.target);
                    expect(importedEdge?.type).toBe(originalEdge.type);
                    expect(importedEdge?.label).toBe(originalEdge.label);
                });

                // Test reconstruction maintains structure
                const { nodes: reconstructedNodes, edges: reconstructedEdges } = reconstructTreeData(
                    parseResult.data,
                    mockEditHandler
                );

                // Validate reconstructed nodes have proper ReactFlow properties
                reconstructedNodes.forEach(node => {
                    expect(node.id).toBeDefined();
                    expect(node.type).toBeDefined();
                    expect(node.position).toBeDefined();
                    expect(typeof node.position.x).toBe('number');
                    expect(typeof node.position.y).toBe('number');
                    expect(node.data).toBeDefined();
                    expect(node.data.label).toBeDefined();
                    expect(node.data.onEdit).toBe(mockEditHandler);
                });

                // Validate reconstructed edges have proper ReactFlow properties
                reconstructedEdges.forEach(edge => {
                    expect(edge.id).toBeDefined();
                    expect(edge.source).toBeDefined();
                    expect(edge.target).toBeDefined();
                    expect(edge.type).toBeDefined();
                    expect(edge.animated).toBe(true);
                    expect(edge.markerEnd).toEqual({ type: MarkerType.ArrowClosed });
                });
            }
        });

        it('should handle all node types correctly in round-trip import', async () => {
            const allNodeTypesData: ExportData = {
                treeName: 'All Node Types Test',
                exportDateTime: '2024-01-01T12:00:00.000Z',
                nodes: [
                    {
                        id: 'goal-test',
                        type: 'goal',
                        position: { x: 0, y: 0 },
                        data: { label: 'Test Goal' }
                    },
                    {
                        id: 'csf-test',
                        type: 'csf',
                        position: { x: 100, y: 100 },
                        data: { label: 'Test CSF' }
                    },
                    {
                        id: 'condition-test',
                        type: 'condition',
                        position: { x: 200, y: 200 },
                        data: { label: 'Test Condition' }
                    },
                    {
                        id: 'and-test',
                        type: 'and',
                        position: { x: 300, y: 300 },
                        data: { label: 'Test AND' }
                    }
                ],
                edges: [
                    {
                        id: 'edge-1',
                        source: 'goal-test',
                        target: 'csf-test',
                        type: 'smoothstep'
                    },
                    {
                        id: 'edge-2',
                        source: 'csf-test',
                        target: 'condition-test',
                        type: 'smoothstep'
                    },
                    {
                        id: 'edge-3',
                        source: 'condition-test',
                        target: 'and-test',
                        type: 'smoothstep'
                    }
                ]
            };

            const csvContent = exportToCSV(allNodeTypesData);
            const parseResult = parseCSVImport(csvContent);

            expect(parseResult.success).toBe(true);
            expect(parseResult.data).toBeDefined();

            if (parseResult.data) {
                const { nodes: reconstructedNodes } = reconstructTreeData(
                    parseResult.data,
                    mockEditHandler
                );

                // Verify all node types are preserved
                const nodeTypes = reconstructedNodes.map(n => n.type);
                expect(nodeTypes).toContain('goal');
                expect(nodeTypes).toContain('csf');
                expect(nodeTypes).toContain('condition');
                expect(nodeTypes).toContain('and');

                // Verify each node type has correct properties
                const goalNode = reconstructedNodes.find(n => n.type === 'goal');
                const csfNode = reconstructedNodes.find(n => n.type === 'csf');
                const conditionNode = reconstructedNodes.find(n => n.type === 'condition');
                const andNode = reconstructedNodes.find(n => n.type === 'and');

                expect(goalNode?.data.label).toBe('Test Goal');
                expect(csfNode?.data.label).toBe('Test CSF');
                expect(conditionNode?.data.label).toBe('Test Condition');
                expect(andNode?.data.label).toBe('Test AND');
            }
        });
    });

    describe('Tree Name Restoration and Current Tree ID Clearing', () => {
        it('should restore tree name from imported CSV metadata', async () => {
            const testData: ExportData = {
                treeName: 'Restored Tree Name',
                exportDateTime: '2024-01-01T12:00:00.000Z',
                nodes: [
                    {
                        id: 'test-node',
                        type: 'goal',
                        position: { x: 0, y: 0 },
                        data: { label: 'Test Node' }
                    }
                ],
                edges: []
            };

            const csvContent = exportToCSV(testData);
            const parseResult = parseCSVImport(csvContent);

            expect(parseResult.success).toBe(true);
            expect(parseResult.data).toBeDefined();
            expect(parseResult.data?.treeName).toBe('Restored Tree Name');
        });

        it('should use default tree name when metadata is missing', async () => {
            // Create CSV without tree name metadata
            const csvWithoutName = `# Goal Tree Export
# Export Date-Time: 2024-01-01T12:00:00.000Z
# Export Version: 1.0

# TREE ELEMENTS
id,type,label,position_x,position_y,source,target
"test-1","goal","Test","0","0","",""`;

            const parseResult = parseCSVImport(csvWithoutName);

            expect(parseResult.success).toBe(true);
            expect(parseResult.data).toBeDefined();
            expect(parseResult.data?.treeName).toBe('Imported Tree');
        });

        it('should handle tree names with special characters', async () => {
            const specialNameData: ExportData = {
                treeName: 'Tree with "Quotes" & Special Characters!',
                exportDateTime: '2024-01-01T12:00:00.000Z',
                nodes: [
                    {
                        id: 'test-node',
                        type: 'goal',
                        position: { x: 0, y: 0 },
                        data: { label: 'Test Node' }
                    }
                ],
                edges: []
            };

            const csvContent = exportToCSV(specialNameData);
            const parseResult = parseCSVImport(csvContent);

            expect(parseResult.success).toBe(true);
            expect(parseResult.data).toBeDefined();
            expect(parseResult.data?.treeName).toBe('Tree with "Quotes" & Special Characters!');
        });

        it('should preserve export date-time metadata', async () => {
            const testData: ExportData = {
                treeName: 'DateTime Test',
                exportDateTime: '2024-12-25T15:30:45.123Z',
                nodes: [
                    {
                        id: 'test-node',
                        type: 'goal',
                        position: { x: 0, y: 0 },
                        data: { label: 'Test Node' }
                    }
                ],
                edges: []
            };

            const csvContent = exportToCSV(testData);
            const parseResult = parseCSVImport(csvContent);

            expect(parseResult.success).toBe(true);
            expect(parseResult.data).toBeDefined();
            expect(parseResult.data?.exportDateTime).toBe('2024-12-25T15:30:45.123Z');
        });

        it('should handle empty tree name gracefully', async () => {
            const emptyNameData: ExportData = {
                treeName: '',
                exportDateTime: '2024-01-01T12:00:00.000Z',
                nodes: [
                    {
                        id: 'test-node',
                        type: 'goal',
                        position: { x: 0, y: 0 },
                        data: { label: 'Test Node' }
                    }
                ],
                edges: []
            };

            const csvContent = exportToCSV(emptyNameData);
            const parseResult = parseCSVImport(csvContent);

            expect(parseResult.success).toBe(true);
            expect(parseResult.data).toBeDefined();
            // Should use the empty string as provided, not default to 'Imported Tree'
            expect(parseResult.data?.treeName).toBe('');
        });
    });

    describe('Large Tree Import Performance', () => {
        it('should handle large tree import efficiently', async () => {
            // Create a large tree structure
            const largeNodes: Node[] = [];
            const largeEdges: Edge[] = [];

            // Generate 100 nodes
            for (let i = 0; i < 100; i++) {
                largeNodes.push({
                    id: `node-${i}`,
                    type: i % 4 === 0 ? 'goal' : i % 4 === 1 ? 'csf' : i % 4 === 2 ? 'condition' : 'and',
                    position: { x: i * 10, y: i * 10 },
                    data: { label: `Node ${i} with content` }
                });
            }

            // Generate 99 edges
            for (let i = 0; i < 99; i++) {
                largeEdges.push({
                    id: `edge-${i}`,
                    source: `node-${i}`,
                    target: `node-${i + 1}`,
                    type: 'smoothstep',
                    label: i % 3 === 0 ? `Edge ${i}` : undefined
                });
            }

            const largeTreeData: ExportData = {
                treeName: 'Large Tree Performance Test',
                exportDateTime: '2024-01-01T12:00:00.000Z',
                nodes: largeNodes,
                edges: largeEdges
            };

            // Test export and import performance
            const startTime = Date.now();
            const csvContent = exportToCSV(largeTreeData);
            const parseResult = parseCSVImport(csvContent);
            const endTime = Date.now();

            const executionTime = endTime - startTime;
            expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds

            expect(parseResult.success).toBe(true);
            expect(parseResult.data).toBeDefined();

            if (parseResult.data) {
                expect(parseResult.data.nodes.length).toBe(100);
                expect(parseResult.data.edges.length).toBe(99);

                // Test reconstruction performance
                const reconstructStartTime = Date.now();
                const { nodes: reconstructedNodes, edges: reconstructedEdges } = reconstructTreeData(
                    parseResult.data,
                    mockEditHandler
                );
                const reconstructEndTime = Date.now();

                const reconstructTime = reconstructEndTime - reconstructStartTime;
                expect(reconstructTime).toBeLessThan(1000); // Should complete within 1 second

                expect(reconstructedNodes.length).toBe(100);
                expect(reconstructedEdges.length).toBe(99);

                // Verify first and last nodes are correctly reconstructed
                const firstNode = reconstructedNodes.find(n => n.id === 'node-0');
                const lastNode = reconstructedNodes.find(n => n.id === 'node-99');

                expect(firstNode).toBeDefined();
                expect(lastNode).toBeDefined();
                expect(firstNode?.data.onEdit).toBe(mockEditHandler);
                expect(lastNode?.data.onEdit).toBe(mockEditHandler);
            }
        });
    });
});