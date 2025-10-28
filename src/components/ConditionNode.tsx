import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CheckCircle2 } from 'lucide-react';
import { NodeData } from './GoalNode';

const ConditionNode = ({ id, data }: NodeProps<NodeData>) => {
  const handleDoubleClick = useCallback(() => {
    const newText = prompt('Edit Necessary Condition:', data.label);
    if (newText !== null && newText.trim()) {
      data.onEdit(id, newText.trim());
    }
  }, [id, data]);

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className="px-4 py-2.5 rounded-lg border border-success bg-card shadow-[var(--shadow-node)] min-w-[160px] cursor-pointer hover:shadow-[var(--shadow-elevated)] transition-shadow"
    >
      <Handle type="source" position={Position.Top} className="!bg-success" />
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-success" />
        <div className="font-medium text-xs text-success">CONDITION</div>
      </div>
      <div className="mt-1 text-sm text-foreground">{data.label}</div>
      <Handle type="target" position={Position.Bottom} className="!bg-success" />
    </div>
  );
};

export default memo(ConditionNode);
