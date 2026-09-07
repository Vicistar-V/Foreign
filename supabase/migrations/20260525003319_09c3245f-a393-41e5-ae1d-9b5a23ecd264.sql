
INSERT INTO public.notifications (user_id, notification_type, title, message, link, metadata)
VALUES (
  '343da76e-ed8c-412c-91f1-29ad323c8777',
  'withdrawal_issue_resolved',
  'Your withdrawal is ready to retry',
  'Hi Jessica! Earlier your ₦958 withdrawal to PalmPay did not go through because of a small system glitch on our side. Good news — your money was never touched, it is still safely in your earnings wallet. We have fixed the issue. Please tap the button below to send the withdrawal again. It will work this time. Sorry for the wait!',
  '/transactions',
  jsonb_build_object(
    'show_as_modal', true,
    'icon_template', 'check-circle',
    'cta_button_text', 'Try Withdrawal Again',
    'cta_button_link', '/transactions',
    'reason', 'withdrawal_fk_glitch_resolved',
    'amount', 958,
    'bank', 'PalmPay'
  )
);
