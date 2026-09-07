import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  supabaseServiceKey
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isServiceRoleCall(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // Telegram alerts can trigger admin action. Only trusted backend functions
  // may send them; browser callers can no longer inject fake alerts.
  return token.length > 0 && token === supabaseServiceKey;
}

// ============================================
// TELEGRAM MESSAGE SENDER
// ============================================

type AlertType = 
  | 'signup' 
  | 'activation' 
  | 'new_spot_purchase'
  | 'manual_withdrawal' 
  | 'withdrawal_failed' 
  | 'distribution_failed' 
  | 'chargeback_detected' 
  | 'system_error'
  | 'transfer_failed'
  | 'new_ticket'
  | 'ticket_reply'
  | 'user_banned'
  | 'user_unbanned'
  | 'daily_summary'
  | 'config_changed';

interface TelegramAlertPayload {
  alertType: AlertType;
  // Common fields
  userName?: string;
  userPhone?: string;
  userEmail?: string;
  userId?: string;
  amount?: number;
  reference?: string;
  age?: number;
  
  // Signup/Activation specific
  referrerCode?: string;
  referrerName?: string;
  referrerBonus?: number;
  adminActivation?: boolean;  // Flag for admin override activations

  
  // Spot purchase specific
  spotName?: string;
  position?: number;
  sourceWallet?: string;
  
  // Withdrawal specific
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  transferAmount?: number;
  withdrawalFee?: number;
  
  // Failure specific
  errorMessage?: string;
  failureStage?: string;
  
  // Distribution specific
  dropDate?: string;
  participants?: number;
  poolAmount?: number;
  winnersCount?: number;
  protectedCount?: number;
  contributorsCount?: number;
  
  // Chargeback specific
  bannedUserId?: string;
  referrerId?: string;
  amountReversed?: number;
  
  // System error specific
  component?: string;
  severity?: string;
  
  // Support ticket specific
  ticketId?: string;
  ticketSubject?: string;
  ticketCategory?: string;
  messagePreview?: string;
  isMember?: boolean;
  
  // Ban action specific
  banReason?: string;
  adminName?: string;
  previousBanReason?: string;
  
  // Config change specific
  settingName?: string;
  oldValue?: boolean | string | number;
  newValue?: boolean | string | number;
  
  // Daily summary specific
  summaryDate?: string;
  newSignups?: number;
  newMembers?: number;
  totalEntries?: number;
  completedWithdrawals?: number;
  pendingWithdrawals?: number;
  newTickets?: number;
  totalDeposits?: number;
  totalWithdrawals?: number;
}

async function sendTelegramMessage(message: string): Promise<boolean> {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');

  if (!botToken || !chatId) {
    console.warn('⚠️ Telegram credentials not configured');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Telegram API error:', errorData);
      return false;
    }

    console.log('✅ Telegram message sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to send Telegram message:', error);
    return false;
  }
}

function formatLagosTime(date: Date = new Date()): string {
  return date.toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatLagosDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-NG', {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 6) return '****';
  return accountNumber.substring(0, 4) + '****' + accountNumber.substring(accountNumber.length - 2);
}

function formatAmount(amount: number | undefined): string {
  if (!amount) return '₦0';
  return `₦${amount.toLocaleString()}`;
}

function formatValueForDisplay(value: boolean | string | number | undefined): string {
  if (typeof value === 'boolean') {
    return value ? 'ON ✅' : 'OFF ❌';
  }
  if (value === undefined || value === null) {
    return 'Unknown';
  }
  return String(value);
}

// ============================================
// MESSAGE FORMATTERS
// ============================================

function computeAge(birthYear?: number | null, birthMonth?: number | null): number | null {
  if (!birthYear || birthYear < 1900) return null;
  const now = new Date();
  const month = birthMonth && birthMonth >= 1 && birthMonth <= 12 ? birthMonth : 1;
  let age = now.getFullYear() - birthYear;
  const m = now.getMonth() + 1 - month;
  if (m < 0) age--;
  return age < 0 || age > 130 ? null : age;
}

async function resolveAge(payload: TelegramAlertPayload): Promise<number | null> {
  if (typeof payload.age === 'number') return payload.age;
  if (!payload.userId) return null;
  const { data } = await supabase
    .from('profiles')
    .select('birth_year, birth_month')
    .eq('id', payload.userId)
    .maybeSingle();
  return computeAge(data?.birth_year, data?.birth_month);
}

async function resolveState(payload: TelegramAlertPayload): Promise<string | null> {
  if (!payload.userId) return null;
  const { data } = await supabase
    .from('profiles')
    .select('state_of_residence')
    .eq('id', payload.userId)
    .maybeSingle();
  return (data as any)?.state_of_residence ?? null;
}

function formatSignupMessage(payload: TelegramAlertPayload, age: number | null, state: string | null): string {
  const time = formatLagosTime();
  const ageLine = age != null ? `\n🎂 <b>Age:</b> ${age}` : '';
  const stateLine = state ? `\n📍 <b>State:</b> ${state}` : '';

  return `🆕 <b>NEW SIGNUP</b>

👤 <b>Name:</b> ${payload.userName || 'Unknown'}
📱 <b>Phone:</b> ${payload.userPhone || 'Not provided'}
📧 <b>Email:</b> ${payload.userEmail || 'Not provided'}${ageLine}${stateLine}
🔗 <b>Referrer:</b> ${payload.referrerCode || 'None (Direct)'}
🕐 <b>Time:</b> ${time}`;
}

function formatActivationMessage(payload: TelegramAlertPayload, age: number | null): string {
  const time = formatLagosTime();
  
  // Check if this is an admin override activation
  const isAdminActivation = payload.adminActivation === true;
  
  let message = `✅ <b>MEMBER ACTIVATED!</b>

👤 <b>Name:</b> ${payload.userName || 'Unknown'}
📱 <b>Phone:</b> ${payload.userPhone || 'Not provided'}`;

  if (age != null) {
    message += `
🎂 <b>Age:</b> ${age}`;
  }

  if (isAdminActivation) {
    message += `
🔐 <b>Method:</b> Admin Override (FREE)`;
  } else {
    message += `
💰 <b>Amount Paid:</b> ${formatAmount(payload.amount)}`;
  }

  // Referrer info (but NO bonus mention - referrals now work per-cycle)
  if (payload.referrerCode && payload.referrerCode !== 'SYSTEM' && !isAdminActivation) {
    message += `
🔗 <b>Referred By:</b> ${payload.referrerName || payload.referrerCode}`;
  }

  message += `
🕐 <b>Time:</b> ${time}`;

  return message;
}


function formatNewSpotPurchaseMessage(payload: TelegramAlertPayload): string {
  const time = formatLagosTime();
  
  return `🎰 <b>NEW SPOT PURCHASED!</b>

👤 <b>User:</b> ${payload.userName || 'Unknown'}
🎫 <b>Ad Share:</b> ${payload.spotName || 'Unknown'}
📍 <b>Position:</b> #${payload.position || '?'} in The Viketa Line
💰 <b>Source:</b> ${payload.sourceWallet === 'earnings' ? 'From Earnings' : 'From Deposit'}
🕐 <b>Time:</b> ${time}`;
}

function formatManualWithdrawalMessage(payload: TelegramAlertPayload): string {
  const time = formatLagosTime();
  
  return `📋 <b>MANUAL WITHDRAWAL REQUEST</b>

👤 <b>Name:</b> ${payload.userName || 'Unknown'}
📱 <b>Phone:</b> ${payload.userPhone || 'Not provided'}
💰 <b>Amount:</b> ${formatAmount(payload.transferAmount)} (after ${formatAmount(payload.withdrawalFee)} fee)
🏦 <b>Bank:</b> ${payload.bankName || 'Unknown'} - ${maskAccountNumber(payload.accountNumber || '')}
📝 <b>Account Name:</b> ${payload.accountName || 'Unknown'}
🔖 <b>Reference:</b> ${payload.reference || 'N/A'}

⏳ <b>Awaiting your approval in Admin Panel</b>
🕐 <b>Time:</b> ${time}`;
}

function formatWithdrawalFailedMessage(payload: TelegramAlertPayload): string {
  const time = formatLagosTime();
  
  return `🚨 <b>WITHDRAWAL FAILED</b>

👤 <b>User:</b> ${payload.userName || 'Unknown'}
💰 <b>Amount:</b> ${formatAmount(payload.amount)}
🏦 <b>Bank:</b> ${payload.bankName || 'Unknown'}
❌ <b>Error:</b> ${payload.errorMessage || 'Unknown error'}
🔖 <b>Reference:</b> ${payload.reference || 'N/A'}
📍 <b>Stage:</b> ${payload.failureStage || 'Unknown'}

✅ <b>User has been automatically refunded</b>
🕐 <b>Time:</b> ${time}`;
}

function formatTransferFailedMessage(payload: TelegramAlertPayload): string {
  const time = formatLagosTime();
  
  return `⚠️ <b>TRANSFER FAILED (Webhook)</b>

👤 <b>User:</b> ${payload.userName || 'Unknown'}
💰 <b>Amount:</b> ${formatAmount(payload.amount)}
❌ <b>Reason:</b> ${payload.errorMessage || 'Transfer rejected by bank/network'}
🔖 <b>Reference:</b> ${payload.reference || 'N/A'}

✅ <b>Money has been returned to user's wallet</b>
🕐 <b>Time:</b> ${time}`;
}

function formatDistributionFailedMessage(payload: TelegramAlertPayload): string {
  const time = formatLagosTime();
  
  return `🔴 <b>DISTRIBUTION FAILED - CRITICAL</b>

📅 <b>Date:</b> ${payload.dropDate || 'Today'}
👥 <b>Participants:</b> ${payload.participants || 0}
💰 <b>Pool:</b> ${formatAmount(payload.poolAmount)}
❌ <b>Error:</b> ${payload.errorMessage || 'Unknown error'}

⚠️ <b>IMMEDIATE ACTION REQUIRED</b>
🔧 Check admin panel and logs now!
🕐 <b>Time:</b> ${time}`;
}

function formatChargebackMessage(payload: TelegramAlertPayload): string {
  const time = formatLagosTime();
  
  return `🚫 <b>CHARGEBACK ALERT</b>

🚨 <b>Banned User ID:</b> ${payload.bannedUserId?.substring(0, 8) || 'Unknown'}...
💰 <b>Amount Reversed:</b> ${formatAmount(payload.amountReversed)}
🔖 <b>Reference:</b> ${payload.reference || 'N/A'}
👤 <b>Referrer Affected:</b> ${payload.referrerId ? 'Yes (check debt status)' : 'No referrer'}

✅ <b>User banned automatically</b>
📋 Check admin panel for referrer debt status
🕐 <b>Time:</b> ${time}`;
}

function formatSystemErrorMessage(payload: TelegramAlertPayload): string {
  const time = formatLagosTime();
  
  return `💥 <b>SYSTEM ERROR - ${payload.severity?.toUpperCase() || 'CRITICAL'}</b>

🔧 <b>Component:</b> ${payload.component || 'Unknown'}
❌ <b>Error:</b> ${payload.errorMessage || 'Unknown error'}

⚠️ <b>Check logs immediately</b>
🕐 <b>Time:</b> ${time}`;
}

function formatNewTicketMessage(payload: TelegramAlertPayload): string {
  const time = formatLagosTime();
  const memberBadge = payload.isMember ? '✅ Member' : '⏳ Not Activated';
  
  const categoryLabels: Record<string, string> = {
    'money_issue': '💰 Money Problem',
    'account_problem': '👤 Account Issue',
    'how_to_use': '❓ How To Use',
    'complaint': '😤 Complaint',
    'suggestion': '💡 Suggestion',
    'other': '📝 Other'
  };
  
  const categoryLabel = categoryLabels[payload.ticketCategory || 'other'] || '📝 Other';
  
  return `🆘 <b>NEW HELP REQUEST</b>

👤 <b>From:</b> ${payload.userName || 'Unknown'} (${memberBadge})
📱 <b>Phone:</b> ${payload.userPhone || 'Not provided'}
📂 <b>Category:</b> ${categoryLabel}
📋 <b>Subject:</b> ${payload.ticketSubject || 'No subject'}

💬 <b>Message:</b>
${(payload.messagePreview || 'No message').substring(0, 200)}${(payload.messagePreview?.length || 0) > 200 ? '...' : ''}

👉 <b>Check Admin Panel to respond</b>
🕐 <b>Time:</b> ${time}`;
}

function formatTicketReplyMessage(payload: TelegramAlertPayload): string {
  const time = formatLagosTime();
  
  return `💬 <b>USER REPLIED TO TICKET</b>

👤 <b>From:</b> ${payload.userName || 'Unknown'}
📋 <b>Subject:</b> ${payload.ticketSubject || 'No subject'}

💬 <b>New Message:</b>
${(payload.messagePreview || 'No message').substring(0, 200)}${(payload.messagePreview?.length || 0) > 200 ? '...' : ''}

⏳ <b>User is waiting for your response</b>
🕐 <b>Time:</b> ${time}`;
}

function formatUserBannedMessage(payload: TelegramAlertPayload): string {
  const time = formatLagosTime();
  
  return `🚫 <b>USER BANNED</b>

👤 <b>User:</b> ${payload.userName || 'Unknown'}
📝 <b>Reason:</b> ${payload.banReason || 'No reason provided'}
👮 <b>Banned By:</b> Admin

📋 <b>Logged in system alerts for audit</b>
🕐 <b>Time:</b> ${time}`;
}

function formatUserUnbannedMessage(payload: TelegramAlertPayload): string {
  const time = formatLagosTime();
  
  return `✅ <b>USER UNBANNED</b>

👤 <b>User:</b> ${payload.userName || 'Unknown'}
📝 <b>Previous Reason:</b> ${payload.previousBanReason || 'Unknown'}
👮 <b>Restored By:</b> Admin

📋 <b>Access has been restored</b>
🕐 <b>Time:</b> ${time}`;
}

function formatConfigChangedMessage(payload: TelegramAlertPayload): string {
  const time = formatLagosTime();
  
  return `⚙️ <b>SETTING CHANGED</b>

🔧 <b>Setting:</b> ${payload.settingName || 'Unknown'}
🔄 <b>Changed:</b> ${formatValueForDisplay(payload.oldValue)} → ${formatValueForDisplay(payload.newValue)}
👮 <b>By:</b> ${payload.adminName || 'Admin'}

🕐 <b>Time:</b> ${time}`;
}

function formatDailySummaryMessage(payload: TelegramAlertPayload): string {
  const dateStr = payload.summaryDate || formatLagosDate();
  
  // Calculate conversion rate
  const signups = payload.newSignups || 0;
  const members = payload.newMembers || 0;
  const conversionRate = signups > 0 ? Math.round((members / signups) * 100) : 0;
  
  // Calculate net money flow
  const deposits = payload.totalDeposits || 0;
  const withdrawals = payload.totalWithdrawals || 0;
  const netFlow = deposits - withdrawals;
  const netSign = netFlow >= 0 ? '+' : '';
  
  return `📊 <b>END OF DAY SUMMARY</b>
📅 ${dateStr}

━━━━━━━━━━━━━━━━━━━━━

👥 <b>Users</b>
   New Signups: ${signups}
   New Members: ${members} (${conversionRate}% conversion)

🎯 <b>Drop Activity</b>
   Entries Today: ${payload.totalEntries || 0}

💸 <b>Withdrawals</b>
   Completed: ${payload.completedWithdrawals || 0}
   Pending: ${payload.pendingWithdrawals || 0}

🆘 <b>Support</b>
   New Tickets: ${payload.newTickets || 0}

━━━━━━━━━━━━━━━━━━━━━

💰 <b>Money Flow</b>
   In: ${formatAmount(deposits)}
   Out: ${formatAmount(withdrawals)}
   Net: ${netSign}${formatAmount(Math.abs(netFlow))}

━━━━━━━━━━━━━━━━━━━━━

Have a great night! 🌙`;
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  if (!isServiceRoleCall(req)) {
    console.warn('Blocked unauthorized send-telegram-alert request');
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    console.log('📱 send-telegram-alert: Starting');
    console.log('📦 Content-Type:', req.headers.get('content-type'));

    // Handle both JSON and text/plain (from sendBeacon)
    let payload: TelegramAlertPayload;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      // sendBeacon sends as text/plain, parse as JSON
      const bodyText = await req.text();
      console.log('📦 Raw body:', bodyText.substring(0, 200));
      payload = JSON.parse(bodyText);
    }
    
    console.log('📦 Alert type:', payload.alertType);

    // Check if Telegram alerts are enabled (except for daily_summary which should always send)
    if (payload.alertType !== 'daily_summary') {
      const { data: config } = await supabase
        .from('platform_config')
        .select('telegram_alerts_enabled')
        .eq('id', 1)
        .single();

      if (!config?.telegram_alerts_enabled) {
        console.log('⚠️ Telegram alerts are disabled in platform config');
        return jsonResponse({ success: true, message: 'Telegram alerts disabled' });
      }
    }

    // Format and send the message
    let message: string;
    
    switch (payload.alertType) {
      case 'signup': {
        const [age, state] = await Promise.all([resolveAge(payload), resolveState(payload)]);
        message = formatSignupMessage(payload, age, state);
        break;
      }
      case 'activation': {
        const age = await resolveAge(payload);
        message = formatActivationMessage(payload, age);
        break;
      }

      case 'new_spot_purchase':
        message = formatNewSpotPurchaseMessage(payload);
        break;
      case 'manual_withdrawal':
        message = formatManualWithdrawalMessage(payload);
        break;
      case 'withdrawal_failed':
        message = formatWithdrawalFailedMessage(payload);
        break;
      case 'transfer_failed':
        message = formatTransferFailedMessage(payload);
        break;
      case 'distribution_failed':
        message = formatDistributionFailedMessage(payload);
        break;
      case 'chargeback_detected':
        message = formatChargebackMessage(payload);
        break;
      case 'system_error':
        message = formatSystemErrorMessage(payload);
        break;
      case 'new_ticket':
        message = formatNewTicketMessage(payload);
        break;
      case 'ticket_reply':
        message = formatTicketReplyMessage(payload);
        break;
      case 'user_banned':
        message = formatUserBannedMessage(payload);
        break;
      case 'user_unbanned':
        message = formatUserUnbannedMessage(payload);
        break;
      case 'config_changed':
        message = formatConfigChangedMessage(payload);
        break;
      case 'daily_summary':
        message = formatDailySummaryMessage(payload);
        break;
      default:
        console.error('❌ Unknown alert type:', payload.alertType);
        return jsonResponse({ success: false, error: 'Unknown alert type' }, 400);
    }

    const sent = await sendTelegramMessage(message);

    return jsonResponse({ success: sent, message: sent ? 'Alert sent' : 'Failed to send' });

  } catch (error: any) {
    console.error('💥 send-telegram-alert error:', error);
    
    // Don't fail the main flow - just log the error
    return jsonResponse({ success: false, error: error.message });
  }
});
