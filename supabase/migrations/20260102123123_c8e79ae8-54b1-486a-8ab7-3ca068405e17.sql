-- Add WhatsApp group link column to platform_config
ALTER TABLE public.platform_config
ADD COLUMN whatsapp_group_link TEXT DEFAULT NULL;

-- Set the initial WhatsApp group link value
UPDATE public.platform_config 
SET whatsapp_group_link = 'https://chat.whatsapp.com/FKAM6CFGaXNHbETma0WDMr'
WHERE id = 1;