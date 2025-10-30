import { useCallback, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

import GoalNode from './GoalNode';
import CsfNode from './CsfNode';
import ConditionNode from './ConditionNode';
import AndNode from './AndNode';
import { TreeToolbar } from './TreeToolbar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { exportTreeToCSV } from '@/lib/exportUtils';
import {
  parseCSVImport,
  readCSVFile,
  reconstructTreeData,
  BrowserFileInputAdapter
} from '@/lib/importUtils';

const nodeTypes = {
  goal: GoalNode,
  csf: CsfNode,
  condition: ConditionNode,
  and: AndNode,
};

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 200, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 100,
        y: nodeWithPosition.y - 50,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export function GoalTreeCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [treeName, setTreeName] = useState('My Goal Tree');
  const [currentTreeId, setCurrentTreeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);



  const onConnect = useCallback(
    (params: Connection) => {
      const edge = {
        ...params,
        // source: params.target,
        // target: params.source,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  const handleEditNode = useCallback(
    (id: string, text: string) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, label: text } }
            : node
        )
      );
    },
    [setNodes]
  );

  const handleAddNode = useCallback(
    (type: 'goal' | 'csf' | 'condition' | 'and') => {
      const defaultLabels = {
        goal: 'New Goal',
        csf: 'New Critical Success Factor',
        condition: 'New Necessary Condition',
        and: 'AND',
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position: { x: Math.random() * 500, y: Math.random() * 500 },
        data: { label: defaultLabels[type], onEdit: handleEditNode },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, handleEditNode]
  );

  const handleAutoLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [nodes, edges, setNodes, setEdges]);

  const handleSave = async () => {
    if (!treeName.trim()) {
      toast.error('Please enter a tree name');
      return;
    }

    setIsSaving(true);

    try {
      // Save or update tree
      let treeId = currentTreeId;

      if (currentTreeId) {
        // Update existing tree
        const { error: updateError } = await supabase
          .from('trees')
          .update({ name: treeName })
          .eq('id', currentTreeId);

        if (updateError) throw updateError;

        // Delete existing nodes and edges
        await supabase.from('edges').delete().eq('tree_id', currentTreeId);
        await supabase.from('nodes').delete().eq('tree_id', currentTreeId);
      } else {
        // Create new tree
        const { data: treeData, error: treeError } = await supabase
          .from('trees')
          .insert({ name: treeName, type: 'goal_tree' })
          .select()
          .single();

        if (treeError) throw treeError;
        treeId = treeData.id;
        setCurrentTreeId(treeId);
      }

      // Save nodes
      const nodeRecords = nodes.map((node) => ({
        tree_id: treeId,
        id: node.id,
        type: node.type || 'condition',
        text: node.data.label,
        position_x: node.position.x,
        position_y: node.position.y,
      }));

      if (nodeRecords.length > 0) {
        const { error: nodesError } = await supabase.from('nodes').insert(nodeRecords);
        if (nodesError) throw nodesError;
      }

      // Save edges
      const edgeRecords = edges.map((edge) => ({
        tree_id: treeId,
        source_node_id: edge.source,
        target_node_id: edge.target,
      }));

      if (edgeRecords.length > 0) {
        const { error: edgesError } = await supabase.from('edges').insert(edgeRecords);
        if (edgesError) throw edgesError;
      }

      toast.success('Tree saved successfully!');
    } catch (error) {
      console.error('Error saving tree:', error);
      toast.error('Failed to save tree');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = useCallback(async () => {
    setIsImporting(true);

    try {
      // Use file input adapter to open file picker
      const fileInputAdapter = new BrowserFileInputAdapter();
      const file = await fileInputAdapter.openFilePicker();

      if (!file) {
        // User cancelled file selection
        setIsImporting(false);
        return;
      }

      // Read the CSV file
      const fileResult = await readCSVFile(file);

      if (!fileResult.success) {
        toast.error(fileResult.error || 'Failed to read file');
        setIsImporting(false);
        return;
      }

      // Parse the CSV content
      const parseResult = parseCSVImport(fileResult.content!);

      if (!parseResult.success) {
        toast.error(parseResult.error || 'Failed to parse CSV file');
        setIsImporting(false);
        return;
      }

      // Reconstruct tree data with edit handlers
      const { nodes: importedNodes, edges: importedEdges } = reconstructTreeData(
        parseResult.data!,
        handleEditNode
      );

      // Update canvas with imported data
      setNodes(importedNodes);
      setEdges(importedEdges);

      // Update tree name and clear current tree ID
      setTreeName(parseResult.data!.treeName);
      setCurrentTreeId(null);

      toast.success('Tree imported successfully!');
    } catch (error) {
      console.error('Error importing tree:', error);
      toast.error('Failed to import tree data');
    } finally {
      setIsImporting(false);
    }
  }, [setNodes, setEdges, setTreeName, setCurrentTreeId, handleEditNode]);

  const handleClear = useCallback(() => {
    if (confirm('Are you sure you want to clear the canvas?')) {
      setNodes([]);
      setEdges([]);
      setCurrentTreeId(null);
      setTreeName('My Goal Tree');
    }
  }, [setNodes, setEdges]);

  const handleExport = useCallback(async () => {
    if (nodes.length === 0) {
      toast.error('No tree data to export');
      return;
    }

    setIsExporting(true);

    try {
      exportTreeToCSV(nodes, edges, treeName);
      toast.success('Tree exported successfully!');
    } catch (error) {
      console.error('Error exporting tree:', error);
      toast.error('Failed to export tree');
    } finally {
      setIsExporting(false);
    }
  }, [nodes, edges, treeName]);

  return (
    <div className="w-full h-screen bg-[hsl(var(--canvas-bg))]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[hsl(var(--canvas-bg))]"
      >
        <Controls className="bg-card border border-border rounded-lg" />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="bg-[hsl(var(--canvas-bg))]"
          color="hsl(var(--canvas-grid))"
        />
        <TreeToolbar
          treeName={treeName}
          onTreeNameChange={setTreeName}
          onAddNode={handleAddNode}
          onAutoLayout={handleAutoLayout}
          onSave={handleSave}
          onImport={handleImport}
          onClear={handleClear}
          onExport={handleExport}
          isSaving={isSaving}
          isExporting={isExporting}
          isImporting={isImporting}
          hasTreeData={nodes.length > 0}
        />
      </ReactFlow>
    </div>
  );
}
