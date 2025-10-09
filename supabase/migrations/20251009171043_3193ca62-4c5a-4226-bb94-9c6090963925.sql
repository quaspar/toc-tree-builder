-- Create trees table to store different TOC thinking process diagrams
CREATE TABLE public.trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'goal_tree',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create nodes table to store individual nodes in the tree
CREATE TABLE public.nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID REFERENCES public.trees(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('goal', 'csf', 'condition')),
  text TEXT NOT NULL DEFAULT 'New Node',
  position_x FLOAT NOT NULL DEFAULT 0,
  position_y FLOAT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create edges table to store connections between nodes
CREATE TABLE public.edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID REFERENCES public.trees(id) ON DELETE CASCADE NOT NULL,
  source_node_id UUID REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  target_node_id UUID REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tree_id, source_node_id, target_node_id)
);

-- Enable Row Level Security
ALTER TABLE public.trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edges ENABLE ROW LEVEL SECURITY;

-- Create policies - making everything public for now (no auth required)
CREATE POLICY "Allow all operations on trees"
  ON public.trees FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on nodes"
  ON public.nodes FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on edges"
  ON public.edges FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_trees_updated_at
  BEFORE UPDATE ON public.trees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();