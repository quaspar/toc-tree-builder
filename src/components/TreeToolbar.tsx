import { Target, Star, CheckCircle2, CircleDot, Layers, Upload, Trash2, Download, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type TreeToolbarProps = {
  treeName: string;
  onTreeNameChange: (name: string) => void;
  onAddNode: (type: 'goal' | 'csf' | 'condition' | 'and') => void;
  onAutoLayout: () => void;
  onImport: () => void;
  onClear: () => void;
  onExport: () => void;
  isExporting: boolean;
  isImporting: boolean;
  hasTreeData: boolean;
};

export function TreeToolbar({
  treeName,
  onTreeNameChange,
  onAddNode,
  onAutoLayout,
  onImport,
  onClear,
  onExport,
  isExporting,
  isImporting,
  hasTreeData,
}: TreeToolbarProps) {
  return (
    <>
      {/* Main toolbar - left side */}
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
      </div>

      {/* File operations menu - top right */}
      <div className="absolute top-4 right-4 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0 bg-card border border-border shadow-lg"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={onExport}
              disabled={!hasTreeData || isExporting}
              className="cursor-pointer"
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </DropdownMenuItem>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem
                    onClick={hasTreeData ? undefined : onImport}
                    disabled={hasTreeData || isImporting}
                    className={hasTreeData ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isImporting ? 'Importing...' : 'Import from File'}
                  </DropdownMenuItem>
                </TooltipTrigger>
                {hasTreeData && (
                  <TooltipContent>
                    <p>Clear canvas first to import a file</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onClear}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Canvas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
