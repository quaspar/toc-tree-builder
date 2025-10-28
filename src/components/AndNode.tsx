import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from './GoalNode';

const AndNode = ({ id }: NodeProps<NodeData>) => {
  return (
    <div className="relative">
      <Handle type="source" position={Position.Top} className="!bg-accent" />
      <div className="w-16 h-16 rounded-full border-2 border-accent bg-card shadow-[var(--shadow-node)] flex items-center justify-center hover:shadow-[var(--shadow-elevated)] transition-shadow">
        <span className="text-xs font-bold text-accent">AND</span>
      </div>
      <Handle type="target" position={Position.Bottom} className="!bg-accent" />
    </div>
  );
};

export default memo(AndNode);
