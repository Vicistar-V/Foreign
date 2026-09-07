-- Add new transaction types for proper voucher accounting
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'referral_payout';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'voucher_issuance';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'credit_redemption';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'admin_expense';

-- Drop the correct trigger and recreate function with proper SYSTEM debits
DROP TRIGGER IF EXISTS process_referral_commission_trigger ON public.transactions;
DROP FUNCTION IF EXISTS public.process_referral_commission() CASCADE;

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

  -- Get platform configuration
  SELECT referral_cash_bonus, referral_credit_bonus, membership_fee
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

      -- 2. DEBIT SYSTEM for cash bonus (PROPER ACCOUNTING - NEW!)
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

      -- 4. DEBIT SYSTEM for voucher issuance (PROPER ACCOUNTING - NEW!)
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
  
  -- Mark user as member and lock name
  UPDATE public.profiles
  SET is_member = true, is_name_locked = true
  WHERE id = v_original_user_id;

  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER process_referral_commission_trigger
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.process_referral_commission();