-- ============================================
-- WELCOME BONUS SYSTEM MIGRATION
-- Adds 2 Free Credits (₦400) to new members
-- ============================================

-- STEP 1: Add welcome_bonus column to platform_config
ALTER TABLE platform_config 
ADD COLUMN IF NOT EXISTS welcome_bonus NUMERIC DEFAULT 400;

-- STEP 2: Set the welcome bonus value (₦400 = 2 Credits)
UPDATE platform_config SET welcome_bonus = 400 WHERE id = 1;

-- STEP 3: Add 'welcome_bonus' to transaction_type enum
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'welcome_bonus';

-- STEP 4: Update the process_referral_commission trigger to include welcome bonus
CREATE OR REPLACE FUNCTION public.process_referral_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referrer_id UUID;
  v_referred_by_code TEXT;
  v_config RECORD;
  v_original_user_id UUID;
BEGIN
  -- Only process MEMBERSHIP_FEE transactions that are completed
  IF NEW.transaction_type != 'membership_fee' OR NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Extract the ORIGINAL user who paid
  v_original_user_id := (NEW.metadata->>'original_user_id')::uuid;
  
  IF v_original_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing original_user_id in metadata for membership_fee transaction';
  END IF;

  -- Get platform configuration (now includes welcome_bonus)
  SELECT referral_cash_bonus, referral_credit_bonus, membership_fee, welcome_bonus
  INTO v_config
  FROM public.platform_config
  WHERE id = 1;

  -- Verify amount matches membership fee
  IF NEW.amount != v_config.membership_fee THEN
    RAISE EXCEPTION 'Amount mismatch: expected %, got %', v_config.membership_fee, NEW.amount;
  END IF;

  -- Get the original user's referral information
  SELECT referred_by_code INTO v_referred_by_code
  FROM public.profiles
  WHERE id = v_original_user_id;

  -- If user was referred by someone, DISTRIBUTE the money
  IF v_referred_by_code IS NOT NULL AND v_referred_by_code != '' AND v_referred_by_code != 'SYSTEM' THEN
    -- Find the referrer's user_id
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = v_referred_by_code;

    IF v_referrer_id IS NOT NULL THEN
      -- 1. Credit referrer with cash bonus (₦500) to Earnings wallet
      INSERT INTO public.transactions (
        user_id,
        wallet_type,
        amount,
        transaction_type,
        description,
        status,
        metadata
      ) VALUES (
        v_referrer_id,
        'earnings',
        v_config.referral_cash_bonus,
        'membership_bonus',
        'Referral bonus for inviting new member',
        'completed',
        jsonb_build_object('original_user_id', v_original_user_id, 'referral_code', v_referred_by_code)
      );

      -- 2. DEBIT SYSTEM for cash bonus (PROPER ACCOUNTING)
      INSERT INTO public.transactions (
        user_id,
        wallet_type,
        amount,
        transaction_type,
        description,
        status,
        metadata
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', -- SYSTEM_TREASURY
        'earnings',
        -v_config.referral_cash_bonus, -- NEGATIVE: -₦500
        'referral_payout',
        'Cash commission paid to referrer',
        'completed',
        jsonb_build_object('beneficiary_id', v_referrer_id, 'original_user_id', v_original_user_id, 'referral_code', v_referred_by_code)
      );

      -- 3. Credit referrer with credit bonus (₦20) to Credits wallet
      INSERT INTO public.transactions (
        user_id,
        wallet_type,
        amount,
        transaction_type,
        description,
        status,
        metadata
      ) VALUES (
        v_referrer_id,
        'credits',
        v_config.referral_credit_bonus,
        'membership_bonus',
        'Referral discount voucher for inviting new member',
        'completed',
        jsonb_build_object('original_user_id', v_original_user_id, 'referral_code', v_referred_by_code)
      );

      -- 4. DEBIT SYSTEM for voucher issuance (PROPER ACCOUNTING)
      INSERT INTO public.transactions (
        user_id,
        wallet_type,
        amount,
        transaction_type,
        description,
        status,
        metadata
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', -- SYSTEM_TREASURY
        'earnings',
        -v_config.referral_credit_bonus, -- NEGATIVE: -₦20
        'voucher_issuance',
        'Discount voucher issued to referrer',
        'completed',
        jsonb_build_object('beneficiary_id', v_referrer_id, 'voucher_amount', v_config.referral_credit_bonus, 'original_user_id', v_original_user_id)
      );
    END IF;
  END IF;
  
  -- =====================================================
  -- NEW: Credit new member with WELCOME BONUS (2 Free Credits)
  -- =====================================================
  
  -- 5. Credit new member with welcome bonus to Credits wallet
  INSERT INTO public.transactions (
    user_id,
    wallet_type,
    amount,
    transaction_type,
    description,
    status,
    metadata
  ) VALUES (
    v_original_user_id,
    'credits',  -- Goes to Credits wallet (can't withdraw, must play)
    v_config.welcome_bonus,  -- ₦400 = 2 Credits
    'welcome_bonus',
    'Welcome Bonus: 2 Free Drop Credits',
    'completed',
    jsonb_build_object('membership_activation', true, 'credits_value', 2)
  );

  -- 6. DEBIT SYSTEM for welcome bonus (PROPER ACCOUNTING)
  INSERT INTO public.transactions (
    user_id,
    wallet_type,
    amount,
    transaction_type,
    description,
    status,
    metadata
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', -- SYSTEM_TREASURY
    'earnings',
    -v_config.welcome_bonus,  -- NEGATIVE: -₦400
    'voucher_issuance',
    'Welcome bonus issued to new member',
    'completed',
    jsonb_build_object('beneficiary_id', v_original_user_id, 'bonus_type', 'welcome', 'credits_value', 2)
  );
  
  -- Mark user as member and lock name
  UPDATE public.profiles
  SET is_member = true, is_name_locked = true
  WHERE id = v_original_user_id;

  RETURN NEW;
END;
$function$;