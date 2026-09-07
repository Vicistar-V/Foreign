import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_ADMIN_CHAT_ID = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Send message back to Telegram
async function sendTelegramMessage(chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
}

// Format currency
function formatMoney(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

// Get today's summary
async function getSummary(supabase: any): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Get today's signups
  const { count: todaySignups } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", today);

  // Get today's new members (activations)
  const { data: todayMembers } = await supabase
    .from("transactions")
    .select("id")
    .eq("transaction_type", "membership_fee")
    .eq("status", "completed")
    .gte("created_at", today);

  // Get today's deposits
  const { data: deposits } = await supabase
    .from("transactions")
    .select("amount")
    .eq("transaction_type", "deposit")
    .eq("status", "completed")
    .gte("created_at", today);

  const totalDeposits = deposits?.reduce((sum: number, d: any) => sum + Number(d.amount), 0) || 0;

  // Get today's drop entries
  const { count: dropEntries } = await supabase
    .from("drop_entries")
    .select("*", { count: "exact", head: true })
    .eq("drop_date", today);

  // Get pending withdrawals
  const { count: pendingWithdrawals } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("transaction_type", "withdrawal")
    .eq("status", "pending");

  // Get open tickets
  const { count: openTickets } = await supabase
    .from("support_tickets")
    .select("*", { count: "exact", head: true })
    .in("status", ["open", "in_progress", "waiting_user"]);

  return `📊 <b>Today's Summary</b> (${today})

👤 <b>Users</b>
• New signups: ${todaySignups || 0}
• New members: ${todayMembers?.length || 0}

💰 <b>Money</b>
• Deposits: ${formatMoney(totalDeposits)}
• Drop entries: ${dropEntries || 0}

⏳ <b>Pending</b>
• Withdrawals: ${pendingWithdrawals || 0}
• Support tickets: ${openTickets || 0}`;
}

// Get pending withdrawals
async function getPending(supabase: any): Promise<string> {
  const { data: pending, count } = await supabase
    .from("transactions")
    .select(`
      amount,
      created_at,
      metadata,
      payment_reference
    `, { count: "exact" })
    .eq("transaction_type", "withdrawal")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  if (!count || count === 0) {
    return "✅ <b>No pending withdrawals!</b>\n\nAll withdrawals have been processed.";
  }

  let message = `⏳ <b>Pending Withdrawals</b> (${count} total)\n\n`;
  
  pending?.forEach((w: any, i: number) => {
    const amount = Number(w.amount) * -1; // Withdrawals are negative
    const fee = w.metadata?.withdrawal_fee || 0;
    const transfer = amount - fee;
    const date = new Date(w.created_at).toLocaleDateString();
    
    message += `${i + 1}. ${formatMoney(transfer)} (fee: ${formatMoney(fee)})\n`;
    message += `   Ref: ${w.payment_reference || "N/A"}\n`;
    message += `   Date: ${date}\n\n`;
  });

  if (count > 5) {
    message += `... and ${count - 5} more`;
  }

  return message;
}

// Get open tickets
async function getTickets(supabase: any): Promise<string> {
  const { data: tickets, count } = await supabase
    .from("support_tickets")
    .select(`
      id,
      subject,
      category,
      priority,
      status,
      created_at,
      profiles!support_tickets_user_id_fkey(full_name)
    `, { count: "exact" })
    .in("status", ["open", "in_progress", "waiting_user"])
    .order("created_at", { ascending: true })
    .limit(5);

  if (!count || count === 0) {
    return "✅ <b>No open tickets!</b>\n\nAll support tickets have been resolved.";
  }

  let message = `🎫 <b>Open Support Tickets</b> (${count} total)\n\n`;
  
  tickets?.forEach((t: any, i: number) => {
    const userName = t.profiles?.full_name || "Unknown";
    const priority = t.priority === "urgent" ? "🔴" : "🟢";
    const status = t.status.replace("_", " ");
    
    message += `${priority} <b>${t.subject}</b>\n`;
    message += `   From: ${userName}\n`;
    message += `   Status: ${status}\n\n`;
  });

  if (count > 5) {
    message += `... and ${count - 5} more`;
  }

  return message;
}

// Get platform balance
async function getBalance(supabase: any): Promise<string> {
  // Get total user balances (from cache - display only)
  const { data: userBalances } = await supabase
    .from("cached_balances")
    .select("earnings_balance, deposit_balance");

  const totalUserEarnings = userBalances?.reduce((sum: number, b: any) => sum + Number(b.earnings_balance), 0) || 0;
  const totalUserDeposits = userBalances?.reduce((sum: number, b: any) => sum + Number(b.deposit_balance), 0) || 0;

  return `💰 <b>Platform Balance</b>

👥 <b>Total User Balances</b>
• Earnings: ${formatMoney(totalUserEarnings)}
• Deposits: ${formatMoney(totalUserDeposits)}

📊 <b>Total in System</b>
${formatMoney(totalUserEarnings + totalUserDeposits)}`;
}

// Get user stats
async function getUsers(supabase: any): Promise<string> {
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: totalMembers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_member", true);

  const { count: bannedUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_banned", true);

  // Today's activity
  const today = new Date().toISOString().split("T")[0];
  
  const { count: todaySignups } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", today);

  const { count: todayActive } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("last_seen_at", today);

  return `👥 <b>User Statistics</b>

📊 <b>Totals</b>
• Total users: ${totalUsers || 0}
• Active members: ${totalMembers || 0}
• Banned: ${bannedUsers || 0}

📅 <b>Today</b>
• New signups: ${todaySignups || 0}
• Active today: ${todayActive || 0}

📈 <b>Conversion Rate</b>
${totalUsers ? ((totalMembers || 0) / totalUsers * 100).toFixed(1) : 0}% of signups became members`;
}

// Get today's drop info
async function getDrops(supabase: any): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  
  // Get today's entries
  const { data: entries, count: totalEntries } = await supabase
    .from("drop_entries")
    .select("total_amount, result_status", { count: "exact" })
    .eq("drop_date", today);

  // Get config for entry fee
  const { data: config } = await supabase
    .from("platform_config")
    .select("drop_entry_fee, is_drop_active, platform_fee_percentage, protected_percentage, beneficiary_percentage")
    .eq("id", 1)
    .single();

  const totalPool = entries?.reduce((sum: number, e: any) => sum + Number(e.total_amount), 0) || 0;
  const pendingCount = entries?.filter((e: any) => e.result_status === "pending").length || 0;
  const winnersCount = entries?.filter((e: any) => e.result_status === "beneficiary").length || 0;
  const protectedCount = entries?.filter((e: any) => e.result_status === "protected").length || 0;
  const contributorsCount = entries?.filter((e: any) => e.result_status === "contributor").length || 0;

  const dropStatus = config?.is_drop_active ? "🟢 OPEN" : "🔴 CLOSED";

  // Calculate distribution
  const platformFee = totalPool * (config?.platform_fee_percentage || 10) / 100;
  const distributablePool = totalPool - platformFee;

  return `🎲 <b>Daily Drop Status</b> (${today})

📊 <b>Current Status:</b> ${dropStatus}
💵 Entry fee: ${formatMoney(config?.drop_entry_fee || 0)}

👥 <b>Participants:</b> ${totalEntries || 0}
• Pending: ${pendingCount}
• Winners: ${winnersCount}
• Protected: ${protectedCount}
• Contributors: ${contributorsCount}

💰 <b>Pool:</b>
• Total collected: ${formatMoney(totalPool)}
• Platform fee (${config?.platform_fee_percentage}%): ${formatMoney(platformFee)}
• To distribute: ${formatMoney(distributablePool)}`;
}

// Get system alerts
async function getAlerts(supabase: any): Promise<string> {
  const { data: alerts, count } = await supabase
    .from("system_alerts")
    .select("*", { count: "exact" })
    .is("acknowledged_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!count || count === 0) {
    return "✅ <b>No unacknowledged alerts!</b>\n\nAll system alerts have been reviewed.";
  }

  let message = `🚨 <b>System Alerts</b> (${count} unacknowledged)\n\n`;
  
  alerts?.forEach((a: any, i: number) => {
    const severity = a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵";
    const date = new Date(a.created_at).toLocaleString();
    
    message += `${severity} <b>${a.alert_type}</b>\n`;
    message += `${a.message}\n`;
    message += `<i>${date}</i>\n\n`;
  });

  if (count > 5) {
    message += `... and ${count - 5} more`;
  }

  return message;
}

// Get revenue/money flow
async function getRevenue(supabase: any): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  // Membership activations are now tracked on the user (amount = 0).
  // Use payment_attempts to compute real money received.
  const sumMembership = async (since: string) => {
    const { data } = await supabase
      .from("payment_attempts")
      .select("amount")
      .eq("purpose", "membership")
      .eq("status", "verified")
      .gte("created_at", since);
    return data?.reduce((s: number, r: any) => s + Number(r.amount), 0) || 0;
  };

  const todayMembershipIncome = await sumMembership(today);
  const weekIncome = await sumMembership(weekAgo);
  const monthIncome = await sumMembership(monthAgo);

  return `💵 <b>Revenue Overview</b>

📅 <b>Today</b>
• Membership fees: ${formatMoney(todayMembershipIncome)}

📆 <b>Last 7 Days</b>
• Total income: ${formatMoney(weekIncome)}

📊 <b>Last 30 Days</b>
• Total income: ${formatMoney(monthIncome)}`;
}

// Get recent activity
async function getRecent(supabase: any): Promise<string> {
  // Recent signups
  const { data: recentSignups } = await supabase
    .from("profiles")
    .select("full_name, created_at, is_member")
    .order("created_at", { ascending: false })
    .limit(5);

  // Recent deposits
  const { data: recentDeposits } = await supabase
    .from("transactions")
    .select("amount, created_at, metadata")
    .eq("transaction_type", "deposit")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(5);

  let message = `🕐 <b>Recent Activity</b>\n\n`;

  message += `👤 <b>Latest Signups</b>\n`;
  recentSignups?.forEach((u: any) => {
    const memberBadge = u.is_member ? "✅" : "⏳";
    const time = new Date(u.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    message += `${memberBadge} ${u.full_name} (${time})\n`;
  });

  message += `\n💰 <b>Latest Deposits</b>\n`;
  recentDeposits?.forEach((d: any) => {
    const time = new Date(d.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    message += `• ${formatMoney(d.amount)} (${time})\n`;
  });

  return message;
}

// Get platform config
async function getConfig(supabase: any): Promise<string> {
  const { data: config } = await supabase
    .from("platform_config")
    .select("*")
    .eq("id", 1)
    .single();

  if (!config) {
    return "❌ Could not load platform configuration.";
  }

  const dropStatus = config.is_drop_active ? "🟢 Active" : "🔴 Inactive";
  const withdrawalsStatus = config.withdrawals_enabled ? "🟢 Enabled" : "🔴 Disabled";
  const maintenanceStatus = config.maintenance_mode ? "🔴 Maintenance Mode" : "🟢 Normal";
  const manualWithdrawals = config.manual_withdrawal_mode ? "🟡 Manual" : "🟢 Automatic";

  return `⚙️ <b>Platform Configuration</b>

🎲 <b>Drop Settings</b>
• Status: ${dropStatus}
• Entry fee: ${formatMoney(config.drop_entry_fee)}
• Platform fee: ${config.platform_fee_percentage}%
• Protected: ${config.protected_percentage}%
• Winners: ${config.beneficiary_percentage}%
• Min pool guarantee: ${formatMoney(config.minimum_pool_guarantee)}

💳 <b>Withdrawals</b>
• Status: ${withdrawalsStatus}
• Mode: ${manualWithdrawals}
• Min withdrawal: ${formatMoney(config.minimum_withdrawal)}
• Fee: ${formatMoney(config.withdrawal_fee)}

👥 <b>Membership</b>
• Fee: ${formatMoney(config.membership_fee)}
• Referral cash bonus: ${formatMoney(config.referral_cash_bonus)}

🔧 <b>System</b>
• Status: ${maintenanceStatus}
• Emails: ${config.emails_enabled ? "✅" : "❌"}
• Telegram alerts: ${config.telegram_alerts_enabled ? "✅" : "❌"}`;
}

// Get detailed withdrawals with user info
async function getWithdrawals(supabase: any): Promise<string> {
  const { data: pending, count } = await supabase
    .from("transactions")
    .select(`
      amount,
      created_at,
      metadata,
      payment_reference,
      user_id
    `, { count: "exact" })
    .eq("transaction_type", "withdrawal")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(10);

  if (!count || count === 0) {
    return "✅ <b>No pending withdrawals!</b>\n\nAll withdrawals have been processed.";
  }

  // Get user names
  const userIds = pending?.map((w: any) => w.user_id) || [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map(profiles?.map((p: any) => [p.id, p.full_name]) || []);

  // Get bank accounts
  const { data: accounts } = await supabase
    .from("withdrawal_accounts")
    .select("user_id, bank_name, account_number, account_name")
    .in("user_id", userIds)
    .eq("is_primary", true);

  const accountMap = new Map(accounts?.map((a: any) => [a.user_id, a]) || []);

  let message = `💸 <b>Pending Withdrawals</b> (${count} total)\n\n`;
  
  let totalAmount = 0;
  pending?.forEach((w: any, i: number) => {
    const amount = Number(w.amount) * -1;
    const fee = w.metadata?.withdrawal_fee || 0;
    const transfer = amount - fee;
    totalAmount += transfer;
    
    const userName = profileMap.get(w.user_id) || "Unknown";
    const account = accountMap.get(w.user_id) as { bank_name: string; account_number: string } | undefined;
    const bankInfo = account 
      ? `${account.bank_name} - ${account.account_number}`
      : "No bank saved";
    
    message += `<b>${i + 1}. ${userName}</b>\n`;
    message += `   💵 ${formatMoney(transfer)} (fee: ${formatMoney(fee)})\n`;
    message += `   🏦 ${bankInfo}\n`;
    message += `   📝 ${w.payment_reference || "No ref"}\n\n`;
  });

  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `<b>Total to transfer: ${formatMoney(totalAmount)}</b>`;

  if (count > 10) {
    message += `\n... and ${count - 10} more`;
  }

  return message;
}

// Help message
function getHelp(): string {
  return `🤖 <b>Viketa Bot Commands</b>

📊 <b>Overview</b>
/summary - Today's full summary
/balance - Platform money overview
/revenue - Revenue & income stats

👥 <b>Users</b>
/users - User statistics
/recent - Latest signups & deposits

💸 <b>Money</b>
/pending - Quick pending count
/withdrawals - Detailed withdrawal list

🎲 <b>Drops</b>
/drops - Today's drop status & pool

🎫 <b>Support</b>
/tickets - Open support tickets
/alerts - System alerts

⚙️ <b>Settings</b>
/config - Platform configuration

Just type a command to get instant info! 📊`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    console.log("📨 Telegram update received:", JSON.stringify(update));

    // Only process messages
    if (!update.message?.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = String(update.message.chat.id);
    const text = update.message.text.trim();

    // Security: Only respond to admin chat
    if (chatId !== TELEGRAM_ADMIN_CHAT_ID) {
      console.log(`⚠️ Ignoring message from unauthorized chat: ${chatId}`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Parse command
    const command = text.toLowerCase().split(" ")[0];
    let response: string;

    switch (command) {
      case "/summary":
        response = await getSummary(supabase);
        break;
      case "/pending":
        response = await getPending(supabase);
        break;
      case "/withdrawals":
        response = await getWithdrawals(supabase);
        break;
      case "/tickets":
        response = await getTickets(supabase);
        break;
      case "/balance":
        response = await getBalance(supabase);
        break;
      case "/revenue":
        response = await getRevenue(supabase);
        break;
      case "/users":
        response = await getUsers(supabase);
        break;
      case "/recent":
        response = await getRecent(supabase);
        break;
      case "/drops":
      case "/drop":
        response = await getDrops(supabase);
        break;
      case "/alerts":
        response = await getAlerts(supabase);
        break;
      case "/config":
      case "/settings":
        response = await getConfig(supabase);
        break;
      case "/help":
      case "/start":
        response = getHelp();
        break;
      default:
        response = `❓ Unknown command: ${command}\n\nType /help to see available commands.`;
    }

    // Send response back to Telegram
    await sendTelegramMessage(chatId, response);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("❌ Telegram webhook error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
