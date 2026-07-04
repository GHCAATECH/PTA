alter table public.school_settings
  add column if not exists sms_enabled boolean not null default false,
  add column if not exists sms_sender_name text not null default 'School PTA',
  add column if not exists sms_alert_template text not null default 'Hello {{parent_name}}, we have received {{amount}} for {{student_name}} on {{payment_date}}. Receipt: {{receipt_number}}. Outstanding balance: {{balance}}. - {{school_name}}';
