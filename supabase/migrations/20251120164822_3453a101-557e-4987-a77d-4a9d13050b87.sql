-- ============================================
-- PART 1: THE FOUNDATION - DATABASE STRUCTURE
-- ============================================

-- Create enum types for better data integrity
CREATE TYPE public.wallet_type AS ENUM ('earnings', 'deposit', 'credits', 'system');
CREATE TYPE public.transaction_type AS ENUM ('membership_bonus', 'deposit', 'drop_entry', 'drop_win', 'drop_refund', 'withdrawal', 'debt_reversal', 'platform_fee', 'subsidy');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE public.result_status AS ENUM ('pending', 'beneficiary', 'protected', 'contributor');
CREATE TYPE public.event_type AS ENUM ('winner_alert', 'refund_notice', 'withdrawal_complete', 'welcome', 'debt_warning');
CREATE TYPE public.event_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ============================================
-- TABLE 1: THE MEMBER IDENTITY CARD (profiles)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by_code TEXT,
  is_name_locked BOOLEAN NOT NULL DEFAULT false,
  pin_hash TEXT,
  is_member BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TABLE 2: THE MONEY LOGBOOK (transactions)
-- ============================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_type wallet_type NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  transaction_type transaction_type NOT NULL,
  description TEXT NOT NULL,
  payment_reference TEXT UNIQUE,
  status transaction_status NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_wallet ON public.transactions(user_id, wallet_type);
CREATE INDEX idx_transactions_reference ON public.transactions(payment_reference) WHERE payment_reference IS NOT NULL;

-- ============================================
-- TABLE 3: THE DAILY ENTRY TICKET (drop_entries)
-- ============================================
CREATE TABLE public.drop_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_amount DECIMAL(12, 2) NOT NULL,
  cash_amount DECIMAL(12, 2) NOT NULL,
  credit_amount DECIMAL(12, 2) NOT NULL,
  entry_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  result_status result_status NOT NULL DEFAULT 'pending',
  win_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, drop_date)
);

CREATE INDEX idx_drop_entries_date_status ON public.drop_entries(drop_date, result_status);
CREATE INDEX idx_drop_entries_user_date ON public.drop_entries(user_id, drop_date DESC);

-- ============================================
-- TABLE 4: THE LIVE BALANCE BOARD (user_balances)
-- ============================================
CREATE TABLE public.user_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  earnings_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  deposit_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  credits_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TABLE 5: THE CONTROL PANEL (platform_config)
-- ============================================
CREATE TABLE public.platform_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  membership_fee DECIMAL(12, 2) NOT NULL DEFAULT 1000,
  drop_entry_fee DECIMAL(12, 2) NOT NULL DEFAULT 200,
  referral_cash_bonus DECIMAL(12, 2) NOT NULL DEFAULT 500,
  referral_credit_bonus DECIMAL(12, 2) NOT NULL DEFAULT 20,
  platform_fee_percentage DECIMAL(5, 2) NOT NULL DEFAULT 10,
  protected_percentage DECIMAL(5, 2) NOT NULL DEFAULT 50,
  beneficiary_percentage DECIMAL(5, 2) NOT NULL DEFAULT 20,
  minimum_withdrawal DECIMAL(12, 2) NOT NULL DEFAULT 1000,
  is_drop_active BOOLEAN NOT NULL DEFAULT true,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT only_one_config CHECK (id = 1),
  CONSTRAINT valid_percentages CHECK (protected_percentage + beneficiary_percentage <= 100)
);

-- Insert default configuration
INSERT INTO public.platform_config (id) VALUES (1);

-- ============================================
-- TABLE 6: THE BANK ACCOUNTS FILE (withdrawal_accounts)
-- ============================================
CREATE TABLE public.withdrawal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, account_number)
);

CREATE INDEX idx_withdrawal_accounts_user ON public.withdrawal_accounts(user_id);

-- ============================================
-- TABLE 7: THE NOTIFICATION QUEUE (event_queue)
-- ============================================
CREATE TABLE public.event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type event_type NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  status event_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_queue_status ON public.event_queue(status, created_at) WHERE status = 'pending';

-- ============================================
-- TABLE 8: USER ROLES (for admin functionality)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drop_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DATABASE FUNCTIONS
-- ============================================

-- Function to check if user has a specific role (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function 1: check_balance - Get current balance for a wallet
CREATE OR REPLACE FUNCTION public.check_balance(_user_id UUID, _wallet_type wallet_type)
RETURNS DECIMAL(12, 2)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.transactions
  WHERE user_id = _user_id AND wallet_type = _wallet_type
$$;

-- Function 2: can_join_drop - Check if user is eligible to join today's drop
CREATE OR REPLACE FUNCTION public.can_join_drop(_user_id UUID)
RETURNS TABLE(can_join BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_joined BOOLEAN;
  v_has_debt BOOLEAN;
  v_drop_active BOOLEAN;
  v_entry_fee DECIMAL(12, 2);
  v_total_available DECIMAL(12, 2);
  v_is_member BOOLEAN;
BEGIN
  -- Check if user is a member
  SELECT is_member INTO v_is_member FROM public.profiles WHERE id = _user_id;
  IF NOT v_is_member THEN
    RETURN QUERY SELECT false, 'You must activate your membership first';
    RETURN;
  END IF;

  -- Check if already joined today
  SELECT EXISTS(
    SELECT 1 FROM public.drop_entries 
    WHERE user_id = _user_id AND drop_date = CURRENT_DATE
  ) INTO v_already_joined;
  
  IF v_already_joined THEN
    RETURN QUERY SELECT false, 'You have already joined today';
    RETURN;
  END IF;

  -- Check for negative balances
  SELECT EXISTS(
    SELECT 1 FROM public.user_balances
    WHERE user_id = _user_id 
    AND (earnings_balance < 0 OR deposit_balance < 0 OR credits_balance < 0)
  ) INTO v_has_debt;
  
  IF v_has_debt THEN
    RETURN QUERY SELECT false, 'Please clear your account debt first';
    RETURN;
  END IF;

  -- Check if drop is active
  SELECT is_drop_active, drop_entry_fee INTO v_drop_active, v_entry_fee
  FROM public.platform_config WHERE id = 1;
  
  IF NOT v_drop_active THEN
    RETURN QUERY SELECT false, 'Daily drop is currently closed';
    RETURN;
  END IF;

  -- Check if user has enough funds
  SELECT COALESCE(deposit_balance, 0) + COALESCE(credits_balance, 0)
  INTO v_total_available
  FROM public.user_balances
  WHERE user_id = _user_id;
  
  IF v_total_available < v_entry_fee THEN
    RETURN QUERY SELECT false, 'Insufficient funds. Please add money to your deposit wallet';
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT true, 'You can join the drop';
END;
$$;

-- Function 3: verify_pin - Check if PIN is correct
CREATE OR REPLACE FUNCTION public.verify_pin(_user_id UUID, _pin_attempt TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_hash TEXT;
BEGIN
  SELECT pin_hash INTO v_stored_hash
  FROM public.profiles
  WHERE id = _user_id;
  
  IF v_stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Use crypt to compare (requires pgcrypto extension)
  RETURN v_stored_hash = crypt(_pin_attempt, v_stored_hash);
END;
$$;

-- Function 4: lock_profile_name - Lock user's name
CREATE OR REPLACE FUNCTION public.lock_profile_name(_user_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET is_name_locked = true
  WHERE id = _user_id
$$;

-- Enable pgcrypto for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- DATABASE TRIGGERS
-- ============================================

-- Trigger 1: Generate Referral Code on profile creation
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Generate unique referral code
  LOOP
    -- Generate code: VIK + 3 random alphanumeric characters
    v_code := 'VIK' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 3));
    
    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  NEW.referral_code := v_code;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_generate_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL OR NEW.referral_code = '')
  EXECUTE FUNCTION public.generate_referral_code();

-- Trigger 2: Update Live Balances when transaction is inserted
CREATE OR REPLACE FUNCTION public.update_user_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update user_balances
  INSERT INTO public.user_balances (user_id, earnings_balance, deposit_balance, credits_balance, last_updated)
  VALUES (
    NEW.user_id,
    CASE WHEN NEW.wallet_type = 'earnings' THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.wallet_type = 'deposit' THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.wallet_type = 'credits' THEN NEW.amount ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    earnings_balance = user_balances.earnings_balance + CASE WHEN NEW.wallet_type = 'earnings' THEN NEW.amount ELSE 0 END,
    deposit_balance = user_balances.deposit_balance + CASE WHEN NEW.wallet_type = 'deposit' THEN NEW.amount ELSE 0 END,
    credits_balance = user_balances.credits_balance + CASE WHEN NEW.wallet_type = 'credits' THEN NEW.amount ELSE 0 END,
    last_updated = now();
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_user_balances
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balances();

-- Trigger 3: Create Profile After Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, referred_by_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'referred_by_code'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Policies for profiles table
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own unlocked profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id AND NOT is_name_locked)
  WITH CHECK (auth.uid() = id AND NOT is_name_locked);

-- Policies for transactions table
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for drop_entries table
CREATE POLICY "Users can view their own entries"
  ON public.drop_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for user_balances table
CREATE POLICY "Users can view their own balance"
  ON public.user_balances FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for platform_config table (everyone can read)
CREATE POLICY "Everyone can view platform config"
  ON public.platform_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update platform config"
  ON public.platform_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policies for withdrawal_accounts table
CREATE POLICY "Users can view their own bank accounts"
  ON public.withdrawal_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bank accounts"
  ON public.withdrawal_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank accounts"
  ON public.withdrawal_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank accounts"
  ON public.withdrawal_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for event_queue table (system only)
-- No policies - only edge functions can access

-- Policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));