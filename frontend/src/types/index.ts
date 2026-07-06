export type Role = "administrator" | "accountant";
export type PaymentStatus = "UNPAID" | "PARTIALLY PAID" | "PAID";
export type PtaFeeScope = "all_classes" | "class" | "student";
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
}
export interface AcademicYear {
  id: string;
  year: string;
  is_active: boolean;
}
export interface SchoolClass {
  id: string;
  name: string;
  sort_order?: number;
  student_count?: number;
}
export interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  gender: "Male" | "Female" | "Other";
  class_id: string;
  class_name: string;
  parent_name: string;
  parent_phone: string;
  address: string;
  status: "active" | "inactive" | "archived";
  fee: number;
  total_paid: number;
  balance: number;
  payment_status: PaymentStatus;
}
export interface Payment {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  academic_year: string;
  amount_paid: number;
  payment_date: string;
  payment_method?: string;
  receipt_number: string;
  remarks: string;
  received_by_name: string;
  total_paid: number;
  outstanding_balance: number;
}
export interface DashboardStats {
  total_students: number;
  total_expected: number;
  total_collected: number;
  outstanding: number;
  total_debt: number;
  fully_paid: number;
  owing: number;
  today_collected: number;
}
export interface PtaFee {
  id: string;
  academic_year_id: string;
  amount: number;
  applies_to: PtaFeeScope;
  class_id: string | null;
  student_id: string | null;
  class_name?: string | null;
  student_name?: string | null;
  admission_number?: string | null;
}
export interface SchoolSettings {
  id: boolean;
  school_name: string;
  pta_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_path: string | null;
  receipt_footer: string;
  sms_enabled: boolean;
  sms_sender_name: string;
  sms_alert_template: string;
  online_payment_enabled: boolean;
  online_payment_note: string;
}
