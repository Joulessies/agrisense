-- Migration 100: Allow public delete on nodes table
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nodes_public_delete" ON public.nodes;
CREATE POLICY "nodes_public_delete" ON public.nodes FOR DELETE TO public USING (true);
