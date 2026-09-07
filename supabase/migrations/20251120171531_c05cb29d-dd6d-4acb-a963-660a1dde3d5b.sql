-- PART 2: THE SECURITY FORTRESS - TRIGGER 4: Process Referral Commission
-- This trigger automatically processes referral bonuses when membership is activated

CREATE OR REPLACE FUNCTION public.process_referral_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referred_by_code TEXT;
  v_config RECORD;
BEGIN
  -- Only process for membership-related transactions that are completed
  IF NEW.transaction_type != 'deposit' OR NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get platform configuration
  SELECT referral_cash_bonus, referral_credit_bonus, membership_fee
  INTO v_config
  FROM public.platform_config
  WHERE id = 1;

  -- Check if this is a membership payment (amount equals membership fee)
  IF NEW.amount != v_config.membership_fee THEN
    RETURN NEW;
  END IF;

  -- Get the user's referral information
  SELECT referred_by_code INTO v_referred_by_code
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- If user was referred by someone
  IF v_referred_by_code IS NOT NULL AND v_referred_by_code != '' AND v_referred_by_code != 'SYSTEM' THEN
    -- Find the referrer's user_id
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = v_referred_by_code;

    IF v_referrer_id IS NOT NULL THEN
      -- Credit referrer with cash bonus (₦500) to Earnings wallet
      INSERT INTO public.transactions (
        user_id,
        wallet_type,
        amount,
        transaction_type,
        description,
        status
      ) VALUES (
        v_referrer_id,
        'earnings',
        v_config.referral_cash_bonus,
        'membership_bonus',
        'Referral bonus for inviting new member',
        'completed'
      );

      -- Credit referrer with credit bonus (₦20) to Credits wallet
      INSERT INTO public.transactions (
        user_id,
        wallet_type,
        amount,
        transaction_type,
        description,
        status
      ) VALUES (
        v_referrer_id,
        'credits',
        v_config.referral_credit_bonus,
        'membership_bonus',
        'Referral discount voucher for inviting new member',
        'completed'
      );

      -- Credit SYSTEM_TREASURY with remaining platform share (₦1000 - ₦500 - ₦20 = ₦480)
      INSERT INTO public.transactions (
        user_id,
        wallet_type,
        amount,
        transaction_type,
        description,
        status
      ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        'earnings',
        v_config.membership_fee - v_config.referral_cash_bonus - v_config.referral_credit_bonus,
        'platform_fee',
        'Platform share of membership fee (after referral bonus)',
        'completed'
      );

      -- Mark user as member and lock their name
      UPDATE public.profiles
      SET is_member = true, is_name_locked = true
      WHERE id = NEW.user_id;

    ELSE
      -- Referral code invalid, give full amount to SYSTEM_TREASURY
      INSERT INTO public.transactions (
        user_id,
        wallet_type,
        amount,
        transaction_type,
        description,
        status
      ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        'earnings',
        v_config.membership_fee,
        'platform_fee',
        'Membership fee (invalid referral code)',
        'completed'
      );

      -- Mark user as member and lock their name
      UPDATE public.profiles
      SET is_member = true, is_name_locked = true
      WHERE id = NEW.user_id;
    END IF;
  ELSE
    -- No referrer, give full amount to SYSTEM_TREASURY (₦1000)
    INSERT INTO public.transactions (
      user_id,
      wallet_type,
      amount,
      transaction_type,
      description,
      status
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      'earnings',
      v_config.membership_fee,
      'platform_fee',
      'Membership fee (no referrer)',
      'completed'
    );

    -- Mark user as member and lock their name
    UPDATE public.profiles
    SET is_member = true, is_name_locked = true
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on transactions table
DROP TRIGGER IF EXISTS process_referral_commission_trigger ON public.transactions;
CREATE TRIGGER process_referral_commission_trigger
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.process_referral_commission();

-- Add documentation
COMMENT ON FUNCTION public.process_referral_commission() IS 'Trigger 4: Automatically processes referral commissions when membership payment is confirmed. Credits referrer with ₦500 cash + ₦20 voucher, sends remainder to SYSTEM_TREASURY, marks user as member, and locks profile name.';