import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Save, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useSettings } from "../hooks/use-data";
import { api } from "../lib/api";

export function SettingsPage() {
  const settings = useSettings(),
    qc = useQueryClient(),
    fileRef = useRef<HTMLInputElement>(null),
    testPhoneRef = useRef<HTMLInputElement>(null);
  const save = useMutation({
      mutationFn: api.saveSettings,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["settings"] });
        toast.success("School settings saved");
      },
      onError: (e) => toast.error(e.message),
    }),
    upload = useMutation({
      mutationFn: api.uploadLogo,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["settings"] });
        toast.success("School logo updated");
      },
      onError: (e) => toast.error(e.message),
    }),
    testSms = useMutation({
      mutationFn: api.sendTestSms,
      onSuccess: (result) => {
        if (result.skipped) {
          toast.message(`Test SMS not sent: ${result.reason ?? "skipped"}`);
          return;
        }
        toast.success(
          result.recipient
            ? `Test SMS sent to ${result.recipient}`
            : "Test SMS sent successfully",
        );
      },
      onError: (e) => toast.error(e.message),
    });
  if (settings.isLoading)
    return (
      <div className="grid min-h-80 place-items-center">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    );
  if (!settings.data)
    return (
      <Card className="p-10 text-center text-rose-600">
        School settings could not be loaded.
      </Card>
    );
  const s = settings.data;
  const submit = (form: HTMLFormElement) => {
    const d = new FormData(form);
    save.mutate({
      school_name: String(d.get("school_name")).trim(),
      pta_name: String(d.get("pta_name")).trim(),
      email: String(d.get("email")).trim() || null,
      phone: String(d.get("phone")).trim() || null,
      address: String(d.get("address")).trim() || null,
      receipt_footer: String(d.get("receipt_footer")).trim(),
      sms_enabled: d.get("sms_enabled") === "on",
      sms_sender_name: String(d.get("sms_sender_name")).trim(),
      sms_alert_template: String(d.get("sms_alert_template")).trim(),
      online_payment_enabled: d.get("online_payment_enabled") === "on",
      online_payment_note: String(d.get("online_payment_note")).trim(),
    });
  };
  const selectLogo = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024)
      return toast.error("Logo must be 2 MB or smaller");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return toast.error("Choose a PNG, JPG, or WebP image");
    upload.mutate(file);
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>School & receipt details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            key={s.logo_path ?? "settings"}
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(e.currentTarget);
            }}
          >
            <label className="sm:col-span-2">
              <span className="label">School name</span>
              <input
                name="school_name"
                required
                className="field"
                defaultValue={s.school_name}
              />
            </label>
            <label>
              <span className="label">PTA name</span>
              <input
                name="pta_name"
                required
                className="field"
                defaultValue={s.pta_name}
              />
            </label>
            <label>
              <span className="label">Contact email</span>
              <input
                name="email"
                className="field"
                type="email"
                defaultValue={s.email ?? ""}
              />
            </label>
            <label>
              <span className="label">Phone</span>
              <input
                name="phone"
                className="field"
                type="tel"
                defaultValue={s.phone ?? ""}
              />
            </label>
            <label>
              <span className="label">School address</span>
              <input
                name="address"
                className="field"
                defaultValue={s.address ?? ""}
              />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Receipt footer</span>
              <textarea
                name="receipt_footer"
                required
                className="field min-h-20 py-3"
                defaultValue={s.receipt_footer}
              />
            </label>
            <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10">
              <input
                name="sms_enabled"
                type="checkbox"
                defaultChecked={s.sms_enabled}
              />
              <div>
                <p className="text-sm font-semibold">Enable payment SMS alerts</p>
                <p className="text-xs text-slate-500">
                  Send parents an SMS alert whenever a payment is recorded.
                </p>
              </div>
            </label>
            <label>
              <span className="label">SMS sender name</span>
              <input
                name="sms_sender_name"
                required
                className="field"
                defaultValue={s.sms_sender_name}
              />
            </label>
            <label className="sm:col-span-2">
              <span className="label">SMS alert template</span>
              <textarea
                name="sms_alert_template"
                required
                className="field min-h-28 py-3"
                defaultValue={s.sms_alert_template}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Available placeholders: {"{{parent_name}}"},{" "}
                {"{{student_name}}"}, {"{{amount}}"}, {"{{payment_date}}"},{" "}
                {"{{receipt_number}}"}, {"{{balance}}"}, {"{{school_name}}"},{" "}
                {"{{sender_name}}"}.
              </p>
            </label>
            <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10">
              <input
                name="online_payment_enabled"
                type="checkbox"
                defaultChecked={s.online_payment_enabled}
              />
              <div>
                <p className="text-sm font-semibold">Enable online payment link</p>
                <p className="text-xs text-slate-500">
                  Show a pay-online option on the student portal.
                </p>
              </div>
            </label>
            <label className="sm:col-span-2">
              <span className="label">Online payment note</span>
              <textarea
                name="online_payment_note"
                required
                className="field min-h-20 py-3"
                defaultValue={s.online_payment_note}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                The actual payment link is kept securely on the server and is not shown here.
              </p>
            </label>
            <Button
              className="sm:col-span-2 sm:justify-self-end"
              disabled={save.isPending}
            >
              {save.isPending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Save size={16} />
              )}{" "}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Test SMS setup</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const phone = testPhoneRef.current?.value.trim() ?? "";
                if (!phone) {
                  toast.error("Enter a phone number for the test SMS");
                  return;
                }
                testSms.mutate(phone);
              }}
            >
              <label>
                <span className="label">Test phone number</span>
                <input
                  ref={testPhoneRef}
                  type="tel"
                  className="field"
                  placeholder="e.g. 23324XXXXXXX"
                />
              </label>
              <p className="text-xs text-slate-500">
                Save your SMS settings first, then send a sample message to
                confirm the provider is working.
              </p>
              <Button disabled={testSms.isPending} className="justify-self-start">
                {testSms.isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Send size={16} />
                )}{" "}
                Send test SMS
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>School logo</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => selectLogo(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
              className="flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-center hover:border-indigo-400 dark:border-white/10"
            >
              {s.logo_path ? (
                <img
                  src={s.logo_path}
                  alt="School logo"
                  className="max-h-36 max-w-[80%] object-contain"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Camera size={25} />
                </div>
              )}
              <p className="mt-4 flex items-center gap-2 text-sm font-bold">
                {upload.isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Upload size={16} />
                )}{" "}
                {s.logo_path ? "Replace school logo" : "Upload school logo"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                PNG, JPG, or WebP · max 2 MB
              </p>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
