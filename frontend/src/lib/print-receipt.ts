import { toast } from "sonner";
import type { Payment } from "../types";
import { generateReceipt } from "./receipt";

export async function printReceipt(payment: Payment) {
  try {
    await generateReceipt(payment);
    toast.success("Receipt PDF downloaded");
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Could not generate receipt",
    );
  }
}
