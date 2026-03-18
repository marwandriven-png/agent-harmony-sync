-- Add UPDATE policy for agents to update their own properties
CREATE POLICY "Agents can update own properties" 
ON public.properties 
FOR UPDATE 
USING (created_by = auth.uid() OR is_admin());

-- Add DELETE policy for agents to delete their own properties
CREATE POLICY "Agents can delete own properties" 
ON public.properties 
FOR DELETE 
USING (created_by = auth.uid() OR is_admin());