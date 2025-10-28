import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Star } from 'lucide-react';
import { NodeData } from './GoalNode';

const CsfNode = ({ id, data }: NodeProps<NodeData>) => {
  const handleDoubleClick = useCallback(() => {
    const newText = prompt('Edit Critical Success Factor:', data.label);
    if (newText !== null && newText.trim()) {
      data.onEdit(id, newText.trim());
    }
  }, [id, data]);

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className="px-5 py-3 rounded-lg border-2 border-secondary bg-card shadow-[var(--shadow-node)] min-w-[180px] cursor-pointer hover:shadow-[var(--shadow-elevated)] transition-shadow"
    >
      <Handle type="source" position={Position.Top} className="!bg-secondary" />
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-secondary" />
        <div className="font-medium text-sm text-secondary">CSF</div>
      </div>
      <div className="mt-1.5 text-sm text-foreground">{data.label}</div>
      <Handle type="target" position={Position.Bottom} className="!bg-secondary" />
    </div>
  );
};

export default memo(CsfNode);
