import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendEmail(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Viketa <notifications@viketa.com>',
      to: [to],
      subject: subject,
      html: html
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Email failed: ${error}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Notification worker - Starting');

    // ============================================================
    // 📧 EMAIL MASTER SWITCH
    // ============================================================
    const { data: config } = await supabase
      .from('platform_config')
      .select('emails_enabled')
      .eq('id', 1)
      .single();

    const emailsEnabled = config?.emails_enabled ?? true;

    if (!emailsEnabled) {
      console.log('📧 Email sending is DISABLED - skipping email worker');
      return new Response(
        JSON.stringify({ success: true, message: 'Emails disabled', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // Fetch notifications that need email sending
    // We use metadata.email_sent = false to track which need emails
    // ============================================================
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .is('metadata->email_sent', null)  // Not yet processed for email
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) throw fetchError;

    if (!notifications || notifications.length === 0) {
      console.log('No pending notifications for email');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${notifications.length} notifications for email`);

    let successCount = 0;
    let failCount = 0;

    for (const notification of notifications) {
      try {
        // Get user email
        const { data: authUser } = await supabase.auth.admin.getUserById(notification.user_id);
        
        if (!authUser || !authUser.user?.email) {
          console.error('User not found or no email:', notification.user_id);
          // Mark as processed (no email)
          await supabase
            .from('notifications')
            .update({ 
              metadata: { 
                ...notification.metadata, 
                email_sent: false, 
                email_error: 'No email address' 
              } 
            })
            .eq('id', notification.id);
          failCount++;
          continue;
        }

        const email = authUser.user.email;
        let emailSent = false;
        let recipientEmail = email;

        // Check if this is an admin alert (use admin_email from metadata)
        if (notification.metadata?.admin_email) {
          recipientEmail = notification.metadata.admin_email;
        }

        // Generate email based on notification type
        switch (notification.notification_type) {
          // =====================================================
          // CRITICAL ADMIN ALERTS
          // =====================================================
          case 'withdrawal_failed': {
            const { user_id, amount, reference, error, timestamp } = notification.metadata || {};
            await sendEmail(
              recipientEmail,
              '🚨 CRITICAL: Withdrawal Failed',
              `
                <div style="background: #ffc; border: 2px solid #fa0; padding: 20px; border-radius: 8px;">
                  <h1 style="color: #fa0;">🚨 CRITICAL ALERT: Withdrawal Failed</h1>
                  <p><strong>User ID:</strong> ${user_id || 'Unknown'}</p>
                  <p><strong>Amount:</strong> ₦${amount?.toLocaleString() || 0}</p>
                  <p><strong>Reference:</strong> ${reference || 'N/A'}</p>
                  <p><strong>Error:</strong> ${error || 'Unknown error'}</p>
                  <p><strong>Time:</strong> ${timestamp || new Date().toISOString()}</p>
                  
                  <hr style="margin: 20px 0;">
                  
                  <h2 style="color: #fa0;">⚠️ ACTION REQUIRED</h2>
                  <ol>
                    <li>Check Flutterwave dashboard for transfer status</li>
                    <li>Verify user received automatic refund</li>
                    <li>Contact user if issue persists</li>
                  </ol>
                </div>
              `
            );
            emailSent = true;
            break;
          }

          case 'system_critical_error': {
            const { component, error, timestamp, details } = notification.metadata || {};
            await sendEmail(
              recipientEmail,
              '🚨 CRITICAL: System Error',
              `
                <div style="background: #fee; border: 2px solid #c00; padding: 20px; border-radius: 8px;">
                  <h1 style="color: #c00;">🚨 CRITICAL SYSTEM ERROR</h1>
                  <p><strong>Component:</strong> ${component || 'Unknown'}</p>
                  <p><strong>Error:</strong> ${error || 'Unknown error'}</p>
                  <p><strong>Time:</strong> ${timestamp || new Date().toISOString()}</p>
                  
                  ${details ? `<p><strong>Details:</strong><br><pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(details, null, 2)}</pre></p>` : ''}
                  
                  <hr style="margin: 20px 0;">
                  
                  <h2 style="color: #c00;">⚠️ INVESTIGATE IMMEDIATELY</h2>
                  <p>Check Supabase logs and edge function execution logs for more details.</p>
                </div>
              `
            );
            emailSent = true;
            break;
          }

          case 'chargeback_detected': {
            const { banned_user_id, referrer_id, reference, amount_reversed, timestamp } = notification.metadata || {};
            await sendEmail(
              recipientEmail,
              '🚨 ALERT: Chargeback Detected',
              `
                <div style="background: #ffc; border: 2px solid #f90; padding: 20px; border-radius: 8px;">
                  <h1 style="color: #f90;">🚨 CHARGEBACK DETECTED</h1>
                  <p><strong>Banned User ID:</strong> ${banned_user_id || 'Unknown'}</p>
                  <p><strong>Referrer Affected:</strong> ${referrer_id || 'Unknown'}</p>
                  <p><strong>Payment Reference:</strong> ${reference || 'N/A'}</p>
                  <p><strong>Amount Reversed:</strong> ₦${amount_reversed?.toLocaleString() || 0}</p>
                  <p><strong>Time:</strong> ${timestamp || new Date().toISOString()}</p>
                  
                  <hr style="margin: 20px 0;">
                  
                  <h2 style="color: #f90;">✅ AUTOMATIC ACTIONS TAKEN</h2>
                  <ol>
                    <li>User has been permanently banned</li>
                    <li>Referral commissions reversed</li>
                    <li>Referrer notified of the reversal</li>
                    <li>Banned user notified of account suspension</li>
                  </ol>
                </div>
              `
            );
            emailSent = true;
            break;
          }

          // =====================================================
          // USER NOTIFICATIONS
          // =====================================================
          case 'withdrawal_success': {
            const { amount, reference } = notification.metadata || {};
            await sendEmail(
              email,
              '✅ Withdrawal Complete',
              `
                <h1>Money Sent!</h1>
                <p>Your withdrawal of <strong>₦${(amount || 0).toLocaleString()}</strong> has been sent to your bank account.</p>
                <p>Reference: ${reference || 'N/A'}</p>
                <p>It should appear in your account within minutes.</p>
                <p>Thank you for using Viketa!</p>
                <p>Best wishes,<br>The Viketa Team</p>
              `
            );
            emailSent = true;
            break;
          }

          case 'spot_retired':
          case 'spots_retired':
          case 'drop_profit': {
            // Revenue-recovery email: user got paid OR their spot(s) retired.
            // Either way we want them back in The Line ASAP — one clear CTA
            // pointing at the Restore flow, not a generic dashboard link.
            const { amount, spot_name, retired_count } = notification.metadata || {};
            const isPayout = notification.notification_type === 'drop_profit';
            const subject = isPayout
              ? `You just got paid ₦${(amount || 10000).toLocaleString()} — tap to activate another share`
              : `Your share${retired_count && retired_count > 1 ? 's are' : ' is'} finished — tap to activate another share`;
            const headline = isPayout
              ? `You just got ₦${(amount || 10000).toLocaleString()}!`
              : `${spot_name || 'Your ad share'} finished — ₦10,000 paid`;
            const body = isPayout
              ? `Your money landed in your Viketa wallet. That ad share is now finished and won't earn again until you activate another share. Most people activate another share in one tap so their money keeps working.`
              : `You've been paid and that ad share is finished. To keep earning, tap the button below to activate another share — it takes one tap.`;
            const ctaUrl = 'https://viketa.xyz/?restore=1';
            await sendEmail(
              email,
              subject,
              `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto;">
                  <h1 style="color:#0F172A; margin:0 0 12px;">${headline}</h1>
                  <p style="color:#334155; font-size:16px; line-height:1.55;">${body}</p>
                  <p style="margin: 28px 0;">
                    <a href="${ctaUrl}" style="display:inline-block; background:#F97316; color:#fff; padding:14px 26px; border-radius:12px; text-decoration:none; font-weight:700; font-size:16px;">
                      Activate another share
                    </a>
                  </p>
                  <p style="color:#64748B; font-size:13px;">If you don't activate another share, your campaign progress stays offline and won't earn any more payouts.</p>
                  <p style="color:#94A3B8; font-size:12px; margin-top:24px;">— The Viketa Team</p>
                </div>
              `
            );
            emailSent = true;
            break;
          }

          case 'welcome': {
            const { referral_code } = notification.metadata || {};
            await sendEmail(
              email,
              '👋 Welcome to Viketa!',
              `
                <h1>Welcome to Viketa! 🎉</h1>
                <p>Thank you for joining our community!</p>
                <p>Your unique referral code: <strong>${referral_code || 'Check your dashboard'}</strong></p>
                <p>Share this code with friends and earn ₦500 cash + ₦20 voucher for each person who joins!</p>
                <p>Best wishes,<br>The Viketa Team</p>
              `
            );
            emailSent = true;
            break;
          }

          case 'chargeback_alert': {
            const { amount, reference, banned_user_name } = notification.metadata || {};
            await sendEmail(
              email,
              '🚨 Urgent: Referral Commission Reversed',
              `
                <h1>Commission Reversed Due to Chargeback</h1>
                <p><strong>What happened:</strong> A person you invited has disputed their payment with their bank (chargeback).</p>
                <p><strong>Amount reversed:</strong> ₦${Math.abs(amount || 0).toLocaleString()}</p>
                <p><strong>Reference:</strong> ${reference || 'N/A'}</p>
                <p>This amount has been deducted from your account.</p>
                <p>If you have questions, please contact support.</p>
                <p>Best wishes,<br>The Viketa Team</p>
              `
            );
            emailSent = true;
            break;
          }

          case 'account_banned': {
            const { reason, reference } = notification.metadata || {};
            await sendEmail(
              email,
              '⛔ Account Suspended - Important Notice',
              `
                <h1>Your Account Has Been Suspended</h1>
                <p><strong>Reason:</strong> ${reason || 'Terms of service violation'}</p>
                <p><strong>Reference:</strong> ${reference || 'N/A'}</p>
                <p>This action is permanent. Your account has been locked.</p>
                <p>If you believe this is a mistake, please contact support.</p>
                <p>Best wishes,<br>The Viketa Team</p>
              `
            );
            emailSent = true;
            break;
          }

          case 'ticket_resolved': {
            const { ticket_id, subject } = notification.metadata || {};
            await sendEmail(
              email,
              '✅ Your Support Ticket Has Been Resolved',
              `
                <h1>Good News!</h1>
                <p>Your support ticket has been resolved:</p>
                <p><strong>Subject:</strong> ${subject || 'Support Request'}</p>
                <p>If you're not satisfied with the resolution, you can reopen the ticket from your dashboard.</p>
                <p>Thank you for using Viketa!</p>
                <p>Best wishes,<br>The Viketa Team</p>
              `
            );
            emailSent = true;
            break;
          }

          case 'new_support_ticket':
          case 'new_ticket_message': {
            // Admin notifications - these go to admin email
            const { admin_email, subject, user_name, message_preview } = notification.metadata || {};
            if (admin_email) {
              await sendEmail(
                admin_email,
                `🎫 ${notification.notification_type === 'new_support_ticket' ? 'New Support Ticket' : 'New Ticket Message'}: ${subject || 'Support Request'}`,
                `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 20px; border-radius: 12px 12px 0 0;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">🎫 ${notification.notification_type === 'new_support_ticket' ? 'New Support Ticket' : 'New Ticket Message'}</h1>
                    </div>
                    
                    <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
                      <p><strong>From:</strong> ${user_name || 'User'}</p>
                      <p><strong>Subject:</strong> ${subject || 'Support Request'}</p>
                      ${message_preview ? `<p><strong>Preview:</strong> ${message_preview}</p>` : ''}
                      
                      <div style="margin-top: 20px;">
                        <a href="https://viketa.com/admin/support" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
                          View in Dashboard
                        </a>
                      </div>
                    </div>
                  </div>
                `
              );
              emailSent = true;
            }
            break;
          }

          default:
            // For any other notification type, skip email (just in-app)
            console.log(`[${notification.notification_type}] No email template, skipping`);
            emailSent = true; // Mark as processed
            break;
        }

        // Mark notification as email processed
        await supabase
          .from('notifications')
          .update({ 
            metadata: { 
              ...notification.metadata, 
              email_sent: emailSent,
              email_processed_at: new Date().toISOString()
            } 
          })
          .eq('id', notification.id);

        if (emailSent) {
          successCount++;
          console.log(`✅ [${notification.notification_type}] Email sent to ${recipientEmail}`);
        }

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error processing notification ${notification.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('notifications')
          .update({ 
            metadata: { 
              ...notification.metadata, 
              email_sent: false,
              email_error: errorMessage
            } 
          })
          .eq('id', notification.id);
        
        failCount++;
      }
    }

    console.log(`✅ Notification worker complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: successCount + failCount, 
        sent: successCount, 
        failed: failCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Notification worker error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
