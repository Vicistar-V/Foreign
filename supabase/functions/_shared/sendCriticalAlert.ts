// =====================================================
// CRITICAL ALERT HELPER - Centralized Admin Alerting
// =====================================================
// This helper function sends immediate alerts to admins
// when critical system failures occur (distribution, withdrawals, etc.)
// Now uses the new notifications system!

export async function sendCriticalAlert(
  supabase: any,
  alertType: 'distribution_failed' | 'withdrawal_failed' | 'system_critical_error' | 'chargeback_detected',
  details: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🚨 CRITICAL ALERT: ${alertType}`, details);

    // 1. Get admin email and telegram config from platform_config
    const { data: config, error: configError } = await supabase
      .from('platform_config')
      .select('admin_alert_email, telegram_alerts_enabled')
      .eq('id', 1)
      .single();

    if (configError || !config?.admin_alert_email) {
      console.error('❌ Failed to get admin email:', configError);
      return { success: false, error: 'Admin email not configured' };
    }

    // 2. Log to system_alerts table for audit trail
    const alertMessage = generateAlertMessage(alertType, details);
    const { error: logError } = await supabase
      .from('system_alerts')
      .insert({
        alert_type: alertType,
        severity: 'critical',
        message: alertMessage,
        metadata: details
      });

    if (logError) {
      console.error('❌ Failed to log alert:', logError);
    }

    // 3. Create admin notification (new system)
    const { error: adminNotifError } = await supabase
      .from('admin_notifications')
      .insert({
        notification_type: alertType,
        title: getAlertTitle(alertType),
        message: alertMessage,
        metadata: details,
        link: getAlertLink(alertType)
      });

    if (adminNotifError) {
      console.error('❌ Failed to create admin notification:', adminNotifError);
    } else {
      console.log('✅ Admin notification created');
    }

    // 4. Also notify each admin user directly
    const { data: adminRoles, error: adminRolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminRolesError) {
      console.error('❌ Failed to fetch admin users:', adminRolesError);
      return { success: false, error: adminRolesError.message };
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.warn('⚠️ No admin users found to notify');
      return { success: false, error: 'No admin users configured' };
    }

    // 5. Create user notifications for each admin
    const notificationInserts = adminRoles.map((admin: { user_id: string }) => ({
      user_id: admin.user_id,
      notification_type: alertType,
      title: getAlertTitle(alertType),
      message: alertMessage,
      metadata: details,
      link: getAlertLink(alertType)
    }));

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notificationInserts);

    if (notifError) {
      console.error('❌ Failed to create notifications:', notifError);
    } else {
      console.log(`✅ Notifications created for ${adminRoles.length} admin(s)`);
    }

    // 6. Send Telegram alert (non-blocking)
    if (config.telegram_alerts_enabled) {
      try {
        console.log('📱 Sending Telegram critical alert...');
        
        const telegramPayload = mapAlertTypeToTelegramPayload(alertType, details);
        
        await supabase.functions.invoke('send-telegram-alert', {
          body: telegramPayload
        });
        
        console.log('✅ Telegram critical alert sent');
      } catch (telegramError) {
        console.error('⚠️ Telegram alert failed (non-critical):', telegramError);
      }
    }

    return { success: true };

  } catch (error: any) {
    console.error('❌ Critical alert helper error:', error);
    return { success: false, error: error.message };
  }
}

function getAlertTitle(alertType: string): string {
  switch (alertType) {
    case 'distribution_failed': return '⚠️ Distribution Failed';
    case 'withdrawal_failed': return '❌ Withdrawal Failed';
    case 'system_critical_error': return '🚨 System Error';
    case 'chargeback_detected': return '⚠️ Chargeback Detected';
    default: return '⚠️ System Alert';
  }
}

function getAlertLink(alertType: string): string {
  switch (alertType) {
    case 'withdrawal_failed': return '/admin/withdrawals';
    case 'chargeback_detected': return '/admin/users';
    default: return '/admin';
  }
}

function generateAlertMessage(alertType: string, details: Record<string, any>): string {
  switch (alertType) {
    case 'distribution_failed':
      return `Distribution failed for ${details.drop_date || 'today'}: ${details.error_message || 'Unknown error'}. ${details.participants || 0} participants affected.`;
    
    case 'withdrawal_failed':
      return `Withdrawal failed for user ${details.user_id || 'unknown'}: ${details.error || 'Unknown error'}. Amount: ₦${details.amount || 0}. Reference: ${details.reference || 'N/A'}.`;
    
    case 'system_critical_error':
      return `Critical system error in ${details.component || 'unknown component'}: ${details.error || 'Unknown error'}`;
    
    case 'chargeback_detected':
      return `Chargeback detected: User ${details.banned_user_id || 'unknown'} disputed payment. Reference: ${details.reference || 'N/A'}`;
    
    default:
      return `Critical alert: ${JSON.stringify(details)}`;
  }
}

function mapAlertTypeToTelegramPayload(alertType: string, details: Record<string, any>): Record<string, any> {
  switch (alertType) {
    case 'distribution_failed':
      return {
        alertType: 'distribution_failed',
        dropDate: details.drop_date,
        participants: details.participants,
        poolAmount: details.distribution_details?.total_stakes || 0,
        errorMessage: details.error_message,
        winnersCount: details.distribution_details?.winners || 0,
        protectedCount: details.distribution_details?.protected || 0,
        contributorsCount: details.distribution_details?.contributors || 0
      };
    
    case 'withdrawal_failed':
      return {
        alertType: 'withdrawal_failed',
        userId: details.user_id,
        amount: details.amount,
        bankName: details.bank_details?.bank_name || 'Unknown',
        reference: details.reference,
        errorMessage: details.error,
        failureStage: details.failure_stage
      };
    
    case 'system_critical_error':
      return {
        alertType: 'system_error',
        component: details.component,
        errorMessage: details.error,
        severity: 'critical'
      };
    
    case 'chargeback_detected':
      return {
        alertType: 'chargeback_detected',
        bannedUserId: details.banned_user_id,
        referrerId: details.referrer_id,
        reference: details.reference,
        amountReversed: details.amount_reversed
      };
    
    default:
      return {
        alertType: 'system_error',
        component: 'unknown',
        errorMessage: JSON.stringify(details),
        severity: 'unknown'
      };
  }
}
