import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Target } from 'lucide-react';

export type NodeData = {
  label: string;
  onEdit: (id: string, text: string) => void;
};

const GoalNode = ({ id, data }: NodeProps<NodeData>) => {
  const handleDoubleClick = useCallback(() => {
    const newText = prompt('Edit goal:', data.label);
    if (newText !== null && newText.trim()) {
      data.onEdit(id, newText.trim());
    }
  }, [id, data]);

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className="px-6 py-4 rounded-xl border-2 border-primary bg-card shadow-[var(--shadow-node)] min-w-[200px] cursor-pointer hover:shadow-[var(--shadow-elevated)] transition-shadow"
    >
      <Handle type="source" position={Position.Top} className="!bg-primary" />
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-primary" />
        <div className="font-semibold text-primary">GOAL</div>
      </div>
      <div className="mt-2 text-sm text-foreground">{data.label}</div>
      <Handle type="target" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
};

export default memo(GoalNode);
