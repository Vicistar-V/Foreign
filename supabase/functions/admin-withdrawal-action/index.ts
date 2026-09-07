import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user from the token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { transactionId, action, reason } = await req.json();

    if (!transactionId || !action) {
      return new Response(JSON.stringify({ error: 'Missing transactionId or action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('admin-withdrawal-action:', { transactionId, action, adminId: user.id });

    // Get the transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('transaction_type', 'withdrawal')
      .single();

    if (txError || !transaction) {
      return new Response(JSON.stringify({ error: 'Withdrawal not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result;

    switch (action) {
      case 'verify': {
        // Check Flutterwave status - try flutterwave_id first, then payment_reference
        const flutterwaveId = transaction.metadata?.flutterwave_id || transaction.metadata?.flutterwave_transfer_id;
        const paymentReference = transaction.payment_reference;
        
        // If this is a manual mode withdrawal, cannot verify with Flutterwave
        if (transaction.metadata?.manual_mode) {
          result = { 
            status: 'pending', 
            message: 'This is a manual withdrawal awaiting your approval. Use "Approve" or "Decline" buttons.' 
          };
          break;
        }
        
        if (!flutterwaveId && !paymentReference) {
          result = { 
            status: 'pending', 
            message: 'This withdrawal is still being prepared. The payment gateway has not assigned an ID yet. Wait a moment and try again.' 
          };
          break;
        }

        const FLW_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
        let flwData;
        
        // Try flutterwave_id first (direct transfer ID)
        if (flutterwaveId) {
          console.log('Checking via flutterwave_id:', flutterwaveId);
          const flwResponse = await fetch(
            `https://api.flutterwave.com/v3/transfers/${flutterwaveId}`,
            {
              headers: {
                'Authorization': `Bearer ${FLW_SECRET_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
          flwData = await flwResponse.json();
        } else {
          // Fallback to payment_reference (same as user-facing verification)
          console.log('Checking via payment_reference:', paymentReference);
          const flwResponse = await fetch(
            `https://api.flutterwave.com/v3/transfers?reference=${paymentReference}`,
            {
              headers: {
                'Authorization': `Bearer ${FLW_SECRET_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
          const listData = await flwResponse.json();
          console.log('Flutterwave reference lookup:', listData);
          
          if (listData.status === 'success' && listData.data?.length > 0) {
            flwData = { status: 'success', data: listData.data[0] };
          } else {
            flwData = { status: 'error', message: 'Transfer not found' };
          }
        }
        
        console.log('Flutterwave status check result:', flwData);

        if (flwData.status === 'success' && flwData.data) {
          const transferStatus = flwData.data?.status;
          const transferId = flwData.data?.id;
          
          // Update transaction if status changed to SUCCESSFUL
          if (transferStatus === 'SUCCESSFUL' && transaction.status !== 'completed') {
            await supabase
              .from('transactions')
              .update({
                status: 'completed',
                metadata: {
                  ...transaction.metadata,
                  flutterwave_id: transferId,
                  verified_at: new Date().toISOString(),
                  verified_by: user.id,
                  flutterwave_status: transferStatus
                }
              })
              .eq('id', transactionId);

            // Notify user
            const transferAmount = transaction.metadata?.transfer_amount || (Math.abs(transaction.amount) - (transaction.metadata?.withdrawal_fee || 50));
            await supabase.from('notifications').insert({
              user_id: transaction.user_id,
              notification_type: 'withdrawal_complete',
              title: 'Money Sent!',
              message: `₦${transferAmount.toLocaleString()} has been sent to your bank account`,
              metadata: { amount: transferAmount },
              link: '/wallets'
            });

            result = { status: 'completed', message: 'Withdrawal confirmed as successful!' };
          } else if (transferStatus === 'FAILED' && transaction.status !== 'failed') {
            // AUTO-REFUND on failure - refund FULL amount including fee
            const fullAmount = Math.abs(transaction.amount);
            const fee = transaction.metadata?.withdrawal_fee || 50;
            const failureReason = flwData.data?.complete_message || 'Bank transfer failed';
            
            console.log('Auto-refunding failed withdrawal:', { fullAmount, fee, failureReason });
            
            // Create refund transaction - FULL amount (user gets everything back)
            await supabase.from('transactions').insert({
              user_id: transaction.user_id,
              wallet_type: 'earnings',
              amount: fullAmount,
              transaction_type: 'withdrawal_refund',
              description: 'Withdrawal refund - Bank transfer failed',
              status: 'completed',
              metadata: {
                original_transaction_id: transactionId,
                auto_refund: true,
                failure_reason: failureReason,
                includes_fee: true
              }
            });
            
            // System treasury removed — no fee reversal entry needed.

            
            // Update original transaction
            await supabase.from('transactions').update({
              status: 'failed',
              metadata: {
                ...transaction.metadata,
                flutterwave_id: transferId,
                failure_reason: failureReason,
                auto_refunded: true,
                refunded_at: new Date().toISOString()
              }
            }).eq('id', transactionId);
            
            // Notify user
            await supabase.from('notifications').insert({
              user_id: transaction.user_id,
              notification_type: 'withdrawal_failed',
              title: 'Withdrawal Failed',
              message: `₦${fullAmount.toLocaleString()} has been returned to your wallet. Reason: ${failureReason}`,
              metadata: { amount: fullAmount, reason: failureReason, refunded: true },
              link: '/wallets'
            });
            
            result = { 
              status: 'failed', 
              message: `Transfer failed: ${failureReason}. User has been automatically refunded ₦${fullAmount.toLocaleString()} (including fee).`
            };
          } else if (transferStatus === 'FAILED') {
            result = { 
              status: 'failed', 
              message: `Transfer failed: ${flwData.data?.complete_message || 'Unknown error'}. Already refunded.`
            };
          } else {
            result = { 
              status: transferStatus?.toLowerCase() || 'pending', 
              message: `Current status: ${transferStatus}. Check again in a few minutes.`
            };
          }
        } else {
          result = { status: 'error', message: 'Could not verify with payment gateway. Try again later.' };
        }
        break;
      }

      case 'manual_approve': {
        // Admin manually approves a manual-mode withdrawal (they have sent the money themselves)
        if (transaction.status !== 'pending') {
          return new Response(JSON.stringify({ 
            error: 'Cannot approve - withdrawal is not pending' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const transferAmount = transaction.metadata?.transfer_amount || 
          (Math.abs(transaction.amount) - (transaction.metadata?.withdrawal_fee || 50));

        // Mark as completed
        await supabase
          .from('transactions')
          .update({
            status: 'completed',
            metadata: {
              ...transaction.metadata,
              manually_approved_at: new Date().toISOString(),
              manually_approved_by: user.id,
              approval_note: reason || 'Admin confirmed transfer was made manually'
            }
          })
          .eq('id', transactionId);

        // Notify user
        await supabase.from('notifications').insert({
          user_id: transaction.user_id,
          notification_type: 'withdrawal_complete',
          title: 'Money Sent!',
          message: `₦${transferAmount.toLocaleString()} has been sent to your bank account`,
          metadata: { amount: transferAmount },
          link: '/wallets'
        });

        result = { 
          status: 'completed', 
          message: `Withdrawal approved! User will receive ₦${transferAmount.toLocaleString()} notification.`
        };
        break;
      }

      case 'manual_decline':
      case 'refund': {
        // Decline/refund a withdrawal - give user FULL amount back (including fee)
        if (transaction.status === 'completed') {
          return new Response(JSON.stringify({ 
            error: 'Cannot refund a completed withdrawal' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get the FULL amount (what was debited from user) - this is always the absolute value
        const fullAmount = Math.abs(transaction.amount);
        const fee = transaction.metadata?.withdrawal_fee || 50;

        console.log('Refunding full amount including fee:', { fullAmount, fee });

        // Create refund transaction - FULL amount (user gets everything back)
        const { error: refundError } = await supabase
          .from('transactions')
          .insert({
            user_id: transaction.user_id,
            wallet_type: 'earnings',
            amount: fullAmount,
            transaction_type: 'withdrawal_refund',
            description: `Withdrawal declined - Full refund`,
            status: 'completed',
            metadata: {
              original_transaction_id: transactionId,
              refunded_by: user.id,
              refund_reason: reason || 'Admin declined withdrawal',
              refunded_at: new Date().toISOString(),
              includes_fee: true,
              original_fee: fee
            }
          });

        if (refundError) {
          console.error('Refund error:', refundError);
          throw refundError;
        }

        // System treasury removed — no fee reversal entry needed.


        // Update original transaction as failed/declined
        await supabase
          .from('transactions')
          .update({
            status: 'failed',
            metadata: {
              ...transaction.metadata,
              declined_at: new Date().toISOString(),
              declined_by: user.id,
              decline_reason: reason || 'Admin declined withdrawal'
            }
          })
          .eq('id', transactionId);

        // Notify user
        const declineReason = reason || 'Your withdrawal request was declined. The full amount has been returned to your account.';
        await supabase.from('notifications').insert({
          user_id: transaction.user_id,
          notification_type: 'withdrawal_failed',
          title: 'Withdrawal Declined',
          message: `₦${fullAmount.toLocaleString()} has been returned to your wallet. ${declineReason}`,
          metadata: { amount: fullAmount, reason: declineReason, refunded: true },
          link: '/wallets'
        });

        result = { 
          status: 'declined', 
          message: `Withdrawal declined. ₦${fullAmount.toLocaleString()} (including ₦${fee} fee) refunded to user.` 
        };
        break;
      }

      case 'mark_complete': {
        // Manually mark as complete (for cases where Flutterwave succeeded but webhook failed)
        const transferAmount = transaction.metadata?.transfer_amount || 
          (Math.abs(transaction.amount) - (transaction.metadata?.withdrawal_fee || 50));

        await supabase
          .from('transactions')
          .update({
            status: 'completed',
            metadata: {
              ...transaction.metadata,
              manually_completed_at: new Date().toISOString(),
              manually_completed_by: user.id,
              completion_reason: reason || 'Manual admin completion'
            }
          })
          .eq('id', transactionId);

        // Notify user
        await supabase.from('notifications').insert({
          user_id: transaction.user_id,
          notification_type: 'withdrawal_complete',
          title: 'Money Sent!',
          message: `₦${transferAmount.toLocaleString()} has been sent to your bank account`,
          metadata: { amount: transferAmount },
          link: '/wallets'
        });

        result = { status: 'completed', message: 'Withdrawal marked as complete' };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    console.log('admin-withdrawal-action: Complete', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('admin-withdrawal-action: Error', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});