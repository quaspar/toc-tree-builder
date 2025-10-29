# Design Document - Tree File Export

## Overview

The tree file export feature enables users to export their goal trees to CSV format for external analysis and future import. The feature integrates seamlessly with the existing ReactFlow-based goal tree canvas and toolbar, providing a one-click export solution that preserves all tree data with full fidelity.

The design leverages browser-native file download capabilities and follows the existing application patterns for consistent user experience. The CSV format is structured to maintain compatibility with spreadsheet applications while preserving all necessary data for future import functionality.

## Architecture

### Component Structure

```
GoalTreeCanvas (existing)
├── TreeToolbar (modified)
│   ├── Export Button (new)
│   └── Export Logic (new)
└── Export Utilities (new)
    ├── CSV Generator
    ├── File Download Handler
    └── Filename Sanitizer
```

### Data Flow

1. User clicks export button in TreeToolbar
2. TreeToolbar calls export handler with current tree data
3. Export utilities convert tree data to CSV format
4. Browser downloads the generated CSV file
5. User receives feedback on export completion

### Integration Points

- **TreeToolbar Component**: Add export button and integrate export functionality
- **GoalTreeCanvas Component**: Pass tree data and export handler to toolbar
- **Browser Download API**: Use native `URL.createObjectURL` and `document.createElement('a')` for file download

## Components and Interfaces

### Modified Components

#### TreeToolbar Component
```typescript
interface TreeToolbarProps {
  // ... existing props
  onExport: () => void;
  isExporting: boolean;
}
```

**Changes:**
- Add export button with Download icon
- Add loading state during export
- Disable export when no tree data exists
- Maintain consistent styling with existing buttons

#### GoalTreeCanvas Component
```typescript
// New state for export functionality
const [isExporting, setIsExporting] = useState(false);

// New export handler
const handleExport = useCallback(() => {
  // Export logic implementation
}, [nodes, edges, treeName]);
```

**Changes:**
- Add export state management
- Implement export handler function
- Pass export props to TreeToolbar

### New Utility Functions

#### CSV Export Utility
```typescript
interface ExportData {
  treeName: string;
  exportDateTime: string;
  nodes: Node[];
  edges: Edge[];
}

interface CSVExportOptions {
  includeHeaders: boolean;
  dateTimeFormat: string;
}

function exportToCSV(data: ExportData, options?: CSVExportOptions): string
```

**Responsibilities:**
- Convert tree data to unified CSV format
- Create sections for metadata and combined tree elements
- Ensure import compatibility with proper headers
- Handle special characters and escaping with proper quoting
- Merge nodes and edges into single table structure
- Quote all string values to handle commas and special characters

#### File Download Utility
```typescript
interface DownloadOptions {
  filename: string;
  mimeType: string;
}

function downloadFile(content: string, options: DownloadOptions): void
```

**Responsibilities:**
- Create blob with CSV content
- Generate download URL
- Trigger browser download
- Clean up object URLs

#### Filename Sanitizer
```typescript
function sanitizeFilename(name: string): string
function generateExportFilename(treeName: string): string
```

**Responsibilities:**
- Remove invalid filesystem characters
- Generate timestamped filenames
- Handle empty or default tree names
- Ensure cross-platform compatibility

## Data Models

### CSV Structure

The exported CSV will have two main sections with clear delimiters:

#### Metadata Section
```csv
# Goal Tree Export
# Tree Name: [Tree Name]
# Export Date-Time: [ISO DateTime]
# Export Version: 1.0

```

#### Tree Elements Section
```csv
# TREE ELEMENTS
id,type,label,position_x,position_y,source,target
"goal-123","goal","Achieve Sales Target, Q4 2024","100","50","",""
"csf-456","csf","Improve Marketing","200","150","",""
"condition-789","condition","Hire Sales Team","300","250","",""
"and-012","and","AND","150","100","",""
"edge-1","smoothstep","Connection Label","","","goal-123","csf-456"
"edge-2","smoothstep","","","","csf-456","condition-789"
"edge-3","smoothstep","","","","condition-789","and-012"

```

### Unified Data Mapping

| ReactFlow Property | CSV Column | Description | Applies To |
|-------------------|------------|-------------|------------|
| `element.id` | `id` | Unique element identifier | Nodes & Edges |
| `element.type` | `type` | Element type (goal, csf, condition, and, smoothstep) | Nodes & Edges |
| `element.data.label` or `element.label` | `label` | Element text content | Nodes & Edges |
| `node.position.x` | `position_x` | X coordinate (empty for edges) | Nodes only |
| `node.position.y` | `position_y` | Y coordinate (empty for edges) | Nodes only |
| `edge.source` | `source` | Source node ID (empty for nodes) | Edges only |
| `edge.target` | `target` | Target node ID (empty for nodes) | Edges only |

## Error Handling

### Export Process Errors

1. **Empty Tree Data**
   - Disable export button
   - Show tooltip: "No tree data to export"
   - Prevent export attempt

2. **CSV Generation Errors**
   - Catch conversion errors
   - Show error toast: "Failed to generate export file"
   - Log detailed error for debugging

3. **Download Errors**
   - Handle browser download restrictions
   - Show error toast: "Failed to download file"
   - Provide fallback instructions

4. **Filename Sanitization**
   - Handle special characters gracefully
   - Fallback to default names for invalid inputs
   - Ensure filename length limits

### User Feedback

- **Success**: Toast notification "Tree exported successfully"
- **Progress**: Button shows "Exporting..." during process
- **Error**: Specific error messages via toast notifications
- **Validation**: Disabled state when no data available

## Testing Strategy

### Unit Tests

1. **CSV Generation**
   - Test with various tree structures
   - Verify CSV format compliance with proper quoting
   - Test special character handling (commas, quotes, newlines)
   - Validate import compatibility

2. **Filename Sanitization**
   - Test invalid character removal
   - Verify timestamp formatting
   - Test edge cases (empty names, long names)

3. **Data Conversion**
   - Test unified element mapping for nodes and edges
   - Test edge relationship preservation with empty position fields
   - Test node position preservation with empty source/target fields
   - Verify metadata inclusion
   - Test edge label handling

### Integration Tests

1. **Export Flow**
   - Test complete export process
   - Verify file download trigger
   - Test with different tree sizes
   - Validate user feedback

2. **UI Integration**
   - Test button states and interactions
   - Verify toolbar integration
   - Test responsive behavior

### Manual Testing

1. **Cross-browser Compatibility**
   - Test download behavior in Chrome, Firefox, Safari
   - Verify file naming across platforms
   - Test with various tree configurations

2. **User Experience**
   - Test export with empty trees
   - Verify loading states and feedback
   - Test file opening in spreadsheet applications

## Implementation Notes

### Browser Compatibility

- Use `URL.createObjectURL` for modern browsers
- Fallback handling for older browsers if needed
- Test download behavior across platforms

### Performance Considerations

- Efficient CSV generation for large trees
- Minimal memory usage during export
- Quick cleanup of object URLs

### Future Import Compatibility

- Preserve all node and edge properties
- Include version information for format evolution
- Use consistent ID generation for reimport
- Maintain position information for layout reconstruction

### Security Considerations

- Sanitize all user input in filenames
- Validate tree data before export
- No sensitive data exposure in CSV format
- Safe handling of special characters with proper CSV quoting
- Escape quotes within quoted strings using double quotes ("")