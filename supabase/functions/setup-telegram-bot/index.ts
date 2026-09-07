import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    console.log('setup-telegram-bot: Setting up bot commands and menu...');

    // Define all available commands
    const commands = [
      { command: 'summary', description: '📊 Quick overview of today\'s numbers' },
      { command: 'pending', description: '⏳ Show pending withdrawals' },
      { command: 'tickets', description: '🎫 Show open support tickets' },
      { command: 'balance', description: '💰 Show platform money status' },
      { command: 'users', description: '👥 Show member counts' },
      { command: 'drops', description: '🎯 Show today\'s drop info' },
      { command: 'alerts', description: '🔔 Show recent alerts' },
      { command: 'revenue', description: '📈 Show money earned' },
      { command: 'recent', description: '🕐 Show latest activity' },
      { command: 'config', description: '⚙️ Show platform settings' },
      { command: 'withdrawals', description: '💸 Show detailed withdrawals' },
      { command: 'help', description: '❓ Show all commands' },
    ];

    // Step 1: Register commands with Telegram
    console.log('setup-telegram-bot: Registering commands...');
    const setCommandsResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands }),
      }
    );

    const setCommandsResult = await setCommandsResponse.json();
    console.log('setup-telegram-bot: setMyCommands result:', setCommandsResult);

    if (!setCommandsResult.ok) {
      throw new Error(`Failed to set commands: ${setCommandsResult.description}`);
    }

    // Step 2: Set up the menu button to show commands
    console.log('setup-telegram-bot: Setting up menu button...');
    const setChatMenuButtonResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setChatMenuButton`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_button: {
            type: 'commands',
          },
        }),
      }
    );

    const setChatMenuButtonResult = await setChatMenuButtonResponse.json();
    console.log('setup-telegram-bot: setChatMenuButton result:', setChatMenuButtonResult);

    // Step 3: Get bot info for confirmation
    const getBotResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`
    );
    const botInfo = await getBotResponse.json();

    console.log('setup-telegram-bot: Setup complete!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Bot setup complete!',
        botName: botInfo.result?.first_name || 'Unknown',
        botUsername: botInfo.result?.username || 'Unknown',
        commandsRegistered: commands.length,
        commands: commands.map(c => `/${c.command} - ${c.description}`),
        instructions: [
          '✅ Commands are now registered with Telegram',
          '✅ Menu button is set to show commands',
          '📱 Open your Telegram chat with the bot',
          '⌨️ Type "/" to see all available commands',
          '📋 Or tap the menu button (☰) next to the text input',
        ],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('setup-telegram-bot: Error:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
