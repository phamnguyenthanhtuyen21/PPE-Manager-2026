import * as XLSX from 'xlsx';
import { PpeDelivery, SupplierPaymentDossier } from '../types';

/**
 * Custom Export to Excel with 4 distinct sheets in requested sequence:
 * Sheet 1: Danh mục PPE
 * Sheet 2: Danh mục dự án
 * Sheet 3: Nhập liệu cấp phát
 * Sheet 4: Dashboard
 */
export function exportToExcel(
  ppeTypes: { name: string; unit: string; description?: string }[],
  projects: string[],
  deliveries: PpeDelivery[],
  stats: {
    totalDelivered: number;
    byProject: { project: string; count: number }[];
    byMonth: { month: string; count: number }[];
  }
) {
  const wb = XLSX.utils.book_new();

  // ----------------------------------------------------
  // SHEET 1: Danh mục PPE
  // ----------------------------------------------------
  const sheet1Data = ppeTypes.map((item, index) => ({
    "STT": index + 1,
    "Tên Thiết Bị / Chủng Loại BHLĐ (PPE)": item.name,
    "Đơn Vị Tính": item.unit || "Cái",
    "Ghi Chú Hướng Dẫn Định Mức": item.description || "Cấp theo kế hoạch sản xuất"
  }));
  const ws1 = XLSX.utils.json_to_sheet(sheet1Data);

  // ----------------------------------------------------
  // SHEET 2: Danh mục dự án
  // ----------------------------------------------------
  const sheet2Data = projects.map((name, index) => ({
    "STT": index + 1,
    "Mã / Tên Dự Án Công Trường": name
  }));
  const ws2 = XLSX.utils.json_to_sheet(sheet2Data);

  // ----------------------------------------------------
  // SHEET 3: Nhập liệu cấp phát
  // ----------------------------------------------------
  const sheet3Data = deliveries.map((item, index) => ({
    "STT": index + 1,
    "Ngày Cấp Phát": item.delivery_date,
    "Số Biên Bản Giao Hàng (BBGH)": item.delivery_note_no,
    "Dự Án": item.project,
    "Họ & Tên Nhân Viên": item.employee_name || "Công cộng / Dự án (Không định danh)",
    "Chức Vụ Nhân Sự": item.employee_role || "Công nhân / Khác",
    "Loại Thiết Bị PPE": item.ppe_type,
    "Số Lượng": item.quantity,
    "Đơn Vị Cung Cấp": item.supplier,
    "Mô Tả / Ghi Chú Chi Tiết": item.note || "",
    "Mã Phiếu YC Liên Kết": item.request_id ? `Phiếu YC #${item.request_id}` : "Nhập trực tiếp"
  }));
  const ws3 = XLSX.utils.json_to_sheet(sheet3Data);

  // ----------------------------------------------------
  // SHEET 4: Dashboard
  // ----------------------------------------------------
  const ws4Rows = [
    ["HỆ THỐNG QUẢN LÝ CẤP PHÁT TRANG BỊ BẢO HỘ LAO ĐỘNG (PPE) - ĐỒNG BỘ DỰ ÁN"],
    ["Ngày xuất dữ liệu:", new Date().toLocaleDateString('vi-VN') + " " + new Date().toLocaleTimeString('vi-VN')],
    [],
    ["📊 1. CHỈ SỐ KPI TỔNG HỢP KHỐI LƯỢNG"],
    ["Chỉ Số KPI", "Khối Lượng Xuất Kho Tích Lũy", "Đơn Vị", "Giải Thích Nghiệp vụ"],
    ["Tổng số lượng PPE đã cấp phát", stats.totalDelivered, "Cái/Bộ/Đôi", "Tốc độ xuất kho theo thời gian thực ghi nhận từ SQLite"],
    [],
    ["🏢 2. TỔNG HỢP SỐ LƯỢNG PPE ĐÃ CẤP THEO TỪNG DỰ ÁN PHÂN KHU"],
    ["Tên Dự Án", "Khối Lượng PPE", "Tỷ Lệ Chiếm %"],
    ...stats.byProject.map(item => {
      const pct = stats.totalDelivered > 0 ? (item.count / stats.totalDelivered) : 0;
      return [item.project, item.count, `${(pct * 100).toFixed(1)}%`];
    }),
    [],
    ["📅 3. TỔNG HỢP CẤP PHÁT PHÂN BỔ THEO THÁNG"],
    ["Tháng Chu Kỳ (MM/YYYY)", "Số Lượng Cấp Phát Tích Lũy"],
    ...stats.byMonth.map(item => [item.month, item.count]),
    [],
    ["💡 4. HƯỚNG DẪN KÍCH HOẠT BIỂU ĐỒ TỰ ĐỘNG THEO DƯ ÁN & THÁNG TRÊN EXCEL"],
    ["- Hệ thống đã tự động liên kết các bảng phân phối trên vào biểu bảng dữ liệu chuẩn."],
    ["- Bước 1: Quét chuột bôi đen toàn bộ Bảng 2 (Dự án & Khối lượng) hoặc Bảng 3 (Tháng & Số lượng)."],
    ["- Bước 2: Chọn thanh menu chính của Microsoft Excel -> Chọn thẻ 'Insert' (Chèn)."],
    ["- Bước 3: Click nút 'Recommended Charts' hoặc chọn biểu đồ Cột (Column) / Tròn (Pie) phù hợp."],
    ["- Bước 4: Click 'OK' - Biểu đồ sẽ tự động xuất hiện và live sync trực quan hóa dữ liệu của bạn!"]
  ];

  const ws4 = XLSX.utils.aoa_to_sheet(ws4Rows);

  // Set column widths for polished presentation
  ws1['!cols'] = [{ wch: 8 }, { wch: 35 }, { wch: 15 }, { wch: 45 }];
  ws2['!cols'] = [{ wch: 8 }, { wch: 45 }];
  ws3['!cols'] = [
    { wch: 8 }, // STT
    { wch: 15 }, // Ngày cấp
    { wch: 25 }, // Biên bản
    { wch: 20 }, // Dự án
    { wch: 28 }, // Họ tên
    { wch: 25 }, // Chức vụ
    { wch: 22 }, // Loại PPE
    { wch: 12 }, // Số lượng
    { wch: 25 }, // Nhà CC
    { wch: 35 }, // Ghi chú
    { wch: 22 }  // Yêu cầu liên kết
  ];
  ws4['!cols'] = [{ wch: 45 }, { wch: 28 }, { wch: 18 }, { wch: 45 }];

  // Append sheets in user-defined sequence
  XLSX.utils.book_append_sheet(wb, ws1, "Danh mục PPE");
  XLSX.utils.book_append_sheet(wb, ws2, "Danh mục dự án");
  XLSX.utils.book_append_sheet(wb, ws3, "Nhập liệu cấp phát");
  XLSX.utils.book_append_sheet(wb, ws4, "Dashboard");

  // Save with appropriate filename
  XLSX.writeFile(wb, "So_Tay_Quan_Ly_Cap_Phat_PPE.xlsx");
}

/**
 * Export Supplier Payment Dossiers to Excel sheet with detailed columns
 */
export function exportDossiersToExcel(dossiers: SupplierPaymentDossier[]) {
  const wb = XLSX.utils.book_new();

  const data = dossiers.map((d, index) => ({
    "STT": index + 1,
    "Ngày nhận hồ sơ": d.received_date,
    "Nhà cung cấp": d.supplier_name,
    "Dự án": d.project_name,
    "Số hợp đồng/PO": d.contract_po_no || "",
    "Nội dung thanh toán": d.payment_content || "",
    "Số tiền thanh toán (VNĐ)": d.payment_amount,
    "Hóa đơn": d.has_invoice ? "Đã có" : "Chưa có",
    "Biên bản giao hàng": d.has_delivery_note ? "Đã có" : "Chưa có",
    "Phiếu yêu cầu PPE": d.has_ppe_request ? "Đã có" : "Chưa có",
    "Báo giá / Đơn đặt hàng": d.has_quotation_po ? "Đã có" : "Chưa có",
    "Biên bản nghiệm thu": d.has_acceptance_cert ? "Đã có" : "Chưa có",
    "Chứng từ khác": d.has_other_docs ? "Đã có" : "Chưa có",
    "HSE gửi email cho Dự án": d.hse_email_date || "Chưa gửi",
    "Người phụ trách Dự án": d.project_pic || "",
    "Tình trạng phản hồi / hồ sơ": d.status,
    "Ngày dự án phản hồi": d.project_response_date || "",
    "Nội dung phản hồi": d.project_response_content || "",
    "HSE chuyển Kế toán": d.accounting_transfer_date || "Chưa chuyển",
    "Người nhận Kế toán": d.accounting_recipient || "",
    "Biên bản giao hàng PPE liên kết": d.delivery_note_no ? `${d.delivery_note_no} (${d.delivery_quantity} ${d.delivery_ppe_type})` : "Không có",
    "Ghi chú": d.notes || ""
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  // Set nice column widths for the dossiers sheet
  ws['!cols'] = [
    { wch: 6 },   // STT
    { wch: 15 },  // Ngày nhận
    { wch: 25 },  // Nhà CC
    { wch: 15 },  // Dự án
    { wch: 15 },  // Số HĐ
    { wch: 30 },  // Nội dung
    { wch: 22 },  // Số tiền
    { wch: 10 },  // HĐ
    { wch: 10 },  // BBGH
    { wch: 10 },  // PYC
    { wch: 10 },  // BG
    { wch: 10 },  // BBNT
    { wch: 10 },  // CTK
    { wch: 15 },  // Khởi phát email
    { wch: 18 },  // PIC dự án
    { wch: 22 },  // Tình trạng
    { wch: 15 },  // Ngày dự án phản hồi
    { wch: 25 },  // Nội dung phản hồi
    { wch: 15 },  // Ngày chuyển kế toán
    { wch: 18 },  // Người nhận bên kế toán
    { wch: 30 },  // BBGH PPE liên kết
    { wch: 25 }   // Ghi chú
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Theo dõi Hồ sơ Thanh toán");
  XLSX.writeFile(wb, "Theo_Doi_Ho_So_Thanh_Toan_NCC.xlsx");
}
