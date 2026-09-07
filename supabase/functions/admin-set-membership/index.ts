import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied. Admin role required.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userId, adminPin } = await req.json();

    // Validate inputs
    if (!userId || !adminPin) {
      return new Response(
        JSON.stringify({ success: false, error: 'User ID and PIN are required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('admin-set-membership: Verifying admin PIN');

    // Verify admin's PIN
    const { data: pinVerification, error: pinError } = await supabase.functions.invoke('verify-pin', {
      body: { pin: adminPin },
      headers: { Authorization: authHeader },
    });

    if (pinError || !pinVerification?.valid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid PIN' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('admin-set-membership: PIN verified, activating membership for user:', userId);

    // Get user's name and referral info before updating
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, is_member, referred_by_code')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.is_member) {
      return new Response(
        JSON.stringify({ success: false, error: 'User is already a member' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user profile to activate membership
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_member: true,
        is_name_locked: true,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('admin-set-membership: Failed to update profile:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to activate membership' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a membership_fee transaction to track activation date
    // This is used for analytics - amount is 0 for admin activations
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        wallet_type: 'earnings',
        amount: 0,
        transaction_type: 'membership_fee',
        description: `Admin activation for ${profile.full_name}`,
        status: 'completed',
        metadata: {
          activated_by: 'admin',
          admin_id: user.id,
        },
      });

    if (transactionError) {
      console.error('admin-set-membership: Failed to create tracking transaction:', transactionError);
      // Don't fail the whole operation - membership is already active
    }

    // ===== AUTO-CREATE FIRST SPOT VIA BUY-SPOT EDGE FUNCTION =====
    let spotCreated = false;
    let spotPosition: number | null = null;

    try {
      console.log('admin-set-membership: Fetching platform config for spot creation...');
      
      // Get platform config for drop system settings
      const { data: dropConfig, error: configError } = await supabase
        .from('platform_config')
        .select('drop_entry_fee, drop_system_active')
        .eq('id', 1)
        .single();

      if (configError) {
        console.error('admin-set-membership: Failed to fetch platform config:', configError);
      }

      // Only create spot if drop system is active
      if (dropConfig?.drop_system_active) {
        const entryFee = dropConfig.drop_entry_fee || 5000;
        
        console.log('admin-set-membership: Creating subsidy transaction for spot entry fee:', entryFee);
        
        // Step 1: Credit user's deposit wallet with subsidy for their first spot
        const { error: subsidyError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            wallet_type: 'deposit',
            amount: entryFee,
            transaction_type: 'subsidy',
            description: 'Activation payment for your first ad share',
            status: 'completed',
            metadata: { 
              source: 'admin_activation', 
              auto_spot: true,
              admin_id: user.id,
              purpose: 'first_spot_entry_fee'
            }
          });

        if (subsidyError) {
          console.error('admin-set-membership: Failed to create subsidy transaction:', subsidyError);
        } else {
          // Cache is auto-refreshed by trigger on transactions insert
          console.log('admin-set-membership: Subsidy credited, calling buy-spot Edge Function...');
          
          // Step 2: Call buy-spot Edge Function with service role key
          // This handles everything: create spot, deduct wallet, add to queue, trigger distribution
          const buySpotResponse = await fetch(`${supabaseUrl}/functions/v1/buy-spot`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              target_user_id: userId,
              source_wallet: 'deposit',
              skip_membership_check: true, // User was JUST activated, allow spot creation
              idempotency_key: `admin_set_membership::${userId}::first_spot`,
            }),
          });

          const spotResult = await buySpotResponse.json();

          if (!buySpotResponse.ok || spotResult.error) {
            console.error('admin-set-membership: buy-spot Edge Function failed:', spotResult.error);
            // Log but don't fail - the subsidy is there, user can manually create spot
          } else if (spotResult.success) {
            spotCreated = true;
            spotPosition = spotResult.position || null;
            console.log('admin-set-membership: Spot created successfully at position', spotPosition);
            console.log('✅ Distribution triggered automatically by buy-spot!');
          }
        }
      } else {
        console.log('admin-set-membership: Drop system is not active, skipping spot creation');
      }
    } catch (spotCreationError) {
      console.error('admin-set-membership: Spot creation error (non-critical):', spotCreationError);
      // Don't fail - user is still activated as member
    }

    // ===== CREATE PENDING REFERRAL BONUS (if user was referred) =====
    if (profile.referred_by_code && 
        profile.referred_by_code !== 'SYSTEM' && 
        profile.referred_by_code.trim() !== '') {
      try {
        console.log('admin-set-membership: Paying instant referral bonus to referrer code:', profile.referred_by_code);
        
        const { error: bonusError } = await supabase.rpc('pay_referrer_activation_bonus', {
          _referee_id: userId,
          _referred_by_code: profile.referred_by_code
        });
        
        if (bonusError) {
          console.error('admin-set-membership: Failed to pay referral bonus (non-critical):', bonusError);
        } else {
          console.log('admin-set-membership: Referral activation bonus paid instantly to referrer');
        }
      } catch (bonusCreationError) {
        console.error('admin-set-membership: Bonus creation error (non-critical):', bonusCreationError);
      }
    }

    // Queue welcome notification with spot info
    const welcomeMessage = spotCreated 
      ? `You're in! Your first ad share is now working in a campaign. Start picking pictures today.`
      : `Your membership is now active. Start earning today!`;

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        notification_type: 'welcome',
        title: 'Welcome to Viketa!',
        message: welcomeMessage,
        metadata: {
          activated_by: 'admin',
          admin_id: user.id,
          spot_created: spotCreated,
          spot_position: spotPosition,
        },
        link: '/dashboard',
      });

    if (notificationError) {
      console.error('admin-set-membership: Failed to queue notification:', notificationError);
    }

    // Send Telegram alert for admin activation (non-blocking)
    try {
      console.log('admin-set-membership: Sending Telegram alert');
      await supabase.functions.invoke('send-telegram-alert', {
        body: {
          alertType: 'activation',
          userName: profile.full_name,
          userPhone: 'Admin Override',
          amount: 0,
          referrerCode: null,
          referrerName: null,
          referrerBonus: 0,
          userId: userId,
          adminActivation: true,
          spotCreated: spotCreated,
          spotPosition: spotPosition,
        }
      });
      console.log('admin-set-membership: Telegram alert sent');
    } catch (telegramError) {
      console.error('admin-set-membership: Telegram alert failed:', telegramError);
    }

    const successMessage = spotCreated
      ? `${profile.full_name} has been activated and now has an ad share in a campaign`
      : `${profile.full_name} has been activated as a member`;

    console.log('admin-set-membership: Success -', successMessage);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: successMessage,
        spotCreated: spotCreated,
        spotPosition: spotPosition,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('admin-set-membership: Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
