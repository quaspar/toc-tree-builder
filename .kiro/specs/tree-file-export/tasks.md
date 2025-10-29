# Implementation Plan

- [x] 1. Create CSV export utility functions
  - Create `src/lib/exportUtils.ts` with CSV generation functions
  - Implement unified data structure that combines nodes and edges into single CSV section
  - Add proper CSV escaping for commas, quotes, and special characters using double quotes
  - Include metadata section with tree name and export date-time
  - Create TypeScript interfaces for ExportData and CSVExportOptions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Create file download utility functions
  - Add download functions to `src/lib/exportUtils.ts`
  - Implement browser-based file download using URL.createObjectURL and anchor element
  - Add filename sanitization to remove invalid filesystem characters
  - Generate timestamped filenames using tree name as base (format: treename-YYYY-MM-DD-HH-mm-ss.csv)
  - Handle cleanup of object URLs after download
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Add export functionality to GoalTreeCanvas component
  - Add export state management (isExporting) to track export process
  - Implement handleExport callback function that processes current nodes and edges data
  - Import and integrate CSV generation and file download utilities
  - Add error handling with user feedback via existing toast notifications
  - Pass export handler and state to TreeToolbar component
  - _Requirements: 1.1, 1.6, 2.4_

- [x] 4. Update TreeToolbar component with export button
  - Add Download icon import from lucide-react
  - Add export button to toolbar interface after the Auto Layout button
  - Implement loading state during export process using isExporting prop
  - Disable export button when no tree data exists (nodes.length === 0)
  - Maintain consistent styling with existing toolbar buttons (size="sm", variant="outline")
  - Add onExport and isExporting props to TreeToolbarProps interface
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 5. Add unit tests for export utilities
  - Create `src/lib/__tests__/exportUtils.test.ts`
  - Write tests for CSV generation with various tree structures
  - Test proper quoting and escaping of special characters
  - Verify filename sanitization edge cases
  - Test unified node and edge data mapping
  - _Requirements: 1.2, 1.3, 1.4, 3.3, 3.4_

- [x] 6. Add integration tests for export flow
  - Create integration test file for export functionality
  - Test complete export process from button click to file download
  - Verify error handling and user feedback
  - Test export with empty trees and edge cases
  - Validate CSV format compatibility for future import
  - _Requirements: 1.6, 2.4, 2.5_