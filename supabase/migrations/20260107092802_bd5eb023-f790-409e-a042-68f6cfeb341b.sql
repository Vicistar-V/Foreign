-- Delete drops first (foreign key constraint)
DELETE FROM drops WHERE spot_id = 'ea425ff3-85a4-4268-beaa-a7862071f57e';

-- Delete the spot
DELETE FROM spots WHERE id = 'ea425ff3-85a4-4268-beaa-a7862071f57e';