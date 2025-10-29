import { Node, Edge } from 'reactflow';

// TypeScript interfaces for export functionality
export interface ExportData {
    treeName: string;
    exportDateTime: string;
    nodes: Node[];
    edges: Edge[];
}

export interface CSVExportOptions {
    includeHeaders?: boolean;
    dateTimeFormat?: string;
}

// Interface for unified CSV row structure
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
 * Escapes CSV values by wrapping in double quotes and escaping internal quotes and backslashes
 */
function escapeCSVValue(value: string | number | undefined | null): string {
    if (value === undefined || value === null) {
        return '""';
    }

    const stringValue = String(value);
    // Escape backslashes first, then quotes - order matters!
    const escapedValue = stringValue
        .replace(/\\/g, '\\\\')        // Escape backslashes by doubling them
        .replace(/"/g, '""');          // Escape quotes by doubling them
    return `"${escapedValue}"`;
}

/**
 * Converts tree data to unified CSV format with metadata section
 */
export function exportToCSV(data: ExportData, options: CSVExportOptions = {}): string {
    const { includeHeaders = true, dateTimeFormat = 'ISO' } = options;

    let csvContent = '';

    // Metadata section
    csvContent += '# Goal Tree Export\n';
    csvContent += `# Tree Name: ${data.treeName}\n`;
    csvContent += `# Export Date-Time: ${data.exportDateTime}\n`;
    csvContent += '# Export Version: 1.0\n';
    csvContent += '\n';

    // Tree elements section header
    csvContent += '# TREE ELEMENTS\n';

    // CSV headers
    if (includeHeaders) {
        csvContent += 'id,type,label,position_x,position_y,source,target\n';
    }

    // Convert nodes and edges to unified CSV rows
    const csvRows: CSVRow[] = [];

    // Add nodes to CSV rows
    data.nodes.forEach(node => {
        csvRows.push({
            id: node.id,
            type: node.type || 'condition',
            label: node.data?.label || '',
            position_x: String(node.position.x),
            position_y: String(node.position.y),
            source: '',
            target: ''
        });
    });

    // Add edges to CSV rows
    data.edges.forEach(edge => {
        csvRows.push({
            id: edge.id || `edge-${edge.source}-${edge.target}`,
            type: edge.type || 'smoothstep',
            label: typeof edge.label === 'string' ? edge.label : '',
            position_x: '',
            position_y: '',
            source: edge.source,
            target: edge.target
        });
    });

    // Generate CSV rows with proper escaping
    csvRows.forEach(row => {
        const csvRow = [
            escapeCSVValue(row.id),
            escapeCSVValue(row.type),
            escapeCSVValue(row.label),
            escapeCSVValue(row.position_x),
            escapeCSVValue(row.position_y),
            escapeCSVValue(row.source),
            escapeCSVValue(row.target)
        ].join(',');

        csvContent += csvRow + '\n';
    });

    return csvContent;
}

/**
 * Sanitizes filename by removing invalid filesystem characters
 */
export function sanitizeFilename(name: string): string {
    // Remove or replace invalid characters for cross-platform compatibility
    return name
        .trim() // Trim whitespace first
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/\.+$/, '') // Remove trailing dots
        .replace(/^-+|-+$/g, ''); // Remove leading and trailing hyphens
}

/**
 * Generates timestamped export filename
 */
export function generateExportFilename(treeName: string): string {
    const sanitizedName = sanitizeFilename(treeName) || 'goal-tree';
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '-')
        .substring(0, 19); // Format: YYYY-MM-DD-HH-mm-ss

    return `${sanitizedName}-${timestamp}.csv`;
}

/**
 * Downloads a file with the given content and filename
 */
export function downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the object URL
    URL.revokeObjectURL(url);
}

/**
 * Main export function that combines CSV generation and file download
 */
export function exportTreeToCSV(
    nodes: Node[],
    edges: Edge[],
    treeName: string
): void {
    const exportData: ExportData = {
        treeName,
        exportDateTime: new Date().toISOString(),
        nodes,
        edges
    };

    const csvContent = exportToCSV(exportData);
    const filename = generateExportFilename(treeName);

    downloadFile(csvContent, filename);
}