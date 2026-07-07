import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function resolveStudentRedirectUrl(configured: string | null | undefined) {
  const saved = configured?.trim();
  if (saved) return saved;
  return "https://schooldashborad.com/#/student";
}

function buildFunctionCallbackUrl(req: Request) {
  const url = new URL(req.url);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function redirectWithParams(baseUrl: string, params: Record<string, string>) {
  const hashIndex = baseUrl.indexOf("#");

  if (hashIndex >= 0) {
    const beforeHash = baseUrl.slice(0, hashIndex);
    const hashPart = baseUrl.slice(hashIndex + 1);
    const normalizedHash = hashPart.startsWith("/") ? hashPart : "/" + hashPart;
    const hashUrl = new URL(normalizedHash, "https://codex.local");

    for (const [key, value] of Object.entries(params)) {
      if (value) hashUrl.searchParams.set(key, value);
    }

    const target = beforeHash + "#" + hashUrl.pathname + hashUrl.search;

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: target,
      },
    });
  }

  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: url.toString(),
    },
  });
}

function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    encodeURIComponent(values[key] ?? ""),
  );
}

function isValidEmail(value: string | null | undefined) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function normalizeEmail(value: string | null | undefined) {
  const email = String(value ?? "").trim().toLowerCase();
  return isValidEmail(email) ? email : null;
}

function isSyntheticStudentEmail(value: string | null | undefined) {
  const email = normalizeEmail(value);
  return Boolean(email?.endsWith("@students.apex.edu.gh"));
}

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

function academicYearSortValue(value: string | null | undefined) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})\/(\d{4})(?:\s*-\s*Semester\s*(\d+))?/i);
  if (!match) return 0;
  const startYear = Number(match[1] ?? 0);
  const semester = Number(match[3] ?? 0);
  return startYear * 10 + semester;
}

function buildStudentFeeOverview(
  rows: Array<{
    academic_year_id: string;
    year?: string | null;
    fee_amount?: number | string | null;
    total_paid?: number | string | null;
    outstanding_balance?: number | string | null;
  }>,
  activeAcademicYearId: string,
) {
  const numeric = (value: number | string | null | undefined) => Number(value ?? 0);
  const activeSummary =
    rows.find((row) => row.academic_year_id === activeAcademicYearId) ?? null;
  const activeSort = academicYearSortValue(activeSummary?.year);
  const previousOutstanding = rows
    .filter(
      (row) =>
        row.academic_year_id !== activeAcademicYearId &&
        academicYearSortValue(row.year) < activeSort,
    )
    .reduce((sum, row) => sum + numeric(row.outstanding_balance), 0);
  const activeExpected = numeric(activeSummary?.fee_amount);
  const activeCollected = numeric(activeSummary?.total_paid);
  const activeOutstanding = numeric(activeSummary?.outstanding_balance);
  const totalDebt = activeOutstanding + previousOutstanding;

  return {
    activeSummary,
    activeExpected,
    activeCollected,
    activeOutstanding,
    previousOutstanding,
    totalDebt,
  };
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

function fillSmsTemplate(
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

async function dispatchSms(input: {
  webhookUrl: string;
  apiKey: string | undefined;
  authHeader: string;
  to: string;
  message: string;
  sender: string;
  metadata: Record<string, string>;
}) {
  const normalizedPhone = normalizePhoneNumber(input.to);
  const normalizedSender = normalizeSenderName(input.sender);
  const response = input.webhookUrl.includes("sms.arkesel.com")
    ? await sendArkeselSms({
        smsWebhookUrl: input.webhookUrl,
        smsApiKey: input.apiKey,
        to: normalizedPhone,
        message: input.message,
        sender: normalizedSender,
      })
    : await sendGenericWebhookSms({
        smsWebhookUrl: input.webhookUrl,
        smsApiKey: input.apiKey,
        smsAuthHeader: input.authHeader,
        to: normalizedPhone,
        message: input.message,
        sender: normalizedSender,
        metadata: input.metadata,
      });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SMS provider request failed (${response.status}): ${text}`);
  }
}

async function initializePaystack(input: {
  secretKey: string;
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl?: string | null;
  metadata: Record<string, unknown>;
}) {
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amount * 100),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl || undefined,
      metadata: input.metadata,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.status || !payload?.data?.authorization_url) {
    const message =
      payload?.message ||
      `Paystack initialize failed with status ${response.status}`;
    throw new Error(`${message} (email: ${input.email})`);
  }

  return payload.data.authorization_url as string;
}

async function verifyPaystack(reference: string, secretKey: string) {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.status || !payload?.data) {
    throw new Error(
      payload?.message || `Paystack verify failed with status ${response.status}`,
    );
  }
  return payload.data as {
    status: string;
    amount: number;
    currency: string;
    reference: string;
    metadata?: Record<string, unknown>;
  };
}

async function sendConfirmationSms(input: {
  admin: ReturnType<typeof createClient>;
  paymentId: string;
  settings: {
    sms_enabled: boolean;
    sms_sender_name: string;
    sms_alert_template: string;
    school_name: string;
    phone: string | null;
  };
  smsWebhookUrl: string | null;
  smsApiKey: string | undefined;
  smsAuthHeader: string;
}) {
  if (!input.settings.sms_enabled || !input.smsWebhookUrl) return;

  const { data: payment, error: paymentError } = await input.admin
    .from("payment_receipts")
    .select(
      "id,student_id,student_name,admission_number,class_name,academic_year,amount_paid,payment_date,receipt_number,total_paid,outstanding_balance",
    )
    .eq("id", input.paymentId)
    .single();
  if (paymentError || !payment) throw paymentError ?? new Error("Payment not found");

  const { data: student, error: studentError } = await input.admin
    .from("students")
    .select("parent_name,parent_phone")
    .eq("id", payment.student_id)
    .single();
  if (studentError || !student)
    throw studentError ?? new Error("Student not found");

  const parentMessage = fillSmsTemplate(input.settings.sms_alert_template, {
    parent_name: student.parent_name ?? "Parent",
    student_name: payment.student_name,
    amount: money(Number(payment.amount_paid)),
    payment_date: shortDate(payment.payment_date),
    receipt_number: payment.receipt_number,
    balance: money(Number(payment.outstanding_balance)),
    school_name: input.settings.school_name,
    sender_name: input.settings.sms_sender_name,
  });

  if (student.parent_phone?.trim()) {
    await dispatchSms({
      webhookUrl: input.smsWebhookUrl,
      apiKey: input.smsApiKey,
      authHeader: input.smsAuthHeader,
      to: student.parent_phone,
      message: parentMessage,
      sender: input.settings.sms_sender_name,
      metadata: {
        payment_id: payment.id,
        receipt_number: payment.receipt_number,
        student_id: payment.student_id,
        mode: "online-parent",
      },
    });
  }

  if (input.settings.phone?.trim()) {
    const adminMessage =
      `Online PTA payment received: ${money(Number(payment.amount_paid))} ` +
      `for ${payment.student_name} (${payment.admission_number}) on ` +
      `${shortDate(payment.payment_date)}. Receipt ${payment.receipt_number}. ` +
      `Balance ${money(Number(payment.outstanding_balance))}.`;
    await dispatchSms({
      webhookUrl: input.smsWebhookUrl,
      apiKey: input.smsApiKey,
      authHeader: input.smsAuthHeader,
      to: input.settings.phone,
      message: adminMessage,
      sender: input.settings.sms_sender_name,
      metadata: {
        payment_id: payment.id,
        receipt_number: payment.receipt_number,
        student_id: payment.student_id,
        mode: "online-admin",
      },
    });
  }
}

async function verifyAndRecordPayment(input: {
  admin: ReturnType<typeof createClient>;
  studentId: string;
  academicYearId: string;
  reference: string;
  paystackSecretKey: string;
  paystackCurrency: string;
  checkoutEmail: string | null;
  settings: {
    sms_enabled: boolean;
    sms_sender_name: string;
    sms_alert_template: string;
    school_name: string;
    phone: string | null;
  };
  smsWebhookUrl: string | null;
  smsApiKey: string | undefined;
  smsAuthHeader: string;
}) {
  const { data: tx, error: txError } = await input.admin
    .from("online_payment_transactions")
    .select("*")
    .eq("reference", input.reference)
    .eq("student_id", input.studentId)
    .maybeSingle();
  if (txError) throw txError;
  if (!tx) throw new Error("Payment transaction not found");

  if (tx.payment_id) {
    const { data: receipt, error: receiptError } = await input.admin
      .from("payment_receipts")
      .select("id,receipt_number,amount_paid,student_id")
      .eq("id", tx.payment_id)
      .single();
    if (receiptError || !receipt) {
      throw receiptError ?? new Error("Recorded receipt not found");
    }
    return {
      success: true,
      payment_id: receipt.id,
      receipt_number: receipt.receipt_number,
      amount_paid: Number(receipt.amount_paid ?? tx.paid_amount ?? 0),
      student_id: receipt.student_id,
    };
  }

  const verified = await verifyPaystack(input.reference, input.paystackSecretKey);
  if (verified.status !== "success") {
    throw new Error(`Payment status is ${verified.status}`);
  }

  const paidAmount = Number(verified.amount ?? 0) / 100;
  if (paidAmount <= 0) {
    throw new Error("Verified amount must be greater than zero");
  }

  const payment = await input.admin.rpc("record_online_payment", {
    p_reference: input.reference,
    p_student_id: input.studentId,
    p_academic_year_id: input.academicYearId,
    p_amount: paidAmount,
    p_provider: "paystack",
    p_currency: String(verified.currency ?? input.paystackCurrency),
    p_checkout_email: input.checkoutEmail,
    p_provider_payload: verified,
    p_remarks: `Paystack online payment (${input.reference})`,
  });
  if (payment.error) throw payment.error;
  const created = payment.data as { id: string };

  await sendConfirmationSms({
    admin: input.admin,
    paymentId: created.id,
    settings: input.settings,
    smsWebhookUrl: input.smsWebhookUrl,
    smsApiKey: input.smsApiKey,
    smsAuthHeader: input.smsAuthHeader,
  }).catch(() => {
    // Payment recording should not fail if SMS dispatch fails.
  });

  const { data: receipt, error: receiptError } = await input.admin
    .from("payment_receipts")
    .select("id,receipt_number,amount_paid,student_id")
    .eq("id", created.id)
    .single();
  if (receiptError || !receipt) {
    throw receiptError ?? new Error("Receipt not found after recording payment");
  }

  return {
    success: true,
    payment_id: receipt.id,
    receipt_number: receipt.receipt_number,
    amount_paid: Number(receipt.amount_paid),
    student_id: receipt.student_id,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const template = Deno.env.get("ONLINE_PAYMENT_URL_TEMPLATE")?.trim();
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY")?.trim();
    const paystackCurrency = Deno.env.get("PAYSTACK_CURRENCY")?.trim() || "GHS";
    const configuredCallbackUrl = Deno.env.get("PAYSTACK_CALLBACK_URL")?.trim();
    const callbackUrl = configuredCallbackUrl || buildFunctionCallbackUrl(req);
    const studentRedirectUrl = resolveStudentRedirectUrl(
      Deno.env.get("PAYSTACK_STUDENT_REDIRECT_URL")?.trim(),
    );
    const smsWebhookUrl = normalizeWebhookUrl(Deno.env.get("SMS_WEBHOOK_URL"));
    const smsApiKey = Deno.env.get("SMS_API_KEY");
    const smsAuthHeader = Deno.env.get("SMS_AUTH_HEADER") ?? "Authorization";

    if (req.method === "GET") {
      const requestUrl = new URL(req.url);
      const reference =
        requestUrl.searchParams.get("reference")?.trim() ||
        requestUrl.searchParams.get("trxref")?.trim() ||
        "";

      if (!reference) {
        return redirectWithParams(studentRedirectUrl, {
          payment: "error",
          message: "Missing payment reference",
        });
      }

      if (!paystackSecretKey) {
        return redirectWithParams(studentRedirectUrl, {
          reference,
          trxref: reference,
          payment: "error",
          message: "PAYSTACK_SECRET_KEY is not configured",
        });
      }

      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      try {
        const { data: tx, error: txError } = await admin
          .from("online_payment_transactions")
          .select("student_id,academic_year_id,checkout_email")
          .eq("reference", reference)
          .maybeSingle();
        if (txError) throw txError;
        if (!tx) throw new Error("Payment transaction not found");

        const { data: settings, error: settingsError } = await admin
          .from("school_settings")
          .select("sms_enabled,sms_sender_name,sms_alert_template,school_name,phone")
          .eq("id", true)
          .single();
        if (settingsError || !settings) {
          throw settingsError ?? new Error("School settings not found");
        }

        await verifyAndRecordPayment({
          admin,
          studentId: tx.student_id,
          academicYearId: tx.academic_year_id,
          reference,
          paystackSecretKey,
          paystackCurrency,
          checkoutEmail: tx.checkout_email,
          settings,
          smsWebhookUrl,
          smsApiKey,
          smsAuthHeader,
        });

        return redirectWithParams(studentRedirectUrl, {
          reference,
          trxref: reference,
          payment: "success",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Payment verification failed";
        return redirectWithParams(studentRedirectUrl, {
          reference,
          trxref: reference,
          payment: "error",
          message,
        });
      }
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer "))
      return json({ error: "Authentication required" }, 401);

    const body = (await req.json().catch(() => ({}))) as {
      action?: "initialize" | "verify";
      amount?: number;
      reference?: string;
    };

    if (!paystackSecretKey && !template)
      return json(
        {
          error:
            "No online payment provider is configured. Set PAYSTACK_SECRET_KEY or ONLINE_PAYMENT_URL_TEMPLATE.",
        },
        400,
      );

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user)
      return json({ error: "Invalid or expired session" }, 401);

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: account, error: accountError } = await admin
      .from("student_accounts")
      .select("student_id, login_email")
      .eq("user_id", user.id)
      .single();
    if (accountError || !account)
      return json({ error: "Student access required" }, 403);

    const { data: year, error: yearError } = await admin
      .from("academic_years")
      .select("*")
      .eq("is_active", true)
      .single();
    if (yearError || !year)
      throw yearError ?? new Error("Active academic year not found");

        const [
      { data: student, error: studentError },
      { data: summaries, error: summaryError },
      { data: settings, error: settingsError },
    ] = await Promise.all([
      admin
        .from("students")
        .select("id,admission_number,first_name,last_name,parent_phone,parent_name")
        .eq("id", account.student_id)
        .single(),
      admin
        .from("student_fee_summary")
        .select("academic_year_id,year,fee_amount,total_paid,outstanding_balance")
        .eq("student_id", account.student_id)
        .order("year"),
      admin
        .from("school_settings")
        .select("online_payment_enabled,school_name,pta_name,email,phone,sms_enabled,sms_sender_name,sms_alert_template")
        .eq("id", true)
        .single(),
    ]);

    if (studentError || !student)
      throw studentError ?? new Error("Student record not found");
    if (summaryError || !summaries?.length)
      throw summaryError ?? new Error("Student summary not found");
    if (settingsError || !settings)
      throw settingsError ?? new Error("School settings not found");
    if (!settings.online_payment_enabled)
      return json({ error: "Online payment is disabled" }, 400);

    const studentName = `${student.first_name} ${student.last_name}`.trim();
    const feeOverview = buildStudentFeeOverview(
      summaries as Array<{
        academic_year_id: string;
        year?: string | null;
        fee_amount?: number | string | null;
        total_paid?: number | string | null;
        outstanding_balance?: number | string | null;
      }>,
      year.id,
    );
    if (!feeOverview.activeSummary) {
      throw new Error("No fee summary found for the active semester");
    }
    const balance = Number(feeOverview.totalDebt ?? 0);
    const feeAmount = Number(feeOverview.activeExpected ?? 0);

    if (body.action === "verify") {
      if (!paystackSecretKey)
        return json({ error: "PAYSTACK_SECRET_KEY is not configured" }, 400);
      if (!body.reference?.trim())
        return json({ error: "reference is required" }, 422);

      const reference = body.reference.trim();
      const { data: tx, error: txError } = await admin
        .from("online_payment_transactions")
        .select("student_id")
        .eq("reference", reference)
        .eq("student_id", student.id)
        .maybeSingle();
      if (txError) throw txError;
      if (!tx)
        return json({ error: "Payment transaction not found" }, 404);

      const checkoutEmail =
        normalizeEmail(settings.email) ??
        (!isSyntheticStudentEmail(user.email) ? normalizeEmail(user.email) : null) ??
        (!isSyntheticStudentEmail(account.login_email)
          ? normalizeEmail(account.login_email)
          : null);

      const receipt = await verifyAndRecordPayment({
        admin,
        studentId: student.id,
        academicYearId: year.id,
        reference,
        paystackSecretKey,
        paystackCurrency,
        checkoutEmail,
        settings,
        smsWebhookUrl,
        smsApiKey,
        smsAuthHeader,
      });

      return json(receipt);
    }

    const numeric = Number(body.amount ?? 0);
    if (!Number.isFinite(numeric) || numeric <= 0)
      return json({ error: "Enter a valid payment amount" }, 422);
    if (numeric > balance)
      return json({ error: "Amount cannot exceed total debt" }, 422);

    if (paystackSecretKey) {
      const checkoutEmail =
        normalizeEmail(settings.email) ??
        (!isSyntheticStudentEmail(user.email) ? normalizeEmail(user.email) : null) ??
        (!isSyntheticStudentEmail(account.login_email)
          ? normalizeEmail(account.login_email)
          : null);

      if (!checkoutEmail) {
        return json(
          {
            error:
              "A real valid email is required for Paystack checkout. Add the school email in Settings or update the student account email.",
          },
          400,
        );
      }

      const reference = `PTA-${student.admission_number.replace(/[^A-Za-z0-9]/g, "")}-${Date.now()}`;
      const checkoutUrl = await initializePaystack({
        secretKey: paystackSecretKey,
        email: checkoutEmail,
        amount: numeric,
        currency: paystackCurrency,
        reference,
        callbackUrl,
        metadata: {
          source: "pta-student-portal",
          student_id: student.id,
          student_name: studentName,
          admission_number: student.admission_number,
          academic_year_id: year.id,
          academic_year: String(year.year),
          fee_amount: feeAmount,
          outstanding_balance: balance,
          selected_amount: numeric,
          school_name: settings.school_name,
          pta_name: settings.pta_name,
        },
      });

      const { error: txInsertError } = await admin
        .from("online_payment_transactions")
        .upsert(
          {
            provider: "paystack",
            reference,
            student_id: student.id,
            academic_year_id: year.id,
            expected_amount: numeric,
            currency: paystackCurrency,
            status: "initialized",
            checkout_email: checkoutEmail,
            provider_payload: {
              student_name: studentName,
              academic_year: year.year,
              selected_amount: numeric,
            },
          },
          { onConflict: "reference" },
        );
      if (txInsertError) throw txInsertError;

      return json({
        url: checkoutUrl,
        provider: "paystack",
        mode: "initialize",
        reference,
      });
    }

    const paymentUrl = fillTemplate(template!, {
      student_id: student.id,
      student_name: studentName,
      admission_number: student.admission_number,
      amount: String(numeric),
      balance: String(balance),
      academic_year: String(year.year),
    });

    return json({ url: paymentUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return json({ error: message }, 400);
  }
});


