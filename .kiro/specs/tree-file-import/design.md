# Design Document - Tree File Import

## Overview

The tree file import feature enables users to import previously exported CSV files back into the goal tree application. This feature replaces the existing "Load Tree" database-based functionality with a file-based import system that works with CSV files exported from the application. The design focuses on seamless integration with the existing toolbar, robust error handling, and maintaining data integrity during the import process.

The import functionality leverages the browser's native File API for file selection and includes comprehensive CSV parsing to reconstruct the tree structure with full fidelity. The feature is designed to be the counterpart to the existing export functionality, creating a complete file-based workflow for tree data management.

## Architecture

### Component Structure

```
GoalTreeCanvas (modified)
├── TreeToolbar (modified)
│   ├── Import Button (new)
│   └── Import Logic (new)
└── Import Utilities (new)
    ├── CSV Parser
    ├── File Reader Handler
    └── Tree Data Reconstructor
```

### Data Flow

1. User clicks import button in TreeToolbar (only when canvas is empty)
2. Browser opens native file picker dialog
3. User selects CSV file from their computer
4. Import utilities read and parse the CSV file content
5. CSV parser validates format and extracts tree data
6. Tree data reconstructor converts CSV data back to ReactFlow nodes and edges
7. GoalTreeCanvas updates with imported tree data
8. User receives feedback on import success or failure

### Integration Points

- **TreeToolbar Component**: Replace load tree section with import button
- **GoalTreeCanvas Component**: Add import handler and state management
- **Browser File API**: Use native `<input type="file">` for file selection via adapter pattern
- **Existing Export Format**: Parse CSV files created by exportUtils.ts
- **Dependency Injection**: Use adapter pattern for browser APIs to enable testing

## Components and Interfaces

### Modified Components

#### TreeToolbar Component
```typescript
interface TreeToolbarProps {
  // ... existing props (remove onLoad and availableTrees)
  onImport: () => void;
  isImporting: boolean;
  hasTreeData: boolean; // used to disable import when canvas has data
}
```

**Changes:**
- Remove `onLoad` prop and `availableTrees` prop
- Remove "Load Tree" select dropdown section
- Add import button with Upload icon
- Add disabled state when canvas has data
- Add tooltip for disabled state
- Maintain consistent styling with other toolbar buttons

#### GoalTreeCanvas Component
```typescript
// New state for import functionality
const [isImporting, setIsImporting] = useState(false);

// New import handler
const handleImport = useCallback(() => {
  // Import logic implementation
}, [setNodes, setEdges, setTreeName, setCurrentTreeId]);
```

**Changes:**
- Remove `handleLoad` function and related database loading logic
- Remove `availableTrees` state and `loadAvailableTrees` function
- Add import state management
- Implement import handler function
- Pass import props to TreeToolbar instead of load props

### New Utility Functions

#### CSV Import Utility
```typescript
interface ImportData {
  treeName: string;
  exportDateTime: string;
  nodes: Node[];
  edges: Edge[];
}

interface CSVImportResult {
  success: boolean;
  data?: ImportData;
  error?: string;
}

// Pure function - easily testable
function parseCSVImport(csvContent: string): CSVImportResult

// Adapter for file input element
interface FileInputAdapter {
  openFilePicker(): Promise<File | null>;
}

class BrowserFileInputAdapter implements FileInputAdapter {
  async openFilePicker(): Promise<File | null> {
    // Implementation using hidden input element
  }
}
```

**Responsibilities:**
- Parse CSV content and validate format (pure function)
- Extract metadata section (tree name, export date)
- Parse tree elements section with unified node/edge structure
- Separate nodes and edges based on empty position fields vs empty source/target fields
- Handle CSV escaping and quoted values
- Validate required columns and data integrity
- Return structured data or error information
- Provide testable file input abstraction

#### File Reader Utility
```typescript
interface FileReadResult {
  success: boolean;
  content?: string;
  error?: string;
}

interface FileReaderAdapter {
  readAsText(file: File): Promise<string>;
}

class BrowserFileReaderAdapter implements FileReaderAdapter {
  async readAsText(file: File): Promise<string> {
    // Implementation using browser FileReader API
  }
}

function readCSVFile(file: File, fileReader: FileReaderAdapter = new BrowserFileReaderAdapter()): Promise<FileReadResult>
```

**Responsibilities:**
- Validate file type (must be .csv)
- Read file content using injected FileReaderAdapter
- Handle file reading errors
- Return file content or error information
- Support dependency injection for testing

#### Tree Data Reconstructor
```typescript
interface ReconstructionResult {
  nodes: Node[];
  edges: Edge[];
}

function reconstructTreeData(importData: ImportData, handleEditNode: (id: string, text: string) => void): ReconstructionResult
```

**Responsibilities:**
- Convert CSV data back to ReactFlow Node and Edge objects
- Restore node positions and properties
- Restore edge connections and properties
- Add required ReactFlow properties (markerEnd, animated, etc.)
- Attach edit handlers to nodes
- Ensure data type consistency

## Data Models

### CSV Parsing Logic

The import function needs to parse the same CSV format created by the export function:

#### Metadata Section Parsing
```csv
# Goal Tree Export
# Tree Name: [Tree Name]
# Export Date-Time: [ISO DateTime]
# Export Version: 1.0
```

**Parsing Rules:**
- Lines starting with `#` are metadata
- Extract tree name from "Tree Name:" line
- Validate export version compatibility
- Skip empty lines between sections

#### Tree Elements Section Parsing
```csv
# TREE ELEMENTS
id,type,label,position_x,position_y,source,target
"goal-123","goal","Achieve Sales Target","100","50","",""
"edge-1","smoothstep","","","","goal-123","csf-456"
```

**Parsing Rules:**
- Find "# TREE ELEMENTS" section header
- Parse CSV headers to validate column structure
- Handle quoted values with proper unescaping
- Separate nodes (have position_x/position_y) from edges (have source/target)
- Convert string coordinates back to numbers
- Handle empty string values appropriately

### Data Type Mapping

| CSV Column | Node Property | Edge Property | Conversion |
|------------|---------------|---------------|------------|
| `id` | `node.id` | `edge.id` | Direct string |
| `type` | `node.type` | `edge.type` | Direct string |
| `label` | `node.data.label` | `edge.label` | Direct string |
| `position_x` | `node.position.x` | N/A | String to number |
| `position_y` | `node.position.y` | N/A | String to number |
| `source` | N/A | `edge.source` | Direct string |
| `target` | N/A | `edge.target` | Direct string |

### ReactFlow Object Reconstruction

#### Node Reconstruction
```typescript
const node: Node = {
  id: csvRow.id,
  type: csvRow.type,
  position: {
    x: parseFloat(csvRow.position_x),
    y: parseFloat(csvRow.position_y)
  },
  data: {
    label: csvRow.label,
    onEdit: handleEditNode
  }
};
```

#### Edge Reconstruction
```typescript
const edge: Edge = {
  id: csvRow.id,
  source: csvRow.source,
  target: csvRow.target,
  type: csvRow.type || 'smoothstep',
  animated: true,
  markerEnd: {
    type: MarkerType.ArrowClosed,
  },
  label: csvRow.label || undefined
};
```

## Error Handling

### File Selection Errors

1. **No File Selected**
   - Handle gracefully without error message
   - Allow user to try again

2. **Invalid File Type**
   - Check file extension (.csv)
   - Show error: "Please select a valid CSV file"
   - Clear file input

3. **File Reading Errors**
   - Handle FileReader API errors
   - Show error: "Failed to read file content"
   - Log detailed error for debugging

### CSV Parsing Errors

1. **Invalid Format**
   - Missing metadata section
   - Missing tree elements section
   - Invalid column headers
   - Show error: "Invalid file format - please select a file exported from this application"

2. **Data Validation Errors**
   - Invalid node types
   - Missing required fields
   - Invalid coordinate values
   - Show error: "File contains invalid tree data"

3. **Empty File**
   - No tree elements found
   - Show error: "File contains no tree data to import"

### Import Process Errors

1. **Tree Reconstruction Errors**
   - Node creation failures
   - Edge creation failures
   - Show error: "Failed to import tree data"

2. **Canvas Update Errors**
   - State update failures
   - Show error: "Failed to update canvas with imported data"

### User Feedback

- **Success**: Toast notification "Tree imported successfully!"
- **Progress**: Button shows "Importing..." during process
- **Error**: Specific error messages via toast notifications
- **Validation**: Disabled state with tooltip when canvas has data

## Testing Strategy

### Unit Tests

1. **CSV Parsing**
   - Test with valid export files
   - Test with invalid formats
   - Test with missing sections
   - Test with malformed data
   - Test special character handling

2. **File Reading**
   - Test with valid CSV files
   - Test with invalid file types
   - Test with empty files
   - Test with large files

3. **Tree Reconstruction**
   - Test node creation from CSV data
   - Test edge creation from CSV data
   - Test position restoration
   - Test data type conversions

### Integration Tests

1. **Import Flow**
   - Test complete import process
   - Test with various tree structures
   - Test error handling scenarios
   - Test user feedback

2. **UI Integration**
   - Test button states and interactions
   - Test disabled state with tooltip
   - Test file picker integration
   - Test toolbar layout changes

### Manual Testing

1. **Cross-browser Compatibility**
   - Test file picker in Chrome, Firefox, Safari
   - Test CSV parsing across browsers
   - Test with various file sizes

2. **User Experience**
   - Test import with empty canvas
   - Test disabled state with populated canvas
   - Test error scenarios and recovery
   - Test with files exported from the application

## Implementation Notes

### Testability and Dependency Injection

- **Adapter Pattern**: Wrap browser APIs (FileReader, file input) in adapters for dependency injection
- **Pure Functions**: Keep CSV parsing logic pure and testable without browser dependencies
- **Mock Adapters**: Create mock implementations for unit testing
- **Interface Segregation**: Define minimal interfaces for each browser API interaction

### Browser Compatibility

- Use File API for modern browsers via adapter pattern
- Handle FileReader API properly through abstraction
- Test file picker behavior across platforms

### Performance Considerations

- Efficient CSV parsing for large files
- Minimal memory usage during import
- Quick canvas updates with imported data

### Security Considerations

- Validate file types before processing
- Sanitize imported data
- Handle malicious CSV content safely
- Limit file size to prevent memory issues

### CSV Parsing Robustness

- Handle various CSV dialects
- Support quoted values with commas
- Handle escaped quotes properly
- Graceful handling of malformed rows

### Future Compatibility

- Version checking for export format evolution
- Backward compatibility with older export formats
- Extensible parsing for new node types
- Maintain compatibility with export utilities