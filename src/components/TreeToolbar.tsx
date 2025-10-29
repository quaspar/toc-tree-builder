import { Target, Star, CheckCircle2, CircleDot, Layers, Save, FolderOpen, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TreeToolbarProps = {
  treeName: string;
  onTreeNameChange: (name: string) => void;
  onAddNode: (type: 'goal' | 'csf' | 'condition' | 'and') => void;
  onAutoLayout: () => void;
  onSave: () => void;
  onLoad: (treeId: string) => void;
  onClear: () => void;
  onExport: () => void;
  availableTrees: Array<{ id: string; name: string }>;
  isSaving: boolean;
  isExporting: boolean;
  hasTreeData: boolean;
};

export function TreeToolbar({
  treeName,
  onTreeNameChange,
  onAddNode,
  onAutoLayout,
  onSave,
  onLoad,
  onClear,
  onExport,
  availableTrees,
  isSaving,
  isExporting,
  hasTreeData,
}: TreeToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 bg-card rounded-xl border border-border shadow-lg p-4 max-w-xs">
      <div className="space-y-1.5">
        <Label htmlFor="tree-name" className="text-xs font-medium">Tree Name</Label>
        <Input
          id="tree-name"
          value={treeName}
          onChange={(e) => onTreeNameChange(e.target.value)}
          placeholder="My Goal Tree"
          className="h-8"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium">Add Node</Label>
        <div className="flex gap-1.5">
          <Button
            onClick={() => onAddNode('goal')}
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Target className="w-3.5 h-3.5 mr-1" />
            Goal
          </Button>
          <Button
            onClick={() => onAddNode('csf')}
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
          >
            <Star className="w-3.5 h-3.5 mr-1" />
            CSF
          </Button>
          <Button
            onClick={() => onAddNode('condition')}
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs border-success text-success hover:bg-success hover:text-success-foreground"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Condition
          </Button>
        </div>
        <Button
          onClick={() => onAddNode('and')}
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs border-accent text-accent hover:bg-accent hover:text-accent-foreground"
        >
          <CircleDot className="w-3.5 h-3.5 mr-1" />
          AND
        </Button>
      </div>

      <Button
        onClick={onAutoLayout}
        size="sm"
        variant="outline"
        className="h-8 text-xs"
      >
        <Layers className="w-3.5 h-3.5 mr-1.5" />
        Auto Layout
      </Button>

      <Button
        onClick={onExport}
        size="sm"
        variant="outline"
        disabled={!hasTreeData || isExporting}
        className="h-8 text-xs"
      >
        <Download className="w-3.5 h-3.5 mr-1.5" />
        {isExporting ? 'Exporting...' : 'Export CSV'}
      </Button>

      <div className="border-t border-border pt-3 space-y-2">
        <Button
          onClick={onSave}
          size="sm"
          disabled={isSaving}
          className="w-full h-8 text-xs bg-primary hover:bg-primary/90"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {isSaving ? 'Saving...' : 'Save Tree'}
        </Button>

        {availableTrees.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="load-tree" className="text-xs font-medium">Load Tree</Label>
            <Select onValueChange={onLoad}>
              <SelectTrigger id="load-tree" className="h-8 text-xs">
                <SelectValue placeholder="Select a tree..." />
              </SelectTrigger>
              <SelectContent>
                {availableTrees.map((tree) => (
                  <SelectItem key={tree.id} value={tree.id} className="text-xs">
                    {tree.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          onClick={onClear}
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          Clear Canvas
        </Button>
      </div>
    </div>
  );
}
