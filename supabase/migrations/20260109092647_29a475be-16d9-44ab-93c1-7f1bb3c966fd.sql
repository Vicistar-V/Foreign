-- Turn on auto_compound for Victor Chiemerie, Chinedu, and Vivian
UPDATE profiles 
SET auto_compound_enabled = true 
WHERE id IN (
  'b23d5dd6-3f5d-49a7-8ad9-62a1feb17dc2',  -- Victor Chiemerie
  'f73e5c41-41cf-4a8a-a64c-1d4aacf5e4f3',  -- Chinedu Joseph ibeh
  'dae463a3-767c-46fe-bed7-a9d27f9a4548'   -- Vivian Ikechi Wike
);