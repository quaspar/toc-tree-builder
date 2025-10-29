# Implementation Plan

- [ ] 1. Create CSV import utility functions with dependency injection
  - Create `src/lib/importUtils.ts` with pure CSV parsing functions
  - Implement `parseCSVImport` function that takes CSV content string and returns structured data
  - Add proper CSV unescaping for quoted values and special characters
  - Extract metadata section parsing (tree name, export date, version)
  - Parse tree elements section and separate nodes from edges based on position vs source/target fields
  - Create TypeScript interfaces for ImportData, CSVImportResult, and adapter patterns
  - _Requirements: 1.2, 1.3, 1.4, 5.1, 5.2, 5.3_

- [ ] 2. Create browser API adapters for testability
  - Add FileReaderAdapter interface and BrowserFileReaderAdapter implementation to `src/lib/importUtils.ts`
  - Add FileInputAdapter interface and BrowserFileInputAdapter implementation
  - Implement file type validation (.csv extension check)
  - Add file reading functionality using FileReader API through adapter
  - Handle file reading errors and return structured results
  - _Requirements: 1.1, 4.1, 4.3_

- [ ] 3. Create tree data reconstruction utility
  - Add `reconstructTreeData` function to `src/lib/importUtils.ts`
  - Convert CSV data back to ReactFlow Node objects with proper typing and positioning
  - Convert CSV data back to ReactFlow Edge objects with markerEnd and animation properties
  - Attach edit handlers to nodes during reconstruction
  - Handle data type conversions (string coordinates to numbers)
  - Validate node types and handle unknown types gracefully
  - _Requirements: 1.4, 1.5, 4.4_

- [ ] 4. Add import functionality to GoalTreeCanvas component
  - Add import state management (isImporting) to track import process
  - Implement handleImport callback function that orchestrates the import process
  - Remove handleLoad function and availableTrees state management
  - Remove loadAvailableTrees function and related database loading logic
  - Import and integrate CSV parsing and file reading utilities with dependency injection
  - Add comprehensive error handling with user feedback via existing toast notifications
  - Update tree name and clear current tree ID when import is successful
  - Pass import handler and state to TreeToolbar component instead of load props
  - _Requirements: 1.1, 1.5, 1.6, 4.2, 4.3, 4.4, 5.4, 5.5_

- [ ] 5. Update TreeToolbar component to replace load tree with import
  - Remove onLoad prop and availableTrees prop from TreeToolbarProps interface
  - Remove "Load Tree" select dropdown section from component JSX
  - Add onImport and isImporting props to TreeToolbarProps interface
  - Add import button with Upload icon from lucide-react in place of load tree section
  - Implement disabled state when hasTreeData is true (canvas contains nodes/edges)
  - Add tooltip "Clear canvas first to import a file" for disabled state using existing tooltip component
  - Implement loading state during import process using isImporting prop
  - Maintain consistent styling with existing toolbar buttons (size="sm", variant="outline")
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 6. Add unit tests for import utilities
  - Create `src/lib/__tests__/importUtils.test.ts`
  - Write tests for CSV parsing with various valid tree structures
  - Test proper unquoting and unescaping of special characters
  - Test metadata section extraction and tree name handling
  - Test node and edge separation logic based on position vs source/target fields
  - Test error handling for invalid CSV formats and malformed data
  - Test tree data reconstruction with mock edit handlers
  - Create mock adapters for FileReader and FileInput for isolated testing
  - _Requirements: 1.2, 1.3, 1.4, 4.1, 4.2, 4.4, 5.1, 5.2_

- [ ] 7. Add integration tests for import flow
  - Create integration test file for complete import functionality
  - Test import process from button click through canvas population using mock adapters
  - Verify error handling scenarios and user feedback with toast notifications
  - Test import with empty canvas and disabled state with populated canvas
  - Validate imported tree structure matches original export format
  - Test tree name restoration and current tree ID clearing
  - _Requirements: 1.6, 3.4, 4.2, 4.3, 4.4, 5.4, 5.5_