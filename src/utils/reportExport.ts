import * as XLSX from 'xlsx';

// Helper to remove Vietnamese tones for safe file names
function removeVietnameseTones(str: string): string {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|BẢO|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  // Some system encodings
  str = str.replace(/\u0300|\u0301|\u0309|\u0303|\u0309/g, ""); // Huyen, sac, hoi, nga, nang
  str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // mu, tre, moc
  return str;
}

// Generate the standard filename: Bao_cao_[LoaiBaoCao]_[DuAn]_[NgayXuat].[ext]
export function buildExportFilename(
  reportTypeCode: "PPE" | "NganSach" | "ThanhToan",
  projectFilter: string,
  extension: "xlsx" | "pdf" | "csv"
): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const exportDate = `${day}-${month}-${year}`;
  
  let cleanProj = "TATCA";
  if (projectFilter && projectFilter !== "Tất cả") {
    // Remove space and accents
    cleanProj = removeVietnameseTones(projectFilter)
      .replace(/\s+/g, "")
      .replace(/DuAn/gi, "DA")
      .replace(/[^a-zA-Z0-9]/g, "");
  }
  
  return `Bao_cao_${reportTypeCode}_${cleanProj}_${exportDate}.${extension}`;
}

/**
 * 1. EXCEL REPORT GENERATOR (.xlsx) WITH 3 DISTINCT SHEETS
 * - Sheet 1: Bảng tổng hợp (KPIs, aggregated lists)
 * - Sheet 2: Danh sách chi tiết (Filtered full dataset)
 * - Sheet 3: Biểu đồ & Thống kê thiết kế phẳng
 */
export function exportExcelReport(
  reportTypeCode: "PPE" | "NganSach" | "ThanhToan",
  filters: any,
  rawSummaryData: any[],
  rawDetailData: any[],
  projectFilter: string,
  currentUser: string
) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleDateString('vi-VN') + " " + new Date().toLocaleTimeString('vi-VN');

  // Define sheets data based on report type
  let sheet1Rows: any[] = [];
  let sheet2Rows: any[] = [];
  let sheet3Rows: any[] = [];
  
  let sheet1Name = "Bảng Tổng Hợp";
  let sheet2Name = "Danh Sách Chi Tiết";
  let sheet3Name = "Thống Kê Trực Quan";

  if (reportTypeCode === "PPE") {
    // A. BÁO CÁO CẤP PHÁT PPE
    sheet1Rows = [
      ["TỔNG CÔNG TY THI CÔNG & XÂY DỰNG AN TOÀN - BAN AN TOÀN ATLĐ"],
      ["BÁO CÁO TỔNG HỢP CẤP PHÁT TRANG BỊ BẢO HỘ LAO ĐỘNG (PPE)"],
      ["Thời gian xuất báo cáo:", dateStr, "Người thực hiện:", currentUser],
      ["Bộ lọc áp dụng:", JSON.stringify(filters).replace(/[{}"]/g, " ").replace(/:/g, ": ")],
      [],
      ["📊 CHỈ SỐ DOANH NGHIỆP TRỌNG YẾU (KPIs)"],
      ["Chỉ số đo lường", "Khối lượng tích lũy", "Đơn vị tính", "Ý nghĩa nghiệp vụ"],
      ["Tổng số lượng PPE bàn giao thực tế", rawDetailData.reduce((sum, d) => sum + (d.quantity || 0), 0), "Cái/Đôi/Bộ", "Lượng bảo hộ đã xuất kho trực tiếp cho nhân sự"],
      ["Tổng kinh phí cấp phát PPE bảo hộ", rawDetailData.reduce((sum, d) => sum + ((d.amount || d.unit_price * d.quantity) || 0), 0), "VNĐ", "Kinh phí quyết toán thực tế đã ghi nhận"],
      ["Số lượng biên bản giao nhận phát sinh", new Set(rawDetailData.map(d => d.delivery_note_no)).size, "Chứng từ BBGH", "Biên bản lưu trữ pháp lý chữ ký người đại diện"],
      [],
      ["🏗️ TỔNG HỢP KHỐI LƯỢNG CẤP PHÁT THEO CÁC DỰ ÁN CÔNG TRƯỜNG"],
      ["Tên Dự Án", "Tổng Số Lượng Cấp Phát (Cái)", "Tổng Giá Trị Giải Ngân (VNĐ)"]
    ];

    // Aggregate by project
    const projMap: Record<string, { qty: number; amt: number }> = {};
    rawDetailData.forEach(d => {
      const p = d.project || "Không rõ";
      const amt = (d.amount || (d.unit_price * d.quantity) || 0);
      if (!projMap[p]) projMap[p] = { qty: 0, amt: 0 };
      projMap[p].qty += (d.quantity || 0);
      projMap[p].amt += amt;
    });
    Object.keys(projMap).forEach(p => {
      sheet1Rows.push([p, projMap[p].qty, projMap[p].amt]);
    });

    // Detail data headers & rows for Sheet 2
    sheet2Rows = [
      ["BÁN GIAO PPE CHI TIẾT THEO YÊU CẦU BỘ LỌC CÔNG TRÌNH"],
      ["Thời điểm lập thống kê:", dateStr],
      [],
      ["STT", "Ngày Cấp Phát", "Số Biên Bản BBGH", "Dự Án Công Trường", "Nhân Viên Nhận", "Chức Vụ", "Loại PPE", "Số Lượng Cấp", "Đơn Giá (đ)", "Thành Tiền (đ)", "Nhà Cung Cấp", "Ghi Chú Kiểm Soát"]
    ];
    rawDetailData.forEach((item, index) => {
      sheet2Rows.push([
        index + 1,
        item.delivery_date,
        item.delivery_note_no || "Nhập trực tiếp",
        item.project,
        item.employee_name || "Nhận chung/Đội nhóm",
        item.employee_role || "Công nhân / Khác",
        item.ppe_type,
        item.quantity,
        item.unit_price || 0,
        item.amount || (item.unit_price * item.quantity) || 0,
        item.supplier || "Chưa thiết lập",
        item.note || ""
      ]);
    });

    // Sheet 3: Visual ASCII bar charts and statistical analytics
    sheet3Rows = [
      ["PHÂN TÍCH TRỰC QUAN GÓC BIỂU ĐỒ - PHÂN PHỐI BẢO HỘ LAO ĐỘNG"],
      ["Hệ thống hỗ trợ vẽ biểu đồ tự động dựa trên bảng số liệu có sẵn."],
      [],
      ["📊 BIỂU ĐỒ THỐNG KÊ CHI TẮT THEO CHỦNG LOẠI PPE"],
      ["Loại Trang Thiết Bị Bảo Hộ", "Số Lượng Bàn Giao", "Bản Vẽ Biểu Đồ Thanh Ngang Tương Đối"]
    ];
    const ppeMap: Record<string, number> = {};
    rawDetailData.forEach(d => {
      ppeMap[d.ppe_type] = (ppeMap[d.ppe_type] || 0) + (d.quantity || 0);
    });
    const maxQty = Math.max(...Object.values(ppeMap), 1);
    Object.keys(ppeMap).forEach(ppe => {
      const q = ppeMap[ppe];
      const pct = (q / maxQty) * 100;
      const barCount = Math.round(pct / 10);
      const barStr = "█".repeat(barCount) + "░".repeat(10 - barCount) + ` ${pct.toFixed(1)}%`;
      sheet3Rows.push([ppe, q, barStr]);
    });

  } else if (reportTypeCode === "NganSach") {
    // B. BÁO CÁO NGÂN SÁCH ATLĐ
    // rawDetailData will contain budgetSummary records
    const overBudgetList = rawDetailData.filter(b => b.total_spent > b.approved_budget);
    
    sheet1Rows = [
      ["TỔNG CÔNG TY THI CÔNG & XÂY DỰNG AN TOÀN - BAN TÀI CHÍNH KẾ HOẠCH"],
      ["BÁO CÁO TỔNG HỢP PHÂN CHI NGÂN SÁCH ATLĐ (MÃ CHI PHÍ 9.07)"],
      ["Thời gian xuất báo cáo:", dateStr, "Người thực hiện:", currentUser],
      ["Bộ lọc áp dụng:", JSON.stringify(filters).replace(/[{}"]/g, " ").replace(/:/g, ": ")],
      [],
      ["📊 CHỈ SỐ TÀI CHÍNH TRỌNG YẾU (ATLĐ KPIs)"],
      ["Chỉ số đo lường", "Giá trị tính lũy kế (VNĐ)", "Đơn vị tính", "Tỷ lệ/Nghiệp vụ áp dụng"],
      ["Tổng hạn mức ngân sách được duyệt", rawDetailData.reduce((sum, b) => sum + (b.approved_budget || 0), 0), "VNĐ", "Hạn mức định mức ban lãnh đạo tổng phê duyệt"],
      ["Tổng chi phí thực tế lũy kế sử dụng", rawDetailData.reduce((sum, b) => sum + (b.total_spent || 0), 0), "VNĐ", "Tổng chi phí kết toán thực tế phát sinh"],
      ["Số dư quỹ dự phòng an toàn còn lại", rawDetailData.reduce((sum, b) => sum + ((b.approved_budget - b.total_spent) || 0), 0), "VNĐ", "Quỹ dự phòng an toàn thực tế có thể chi trả tiếp"],
      ["Số lượng hạng mục cảnh báo vượt chi", overBudgetList.length, "Hạng mục", "Các mã chi phí con vượt định biên được cấp"],
      [],
      ["⚠️ DANH SÁCH CÁC HẠNG MỤC CẦN KIỂM SOÁT VƯỢT NGÂN SÁCH"],
      ["Tên Dự Án", "Mã Chi Phí", "Hạng Mục Mục Chi", "Ngân Sách Được Duyệt (đ)", "Lũy Kế Thực Tế (đ)", "Số Tiền Vượt (đ)", "Tỷ Lệ Sử Dụng (%)"]
    ];

    overBudgetList.forEach(item => {
      const diff = item.total_spent - item.approved_budget;
      const pct = item.approved_budget > 0 ? (item.total_spent / item.approved_budget) * 100 : 100;
      sheet1Rows.push([
        item.project,
        item.cost_code,
        item.cost_name,
        item.approved_budget,
        item.total_spent,
        diff,
        `${pct.toFixed(1)}%`
      ]);
    });
    if (overBudgetList.length === 0) {
      sheet1Rows.push(["Không có hạng mục nào vượt định mức an định ngân sách cấp phát!"]);
    }

    // Detail data headers & rows for Sheet 2
    sheet2Rows = [
      ["BẢNG THEO DÕI NGÂN SÁCH ĐỐI CHIẾU TIỂU TIẾT DỰ ÁN"],
      ["Thời điểm lập thống kê:", dateStr],
      [],
      ["STT", "Dự Án Công Trường", "Mã Chi Phí", "Tên Hạng Mục Chi Phí", "Ngân Sách Được Phê Duyệt (đ)", "Giá Trị Đã Sử Dụng (đ)", "Giá Trị Còn Lại Có Thể Chi (đ)", "Tỷ Lệ Sử Dụng (%)", "Tình Trạng Cảnh Báo"]
    ];
    rawDetailData.forEach((item, index) => {
      const rem = item.approved_budget - item.total_spent;
      const pct = item.approved_budget > 0 ? (item.total_spent / item.approved_budget) * 100 : 0;
      let status = "An toàn";
      if (pct >= 100) status = "Vượt ngân sách (🔴 Đỏ)";
      else if (pct >= 80) status = "Cận viền cảnh báo (🟡 Vàng)";
      
      sheet2Rows.push([
        index + 1,
        item.project,
        item.cost_code,
        item.cost_name,
        item.approved_budget,
        item.total_spent,
        rem,
        Math.round(pct) + "%",
        status
      ]);
    });

    // Sheet 3: Budget usage rate chart
    sheet3Rows = [
      ["BIỂU ĐỒ BẢN ĐỒ TỶ LỆ SỬ DỤNG KINH PHÍ THEO DỰ ÁN"],
      ["Danh sách tỷ lệ trực quan giúp nhà quản lý tối ưu hóa dòng tiền an toàn bảo hộ."],
      [],
      ["📊 BIỂU ĐỒ TẢO SÓNG CHỈ TIÊU NGÂN SÁCH %"],
      ["Tên Dự Án Công Trường", "Tỷ Lệ Sử Dụng (%)", "Biên Độ Đồ Thị Trực Quan"]
    ];
    // Group budget by project
    const projBudMap: Record<string, { limit: number; spent: number }> = {};
    rawDetailData.forEach(row => {
      const p = row.project;
      if (!projBudMap[p]) projBudMap[p] = { limit: 0, spent: 0 };
      projBudMap[p].limit += (row.approved_budget || 0);
      projBudMap[p].spent += (row.total_spent || 0);
    });

    Object.keys(projBudMap).forEach(p => {
      const budget = projBudMap[p].limit;
      const spent = projBudMap[p].spent;
      const pct = budget > 0 ? (spent / budget) * 100 : 0;
      const barLen = Math.min(Math.round(pct / 10), 10);
      const barStr = "█".repeat(barLen) + "░".repeat(Math.max(0, 10 - barLen)) + ` ${pct.toFixed(1)}%`;
      sheet3Rows.push([p, Math.round(pct), barStr]);
    });

  } else {
    // C. BÁO CÁO HỒ SƠ THANH TOÁN
    sheet1Rows = [
      ["TỔNG CÔNG TY THI CÔNG & XÂY DỰNG AN TOÀN - BAN TRÌNH DUYỆT THANH TOÁN"],
      ["BÁO CÁO TỔNG HỢP HỒ SƠ CHỨNG TỪ THANH TOÁN ĐỐI TÁC (SUPPLIERS)"],
      ["Thời gian xuất báo cáo:", dateStr, "Người thực hiện:", currentUser],
      ["Bộ lọc áp dụng:", JSON.stringify(filters).replace(/[{}"]/g, " ").replace(/:/g, ": ")],
      [],
      ["📊 CHỈ SỐ THEO DÕI HỒ SƠ THANH TOÁN (HSE DOSSIERS KPIs)"],
      ["Tham số giám sát", "Số lượng chứng từ / Giá trị", "Đơn vị tính", "Định nghĩa nghiệp vụ"],
      ["Tổng ngân ngạch trình duyệt hồ sơ thanh toán", rawDetailData.reduce((sum, d) => sum + (d.payment_amount || 0), 0), "VNĐ", "Quy mô dòng tiền giao dịch kết toán"],
      ["Tổng số dossiers đang kiểm soát", rawDetailData.length, "Hồ sơ gốc", "Dung lượng hồ sơ đang quản lý trên luồng"],
      ["Hồ sơ đã kiểm duyệt chuyển thanh toán Kế Toán", rawDetailData.filter(d => d.status === "Đã chuyển kế toán").length, "Hồ sơ duyệt", "Giá trị thanh khoản hoàn thành bàn giao"],
      ["Hồ sơ cảnh báo thiếu chứng từ liên quan", rawDetailData.filter(d => d.status === "Thiếu hồ sơ").length, "Hồ sơ cảnh báo", "Hồ sơ bị từ chối chuyển tiếp do thiếu hóa đơn/BBGH"],
      ["Hồ sơ chờ phản hồi từ Ban chỉ huy Dự án", rawDetailData.filter(d => d.status === "Chờ duyệt").length, "Hồ sơ chờ đợi", "Dossier đã gửi email nhưng dự án chưa rà soát"],
    ];

    // Detail sheet 2
    sheet2Rows = [
      ["LUỒNG QUẢN LÝ VÀ CHỨNG TỪ CHI TIẾT CỦA CÁC NHÀ CUNG CẤP VÀ DỰ ÁN"],
      ["Thời điểm lập thống kê:", dateStr],
      [],
      ["STT", "Ngày Nhận", "Nhà Cung Cấp", "Dự Án Lắp Đặt", "Hợp Đồng/PO No", "Nội Dung Thanh Toán", "Giá Trị Hóa Đơn (đ)", "Hóa Đơn", "BBGH", "Yêu Cầu PPE", "Báo Giá", "Nghiệm Thu", "Trạng Thái Hồ Sơ", "Thời Điểm Chuyển Kế Toán", "Ghi Chú Nghiệp Vụ"]
    ];
    rawDetailData.forEach((item, index) => {
      sheet2Rows.push([
        index + 1,
        item.received_date,
        item.supplier_name,
        item.project_name,
        item.contract_po_no || "N/A",
        item.payment_content || "",
        item.payment_amount || 0,
        item.has_invoice ? "Đã có" : "Chưa",
        item.has_delivery_note ? "Đã có" : "Chưa",
        item.has_ppe_request ? "Đã có" : "Chưa",
        item.has_quotation_po ? "Đã có" : "Chưa",
        item.has_acceptance_cert ? "Đã có" : "Chưa",
        item.status,
        item.accounting_transfer_date || "Chưa chuyển",
        item.notes || ""
      ]);
    });

    // Sheet 3: Visual stats by supplier
    sheet3Rows = [
      ["THỐNG KÊ DOANH SỐ TRÌNH DUYỆT THANH TOÁN THEO VENDOR"],
      ["Cung cấp cái nhìn đa chiều về năng lực thực hiện khối lượng của đối tác Cung ứng."],
      [],
      ["📊 BIỂU ĐỒ DOANH SỐ CHI TRẢ CHO NHÀ CUNG CẤP (VNĐ)"],
      ["Tên Đối Tác Nhà Cung Cấp", "Tổng Giá Trị Công Nợ Giao Dịch (VNĐ)", "Mật Độ Khối Lượng Chứng Từ"]
    ];
    const vendorMap: Record<string, number> = {};
    rawDetailData.forEach(d => {
      vendorMap[d.supplier_name] = (vendorMap[d.supplier_name] || 0) + (d.payment_amount || 0);
    });
    const maxAmt = Math.max(...Object.values(vendorMap), 1);
    Object.keys(vendorMap).forEach(v => {
      const amt = vendorMap[v];
      const pct = (amt / maxAmt) * 100;
      const barLen = Math.round(pct / 10);
      const barStr = "█".repeat(barLen) + "░".repeat(10 - barLen) + ` ${pct.toFixed(0)}%`;
      sheet3Rows.push([v, amt, barStr]);
    });
  }

  // Create worksheets
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);

  // Styling column widths
  ws1['!cols'] = [{ wch: 32 }, { wch: 25 }, { wch: 15 }, { wch: 45 }];
  ws3['!cols'] = [{ wch: 35 }, { wch: 28 }, { wch: 35 }];

  if (reportTypeCode === "PPE") {
    ws2['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 24 },
      { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
      { wch: 26 }, { wch: 30 }
    ];
  } else if (reportTypeCode === "NganSach") {
    ws2['!cols'] = [
      { wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 32 }, { wch: 24 },
      { wch: 24 }, { wch: 24 }, { wch: 18 }, { wch: 28 }
    ];
  } else {
    ws2['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 26 }, { wch: 16 }, { wch: 18 },
      { wch: 28 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 18 }, { wch: 30 }
    ];
  }

  // Save workbook
  XLSX.utils.book_append_sheet(wb, ws1, sheet1Name);
  XLSX.utils.book_append_sheet(wb, ws2, sheet2Name);
  XLSX.utils.book_append_sheet(wb, ws3, sheet3Name);

  const filename = buildExportFilename(reportTypeCode, projectFilter, "xlsx");
  XLSX.writeFile(wb, filename);
}

/**
 * 2. CSV REPORT EXPORTER WITH UTF-8 BOM
 */
export function exportCsvReport(
  reportTypeCode: "PPE" | "NganSach" | "ThanhToan",
  rawDetailData: any[],
  projectFilter: string
) {
  let headers: string[] = [];
  let rows: string[][] = [];

  if (reportTypeCode === "PPE") {
    headers = ["STT", "Ngay Cap Phat", "Bien Ban Giao Hang No", "Du An", "Nhan Vien Nhan", "Chuc Vu", "Loai PPE", "So Luong", "Don Gia", "Thanh Tien", "Nha Cung Cap", "Ghi Chu"];
    rawDetailData.forEach((item, index) => {
      rows.push([
        String(index + 1),
        item.delivery_date || "",
        item.delivery_note_no || "Nhap truc tiep",
        item.project || "",
        item.employee_name || "Nhan chung",
        item.employee_role || "Cong nhan / Khac",
        item.ppe_type || "",
        String(item.quantity || 0),
        String(item.unit_price || 0),
        String(item.amount || (item.unit_price * item.quantity) || 0),
        item.supplier || "Chua thiet lap",
        (item.note || "").replace(/,/g, " - ")
      ]);
    });
  } else if (reportTypeCode === "NganSach") {
    headers = ["STT", "Du An", "Ma Chi Phi", "Ten Cost Code", "Ngan Sach Duyet (VND)", "Da Su Dung (VND)", "Con Lai (VND)", "Ty Le Su Dung (%)"];
    rawDetailData.forEach((item, index) => {
      const rem = item.approved_budget - item.total_spent;
      const pct = item.approved_budget > 0 ? (item.total_spent / item.approved_budget) * 100 : 0;
      rows.push([
        String(index + 1),
        item.project || "",
        item.cost_code || "",
        item.cost_name || "",
        String(item.approved_budget || 0),
        String(item.total_spent || 0),
        String(rem),
        pct.toFixed(1) + "%"
      ]);
    });
  } else {
    headers = ["STT", "Ngay Nhan Ho So", "Nha Cung Cap", "Du An", "Hop Dong PO No", "Noi Dung Thanh Toan", "Gia Tri Hoa Don (VND)", "Trang Thai Ho So", "Ngay Chuyen Ke Toan", "Ghi Chu"];
    rawDetailData.forEach((item, index) => {
      rows.push([
        String(index + 1),
        item.received_date || "",
        item.supplier_name || "",
        item.project_name || "",
        item.contract_po_no || "N/A",
        (item.payment_content || "").replace(/,/g, "-"),
        String(item.payment_amount || 0),
        item.status || "",
        item.accounting_transfer_date || "Chua chuyen",
        (item.notes || "").replace(/,/g, "-")
      ]);
    });
  }

  // Prepend columns headers
  const csvContent = [headers.join(",")];
  rows.forEach(r => {
    // Encapsulate strings to avoid offset issues
    const safeRow = r.map(cell => `"${cell.replace(/"/g, '""')}"`);
    csvContent.push(safeRow.join(","));
  });

  const fullContentStr = "\uFEFF" + csvContent.join("\n"); // Include UTF-8 BOM so Excel opens with correct Vietnamese letters
  const blob = new Blob([fullContentStr], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", buildExportFilename(reportTypeCode, projectFilter, "csv"));
  document.body.appendChild(link); // Required for FF
  link.click();
  document.body.removeChild(link);
}

/**
 * 3. CRISP A4 PDF REPORT PRINT EMULATOR (HIDDEN IFRAME PRINT)
 */
export function exportPdfReport(
  reportTypeCode: "PPE" | "NganSach" | "ThanhToan",
  filters: any,
  rawDetailData: any[],
  projectFilter: string,
  currentUser: string
) {
  const dateStr = new Date().toLocaleDateString('vi-VN') + " " + new Date().toLocaleTimeString('vi-VN');
  const filename = buildExportFilename(reportTypeCode, projectFilter, "pdf");

  let reportTitle = "";
  let tableHeadersHtml = "";
  let tableRowsHtml = "";
  let totalsRowHtml = "";

  if (reportTypeCode === "PPE") {
    reportTitle = "BÁO CÁO CẤP PHÁT TRANG BỊ BẢO HỘ LAO ĐỘNG (PPE)";
    tableHeadersHtml = `
      <tr>
        <th style="width: 5%">STT</th>
        <th style="width: 11%">Ngày</th>
        <th style="width: 15%">Số BBGH</th>
        <th style="width: 13%">Dự án</th>
        <th style="width: 15%">Cán sự cấp phát</th>
        <th style="width: 13%">Mặt hàng</th>
        <th style="width: 8%; text-align: right">S.Lượng</th>
        <th style="width: 10%; text-align: right">Đơn giá</th>
        <th style="width: 12%; text-align: right">Thành tiền</th>
      </tr>
    `;

    let totalQty = 0;
    let totalAmt = 0;

    rawDetailData.forEach((d, idx) => {
      const amt = (d.amount || (d.unit_price * d.quantity) || 0);
      totalQty += (d.quantity || 0);
      totalAmt += amt;

      tableRowsHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td>${d.delivery_date}</td>
          <td class="font-mono">${d.delivery_note_no || "Trực tiếp"}</td>
          <td>${d.project}</td>
          <td><strong>${d.employee_name || "Cấp chung"}</strong><br/><span style="font-size: 9px; color: #666">(${d.employee_role || "Khác"})</span></td>
          <td>${d.ppe_type}</td>
          <td style="text-align: right font-mono">${d.quantity}</td>
          <td style="text-align: right font-mono">${(d.unit_price || 0).toLocaleString()}</td>
          <td style="text-align: right font-mono" class="font-bold">${amt.toLocaleString()}đ</td>
        </tr>
      `;
    });

    totalsRowHtml = `
      <tr class="totals-row">
        <td colspan="6" style="text-align: right">TỔNG CỘNG LŨY KẾ CẤP PHÁT:</td>
        <td style="text-align: right" class="font-mono">${totalQty}</td>
        <td></td>
        <td style="text-align: right" class="price-col font-mono">${totalAmt.toLocaleString()}đ</td>
      </tr>
    `;

  } else if (reportTypeCode === "NganSach") {
    reportTitle = "BÁO CÁO TỔNG HỢP NGÂN SÁCH AN TOÀN LAO ĐỘNG (ATLĐ)";
    tableHeadersHtml = `
      <tr>
        <th style="width: 5%">STT</th>
        <th style="width: 18%">Dự án</th>
        <th style="width: 12%">Mã chi phí</th>
        <th style="width: 20%">Tên danh mục tiểu ngạch</th>
        <th style="width: 14%; text-align: right">Ngân sách duyệt</th>
        <th style="width: 14%; text-align: right">Đã sử dụng</th>
        <th style="width: 14%; text-align: right">Quỹ còn lại</th>
        <th style="width: 8%; text-align: center">Tỷ lệ %</th>
      </tr>
    `;

    let totalBudget = 0;
    let totalSpent = 0;

    rawDetailData.forEach((b, idx) => {
      const rem = b.approved_budget - b.total_spent;
      const pct = b.approved_budget > 0 ? (b.total_spent / b.approved_budget) * 100 : 0;
      totalBudget += (b.approved_budget || 0);
      totalSpent += (b.total_spent || 0);

      const dangerClass = pct >= 100 ? "text-danger" : pct >= 80 ? "text-warning" : "text-success";
      const badgeStyle = pct >= 100 ? "font-weight: 900; background-color: #fee2e2; padding: 2px 4px border-radius: 3px;" : "";

      tableRowsHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${b.project}</strong></td>
          <td class="font-mono font-bold">${b.cost_code}</td>
          <td>${b.cost_name}</td>
          <td style="text-align: right font-mono">${(b.approved_budget || 0).toLocaleString()}đ</td>
          <td style="text-align: right font-mono" class="font-bold text-danger">${(b.total_spent || 0).toLocaleString()}đ</td>
          <td style="text-align: right font-mono ${rem < 0 ? "color: red font-weight: bold" : "color: green font-weight: bold"}">
            ${rem < 0 ? "Vượt " + Math.abs(rem).toLocaleString() : rem.toLocaleString()}đ
          </td>
          <td style="text-align: center ${badgeStyle}" class="${dangerClass}">${pct.toFixed(0)}%</td>
        </tr>
      `;
    });

    const totalPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    totalsRowHtml = `
      <tr class="totals-row">
        <td colspan="4" style="text-align: right">TỔNG TOÀN KHỐI NGÂN SÁCH:</td>
        <td style="text-align: right" class="font-mono">${totalBudget.toLocaleString()}đ</td>
        <td style="text-align: right" class="price-col font-mono">${totalSpent.toLocaleString()}đ</td>
        <td style="text-align: right" class="font-mono" style="color: ${totalBudget - totalSpent < 0 ? 'red' : 'green'}">${(totalBudget - totalSpent).toLocaleString()}đ</td>
        <td style="text-align: center" class="font-mono font-bold">${totalPct.toFixed(1)}%</td>
      </tr>
    `;

  } else {
    reportTitle = "BÁO CÁO TIẾN ĐỘ HỒ SƠ CHỨNG TỪ THANH TOÁN"
    tableHeadersHtml = `
      <tr>
        <th style="width: 5%">STT</th>
        <th style="width: 11%">Ngày nhận</th>
        <th style="width: 18%">Nhà cung cấp</th>
        <th style="width: 12%">Dự án</th>
        <th style="width: 25%">Mục đích chi trả / Số PO</th>
        <th style="width: 14%; text-align: right">Số tiền</th>
        <th style="width: 15%">Tình trạng h.sơ</th>
      </tr>
    `;

    let totalAmount = 0;

    rawDetailData.forEach((d, idx) => {
      totalAmount += (d.payment_amount || 0);
      let statusColor = "color: #ff9800 font-weight: bold bg-amber-50 p-1 px-1.5 rounded";
      if (d.status === "Đã chuyển kế toán") {
        statusColor = "color: #4caf50 font-weight: bold bg-green-50 p-1 px-1.5 rounded";
      } else if (d.status === "Thiếu hồ sơ") {
        statusColor = "color: #f44336 font-weight: bold bg-rose-50 p-1 px-1.5 rounded animate-pulse";
      }

      tableRowsHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td>${d.received_date}</td>
          <td><strong>${d.supplier_name}</strong></td>
          <td>${d.project_name}</td>
          <td>
            <strong>${d.payment_content || "Thanh toán dốc"}</strong>
            ${d.contract_po_no ? `<br/><span style="font-size: 10px; color: #555 font-family: monospace">PO#: ${d.contract_po_no}</span>` : ""}
            <div style="font-size: 8.5px; opacity: 0.8 mt-1">Invoice: ${d.has_invoice ? "✅ Đã nhận" : "❌ Thiếu"} | BBGH: ${d.has_delivery_note ? "✅" : "❌"} | YC: ${d.has_ppe_request ? "✅" : "❌"}</div>
          </td>
          <td style="text-align: right font-mono font-bold" class="text-primary">${(d.payment_amount || 0).toLocaleString()}đ</td>
          <td><span style="${statusColor}">${d.status}</span></td>
        </tr>
      `;
    });

    totalsRowHtml = `
      <tr class="totals-row">
        <td colspan="5" style="text-align: right">TỔNG CỘNG THANH TOÁN VENDOR:</td>
        <td style="text-align: right" class="price-col font-mono">${totalAmount.toLocaleString()}đ</td>
        <td></td>
      </tr>
    `;
  }

  // Create an iframe to print cleanly without affecting current screen layout
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!iframeDoc) {
    alert("Không thể khởi động trình in ấn PDF trình duyệt");
    return;
  }

  // Write content styles and format layout
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${reportTitle}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        body {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          margin: 0;
          padding: 20px;
          color: #1e293b;
          font-size: 11px;
          line-height: 1.5;
          background-color: #fff;
        }

        .header-container {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }

        .top-meta {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .logo-placeholder {
          font-weight: 900;
          font-size: 13px;
          color: #0c4a6e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .co-sub {
          font-size: 9px;
          color: #64748b;
          text-transform: uppercase;
          margin-top: 2px;
        }

        .doc-title-box {
          text-align: center;
          margin: 15px 0;
        }

        .doc-title {
          font-size: 16px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.2px;
          margin: 0;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .meta-item {
          display: flex;
          gap: 5px;
        }

        .meta-lbl {
          font-weight: 700;
          color: #475569;
          min-width: 140px;
        }

        .meta-val {
          color: #0f172a;
          font-weight: 500;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }

        th {
          background-color: #0f172a;
          color: #ffffff;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 9px;
          letter-spacing: 0.3px;
          padding: 8px 6px;
          border: 1px solid #1e293b;
        }

        td {
          padding: 7px 6px;
          border-bottom: 1px solid #e2e8f0;
          border-left: 1px solid #f1f5f9;
          border-right: 1px solid #f1f5f9;
          vertical-align: top;
        }

        tr:nth-child(even) {
          background-color: #f8fafc;
        }

        .totals-row {
          background-color: #f1f5f9 !important;
          border-top: 2px solid #0f172a;
          border-bottom: 2px solid #0f172a;
          font-weight: 800;
        }

        .totals-row td {
          font-size: 11px;
          color: #0f172a !important;
          padding: 9px 6px;
        }

        .price-col {
          color: #b91c1c;
          font-weight: 800;
        }

        .signature-section {
          margin-top: 40px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          text-align: center;
          page-break-inside: avoid;
        }

        .sig-box {
          height: 100px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .sig-title {
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          font-size: 9px;
          letter-spacing: 0.3px;
        }

        .sig-name {
          font-weight: 800;
          color: #0f172a;
          text-decoration: underline;
        }

        .font-mono {
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }

        .font-bold {
          font-weight: 700;
        }

        .text-danger {
          color: #ef4444;
        }

        .text-warning {
          color: #f59e0b;
        }

        .text-success {
          color: #10b981;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm;
          }
          body {
            padding: 0;
            background-color: #fff;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        <div class="top-meta">
          <div>
            <div class="logo-placeholder">🏗️ TẤN PHÁT LAND - SAFETY DIVISION</div>
            <div class="co-sub">BAN BIÊN CHẾ AN TOÀN & ĐIỀU PHỐI HOẠT ĐỘNG PHÒNG VỆ</div>
          </div>
          <div style="text-align: right font-size: 9px font-weight: 500">
            Mã chứng từ: <span class="font-mono" style="font-weight: bold">${removeVietnameseTones(reportTypeCode).toUpperCase()}-${Date.now().toString().slice(-6)}</span>
          </div>
        </div>
        
        <div class="doc-title-box">
          <h1 class="doc-title">${reportTitle}</h1>
          <p style="margin: 4px 0 0 0 color: #475569; font-weight: 500; font-size: 11px">Chu kỳ quyết toán: Năm 2026</p>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-item"><span class="meta-lbl">Cơ quan thực hiện:</span> <span class="meta-val">Hội đồng HSE - P.An Toàn</span></div>
        <div class="meta-item"><span class="meta-lbl">Ngày lập biên bản:</span> <span class="meta-val font-mono">${dateStr}</span></div>
        <div class="meta-item"><span class="meta-lbl">Cán bộ kiểm duyệt:</span> <span class="meta-val">${currentUser}</span></div>
        <div class="meta-item"><span class="meta-lbl">Dự án báo cáo:</span> <span class="meta-val font-bold">${projectFilter}</span></div>
        <div class="meta-item" style="grid-column: span 2"><span class="meta-lbl">Ghi chú điều kiện lọc:</span> <span class="meta-val" style="font-size: 10px">${JSON.stringify(filters).replace(/[{}"]/g, " ").replace(/:/g, ": ")}</span></div>
      </div>

      <table>
        <thead>
          ${tableHeadersHtml}
        </thead>
        <tbody>
          ${tableRowsHtml}
          ${totalsRowHtml}
        </tbody>
      </table>

      <div class="signature-section">
        <div class="sig-box">
          <span class="sig-title">Người Lập Phiếu</span>
          <span style="font-size: 10px color: #94a3b8">(Ký, ghi rõ họ tên)</span>
          <span class="sig-name">${currentUser}</span>
        </div>
        <div class="sig-box">
          <span class="sig-title">Trưởng Phòng An Toàn</span>
          <span style="font-size: 10px color: #94a3b8">(Ký, ghi rõ họ tên)</span>
          <span class="sig-name">Lý Chí Thanh</span>
        </div>
        <div class="sig-box">
          <span class="sig-title">Giám Đốc Dự Án / Kế Toán</span>
          <span style="font-size: 10px color: #94a3b8">(Ký, ghi rõ họ tên)</span>
          <span class="sig-name">Nguyễn Hữu An</span>
        </div>
      </div>
    </body>
    </html>
  `;

  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();

  // Trigger print dialog once loaded
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // Allow print preview load before DOM recycling
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 500);
}
