import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeWebhookUrl(value: string | undefined | null) {
  const input = value?.trim();
  if (!input) return null;

  const markdownLink = input.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/i);
  const candidate = markdownLink?.[1] ?? input;

  try {
    return new URL(candidate).toString();
  } catch {
    throw new Error(
      "SMS_WEBHOOK_URL is invalid. Save only the raw webhook URL, for example https://example.com/sms",
    );
  }
}

function buildArkeselUrl(rawUrl: string) {
  const parsed = new URL(rawUrl);
  if (
    parsed.hostname === "sms.arkesel.com" &&
    parsed.pathname === "/user/sms-api/info"
  ) {
    return new URL("https://sms.arkesel.com/sms/api");
  }
  return parsed;
}

function normalizePhoneNumber(value: string) {
  const digits = value.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!digits) throw new Error("Recipient phone number is required");

  if (/^233\d{9}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return `233${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `233${digits}`;

  return digits;
}

function normalizeSenderName(value: string) {
  const cleaned = value
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "SchoolPTA";
  return cleaned.slice(0, 11);
}

function money(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function fillTemplate(
  template: string,
  values: Record<string, string>,
) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

async function sendGenericWebhookSms(input: {
  smsWebhookUrl: string;
  smsApiKey: string | undefined;
  smsAuthHeader: string;
  to: string;
  message: string;
  sender: string;
  metadata: Record<string, string>;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (input.smsApiKey) headers[input.smsAuthHeader] = input.smsApiKey;

  return await fetch(input.smsWebhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to: input.to,
      message: input.message,
      sender: input.sender,
      metadata: input.metadata,
    }),
  });
}

async function sendArkeselSms(input: {
  smsWebhookUrl: string;
  smsApiKey: string | undefined;
  to: string;
  message: string;
  sender: string;
}) {
  if (!input.smsApiKey?.trim()) {
    throw new Error("SMS_API_KEY is required for Arkesel");
  }

  const url = buildArkeselUrl(input.smsWebhookUrl);
  url.searchParams.set("action", "send-sms");
  url.searchParams.set("api_key", input.smsApiKey.trim());
  url.searchParams.set("to", input.to);
  url.searchParams.set("from", input.sender);
  url.searchParams.set("sms", input.message);

  return await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json, text/plain, */*" },
  });
}

async function readProviderPayload(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text.trim();
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer "))
      return json({ error: "Authentication required" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const smsWebhookUrl = normalizeWebhookUrl(Deno.env.get("SMS_WEBHOOK_URL"));
    const smsApiKey = Deno.env.get("SMS_API_KEY");
    const smsAuthHeader = Deno.env.get("SMS_AUTH_HEADER") ?? "Authorization";

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user)
      return json({ error: "Invalid or expired session" }, 401);

    const { data: caller } = await userClient
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    if (!caller || !["administrator", "accountant"].includes(caller.role))
      return json({ error: "Staff access required" }, 403);

    const body = (await req.json()) as {
      payment_id?: string;
      test_phone?: string;
      test_message?: string;
    };
    if (!body.payment_id && !body.test_phone) {
      return json({ error: "payment_id or test_phone is required" }, 422);
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: settings, error: settingsError } = await admin
      .from("school_settings")
      .select("*")
      .eq("id", true)
      .single();
    if (settingsError || !settings)
      throw settingsError ?? new Error("School settings not found");

    if (!settings.sms_enabled)
      return json({ skipped: true, reason: "sms_disabled" });

    if (!smsWebhookUrl)
      return json({ skipped: true, reason: "sms_webhook_not_configured" });

    let recipientPhone = "";
    let message = "";
    let metadata: Record<string, string> = {
      triggered_by: user.id,
      triggered_by_name: caller.full_name,
    };

    if (body.test_phone) {
      recipientPhone = body.test_phone.trim();
      message =
        body.test_message?.trim() ||
        fillTemplate(settings.sms_alert_template, {
          parent_name: "Test Parent",
          student_name: "Test Student",
          amount: money(10),
          payment_date: shortDate(new Date().toISOString()),
          receipt_number: "TEST-RECEIPT",
          balance: money(0),
          school_name: settings.school_name,
          sender_name: settings.sms_sender_name,
        });
      metadata = {
        ...metadata,
        mode: "test",
      };
    } else {
      const { data: payment, error: paymentError } = await admin
        .from("payment_receipts")
        .select(
          "id,student_id,student_name,admission_number,class_name,academic_year,amount_paid,payment_date,receipt_number,total_paid,outstanding_balance",
        )
        .eq("id", body.payment_id!)
        .single();
      if (paymentError || !payment)
        throw paymentError ?? new Error("Payment not found");

      const { data: student, error: studentError } = await admin
        .from("students")
        .select("parent_name,parent_phone")
        .eq("id", payment.student_id)
        .single();
      if (studentError || !student)
        throw studentError ?? new Error("Student not found");

      if (!student.parent_phone?.trim())
        return json({ skipped: true, reason: "missing_parent_phone" });

      recipientPhone = student.parent_phone.trim();
      message = fillTemplate(settings.sms_alert_template, {
        parent_name: student.parent_name ?? "Parent",
        student_name: payment.student_name,
        amount: money(Number(payment.amount_paid)),
        payment_date: shortDate(payment.payment_date),
        receipt_number: payment.receipt_number,
        balance: money(Number(payment.outstanding_balance)),
        school_name: settings.school_name,
        sender_name: settings.sms_sender_name,
      });
      metadata = {
        ...metadata,
        payment_id: payment.id,
        receipt_number: payment.receipt_number,
        student_id: payment.student_id,
      };
    }

    const normalizedPhone = normalizePhoneNumber(recipientPhone);
    const normalizedSender = normalizeSenderName(settings.sms_sender_name);

    const response = smsWebhookUrl.includes("sms.arkesel.com")
      ? await sendArkeselSms({
          smsWebhookUrl,
          smsApiKey,
          to: normalizedPhone,
          message,
          sender: normalizedSender,
        })
      : await sendGenericWebhookSms({
          smsWebhookUrl,
          smsApiKey,
          smsAuthHeader,
          to: normalizedPhone,
          message,
          sender: normalizedSender,
          metadata,
        });

    const provider = await readProviderPayload(response);

    if (!response.ok) {
      throw new Error(
        `SMS provider request failed (${response.status}): ${
          typeof provider === "string" ? provider : JSON.stringify(provider)
        }`,
      );
    }

    return json({
      success: true,
      recipient: normalizedPhone,
      sender: normalizedSender,
      provider,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return json({ error: message }, 400);
  }
});
