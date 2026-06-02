import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import fs from "fs";

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize SQLite database
const dbPath = path.resolve(process.cwd(), "ppe_management.db");
let db = new Database(dbPath);

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    req_date TEXT NOT NULL,
    project TEXT NOT NULL,
    ppe_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Chờ duyệt', 'Đã duyệt', 'Từ chối', 'Đã giao hàng')),
    note TEXT,
    employee_name TEXT,
    employee_role TEXT,
    attachment_data TEXT,
    attachment_name TEXT,
    attachment_type TEXT
  );

  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_date TEXT NOT NULL,
    delivery_note_no TEXT NOT NULL,
    project TEXT NOT NULL,
    ppe_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    supplier TEXT NOT NULL,
    note TEXT,
    request_id INTEGER REFERENCES requests(id) ON DELETE SET NULL,
    employee_name TEXT,
    employee_role TEXT,
    attachment_data TEXT,
    attachment_name TEXT,
    attachment_type TEXT
  );

  CREATE TABLE IF NOT EXISTS projects_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ppe_types_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    unit TEXT NOT NULL DEFAULT 'Cái',
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS employee_roles_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS safety_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    cost_code TEXT NOT NULL,
    cost_name TEXT NOT NULL,
    approved_budget REAL NOT NULL DEFAULT 0.0,
    unit TEXT NOT NULL DEFAULT 'VNĐ',
    input_date TEXT NOT NULL,
    input_by TEXT NOT NULL,
    note TEXT,
    UNIQUE(project, cost_code)
  );

  CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_date TEXT NOT NULL,
    project TEXT NOT NULL,
    supplier TEXT NOT NULL,
    cost_code TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    input_by TEXT
  );

  CREATE TABLE IF NOT EXISTS supplier_payment_dossiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    received_date TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    project_name TEXT NOT NULL,
    contract_po_no TEXT,
    payment_content TEXT,
    payment_amount REAL NOT NULL,
    has_invoice INTEGER DEFAULT 0,
    has_delivery_note INTEGER DEFAULT 0,
    has_ppe_request INTEGER DEFAULT 0,
    has_quotation_po INTEGER DEFAULT 0,
    has_acceptance_cert INTEGER DEFAULT 0,
    has_other_docs INTEGER DEFAULT 0,
    hse_email_date TEXT,
    project_pic TEXT,
    status TEXT NOT NULL DEFAULT 'Chưa gửi',
    project_response_date TEXT,
    project_response_content TEXT,
    accounting_transfer_date TEXT,
    accounting_recipient TEXT,
    notes TEXT,
    linked_delivery_id INTEGER REFERENCES deliveries(id) ON DELETE SET NULL,
    payment_ppe_quantity INTEGER,
    cost_code TEXT
  );

  CREATE TABLE IF NOT EXISTS suppliers_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    contact_person TEXT,
    phone TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'Đang sử dụng'
  );

  CREATE TABLE IF NOT EXISTS ppe_price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ppe_id INTEGER,
    ppe_name TEXT,
    old_price REAL,
    new_price REAL,
    supplier_name TEXT,
    change_date TEXT,
    changed_by TEXT,
    note TEXT
  );
`);

// Safe migration: Add employee & attachment columns to existing sqlite tables to prevent errors in existing environments
try {
  db.exec("ALTER TABLE requests ADD COLUMN employee_name TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE requests ADD COLUMN employee_role TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE requests ADD COLUMN attachment_data TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE requests ADD COLUMN attachment_name TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE requests ADD COLUMN attachment_type TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE requests ADD COLUMN cost_code TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE requests ADD COLUMN unit_price REAL;");
} catch (e) {}
try {
  db.exec("ALTER TABLE requests ADD COLUMN amount REAL;");
} catch (e) {}

try {
  db.exec("ALTER TABLE deliveries ADD COLUMN employee_name TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE deliveries ADD COLUMN employee_role TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE deliveries ADD COLUMN attachment_data TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE deliveries ADD COLUMN attachment_name TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE deliveries ADD COLUMN attachment_type TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE deliveries ADD COLUMN cost_code TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE deliveries ADD COLUMN unit_price REAL;");
} catch (e) {}
try {
  db.exec("ALTER TABLE deliveries ADD COLUMN amount REAL;");
} catch (e) {}

try {
  db.exec("ALTER TABLE ppe_types_list ADD COLUMN code TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE ppe_types_list ADD COLUMN unit_price REAL DEFAULT 0.0;");
} catch (e) {}
try {
  db.exec("ALTER TABLE ppe_types_list ADD COLUMN supplier_name TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE ppe_types_list ADD COLUMN price_apply_date TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE ppe_types_list ADD COLUMN note TEXT;");
} catch (e) {}

// --- NEW HEADER-DETAIL DELIVERIES AND DOSSIER JUNCTIONS MIGRATIONS ---
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS delivery_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
      ppe_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL DEFAULT 0.0,
      amount REAL NOT NULL DEFAULT 0.0,
      cost_code TEXT
    );
  `);
} catch (e) {
  console.error("Error creating delivery_details table: ", e);
}

try {
  const detailCount = db.prepare("SELECT count(*) as count FROM delivery_details").get() as { count: number };
  if (detailCount.count === 0) {
    db.exec(`
      INSERT INTO delivery_details (delivery_id, ppe_type, quantity, unit_price, amount, cost_code)
      SELECT id, ppe_type, quantity, COALESCE(unit_price, 0.0), COALESCE(amount, 0.0), COALESCE(cost_code, '9.07.02')
      FROM deliveries;
    `);
    console.log("Migrated existing single deliveries records into delivery_details table successfully.");
  }
} catch (e) {
  console.error("Error migrating deliveries to delivery_details: ", e);
}

try {
  db.exec("ALTER TABLE deliveries ADD COLUMN deliverer TEXT;");
} catch (e) {}

try {
  db.exec("ALTER TABLE deliveries ADD COLUMN receiver TEXT;");
} catch (e) {}

try {
  db.exec("ALTER TABLE supplier_payment_dossiers ADD COLUMN attachment_data TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE supplier_payment_dossiers ADD COLUMN attachment_name TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE supplier_payment_dossiers ADD COLUMN attachment_type TEXT;");
} catch (e) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dossier_deliveries_junction (
      dossier_id INTEGER REFERENCES supplier_payment_dossiers(id) ON DELETE CASCADE,
      delivery_id INTEGER REFERENCES deliveries(id) ON DELETE CASCADE,
      PRIMARY KEY(dossier_id, delivery_id)
    );
  `);
} catch (e) {
  console.error("Error creating dossier_deliveries_junction table: ", e);
}

try {
  const junctionCount = db.prepare("SELECT count(*) as count FROM dossier_deliveries_junction").get() as { count: number };
  if (junctionCount.count === 0) {
    db.exec(`
      INSERT INTO dossier_deliveries_junction (dossier_id, delivery_id)
      SELECT id, linked_delivery_id 
      FROM supplier_payment_dossiers 
      WHERE linked_delivery_id IS NOT NULL;
    `);
    console.log("Migrated existing single linked deliveries to dossier_deliveries_junction successfully.");
  }
} catch (e) {
  console.error("Error migrating linked deliveries: ", e);
}
// --- END NEW HEADER-DETAIL DELIVERIES AND DOSSIER JUNCTIONS MIGRATIONS ---

// Seed configs if empty
try {
  const projCount = db.prepare("SELECT count(*) as count FROM projects_list").get() as { count: number };
  if (projCount.count === 0) {
    const insertProj = db.prepare("INSERT INTO projects_list (name) VALUES (?)");
    ["Dự án A", "Dự án B", "Dự án C", "Dự án D", "Dự án E"].forEach(name => {
      insertProj.run(name);
    });
  }
} catch (e) {}

try {
  const ppeCount = db.prepare("SELECT count(*) as count FROM ppe_types_list").get() as { count: number };
  if (ppeCount.count === 0) {
    const insertPpe = db.prepare("INSERT INTO ppe_types_list (name, unit, description) VALUES (?, ?, ?)");
    [
      { name: "Nón bảo hộ", unit: "Cái", description: "Mũ nhựa công trường chống va đập" },
      { name: "Áo ghi lê", unit: "Cái", description: "Áo phản quang 3 cái/lần cấp, tối đa 2 lần/năm" },
      { name: "Giày Jogger", unit: "Đôi", description: "Thương hiệu Jogger, định mức Kỹ sư tối đa 4 đôi/năm" },
      { name: "Giày Ziben", unit: "Đôi", description: "Thương hiệu cao cấp Ziben, định mức CHT tối đa 2 đôi/năm" },
      { name: "Giày bảo hộ Zinben", unit: "Đôi", description: "Thương hiệu cao cấp Ziben" },
      { name: "Áo an toàn", unit: "Cái", description: "Áo bảo hộ lao động phản quang cao cấp" },
      { name: "Kính bảo hộ", unit: "Cái", description: "Kính trắng chống bụi và tia UV" },
      { name: "Găng tay", unit: "Đôi", description: "Găng tay sợi len dệt chống xước" },
      { name: "Áo kỹ sư", unit: "Cái", description: "Áo thun bông hoặc áo vải dầy" },
      { name: "PPE khác", unit: "Cái", description: "Dành cho các loại trang bị phát sinh khác" }
    ].forEach(item => {
      insertPpe.run(item.name, item.unit, item.description);
    });
  }
} catch (e) {}

try {
  const roleCount = db.prepare("SELECT count(*) as count FROM employee_roles_list").get() as { count: number };
  if (roleCount.count === 0) {
    const insertRole = db.prepare("INSERT INTO employee_roles_list (name) VALUES (?)");
    ["Công nhân / Khác", "Kỹ sư", "Chỉ huy trưởng / Giám đốc dự án"].forEach(name => {
      insertRole.run(name);
    });
  }
} catch (e) {}

// Seed safety budgets if empty
try {
  const budgetCount = db.prepare("SELECT count(*) as count FROM safety_budgets").get() as { count: number };
  if (budgetCount.count === 0) {
    const insertBudget = db.prepare(`
      INSERT INTO safety_budgets (project, cost_code, cost_name, approved_budget, unit, input_date, input_by, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const costCodes = [
      { code: "9.07.01", name: "Bảng hiệu an toàn", budget: 60000000 },
      { code: "9.07.02", name: "Đồ BHLĐ", budget: 150000000 },
      { code: "9.07.03", name: "Thiết bị ATLĐ", budget: 180000000 },
      { code: "9.07.04", name: "Trang thiết bị y tế, thuốc y tế, sơ cấp cứu", budget: 40000000 },
      { code: "9.07.05", name: "Bảo hiểm", budget: 90000000 },
      { code: "9.07.06", name: "Huấn luyện, chứng chỉ an toàn, khám sức khỏe định kỳ", budget: 80000000 },
      { code: "9.07.07", name: "Chi phí an toàn khác", budget: 50000000 }
    ];

    ["Dự án A", "Dự án B", "Dự án C", "Dự án D", "Dự án E"].forEach(proj => {
      costCodes.forEach(cc => {
        insertBudget.run(proj, cc.code, cc.name, cc.budget, "VNĐ", "2026-01-10", "HSE Admin", `Ngân sách duyệt năm 2026 cho ${proj}`);
      });
    });
  }
} catch (e) {
  console.error("Error seeding safety budgets: ", e);
}

// Seed supplier payments if empty
try {
  const paymentCount = db.prepare("SELECT count(*) as count FROM supplier_payments").get() as { count: number };
  if (paymentCount.count === 0) {
    const insertPayment = db.prepare(`
      INSERT INTO supplier_payments (payment_date, project, supplier, cost_code, amount, note, input_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertPayment.run("2026-04-10", "Dự án A", "Công ty Quảng Cáo Á Đông", "9.07.01", 35000000, "Thanh toán biển báo rào chắn công trình", "HSE Admin");
    insertPayment.run("2026-04-25", "Dự án A", "Phòng khám Đa Khoa Medlatec", "9.07.06", 45000000, "Chi phí khám sức khỏe định kỳ công nhân đợt 1", "HSE Admin");
    insertPayment.run("2026-05-12", "Dự án B", "Thiết bị An Toàn Việt Nam", "9.07.03", 85000000, "Mua lưới chống rơi và lan can tạm", "HSE Admin");
    insertPayment.run("2026-05-20", "Dự án C", "Nhà thuốc Phano", "9.07.04", 12000000, "Bộ túi sơ cứu và thuốc men y tế đợt đầu", "HSE Admin");
    insertPayment.run("2026-05-29", "Dự án D", "Bảo hiểm PVI Sài Gòn", "9.07.05", 92000000, "Mua bảo hiểm tai nạn lao động cho công trường", "HSE Admin");
  }
} catch (e) {
  console.error("Error seeding supplier payments: ", e);
}

// Seed default suppliers list if empty
try {
  const supCount = db.prepare("SELECT count(*) as count FROM suppliers_list").get() as { count: number };
  if (supCount.count === 0) {
    const insertSup = db.prepare("INSERT INTO suppliers_list (name, contact_person, phone, note, status) VALUES (?, ?, ?, ?, ?)");
    [
      { name: "Bảo hộ lao động An Phát", contact: "Nguyễn Văn Phát", phone: "0901234567", note: "Nhà cung ứng nón và áo ghi lê", status: "Đang sử dụng" },
      { name: "Nhà cung cấp Việt An", contact: "Trần Việt An", phone: "0987654321", note: "Đồng phục & giày bảo hộ cao cấp", status: "Đang sử dụng" },
      { name: "Công ty Bình An", contact: "Lê Bình An", phone: "0912345678", note: "Sản xuất thiết bị rào chắn, biển báo", status: "Đang sử dụng" },
      { name: "Công ty Bảo An", contact: "Phạm Bảo An", phone: "0934567890", note: "Áo phản quang và găng tay công trình", status: "Đang sử dụng" },
      { name: "Công ty Quảng Cáo Á Đông", contact: "Đỗ Á Đông", phone: "0945678901", note: "Cầu đường quảng cáo & bảng hiệu", status: "Đang sử dụng" },
      { name: "Phòng khám Đa Khoa Medlatec", contact: "Bác sĩ Hùng", phone: "0956789012", note: "Khám sức khỏe công nhân", status: "Đang sử dụng" },
      { name: "Thiết bị An Toàn Việt Nam", contact: "Hồ Việt Nam", phone: "0967890123", note: "Lưới chống rơi", status: "Đang sử dụng" },
      { name: "Nhà thuốc Phano", contact: "Dược sĩ Hoa", phone: "0978901234", note: "Trang thiết bị y tế", status: "Đang sử dụng" },
      { name: "Bảo hiểm PVI Sài Gòn", contact: "Nguyễn Thanh Sơn", phone: "0989012345", note: "Bảo hiểm tai nạn - phòng vệ", status: "Đang sử dụng" }
    ].forEach(row => {
      insertSup.run(row.name, row.contact, row.phone, row.note, row.status);
    });
  }
} catch (e) {
  console.error("Error seeding suppliers: ", e);
}

// Seed default price lists for existing seeded PPE types if values are null
try {
  const ppeRows = db.prepare("SELECT * FROM ppe_types_list WHERE code IS NULL OR code = ''").all() as any[];
  if (ppeRows.length > 0) {
    const updatePpe = db.prepare(`
      UPDATE ppe_types_list 
      SET code = ?, unit_price = ?, supplier_name = ?, price_apply_date = ?
      WHERE id = ?
    `);
    
    const defaultPriceMap: Record<string, { code: string; price: number; supplier: string }> = {
      "Nón bảo hộ": { code: "PPE001", price: 80000, supplier: "Bảo hộ lao động An Phát" },
      "Áo ghi lê": { code: "PPE002", price: 120000, supplier: "Nhà cung cấp Việt An" },
      "Giày Jogger": { code: "PPE003", price: 650000, supplier: "Công ty Bảo An" },
      "Giày Ziben": { code: "PPE004", price: 1500000, supplier: "Nhà cung cấp Việt An" },
      "Giày bảo hộ Zinben": { code: "PPE005", price: 1500000, supplier: "Nhà cung cấp Việt An" },
      "Áo an toàn": { code: "PPE006", price: 90000, supplier: "Công ty Bình An" },
      "Kính bảo hộ": { code: "PPE007", price: 60000, supplier: "Công ty Bảo An" },
      "Găng tay": { code: "PPE008", price: 15000, supplier: "Nhà cung cấp Việt An" },
      "Áo kỹ sư": { code: "PPE009", price: 110000, supplier: "Công ty Bảo An" },
      "PPE khác": { code: "PPE999", price: 50000, supplier: "Nhà cung cấp Việt An" }
    };

    ppeRows.forEach(row => {
      const d = defaultPriceMap[row.name];
      if (d) {
        updatePpe.run(d.code, d.price, d.supplier, "2026-01-01", row.id);
      } else {
        const code = `PPE${String(row.id).padStart(3, '0')}`;
        updatePpe.run(code, 50000, "Nhà cung cấp Việt An", "2026-01-01", row.id);
      }
    });
  }
} catch (e) {
  console.error("Error seeding default price list: ", e);
}

// --- USER MANAGEMENT SYSTEM TABLE ---
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      fullname TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Admin', 'HSE', 'Staff'))
    );
  `);

  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    db.prepare("INSERT INTO users (username, fullname, password, role) VALUES (?, ?, ?, ?)").run("admin", "HSE Admin", "password", "Admin");
    db.prepare("INSERT INTO users (username, fullname, password, role) VALUES (?, ?, ?, ?)").run("hse", "Nguyễn Văn A", "password", "HSE");
    db.prepare("INSERT INTO users (username, fullname, password, role) VALUES (?, ?, ?, ?)").run("staff", "Nhân viên thường", "password", "Staff");
    console.log("Seeded default users table successfully.");
  }
} catch (e) {
  console.error("Error setting up users table: ", e);
}

// Insert dummy data if database is empty to make UI presentable from start
const requestCount = db.prepare("SELECT count(*) as count FROM requests").get() as { count: number };
if (requestCount.count === 0) {
  // Prepopulate standard mock data for a clean presentation
  const insertRequest = db.prepare(`
    INSERT INTO requests (req_date, project, ppe_type, quantity, status, note, employee_name, employee_role, cost_code, unit_price, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertDelivery = db.prepare(`
    INSERT INTO deliveries (delivery_date, delivery_note_no, project, ppe_type, quantity, supplier, note, request_id, employee_name, employee_role, cost_code, unit_price, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Historical April data
  const req1Id = insertRequest.run("2026-04-05", "Dự án A", "Nón bảo hộ", 150, "Đã giao hàng", "Cấp mới bồi dưỡng đội thi công", "Phùng Hồng Quang", "Công nhân / Khác", "9.07.02", 80000, 12000000).lastInsertRowid;
  insertDelivery.run("2026-04-08", "BBGH-0426-001", "Dự án A", "Nón bảo hộ", 150, "Bảo hộ lao động An Phát", "Giao hàng đúng hẹn", req1Id, "Phùng Hồng Quang", "Công nhân / Khác", "9.07.02", 80000, 12000000);

  // Case study: Trần Quốc Bảo carries his quota history from Project A to Project B
  // Trần Quốc Bảo is a "Chỉ huy trưởng / Giám đốc dự án"
  // Item 1: Giày Ziben (Định mức 2 đôi/năm). Received 1 pair in Project A on 2026-04-12.
  const req2Id = insertRequest.run("2026-04-12", "Dự án A", "Giày Ziben", 1, "Đã giao hàng", "Cấp giày Ziben đợt một năm 2026", "Trần Quốc Bảo", "Chỉ huy trưởng / Giám đốc dự án", "9.07.02", 1500000, 1500000).lastInsertRowid;
  insertDelivery.run("2026-04-15", "BBGH-0426-002", "Dự án A", "Giày Ziben", 1, "Nhà cung cấp Việt An", "Giày Ziben chính hãng", req2Id, "Trần Quốc Bảo", "Chỉ huy trưởng / Giám đốc dự án", "9.07.02", 1500000, 1500000);

  const req3Id = insertRequest.run("2026-04-18", "Dự án D", "Áo an toàn", 120, "Đã giao hàng", "Yêu cầu cho thợ phụ", null, null, "9.07.02", 90000, 10800000).lastInsertRowid;
  insertDelivery.run("2026-04-20", "BBGH-0426-003", "Dự án D", "Áo an toàn", 120, "Công ty Bình An", "Logo in sắc nét", req3Id, null, null, "9.07.02", 90000, 10800000);

  // Historical May data
  const req4Id = insertRequest.run("2026-05-02", "Dự án C", "Áo an toàn", 200, "Đã giao hàng", "Cấp phát cho công nhân mới", null, null, "9.07.02", 90000, 18000000).lastInsertRowid;
  insertDelivery.run("2026-05-05", "BBGH-0526-001", "Dự án C", "Áo an toàn", 200, "Công ty Bình An", "Đủ hàng", req4Id, null, null, "9.07.02", 90000, 18000000);

  // Case study: Trần Quốc Bảo transferred to Project B. Received his 2nd pair of Giày Ziben on 2026-05-15 in Project B.
  // Now he has maxed out (2/2) for the current year. Any subsequent request/delivery will trigger a warning.
  const req2_2Id = insertRequest.run("2026-05-10", "Dự án B", "Giày Ziben", 1, "Đã giao hàng", "Cấp giày Ziben sau khi bàn giao dự án mới", "Trần Quốc Bảo", "Chỉ huy trưởng / Giám đốc dự án", "9.07.02", 1500000, 1500000).lastInsertRowid;
  insertDelivery.run("2026-05-15", "BBGH-0526-002", "Dự án B", "Giày Ziben", 1, "Nhà cung cấp Việt An", "Cấp giày Ziben đợt hai sau điều chuyển", req2_2Id, "Trần Quốc Bảo", "Chỉ huy trưởng / Giám đốc dự án", "9.07.02", 1500000, 1500000);

  // Case study: Lê Minh Triết is a "Kỹ sư"
  // Quota 1: Áo ghi lê: 3 cái/lần cấp, 2 lần/năm. Received 3 pieces on 2026-04-20 (Occurrence #1).
  const req6Id = insertRequest.run("2026-04-20", "Dự án A", "Áo ghi lê", 3, "Đã giao hàng", "Cấp áo ghi lê đợt 1", "Lê Minh Triết", "Kỹ sư", "9.07.02", 120000, 360000).lastInsertRowid;
  insertDelivery.run("2026-04-23", "BBGH-0526-003", "Dự án A", "Áo ghi lê", 3, "Nhà cung cấp Việt An", "Giao áo ghi lê phản quang kỹ sư", req6Id, "Lê Minh Triết", "Kỹ sư", "9.07.02", 120000, 360000);

  // Lê Minh Triết also received Giày Jogger (định mức 4 đôi/năm) on 2026-04-20
  const req7Id = insertRequest.run("2026-04-20", "Dự án A", "Giày Jogger", 2, "Đã giao hàng", "Giao giày Jogger công trình", "Lê Minh Triết", "Kỹ sư", "9.07.02", 650000, 1300000).lastInsertRowid;
  insertDelivery.run("2026-04-23", "BBGH-0526-004", "Dự án A", "Giày Jogger", 2, "Công ty Bảo An", "Giày Jogger siêu nhẹ", req7Id, "Lê Minh Triết", "Kỹ sư", "9.07.02", 650000, 1300000);

  // Lê Minh Triết transferred to Project C and requested Áo ghi lê second time (Occurrence #2) on 2026-05-20. This is still within limits.
  const req6_2Id = insertRequest.run("2026-05-18", "Dự án C", "Áo ghi lê", 2, "Đã giao hàng", "Cấp áo ghi lê sau khi chuyển về công trình", "Lê Minh Triết", "Kỹ sư", "9.07.02", 120000, 240000).lastInsertRowid;
  insertDelivery.run("2026-05-20", "BBGH-0526-005", "Dự án C", "Áo ghi lê", 2, "Bảo hộ lao động An Phát", "Đủ hàng cấp phát", req6_2Id, "Lê Minh Triết", "Kỹ sư", "9.07.02", 120000, 240000);

  // Pending / Approved requests for current Month (June)
  insertRequest.run("2026-05-28", "Dự án A", "Giày Ziben", 1, "Đã duyệt", "Cấp bổ sung", "Hoàng Kim Long", "Kỹ sư", "9.07.02", 1500000, 1500000);
  insertRequest.run("2026-05-29", "Dự án C", "Nón bảo hộ", 100, "Chờ duyệt", "Yêu cầu khẩn cấp cho nhà thầu phụ", null, null, "9.07.02", 80000, 8000000);
  insertRequest.run("2026-06-01", "Dự án D", "Áo kỹ sư", 15, "Chờ duyệt", "Áo cho kỹ sư cơ điện", null, null, "9.07.02", 110000, 1650000);
  insertRequest.run("2026-06-02", "Dự án B", "Kính bảo hộ", 60, "Từ chối", "Vẫn còn tồn kho sử dụng được", null, null, "9.07.02", 60000, 3600000);

  // Direct delivery without requests
  insertDelivery.run("2026-05-25", "BBGH-DIR-001", "Dự án C", "Găng tay", 100, "Nhà cung cấp Việt An", "Giao khẩn cấp không qua phiếu yêu cầu", null, null, null, "9.07.02", 15000, 1500000);
  insertDelivery.run("2026-06-01", "BBGH-DIR-002", "Dự án E", "Kính bảo hộ", 40, "Công ty Bảo An", "Cấp bổ sung trực tiếp", null, null, null, "9.07.02", 60000, 2400000);

  // Seed supplier payment dossiers
  const insertDossier = db.prepare(`
    INSERT INTO supplier_payment_dossiers (
      received_date, supplier_name, project_name, contract_po_no, payment_content, payment_amount,
      has_invoice, has_delivery_note, has_ppe_request, has_quotation_po, has_acceptance_cert, has_other_docs,
      hse_email_date, project_pic, status, project_response_date, project_response_content,
      accounting_transfer_date, accounting_recipient, notes, linked_delivery_id, payment_ppe_quantity, cost_code
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);

  // Dossier 1: Delivered
  insertDossier.run(
    "2026-05-20", "Bảo hộ lao động An Phát", "Dự án A", "PO-2026-009", "Thanh toán nón bảo hộ đợt 1", 12000000,
    1, 1, 1, 1, 0, 0,
    "2026-05-21", "Nguyễn Văn Tiến", "Dự án đã phản hồi", "2026-05-24", "Dự án xác nhận số lượng khớp thực tế, nghiệm thu đầy đủ",
    null, null, "Hồ sơ gốc lưu file văn phòng", 1, 150, "9.07.02"
  );

  // Dossier 2: Missing dossier (Thiếu hồ sơ)
  insertDossier.run(
    "2026-05-28", "Nhà cung cấp Việt An", "Dự án A", "PO-2026-015", "Thanh toán giày Ziben kỹ sư", 1500000,
    1, 1, 1, 0, 0, 0,
    "2026-05-29", "Trần Văn Nam", "Thiếu hồ sơ", null, null,
    null, null, "Yêu cầu bổ sung bảng báo giá đã duyệt", 2, 1, "9.07.02"
  );

  // Dossier 3: Not yet emailed (Chưa gửi)
  insertDossier.run(
    "2026-06-01", "Công ty Bình An", "Dự án C", "PO-2026-022", "Thanh toán áo an toàn đợt 2", 18000000,
    1, 1, 1, 1, 0, 0,
    null, null, "Chưa gửi", null, null,
    null, null, null, 4, 200, "9.07.02"
  );

  // Dossier 4: Already transferred to accounting (Đã chuyển kế toán)
  insertDossier.run(
    "2026-05-15", "Thiết bị An Toàn Việt Nam", "Dự án B", "PO-2026-003", "Thanh toán lưới chống rơi", 85000000,
    1, 1, 1, 1, 1, 1,
    "2026-05-16", "Phan Anh Tuấn", "Đã chuyển kế toán", "2026-05-18", "Đã xác nhận đầy đủ hồ sơ",
    "2026-05-22", "Chị Mai Phương (Kế toán thanh toán)", "Theo dõi thanh toán đúng hạn cho NCC", null, null, "9.07.03"
  );
}

// --- API ENDPOINTS ---

// GET Projects list
app.get("/api/projects", (req, res) => {
  try {
    const list = db.prepare("SELECT name FROM projects_list ORDER BY name").all() as { name: string }[];
    res.json(list.map(p => p.name));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST a new Project
app.post("/api/projects", (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Tên dự án không được để trống" });
    }
    db.prepare("INSERT OR IGNORE INTO projects_list (name) VALUES (?)").run(name.trim());
    res.json({ success: true, message: "Thêm dự án thành công hoàn tất!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a Project
app.delete("/api/projects", (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Tên dự án không hợp lệ" });
    }
    db.prepare("DELETE FROM projects_list WHERE name = ?").run(name);
    res.json({ success: true, message: "Xóa dự án khỏi danh mục thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT (Update) a Project Name and Cascade
app.put("/api/projects", (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName || !newName.trim()) {
      return res.status(400).json({ error: "Tên dự án không được bỏ trống" });
    }
    const newU = newName.trim();
    const oldU = oldName.trim();

    if (newU.toLowerCase() !== oldU.toLowerCase()) {
      const existing = db.prepare("SELECT id FROM projects_list WHERE LOWER(name) = LOWER(?)").get(newU);
      if (existing) {
        return res.status(400).json({ error: "Tên dự án mới này đã tồn tại trên hệ thống" });
      }
    }

    const updateProjectTx = db.transaction(() => {
      db.prepare("UPDATE projects_list SET name = ? WHERE name = ?").run(newU, oldU);
      db.prepare("UPDATE requests SET project = ? WHERE project = ?").run(newU, oldU);
      db.prepare("UPDATE deliveries SET project = ? WHERE project = ?").run(newU, oldU);
      db.prepare("UPDATE safety_budgets SET project = ? WHERE project = ?").run(newU, oldU);
      db.prepare("UPDATE supplier_payments SET project = ? WHERE project = ?").run(newU, oldU);
      db.prepare("UPDATE supplier_payment_dossiers SET project_name = ? WHERE project_name = ?").run(newU, oldU);
    });

    updateProjectTx();
    res.json({ success: true, message: "Cập nhật tên dự án thành công hoàn tất!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET PPE Types list (simple array for selectors)
app.get("/api/ppe-types", (req, res) => {
  try {
    const list = db.prepare("SELECT name FROM ppe_types_list ORDER BY name").all() as { name: string }[];
    res.json(list.map(t => t.name));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET PPE Types list with details
app.get("/api/ppe-types-detailed", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM ppe_types_list ORDER BY name").all();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST a new PPE Type
app.post("/api/ppe-types", (req, res) => {
  try {
    const { name, unit, description, code, unit_price, supplier_name, price_apply_date, note } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Tên trang bị bảo hộ không được để trống" });
    }
    
    const existing = db.prepare("SELECT * FROM ppe_types_list WHERE name = ?").get(name.trim());
    if (existing) {
      return res.status(400).json({ error: "Mặt hàng PPE bảo hộ này đã tồn tại" });
    }

    const info = db.prepare(`
      INSERT INTO ppe_types_list (name, unit, description, code, unit_price, supplier_name, price_apply_date, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(), 
      unit || "Cái", 
      description || "",
      code || null,
      unit_price !== undefined ? Number(unit_price) : 0,
      supplier_name || null,
      price_apply_date || null,
      note || null
    );
    res.json({ success: true, id: info.lastInsertRowid, message: "Thêm chủng loại bảo hộ thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT a PPE Type (detailed price list update)
app.put("/api/ppe-types/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, unit, description, code, unit_price, supplier_name, price_apply_date, note } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Tên trang bị bảo hộ không được để trống" });
    }

    const current = db.prepare("SELECT * FROM ppe_types_list WHERE id = ?").get(id) as any;
    if (!current) {
      return res.status(404).json({ error: "Không tìm thấy trang bị bảo hộ" });
    }

    const oldPrice = current.unit_price ? Number(current.unit_price) : 0;
    const newPrice = unit_price !== undefined ? Number(unit_price) : 0;

    const runTransaction = db.transaction(() => {
      db.prepare(`
        UPDATE ppe_types_list
        SET name = ?, unit = ?, description = ?, code = ?, unit_price = ?, supplier_name = ?, price_apply_date = ?, note = ?
        WHERE id = ?
      `).run(
        name.trim(), 
        unit || "Cái", 
        description || "", 
        code || null, 
        newPrice, 
        supplier_name || null, 
        price_apply_date || null, 
        note || null,
        id
      );

      // If name changed, cascade update to dependent tables (requests, deliveries)
      const oldName = current.name;
      const newName = name.trim();
      if (oldName !== newName) {
        db.prepare("UPDATE requests SET ppe_type = ? WHERE ppe_type = ?").run(newName, oldName);
        db.prepare("UPDATE deliveries SET ppe_type = ? WHERE ppe_type = ?").run(newName, oldName);
      }

      if (oldPrice !== newPrice) {
        db.prepare(`
          INSERT INTO ppe_price_history (ppe_id, ppe_name, old_price, new_price, supplier_name, change_date, changed_by, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          name.trim(),
          oldPrice,
          newPrice,
          supplier_name || current.supplier_name || "Mặc định",
          new Date().toISOString().split('T')[0],
          "HSE Admin",
          note || "Cập nhật đơn giá danh mục"
        );
      }
    });

    runTransaction();
    res.json({ success: true, message: "Cập nhật trang thiết bị và lưu lịch sử bảng giá thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a PPE Type
app.delete("/api/ppe-types", (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Tên trang thiết bị không hợp lệ" });
    }
    db.prepare("DELETE FROM ppe_types_list WHERE name = ?").run(name);
    res.json({ success: true, message: "Xóa chủng loại bảo hộ thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET suppliers list
app.get("/api/suppliers", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM suppliers_list ORDER BY name").all();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST a new Supplier
app.post("/api/suppliers", (req, res) => {
  try {
    const { name, contact_person, phone, note, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Tên nhà cung cấp không được để trống" });
    }
    const info = db.prepare(`
      INSERT INTO suppliers_list (name, contact_person, phone, note, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), contact_person || "", phone || "", note || "", status || "Đang sử dụng");
    res.json({ id: info.lastInsertRowid, success: true, message: "Thêm nhà cung cấp mới thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update supplier
app.put("/api/suppliers/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, note, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Tên nhà cung cấp không được để trống" });
    }
    db.prepare(`
      UPDATE suppliers_list
      SET name = ?, contact_person = ?, phone = ?, note = ?, status = ?
      WHERE id = ?
    `).run(name.trim(), contact_person || "", phone || "", note || "", status || "Đang sử dụng", id);
    res.json({ success: true, message: "Cập nhật thông tin nhà cung cấp thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a supplier
app.delete("/api/suppliers/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM suppliers_list WHERE id = ?").run(id);
    res.json({ success: true, message: "Xóa nhà cung cấp thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET ppe price history
app.get("/api/ppe-price-history", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM ppe_price_history ORDER BY id DESC").all();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Employee Roles list
app.get("/api/employee-roles", (req, res) => {
  try {
    const list = db.prepare("SELECT name FROM employee_roles_list ORDER BY name").all() as { name: string }[];
    res.json(list.map(r => r.name));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST a new Employee Role
app.post("/api/employee-roles", (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Tên chức vụ công trường không được bỏ trống" });
    }
    db.prepare("INSERT OR IGNORE INTO employee_roles_list (name, description) VALUES (?, ?)")
      .run(name.trim(), description || "");
    res.json({ success: true, message: "Thêm chức vụ thành sự thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE an Employee Role
app.delete("/api/employee-roles", (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Tên chức vụ không hợp lệ" });
    }
    db.prepare("DELETE FROM employee_roles_list WHERE name = ?").run(name);
    res.json({ success: true, message: "Xóa chức vụ khỏi danh sác chuyên môn thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT (Update) an Employee Role and Cascade
app.put("/api/employee-roles", (req, res) => {
  try {
    const { oldName, newName, description } = req.body;
    if (!oldName || !newName || !newName.trim()) {
      return res.status(400).json({ error: "Tên chức vụ không được để trống" });
    }
    const newU = newName.trim();
    const oldU = oldName.trim();

    if (newU.toLowerCase() !== oldU.toLowerCase()) {
      const existing = db.prepare("SELECT id FROM employee_roles_list WHERE LOWER(name) = LOWER(?)").get(newU);
      if (existing) {
        return res.status(400).json({ error: "Tên chức vụ mới này đã tồn tại" });
      }
    }

    const updateRoleTx = db.transaction(() => {
      db.prepare("UPDATE employee_roles_list SET name = ?, description = ? WHERE name = ?").run(newU, description || "", oldU);
      db.prepare("UPDATE requests SET employee_role = ? WHERE employee_role = ?").run(newU, oldU);
      db.prepare("UPDATE deliveries SET employee_role = ? WHERE employee_role = ?").run(newU, oldU);
    });

    updateRoleTx();
    res.json({ success: true, message: "Cập nhật chức vụ thành sự thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET all PPE Requests
app.get("/api/requests", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM requests ORDER BY req_date DESC, id DESC").all();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST a new PPE Request (submitted by project)
app.post("/api/requests", (req, res) => {
  try {
    const { 
      req_date, project, ppe_type, quantity, note, employee_name, employee_role,
      attachment_data, attachment_name, attachment_type, cost_code, unit_price, amount 
    } = req.body;
    
    if (!req_date || !project || !ppe_type || !quantity) {
      return res.status(400).json({ error: "Thiếu các trường bắt buộc để lập phiếu yêu cầu" });
    }
    
    const uPrice = unit_price !== undefined ? Number(unit_price) : null;
    const calcAmount = amount !== undefined ? Number(amount) : (uPrice !== null ? uPrice * Number(quantity) : null);

    const info = db.prepare(`
      INSERT INTO requests (req_date, project, ppe_type, quantity, status, note, employee_name, employee_role, attachment_data, attachment_name, attachment_type, cost_code, unit_price, amount)
      VALUES (?, ?, ?, ?, 'Chờ duyệt', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req_date, project, ppe_type, Number(quantity), note || "", 
      employee_name || null, employee_role || null,
      attachment_data || null, attachment_name || null, attachment_type || null,
      cost_code || null, uPrice, calcAmount
    );
    
    res.json({ id: info.lastInsertRowid, message: "Yêu cầu đã được gửi thành công" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE Request status (Approve, Reject or Complete manually)
app.put("/api/requests/:id/status", (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !["Chờ duyệt", "Đã duyệt", "Từ chối", "Đã giao hàng"].includes(status)) {
      return res.status(400).json({ error: "Trạng thái phê duyệt không hợp lệ" });
    }
    
    const info = db.prepare("UPDATE requests SET status = ? WHERE id = ?").run(status, id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Không tìm thấy yêu cầu" });
    }
    
    res.json({ success: true, message: `Cập nhật trạng thái thành: ${status}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET all deliveries (Nhận cấp phát PPE)
app.get("/api/deliveries", (req, res) => {
  try {
    const list = db.prepare(`
      SELECT d.*, r.req_date, r.quantity as requested_quantity 
      FROM deliveries d
      LEFT JOIN requests r ON d.request_id = r.id
      ORDER BY d.delivery_date DESC, d.id DESC
    `).all() as any[];

    for (const d of list) {
      const items = db.prepare(`
        SELECT * FROM delivery_details WHERE delivery_id = ?
      `).all(d.id);
      d.items = items;
      d.total_amount = items.reduce((sum: number, it: any) => sum + (it.amount || 0), 0);
    }
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST a new delivery (Ghi nhận số lượng đã cấp phát dựa theo Biên bản giao hàng)
app.post("/api/deliveries", (req, res) => {
  try {
    const { 
      delivery_date, delivery_note_no, project, supplier, note, request_id, 
      deliverer, receiver, attachment_data, attachment_name, attachment_type,
      ppe_type, quantity, cost_code, unit_price, amount, items
    } = req.body;
    
    if (!delivery_date || !delivery_note_no || !project || !supplier) {
      return res.status(400).json({ error: "Thiếu các trường thông tin bắt buộc" });
    }

    // Support both single item (legacy) and multi items (Header-Detail)
    let finalItems = items;
    if (!finalItems || !Array.isArray(finalItems) || finalItems.length === 0) {
      if (!ppe_type || !quantity) {
        return res.status(400).json({ error: "Biên bản phải có ít nhất 1 mặt hàng bảo hộ PPE" });
      }
      const uPrice = unit_price !== undefined ? Number(unit_price) : 0;
      const amt = amount !== undefined ? Number(amount) : uPrice * Number(quantity);
      finalItems = [{
        ppe_type,
        quantity: Number(quantity),
        unit_price: uPrice,
        amount: amt,
        cost_code: cost_code || "9.07.02"
      }];
    }

    // Run transaction: Insert delivery and update corresponding request status if request_id is provided
    const runTransaction = db.transaction(() => {
      const firstItem = finalItems[0];
      const totalAmount = finalItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price || 0)), 0);
      const totalQuantity = finalItems.reduce((sum, item) => sum + Number(item.quantity), 0);

      // 1. Insert header
      const info = db.prepare(`
        INSERT INTO deliveries (
          delivery_date, delivery_note_no, project, ppe_type, quantity, supplier, note, request_id, 
          attachment_data, attachment_name, attachment_type, deliverer, receiver, amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        delivery_date, delivery_note_no, project, firstItem.ppe_type, totalQuantity, supplier, note || "", request_id || null, 
        attachment_data || null, attachment_name || null, attachment_type || null,
        deliverer || null, receiver || null, totalAmount
      );

      const deliveryId = info.lastInsertRowid;

      // 2. Insert items details
      const insertDetail = db.prepare(`
        INSERT INTO delivery_details (delivery_id, ppe_type, quantity, unit_price, amount, cost_code)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of finalItems) {
        const uPrice = Number(item.unit_price || 0);
        const qty = Number(item.quantity || 0);
        const amt = item.amount !== undefined ? Number(item.amount) : uPrice * qty;
        insertDetail.run(
          deliveryId,
          item.ppe_type,
          qty,
          uPrice,
          amt,
          item.cost_code || "9.07.02"
        );
      }

      // 3. If it is linked to a request, mark that request as "Đã giao hàng"
      if (request_id) {
        db.prepare("UPDATE requests SET status = 'Đã giao hàng' WHERE id = ?").run(request_id);
      }

      return deliveryId;
    });

    const deliveryId = runTransaction();
    res.json({ id: deliveryId, message: "Ghi nhận cấp phát PPE thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a delivery record (In case of typing mistakes)
app.delete("/api/deliveries/:id", (req, res) => {
  try {
    const { id } = req.params;
    
    // Retrieve delivery first to check if there is an associated request
    const delivery = db.prepare("SELECT * FROM deliveries WHERE id = ?").get() as any;
    if (!delivery) {
      return res.status(404).json({ error: "Không tìm thấy biên bản giao hàng" });
    }

    const runTransaction = db.transaction(() => {
      // Revert request status if applicable
      if (delivery.request_id) {
        // If delivery is deleted, set request back to 'Đã duyệt'
        db.prepare("UPDATE requests SET status = 'Đã duyệt' WHERE id = ?").run(delivery.request_id);
      }
      
      db.prepare("DELETE FROM deliveries WHERE id = ?").run(id);
    });

    runTransaction();
    res.json({ success: true, message: "Đã xóa biên bản giao hàng và cập nhật liên kết" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Dashboard and aggregated stats
app.get("/api/dashboard-stats", (req, res) => {
  try {
    // 1. Total PPE Delivered
    const totalDelivered = db.prepare("SELECT SUM(quantity) as sum FROM deliveries").get() as { sum: number | null };
    const totalCount = totalDelivered.sum || 0;

    // 2. Delivered quantity by project
    const byProject = db.prepare(`
      SELECT project, SUM(quantity) as count 
      FROM deliveries 
      GROUP BY project 
    `).all() as { project: string; count: number }[];

    // Ensure all registered projects are present in the dataset (even if 0)
    const activeProjects = db.prepare("SELECT name FROM projects_list").all() as { name: string }[];
    const PROJECTS_DYNAMIC = activeProjects.map(p => p.name);

    const projectMap = new Map(byProject.map(p => [p.project, p.count]));
    const fullByProject = PROJECTS_DYNAMIC.map(name => ({
      project: name,
      count: projectMap.get(name) || 0
    })).sort((a, b) => b.count - a.count);

    // 3. Delivered quantity by PPE type
    const byPpeType = db.prepare(`
      SELECT ppe_type as type, SUM(quantity) as count 
      FROM deliveries 
      GROUP BY ppe_type 
    `).all() as { type: string; count: number }[];

    // Ensure all registered PPE types are present in the dataset (even if 0)
    const activeTypes = db.prepare("SELECT name FROM ppe_types_list").all() as { name: string }[];
    const PPE_TYPES_DYNAMIC = activeTypes.map(t => t.name);

    const ppeMap = new Map(byPpeType.map(p => [p.type, p.count]));
    const fullByPpeType = PPE_TYPES_DYNAMIC.map(type => ({
      type,
      count: ppeMap.get(type) || 0
    })).sort((a, b) => b.count - a.count);

    // 4. Delivered quantity by month (Formatted as MM/YYYY)
    const allDeliveries = db.prepare("SELECT delivery_date, quantity FROM deliveries").all() as { delivery_date: string; quantity: number }[];
    
    const monthlyMap: Record<string, number> = {};
    allDeliveries.forEach(d => {
      if (d.delivery_date) {
        const parts = d.delivery_date.split("-");
        if (parts.length >= 2) {
          const key = `${parts[1]}/${parts[0]}`; // MM/YYYY
          monthlyMap[key] = (monthlyMap[key] || 0) + d.quantity;
        }
      }
    });

    const byMonth = Object.entries(monthlyMap)
      .map(([month, count]) => {
        const [m, y] = month.split("/");
        return { month, count, sortKey: `${y}-${m}` };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(item => ({ month: item.month, count: item.count }));

    // 5. Total pending requests count
    const pendingReqCount = db.prepare("SELECT COUNT(*) as count FROM requests WHERE status = 'Chờ duyệt'").get() as { count: number };
    // 6. Approved requests awaiting delivery
    const approvedReqCount = db.prepare("SELECT COUNT(*) as count FROM requests WHERE status = 'Đã duyệt'").get() as { count: number };

    res.json({
      totalDelivered: totalCount,
      byProject: fullByProject,
      byPpeType: fullByPpeType,
      byMonth,
      pendingRequests: pendingReqCount.count,
      approvedRequests: approvedReqCount.count
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// --- SAFETY BUDGETS & SUPPLIER PAYMENTS ---
// ==========================================

// GET Safety Budgets list
app.get("/api/safety-budgets", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM safety_budgets ORDER BY project, cost_code").all();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Safety Budget (Update or Create)
app.post("/api/safety-budgets", (req, res) => {
  try {
    const { project, cost_code, cost_name, approved_budget, unit, input_date, input_by, note } = req.body;
    if (!project || !cost_code || !cost_name || approved_budget === undefined) {
      return res.status(400).json({ error: "Thiếu các thông tin bắt buộc để thiết lập ngân sách" });
    }
    db.prepare(`
      INSERT OR REPLACE INTO safety_budgets (project, cost_code, cost_name, approved_budget, unit, input_date, input_by, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project, cost_code, cost_name, Number(approved_budget), unit || "VNĐ",
      input_date || new Date().toISOString().split('T')[0], input_by || "Admin", note || ""
    );
    res.json({ success: true, message: "Thiếu lập hoặc cập nhật ngân sách thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a Safety Budget
app.delete("/api/safety-budgets/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM safety_budgets WHERE id = ?").run(id);
    res.json({ success: true, message: "Đã xóa hạn mức ngân sách thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Supplier Payments list
app.get("/api/supplier-payments", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM supplier_payments ORDER BY payment_date DESC, id DESC").all();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Supplier Payment (Create)
app.post("/api/supplier-payments", (req, res) => {
  try {
    const { payment_date, project, supplier, cost_code, amount, note, input_by } = req.body;
    if (!payment_date || !project || !supplier || !cost_code || amount === undefined) {
      return res.status(400).json({ error: "Thiếu thông tin hồ sơ thanh toán bắt buộc" });
    }
    const info = db.prepare(`
      INSERT INTO supplier_payments (payment_date, project, supplier, cost_code, amount, note, input_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(payment_date, project, supplier, cost_code, Number(amount), note || "", input_by || "HSE Office");
    res.json({ id: info.lastInsertRowid, success: true, message: "Ghi nhận hồ sơ thanh toán nhà cung cấp thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a Supplier Payment
app.delete("/api/supplier-payments/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM supplier_payments WHERE id = ?").run(id);
    res.json({ success: true, message: "Đã xóa hồ sơ thanh toán thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// -- SUPPLIER PAYMENT DOSSIERS API ROUTES --
// ===========================================

// GET all supplier payment dossiers (joined with linked deliveries details if relevant)
app.get("/api/supplier-payment-dossiers", (req, res) => {
  try {
    const list = db.prepare(`
      SELECT d.* FROM supplier_payment_dossiers d
      ORDER BY d.received_date DESC, d.id DESC
    `).all() as any[];

    // Fetch linked deliveries for each dossier via junction table
    for (const d of list) {
      const linkedDeliveries = db.prepare(`
        SELECT d.id, d.delivery_note_no, d.delivery_date, d.supplier, d.project, d.amount
        FROM deliveries d
        JOIN dossier_deliveries_junction j ON d.id = j.delivery_id
        WHERE j.dossier_id = ?
      `).all(d.id) as any[];

      d.linked_deliveries = linkedDeliveries;
      d.linked_delivery_ids = linkedDeliveries.map(ld => ld.id);

      // Keep for backward compatibility of single delivery properties
      d.delivery_note_no = linkedDeliveries.map(ld => ld.delivery_note_no).join(", ");
      d.linked_delivery_id = linkedDeliveries[0]?.id || null;
      d.delivery_supplier = linkedDeliveries[0]?.supplier || null;
    }
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST create supplier payment dossier
app.post("/api/supplier-payment-dossiers", (req, res) => {
  try {
    const {
      received_date, supplier_name, project_name, contract_po_no, payment_content, payment_amount,
      has_invoice, has_delivery_note, has_ppe_request, has_quotation_po, has_acceptance_cert, has_other_docs,
      hse_email_date, project_pic, status, project_response_date, project_response_content,
      accounting_transfer_date, accounting_recipient, notes, linked_delivery_id, linked_delivery_ids, payment_ppe_quantity, cost_code,
      attachment_data, attachment_name, attachment_type
    } = req.body;

    if (!received_date || !supplier_name || !project_name || payment_amount === undefined) {
      return res.status(400).json({ error: "Thiếu các thông tin bắt buộc của hồ sơ thanh toán nhà cung cấp" });
    }

    // Resolve delivery list
    let finalDeliveryIds: number[] = [];
    if (linked_delivery_ids && Array.isArray(linked_delivery_ids)) {
      finalDeliveryIds = linked_delivery_ids.map(Number).filter(id => !isNaN(id));
    } else if (linked_delivery_id) {
      finalDeliveryIds = [Number(linked_delivery_id)];
    }

    const runTransaction = db.transaction(() => {
      const firstLinkedId = finalDeliveryIds.length > 0 ? finalDeliveryIds[0] : null;

      // 1. Insert dossier
      const info = db.prepare(`
        INSERT INTO supplier_payment_dossiers (
          received_date, supplier_name, project_name, contract_po_no, payment_content, payment_amount,
          has_invoice, has_delivery_note, has_ppe_request, has_quotation_po, has_acceptance_cert, has_other_docs,
          hse_email_date, project_pic, status, project_response_date, project_response_content,
          accounting_transfer_date, accounting_recipient, notes, linked_delivery_id, payment_ppe_quantity, cost_code,
          attachment_data, attachment_name, attachment_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        received_date, supplier_name, project_name, contract_po_no || null, payment_content || "", Number(payment_amount),
        has_invoice ? 1 : 0, has_delivery_note ? 1 : 0, has_ppe_request ? 1 : 0, has_quotation_po ? 1 : 0, has_acceptance_cert ? 1 : 0, has_other_docs ? 1 : 0,
        hse_email_date || null, project_pic || null, status || "Chưa gửi", project_response_date || null, project_response_content || null,
        accounting_transfer_date || null, accounting_recipient || null, notes || "", firstLinkedId,
        payment_ppe_quantity ? Number(payment_ppe_quantity) : null, cost_code || null,
        attachment_data || null, attachment_name || null, attachment_type || null
      );

      const dossierId = info.lastInsertRowid;

      // 2. Insert junction links
      const insertJunction = db.prepare("INSERT INTO dossier_deliveries_junction (dossier_id, delivery_id) VALUES (?, ?)");
      for (const delId of finalDeliveryIds) {
        insertJunction.run(dossierId, delId);
      }

      return dossierId;
    });

    const dossierId = runTransaction();
    res.json({ id: dossierId, success: true, message: "Tạo hồ sơ thanh toán nhà cung cấp thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update supplier payment dossier
app.put("/api/supplier-payment-dossiers/:id", (req, res) => {
  try {
    const { id } = req.params;
    const {
      received_date, supplier_name, project_name, contract_po_no, payment_content, payment_amount,
      has_invoice, has_delivery_note, has_ppe_request, has_quotation_po, has_acceptance_cert, has_other_docs,
      hse_email_date, project_pic, status, project_response_date, project_response_content,
      accounting_transfer_date, accounting_recipient, notes, linked_delivery_id, linked_delivery_ids, payment_ppe_quantity, cost_code,
      attachment_data, attachment_name, attachment_type
    } = req.body;

    if (!received_date || !supplier_name || !project_name || payment_amount === undefined) {
      return res.status(400).json({ error: "Thiếu các thông tin bắt buộc" });
    }

    // Resolve delivery list
    let finalDeliveryIds: number[] = [];
    if (linked_delivery_ids && Array.isArray(linked_delivery_ids)) {
      finalDeliveryIds = linked_delivery_ids.map(Number).filter(id => !isNaN(id));
    } else if (linked_delivery_id) {
      finalDeliveryIds = [Number(linked_delivery_id)];
    }

    const runTransaction = db.transaction(() => {
      const firstLinkedId = finalDeliveryIds.length > 0 ? finalDeliveryIds[0] : null;

      // Resolve attachments
      const current = db.prepare("SELECT attachment_data, attachment_name, attachment_type FROM supplier_payment_dossiers WHERE id = ?").get(id) as any;
      const finalAttachmentData = attachment_data !== undefined ? attachment_data : (current?.attachment_data || null);
      const finalAttachmentName = attachment_name !== undefined ? attachment_name : (current?.attachment_name || null);
      const finalAttachmentType = attachment_type !== undefined ? attachment_type : (current?.attachment_type || null);

      const info = db.prepare(`
        UPDATE supplier_payment_dossiers
        SET received_date = ?, supplier_name = ?, project_name = ?, contract_po_no = ?, payment_content = ?, payment_amount = ?,
            has_invoice = ?, has_delivery_note = ?, has_ppe_request = ?, has_quotation_po = ?, has_acceptance_cert = ?, has_other_docs = ?,
            hse_email_date = ?, project_pic = ?, status = ?, project_response_date = ?, project_response_content = ?,
            accounting_transfer_date = ?, accounting_recipient = ?, notes = ?, linked_delivery_id = ?, payment_ppe_quantity = ?, cost_code = ?,
            attachment_data = ?, attachment_name = ?, attachment_type = ?
        WHERE id = ?
      `).run(
        received_date, supplier_name, project_name, contract_po_no || null, payment_content || "", Number(payment_amount),
        has_invoice ? 1 : 0, has_delivery_note ? 1 : 0, has_ppe_request ? 1 : 0, has_quotation_po ? 1 : 0, has_acceptance_cert ? 1 : 0, has_other_docs ? 1 : 0,
        hse_email_date || null, project_pic || null, status || "Chưa gửi", project_response_date || null, project_response_content || null,
        accounting_transfer_date || null, accounting_recipient || null, notes || "", firstLinkedId,
        payment_ppe_quantity ? Number(payment_ppe_quantity) : null, cost_code || null,
        finalAttachmentData, finalAttachmentName, finalAttachmentType,
        id
      );

      // Rebuild junction links
      db.prepare("DELETE FROM dossier_deliveries_junction WHERE dossier_id = ?").run(id);
      const insertJunction = db.prepare("INSERT INTO dossier_deliveries_junction (dossier_id, delivery_id) VALUES (?, ?)");
      for (const delId of finalDeliveryIds) {
        insertJunction.run(id, delId);
      }

      return info.changes;
    });

    runTransaction();
    res.json({ success: true, message: "Cập nhật hồ sơ thanh toán thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE supplier payment dossier
app.delete("/api/supplier-payment-dossiers/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM supplier_payment_dossiers WHERE id = ?").run(id);
    res.json({ success: true, message: "Xóa hồ sơ thanh toán nhà cung cấp thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Live Budget Summary
app.get("/api/budget-summary", (req, res) => {
  try {
    const budgets = db.prepare("SELECT * FROM safety_budgets ORDER BY project, cost_code").all() as any[];
    
    const ppeSpentList = db.prepare(`
      SELECT d.project, det.cost_code, SUM(det.amount) as sum 
      FROM delivery_details det
      JOIN deliveries d ON det.delivery_id = d.id
      WHERE det.cost_code IS NOT NULL AND det.amount IS NOT NULL 
      GROUP BY d.project, det.cost_code
    `).all() as { project: string; cost_code: string; sum: number }[];
    
    const tempPpeMap = new Map<string, number>();
    ppeSpentList.forEach(item => {
      tempPpeMap.set(`${item.project}_${item.cost_code}`, item.sum || 0);
    });

    const supplierSpentList = db.prepare(`
      SELECT project, cost_code, SUM(amount) as sum 
      FROM supplier_payments 
      GROUP BY project, cost_code
    `).all() as { project: string; cost_code: string; sum: number }[];

    const dossiersSpentList = db.prepare(`
      SELECT project_name as project, cost_code, SUM(payment_amount) as sum
      FROM supplier_payment_dossiers
      WHERE cost_code IS NOT NULL AND status IN ('Đã chuyển kế toán', 'Hoàn tất thanh toán')
      GROUP BY project_name, cost_code
    `).all() as { project: string; cost_code: string; sum: number }[];
    
    const tempSupplierMap = new Map<string, number>();
    supplierSpentList.forEach(item => {
      tempSupplierMap.set(`${item.project}_${item.cost_code}`, item.sum || 0);
    });

    dossiersSpentList.forEach(item => {
      const key = `${item.project}_${item.cost_code}`;
      const existing = tempSupplierMap.get(key) || 0;
      tempSupplierMap.set(key, existing + (item.sum || 0));
    });

    const summary = budgets.map(b => {
      const key = `${b.project}_${b.cost_code}`;
      const ppe = tempPpeMap.get(key) || 0;
      const supplier = tempSupplierMap.get(key) || 0;
      const totalSpent = ppe + supplier;
      const remaining = b.approved_budget - totalSpent;
      const pctUsed = b.approved_budget > 0 ? (totalSpent / b.approved_budget) * 100 : 0;
      return {
        id: b.id,
        project: b.project,
        cost_code: b.cost_code,
        cost_name: b.cost_name,
        approved_budget: b.approved_budget,
        unit: b.unit,
        input_date: b.input_date,
        input_by: b.input_by,
        note: b.note,
        spent_ppe: ppe,
        spent_payments: supplier,
        total_spent: totalSpent,
        remaining: remaining,
        pct_used: pctUsed
      };
    });

    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ===========================================
// -- DATABASE BACKUP & RESTORE API ROUTES --
// ===========================================
const backupDir = path.resolve(process.cwd(), "backups");
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Check and trigger weekly backup
function checkAndRunWeeklyBackup() {
  try {
    const files = fs.readdirSync(backupDir);
    const autoBackups = files
      .filter(f => f.startsWith("auto_backup_") && f.endsWith(".db"))
      .map(f => {
        const filePath = path.join(backupDir, f);
        const stats = fs.statSync(filePath);
        return { file: f, mtime: stats.mtime.getTime() };
      });
    
    let needsBackup = false;
    if (autoBackups.length === 0) {
      needsBackup = true;
    } else {
      autoBackups.sort((a, b) => b.mtime - a.mtime);
      const latestMtime = autoBackups[0].mtime;
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (latestMtime < sevenDaysAgo) {
        needsBackup = true;
      }
    }
    
    if (needsBackup) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const destPath = path.join(backupDir, `auto_backup_${timestamp}.db`);
      fs.copyFileSync(dbPath, destPath);
      console.log(`Automatic weekly backup created: auto_backup_${timestamp}.db`);
    }
  } catch (err) {
    console.error("Error in weekly backup check:", err);
  }
}

// Get lists of backups
app.get("/api/backup", (req, res) => {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith(".db"))
      .map(f => {
        const filePath = path.join(backupDir, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          size: stats.size,
          created_at: stats.mtime.toISOString(),
          is_auto: f.startsWith("auto_")
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(files);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create manual backup
app.post("/api/backup", (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `manual_backup_${timestamp}.db`;
    const destPath = path.join(backupDir, filename);
    fs.copyFileSync(dbPath, destPath);
    res.json({ success: true, message: "Tạo bản sao lưu thành công!", filename });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Restore database
app.post("/api/backup/restore", (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: "Thiếu tên file sao lưu cần phục hồi" });
    }
    const sourcePath = path.join(backupDir, filename);
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: "Không tìm thấy file sao lưu" });
    }

    db.close();
    fs.copyFileSync(sourcePath, dbPath);
    db = new Database(dbPath);
    res.json({ success: true, message: "Phục hồi dữ liệu cơ sở dữ liệu thành công!" });
  } catch (error: any) {
    try {
      db = new Database(dbPath);
    } catch(e) {}
    res.status(500).json({ error: error.message });
  }
});


// ===========================================
// -- USER MANAGEMENT API ROUTES --
// ===========================================

// Login api proxy that queries database users setup
app.post("/api/login", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!" });
    }
    const user = db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)").get(username.trim()) as any;
    if (!user || user.password !== password) {
      return res.status(400).json({ error: "Tên đăng nhập hoặc mật khẩu không chính xác!" });
    }
    res.json({
      success: true,
      username: user.username,
      fullname: user.fullname,
      role: user.role
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List users list (available for all logged-in roles structure)
app.get("/api/users", (req, res) => {
  try {
    const list = db.prepare("SELECT id, username, fullname, role FROM users ORDER BY id ASC").all();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add new account (restricted to Admin structure inside UI, but open helper here)
app.post("/api/users", (req, res) => {
  try {
    const { username, fullname, password, role } = req.body;
    if (!username || !fullname || !password || !role) {
      return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin!" });
    }
    
    // Check duplication
    const existing = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)").get(username.trim());
    if (existing) {
      return res.status(400).json({ error: "Tên đăng nhập này đã tồn tại!" });
    }

    const info = db.prepare(`
      INSERT INTO users (username, fullname, password, role)
      VALUES (?, ?, ?, ?)
    `).run(username.trim(), fullname.trim(), password, role);

    res.json({ id: info.lastInsertRowid, success: true, message: "Thêm tài khoản thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Edit user role or name
app.put("/api/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, role } = req.body;
    if (!fullname || !role) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ họ tên và vai trò!" });
    }
    
    db.prepare("UPDATE users SET fullname = ?, role = ? WHERE id = ?").run(fullname.trim(), role, id);
    res.json({ success: true, message: "Cập nhật tài khoản thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Change Password api
app.post("/api/users/change-password", (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "Thiếu thông tin mật khẩu!" });
    }
    const user = db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)").get(username.trim()) as any;
    if (!user || user.password !== currentPassword) {
      return res.status(400).json({ error: "Mật khẩu hiện tại không chính xác!" });
    }
    db.prepare("UPDATE users SET password = ? WHERE LOWER(username) = LOWER(?)").run(newPassword, username.trim());
    res.json({ success: true, message: "Thay đổi mật khẩu thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user account
app.delete("/api/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const user = db.prepare("SELECT username FROM users WHERE id = ?").get(id) as any;
    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng!" });
    }
    if (user.username === "admin") {
      return res.status(400).json({ error: "Không được phép xóa tài khoản admin gốc!" });
    }
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ success: true, message: "Xóa tài khoản thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


async function startServer() {
  // Trigger on startup
  checkAndRunWeeklyBackup();
  // Check daily
  setInterval(checkAndRunWeeklyBackup, 24 * 60 * 60 * 1000);
  // Vite middleware / Static site configurations
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Port bind must be exactly 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
