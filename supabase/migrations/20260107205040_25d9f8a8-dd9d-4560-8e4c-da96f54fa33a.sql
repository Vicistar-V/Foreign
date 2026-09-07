-- =====================================================
-- DELETE ILLEGITIMATE MACHINES CREATED BY GENESIS BUG
-- These were created without proper ledger entries
-- =====================================================

-- 1. Delete Machine 3 for Victor Chiemerie (spot_id: 10556fe9-67be-4b14-a7c0-8301139a9651)
-- First delete the drop, then the spot
DELETE FROM drops WHERE spot_id = '10556fe9-67be-4b14-a7c0-8301139a9651';
DELETE FROM spots WHERE id = '10556fe9-67be-4b14-a7c0-8301139a9651';

-- 2. Delete Machine 2 for Vivian Ikechi Wike (spot_id: 7aed7a34-bccd-4f26-94db-a19b93e60f72)
-- First delete the drop, then the spot
DELETE FROM drops WHERE spot_id = '7aed7a34-bccd-4f26-94db-a19b93e60f72';
DELETE FROM spots WHERE id = '7aed7a34-bccd-4f26-94db-a19b93e60f72';