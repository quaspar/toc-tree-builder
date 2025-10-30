import { Node, Edge, MarkerType } from 'reactflow';

// TypeScript interfaces for import functionality
export interface ImportData {
  treeName: string;
  exportDateTime: string;
  nodes: Node[];
  edges: Edge[];
}

export interface CSVImportResult {
  success: boolean;
  data?: ImportData;
  error?: string;
}

// Adapter interfaces for dependency injection
export interface FileReaderAdapter {
  readAsText(file: File): Promise<string>;
}

export interface FileInputAdapter {
  openFilePicker(): Promise<File | null>;
}

// Browser implementations of adapters
export class BrowserFileReaderAdapter implements FileReaderAdapter {
  async readAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

export class BrowserFileInputAdapter implements FileInputAdapter {
  async openFilePicker(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.style.display = 'none';
      
      input.onchange = (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0] || null;
        document.body.removeChild(input);
        resolve(file);
      };
      
      input.oncancel = () => {
        document.body.removeChild(input);
        resolve(null);
      };
      
      document.body.appendChild(input);
      input.click();
    });
  }
}

// File reading result interface
export interface FileReadResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Validates that a file has a .csv extension
 */
export function validateFileType(file: File): boolean {
  return file.name.toLowerCase().endsWith('.csv');
}

/**
 * Reads a CSV file using the provided FileReaderAdapter with error handling
 */
export async function readCSVFile(
  file: File, 
  fileReader: FileReaderAdapter = new BrowserFileReaderAdapter()
): Promise<FileReadResult> {
  try {
    // Validate file type
    if (!validateFileType(file)) {
      return {
        success: false,
        error: 'Please select a valid CSV file'
      };
    }

    // Read file content
    const content = await fileReader.readAsText(file);
    
    return {
      success: true,
      content
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to read file content'
    };
  }
}

// Internal interface for CSV row structure
interface CSVRow {
  id: string;
  type: string;
  label: string;
  position_x: string;
  position_y: string;
  source: string;
  target: string;
}

/**
 * Unescapes CSV values by removing quotes and handling escaped characters
 */
function unescapeCSVValue(value: string): string {
  if (!value) return '';
  
  // Remove surrounding quotes if present
  let unquoted = value;
  if (unquoted.startsWith('"') && unquoted.endsWith('"')) {
    unquoted = unquoted.slice(1, -1);
  }
  
  // Unescape doubled quotes and backslashes
  return unquoted
    .replace(/""/g, '"')        // Unescape doubled quotes
    .replace(/\\\\/g, '\\');    // Unescape doubled backslashes
}

/**
 * Parses a CSV line into an array of values, handling quoted values properly
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote - add one quote and skip next
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        current += char;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(unescapeCSVValue(current));
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  
  // Add the last field
  values.push(unescapeCSVValue(current));
  
  return values;
}

/**
 * Extracts metadata from the CSV content
 */
function parseMetadata(lines: string[]): { treeName: string; exportDateTime: string; version: string } {
  let treeName = 'Imported Tree';
  let exportDateTime = '';
  let version = '';
  
  for (const line of lines) {
    if (line.startsWith('# Tree Name:')) {
      treeName = line.replace('# Tree Name:', '').trim();
    } else if (line.startsWith('# Export Date-Time:')) {
      exportDateTime = line.replace('# Export Date-Time:', '').trim();
    } else if (line.startsWith('# Export Version:')) {
      version = line.replace('# Export Version:', '').trim();
    }
  }
  
  return { treeName, exportDateTime, version };
}

/**
 * Separates CSV rows into nodes and edges based on position vs source/target fields
 */
function separateNodesAndEdges(csvRows: CSVRow[]): { nodes: CSVRow[]; edges: CSVRow[] } {
  const nodes: CSVRow[] = [];
  const edges: CSVRow[] = [];
  
  for (const row of csvRows) {
    // If position_x and position_y are not empty, it's a node
    if (row.position_x && row.position_y) {
      nodes.push(row);
    }
    // If source and target are not empty, it's an edge
    else if (row.source && row.target) {
      edges.push(row);
    }
  }
  
  return { nodes, edges };
}

/**
 * Converts CSV node data to ReactFlow Node objects
 */
function csvRowsToNodes(csvRows: CSVRow[]): Node[] {
  return csvRows.map(row => ({
    id: row.id,
    type: row.type,
    position: {
      x: parseFloat(row.position_x) || 0,
      y: parseFloat(row.position_y) || 0
    },
    data: {
      label: row.label
    }
  }));
}

// Valid node types supported by the application
const VALID_NODE_TYPES = ['goal', 'csf', 'condition', 'and'] as const;
type ValidNodeType = typeof VALID_NODE_TYPES[number];

/**
 * Validates and normalizes a node type, handling unknown types gracefully
 */
function validateNodeType(type: string): ValidNodeType {
  if (VALID_NODE_TYPES.includes(type as ValidNodeType)) {
    return type as ValidNodeType;
  }
  
  // Default to 'condition' for unknown types
  console.warn(`Unknown node type "${type}", defaulting to "condition"`);
  return 'condition';
}

// Interface for reconstruction result
export interface ReconstructionResult {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Reconstructs tree data from imported CSV data, attaching edit handlers and validating types
 */
export function reconstructTreeData(
  importData: ImportData, 
  handleEditNode: (id: string, text: string) => void
): ReconstructionResult {
  // Reconstruct nodes with edit handlers and type validation
  const reconstructedNodes: Node[] = importData.nodes.map(node => ({
    ...node,
    type: validateNodeType(node.type || 'condition'),
    position: {
      x: typeof node.position.x === 'number' ? node.position.x : parseFloat(String(node.position.x)) || 0,
      y: typeof node.position.y === 'number' ? node.position.y : parseFloat(String(node.position.y)) || 0
    },
    data: {
      ...node.data,
      label: node.data.label || '',
      onEdit: handleEditNode
    }
  }));

  // Reconstruct edges with proper ReactFlow properties
  const reconstructedEdges: Edge[] = importData.edges.map(edge => ({
    ...edge,
    type: edge.type || 'smoothstep',
    animated: edge.animated !== false, // Default to true unless explicitly false
    markerEnd: edge.markerEnd || {
      type: MarkerType.ArrowClosed,
    },
    label: edge.label || undefined
  }));

  return {
    nodes: reconstructedNodes,
    edges: reconstructedEdges
  };
}

/**
 * Converts CSV edge data to ReactFlow Edge objects
 */
function csvRowsToEdges(csvRows: CSVRow[]): Edge[] {
  return csvRows.map(row => ({
    id: row.id,
    source: row.source,
    target: row.target,
    type: row.type || 'smoothstep',
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    label: row.label || undefined
  }));
}

/**
 * Parses CSV content that may contain multi-line values, returning complete CSV records
 */
function parseCSVRecords(csvContent: string, startIndex: number): string[] {
  const records: string[] = [];
  let currentRecord = '';
  let inQuotes = false;
  let i = startIndex;
  
  while (i < csvContent.length) {
    const char = csvContent[i];
    
    if (char === '"') {
      if (inQuotes && csvContent[i + 1] === '"') {
        // Escaped quote - add both quotes and skip next
        currentRecord += '""';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        currentRecord += char;
        i++;
      }
    } else if (char === '\n' && !inQuotes) {
      // End of record (only if not inside quotes)
      if (currentRecord.trim()) {
        records.push(currentRecord.trim());
        currentRecord = '';
      }
      i++;
    } else {
      currentRecord += char;
      i++;
    }
  }
  
  // Add the last record if it exists
  if (currentRecord.trim()) {
    records.push(currentRecord.trim());
  }
  
  return records;
}

/**
 * Main CSV parsing function that takes CSV content string and returns structured data
 */
export function parseCSVImport(csvContent: string): CSVImportResult {
  try {
    if (!csvContent || !csvContent.trim()) {
      return {
        success: false,
        error: 'File is empty'
      };
    }
    
    const lines = csvContent.split('\n').map(line => line.trim());
    
    // Find metadata section
    const metadataLines = lines.filter(line => line.startsWith('#') && !line.includes('TREE ELEMENTS'));
    if (metadataLines.length === 0) {
      return {
        success: false,
        error: 'Invalid file format - missing metadata section'
      };
    }
    
    // Parse metadata
    const metadata = parseMetadata(metadataLines);
    
    // Find tree elements section
    const treeElementsIndex = lines.findIndex(line => line.includes('# TREE ELEMENTS'));
    if (treeElementsIndex === -1) {
      return {
        success: false,
        error: 'Invalid file format - missing tree elements section'
      };
    }
    
    // Find header line (should be right after tree elements section)
    let headerIndex = -1;
    for (let i = treeElementsIndex + 1; i < lines.length; i++) {
      if (lines[i] && !lines[i].startsWith('#') && lines[i].includes('id,type,label')) {
        headerIndex = i;
        break;
      }
    }
    
    if (headerIndex === -1) {
      return {
        success: false,
        error: 'Invalid file format - missing CSV headers'
      };
    }
    
    // Parse CSV headers to validate structure
    const headers = parseCSVLine(lines[headerIndex]);
    const expectedHeaders = ['id', 'type', 'label', 'position_x', 'position_y', 'source', 'target'];
    
    if (!expectedHeaders.every(header => headers.includes(header))) {
      return {
        success: false,
        error: 'Invalid file format - missing required columns'
      };
    }
    
    // Find the start of CSV data (after headers)
    const headerLineInContent = lines[headerIndex];
    const headerStartIndex = csvContent.indexOf(headerLineInContent) + headerLineInContent.length + 1;
    
    // Parse CSV data records (handling multi-line values)
    const csvRecords = parseCSVRecords(csvContent, headerStartIndex);
    
    // Convert records to CSV rows
    const csvRows: CSVRow[] = [];
    for (const record of csvRecords) {
      if (record && !record.startsWith('#')) {
        const values = parseCSVLine(record);
        if (values.length >= 7) {
          csvRows.push({
            id: values[0],
            type: values[1],
            label: values[2],
            position_x: values[3],
            position_y: values[4],
            source: values[5],
            target: values[6]
          });
        }
      }
    }
    
    if (csvRows.length === 0) {
      return {
        success: false,
        error: 'File contains no tree data to import'
      };
    }
    
    // Separate nodes and edges
    const { nodes: nodeRows, edges: edgeRows } = separateNodesAndEdges(csvRows);
    
    // Convert to ReactFlow objects
    const nodes = csvRowsToNodes(nodeRows);
    const edges = csvRowsToEdges(edgeRows);
    
    return {
      success: true,
      data: {
        treeName: metadata.treeName,
        exportDateTime: metadata.exportDateTime,
        nodes,
        edges
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}