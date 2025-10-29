# Requirements Document

## Introduction

This feature enables users to import goal trees from CSV files that were previously exported from the application. Users can select a CSV file from their local file system and populate the canvas with the tree data. The import functionality replaces the existing "load tree" section in the UI and provides a seamless way to restore tree structures from exported CSV files. The import is only available when the canvas is empty to prevent data conflicts.

## Glossary

- **Goal_Tree_System**: The React-based application that manages goal trees with nodes and edges
- **Import_Function**: The functionality that converts CSV file data back to tree structure and populates the canvas
- **CSV_File**: The comma-separated values file exported from this application containing tree data
- **File_Picker**: The browser's native file selection dialog for choosing CSV files from the user's computer
- **Tree_Canvas**: The ReactFlow-based visual representation of the goal tree
- **Canvas_State**: The current state of the tree canvas indicating whether it contains nodes and edges
- **Import_Button**: The UI element that triggers the file selection and import process
- **Tree_Toolbar**: The existing toolbar component that contains tree management controls
- **Node_Types**: The four types of nodes supported (goal, csf, condition, and)
- **CSV_Parser**: The functionality that reads and validates CSV file content

## Requirements

### Requirement 1

**User Story:** As a goal tree user, I want to import a previously exported CSV file, so that I can restore my tree data in the application

#### Acceptance Criteria

1. WHEN the user clicks the import button, THE Goal_Tree_System SHALL open File_Picker for CSV file selection
2. WHEN a CSV file is selected, THE Goal_Tree_System SHALL parse the CSV_File content using CSV_Parser
3. THE Goal_Tree_System SHALL validate that the CSV_File contains the expected tree export format with metadata and tree elements sections
4. THE Goal_Tree_System SHALL convert CSV data back to Node_Types and edge relationships
5. THE Goal_Tree_System SHALL populate Tree_Canvas with imported nodes and edges maintaining original positions
6. WHEN import is successful, THE Goal_Tree_System SHALL display success feedback to the user

### Requirement 2

**User Story:** As a goal tree user, I want the import functionality to replace the load tree section, so that I have a unified file-based workflow

#### Acceptance Criteria

1. THE Goal_Tree_System SHALL remove the existing "Load Tree" select dropdown from Tree_Toolbar
2. THE Goal_Tree_System SHALL add an "Import from File" button in place of the load tree section
3. THE Goal_Tree_System SHALL maintain consistent visual design with existing toolbar elements
4. THE Goal_Tree_System SHALL position the import button in the same toolbar section as other file operations
5. THE Goal_Tree_System SHALL use appropriate icon and styling consistent with the export button

### Requirement 3

**User Story:** As a goal tree user, I want import to be disabled when the canvas has data, so that I don't accidentally overwrite my current work

#### Acceptance Criteria

1. WHEN Canvas_State contains nodes or edges, THE Goal_Tree_System SHALL disable the Import_Button
2. WHEN Import_Button is disabled, THE Goal_Tree_System SHALL display a tooltip explaining "Clear canvas first to import a file"
3. WHEN Canvas_State is empty, THE Goal_Tree_System SHALL enable the Import_Button
4. THE Goal_Tree_System SHALL update Import_Button state dynamically as Canvas_State changes
5. THE Goal_Tree_System SHALL provide clear visual indication when Import_Button is disabled

### Requirement 4

**User Story:** As a goal tree user, I want proper error handling during import, so that I understand what went wrong if the import fails

#### Acceptance Criteria

1. IF the selected file is not a CSV file, THEN THE Goal_Tree_System SHALL display error message "Please select a valid CSV file"
2. IF the CSV_File does not contain expected export format, THEN THE Goal_Tree_System SHALL display error message "Invalid file format - please select a file exported from this application"
3. IF CSV parsing fails, THEN THE Goal_Tree_System SHALL display error message "Failed to read file content"
4. IF node or edge creation fails, THEN THE Goal_Tree_System SHALL display error message "Failed to import tree data"
5. THE Goal_Tree_System SHALL log detailed error information for debugging purposes

### Requirement 5

**User Story:** As a goal tree user, I want the imported tree name to be restored, so that my tree maintains its original identity

#### Acceptance Criteria

1. THE Goal_Tree_System SHALL extract tree name from CSV metadata section
2. THE Goal_Tree_System SHALL update the tree name input field with the imported tree name
3. WHERE the CSV file does not contain tree name metadata, THE Goal_Tree_System SHALL use "Imported Tree" as default name
4. THE Goal_Tree_System SHALL clear any existing tree ID to treat imported tree as new unsaved tree
5. THE Goal_Tree_System SHALL maintain tree name validation rules for imported names