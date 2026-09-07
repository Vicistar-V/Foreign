-- Update platform config to use new percentage splits
-- Reduce winners from 20% to 15%, increase protected from 50% to 45%
UPDATE platform_config 
SET 
  beneficiary_percentage = 15,
  protected_percentage = 45,
  updated_at = now()
WHERE id = 1;