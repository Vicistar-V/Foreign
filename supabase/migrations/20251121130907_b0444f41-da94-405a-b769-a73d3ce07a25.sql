-- Fix referral commission trigger to prevent money creation
-- This trigger should DISTRIBUTE existing money, not CREATE new money

DROP TRIGGER IF EXISTS process_referral_commission_trigger ON public.transactions;
DROP FUNCTION IF EXISTS public.process_referral_commission();

CREATE OR REPLACE FUNCTION public.process_referral_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_referrer_id UUID;
  v_referred_by_code TEXT;
  v_config RECORD;
  v_original_user_id UUID;
BEGIN
  -- Only process MEMBERSHIP_FEE transactions that are completed
  -- NOT regular deposits! This is critical to prevent money creation
  IF NEW.transaction_type != 'membership_fee' OR NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Extract the ORIGINAL user who paid (stored in metadata when payment went to SYSTEM)
  v_original_user_id := (NEW.metadata->>'original_user_id')::uuid;
  
  IF v_original_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing original_user_id in metadata for membership_fee transaction';
  END IF;

  -- Get platform configuration
  SELECT referral_cash_bonus, referral_credit_bonus, membership_fee
  INTO v_config
  FROM public.platform_config
  WHERE id = 1;

  -- Verify amount matches membership fee (safety check)
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
      -- Credit referrer with cash bonus (₦500) to Earnings wallet
      -- This DISTRIBUTES part of the ₦1000 already in SYSTEM
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

      -- Credit referrer with credit bonus (₦20) to Credits wallet
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

      -- SYSTEM keeps the remainder (₦1000 - ₦500 - ₦20 = ₦480)
      -- No additional transaction needed - SYSTEM already has the ₦1000
      -- The money is just distributed, not created
    END IF;
  END IF;
  
  -- In BOTH cases (with or without referrer), mark user as member and lock name
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