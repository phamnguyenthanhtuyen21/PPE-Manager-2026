export interface PpeRequest {
  id: number;
  req_date: string;
  project: string;
  ppe_type: string;
  quantity: number;
  status: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối' | 'Đã giao hàng';
  note: string;
  employee_name?: string;
  employee_role?: string;
  attachment_data?: string;
  attachment_name?: string;
  attachment_type?: string;
  cost_code?: string;
  unit_price?: number;
  amount?: number;
}

export interface PpeDeliveryItem {
  id?: number;
  delivery_id?: number;
  ppe_type: string;
  quantity: number;
  unit_price: number;
  amount: number;
  cost_code?: string;
}

export interface PpeDelivery {
  id: number;
  delivery_date: string;
  delivery_note_no: string;
  project: string;
  ppe_type: string;
  quantity: number;
  supplier: string;
  note: string;
  request_id?: number | null;
  employee_name?: string;
  employee_role?: string;
  attachment_data?: string;
  attachment_name?: string;
  attachment_type?: string;
  cost_code?: string;
  unit_price?: number;
  amount?: number;
  // properties joined from request table
  req_date?: string;
  requested_quantity?: number;

  deliverer?: string;
  receiver?: string;
  items?: PpeDeliveryItem[];
  total_amount?: number;
}

export interface SafetyBudget {
  id?: number;
  project: string;
  cost_code: string;
  cost_name: string;
  approved_budget: number;
  unit: string;
  input_date: string;
  input_by: string;
  note: string;
}

export interface SupplierPayment {
  id?: number;
  payment_date: string;
  project: string;
  supplier: string;
  cost_code: string;
  amount: number;
  note: string;
  input_by: string;
}

export interface ProjectStats {
  project: string;
  count: number;
}

export interface PpeTypeStats {
  type: string;
  count: number;
}

export interface MonthlyStats {
  month: string;
  count: number;
}

export interface DashboardStats {
  totalDelivered: number;
  byProject: ProjectStats[];
  byPpeType: PpeTypeStats[];
  byMonth: MonthlyStats[];
  pendingRequests: number;
  approvedRequests: number;
}

export interface SupplierPaymentDossier {
  id: number;
  received_date: string;
  supplier_name: string;
  project_name: string;
  contract_po_no?: string | null;
  payment_content?: string | null;
  payment_amount: number;
  
  has_invoice: number; // 0 or 1
  has_delivery_note: number; // 0 or 1
  has_ppe_request: number; // 0 or 1
  has_quotation_po: number; // 0 or 1
  has_acceptance_cert: number; // 0 or 1
  has_other_docs: number; // 0 or 1
  
  hse_email_date?: string | null;
  project_pic?: string | null;
  status: 'Chưa gửi' | 'Đã gửi dự án' | 'Dự án đã phản hồi' | 'Thiếu hồ sơ' | 'HSE đã kiểm tra' | 'Đã chuyển kế toán' | 'Hoàn tất thanh toán';
  project_response_date?: string | null;
  project_response_content?: string | null;
  accounting_transfer_date?: string | null;
  accounting_recipient?: string | null;
  notes?: string | null;
  
  linked_delivery_id?: number | null;
  linked_delivery_ids?: number[] | null;
  linked_deliveries?: PpeDelivery[];
  payment_ppe_quantity?: number | null;
  cost_code?: string | null;
  
  // Joined properties from deliveries
  delivery_note_no?: string | null;
  delivery_ppe_type?: string | null;
  delivery_quantity?: number | null;
  delivery_supplier?: string | null;

  attachment_data?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
}

