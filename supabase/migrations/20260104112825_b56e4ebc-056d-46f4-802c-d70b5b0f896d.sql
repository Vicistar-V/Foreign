-- Step 1: Clear play history FIRST (has FK to pool)
DELETE FROM instant_play_history;

-- Step 2: Clear pool tickets
DELETE FROM instant_game_pool;

-- Step 3: Seed fresh batch of 2,000 tickets
SELECT seed_instant_pool(1);