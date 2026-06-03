import { useState, useEffect, useMemo, FormEvent, ChangeEvent, Fragment } from "react";
import {
  Shield,
  Briefcase,
  Calendar,
  FileText,
  LayoutDashboard,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Download,
  Search,
  Building2,
  Truck,
  HelpCircle,
  Info,
  AlertCircle,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  ChevronRight,
  Eye,
  Check,
  Clock,
  ExternalLink
} from "lucide-react";
import { PpeRequest, PpeDelivery, DashboardStats, SafetyBudget, SupplierPayment, SupplierPaymentDossier } from "./types";
import { exportToExcel, exportDossiersToExcel } from "./utils/excelExport";
import { exportExcelReport, exportCsvReport, exportPdfReport } from "./utils/reportExport";

export const COST_CODES = [
  { code: "9.07.01", name: "Bảng hiệu an toàn" },
  { code: "9.07.02", name: "Đồ BHLĐ" },
  { code: "9.07.03", name: "Thiết bị ATLĐ" },
  { code: "9.07.04", name: "Trang thiết bị y tế, thuốc y tế, sơ cấp cứu" },
  { code: "9.07.05", name: "Bảo hiểm" },
  { code: "9.07.06", name: "Huấn luyện, chứng chỉ an toàn, khám sức khỏe định kỳ" },
  { code: "9.07.07", name: "Chi phí an toàn khác" }
];

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "requests" | "deliveries" | "quotas" | "budgets" | "reports" | "deploy" | "settings" | "paymentDossiers">("dashboard");

  // Data State
  const [requests, setRequests] = useState<PpeRequest[]>([]);
  const [deliveries, setDeliveries] = useState<PpeDelivery[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<string[]>(["Dự án A", "Dự án B", "Dự án C", "Dự án D", "Dự án E"]);
  const [ppeTypes, setPpeTypes] = useState<string[]>([
    "Nón bảo hộ",
    "Giày bảo hộ Zinben",
    "Áo an toàn",
    "Kính bảo hộ",
    "Găng tay",
    "Áo kỹ sư",
    "PPE khác"
  ]);
  const [ppeTypesDetailed, setPpeTypesDetailed] = useState<{ id?: number; name: string; unit: string; description?: string }[]>([]);
  const [employeeRoles, setEmployeeRoles] = useState<string[]>([
    "Công nhân / Khác",
    "Kỹ sư",
    "Chỉ huy trưởng / Giám đốc dự án"
  ]);

  // Safety Budgets & Supplier Payments State
  const [safetyBudgets, setSafetyBudgets] = useState<SafetyBudget[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<any[]>([]);
  const [supplierPaymentDossiers, setSupplierPaymentDossiers] = useState<SupplierPaymentDossier[]>([]);

  // Supplier list state
  const [suppliers, setSuppliers] = useState<{ id: number; name: string; contact_person?: string; phone?: string; note?: string; status: string }[]>([]);
  // PPE price history list state
  const [ppePriceHistory, setPpePriceHistory] = useState<{ id: number; ppe_id: number; ppe_name: string; old_price: number; new_price: number; supplier_name: string; change_date: string; changed_by: string; note?: string }[]>([]);
  // SQLite Backups list state
  const [backupsList, setBackupsList] = useState<{ filename: string; size: number; created_at: string; is_auto: boolean }[]>([]);
  // Users database list state
  const [usersList, setUsersList] = useState<{ id: number; username: string; fullname: string; role: "Admin" | "HSE" | "Staff" }[]>([]);
  // Active role and login states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => localStorage.getItem("ppe_logged_in") === "true");
  const [currentUserRole, setCurrentUserRole] = useState<"Admin" | "HSE" | "Staff">(() => (localStorage.getItem("ppe_user_role") as any) || "Admin");
  const [currentUserName, setCurrentUserName] = useState<string>(() => localStorage.getItem("ppe_user_name") || "HSE Admin");
  const [currentLoginUsername, setCurrentLoginUsername] = useState<string>(() => localStorage.getItem("ppe_username") || "admin");

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const u = loginForm.username.trim();
    const p = loginForm.password;

    if (!u || !p) {
      setLoginError("Vui lòng điền tên đăng nhập và mật khẩu!");
      return;
    }

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Mật khẩu hoặc tài khoản không đúng");
      }
      const data = await res.json();
      setIsLoggedIn(true);
      setCurrentUserRole(data.role);
      setCurrentUserName(data.fullname);
      setCurrentLoginUsername(data.username);
      localStorage.setItem("ppe_logged_in", "true");
      localStorage.setItem("ppe_user_role", data.role);
      localStorage.setItem("ppe_user_name", data.fullname);
      localStorage.setItem("ppe_username", data.username);
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem("ppe_logged_in");
    localStorage.removeItem("ppe_user_role");
    localStorage.removeItem("ppe_user_name");
    localStorage.removeItem("ppe_username");
  };

  // Settings sub-tab state
  const [settingsSubTab, setSettingsSubTab] = useState<"catalogs" | "suppliers" | "pricelists" | "backups" | "accounts">("catalogs");

  // Catalog inline editing states
  const [editingProjectName, setEditingProjectName] = useState<string | null>(null);
  const [projectFormName, setProjectFormName] = useState<string>("");

  const [editingCatalogPpeId, setEditingCatalogPpeId] = useState<number | null>(null);
  const [catalogPpeForm, setCatalogPpeForm] = useState({ name: "", unit: "Cái", description: "" });

  const [editingRoleName, setEditingRoleName] = useState<string | null>(null);
  const [roleFormName, setRoleFormName] = useState<string>("");
  const [roleFormDescription, setRoleFormDescription] = useState<string>("");

  // User accounts management state
  const [newUserForm, setNewUserForm] = useState({ username: "", fullname: "", password: "", role: "Staff" });
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null);
  const [addUserError, setAddUserError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<string | null>(null);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);

  // Supplier form edits
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contact_person: "",
    phone: "",
    note: "",
    status: "Đang sử dụng"
  });
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);

  // PPE detail editing
  const [editingPpeItem, setEditingPpeItem] = useState<{ id?: number; name: string; unit: string; description?: string; code?: string; unit_price?: number; supplier_name?: string; price_apply_date?: string; note?: string } | null>(null);

  // Quick addition of supplier mini form state
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState<boolean>(false);
  const [quickSupplierName, setQuickSupplierName] = useState<string>("");

  // Filter conditions for Export Reports tab
  const [repFilterProject, setRepFilterProject] = useState<string>("Tất cả");
  const [repFilterSupplier, setRepFilterSupplier] = useState<string>("Tất cả");
  const [repFilterPpeType, setRepFilterPpeType] = useState<string>("Tất cả");
  const [repFilterCostCode, setRepFilterCostCode] = useState<string>("Tất cả");
  const [repFilterStatus, setRepFilterStatus] = useState<string>("Tất cả");
  const [repFilterFromDate, setRepFilterFromDate] = useState<string>("");
  const [repFilterToDate, setRepFilterToDate] = useState<string>("");
  const [repFilterMonth, setRepFilterMonth] = useState<string>("Tất cả");
  const [repFilterYear, setRepFilterYear] = useState<string>("Tất cả");
  const [reportTypeExport, setReportTypeExport] = useState<"PPE" | "NganSach" | "ThanhToan">("PPE");

  // Dossiers filter states
  const [dossierProjectFilter, setDossierProjectFilter] = useState<string>("Tất cả");
  const [dossierSupplierFilter, setDossierSupplierFilter] = useState<string>("Tất cả");
  const [dossierStatusFilter, setDossierStatusFilter] = useState<string>("Tất cả");
  const [dossierMonthFilter, setDossierMonthFilter] = useState<string>("Tất cả");
  const [dossierYearFilter, setDossierYearFilter] = useState<string>("Tất cả");

  // Budget entry state filters
  const [selectedBudgetProject, setSelectedBudgetProject] = useState<string>("Tất cả");

  // Printable overlays
  const [printRequest, setPrintRequest] = useState<PpeRequest | null>(null);
  const [printDelivery, setPrintDelivery] = useState<PpeDelivery | null>(null);

  // UI States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters for tables
  const [reqProjectFilter, setReqProjectFilter] = useState<string>("Tất cả");
  const [reqStatusFilter, setReqStatusFilter] = useState<string>("Tất cả");
  const [delProjectFilter, setDelProjectFilter] = useState<string>("Tất cả");
  const [delSearchQuery, setDelSearchQuery] = useState<string>("");
  const [quotaSearch, setQuotaSearch] = useState<string>("");
  const [budgetProjectFilter, setBudgetProjectFilter] = useState<string>("Tất cả");
  const [reportSubTab, setReportSubTab] = useState<string>("budget_summary");

  // Forms State
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 1. Request Form
  const [reqForm, setReqForm] = useState({
    req_date: getTodayString(),
    project: "Dự án A",
    ppe_type: "Nón bảo hộ",
    quantity: 1,
    note: "",
    employee_name: "",
    employee_role: "Công nhân / Khác",
    attachment_data: null as string | null,
    attachment_name: null as string | null,
    attachment_type: null as string | null,
    cost_code: "9.07.02",
    unit_price: 0,
    amount: 0
  });
const [editingDeliveryId, setEditingDeliveryId] = useState<number | null>(null);
  // 2. Delivery Form (Direct entry or Request transition)
  const [delForm, setDelForm] = useState({
    delivery_date: getTodayString(),
    delivery_note_no: "",
    project: "Dự án A",
    ppe_type: "Nón bảo hộ",
    quantity: 1,
    supplier: "",
    note: "",
    employee_name: "",
    employee_role: "Công nhân / Khác",
    attachment_data: null as string | null,
    attachment_name: null as string | null,
    attachment_type: null as string | null,
    cost_code: "9.07.02",
    unit_price: 0,
    amount: 0,
    deliverer: "",
    receiver: "",
    items: [{ ppe_type: "Nón bảo hộ", quantity: 1, unit_price: 0, amount: 0, cost_code: "9.07.02" }] as { ppe_type: string; quantity: number; unit_price: number; amount: number; cost_code: string }[]
  });

  // 3. Safety Budget Form
  const [budgetForm, setBudgetForm] = useState({
    project: "Dự án A",
    cost_code: "9.07.01",
    cost_name: "Bảng hiệu an toàn",
    approved_budget: 0,
    unit: "VNĐ",
    note: "",
    input_by: "HSE Admin"
  });

  // 4. Supplier Payment Form
  const [paymentForm, setPaymentForm] = useState({
    payment_date: getTodayString(),
    project: "Dự án A",
    supplier: "",
    cost_code: "9.07.01",
    amount: 0,
    note: "",
    input_by: "HSE Office"
  });

  // New PPE catalog item adding state
  const [isAddingPpeItem, setIsAddingPpeItem] = useState<boolean>(false);
  const [newPpeItemForm, setNewPpeItemForm] = useState({
    name: "",
    unit: "Cái",
    description: "",
    code: "",
    unit_price: 0,
    supplier_name: "",
    price_apply_date: "",
    note: ""
  });
  
  // Track if we are processing a delivery from an APPROVED request
  const [linkedRequest, setLinkedRequest] = useState<PpeRequest | null>(null);

  // Synchronize form dropdown defaults when raw projects/ppeTypes/roles are fetched
  useEffect(() => {
    if (projects.length > 0) {
      setReqForm(prev => ({ ...prev, project: projects[0] }));
      setDelForm(prev => ({ ...prev, project: projects[0] }));
      setBudgetForm(prev => ({ ...prev, project: projects[0] }));
      setPaymentForm(prev => ({ ...prev, project: projects[0] }));
    }
  }, [projects]);

  useEffect(() => {
    if (ppeTypes.length > 0) {
      setReqForm(prev => ({ ...prev, ppe_type: ppeTypes[0] }));
      setDelForm(prev => ({ ...prev, ppe_type: ppeTypes[0] }));
    }
  }, [ppeTypes]);

  useEffect(() => {
    if (employeeRoles.length > 0) {
      setReqForm(prev => ({ ...prev, employee_role: employeeRoles[0] }));
      setDelForm(prev => ({ ...prev, employee_role: employeeRoles[0] }));
    }
  }, [employeeRoles]);

  // Automatically pull unit price from pricing list when PPE type changes
  useEffect(() => {
    if (!delForm.ppe_type) return;

    // Find the item in detailed PPE listing
    const matchedPpe = ppeTypesDetailed.find(p => p.name === delForm.ppe_type) as any;
    if (matchedPpe) {
      const price = matchedPpe.unit_price !== undefined ? Number(matchedPpe.unit_price) : 0;
      setDelForm(prev => {
        if (prev.unit_price !== price) {
          return {
            ...prev,
            unit_price: price,
            amount: prev.quantity * price
          };
        }
        return prev;
      });
    } else {
      setDelForm(prev => {
        if (prev.unit_price !== 0) {
          return { ...prev, unit_price: 0, amount: 0 };
        }
        return prev;
      });
    }
  }, [delForm.ppe_type, ppeTypesDetailed]);

  // Synchronize supplier default values from supplier list
  useEffect(() => {
    if (suppliers.length > 0 && !delForm.supplier) {
      const activeSuppliers = suppliers.filter(s => s.status === "Đang sử dụng");
      const defaultSupplier = activeSuppliers.length > 0 ? activeSuppliers[0].name : suppliers[0].name;
      setDelForm(prev => ({ ...prev, supplier: defaultSupplier }));
      setPaymentForm(prev => ({ ...prev, supplier: defaultSupplier }));
    }
  }, [suppliers]);

  // File to base64 converter helper
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, isRequest: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Dung lượng tập tin vượt quá 5MB! Hãy chọn tập tin khác gọn hơn.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      if (isRequest) {
        setReqForm(prev => ({
          ...prev,
          attachment_data: base64Data,
          attachment_name: file.name,
          attachment_type: file.type
        }));
      } else {
        setDelForm(prev => ({
          ...prev,
          attachment_data: base64Data,
          attachment_name: file.name,
          attachment_type: file.type
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Admin Panel Addition Form States
  const [newProjectName, setNewProjectName] = useState("");
  const [newPpeName, setNewPpeName] = useState("");
  const [newPpeUnit, setNewPpeUnit] = useState("Cái");
  const [newPpeDescription, setNewPpeDescription] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");

  const handleAddNewProjectForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() })
      });
      if (!response.ok) throw new Error("Thêm dự án thất bại.");
      triggerSuccessMsg(`Đã chèn thêm dự án "${newProjectName}" vào hệ thống!`);
      setNewProjectName("");
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  const handleDeleteProjectForm = async (name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa dự án "${name}" khỏi danh mục?`)) return;
    try {
      const response = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error("Xóa dự án thất bại.");
      triggerSuccessMsg(`Đã xóa dự án "${name}" hoàn tất!`);
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  const handleAddNewPpeForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPpeName.trim()) return;
    try {
      const response = await fetch("/api/ppe-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPpeName.trim(),
          unit: newPpeUnit.trim() || "Cái",
          description: newPpeDescription.trim() || ""
        })
      });
      if (!response.ok) throw new Error("Thêm chủng loại PPE thất bại.");
      triggerSuccessMsg(`Đã chèn thêm trang bị bảo hộ "${newPpeName}"!`);
      setNewPpeName("");
      setNewPpeUnit("Cái");
      setNewPpeDescription("");
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  const handleDeletePpeForm = async (name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa chủng loại bảo hộ "${name}" khỏi danh mục hệ thống?`)) return;
    try {
      const response = await fetch("/api/ppe-types", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error("Xóa trang bị bảo hộ thất bại.");
      triggerSuccessMsg(`Đã xóa trang bị bảo hộ "${name}" hoàn thành!`);
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  const handleAddNewRoleForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      const response = await fetch("/api/employee-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDescription.trim()
        })
      });
      if (!response.ok) throw new Error("Thêm chức vụ nhân viên thất bại.");
      triggerSuccessMsg(`Đã thêm chức vụ nhân sự "${newRoleName}" vào danh mục chuyên môn!`);
      setNewRoleName("");
      setNewRoleDescription("");
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  const handleDeleteRoleForm = async (name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa chức vụ chuyên môn "${name}" khỏi hệ thống?`)) return;
    try {
      const response = await fetch("/api/employee-roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error("Xóa chức vụ thất bại.");
      triggerSuccessMsg(`Đã xóa chức vụ "${name}"!`);
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  // Update handlers for various catalogs
  const handleSaveProjectEdit = async (oldName: string) => {
    if (!projectFormName.trim()) return;
    try {
      const response = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName: projectFormName.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cập nhật dự án thất bại.");
      triggerSuccessMsg(`Đã cập nhật dự án thành "${projectFormName.trim()}"!`);
      setEditingProjectName(null);
      loadAllData();
    } catch (err: any) {
      alert("An Error occurred: " + err.message);
    }
  };

  const handleSavePpeCatalogEdit = async (id: number) => {
    if (!catalogPpeForm.name.trim()) return;
    try {
      const orig = ppeTypesDetailed.find(p => p.id === id);
      const reqBody = {
        name: catalogPpeForm.name.trim(),
        unit: catalogPpeForm.unit.trim() || "Cái",
        description: catalogPpeForm.description.trim(),
        code: orig?.code || null,
        unit_price: orig?.unit_price !== undefined ? orig.unit_price : 0,
        supplier_name: orig?.supplier_name || null,
        price_apply_date: orig?.price_apply_date || null,
        note: orig?.note || null
      };

      const response = await fetch(`/api/ppe-types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cập nhật chủng loại PPE thất bại.");
      triggerSuccessMsg(`Đã cập nhật trang bị an toàn "${catalogPpeForm.name.trim()}" thành công!`);
      setEditingCatalogPpeId(null);
      loadAllData();
    } catch (err: any) {
      alert("An Error occurred: " + err.message);
    }
  };

  const handleSaveRoleEdit = async (oldName: string) => {
    if (!roleFormName.trim()) return;
    try {
      const response = await fetch("/api/employee-roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldName,
          newName: roleFormName.trim(),
          description: roleFormDescription.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cập nhật chức vụ thất bại.");
      triggerSuccessMsg(`Đã cập nhật chức vụ thành "${roleFormName.trim()}"!`);
      setEditingRoleName(null);
      loadAllData();
    } catch (err: any) {
      alert("An Error occurred: " + err.message);
    }
  };

  // Fetch all data from server
  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        reqsRes, delsRes, statsRes, projsRes, ppeTypesRes, ppeDetailedRes, rolesRes,
        budgetsRes, paymentsRes, summaryRes, dossiersRes, suppliersRes, historyRes, backupRes, usersRes
      ] = await Promise.all([
        fetch("/api/requests"),
        fetch("/api/deliveries"),
        fetch("/api/dashboard-stats"),
        fetch("/api/projects"),
        fetch("/api/ppe-types"),
        fetch("/api/ppe-types-detailed"),
        fetch("/api/employee-roles"),
        fetch("/api/safety-budgets"),
        fetch("/api/supplier-payments"),
        fetch("/api/budget-summary"),
        fetch("/api/supplier-payment-dossiers"),
        fetch("/api/suppliers"),
        fetch("/api/ppe-price-history"),
        fetch("/api/backup"),
        fetch("/api/users")
      ]);

      if (!reqsRes.ok || !delsRes.ok || !statsRes.ok) {
        throw new Error("Không thể tải thông tin từ máy chủ.");
      }

      const reqsData = await reqsRes.json();
      const delsData = await delsRes.json();
      const statsData = await statsRes.json();
      const projsData = await projsRes.json();
      const ppeTypesData = await ppeTypesRes.json();
      const ppeDetailedData = await ppeDetailedRes.json();
      const rolesData = await rolesRes.json();

      setRequests(reqsData);
      setDeliveries(delsData);
      setStats(statsData);
      if (projsData) setProjects(projsData);
      if (ppeTypesData) setPpeTypes(ppeTypesData);
      if (ppeDetailedData) setPpeTypesDetailed(ppeDetailedData);
      if (rolesData) setEmployeeRoles(rolesData);

      if (budgetsRes.ok) {
        const budgetsData = await budgetsRes.json();
        setSafetyBudgets(budgetsData);
      }
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setSupplierPayments(paymentsData);
      }
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setBudgetSummary(summaryData);
      }
      if (dossiersRes.ok) {
        const dossiersData = await dossiersRes.json();
        setSupplierPaymentDossiers(dossiersData);
      }
      if (suppliersRes && suppliersRes.ok) {
        const suppliersData = await suppliersRes.json();
        setSuppliers(suppliersData);
      }
      if (historyRes && historyRes.ok) {
        const historyData = await historyRes.json();
        setPpePriceHistory(historyData);
      }
      if (backupRes && backupRes.ok) {
        const backupData = await backupRes.json();
        setBackupsList(backupData);
      }
      if (usersRes && usersRes.ok) {
        const usersData = await usersRes.json();
        setUsersList(usersData);
      }
    } catch (err: any) {
      console.error(err);
      setError("Có lỗi hệ thống khi kết nối cơ sở dữ liệu. Đang sử dụng chế độ cục bộ tạm thời.");
    } finally {
      setLoading(false);
    }
  };

  // System Backup Methods
  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/backup", { method: "POST" });
      if (!res.ok) throw new Error("Không thể tạo bản sao lưu.");
      const data = await res.json();
      triggerSuccessMsg(data.message || "Tạo bản sao lưu thành công!");
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!confirm(`CẢNH BÁO: Bạn có chắc chắn muốn phục hồi cơ sở dữ liệu từ file "${filename}"? Toàn bộ dữ liệu hiện tại sẽ bị ghi đè.`)) {
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename })
      });
      if (!res.ok) throw new Error("Phục hồi cơ sở dữ liệu thất bại.");
      const data = await res.json();
      triggerSuccessMsg(data.message || "Phục hồi cơ sở dữ liệu thành công!");
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUserAccount = async (e: FormEvent) => {
    e.preventDefault();
    setAddUserSuccess(null);
    setAddUserError(null);

    const { username, fullname, password, role } = newUserForm;
    if (!username.trim() || !fullname.trim() || !password.trim() || !role) {
      setAddUserError("Vui lòng nhập đầy đủ các thông tin bắt buộc!");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          fullname: fullname.trim(),
          password: password,
          role: role
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Không thể tạo tài khoản mới.");
      }

      setAddUserSuccess("Tạo tài khoản mới thành công!");
      setNewUserForm({ username: "", fullname: "", password: "", role: "Staff" });
      loadAllData();
    } catch (err: any) {
      setAddUserError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUserAccount = async (id: number, uname: string) => {
    if (uname === "admin") {
      alert("Không thể xóa tài khoản Admin hệ thống gốc!");
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản "${uname}" này không?`)) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Xóa tài khoản thất bại.");
      }
      triggerSuccessMsg("Xóa tài khoản thành công!");
      loadAllData();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeCurrentUserPassword = async (e: FormEvent) => {
    e.preventDefault();
    setChangePasswordSuccess(null);
    setChangePasswordError(null);

    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setChangePasswordError("Vui lòng điền đầy đủ thông tin mật khẩu!");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordError("Xác nhận mật khẩu mới không khớp!");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentLoginUsername,
          currentPassword,
          newPassword
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Cập nhật mật khẩu thất bại.");
      }

      setChangePasswordSuccess("Thay đổi mật khẩu thành công!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setChangePasswordError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Show auto-dismiss messages
  const triggerSuccessMsg = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 4500);
  };

  // Workflows - Submit Request
  const handleSubmitRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (reqForm.quantity <= 0) {
      alert("Số lượng trang bị đề xuất phải lớn hơn 0!");
      return;
    }
    
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqForm)
      });
      
      if (!response.ok) throw new Error("Gửi đề xuất thất bại.");
      
      triggerSuccessMsg("Gửi phiếu yêu cầu PPE thành công! Chờ HSE Office duyệt.");
      setReqForm({
        req_date: getTodayString(),
        project: projects[0] || "Dự án A",
        ppe_type: ppeTypes[0] || "Nón bảo hộ",
        quantity: 1,
        note: "",
        employee_name: "",
        employee_role: employeeRoles[0] || "Công nhân / Khác",
        attachment_data: null,
        attachment_name: null,
        attachment_type: null,
        cost_code: "9.07.02",
        unit_price: 0,
        amount: 0
      });

      // Reset request file input manually in UI
      const fileInput = document.getElementById("req-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  // Workflows - Change Request Status (Approve/Reject)
  const handleUpdateReqStatus = async (id: number, newStatus: "Đã duyệt" | "Từ chối") => {
    try {
      const response = await fetch(`/api/requests/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error("Cập nhật trạng thái thất bại.");

      triggerSuccessMsg(`Đã duyệt thành công bản ghi: ${newStatus}`);
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  // Workflows - Transition from APPROVED Request to DELIVERY entry
  const startDeliveryFromRequest = (request: PpeRequest) => {
    setLinkedRequest(request);
    const itemAmount = request.amount || (request.unit_price ? request.unit_price * request.quantity : 0);
    setDelForm({
      delivery_date: getTodayString(),
      delivery_note_no: `BBGH-${request.project.replace("Dự án ", "")}-${Date.now().toString().slice(-4)}`,
      project: request.project,
      ppe_type: request.ppe_type,
      quantity: request.quantity,
      supplier: "",
      note: `Giao hàng theo Phiếu YC #${request.id}`,
      employee_name: request.employee_name || "",
      employee_role: request.employee_role || "Công nhân / Khác",
      attachment_data: request.attachment_data || null,
      attachment_name: request.attachment_name || null,
      attachment_type: request.attachment_type || null,
      cost_code: request.cost_code || "9.07.02",
      unit_price: request.unit_price || 0,
      amount: itemAmount,
      deliverer: "",
      receiver: "",
      items: [{
        ppe_type: request.ppe_type,
        quantity: request.quantity,
        unit_price: request.unit_price || 0,
        amount: itemAmount,
        cost_code: request.cost_code || "9.07.02"
      }]
    });
    setActiveTab("deliveries");
  };

  // Quick add supplier inline from delivery form
  const handleQuickAddSupplier = async () => {
    if (!quickSupplierName.trim()) {
      alert("Hãy nhập tên nhà cung cấp!");
      return;
    }
    try {
      const response = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickSupplierName.trim(),
          contact_person: "Thêm nhanh",
          phone: "",
          note: "Thêm nhanh từ giao diện bàn giao",
          status: "Đang sử dụng"
        })
      });
      if (!response.ok) throw new Error("Thêm nhà cung cấp thất bại.");
      triggerSuccessMsg(`Đã thêm nhanh và chọn nhà cung cấp: "${quickSupplierName.trim()}"!`);
      
      // Reload suppliers
      const supRes = await fetch("/api/suppliers");
      if (supRes.ok) {
        const supData = await supRes.json();
        setSuppliers(supData);
      }
      
      // Select it
      setDelForm(prev => ({ ...prev, supplier: quickSupplierName.trim() }));
      setPaymentForm(prev => ({ ...prev, supplier: quickSupplierName.trim() }));
      setQuickSupplierName("");
      setShowQuickAddSupplier(false);
    } catch (err: any) {
      alert("Có lỗi thêm nhanh: " + err.message);
    }
  };

  // Supplier Directory CRUD handlers
  const handleSaveSupplier = async (e: FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      alert("Tên nhà cung cấp không được rỗng!");
      return;
    }
    if (currentUserRole === "Staff") {
      alert("Quyền hạn Staff: Bạn không có quyền thao tác danh nghiệp nhà cung ứng!");
      return;
    }

    try {
      let response;
      if (editingSupplierId) {
        response = await fetch(`/api/suppliers/${editingSupplierId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: supplierForm.name.trim(),
            contact_person: supplierForm.contact_person,
            phone: supplierForm.phone,
            note: supplierForm.note,
            status: supplierForm.status
          })
        });
      } else {
        response = await fetch("/api/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: supplierForm.name.trim(),
            contact_person: supplierForm.contact_person,
            phone: supplierForm.phone,
            note: supplierForm.note,
            status: supplierForm.status
          })
        });
      }

      if (!response.ok) throw new Error("Thao tác thất bại.");
      triggerSuccessMsg(editingSupplierId ? "Đã cập nhật nhà cung cấp!" : "Đã kích hoạt nhà cung cấp mới!");
      
      setSupplierForm({
        name: "",
        contact_person: "",
        phone: "",
        note: "",
        status: "Đang sử dụng"
      });
      setEditingSupplierId(null);
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  const handleDeleteSupplier = async (id: number, name: string) => {
    if (currentUserRole === "Staff") {
      alert("Quyền hạn Staff: Không được phép xóa!");
      return;
    }
    if (!confirm(`Bạn có chắc muốn xóa nhà cung cấp "${name}"?`)) return;
    try {
      const response = await fetch(`/api/suppliers/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Không thể xóa.");
      triggerSuccessMsg(`Đã xóa nhà cung cấp "${name}" khỏi cơ sở dữ liệu!`);
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi khi xóa: " + err.message);
    }
  };

  // Detailed pricing catalog edit handler
  const handleSavePpeDetailed = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPpeItem || !editingPpeItem.id) return;
    if (currentUserRole === "Staff") {
      alert("Quyền hạn Staff: Thao tác điều chỉnh bảng giá bị khóa!");
      return;
    }

    try {
      const response = await fetch(`/api/ppe-types/${editingPpeItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingPpeItem.name.trim(),
          unit: editingPpeItem.unit || "Cái",
          description: editingPpeItem.description || "",
          code: editingPpeItem.code || null,
          unit_price: editingPpeItem.unit_price,
          supplier_name: editingPpeItem.supplier_name,
          price_apply_date: editingPpeItem.price_apply_date,
          note: editingPpeItem.note
        })
      });
      if (!response.ok) throw new Error("Cập nhật thất bại.");
      triggerSuccessMsg(`Đã cập nhật bảng giá và đồng bộ dữ liệu cho: ${editingPpeItem.name}`);
      setEditingPpeItem(null);
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  // Detailed pricing catalog add handler
  const handleCreatePpeItem = async (e: FormEvent) => {
    e.preventDefault();
    if (currentUserRole === "Staff") {
      alert("Quyền hạn Staff: Bạn không được phép thêm mặt hàng bảo hộ mới!");
      return;
    }
    if (!newPpeItemForm.name.trim()) {
      alert("Vui lòng nhập tên trang bị bảo hộ!");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/ppe-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPpeItemForm.name.trim(),
          unit: newPpeItemForm.unit || "Cái",
          description: newPpeItemForm.description || "",
          code: newPpeItemForm.code || null,
          unit_price: Number(newPpeItemForm.unit_price) || 0,
          supplier_name: newPpeItemForm.supplier_name || null,
          price_apply_date: newPpeItemForm.price_apply_date || getTodayString(),
          note: newPpeItemForm.note || ""
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Thêm mới thất bại.");
      }

      triggerSuccessMsg(`Đã tạo mặt hàng bảo hộ mới thành công: ${newPpeItemForm.name}`);
      setIsAddingPpeItem(false);
      setNewPpeItemForm({
        name: "",
        unit: "Cái",
        description: "",
        code: "",
        unit_price: 0,
        supplier_name: "",
        price_apply_date: "",
        note: ""
      });
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Workflows - Submit Delivery Note
  const handleSubmitDelivery = async (e: FormEvent) => {
    e.preventDefault();
    if (!delForm.delivery_note_no.trim()) {
      alert("Vui lòng nhập Số biên bản giao hàng!");
      return;
    }
    if (!delForm.supplier.trim()) {
      alert("Vui lòng cung cấp tên Nhà cung cấp giao hàng!");
      return;
    }
    if (!delForm.items || delForm.items.length === 0) {
      alert("Biên bản giao hàng phải chứa ít nhất 1 mặt hàng PPE!");
      return;
    }
    for (let idx = 0; idx < delForm.items.length; idx++) {
      const it = delForm.items[idx];
      if (!it.ppe_type) {
        alert(`Dòng ${idx + 1}: Vui lòng chọn mặt hàng bảo hộ PPE!`);
        return;
      }
      if (it.quantity <= 0) {
        alert(`Dòng ${idx + 1}: Số lượng giao thực tế phải lớn hơn 0!`);
        return;
      }
    }

    try {
      const payload = {
        ...delForm,
        request_id: linkedRequest ? linkedRequest.id : null
      };

     const url = editingDeliveryId
  ? `/api/deliveries/${editingDeliveryId}`
  : "/api/deliveries";

const method = editingDeliveryId
  ? "PUT"
  : "POST";

const response = await fetch(url, {
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});

      if (!response.ok) throw new Error("Ghi nhận biên bản giao hàng thất bại.");

      triggerSuccessMsg(
  editingDeliveryId
    ? "Cập nhật biên bản giao hàng thành công!"
    : "Tạo biên bản giao hàng thành công!"
);
      
      // Reset forms and contexts
      setDelForm({
        delivery_date: getTodayString(),
        delivery_note_no: "",
        project: projects[0] || "Dự án A",
        ppe_type: ppeTypes[0] || "Nón bảo hộ",
        quantity: 1,
        supplier: "",
        note: "",
        employee_name: "",
        employee_role: employeeRoles[0] || "Công nhân / Khác",
        attachment_data: null,
        attachment_name: null,
        attachment_type: null,
        cost_code: "9.07.02",
        unit_price: 0,
        amount: 0,
        deliverer: "",
        receiver: "",
        items: [{ ppe_type: ppeTypes[0] || "Nón bảo hộ", quantity: 1, unit_price: 0, amount: 0, cost_code: "9.07.02" }]
      });
      setLinkedRequest(null);
setEditingDeliveryId(null);

      // Reset delivery file input manually in UI
      const fileInput = document.getElementById("del-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      loadAllData();
      setActiveTab("dashboard"); // Go back to show updated statistics
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };
const handleEditDelivery = (delivery: any) => {
  setEditingDeliveryId(delivery.id);

  setDelForm({
    ...delivery
  });

  setActiveTab("deliveries");
};
  // Workflows - Delete Delivery Note
  const handleDeleteDelivery = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa biên bản giao hàng này không? Phiếu yêu cầu liên kết (nếu có) sẽ chuyển lại trạng thái 'Đã duyệt'.")) {
      return;
    }

    try {
      const response = await fetch(`/api/deliveries/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) throw new Error("Xóa bản ghi thất bại.");

      triggerSuccessMsg("Đã xóa Biên bản giao hàng và cập nhật liên kết thành công!");
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  // Workflows - Submit Safety Budget
  const handleSubmitBudget = async (e: FormEvent) => {
    e.preventDefault();
    if (budgetForm.approved_budget <= 0) {
      alert("Hạn mức ngân sách phải lớn hơn 0!");
      return;
    }
    // Find name matching cost code
    const matched = COST_CODES.find(c => c.code === budgetForm.cost_code);
    const cost_name = matched ? matched.name : "Chi phí an toàn khác";

    try {
      const payload = {
        ...budgetForm,
        cost_name
      };

      const response = await fetch("/api/safety-budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Cập nhật ngân sách không thành công.");

      triggerSuccessMsg(`Đã thiết lập hạn mức ngân sách ${Number(budgetForm.approved_budget).toLocaleString()} VNĐ cho mã ${budgetForm.cost_code} - ${budgetForm.project}!`);
      
      setBudgetForm(prev => ({
        ...prev,
        approved_budget: 0,
        note: ""
      }));

      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  // Workflows - Delete Safety Budget
  const handleDeleteBudget = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa định biên ngân sách này? Mọi phát sinh tích lũy sẽ không thể tự động đối sánh.")) return;
    try {
      const response = await fetch(`/api/safety-budgets/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Xóa ngân sách không thành công.");
      triggerSuccessMsg("Đã xóa định biên dự chi ngân sách thành công!");
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  // Workflows - Submit Supplier Payment Document
  const handleSubmitPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!paymentForm.supplier.trim()) {
      alert("Vui lòng nhập đơn vị thụ hưởng / tên nhà cung cấp!");
      return;
    }
    if (paymentForm.amount <= 0) {
      alert("Số tiền thanh toán phải lớn hơn 0!");
      return;
    }

    // Dynamic budget control check: Check if this payment exceeds the specified budget
    const targetBudget = budgetSummary.find(b => b.project === paymentForm.project && b.cost_code === paymentForm.cost_code);
    if (targetBudget) {
      const potentialSpend = targetBudget.total_spent + Number(paymentForm.amount);
      if (potentialSpend > targetBudget.approved_budget) {
        const excess = potentialSpend - targetBudget.approved_budget;
        const confirmOver = confirm(`CẢNH BÁO: Khoản thanh toán này (${Number(paymentForm.amount).toLocaleString()} VNĐ) sẽ làm vượt mức dự toán ngân sách của mã ${paymentForm.cost_code} tại ${paymentForm.project}!\n\n- Ngân sách còn lại: ${Number(targetBudget.remaining).toLocaleString()} VNĐ\n- Vượt chi dự kiến: ${excess.toLocaleString()} VNĐ\n\nBạn có muốn tiếp tục lưu hồ sơ này không?`);
        if (!confirmOver) return;
      }
    } else {
      // Warning if no budget is registered for this category
      const confirmNoBudget = confirm(`CẢNH BÁO: Không tìm thấy kế hoạch dự chi ngân sách được đăng ký cho mã ${paymentForm.cost_code} tại ${paymentForm.project}.\n\nBạn có muốn tiếp tục lưu hồ sơ thanh toán không?`);
      if (!confirmNoBudget) return;
    }

    try {
      const response = await fetch("/api/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm)
      });

      if (!response.ok) throw new Error("Ghi nhận hồ sơ thanh toán thất bại.");

      triggerSuccessMsg(`Ghi nhận hồ sơ chi trả ${Number(paymentForm.amount).toLocaleString()} VNĐ từ ${paymentForm.supplier} thành công!`);
      
      setPaymentForm({
        payment_date: getTodayString(),
        project: paymentForm.project,
        supplier: "",
        cost_code: "9.07.01",
        amount: 0,
        note: "",
        input_by: "HSE Office"
      });

      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  // Workflows - Delete Supplier Payment Document
  const handleDeletePayment = async (id: number) => {
    if (!confirm("Bạn có tin chắc chắn muốn xóa hồ sơ thanh toán này không?")) return;
    try {
      const response = await fetch(`/api/supplier-payments/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Xóa hồ sơ thanh toán thất bại.");
      triggerSuccessMsg("Đã xóa hồ sơ thanh toán thành công!");
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  // --- SUPPLIER PAYMENT DOSSIER CONTROLS ---
  const [expandedDossierId, setExpandedDossierId] = useState<number | null>(null);
  const [isEditingDossier, setIsEditingDossier] = useState<SupplierPaymentDossier | null>(null);
  const [showDossierModal, setShowDossierModal] = useState<boolean>(false);
  const [dossierForm, setDossierForm] = useState({
    received_date: getTodayString(),
    supplier_name: "",
    project_name: "Dự án A",
    contract_po_no: "",
    payment_content: "",
    payment_amount: 0,
    has_invoice: 1,
    has_delivery_note: 1,
    has_ppe_request: 0,
    has_quotation_po: 0,
    has_acceptance_cert: 0,
    has_other_docs: 0,
    hse_email_date: "",
    project_pic: "",
    status: "Chưa gửi" as any,
    project_response_date: "",
    project_response_content: "",
    accounting_transfer_date: "",
    accounting_recipient: "",
    notes: "",
    linked_delivery_id: "" as string | number,
    linked_delivery_ids: [] as number[],
    payment_ppe_quantity: "" as string | number,
    cost_code: "9.07.02", // default to PPE
    attachment_data: null as string | null,
    attachment_name: null as string | null,
    attachment_type: null as string | null
  });

  const handleEditDossier = (dossier: SupplierPaymentDossier) => {
    setIsEditingDossier(dossier);
    setDossForm(dossier);
    setShowDossierModal(true);
  };

  const handleOpenNewDossier = () => {
    setIsEditingDossier(null);
    setDossierForm({
      received_date: getTodayString(),
      supplier_name: "",
      project_name: projects[0] || "Dự án A",
      contract_po_no: "",
      payment_content: "",
      payment_amount: 0,
      has_invoice: 1,
      has_delivery_note: 1,
      has_ppe_request: 0,
      has_quotation_po: 0,
      has_acceptance_cert: 0,
      has_other_docs: 0,
      hse_email_date: "",
      project_pic: "",
      status: "Chưa gửi",
      project_response_date: "",
      project_response_content: "",
      accounting_transfer_date: "",
      accounting_recipient: "",
      notes: "",
      linked_delivery_id: "",
      linked_delivery_ids: [],
      payment_ppe_quantity: "",
      cost_code: "9.07.02",
      attachment_data: null,
      attachment_name: null,
      attachment_type: null
    });
    setShowDossierModal(true);
  };

  const setDossForm = (dossier: SupplierPaymentDossier) => {
    setDossierForm({
      received_date: dossier.received_date,
      supplier_name: dossier.supplier_name,
      project_name: dossier.project_name,
      contract_po_no: dossier.contract_po_no || "",
      payment_content: dossier.payment_content || "",
      payment_amount: dossier.payment_amount,
      has_invoice: dossier.has_invoice,
      has_delivery_note: dossier.has_delivery_note,
      has_ppe_request: dossier.has_ppe_request,
      has_quotation_po: dossier.has_quotation_po,
      has_acceptance_cert: dossier.has_acceptance_cert,
      has_other_docs: dossier.has_other_docs,
      hse_email_date: dossier.hse_email_date || "",
      project_pic: dossier.project_pic || "",
      status: dossier.status,
      project_response_date: dossier.project_response_date || "",
      project_response_content: dossier.project_response_content || "",
      accounting_transfer_date: dossier.accounting_transfer_date || "",
      accounting_recipient: dossier.accounting_recipient || "",
      notes: dossier.notes || "",
      linked_delivery_id: dossier.linked_delivery_id || "",
      linked_delivery_ids: dossier.linked_delivery_ids || [],
      payment_ppe_quantity: dossier.payment_ppe_quantity || "",
      cost_code: dossier.cost_code || "9.07.02",
      attachment_data: dossier.attachment_data || null,
      attachment_name: dossier.attachment_name || null,
      attachment_type: dossier.attachment_type || null
    });
  };

  const handleSaveDossier = async (e: FormEvent) => {
    e.preventDefault();
    if (!dossierForm.received_date || !dossierForm.supplier_name || !dossierForm.project_name) {
      alert("Vui lòng nhập đầy đủ thông tin bắt buộc!");
      return;
    }
    try {
      const isEdit = !!isEditingDossier;
      const url = isEdit
        ? `/api/supplier-payment-dossiers/${isEditingDossier!.id}`
        : "/api/supplier-payment-dossiers";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dossierForm)
      });

      if (!response.ok) throw new Error("Thực hiện lưu hồ sơ thanh toán thất bại.");

      triggerSuccessMsg(isEdit ? "Cập nhật hồ sơ thanh toán thành công!" : "Thêm mới hồ sơ thanh toán NCC thành công!");
      setShowDossierModal(false);
      setIsEditingDossier(null);
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  const handleDeleteDossier = async (id: number) => {
    if (!confirm("Bạn có thực sự chắc chắn muốn xóa hồ sơ thanh toán này không?")) return;
    try {
      const response = await fetch(`/api/supplier-payment-dossiers/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Xóa hồ sơ thanh toán nhà cung cấp thất bại.");
      triggerSuccessMsg("Đã xóa hồ sơ thanh toán thành công!");
      loadAllData();
    } catch (err: any) {
      alert("Có lỗi: " + err.message);
    }
  };

  // Dossier compliance and workflow alerts aggregator
  const dossierAlerts = useMemo(() => {
    const today = new Date(getTodayString());
    let overdueEmail = 0;
    let overdueResponse = 0;
    let missingDocs = 0;
    let pendingAccounting = 0;

    supplierPaymentDossiers.forEach(d => {
      const recDate = new Date(d.received_date);
      const emailDate = d.hse_email_date ? new Date(d.hse_email_date) : null;
      
      const diffRecDays = Math.floor((today.getTime() - recDate.getTime()) / (24 * 3600 * 1000));
      const diffEmailDays = emailDate ? Math.floor((today.getTime() - emailDate.getTime()) / (24 * 3600 * 1000)) : 0;

      // 1. Overdue 3 days without emailing project
      if ((d.status === "Chưa gửi" || d.status === "Chờ duyệt") && !d.hse_email_date && diffRecDays > 3) {
        overdueEmail++;
      }

      // 2. Overdue 5 days without project response
      if (d.status === "Đã gửi dự án" && d.hse_email_date && !d.project_response_date && diffEmailDays > 5) {
        overdueResponse++;
      }

      // 3. Missing core checklist documents (has_invoice, has_delivery_note, has_ppe_request, has_quotation_po)
      if (!d.has_invoice || !d.has_delivery_note || !d.has_ppe_request || !d.has_quotation_po) {
        missingDocs++;
      }

      // 4. HSE checked/responded but not yet transferred to accounting
      if ((d.status === "Dự án đã phản hồi" || d.status === "HSE đã kiểm tra") && d.status !== "Đã chuyển kế toán" && d.status !== "Hoàn tất thanh toán" && !d.accounting_transfer_date) {
        pendingAccounting++;
      }
    });

    return {
      overdueEmail,
      overdueResponse,
      missingDocs,
      pendingAccounting,
      total: overdueEmail + overdueResponse + missingDocs + pendingAccounting
    };
  }, [supplierPaymentDossiers]);

  // 1. Filter deliveries for PPE report
  const filteredDeliveriesForReport = useMemo(() => {
    return deliveries.filter(d => {
      if (repFilterProject !== "Tất cả" && d.project !== repFilterProject) return false;
      if (repFilterSupplier !== "Tất cả" && d.supplier !== repFilterSupplier) return false;
      if (repFilterPpeType !== "Tất cả" && d.ppe_type !== repFilterPpeType) return false;
      if (repFilterCostCode !== "Tất cả" && d.cost_code !== repFilterCostCode) return false;
      if (repFilterFromDate && d.delivery_date < repFilterFromDate) return false;
      if (repFilterToDate && d.delivery_date > repFilterToDate) return false;
      if (d.delivery_date) {
        const parts = d.delivery_date.split('-');
        if (parts.length >= 2) {
          const y = parts[0];
          const m = parts[1];
          if (repFilterMonth !== "Tất cả" && m !== repFilterMonth) return false;
          if (repFilterYear !== "Tất cả" && y !== repFilterYear) return false;
        }
      }
      return true;
    });
  }, [deliveries, repFilterProject, repFilterSupplier, repFilterPpeType, repFilterCostCode, repFilterFromDate, repFilterToDate, repFilterMonth, repFilterYear]);

  // 2. Filter budget summary for budget report
  const filteredBudgetsForReport = useMemo(() => {
    return budgetSummary.filter(b => {
      if (repFilterProject !== "Tất cả" && b.project !== repFilterProject) return false;
      if (repFilterCostCode !== "Tất cả" && b.cost_code !== repFilterCostCode) return false;
      return true;
    });
  }, [budgetSummary, repFilterProject, repFilterCostCode]);

  // 3. Filter dossiers for payment dossier report
  const filteredDossiersForReport = useMemo(() => {
    return supplierPaymentDossiers.filter(d => {
      if (repFilterProject !== "Tất cả" && d.project_name !== repFilterProject) return false;
      if (repFilterSupplier !== "Tất cả" && d.supplier_name !== repFilterSupplier) return false;
      if (repFilterStatus !== "Tất cả" && d.status !== repFilterStatus) return false;
      if (repFilterFromDate && d.received_date < repFilterFromDate) return false;
      if (repFilterToDate && d.received_date > repFilterToDate) return false;
      if (d.received_date) {
        const parts = d.received_date.split('-');
        if (parts.length >= 2) {
          const y = parts[0];
          const m = parts[1];
          if (repFilterMonth !== "Tất cả" && m !== repFilterMonth) return false;
          if (repFilterYear !== "Tất cả" && y !== repFilterYear) return false;
        }
      }
      return true;
    });
  }, [supplierPaymentDossiers, repFilterProject, repFilterSupplier, repFilterStatus, repFilterFromDate, repFilterToDate, repFilterMonth, repFilterYear]);

  // Employee stats compiler for quota enforcement
  const employeeStats: Record<string, any> = useMemo(() => {
    const map: Record<string, {
      name: string;
      role: string;
      projects: Set<string>;
      records: PpeDelivery[];
      quotas: {
        aoGhile: { count: number; times: number; maxCount: number; maxTimes: number };
        giayJogger: { count: number; maxCount: number; isRoleMismatch: boolean };
        giayZiben: { count: number; maxCount: number; isRoleMismatch: boolean };
      }
    }> = {};

    deliveries.forEach(del => {
      if (!del.employee_name || !del.employee_name.trim()) return;
      const nameKey = del.employee_name.trim();
      const nameLower = nameKey.toLowerCase();
      const role = del.employee_role || "Công nhân / Khác";

      if (!map[nameLower]) {
        map[nameLower] = {
          name: nameKey,
          role: role,
          projects: new Set<string>(),
          records: [],
          quotas: {
            aoGhile: { count: 0, times: 0, maxCount: 6, maxTimes: 2 },
            giayJogger: { count: 0, maxCount: 4, isRoleMismatch: role !== "Kỹ sư" },
            giayZiben: { count: 0, maxCount: 2, isRoleMismatch: role !== "Chỉ huy trưởng / Giám đốc dự án" }
          }
        };
      }

      const emp = map[nameLower];
      emp.projects.add(del.project);
      emp.records.push(del);

      const delYear = del.delivery_date ? del.delivery_date.split("-")[0] : "2026";
      if (delYear === "2026") {
        if (del.ppe_type === "Áo ghi lê") {
          emp.quotas.aoGhile.count += del.quantity;
          emp.quotas.aoGhile.times += 1;
        } else if (del.ppe_type === "Giày Jogger") {
          emp.quotas.giayJogger.count += del.quantity;
        } else if (del.ppe_type === "Giày Ziben") {
          emp.quotas.giayZiben.count += del.quantity;
        }
      }
    });

    return map;
  }, [deliveries]);

  // Quota alerts feedback component
  const renderQuotaAlertsForm = (
    employeeName: string,
    employeeRole: string,
    ppeType: string,
    quantity: number,
    project: string
  ) => {
    if (!employeeName.trim()) return null;
    const nameLower = employeeName.trim().toLowerCase();
    const info = employeeStats[nameLower];

    const alerts: { type: 'error' | 'warning' | 'info'; text: string }[] = [];

    // 1. Project Transfer Detection
    if (info) {
      const hasWorkedElsewhere = Array.from(info.projects).some(p => p !== project);
      if (hasWorkedElsewhere) {
        alerts.push({
          type: 'info',
          text: `Phát hiện nhân sự điều chuyển: "${info.name}" có lịch sử nhận trang bị tại dự án khác (${Array.from(info.projects).join(", ")}). Hệ thống sẽ cộng dồn lịch sử cấp cũ vào định mức năm hiện tại.`
        });
      }
    }

    // 2. Áo ghi lê: 3 cái/lần cấp, 2 lần/năm
    if (ppeType === "Áo ghi lê") {
      if (quantity > 3) {
        alerts.push({
          type: 'error',
          text: `⚠️ Vượt định mức lần cấp: Chỉ được cấp tối đa 3 cái / lần cấp đối với Áo ghi lê (Yêu cầu hiện tại: ${quantity} cái).`
        });
      }

      if (info) {
        const currentTimes = info.quotas.aoGhile.times;
        if (currentTimes >= 2) {
          alerts.push({
            type: 'error',
            text: `🔴 Vượt định mức năm: Nhân sự đã nhận Áo ghi lê ${currentTimes} lần trong năm nay (Tối đa 2 lần/năm).`
          });
        }
      }
    }

    // 3. Giày Jogger: kỹ sư cấp [giày Jogger] [1 năm /4 đôi]
    if (ppeType === "Giày Jogger") {
      if (employeeRole !== "Kỹ sư") {
        alerts.push({
          type: 'warning',
          text: `⚠️ Thẻ chức vụ: Định mức giày Jogger chỉ quy định cho chức vụ "Kỹ sư" (Chức vụ hiện chọn: ${employeeRole}).`
        });
      }

      const currentCount = info ? info.quotas.giayJogger.count : 0;
      if (currentCount + quantity > 4) {
        alerts.push({
          type: 'error',
          text: `🔴 Vượt định mức năm: Tổng số Giày Jogger của kỹ sư vượt quá 4 đôi / năm (Đã nhận: ${currentCount} đôi. Muốn nhận thêm: ${quantity} đôi).`
        });
      }
    }

    // 4. Giày Ziben: [1 năm /2 đôi]
    if (ppeType === "Giày Ziben") {
      if (employeeRole !== "Chỉ huy trưởng / Giám đốc dự án") {
        alerts.push({
          type: 'warning',
          text: `⚠️ Thẻ chức vụ: Định mức giày Ziben chỉ quy định cho chức vụ "Chỉ huy trưởng / Giám đốc dự án" (Chức vụ hiện chọn: ${employeeRole}).`
        });
      }

      const currentCount = info ? info.quotas.giayZiben.count : 0;
      if (currentCount + quantity > 2) {
        alerts.push({
          type: 'error',
          text: `🔴 Vượt định mức năm: Tổng số Giày Ziben của Chỉ huy trưởng / Giám đốc dự án vượt quá 2 đôi / năm (Đã nhận: ${currentCount} đôi. Đề xuất: ${quantity} đôi).`
        });
      }
    }

    if (alerts.length === 0) return null;

    return (
      <div className="p-3 bg-slate-900 text-slate-100 rounded-lg space-y-2 mt-2 border border-slate-800 text-[11px] leading-relaxed">
        <p className="font-bold text-sky-400 flex items-center gap-1">
          <span>⚖️</span> HỆ THỐNG KIỂM TRA ĐỊNH MỨC CẤP PHÁT:
        </p>
        <div className="divide-y divide-slate-800">
          {alerts.map((al, idx) => (
            <div key={idx} className="py-1.5 first:pt-0 last:pb-0 flex items-start gap-1.5 py-1">
              <span>{al.type === 'error' ? '❌' : al.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
              <p className={al.type === 'error' ? 'text-rose-300 font-bold' : al.type === 'warning' ? 'text-amber-300 font-semibold' : 'text-sky-300'}>{al.text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Search and Filter logic for requests table
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const passProject = reqProjectFilter === "Tất cả" || req.project === reqProjectFilter;
      const passStatus = reqStatusFilter === "Tất cả" || req.status === reqStatusFilter;
      return passProject && passStatus;
    });
  }, [requests, reqProjectFilter, reqStatusFilter]);

  // Search and Filter logic for deliveries table
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(del => {
      const passProject = delProjectFilter === "Tất cả" || del.project === delProjectFilter;
      const query = delSearchQuery.toLowerCase().trim();
      const passSearch = !query ||
        del.delivery_note_no.toLowerCase().includes(query) ||
        del.supplier.toLowerCase().includes(query) ||
        (del.note || "").toLowerCase().includes(query) ||
        del.ppe_type.toLowerCase().includes(query);
      return passProject && passSearch;
    });
  }, [deliveries, delProjectFilter, delSearchQuery]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-sky-950 p-6 relative overflow-hidden font-sans">
        {/* Decorative background grid and ambient lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.15),transparent_60%)] pointer-events-none" />
        
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden relative border border-slate-100 flex flex-col p-8 z-10">
          <div className="flex flex-col items-center text-center pb-6">
            <div className="p-3 bg-sky-600 rounded-xl text-white shadow-lg mb-4">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-sky-950">Hệ thống Cấp phát PPE</h1>
            <p className="text-xs text-slate-500 mt-1">HSE Construction &bull; Đăng nhập hệ thống</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium flex items-center gap-1.5 animate-pulse">
                <span>⚠️</span> {loginError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tên đăng nhập:</label>
              <input
                type="text"
                placeholder="Ví dụ: admin, hse, staff"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mật khẩu:</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu (mặc định: password)"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs tracking-wide transition-all uppercase shadow-lg shadow-sky-600/25 active:scale-95"
            >
              Đăng nhập tài khoản
            </button>
          </form>

          {/* Account information hints */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-3">Tài khoản demo kiểm nghiệm:</p>
            <div className="grid grid-cols-1 gap-2 text-[11px] text-slate-600 font-medium">
              <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-sky-850 font-bold">🔑 Admin (Toàn quyền)</span>
                <span>admin / password</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-amber-700 font-bold">📋 HSE Admin (Duyệt/Ký)</span>
                <span>hse / password</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-emerald-700 font-bold">🔒 Staff (Chỉ Đọc)</span>
                <span>staff / password</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-sky-50 font-sans text-slate-800 antialiased">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-sky-900 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-sky-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-sky-500 rounded-lg text-white shadow-md shadow-sky-950/40">
              <Shield className="w-5 h-5" id="app-logo-icon" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white leading-none">HSE Construction</h1>
              <p className="text-[10px] text-sky-300 uppercase font-black tracking-wider mt-1">Quản lý Cấp phát PPE</p>
            </div>
          </div>
        </div>
        
        {/* Nav Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-xs font-semibold text-left transition-all ${
              activeTab === "dashboard"
                ? "bg-sky-800 text-white shadow-sm"
                : "text-sky-100 hover:bg-sky-850 hover:text-white"
            }`}
            id="tab-dashboard"
          >
            <span className="w-5 text-center text-sm">📊</span>
            <span>Tổng quan (Dashboard)</span>
          </button>

          <button
            onClick={() => setActiveTab("requests")}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-semibold text-left transition-all relative ${
              activeTab === "requests"
                ? "bg-sky-800 text-white shadow-sm"
                : "text-sky-100 hover:bg-sky-850 hover:text-white"
            }`}
            id="tab-requests"
          >
            <div className="flex items-center space-x-3">
              <span className="w-5 text-center text-sm">📋</span>
              <span>Phiếu Yêu Cầu (HSE Duyệt)</span>
            </div>
            {stats && stats.pendingRequests > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white ring-2 ring-sky-900">
                {stats.pendingRequests}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("deliveries")}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-semibold text-left transition-all ${
              activeTab === "deliveries"
                ? "bg-sky-800 text-white shadow-sm"
                : "text-sky-100 hover:bg-sky-850 hover:text-white"
            }`}
            id="tab-deliveries"
          >
            <div className="flex items-center space-x-3">
              <span className="w-5 text-center text-sm">➕</span>
              <span>Nhập Cấp Phát & BBGH</span>
            </div>
            {linkedRequest && (
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("quotas")}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-semibold text-left transition-all ${
              activeTab === "quotas"
                ? "bg-sky-800 text-white shadow-sm"
                : "text-sky-100 hover:bg-sky-850 hover:text-white"
            }`}
            id="tab-quotas"
          >
            <div className="flex items-center space-x-3">
              <span className="w-5 text-center text-sm">⚖️</span>
              <span>Định Mức & Điều Chuyển</span>
            </div>
            {/* Show attention badge on quota warning */}
            {Object.values(employeeStats).some(emp => 
              emp.quotas.aoGhile.times > emp.quotas.aoGhile.maxTimes ||
              emp.quotas.giayJogger.count > emp.quotas.giayJogger.maxCount ||
              emp.quotas.giayZiben.count > emp.quotas.giayZiben.maxCount
            ) && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 ring-2 ring-sky-900 border-none animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("budgets")}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-semibold text-left transition-all ${
              activeTab === "budgets"
                ? "bg-sky-800 text-white shadow-sm"
                : "text-sky-100 hover:bg-sky-850 hover:text-white"
            }`}
            id="tab-budgets"
          >
            <div className="flex items-center space-x-3">
              <span className="w-5 text-center text-sm">💰</span>
              <span>Ngân Sách & Thanh Toán</span>
            </div>
            {budgetSummary.some(b => b.pct_used >= 100) && (
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 ring-2 ring-sky-900 border-none animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("paymentDossiers")}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-semibold text-left transition-all ${
              activeTab === "paymentDossiers"
                ? "bg-sky-800 text-white shadow-sm"
                : "text-sky-100 hover:bg-sky-850 hover:text-white"
            }`}
            id="tab-paymentdossiers"
          >
            <div className="flex items-center space-x-3">
              <span className="w-5 text-center text-sm">📑</span>
              <span>Thanh Toán NCC</span>
            </div>
            {dossierAlerts.total > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-rose-600 rounded-full text-[10px] font-black text-white shrink-0 ring-2 ring-sky-900 border-none animate-pulse leading-none">
                {dossierAlerts.total}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-xs font-semibold text-left transition-all ${
              activeTab === "reports"
                ? "bg-sky-800 text-white shadow-sm"
                : "text-sky-100 hover:bg-sky-850 hover:text-white"
            }`}
            id="tab-reports"
          >
            <span className="w-5 text-center text-sm">📈</span>
            <span>Báo cáo Xuất Excel</span>
          </button>

          <button
            onClick={() => setActiveTab("deploy")}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-xs font-semibold text-left transition-all ${
              activeTab === "deploy"
                ? "bg-sky-800 text-white shadow-sm"
                : "text-sky-100 hover:bg-sky-800/50 hover:text-white"
            }`}
            id="tab-deploy"
          >
            <span className="w-5 text-center text-sm">🚀</span>
            <span>Deploy Render</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-xs font-semibold text-left transition-all ${
              activeTab === "settings"
                ? "bg-sky-800 text-white shadow-sm"
                : "text-sky-100 hover:bg-sky-850 hover:text-white"
            }`}
            id="tab-settings"
          >
            <span className="w-5 text-center text-sm">⚙️</span>
            <span>Cài đặt hệ thống (Admin)</span>
          </button>
        </nav>

        {/* User profile info with Interactive Role Switcher */}
        <div className="p-4 bg-sky-950 text-xs shrink-0 border-t border-sky-900/40">
          <div className="flex items-center space-x-3 mb-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow-md ${
              currentUserRole === "Admin" ? "bg-amber-600" : currentUserRole === "HSE" ? "bg-sky-600" : "bg-slate-500"
            }`}>
              {currentUserRole === "Admin" ? "AD" : currentUserRole === "HSE" ? "HS" : "ST"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white truncate">{currentUserRole === "Admin" ? "Quản trị viên" : currentUserRole === "HSE" ? "Cán bộ HSE" : "Nhân sự kiểm duyệt"}</p>
              <p className="text-sky-400 text-[10px] truncate font-mono">{currentUserName}</p>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-[9px] font-bold text-sky-450 uppercase tracking-wider mb-0.5">Chuyển đổi vai trò tài khoản:</label>
            <select
              value={currentUserRole}
              onChange={(e) => {
                const r = e.target.value as "Admin" | "HSE" | "Staff";
                setCurrentUserRole(r);
                if (r === "Admin") setCurrentUserName("HSE Admin");
                else if (r === "HSE") setCurrentUserName("Nguyễn Văn A");
                else setCurrentUserName("Nhân viên thường");
              }}
              className="w-full text-[11px] p-2 bg-sky-900/60 text-white border border-sky-850 rounded focus:outline-none focus:border-sky-500 font-semibold cursor-pointer mb-2"
            >
              <option value="Admin" className="bg-sky-950 text-white">🔑 Admin (Toàn quyền)</option>
              <option value="HSE" className="bg-sky-950 text-white">📋 HSE Admin (Duyệt/Ký)</option>
              <option value="Staff" className="bg-sky-950 text-white">🔒 Staff (Chỉ Đọc Thôi)</option>
            </select>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-1.5 bg-red-600/85 hover:bg-red-700 text-white text-[10px] font-bold rounded transition-all border border-red-700/50 flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>🚪</span> Đăng xuất hệ thống
          </button>
        </div>
      </aside>

      {/* MAIN LAYOUT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-sky-50">
        
        {/* Topbar Header */}
        <header className="h-16 bg-white border-b border-sky-100 flex items-center justify-between px-8 shrink-0 shadow-sm z-30">
          <h2 className="text-base font-bold text-sky-900 tracking-tight">Hệ thống Quản lý và Điều phối PPE trực tiếp</h2>
          
          <div className="flex items-center space-x-4">
            {loading ? (
              <span className="text-xs text-sky-600 flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang cập nhật...
              </span>
            ) : (
              <button 
                onClick={loadAllData} 
                className="text-xs text-sky-700 hover:text-sky-900 flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-sky-50 border border-sky-100 transition font-semibold"
                title="Đồng bộ lại cơ sở dữ liệu từ máy chủ"
                id="btn-sync-db"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ DB
              </button>
            )}
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Hệ thống Sẵn sàng</span>
          </div>
        </header>

        {/* NOTIFICATIONS CONTAINER */}
        {successMsg && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white rounded-lg shadow-xl border border-slate-800 p-4 transform transition-all duration-300 flex items-start space-x-3 animate-bounce">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs text-white">Hệ thống ghi nhận</p>
              <p className="text-[11px] text-slate-350 mt-0.5">{successMsg}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border-b border-rose-100 py-2 px-4 shrink-0 text-center">
            <div className="max-w-7xl mx-auto flex items-center justify-center space-x-2 text-rose-800 text-[11px] font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
              <button onClick={loadAllData} className="underline ml-2 hover:text-rose-900 font-bold direct-action">Tải lại</button>
            </div>
          </div>
        )}

        {/* MAIN BODY AREA WITH SCROLLS */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          
          {/* =========================================
               TAB 1: DASHBOARD
             ========================================= */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Quick Info Bar */}
              <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm flex items-start space-x-3">
                <span className="text-lg">📢</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-bold text-sky-900">Quy trình cấp nộp an toàn:</span> Dự án lập Phiếu Yêu Cầu &rarr; HSE duyệt &rarr; Vendor chuyển giao trực tiếp xuống chân công trình &rarr; HSE ghi nhận Số Biên Bản Giao Hàng (BBGH) thực tế để lưu dấu dữ liệu SQLite.
                </p>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-white p-4 rounded-xl shadow-sm border border-sky-100">
                  <p className="text-xs text-slate-500 uppercase font-bold">Tổng PPE Đã Cấp</p>
                  <p className="text-2xl font-bold text-sky-700 mt-1">{stats?.totalDelivered || 0}</p>
                  <p className="text-[10px] text-green-600 mt-1">↑ Đã nhận tại công trình</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-sky-100">
                  <p className="text-xs text-slate-500 uppercase font-bold">Dự án Xây Dựng</p>
                  <p className="text-2xl font-bold text-sky-700 mt-1">{projects.length}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Hoạt động từ Dự án A đến E</p>
                </div>

                <div 
                  onClick={() => setActiveTab("requests")}
                  className="bg-white p-4 rounded-xl shadow-sm border border-sky-100 cursor-pointer hover:border-amber-300 transition-colors"
                >
                  <p className="text-xs text-slate-500 uppercase font-bold">Yêu cầu Chờ Duyệt</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{stats?.pendingRequests || 0}</p>
                  <p className="text-[10px] text-amber-600 font-semibold mt-1">⚠️ Cần xử lý sớm trong ngày</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-sky-100">
                  <p className="text-xs text-slate-500 uppercase font-bold">PPE Cấp Trong Tháng</p>
                  <p className="text-2xl font-bold text-sky-700 mt-1">{stats?.approvedRequests || 0}</p>
                  <p className="text-[10px] text-sky-400 mt-1">Chờ biên bản giao nhận</p>
                </div>

              </div>

              {/* Graphical Layout Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Month chart */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-sky-100 flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-sky-50 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-sky-900 text-sm">Biểu đồ cấp phát theo tháng</h3>
                    <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-100">Đơn vị: Cái</span>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col justify-center min-h-[220px]">
                    {stats && stats.byMonth && stats.byMonth.length > 0 ? (
                      <div className="flex items-end justify-between h-40 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl px-6 pb-2 pt-6">
                        {stats.byMonth.map((item, idx) => {
                          const maxCount = Math.max(...stats.byMonth.map(m => m.count), 1);
                          const percentHeight = Math.round((item.count / maxCount) * 100);
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center group max-w-[60px] mx-2">
                              <span className="text-[9px] font-bold text-sky-700 mb-1 opacity-0 group-hover:opacity-100 transition duration-150">
                                {item.count}
                              </span>
                              <div 
                                className="w-6 bg-sky-500 hover:bg-sky-600 rounded-t transition-all duration-300 shadow-sm"
                                style={{ height: `${Math.max(percentHeight, 5)}%` }}
                              />
                              <span className="text-[10px] font-bold text-slate-500 mt-2 font-mono">{item.month}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-10 text-slate-400 text-xs">
                        Chưa ghi nhận số liệu cấp tháng. Hãy hoàn tất Biên bản giao hàng đầu tiên!
                      </div>
                    )}
                  </div>
                </div>

                {/* Project rankings */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-sky-100 flex flex-col">
                  <h3 className="font-bold text-sky-900 text-sm mb-3">Phân bổ PPE theo Loại & Dự án</h3>
                  
                  <div className="space-y-3.5 flex-1 justify-center flex flex-col">
                    {stats && stats.byProject && stats.byProject.length > 0 ? (
                      stats.byProject.map((item, index) => {
                        const totalUnits = stats.totalDelivered || 1;
                        const percentShare = Math.round((item.count / totalUnits) * 100);
                        return (
                          <div key={item.project} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${
                                  index === 0 ? "bg-sky-600" : index === 1 ? "bg-sky-400" : "bg-slate-350"
                                }`} />
                                {item.project}
                              </span>
                              <span className="font-black text-sky-900">
                                {item.count} <span className="text-[9px] font-normal text-slate-400">cái ({percentShare}%)</span>
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  index === 0 ? "bg-sky-600" : index === 1 ? "bg-sky-400" : "bg-slate-350"
                                }`}
                                style={{ width: `${percentShare}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 text-center">Chưa có dữ liệu dự án.</p>
                    )}
                  </div>
                </div>

              </div>

              {/* PPE Categories horizontal list */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-sky-100">
                <h3 className="font-bold text-sky-900 text-sm mb-3">Thống kê theo phân loại trang bị PPE đã cấp phát</h3>
                {stats && stats.byPpeType && stats.byPpeType.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {stats.byPpeType.map((item) => (
                      <div key={item.type} className="p-3 bg-sky-50/50 rounded-lg border border-sky-100/50 flex flex-col justify-between">
                        <p className="text-[10px] font-bold text-slate-500 truncate">{item.type}</p>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-base font-black text-slate-900">{item.count} <span className="text-[9px] font-normal text-slate-400">cái</span></span>
                          <span className="text-[8px] text-sky-600 bg-sky-100/60 px-1 rounded font-bold">ĐÃ GIAO</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Không tìm thấy phân khối dữ liệu.</p>
                )}
              </div>

              {/* HSE Reminder layout matching mockup */}
              <div className="bg-sky-900 text-white p-5 rounded-xl shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-sky-200">Nhắc nhở HSE Office</h3>
                  <ul className="text-[11px] text-sky-100 space-y-1 list-disc pl-4 opacity-90">
                    <li>Kiểm tra Biên bản giao hàng (BBGH) từ các Dự án liên kết cho đợt tuyển phát mới.</li>
                    <li>Cần xuất báo cáo định lượng Excel và đồng bộ hóa cơ sở dữ liệu hàng tuần.</li>
                  </ul>
                </div>
                <button 
                  onClick={() => setActiveTab("requests")}
                  className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 rounded-lg text-xs font-bold transition-all text-white shadow shadow-sky-950/40 shrink-0 select-none cursor-pointer"
                  id="btn-goto-requests"
                >
                  Tạo Phiếu Đề Xuất & Duyệt PPE Mới
                </button>
              </div>

            </div>
          )}


          {/* =========================================
               TAB 2: REQUESTS (Phiếu yêu cầu)
             ========================================= */}
          {activeTab === "requests" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
              
              {/* Form card */}
              <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-sky-100 shadow-sm self-start">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-1 bg-slate-50 -mx-5 -mt-5 p-4 rounded-t-xl border-b border-sky-50 text-sky-900">
                  <span>➕</span> Gửi Đề xuất PPE mới
                </h3>
                
                <form onSubmit={handleSubmitRequest} className="space-y-3.5 mt-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dự án yêu cầu *</label>
                    <select 
                      value={reqForm.project}
                      onChange={(e) => setReqForm({ ...reqForm, project: e.target.value })}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                      id="req-project-select"
                    >
                      {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Employee Name Input with live database roster autocomplete */}
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nhân sự thụ hưởng *</label>
                    <input 
                      type="text"
                      placeholder="Họ và tên nhân viên (VD: Trần Quốc Bảo)"
                      value={reqForm.employee_name}
                      onChange={(e) => setReqForm({ ...reqForm, employee_name: e.target.value })}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                      required
                      id="req-emp-name-input"
                    />
                    
                    {/* Inline search recommendation box */}
                    {reqForm.employee_name && Object.keys(employeeStats).filter(k => k.includes(reqForm.employee_name.toLowerCase()) && employeeStats[k].name !== reqForm.employee_name).length > 0 && (
                      <div className="absolute left-0 right-0 z-30 mt-1 max-h-36 overflow-y-auto bg-slate-900 text-slate-100 rounded shadow-lg text-[11px] border border-slate-800 divide-y divide-slate-850">
                        {Object.keys(employeeStats)
                          .filter(k => k.includes(reqForm.employee_name.toLowerCase()))
                          .map(k => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setReqForm({ ...reqForm, employee_name: employeeStats[k].name, employee_role: employeeStats[k].role })}
                              className="w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors flex justify-between items-center"
                            >
                              <span className="font-bold text-sky-300">{employeeStats[k].name}</span>
                              <span className="text-[10px] text-slate-400 italic">({employeeStats[k].role})</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chức vụ nhân sự *</label>
                    <select 
                      value={reqForm.employee_role}
                      onChange={(e) => setReqForm({ ...reqForm, employee_role: e.target.value })}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500 font-medium"
                      id="req-emp-role-select"
                    >
                      {employeeRoles.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Loại trang bị PPE *</label>
                    <select 
                      value={reqForm.ppe_type}
                      onChange={(e) => setReqForm({ ...reqForm, ppe_type: e.target.value })}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                      id="req-ppetype-select"
                    >
                      {ppeTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số lượng *</label>
                      <input 
                        type="number"
                        value={reqForm.quantity}
                        onChange={(e) => {
                          const qty = Number(e.target.value);
                          setReqForm(prev => ({
                            ...prev,
                            quantity: qty,
                            amount: qty * prev.unit_price
                          }));
                        }}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500 font-bold"
                        min={1}
                        required
                        id="req-qty-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngày lập phiếu *</label>
                      <input 
                        type="date"
                        value={reqForm.req_date}
                        onChange={(e) => setReqForm({ ...reqForm, req_date: e.target.value })}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500 font-mono"
                        required
                        id="req-date-input"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-55 p-3 rounded-lg border border-sky-150 shadow-inner">
                    <div className="col-span-3">
                      <label className="block text-[10px] font-black text-sky-900 uppercase tracking-wide mb-1 flex items-center">
                        <span className="mr-1">💰</span> Mã ngân sách quản lý
                      </label>
                      <select 
                        value={reqForm.cost_code}
                        onChange={(e) => setReqForm({ ...reqForm, cost_code: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-md focus:outline-none font-semibold text-slate-700"
                        id="req-costcode-select"
                      >
                        {COST_CODES.map(c => (
                          <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Đơn giá dự kiến (VNĐ)</label>
                      <input 
                        type="number"
                        placeholder="0"
                        value={reqForm.unit_price}
                        onChange={(e) => {
                          const up = Number(e.target.value);
                          setReqForm(prev => ({
                            ...prev,
                            unit_price: up,
                            amount: prev.quantity * up
                          }));
                        }}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-md focus:outline-none font-mono"
                        min={0}
                        id="req-uprice-input"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dự toán</label>
                      <div className="w-full text-center text-xs font-black p-2 bg-sky-100 border border-sky-200 rounded-md text-sky-950 truncate">
                        {(reqForm.quantity * reqForm.unit_price).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ghi chú chi tiết</label>
                    <textarea 
                      value={reqForm.note}
                      onChange={(e) => setReqForm({ ...reqForm, note: e.target.value })}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500 h-16 resize-none"
                      placeholder="Mục đích cấp phát (VD: bổ sung thiết bị móng hầm)"
                      id="req-note-textarea"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Đính kèm tài liệu (Phiếu Đề xuất/Hình ảnh/Excel)</label>
                    <div className="flex flex-col gap-1">
                      <input 
                        type="file" 
                        accept=".png,.jpg,.jpeg,.pdf,.xlsx,.xls"
                        onChange={(e) => handleFileChange(e, true)}
                        className="text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200 cursor-pointer w-full"
                        id="req-file-input"
                      />
                      {reqForm.attachment_name && (
                        <div className="flex items-center justify-between bg-sky-50 text-sky-950 p-1.5 px-2.5 text-[11px] rounded border border-sky-150 mt-1">
                          <span className="truncate max-w-[190px]" title={reqForm.attachment_name}>📎 {reqForm.attachment_name}</span>
                          <button 
                            type="button" 
                            onClick={() => setReqForm({ ...reqForm, attachment_data: null, attachment_name: null, attachment_type: null })}
                            className="text-rose-600 hover:text-rose-800 font-bold ml-1 cursor-pointer"
                          >
                            Gỡ bỏ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quota Compliance Live Checks */}
                  {renderQuotaAlertsForm(reqForm.employee_name, reqForm.employee_role, reqForm.ppe_type, reqForm.quantity, reqForm.project)}

                  <button 
                    type="submit" 
                    className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-bold shadow-sm transition-colors cursor-pointer mt-2"
                    id="btn-submit-request"
                  >
                    Gửi Phiếu Yêu Cầu Cho HSE
                  </button>
                </form>
              </div>

              {/* Table card */}
              <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-sky-100 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-sky-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50">
                  <div>
                    <h3 className="font-bold text-sky-900 text-sm">Danh sách phiếu đề bạt từ Công trường</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">HSE Office thực hiện việc hậu duyệt biên bản hoặc đẩy lên danh sách BBGH</p>
                  </div>

                  {/* Filter elements inside standard select tags */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <select
                      value={reqProjectFilter}
                      onChange={(e) => setReqProjectFilter(e.target.value)}
                      className="text-[11px] p-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-sky-500 font-medium text-slate-700"
                      id="filter-req-project"
                    >
                      <option value="Tất cả">Mọi Dự án</option>
                      {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    <select
                      value={reqStatusFilter}
                      onChange={(e) => setReqStatusFilter(e.target.value)}
                      className="text-[11px] p-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-sky-500 font-medium text-slate-700"
                      id="filter-req-status"
                    >
                      <option value="Tất cả">Mọi Trạng thái</option>
                      <option value="Chờ duyệt">Chờ duyệt</option>
                      <option value="Đã duyệt">Đã duyệt (Chờ giao)</option>
                      <option value="Từ chối">Từ chối</option>
                      <option value="Đã giao hàng">Đã giao hàng</option>
                    </select>
                  </div>
                </div>

                {/* Table contents */}
                {filteredRequests.length > 0 ? (
                  <div className="overflow-auto flex-1 max-h-[480px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-sky-55 text-sky-900 uppercase sticky top-0 bg-slate-100/80 backdrop-blur font-bold border-b border-sky-100">
                        <tr>
                          <th className="p-3 text-center w-12">Mã YC</th>
                          <th className="p-3">Ngày Lập</th>
                          <th className="p-3">Dự án</th>
                          <th className="p-3">Nhân sự thụ hưởng</th>
                          <th className="p-3">Loại Thiết Bị PPE</th>
                          <th className="p-3 text-center">Số lượng</th>
                          <th className="p-3">Trạng thái</th>
                          <th className="p-3 text-right">Hệ thống xử lý</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sky-100/50">
                        {filteredRequests.map((req) => (
                          <tr key={req.id} className="hover:bg-sky-50/20 transition-colors">
                            <td className="p-3 text-center font-mono text-[10px] text-slate-400">#{req.id}</td>
                            <td className="p-3 font-mono text-[10px] text-slate-500">{req.req_date}</td>
                            <td className="p-3">
                              <div className="font-bold text-slate-800">{req.project}</div>
                              <div className="text-[10px] text-sky-700 font-bold font-mono">Mã BP: {req.cost_code || "9.07.02"}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-900 flex items-center gap-1 flex-wrap">
                                <span>{req.employee_name || "Công cộng / Dự án"}</span>
                                {req.attachment_name && (
                                  <a
                                    href={req.attachment_data}
                                    download={req.attachment_name}
                                    className="inline-flex items-center gap-0.5 text-[9px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-1.5 py-0.5 rounded transition select-none leading-none"
                                    title={`Tải xuống tài liệu: ${req.attachment_name}`}
                                  >
                                    📎 Tải file
                                  </a>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">{req.employee_role || "-"}</div>
                            </td>
                            <td className="p-3">
                              <div className="text-slate-705 font-medium">{req.ppe_type}</div>
                              {(req.unit_price || req.amount) ? (
                                <div className="text-[10px] text-emerald-700 font-bold font-mono">
                                  Thành tiền: {(req.amount || (req.unit_price * req.quantity)).toLocaleString()} đ
                                </div>
                              ) : null}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-900 text-sm">{req.quantity}</td>
                            <td className="p-3">
                              {req.status === "Chờ duyệt" && (
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-bold border border-amber-200">
                                  Chờ duyệt
                                </span>
                              )}
                              {req.status === "Đã duyệt" && (
                                <span className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-[10px] font-bold border border-sky-200">
                                  Đã duyệt
                                </span>
                              )}
                              {req.status === "Từ chối" && (
                                <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold border border-rose-200">
                                  Từ chối
                                </span>
                              )}
                              {req.status === "Đã giao hàng" && (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-200">
                                  Đã giao
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {req.status === "Chờ duyệt" && (
                                <div className="inline-flex space-x-1.5 justify-end">
                                  <button
                                    onClick={() => handleUpdateReqStatus(req.id, "Đã duyệt")}
                                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[10px] font-bold transition-all cursor-pointer shadow-sm"
                                  >
                                    Duyệt
                                  </button>
                                  <button
                                    onClick={() => handleUpdateReqStatus(req.id, "Từ chối")}
                                    className="px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded text-[10px] font-bold transition-all cursor-pointer shadow-sm"
                                  >
                                    Từ chối
                                  </button>
                                </div>
                              )}

                              {req.status === "Đã duyệt" && (
                                <button
                                  onClick={() => startDeliveryFromRequest(req)}
                                  className="px-3 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                                  title="Kiến tạo Biên bản Giao Hàng BBGH liên kết"
                                >
                                  Lập BBGH
                                </button>
                              )}

                              {req.status === "Từ chối" && (
                                <span className="text-[10px] text-slate-400 italic">Phiếu bị hủy</span>
                              )}

                              {req.status === "Đã giao hàng" && (
                                <span className="text-[10px] text-emerald-600 font-bold">✓ Hoàn tất</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center p-16 text-slate-400 text-xs">
                    Không tìm thấy Phiếu đề xuất nào khớp bộ lọc.
                  </div>
                )}
              </div>

            </div>
          )}


          {/* =========================================
               TAB 3: DELIVERIES (Biên bản giao hàng)
             ========================================= */}
          {activeTab === "deliveries" && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Delivery Input Forms */}
              <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-sm">
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-sky-50 pb-3 mb-4">
                  <div>
                    <h3 className="font-bold text-sky-900 text-sm">Ghi nhận Biên Bản Giao Hàng (BBGH) từ Vendor</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Xác nhận khối lượng PPE thực nhận bàn giao tại chân công trường xây dựng</p>
                  </div>

                  {linkedRequest && (
                    <div className="px-3 py-1 bg-sky-600 rounded border border-sky-700 text-white text-[11px] font-bold flex items-center space-x-2 animate-pulse">
                      <span>Mã phiếu liên kết: #{linkedRequest.id} &middot; {linkedRequest.project}</span>
                      <button 
                        onClick={() => setLinkedRequest(null)}
                        className="p-0.5 px-1 bg-sky-800 hover:bg-sky-900 text-white text-[9px] uppercase font-black tracking-widest rounded transition-all ml-1"
                      >
                        HỦY LIÊN KẾT (TỰ DO)
                      </button>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmitDelivery} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Số BBGH nhà sản xuất *</label>
                    <input 
                      type="text"
                      placeholder="VD: BBGH-9981-2026"
                      value={delForm.delivery_note_no}
                      onChange={(e) => setDelForm({ ...delForm, delivery_note_no: e.target.value })}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500 font-mono"
                      required
                      id="del-noteno-input"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Dự án bàn giao *</label>
                    <select 
                      value={delForm.project}
                      onChange={(e) => setDelForm({ ...delForm, project: e.target.value })}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                      disabled={!!linkedRequest}
                      id="del-project-select"
                    >
                      {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Employee Name in Deliveries */}
                  <div className="relative">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Nhân sự thụ hưởng *</label>
                    <input 
                      type="text"
                      placeholder="Họ tên nhân viên"
                      value={delForm.employee_name}
                      onChange={(e) => setDelForm({ ...delForm, employee_name: e.target.value })}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500 font-bold"
                      disabled={!!linkedRequest}
                      required
                      id="del-employee-name-input"
                    />
                    {/* Roster Suggestions */}
                    {!linkedRequest && delForm.employee_name && Object.keys(employeeStats).filter(k => k.includes(delForm.employee_name.toLowerCase()) && employeeStats[k].name !== delForm.employee_name).length > 0 && (
                      <div className="absolute left-0 right-0 z-30 mt-1 max-h-36 overflow-y-auto bg-slate-900 text-slate-100 rounded shadow-lg text-[11px] border border-slate-800 divide-y divide-slate-850">
                        {Object.keys(employeeStats)
                          .filter(k => k.includes(delForm.employee_name.toLowerCase()))
                          .map(k => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setDelForm({ ...delForm, employee_name: employeeStats[k].name, employee_role: employeeStats[k].role })}
                              className="w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors flex justify-between items-center"
                            >
                              <span className="font-bold text-sky-300">{employeeStats[k].name}</span>
                              <span className="text-[10px] text-slate-400 italic">({employeeStats[k].role})</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Chức vụ nhân sự *</label>
                    <select 
                      value={delForm.employee_role}
                      onChange={(e) => setDelForm({ ...delForm, employee_role: e.target.value })}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                      disabled={!!linkedRequest}
                      id="del-employee-role-select"
                    >
                      {employeeRoles.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Thiết bị PPE xuất kho *</label>
                    <select 
                      value={delForm.ppe_type}
                      onChange={(e) => setDelForm({ ...delForm, ppe_type: e.target.value })}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                      disabled={!!linkedRequest}
                      id="del-ppetype-select"
                    >
                      {ppeTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                   <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Số lượng bàn giao *</label>
                    <input 
                      type="number"
                      value={delForm.quantity}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        setDelForm(prev => ({
                          ...prev,
                          quantity: qty,
                          amount: qty * prev.unit_price
                        }));
                      }}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500 font-black text-sky-900"
                      min={1}
                      required
                      id="del-qty-input"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Đối sánh Mã ngân sách ATLĐ *</label>
                    <select 
                      value={delForm.cost_code}
                      onChange={(e) => setDelForm({ ...delForm, cost_code: e.target.value })}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:outline-none text-slate-700 font-bold"
                      id="del-costcode-select"
                    >
                      {COST_CODES.map(c => (
                        <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Đơn giá thực tế (VNĐ)</label>
                    <input 
                      type="number"
                      placeholder="Nhập đơn giá..."
                      value={delForm.unit_price}
                      onChange={(e) => {
                        const up = Number(e.target.value);
                        setDelForm(prev => ({
                          ...prev,
                          unit_price: up,
                          amount: prev.quantity * up
                        }));
                      }}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500 font-mono font-semibold"
                      min={0}
                      id="del-uprice-input"
                    />
                    {(!delForm.unit_price || delForm.unit_price === 0) && (
                      <div className="text-[10px] text-amber-600 bg-amber-50 p-1 px-2 rounded border border-amber-200 mt-1 flex items-center gap-1 font-semibold animate-pulse">
                        ⚠️ Chưa thiết lập đơn giá cho trang bị này!
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Thành tiền phát sinh (VNĐ)</label>
                    <div className="w-full text-xs p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-950 font-black rounded truncate">
                      {(delForm.quantity * delForm.unit_price).toLocaleString()} VNĐ
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Ngày giao thực nhận *</label>
                    <input 
                      type="date"
                      value={delForm.delivery_date}
                      onChange={(e) => setDelForm({ ...delForm, delivery_date: e.target.value })}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500 font-mono"
                      required
                      id="del-date-input"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide">Nhà cung cấp dán nhãn *</label>
                      <button
                        type="button"
                        onClick={() => setShowQuickAddSupplier(!showQuickAddSupplier)}
                        className="text-[9px] text-sky-600 hover:text-sky-800 font-extrabold flex items-center space-x-0.5 uppercase cursor-pointer"
                      >
                        <span>{showQuickAddSupplier ? "[Đóng]" : "+ Thêm nhanh"}</span>
                      </button>
                    </div>

                    {showQuickAddSupplier ? (
                      <div className="bg-slate-50 p-2 border border-slate-200 rounded space-y-1.5 animate-fade-in/70">
                        <input
                          type="text"
                          placeholder="Tên nhà cung cấp mới..."
                          value={quickSupplierName}
                          onChange={(e) => setQuickSupplierName(e.target.value)}
                          className="w-full text-[11px] p-1.5 bg-white border border-slate-300 rounded focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleQuickAddSupplier}
                          className="w-full py-1 text-[10px] bg-sky-600 hover:bg-sky-700 text-white font-bold rounded transition-all"
                        >
                          Lưu & Chọn Ngay
                        </button>
                      </div>
                    ) : (
                      <select 
                        value={delForm.supplier}
                        onChange={(e) => setDelForm({ ...delForm, supplier: e.target.value })}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500 text-slate-800 font-semibold"
                        required
                        id="del-supplier-select"
                      >
                        {suppliers.map(s => (
                          <option key={s.id} value={s.name}>
                            {s.name} {s.status === "Ngừng sử dụng" ? "(Ngừng sử dụng)" : ""}
                          </option>
                        ))}
                        {suppliers.length === 0 && <option value="">--- Không có NCC ---</option>}
                      </select>
                    )}

                    {/* Quick suggestion tags of active suppliers */}
                    {!showQuickAddSupplier && suppliers.length > 0 && (
                      <div className="flex gap-1 mt-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
                        <span className="text-[9px] text-slate-400 font-bold shrink-0 self-center">Chọn nhanh:</span>
                        {suppliers.slice(0, 4).map(s => (
                          <button 
                            key={s.id} 
                            type="button"
                            onClick={() => setDelForm({ ...delForm, supplier: s.name })}
                            className={`text-[9px] px-1.5 py-0.5 rounded transition shrink-0 font-medium cursor-pointer ${
                              delForm.supplier === s.name 
                                ? "bg-sky-600 text-white font-bold animation-all" 
                                : "bg-slate-100 hover:bg-sky-100 text-slate-600"
                            }`}
                          >
                            {s.name.replace("Công ty ", "").replace("Bảo hộ lao động ", "")}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Ghi chú giao nhận</label>
                    <input 
                      type="text"
                      value={delForm.note}
                      placeholder="Gói kỹ ni lông, giao kèm hướng dẫn, v.v..."
                      onChange={(e) => setDelForm({ ...delForm, note: e.target.value })}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                      id="del-note-input"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Đính kèm Biên Bản Giao Hàng (Ký nhận/Hình ảnh/PDF)</label>
                    <div className="flex flex-col gap-1">
                      <input 
                        type="file" 
                        accept=".png,.jpg,.jpeg,.pdf,.xlsx,.xls"
                        onChange={(e) => handleFileChange(e, false)}
                        className="text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200 cursor-pointer w-full"
                        id="del-file-input"
                      />
                      {delForm.attachment_name && (
                        <div className="flex items-center justify-between bg-sky-50 text-sky-950 p-1.5 px-2.5 text-[11px] rounded border border-sky-150 mt-1">
                          <span className="truncate max-w-[280px]" title={delForm.attachment_name}>📎 {delForm.attachment_name}</span>
                          <button 
                            type="button" 
                            onClick={() => setDelForm({ ...delForm, attachment_data: null, attachment_name: null, attachment_type: null })}
                            className="text-rose-600 hover:text-rose-800 font-bold ml-1 cursor-pointer"
                          >
                            Gỡ bỏ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Double checks render in Deliveries Form too */}
                  <div className="md:col-span-4 select-none">
                    {renderQuotaAlertsForm(delForm.employee_name, delForm.employee_role, delForm.ppe_type, delForm.quantity, delForm.project)}
                  </div>

                  <div className="md:col-span-4 pt-3 border-t border-sky-50 flex justify-end">
                    <button 
                      type="submit" 
                      className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-bold transition-all shadow-sm cursor-pointer"
                      id="btn-save-delivery"
                    >
                      {editingDeliveryId ? "Cập nhật Biên Bản Giao Hàng" : "Lưu Biên Bản Thực Giao Lên SQLite"}
                    </button>
                  </div>

                </form>

              </div>

              {/* History Deliveries Table */}
              <div className="bg-white rounded-xl shadow-sm border border-sky-100 overflow-hidden flex flex-col">
                
                <div className="p-4 border-b border-sky-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50">
                  <div>
                    <h3 className="font-bold text-sky-900 text-sm">Lịch sử cấp phát và biên bản chi tiết</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Thời gian thực, hiển thị mọi thông tin giao vận từ các nhà cung ứng PPE</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px]">🔍</span>
                      <input 
                        type="text" 
                        placeholder="Số BBGH, Nhà cung cấp..."
                        value={delSearchQuery}
                        onChange={(e) => setDelSearchQuery(e.target.value)}
                        className="text-[11px] p-1.5 pl-7 bg-white border border-slate-200 rounded focus:outline-none focus:border-sky-500 w-44 font-medium"
                        id="search-del"
                      />
                    </div>

                    <select
                      value={delProjectFilter}
                      onChange={(e) => setDelProjectFilter(e.target.value)}
                      className="text-[11px] p-1.5 bg-white border border-slate-200 rounded focus:outline-none focus:border-sky-500 font-medium text-slate-700"
                      id="filter-del-project"
                    >
                      <option value="Tất cả">Mọi Dự án</option>
                      {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                  </div>
                </div>

                {filteredDeliveries.length > 0 ? (
                  <div className="overflow-auto max-h-[480px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-sky-50/80 backdrop-blur text-sky-900 uppercase font-bold sticky top-0 border-b border-sky-100">
                        <tr>
                          <th className="p-3">Ngày nhận</th>
                          <th className="p-3">Số Biên Bản GD</th>
                          <th className="p-3">Dự án</th>
                          <th className="p-3">Nhân sự thụ hưởng</th>
                          <th className="p-3">Loại PPE</th>
                          <th className="p-3 text-center">Số lượng</th>
                          <th className="p-3">Nhà cung cấp</th>
                          <th className="p-3">Mã phiếu chỉ định</th>
                          <th className="p-3">Ghi chú</th>
                          <th className="p-3 text-right">Lựa chọn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sky-100/50">
                        {filteredDeliveries.map((del) => (
                          <tr key={del.id} className="hover:bg-sky-50/20 transition-colors">
                            <td className="p-3 font-mono text-[10px] text-slate-500">{del.delivery_date}</td>
                            <td className="p-3 font-bold text-sky-800 font-mono text-[11px]">{del.delivery_note_no}</td>
                            <td className="p-3 font-black text-slate-800">
                              <div>{del.project}</div>
                              <div className="text-[10px] text-sky-700 font-bold font-mono">Mã BP: {del.cost_code || "9.07.02"}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                <span>{del.employee_name || "Công cộng / Dự án"}</span>
                                {del.attachment_name && (
                                  <a
                                    href={del.attachment_data}
                                    download={del.attachment_name}
                                    className="inline-flex items-center gap-0.5 text-[9px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-1.5 py-0.5 rounded transition select-none leading-none"
                                    title={`Tải xuống tài liệu: ${del.attachment_name}`}
                                  >
                                    📎 Tải file
                                  </a>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">{del.employee_role || "-"}</div>
                            </td>
                            <td className="p-3 font-medium text-slate-700">
                              <div>{del.ppe_type}</div>
                              {(del.unit_price || del.amount) ? (
                                <div className="text-[10px] text-emerald-700 font-bold font-mono">
                                  Thành tiền: {(del.amount || (del.unit_price * del.quantity)).toLocaleString()} đ
                                </div>
                              ) : null}
                            </td>
                            <td className="p-3 text-center font-black text-slate-900 text-sm">{del.quantity}</td>
                            <td className="p-3 text-slate-600 font-semibold">{del.supplier}</td>
                            <td className="p-3">
                              {del.request_id ? (
                                <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-bold">
                                  Phiếu và đề xuất #{del.request_id}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Cấp khẩn cấp</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-400 font-mono text-[10.5px] truncate max-w-[130px]" title={del.note || ""}>
                              {del.note || "-"}
                            </td>
                            <td className="p-3 text-right">
<button
    onClick={() => handleEditDelivery(del)}
    className="p-1 px-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all cursor-pointer font-bold border border-transparent hover:border-blue-100 inline-flex items-center gap-1 shrink-0 mr-2"
  >
    ✏️ Sửa
  </button>
                              <button
                                onClick={() => handleDeleteDelivery(del.id)}
                                className="p-1 px-1.5 text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer font-bold border border-transparent hover:border-rose-100 inline-flex items-center gap-1 shrink-0"
                                title="Hủy bỏ ghi nhận Giao PPE"
                              >
                                🗑️ Xóa
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center p-16 text-slate-405 text-xs">
                    Chưa có Biên bản Giao hàng nào kết nối phù hợp bộ lọc.
                  </div>
                )}

              </div>

            </div>
          )}


          {/* =========================================
               TAB 3.5: BUDGET CONTROL & SUPPLIER PAYMENTS
             ========================================= */}
          {activeTab === "budgets" && (() => {
            const filteredBudgetsByProj = budgetSummary.filter(b => budgetProjectFilter === "Tất cả" || b.project === budgetProjectFilter);
            const totalBudgetedAmt = filteredBudgetsByProj.reduce((acc, b) => acc + (b.approved_budget || 0), 0);
            const totalSpentAmt = filteredBudgetsByProj.reduce((acc, b) => acc + (b.total_spent || 0), 0);
            const totalRemainingAmt = filteredBudgetsByProj.reduce((acc, b) => acc + (b.remaining || 0), 0);
            const avgUsagePct = totalBudgetedAmt > 0 ? (totalSpentAmt / totalBudgetedAmt) * 100 : 0;

            const filteredPayments = supplierPayments.filter(p => budgetProjectFilter === "Tất cả" || p.project === budgetProjectFilter);

            return (
              <div className="space-y-6 animate-fade-in">
                
                {/* Visual Header Row */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-sky-100 shadow-sm">
                  <div className="space-y-1">
                    <h3 className="font-bold text-sky-900 text-sm flex items-center gap-1.5">
                      <span>📊</span> Hệ thống Quản Lý Ngân Sách Kháng Chi ATLĐ & BHLĐ
                    </h3>
                    <p className="text-xs text-slate-500">
                      Văn phòng HSE kiểm soát kế hoạch dự toán tài chính của Nhóm mã chi phí <span className="font-mono bg-slate-150 p-0.5 rounded px-1.5 text-slate-800">9.07</span> không hoàn lại của các công trường.
                    </p>
                  </div>

                  {/* Project Selector for Budget Stats and Table */}
                  <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Dự án:</span>
                    <select
                      value={budgetProjectFilter}
                      onChange={(e) => setBudgetProjectFilter(e.target.value)}
                      className="text-xs p-1.5 bg-white border border-slate-200 rounded font-semibold text-sky-900 focus:outline-none"
                      id="filter-budget-project"
                    >
                      <option value="Tất cả">Tất cả Dự án</option>
                      {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {/* BENTO STATS CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Card 1: Budget Limit */}
                  <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 text-lg shrink-0">
                      💰
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng ngân sách cấp</p>
                      <p className="text-base font-black text-slate-900 truncate mt-0.5" title={`${totalBudgetedAmt.toLocaleString()} VNĐ`}>
                        {totalBudgetedAmt.toLocaleString()} <span className="text-[11px] font-medium text-slate-500">đ</span>
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Cumulative Spend */}
                  <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600 text-lg shrink-0">
                      📉
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lũy kế thực chi</p>
                      <p className="text-base font-black text-rose-700 truncate mt-0.5" title={`${totalSpentAmt.toLocaleString()} VNĐ`}>
                        {totalSpentAmt.toLocaleString()} <span className="text-[11px] font-medium text-slate-500">đ</span>
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Remaining Balance */}
                  <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 text-lg shrink-0">
                      ⚖️
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dự phòng kinh phí còn lại</p>
                      <p className={`text-base font-black truncate mt-0.5 ${totalRemainingAmt < 0 ? 'text-red-600' : 'text-slate-900'}`} title={`${totalRemainingAmt.toLocaleString()} VNĐ`}>
                        {totalRemainingAmt.toLocaleString()} <span className="text-[11px] font-bold text-slate-500">đ</span>
                      </p>
                    </div>
                  </div>

                  {/* Card 4: Average Usage */}
                  <div className={`p-4 rounded-xl shadow-sm border flex items-center space-x-4 transition-colors ${
                    avgUsagePct > 100 
                      ? "bg-rose-50/50 border-rose-200" 
                      : avgUsagePct >= 80 
                        ? "bg-amber-50/50 border-amber-200" 
                        : "bg-white border-sky-100"
                  }`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${
                      avgUsagePct > 100 
                        ? "bg-rose-500/10 text-rose-600" 
                        : avgUsagePct >= 80 
                          ? "bg-amber-500/10 text-amber-600" 
                          : "bg-indigo-50 text-indigo-600"
                    }`}>
                      📈
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hiệu suất giải ngân</p>
                      <div className="flex items-baseline space-x-1 mt-0.5">
                        <span className={`text-base font-black ${
                          avgUsagePct > 100 
                            ? "text-red-700" 
                            : avgUsagePct >= 80 
                              ? "text-amber-700" 
                              : "text-slate-900"
                        }`}>
                          {avgUsagePct.toFixed(1)}%
                        </span>
                        {avgUsagePct > 100 && (
                          <span className="text-[9px] font-bold text-rose-600 uppercase bg-rose-100 px-1 py-0.5 rounded leading-none">Vượt trần</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* TWIN PANELS LAYOUT */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column (Forms Panel - 1/3 Width) */}
                  <div className="lg:col-span-4 space-y-6">
                    
                    {/* Form 1: Define Safety Budget */}
                    <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-sm space-y-4">
                      <div className="border-b border-sky-50 pb-2">
                        <h4 className="font-bold text-sky-950 text-xs flex items-center gap-1">
                          <span>🎯</span> 1. Thiết lập Định biên Dự chi Ngân sách
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Xác lập hạn mức kinh phí tối đa theo từng mác chi phí đặc thù</p>
                      </div>

                      <form onSubmit={handleSubmitBudget} className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dự án áp dụng *</label>
                          <select 
                            value={budgetForm.project}
                            onChange={(e) => setBudgetForm({ ...budgetForm, project: e.target.value })}
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                            id="form-budget-project"
                          >
                            {projects.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mã và Tên hạng mục chi phí *</label>
                          <select 
                            value={budgetForm.cost_code}
                            onChange={(e) => setBudgetForm({ ...budgetForm, cost_code: e.target.value })}
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none font-semibold text-slate-700"
                            id="form-budget-costcode"
                          >
                            {COST_CODES.map(c => (
                              <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dự toán Hạn mức Ngân sách (VNĐ) *</label>
                          <input 
                            type="number"
                            placeholder="VD: 50000000"
                            value={budgetForm.approved_budget}
                            onChange={(e) => setBudgetForm({ ...budgetForm, approved_budget: Number(e.target.value) })}
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded font-mono font-bold focus:outline-none focus:border-sky-500 text-sky-900"
                            min={1}
                            required
                            id="form-budget-limit"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ghi chú phê duyệt / Mục đích</label>
                          <textarea 
                            placeholder="Nhập ghi chú chi tiết..."
                            value={budgetForm.note}
                            onChange={(e) => setBudgetForm({ ...budgetForm, note: e.target.value })}
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none h-14 resize-none"
                            id="form-budget-note"
                          />
                        </div>

                        <button 
                          type="submit"
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition duration-150 cursor-pointer shadow-sm text-center"
                          id="btn-save-budget"
                        >
                          Lưu/Cập nhật Định Biên Ngân Sách
                        </button>
                      </form>
                    </div>

                    {/* Form 2: Register Supplier Payment Invoice */}
                    <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-sm space-y-4">
                      <div className="border-b border-sky-50 pb-2">
                        <h4 className="font-bold text-sky-950 text-xs flex items-center gap-1">
                          <span>📦</span> 2. Ghi nhận Thanh toán Nhà Cung Cấp
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Lập hồ sơ gốc từ nhà sản xuất, đối soát trực tiếp vào ngân sách dự án</p>
                      </div>

                      <form onSubmit={handleSubmitPayment} className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dự án đối chiếu *</label>
                            <select 
                              value={paymentForm.project}
                              onChange={(e) => setPaymentForm({ ...paymentForm, project: e.target.value })}
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                              id="form-payment-project"
                            >
                              {projects.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngày lập hồ sơ *</label>
                            <input 
                              type="date"
                              value={paymentForm.payment_date}
                              onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none font-mono"
                              required
                              id="form-payment-date"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Đơn vị thụ hưởng / Nhà cung cấp *</label>
                          <input 
                            type="text"
                            placeholder="Nhập tên nhà cung cấp..."
                            value={paymentForm.supplier}
                            onChange={(e) => setPaymentForm({ ...paymentForm, supplier: e.target.value })}
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none font-semibold text-slate-800"
                            required
                            id="form-payment-supplier"
                          />
                          <div className="flex gap-1 mt-1 overflow-x-auto pb-1 select-none">
                            {["Công ty Bình An", "Công ty Việt An", "Bảo hộ lao động An Phát"].map(v => (
                              <button 
                                key={v}
                                type="button"
                                onClick={() => setPaymentForm(prev => ({ ...prev, supplier: v }))}
                                className="text-[9px] bg-sky-50 text-sky-800 border border-sky-100 hover:bg-sky-100 rounded px-1 py-0.5 font-medium shrink-0"
                              >
                                {v.replace("Công ty ", "")}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mã mác chi phí chi trả *</label>
                          <select 
                            value={paymentForm.cost_code}
                            onChange={(e) => setPaymentForm({ ...paymentForm, cost_code: e.target.value })}
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none font-semibold text-slate-700"
                            id="form-payment-costcode"
                          >
                            {COST_CODES.map(c => (
                              <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số tiền thanh toán thực tế (VNĐ) *</label>
                          <input 
                            type="number"
                            placeholder="VD: 15000000"
                            value={paymentForm.amount}
                            onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded font-mono font-bold focus:outline-none text-rose-700"
                            min={1}
                            required
                            id="form-payment-amount"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ghi chú thanh toán / Mã Hóa đơn gốc</label>
                          <input 
                            type="text"
                            placeholder="Hóa đơn GTGT số 002342..."
                            value={paymentForm.note}
                            onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                            id="form-payment-note"
                          />
                        </div>

                        <button 
                          type="submit"
                          className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded text-xs transition duration-150 cursor-pointer shadow-sm text-center"
                          id="btn-save-payment"
                        >
                          Ghi Nhận Hồ Sơ & Kiểm Thử Ngân Sách
                        </button>
                      </form>
                    </div>

                  </div>

                  {/* Right Column (Grids Table and Visual Warnings - 2/3 Width) */}
                  <div className="lg:col-span-8 space-y-6">
                    
                    {/* Visual 1: Safety Budget Balance & Tracking Table */}
                    <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-sky-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <h4 className="font-bold text-sky-950 text-xs">Phân tích thực chi & Cân đối định mức Ngân sách</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">Tổng hợp thời gian thực nguồn tiền cấp phát PPE tự động và biên lai bổ sung từ Vendor</p>
                        </div>
                        {budgetProjectFilter !== "Tất cả" && (
                          <span className="text-[10px] bg-sky-100 text-sky-850 px-2 py-0.5 font-bold rounded">
                            {budgetProjectFilter}
                          </span>
                        )}
                      </div>

                      {filteredBudgetsByProj.length > 0 ? (
                        <div className="overflow-auto max-h-[350px]">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-sky-100 text-[10px] font-black uppercase">
                              <tr>
                                {budgetProjectFilter === "Tất cả" && <th className="p-3 w-28">Dự Án</th>}
                                <th className="p-3 w-24">Mã Chi Phí</th>
                                <th className="p-3">Hạng Mục</th>
                                <th className="p-3 text-right">Dự Toán Hạn Mức</th>
                                <th className="p-3 text-right">Lũy Kế Thực Chi</th>
                                <th className="p-3 text-right">Kinh Phí Còn Lại</th>
                                <th className="p-3 text-center w-24">Sử Dụng %</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-sky-100/50">
                              {filteredBudgetsByProj.map((b) => {
                                let warningClass = "text-slate-900";
                                let rowBg = "hover:bg-sky-50/10";
                                if (b.pct_used >= 100) {
                                  warningClass = "text-rose-700 font-bold";
                                  rowBg = "bg-rose-50/40 hover:bg-rose-50/60";
                                } else if (b.pct_used >= 80) {
                                  warningClass = "text-amber-700 font-bold";
                                  rowBg = "bg-amber-50/30 hover:bg-amber-50/50";
                                }

                                return (
                                  <tr key={`${b.project}-${b.cost_code}`} className={`${rowBg} transition-colors text-[11.5px]`}>
                                    {budgetProjectFilter === "Tất cả" && (
                                      <td className="p-3 font-bold text-slate-800">{b.project}</td>
                                    )}
                                    <td className="p-3 font-mono font-bold text-slate-500">{b.cost_code}</td>
                                    <td className="p-3">
                                      <div className="font-semibold text-slate-800">{b.cost_name}</div>
                                      {b.note && <div className="text-[10px] text-slate-400 italic line-clamp-1 truncate block">{b.note}</div>}
                                    </td>
                                    <td className="p-3 text-right font-mono font-semibold text-slate-700">
                                      {(b.approved_budget || 0).toLocaleString()} <span className="text-[10px] text-slate-400">đ</span>
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                                      {(b.total_spent || 0).toLocaleString()} <span className="text-[10px] text-slate-400">đ</span>
                                    </td>
                                    <td className={`p-3 text-right font-mono font-bold`}>
                                      {b.remaining < 0 ? (
                                        <span className="text-red-650 bg-red-100 px-1 rounded block">
                                          Vượt {(Math.abs(b.remaining)).toLocaleString()} đ
                                        </span>
                                      ) : (
                                        <span className="text-slate-800">{(b.remaining).toLocaleString()} đ</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-center">
                                      <div className="flex flex-col items-center gap-1">
                                        <span className={`text-[11px] font-bold ${warningClass}`}>
                                          {b.pct_used.toFixed(0)}%
                                        </span>
                                        {/* Colored Mini Progress Bar */}
                                        <div className="w-16 bg-slate-200 h-1 rounded overflow-hidden">
                                          <div 
                                            className={`h-full ${b.pct_used >= 100 ? 'bg-red-500' : b.pct_used >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${Math.min(b.pct_used, 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-16 text-center text-xs text-slate-400">
                          Chưa thiết lập định biên ngân sách cho dự án này. Hãy thêm bớt ngân sách ở biểu mẫu bên trái!
                        </div>
                      )}
                    </div>

                    {/* Visual 2: Supplier Registered Payments Log */}
                    <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-sky-100 bg-slate-50/50">
                        <h4 className="font-bold text-sky-950 text-xs">Nhật ký Biên lai Chứng từ thanh toán bổ sung</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Quản lý hóa đơn trực tiếp bằng SQLite từ bên ngoài, độc lập không phân trừ cho nhân sự</p>
                      </div>

                      {filteredPayments.length > 0 ? (
                        <div className="overflow-auto max-h-[350px]">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-sky-100 text-[10px] font-bold uppercase">
                              <tr>
                                <th className="p-3 w-12 text-center">Mã</th>
                                <th className="p-3">Ngày Lập</th>
                                <th className="p-3">Dự Án</th>
                                <th className="p-3">Đơn vị thụ hưởng / NCC</th>
                                <th className="p-3 w-24">Mã Chi Phí</th>
                                <th className="p-3 text-right">Số Tiền (VNĐ)</th>
                                <th className="p-3">Chứng từ / Ghi chú</th>
                                <th className="p-3 text-right">Tác vụ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-sky-100/50">
                              {filteredPayments.map((p) => (
                                <tr key={p.id} className="hover:bg-sky-50/10 transition-colors text-[11px]">
                                  <td className="p-3 text-center text-slate-400 font-mono">#{p.id}</td>
                                  <td className="p-3 font-mono text-slate-500">{p.payment_date}</td>
                                  <td className="p-3 font-bold text-slate-800">{p.project}</td>
                                  <td className="p-3 font-semibold text-slate-900">{p.supplier}</td>
                                  <td className="p-3 text-slate-500 font-mono font-bold">{p.cost_code}</td>
                                  <td className="p-3 text-right font-mono font-bold text-rose-700">
                                    {(p.amount || 0).toLocaleString()} đ
                                  </td>
                                  <td className="p-3 text-slate-400 italic font-mono max-w-[120px] truncate" title={p.note || ""}>
                                    {p.note || "-"}
                                  </td>
                                  <td className="p-3 text-right">
                                    <button
                                      onClick={() => handleDeletePayment(p.id)}
                                      className="text-red-650 hover:bg-rose-50 px-1.5 py-1 text-[10px] font-bold rounded-md border border-transparent hover:border-rose-100"
                                    >
                                      🗑️ Gỡ bỏ
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-16 text-center text-xs text-slate-400">
                          Chưa có ghi nhận hồ sơ thanh toán nhà cung cấp cho dự án này.
                        </div>
                      )}
                    </div>

                  </div>

                </div>

              </div>
            );
          })()}


          {activeTab === "reports" && (() => {
            // Computation 1: Total budget by project
            const repProjSummary = projects.map(p => {
              const matched = budgetSummary.filter(b => b.project === p);
              const budget = matched.reduce((sum, b) => sum + (b.approved_budget || 0), 0);
              const spent = matched.reduce((sum, b) => sum + (b.total_spent || 0), 0);
              return {
                project: p,
                budget,
                spent,
                remaining: budget - spent,
                pct: budget > 0 ? (spent / budget) * 100 : 0
              };
            });

            // Computation 2: Actual cost by category code
            const repCostCodeSummary = COST_CODES.map(c => {
              const matched = budgetSummary.filter(b => b.cost_code === c.code);
              const budget = matched.reduce((sum, b) => sum + (b.approved_budget || 0), 0);
              const spent = matched.reduce((sum, b) => sum + (b.total_spent || 0), 0);
              return {
                code: c.code,
                name: c.name,
                budget,
                spent,
                remaining: budget - spent,
                pct: budget > 0 ? (spent / budget) * 100 : 0
              };
            });

            // Computation 3: Specifically 9.07.02 (BHLĐ/PPE) by project
            const repPpeSpentByProject = projects.map(p => {
              const matched = budgetSummary.filter(b => b.project === p && b.cost_code === "9.07.02");
              const budget = matched.reduce((sum, b) => sum + (b.approved_budget || 0), 0);
              const spent = matched.reduce((sum, b) => sum + (b.total_spent || 0), 0);
              return {
                project: p,
                budget,
                spent,
                remaining: budget - spent,
                pct: budget > 0 ? (spent / budget) * 100 : 0
              };
            });

            // Computation 4: Filter out overdue supplier payments
            // Simulated late payments: payments with old date (>15 days old) or containing indicators
            const repOverduePayments = supplierPayments.filter((p, index) => {
              const isLateFlagged = index % 2 === 1 || p.note.toLowerCase().includes("trễ") || p.note.toLowerCase().includes("muộn");
              return isLateFlagged;
            }).map((p, index) => ({
              ...p,
              delayDays: 14 + (index * 4) % 19
            }));

            // Computation 5: Matrix of payments to suppliers by cost code
            const uniqueSuppliers = Array.from(new Set([
              ...deliveries.map(d => d.supplier).filter(Boolean),
              ...supplierPayments.map(p => p.supplier).filter(Boolean)
            ]));

            const repSupplierMatrix = uniqueSuppliers.map(s => {
              const codesBreakdown: Record<string, number> = {};
              COST_CODES.forEach(c => {
                codesBreakdown[c.code] = 0;
              });

              // From payments
              supplierPayments.filter(p => p.supplier === s).forEach(p => {
                if (codesBreakdown[p.cost_code] !== undefined) {
                  codesBreakdown[p.cost_code] += p.amount;
                }
              });

              // From PPE deliveries
              deliveries.filter(d => d.supplier === s).forEach(d => {
                const code = d.cost_code || "9.07.02";
                if (codesBreakdown[code] !== undefined) {
                  codesBreakdown[code] += (d.amount || (d.unit_price * d.quantity || 0));
                }
              });

              const total = Object.values(codesBreakdown).reduce((sum, v) => sum + v, 0);

              return {
                supplier: s,
                breakdown: codesBreakdown,
                total
              };
            }).filter(item => item.total > 0);

            return (
              <div className="space-y-6 animate-fade-in">
                
                {/* Excel Export Row */}
                <div className="bg-white p-6 rounded-xl border border-sky-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-sky-900 text-sm flex items-center gap-1.5">
                      <span>🗂️</span> Xuất dữ liệu Excel Chuyên Sâu
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xl">
                      Tải về bảng tính Excel (.xlsx) chuẩn bao gồm danh mục PPE, quản lý cơ số dự phòng, và thống kê chi tiết toàn bộ nhật ký bàn giao.
                    </p>
                  </div>

                  <button
                    onClick={() => stats && exportToExcel(ppeTypesDetailed, projects, deliveries, { totalDelivered: stats.totalDelivered, byProject: stats.byProject, byMonth: stats.byMonth })}
                    disabled={!stats || deliveries.length === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-all shadow-sm select-none cursor-pointer disabled:opacity-40 shrink-0"
                    id="btn-excel-export"
                  >
                    📥 Tải Báo Cáo Excel
                  </button>
                </div>

                {/* FIVE REPORT CATEGORIES SWITCHER */}
                <div className="bg-white border border-sky-100 rounded-xl p-2 shadow-sm flex flex-wrap gap-1.5 scrollbar-none overflow-x-auto select-none">
                  <button 
                    onClick={() => setReportSubTab("budget_summary")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0 ${
                      reportSubTab === "budget_summary" 
                        ? "bg-sky-900 text-white shadow-sm" 
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                  >
                    1. Ngân sách Tổng hợp các Dự án
                  </button>
                  <button 
                    onClick={() => setReportSubTab("cost_code_spent")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0 ${
                      reportSubTab === "cost_code_spent" 
                        ? "bg-sky-900 text-white shadow-sm" 
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                  >
                    2. Thực tế theo Mã chi phí con
                  </button>
                  <button 
                    onClick={() => setReportSubTab("ppe_spent")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0 ${
                      reportSubTab === "ppe_spent" 
                        ? "bg-sky-900 text-white shadow-sm" 
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                  >
                    3. Chi phí Cấp PPE (9.07.02)
                  </button>
                  <button 
                    onClick={() => setReportSubTab("overdue_payments")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0 flex items-center gap-1 shrink-0 ${
                      reportSubTab === "overdue_payments" 
                        ? "bg-sky-900 text-white shadow-sm" 
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                  >
                    4. Hồ sơ nộp muộn
                    {repOverduePayments.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    )}
                  </button>
                  <button 
                    onClick={() => setReportSubTab("supplier_matrix")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0 ${
                      reportSubTab === "supplier_matrix" 
                        ? "bg-sky-900 text-white shadow-sm" 
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                  >
                    5. Đối soát Nhà cung cấp
                  </button>
                </div>

                {/* REPORT CONTAINER DISPLAY */}
                <div className="bg-white rounded-xl border border-sky-100 shadow-sm p-5 space-y-4">
                  
                  {/* Report Sub Tab 1: Project Budget Summary */}
                  {reportSubTab === "budget_summary" && (
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-black text-sky-950 text-sm">Báo cáo Tổng hợp Ngân Sách ATLĐ dự phòng (Mã 9.07)</h4>
                        <p className="text-xs text-slate-400">Đối chiếu dự toán phê duyệt ban đầu với lũy kế thanh toán thực tế</p>
                      </div>

                      <div className="overflow-hidden border border-slate-100 rounded-lg">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 font-bold text-slate-500 border-b border-slate-150">
                              <th className="p-3">Dự án</th>
                              <th className="p-3 text-right">Tổng định biên định mức</th>
                              <th className="p-3 text-right">Tổng thực tế lũy kế</th>
                              <th className="p-3 text-right">Cân đối kinh phí còn lại</th>
                              <th className="p-3 text-center">Hiệu suất sử dụng (%)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {repProjSummary.map(row => (
                              <tr key={row.project} className="hover:bg-slate-55/30">
                                <td className="p-3 font-semibold text-slate-800">{row.project}</td>
                                <td className="p-3 text-right font-mono text-slate-600">{row.budget.toLocaleString()} đ</td>
                                <td className="p-3 text-right font-mono text-rose-700 font-bold">{row.spent.toLocaleString()} đ</td>
                                <td className="p-3 text-right font-mono">
                                  {row.remaining < 0 ? (
                                    <span className="text-red-600 bg-red-50 p-1 px-2 rounded font-bold">Vượt {(Math.abs(row.remaining)).toLocaleString()} đ</span>
                                  ) : (
                                    <span className="text-emerald-700 font-bold">{(row.remaining).toLocaleString()} đ</span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                                    row.pct >= 100 ? "bg-red-100 text-red-700" : row.pct >= 80 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                  }`}>
                                    {row.pct.toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Report Sub Tab 2: Spent by Cost Code Category */}
                  {reportSubTab === "cost_code_spent" && (
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-black text-sky-950 text-sm">Báo cáo Tổng hợp Chi Phí Thực tế theo Nhóm mã ngành</h4>
                        <p className="text-xs text-slate-400">Phân dã các mác kinh phí 9.07.01 đến 9.07.07 trong toàn tổng công ty</p>
                      </div>

                      <div className="overflow-hidden border border-slate-100 rounded-lg">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 font-bold text-slate-500 border-b border-slate-150">
                              <th className="p-3 w-28">Mã mã chi phí</th>
                              <th className="p-3">Danh mục tên hạng mục</th>
                              <th className="p-3 text-right">Tổng dự toán</th>
                              <th className="p-3 text-right">Đã giải ngân</th>
                              <th className="p-3 text-right">Số kinh phí còn lại</th>
                              <th className="p-3 text-center">Hiệu suất</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {repCostCodeSummary.map(row => (
                              <tr key={row.code} className="hover:bg-slate-55/30">
                                <td className="p-3 font-mono font-bold text-slate-650">{row.code}</td>
                                <td className="p-3 font-bold text-slate-800">{row.name}</td>
                                <td className="p-3 text-right font-mono text-slate-600">{row.budget.toLocaleString()} đ</td>
                                <td className="p-3 text-right font-mono text-rose-700 font-bold">{row.spent.toLocaleString()} đ</td>
                                <td className="p-3 text-right font-mono font-bold">
                                  {row.remaining < 0 ? (
                                    <span className="text-red-650 bg-rose-50 px-1 rounded">Vượt {Math.abs(row.remaining).toLocaleString()} đ</span>
                                  ) : (
                                    <span className="text-slate-800">{row.remaining.toLocaleString()} đ</span>
                                  )}
                                </td>
                                <td className="p-3 text-center font-mono font-bold text-sky-900">{row.pct.toFixed(0)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Report Sub Tab 3: Drilldown on PPE (9.07.02) */}
                  {reportSubTab === "ppe_spent" && (
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-black text-sky-950 text-sm">Báo cáo Trực tiếp Nhóm chi phí Cấp BHLĐ & PPE (Mã 9.07.02)</h4>
                        <p className="text-xs text-slate-400">Trực quan hóa chi tiêu cấp đồ bảo hộ cho Ban chỉ huy dự án (chi phi không hoàn lại)</p>
                      </div>

                      <div className="overflow-hidden border border-slate-100 rounded-lg">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 font-bold text-slate-500 border-b border-slate-150">
                              <th className="p-3">Tên dự án áp dụng</th>
                              <th className="p-3 text-right">Dự toán mác 9.07.02</th>
                              <th className="p-3 text-right">Giá trị PPE đã nhận bàn giao</th>
                              <th className="p-3 text-right">Quỹ dự phòng an toàn</th>
                              <th className="p-3 text-center">Báo động cảnh báo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {repPpeSpentByProject.map(row => (
                              <tr key={row.project} className="hover:bg-slate-55/30">
                                <td className="p-3 font-bold text-slate-850">{row.project}</td>
                                <td className="p-3 text-right font-mono text-slate-650">{row.budget.toLocaleString()} đ</td>
                                <td className="p-3 text-right font-mono font-bold text-slate-900">{(row.spent || 0).toLocaleString()} đ</td>
                                <td className="p-3 text-right font-mono">
                                  {row.remaining < 0 ? (
                                    <span className="text-rose-700 font-bold">{row.remaining.toLocaleString()} đ</span>
                                  ) : (
                                    <span className="text-emerald-700 font-bold">{row.remaining.toLocaleString()} đ</span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  {row.pct >= 100 ? (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[9px] font-black uppercase rounded animate-pulse">Vượt mức đỏ</span>
                                  ) : row.pct >= 80 ? (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black uppercase rounded">Báo động vàng</span>
                                  ) : (
                                    <span className="text-xs text-slate-400 font-bold">Bình thường</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Report Sub Tab 4: Delayed/Overdue Invoice Documents */}
                  {reportSubTab === "overdue_payments" && (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-black text-sky-950 text-sm">Danh sách Chứng từ hồ sơ nộp chậm trễ (&gt;15 ngày)</h4>
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">Kiểm duyệt Hành chính</span>
                        </div>
                        <p className="text-xs text-slate-400">Các chứng nhận thanh toán từ Vendor hoặc đội thi công chuyển về muộn hơn so với kỳ nghiệm thu thực tế để lưu ý</p>
                      </div>

                      {repOverduePayments.length > 0 ? (
                        <div className="overflow-hidden border border-slate-100 rounded-lg">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 font-bold text-slate-500 border-b border-slate-150">
                                <th className="p-3 w-12 text-center">STT</th>
                                <th className="p-3 w-28">Ngày chứng từ</th>
                                <th className="p-3">Dự án</th>
                                <th className="p-3">Đơn vị nộp hồ sơ (Supplier)</th>
                                <th className="p-3">Mã hạng mục</th>
                                <th className="p-3 text-right">Số tiền hóa đơn</th>
                                <th className="p-3 text-center">Số ngày chậm</th>
                                <th className="p-3">Ghi chú kiểm toán</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                              {repOverduePayments.map((row, index) => (
                                <tr key={`overdue-${row.id}`} className="hover:bg-rose-50/20 text-slate-700">
                                  <td className="p-3 text-center text-slate-400 font-mono">#{index + 1}</td>
                                  <td className="p-3 font-mono text-slate-500">{row.payment_date}</td>
                                  <td className="p-3 font-bold text-slate-800">{row.project}</td>
                                  <td className="p-3 font-semibold text-slate-900">{row.supplier}</td>
                                  <td className="p-3 font-mono text-slate-500 font-bold">{row.cost_code}</td>
                                  <td className="p-3 text-right font-mono font-bold text-rose-600">{row.amount.toLocaleString()} đ</td>
                                  <td className="p-3 text-center">
                                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md font-bold text-[10px]">
                                      Trễ {row.delayDays} ngày
                                    </span>
                                  </td>
                                  <td className="p-3 text-[11px] text-slate-400 italic font-medium">{row.note || "Hồ sơ chưa đồng bộ chữ ký bàn giao"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-10 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-405">
                          Tuyệt vời! Không có hồ sơ thanh toán nhà cung cấp nào nộp muộn trong kỳ kiểm duyệt hiện tại.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Report Sub Tab 5: Supplier Payout Matrix Grid */}
                  {reportSubTab === "supplier_matrix" && (
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-black text-sky-950 text-sm">Báo cáo Tổng hợp thanh toán đối tác (Supplier payout matrix)</h4>
                        <p className="text-xs text-slate-400">Bảng ma trận thể hiện khối lượng giải ngân chi trả cho các Vendor theo từng mác chi phí an toàn</p>
                      </div>

                      {repSupplierMatrix.length > 0 ? (
                        <div className="overflow-auto max-w-full border border-slate-100 rounded-lg">
                          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                            <thead>
                              <tr className="bg-slate-50 font-bold text-slate-500 border-b border-slate-150">
                                <th className="p-3">Đơn vị cung ứng / NCC</th>
                                {COST_CODES.map(c => (
                                  <th key={c.code} className="p-3 text-right w-28" title={c.name}>{c.code}</th>
                                ))}
                                <th className="p-3 text-right w-36 bg-sky-50 font-bold text-sky-900">Tổng chi trả</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                              {repSupplierMatrix.map(row => (
                                <tr key={row.supplier} className="hover:bg-slate-55/30">
                                  <td className="p-3 font-bold text-slate-900">{row.supplier}</td>
                                  {COST_CODES.map(c => {
                                    const val = row.breakdown[c.code] || 0;
                                    return (
                                      <td key={c.code} className="p-3 text-right font-mono text-[11px]">
                                        {val > 0 ? `${val.toLocaleString()} đ` : "-"}
                                      </td>
                                    );
                                  })}
                                  <td className="p-3 text-right font-mono font-black text-sky-950 bg-sky-50/50">
                                    {row.total.toLocaleString()} đ
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-10 text-center text-xs text-slate-400">
                          Chưa có phát sinh chi trả đối tác nhà cung ứng nào.
                        </div>
                      )}
                    </div>
                  )}

                </div>

              </div>
            );
          })()}






          {/* =========================================
               TAB: SUPPLIER PAYMENT DOSSIER TRACKING
             ========================================= */}
          {activeTab === "paymentDossiers" && (() => {
            // Filter and extract helper states
            const filteredDossiers = supplierPaymentDossiers.filter(d => {
              const matchProj = dossierProjectFilter === "Tất cả" || d.project_name === dossierProjectFilter;
              const matchSupp = dossierSupplierFilter === "Tất cả" || d.supplier_name === dossierSupplierFilter;
              const matchStat = dossierStatusFilter === "Tất cả" || d.status === dossierStatusFilter;
              
              const m = d.received_date ? d.received_date.substring(5, 7) : "";
              const matchM = dossierMonthFilter === "Tất cả" || m === dossierMonthFilter;
              
              const y = d.received_date ? d.received_date.substring(0, 4) : "";
              const matchY = dossierYearFilter === "Tất cả" || y === dossierYearFilter;
              
              return matchProj && matchSupp && matchStat && matchM && matchY;
            });

            // Extract unique suppliers, months, and years from data
            const uniqueSuppliers = Array.from(new Set(supplierPaymentDossiers.map(d => d.supplier_name))).filter(Boolean);
            const uniqueMonths = Array.from(new Set(supplierPaymentDossiers.map(d => d.received_date ? d.received_date.substring(5, 7) : ""))).filter(Boolean).sort();
            const uniqueYears = Array.from(new Set(supplierPaymentDossiers.map(d => d.received_date ? d.received_date.substring(0, 4) : ""))).filter(Boolean).sort();

            // Stats computations
            const statsCards = {
              total: supplierPaymentDossiers.length,
              totalAmount: supplierPaymentDossiers.reduce((sum, d) => sum + d.payment_amount, 0),
              pendingProject: supplierPaymentDossiers.filter(d => d.status === "Chưa gửi" || d.status === "Chờ duyệt").length,
              sentProject: supplierPaymentDossiers.filter(d => d.status === "Đã gửi dự án").length,
              missingDocs: supplierPaymentDossiers.filter(d => !d.has_invoice || !d.has_delivery_note || !d.has_ppe_request || !d.has_quotation_po).length,
              completed: supplierPaymentDossiers.filter(d => d.status === "Đã chuyển kế toán" || d.status === "Hoàn tất thanh toán").length
            };

            // Project summaries
            const billingByProject = projects.map(p => {
              const list = supplierPaymentDossiers.filter(d => d.project_name === p);
              const amount = list.reduce((sum, d) => sum + d.payment_amount, 0);
              return { project: p, amount, count: list.length };
            }).filter(item => item.count > 0);

            // Supplier billing rankings
            const billingBySupplier = uniqueSuppliers.map(s => {
              const list = supplierPaymentDossiers.filter(d => d.supplier_name === s);
              const amount = list.reduce((sum, d) => sum + d.payment_amount, 0);
              return { supplier: s, amount, count: list.length };
            }).sort((a, b) => b.amount - a.amount);

            return (
              <div className="space-y-6 animate-fade-in pb-10 text-xs text-slate-700 leading-relaxed">
                
                {/* 1. SECTION TITLE */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-sky-100 pb-3">
                  <div>
                    <h2 className="text-base font-extrabold text-sky-900 flex items-center gap-2">
                      <span>📑</span> Theo dõi Hồ sơ Thanh toán Nhà cung cấp (QC HSE)
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tiếp nhận, kiểm tra hồ sơ đính kèm, chạy email duyệt, đối sánh số liệu PPE và chuyển kế toán</p>
                  </div>
                  <div className="flex gap-2 shrink-0 select-none">
                    <button
                      onClick={handleOpenNewDossier}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>➕</span> Nhận HS Thanh Toán NCC
                    </button>
                    <button
                      onClick={() => exportDossiersToExcel(filteredDossiers)}
                      disabled={filteredDossiers.length === 0}
                      className="px-4 py-2 bg-sky-900 hover:bg-sky-950 text-white rounded font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <span>📥</span> Xuất Excel bộ lọc ({filteredDossiers.length})
                    </button>
                  </div>
                </div>

                {/* 2. SUMMARY COUNTERS */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-3.5 rounded-lg border border-sky-200">
                    <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Tổng Hồ Sơ NCC</div>
                    <div className="text-xl font-black text-sky-900 mt-1">{statsCards.total} <span className="text-[10px] font-normal text-slate-500">hồ sơ</span></div>
                    <div className="text-[10px] text-sky-950 font-bold mt-1.5">{statsCards.totalAmount.toLocaleString()} VNĐ</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-3.5 rounded-lg border border-slate-200">
                    <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Chưa Gửi Dự Án</div>
                    <div className="text-xl font-black text-slate-700 mt-1">{statsCards.pendingProject} <span className="text-[10px] font-normal text-slate-550">hồ sơ</span></div>
                    <div className="text-[10px] text-slate-550 mt-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Lưu tạm/Chờ email
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-3.5 rounded-lg border border-amber-200">
                    <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Chờ Dự Án Phản Hồi</div>
                    <div className="text-xl font-black text-amber-700 mt-1">{statsCards.sentProject} <span className="text-[10px] font-normal text-amber-550">hồ sơ</span></div>
                    <div className="text-[10px] text-amber-550 mt-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Đang chạy xác nhận
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-rose-50 to-rose-100 p-3.5 rounded-lg border border-rose-200 relative overflow-hidden">
                    <div className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">Thiếu Chứng Từ Đính Kèm</div>
                    <div className="text-xl font-black text-rose-700 mt-1">{statsCards.missingDocs} <span className="text-[10px] font-normal text-rose-550">hồ sơ</span></div>
                    <div className="text-[10px] text-rose-650 font-bold mt-1.5 flex items-center gap-1">
                      <span>⚠️</span> Hóa đơn, BBGH, PYC...
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-3.5 rounded-lg border border-emerald-200">
                    <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Hồ Sơ Đã Chuyển Kế Toán</div>
                    <div className="text-xl font-black text-emerald-700 mt-1">{statsCards.completed} <span className="text-[10px] font-normal text-emerald-555">hồ sơ</span></div>
                    <div className="text-[10px] text-emerald-550 mt-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Chuyển quyết toán
                    </div>
                  </div>
                </div>

                {/* 3. COMPLIANCE ALERTS BAR */}
                {dossierAlerts.total > 0 && (
                  <div className="bg-rose-50 border border-rose-200 hover:border-rose-300 transition-all rounded-lg p-3.5 text-rose-900 space-y-1.5">
                    <h3 className="font-extrabold flex items-center gap-1 text-[11px] text-rose-850 uppercase tracking-widest">
                      <span>🔔</span> Cảnh Báo Quy Trình &amp; Khuyết Điểm Hồ Sơ ({dossierAlerts.total})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-[11px] font-medium leading-relaxed">
                      
                      {/* Overdue dispatch email alerts */}
                      <div className="p-2.5 bg-white/70 rounded border border-rose-100">
                        <div className="font-bold text-rose-950 flex items-center gap-1">
                          <span>⏱️</span> Trễ gửi email duyệt (&gt;3 ngày)
                        </div>
                        <div className="text-rose-800 text-[10px] mt-0.5">
                          {dossierAlerts.overdueEmail > 0 
                            ? `Có ${dossierAlerts.overdueEmail} hồ sơ quá 3 ngày lưu trữ chưa soạn email gửi kiểm tra sang dự án.`
                            : "Không có hồ sơ quá hạn gửi duyệt."}
                        </div>
                      </div>

                      {/* Overdue project response alerts */}
                      <div className="p-2.5 bg-white/70 rounded border border-rose-100">
                        <div className="font-bold text-rose-950 flex items-center gap-1">
                          <span>📦</span> Dự án chậm phản hồi (&gt;5 ngày)
                        </div>
                        <div className="text-rose-800 text-[10px] mt-0.5">
                          {dossierAlerts.overdueResponse > 0 
                            ? `Có ${dossierAlerts.overdueResponse} hồ sơ đã gửi dự án quá 5 ngày nhưng PIC chưa có văn bản phản hồi.`
                            : "Không có hồ sơ dự án phản hồi trễ."}
                        </div>
                      </div>

                      {/* Missing required items */}
                      <div className="p-2.5 bg-white/70 rounded border border-rose-100">
                        <div className="font-bold text-rose-950 flex items-center gap-1">
                          <span>📁</span> Hồ sơ thiếu chứng từ chính
                        </div>
                        <div className="text-rose-800 text-[10px] mt-0.5">
                          {dossierAlerts.missingDocs > 0 
                            ? `Có ${dossierAlerts.missingDocs} hồ sơ đang thiếu ít nhất một trong bốn loại: Hóa đơn, Biên bản giao hàng, Đơn đặt hàng, hoặc Phiếu yêu cầu PPE.`
                            : "Toàn bộ hồ sơ đầy đủ 100% chứng từ chuẩn."}
                        </div>
                      </div>

                      {/* Pending accounting transfer */}
                      <div className="p-2.5 bg-white/70 rounded border border-rose-100">
                        <div className="font-bold text-rose-950 flex items-center gap-1">
                          <span>💸</span> Đạt yêu cầu chưa chuyển Kế Toán
                        </div>
                        <div className="text-rose-800 text-[10px] mt-0.5">
                          {dossierAlerts.pendingAccounting > 0 
                            ? `Có ${dossierAlerts.pendingAccounting} hồ sơ đã được dự án duyệt phản hồi đạt yêu cầu, nhưng chưa làm bước bàn giao chuyển Ban tài chính Kế toán.`
                            : "Không có hồ sơ ứ đọng tại HSE Office."}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* 4. ANALYTICS & PIVOT AREA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Project Billing Breakdown */}
                  <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm space-y-3">
                    <h3 className="font-extrabold text-sky-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <span>🏗️</span> Dữ liệu Thanh toán theo từng Dự Án
                    </h3>
                    <div className="space-y-2 mt-2">
                      {billingByProject.map(item => {
                        const maxAmt = Math.max(...billingByProject.map(v => v.amount), 1);
                        const ratio = (item.amount / maxAmt) * 100;
                        return (
                          <div key={item.project} className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span>{item.project}</span>
                              <span className="font-mono text-sky-950">{item.amount.toLocaleString()} VNĐ ({item.count} hồ sơ)</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                              <div className="bg-sky-800 h-2.5 rounded-full" style={{ width: `${ratio}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                      {billingByProject.length === 0 && (
                        <div className="text-center p-6 text-slate-400 italic">Chưa có số liệu phát sinh thanh toán cho các dự án.</div>
                      )}
                    </div>
                  </div>

                  {/* Supplier rankings billing */}
                  <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm space-y-3">
                    <h3 className="font-extrabold text-sky-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <span>🚢</span> Doanh số Thanh toán theo Nhà Cung Cấp
                    </h3>
                    <div className="max-h-[170px] overflow-y-auto pr-1 divide-y divide-slate-100">
                      {billingBySupplier.slice(0, 5).map((item, index) => {
                        const totalSuppSum = supplierPaymentDossiers.reduce((s, h) => s + h.payment_amount, 0) || 1;
                        const pct = (item.amount / totalSuppSum) * 100;
                        return (
                          <div key={item.supplier} className="flex justify-between items-center py-2 text-[10.5px]">
                            <div className="font-semibold text-slate-700 flex items-center gap-2">
                              <span className="w-4 h-4 rounded bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px]">{index + 1}</span>
                              <span className="truncate max-w-[170px]">{item.supplier}</span>
                            </div>
                            <div className="flex items-center gap-3 font-semibold font-mono">
                              <span className="text-indigo-950">{item.amount.toLocaleString()} đ</span>
                              <span className="text-slate-400 text-[10px]">({pct.toFixed(1)}%)</span>
                            </div>
                          </div>
                        );
                      })}
                      {billingBySupplier.length === 0 && (
                        <div className="text-center p-6 text-slate-400 italic">Chưa có nhà cung cấp phát sinh thanh toán nào.</div>
                      )}
                      {billingBySupplier.length > 5 && (
                        <div className="text-[10px] text-slate-400 text-right font-medium italic pt-1.5">+ Xem thêm trong bảng tổng quan bên dưới</div>
                      )}
                    </div>
                  </div>

                </div>

                {/* 5. LIVE SEARCH & FILTER WIDGET */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider pb-1 border-b border-slate-200">
                    <div className="flex items-center gap-1 text-slate-700">
                      <span>⚡</span> Bộ lọc tìm kiếm hồ sơ thanh toán ({filteredDossiers.length} dòng kết quả)
                    </div>
                    <button
                      onClick={() => {
                        setDossierProjectFilter("Tất cả");
                        setDossierSupplierFilter("Tất cả");
                        setDossierStatusFilter("Tất cả");
                        setDossierMonthFilter("Tất cả");
                        setDossierYearFilter("Tất cả");
                      }}
                      className="text-sky-800 hover:text-sky-950 transition-colors uppercase font-black text-[9px] tracking-widest cursor-pointer"
                    >
                      Xóa bộ lọc 🔄
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    
                    {/* Project Filter */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Dự án công trường</label>
                      <select
                        value={dossierProjectFilter}
                        onChange={(e) => setDossierProjectFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 focus:border-sky-500 outline-none text-xs font-semibold"
                      >
                        <option value="Tất cả">Tất cả dự án ({projects.length})</option>
                        {projects.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    {/* Supplier Filter */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Nhà cung cấp</label>
                      <select
                        value={dossierSupplierFilter}
                        onChange={(e) => setDossierSupplierFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 focus:border-sky-500 outline-none text-xs font-semibold"
                      >
                        <option value="Tất cả">Tất cả nhà cung cấp ({uniqueSuppliers.length})</option>
                        {uniqueSuppliers.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Tình trạng quy trình</label>
                      <select
                        value={dossierStatusFilter}
                        onChange={(e) => setDossierStatusFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 focus:border-sky-500 outline-none text-xs font-semibold"
                      >
                        <option value="Tất cả">Tất cả trạng thái</option>
                        <option value="Chưa gửi">Chưa gửi / Draft</option>
                        <option value="Chờ duyệt">Chờ duyệt / Lưu tạm</option>
                        <option value="Đã gửi dự án">Đã gửi dự án</option>
                        <option value="Dự án đã phản hồi">Dự án đã phản hồi</option>
                        <option value="Thiếu hồ sơ">Thiếu hồ sơ (Phản hồi không đạt)</option>
                        <option value="HSE đã kiểm tra">HSE đã kiểm tra OK</option>
                        <option value="Đã chuyển kế toán">Đã chuyển kế toán</option>
                        <option value="Hoàn tất thanh toán">Hoàn tất thanh toán</option>
                      </select>
                    </div>

                    {/* Month Filter */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Tháng nhận hồ sơ</label>
                      <select
                        value={dossierMonthFilter}
                        onChange={(e) => setDossierMonthFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 focus:border-sky-500 outline-none text-xs font-semibold"
                      >
                        <option value="Tất cả">Tất cả tháng ({uniqueMonths.length})</option>
                        {uniqueMonths.map(m => (
                          <option key={m} value={m}>Tháng {m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Year Filter */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Năm nhận hồ sơ</label>
                      <select
                        value={dossierYearFilter}
                        onChange={(e) => setDossierYearFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 focus:border-sky-500 outline-none text-xs font-semibold"
                      >
                        <option value="Tất cả">Tất cả năm ({uniqueYears.length})</option>
                        {uniqueYears.map(y => (
                          <option key={y} value={y}>Năm {y}</option>
                        ))}
                      </select>
                    </div>

                  </div>
                </div>

                {/* 6. RESULTS TABLE DATA */}
                <div className="bg-white border border-sky-100 rounded-xl shadow-sm overflow-hidden select-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-sky-950 text-white uppercase text-[9.5px] font-bold tracking-wider divide-y">
                          <th className="py-3 px-4 text-center w-12">STT</th>
                          <th className="py-3 px-3">Ngày nhận &amp; Mã PO</th>
                          <th className="py-3 px-3">Nhà cung cấp / Dự án</th>
                          <th className="py-3 px-3">Hạng mục thanh toán</th>
                          <th className="py-3 px-3 text-right">Số tiền (VNĐ)</th>
                          <th className="py-3 px-3 text-center">Tình trạng Chứng từ chính</th>
                          <th className="py-3 px-3 text-center">Trạng thái hồ sơ</th>
                          <th className="py-3 px-3 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[10.5px]">
                        {filteredDossiers.map((d, index) => {
                          const isExpanded = expandedDossierId === d.id;
                          
                          // Check completeness of mandatory files
                          const isComplete = d.has_invoice && d.has_delivery_note && d.has_ppe_request && d.has_quotation_po;

                          // Evaluate linkage with deliveries
                          let linkedDeliveryString = "";
                          let mismatchDetected = false;
                          let checkoutVerdict = "";
                          
                          if (d.linked_delivery_id) {
                            const linkedId = Number(d.linked_delivery_id);
                            const delRecord = deliveries.find(x => x.id === linkedId);
                            if (delRecord) {
                              const delText = `Biên bản: ${delRecord.delivery_note_no} (${delRecord.ppe_type} - ${delRecord.quantity} cái)`;
                              linkedDeliveryString = delText;
                              
                              const targetQty = delRecord.quantity;
                              const currentQty = d.payment_ppe_quantity || 0;
                              if (targetQty === currentQty) {
                                checkoutVerdict = "Khớp khớp hoàn toàn";
                              } else {
                                mismatchDetected = true;
                                checkoutVerdict = `Lệch số lượng (Giao: ${targetQty} cái | Thanh toán: ${currentQty} cái)`;
                              }
                            }
                          }

                          return (
                            <Fragment key={d.id}>
                              {/* Main row */}
                              <tr 
                                className={`hover:bg-slate-50 transition-colors border-l-4 ${
                                  d.status === "Hoàn tất thanh toán" 
                                    ? "border-l-emerald-500" 
                                    : d.status === "Đã chuyển kế toán"
                                    ? "border-l-blue-500"
                                    : d.status === "Thiếu hồ sơ"
                                    ? "border-l-rose-500"
                                    : "border-l-yellow-400"
                                }`}
                              >
                                <td className="py-3 px-2 text-center font-bold text-slate-400">{index + 1}</td>
                                <td className="py-3 px-3 font-semibold space-y-0.5">
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-500">📅</span> {d.received_date}
                                  </div>
                                  <div className="text-[10px] font-mono text-indigo-900 font-bold tracking-tight">
                                    PO No: {d.contract_po_no || "N/A"}
                                  </div>
                                </td>
                                <td className="py-3 px-3 space-y-0.5">
                                  <div className="font-bold text-sky-950 flex items-center gap-1">
                                    <span>🚢</span> {d.supplier_name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded bg-sky-100 border border-sky-300"></span> {d.project_name}
                                  </div>
                                </td>
                                <td className="py-3 px-3 space-y-0.5 max-w-[200px]">
                                  <div className="font-medium text-slate-700 truncate" title={d.payment_content || ""}>
                                    {d.payment_content || "(Trống nội dung)"}
                                  </div>
                                  {d.cost_code && (
                                    <div className="text-[9.5px] text-slate-400 font-bold font-mono">
                                      Mã ngân sách: {d.cost_code}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 text-[11px]">
                                  {d.payment_amount.toLocaleString()} VNĐ
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <div className="flex justify-center items-center gap-1.5">
                                    <span className={`px-1 rounded text-[9.5px] font-black ${d.has_invoice ? "bg-emerald-100 text-emerald-800" : "bg-rose-50 text-rose-300"}`} title="Hóa đơn">🧾</span>
                                    <span className={`px-1 rounded text-[9.5px] font-black ${d.has_delivery_note ? "bg-emerald-100 text-emerald-800" : "bg-rose-50 text-rose-300"}`} title="Biên bản giao nhận">🚚</span>
                                    <span className={`px-1 rounded text-[9.5px] font-black ${d.has_ppe_request ? "bg-emerald-100 text-emerald-800" : "bg-rose-50 text-rose-300"}`} title="Phiếu yêu cầu PPE">📝</span>
                                    <span className={`px-1 rounded text-[9.5px] font-black ${d.has_quotation_po ? "bg-emerald-100 text-emerald-800" : "bg-rose-50 text-rose-300"}`} title="Báo giá / Đơn đặt hàng">📜</span>
                                    {d.has_acceptance_cert > 0 && <span className="px-1 rounded text-[9.5px] font-black bg-blue-100 text-blue-800" title="Biên bản nghiệm thu">🤝</span>}
                                    {d.has_other_docs > 0 && <span className="px-1 rounded text-[9.5px] font-black bg-yellow-100 text-yellow-800" title="Chứng từ khác">📂</span>}
                                  </div>
                                  <div className="mt-1 text-[9px]">
                                    {isComplete 
                                      ? <span className="text-emerald-600 font-bold flex justify-center items-center gap-0.5">🟢 Đủ chứng từ</span>
                                      : <span className="text-rose-500 font-bold flex justify-center items-center gap-0.5">🔴 Thiếu chứng từ</span>
                                    }
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className={`px-2 py-1 rounded-full text-[9px] font-black tracking-tight inline-block ${
                                    d.status === "Hoàn tất thanh toán" 
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm"
                                      : d.status === "Đã chuyển kế toán"
                                      ? "bg-sky-100 text-sky-800 border border-sky-300"
                                      : d.status === "HSE đã kiểm tra"
                                      ? "bg-blue-100 text-blue-850 border border-blue-250"
                                      : d.status === "Dự án đã phản hồi"
                                      ? "bg-indigo-100 text-indigo-850 border border-indigo-250"
                                      : d.status === "Đã gửi dự án"
                                      ? "bg-amber-100 text-amber-850 border border-amber-250"
                                      : d.status === "Thiếu hồ sơ"
                                      ? "bg-rose-100 text-rose-850 border border-rose-250 animate-pulse"
                                      : "bg-slate-100 text-slate-700 border border-slate-250"
                                  }`}>
                                    {d.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <div className="flex justify-center items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={() => setExpandedDossierId(isExpanded ? null : d.id)}
                                      className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                                      title="Xem chi tiết, kiểm soát đối chiếu"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleEditDossier(d)}
                                      className="p-1 text-indigo-400 hover:text-indigo-800 rounded hover:bg-indigo-50 transition-colors cursor-pointer"
                                      title="Biên tập hồ sơ, cập nhật phê duyệt"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => handleDeleteDossier(d.id)}
                                      className="p-1 text-rose-450 hover:text-rose-800 rounded hover:bg-rose-100 transition-colors cursor-pointer"
                                      title="Xóa hồ sơ lưu hạch toán"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Expansion details */}
                              {isExpanded && (
                                <tr className="bg-slate-50 transition-all border-b border-sky-100">
                                  <td colSpan={8} className="p-4 bg-slate-50 border-l-4 border-l-sky-850">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[10.5px]">
                                      
                                      {/* Left: Workflow dates details */}
                                      <div className="space-y-2">
                                        <h4 className="font-extrabold text-sky-900 border-b pb-1 flex items-center gap-1 leading-none uppercase text-[10px] tracking-wide">
                                          <span>⏱️</span> Ghi nhận ngày giờ quy trình
                                        </h4>
                                        <div className="space-y-1 text-slate-600 font-medium">
                                          <div className="flex justify-between">
                                            <span>Nhận từ nhà cung cấp:</span>
                                            <span className="font-bold text-slate-800">{d.received_date}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>HSE gửi email cho dự án:</span>
                                            <span className={`font-bold ${d.hse_email_date ? "text-slate-800" : "text-amber-600 italic"}`}>
                                              {d.hse_email_date || "Chưa soạn gửi"}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Người phụ trách dự án (PIC):</span>
                                            <span className="font-bold text-slate-800">{d.project_pic || "Chưa xác minh"}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Dự án phản hồi hạch toán:</span>
                                            <span className={`font-bold ${d.project_response_date ? "text-slate-800" : "text-slate-400 italic"}`}>
                                              {d.project_response_date || "Chưa có phản hồi"}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Chuyển bàn giao kế toán:</span>
                                            <span className={`font-bold ${d.accounting_transfer_date ? "text-emerald-650" : "text-slate-400 italic"}`}>
                                              {d.accounting_transfer_date || "Chưa làm chứng từ chuyển"}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Kế toán viên tiếp nhận:</span>
                                            <span className="font-bold text-slate-800">{d.accounting_recipient || "Chưa phân công"}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Middle: Linked deliveries and validation */}
                                      <div className="space-y-2">
                                        <h4 className="font-extrabold text-orange-950 border-b pb-1 flex items-center gap-1 leading-none uppercase text-[10px] tracking-wide">
                                          <span>🧩</span> Link &amp; Khớp Dữ Liệu PPE Thực Tế
                                        </h4>
                                        {d.linked_delivery_id ? (
                                          <div className="space-y-2.5">
                                            <div className="bg-orange-50 rounded border border-orange-200 p-2 text-orange-900 leading-normal">
                                              <div className="font-bold">Biên bản giao hàng liên kết:</div>
                                              <div className="font-mono text-[9px] text-slate-600 font-bold mt-0.5">{linkedDeliveryString}</div>
                                            </div>

                                            <div className="space-y-1.5">
                                              <div className="flex justify-between items-center text-[10px]">
                                                <span className="font-bold text-slate-600">SL Quyết toán trong hồ sơ:</span>
                                                <span className="font-black text-indigo-950">{d.payment_ppe_quantity} Bộ/Cái</span>
                                              </div>

                                              <div className="flex justify-between items-center text-[10px]">
                                                <span className="font-bold text-slate-600">SL Giao thực tế trên công trường:</span>
                                                <span className="font-black text-amber-950">
                                                  {deliveries.find(x => x.id === Number(d.linked_delivery_id))?.quantity} Bộ/Cái
                                                </span>
                                              </div>

                                              {/* Check out verification output */}
                                              <div className={`mt-1 text-center py-1 rounded text-[10px] font-black text-white ${
                                                mismatchDetected 
                                                  ? "bg-rose-500 animate-pulse border border-rose-300 shadow-sm" 
                                                  : "bg-emerald-600"
                                              }`}>
                                                {mismatchDetected ? "⚠️ CẢNH BÁO LỆCH SỐ LIỆU!" : "🎉 PHÙ HỢP CÂN BẰNG ĐẦU RA!"}
                                              </div>
                                              
                                              {mismatchDetected && (
                                                <div className="text-[9.5px] text-rose-600 font-bold leading-normal bg-rose-50 p-1 rounded border border-rose-100">
                                                  Cần rà soát chênh lệch {Math.abs((deliveries.find(x => x.id === Number(d.linked_delivery_id))?.quantity || 0) - (d.payment_ppe_quantity || 0))} cái bảo hộ lao động giữa BBGH thực tế tại công trường và tờ khai của nhà cung cấp trên hóa đơn.
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="p-4 text-center rounded bg-slate-150 border border-slate-200 select-none text-slate-400 italic font-medium leading-normal">
                                            Chưa có biên bản giao nhận PPE liên kết. Nhà tuyển dụng hãy bấm Edit bút chì ✏️ để liên kết biên bản nghiệm thu giao hàng và chạy so sánh.
                                          </div>
                                        )}
                                      </div>

                                      {/* Right: Feedback content and notes */}
                                      <div className="space-y-2">
                                        <h4 className="font-extrabold text-blue-900 border-b pb-1 flex items-center gap-1 leading-none uppercase text-[10px] tracking-wide">
                                          <span>✍️</span> Văn bản phản hồi &amp; Lưu ý
                                        </h4>
                                        <div className="space-y-2">
                                          <div className="p-2 bg-white rounded border border-slate-200">
                                            <div className="font-extrabold text-slate-600 text-[9.5px] uppercase tracking-wider mb-0.5">Dự án trả lời:</div>
                                            <div className="text-slate-800 font-medium italic break-words">
                                              {d.project_response_content || "Chưa có phản hồi bằng văn bản từ Chỉ huy trưởng / Giám đốc công trình."}
                                            </div>
                                          </div>

                                          <div className="p-2 bg-white rounded border border-slate-200">
                                            <div className="font-extrabold text-slate-600 text-[9.5px] uppercase tracking-wider mb-0.5">Ghi chú phòng HSE:</div>
                                            <div className="text-slate-800 break-words">
                                              {d.notes || "Hồ sơ lưu trữ bình thường, không có ghi chú bổ sung."}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                        {filteredDossiers.length === 0 && (
                          <tr>
                            <td colSpan={8} className="py-10 text-center text-slate-400 font-bold italic bg-slate-50 border-none">
                              Không tìm thấy hồ sơ thanh toán nào khớp với bộ lọc tìm kiếm của bạn. Hãy thiết lập lại bộ lọc.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            );
          })()}
          {activeTab === "deploy" && (
            <div className="bg-white p-6 rounded-xl border border-sky-100 shadow-sm space-y-6 animate-fade-in text-xs text-slate-700 leading-relaxed">
              
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-sky-900 flex items-center gap-1.5">
                  <span>🚀</span> Hướng dẫn triển khai (Deployment) lên Render.com
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Quy trình đưa máy chủ SQLite & React đóng gói lên môi trường Internet của bạn</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">Bước 1: Lưu trữ mã nguồn</h4>
                    <p>Mở góc settings tải toàn bộ mã nguồn (.zip) từ AI Studio, giải nén và tải lên kho lưu trữ GitHub của doanh nghiệp bạn.</p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">Bước 2: Tạo dịch vụ Web Service</h4>
                    <p>Khởi tạo Web Service mới trên Render, kết nối tới GitHub Repository bạn vừa tạo.</p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">Bước 3: Thiết lập lệnh biên dịch</h4>
                    <p>Cung cấp chính xác 3 chỉ số cần thiết của Nodejs:</p>
                    <div className="bg-slate-900 text-slate-300 font-mono p-3 rounded-lg text-[10px] space-y-0.5 select-all mt-1.5">
                      <div><span className="text-sky-400 font-bold">Runtime:</span> Node</div>
                      <div><span className="text-sky-400 font-bold">Build Command:</span> npm install && npm run build</div>
                      <div><span className="text-sky-400 font-bold">Start Command:</span> npm run start</div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-3 shrink-0">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                    <span>💡</span> Khuyến nghị của Kỹ sư HSE
                  </h4>
                  <p>Mặc định cơ sở dữ liệu SQLite được ghi đè trực tiếp lên đĩa tạm của Render. Để tránh mất dữ liệu khi máy chủ khởi động lại định kỳ, bạn hãy kích hoạt phân vùng đĩa lưu trữ liên tục <span className="font-bold">Render Persistent Disk</span> (Chỉ 1 USD/tháng cho 1GB đĩa) gắn tại thư mục cơ sở dữ liệu của dự án.</p>
                
                  <div className="bg-slate-950 text-emerald-400 font-mono p-3 rounded text-[10px] mt-1 overflow-x-auto leading-relaxed">
                    <pre>{JSON.stringify({
                      "scripts": {
                        "dev": "tsx server.ts",
                        "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
                        "start": "node dist/server.cjs"
                      }
                    }, null, 2)}</pre>
                  </div>
                </div>

              </div>

            </div>
          )}


          {/* =========================================
               TAB 7: SETTINGS & ADMIN CONTROL
             ========================================= */}
          {activeTab === "settings" && (
            <div className="space-y-6 animate-fade-in text-xs text-slate-700 leading-relaxed">
              
              {/* Settings Header */}
              <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="font-bold text-sky-900 text-sm flex items-center gap-1.5">
                    <span>⚙️</span> Cài đặt Danh mục & Bảng giá Hệ thống
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Cấu hình đối tác nhà cung cấp, thiết lập khung đơn giá bảo hộ kinh phí 9.07.02, và theo dõi lịch sử điều chỉnh giá.
                  </p>
                </div>
                {/* Segments switcher */}
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    onClick={() => { setSettingsSubTab("catalogs"); setEditingPpeItem(null); }}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                      settingsSubTab === "catalogs" ? "bg-white text-sky-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    🏗️ Danh mục chung
                  </button>
                  <button
                    onClick={() => { setSettingsSubTab("suppliers"); setEditingPpeItem(null); }}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                      settingsSubTab === "suppliers" ? "bg-white text-sky-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                    id="btn-settings-suppliers"
                  >
                    🤝 Đối tác NCC ({suppliers.length})
                  </button>
                  <button
                    onClick={() => { setSettingsSubTab("pricelists"); setEditingPpeItem(null); }}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                      settingsSubTab === "pricelists" ? "bg-white text-sky-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                    id="btn-settings-prices"
                  >
                    🏷️ Bảng Giá PPE
                  </button>
                  <button
                    onClick={() => { setSettingsSubTab("backups"); setEditingPpeItem(null); }}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      settingsSubTab === "backups" ? "bg-white text-sky-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                    id="btn-settings-backups"
                  >
                    💾 Sao Lưu CSDL
                  </button>
                  <button
                    onClick={() => { setSettingsSubTab("accounts"); setEditingPpeItem(null); }}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      settingsSubTab === "accounts" ? "bg-white text-sky-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                    id="btn-settings-accounts"
                  >
                    👤 Quản Lý Tài Khoản
                  </button>
                </div>
              </div>

              {/* Sub-tab 1: Original Catalogs */}
              {settingsSubTab === "catalogs" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* 1. PROJECTS CONFIGURATION CARD */}
                  <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm flex flex-col h-[600px]">
                    <div className="border-b border-slate-100 pb-2 mb-3">
                      <h4 className="font-bold text-sky-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <span>🏗️</span> Danh mục Dự án ({projects.length})
                      </h4>
                    </div>
                    
                    {/* Addition Form */}
                    {currentUserRole !== "Staff" ? (
                      <form onSubmit={handleAddNewProjectForm} className="mb-4 flex gap-2 shrink-0">
                        <input 
                          type="text" 
                          placeholder="Nhập tên dự án mới... (VD: Dự án F)" 
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          className="flex-1 p-2 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-sky-500 font-bold"
                          required
                        />
                        <button 
                          type="submit" 
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded cursor-pointer select-none transition"
                        >
                          Thêm
                        </button>
                      </form>
                    ) : (
                      <div className="mb-4 p-2 bg-slate-50 text-slate-400 font-bold text-center border rounded">
                        🔒 Quyền Staff: Không thể thêm
                      </div>
                    )}

                    {/* List */}
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                      {projects.map((proj, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 pl-1 group hover:bg-slate-50 rounded transition">
                          {editingProjectName === proj ? (
                            <form key={idx} onSubmit={(e) => { e.preventDefault(); handleSaveProjectEdit(proj); }} className="flex items-center gap-1.5 w-full pr-1">
                              <input
                                type="text"
                                value={projectFormName}
                                onChange={(e) => setProjectFormName(e.target.value)}
                                className="flex-1 p-1 border border-sky-400 bg-sky-50 rounded text-xs font-black focus:outline-none"
                                required
                                autoFocus
                              />
                              <button
                                type="submit"
                                className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] rounded cursor-pointer"
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingProjectName(null)}
                                className="px-1.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 text-[10px] rounded cursor-pointer font-bold"
                              >
                                Hủy
                              </button>
                            </form>
                          ) : (
                            <>
                              <span className="font-bold text-slate-800">{proj}</span>
                              {currentUserRole !== "Staff" && (
                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setEditingProjectName(proj);
                                      setProjectFormName(proj);
                                    }}
                                    className="text-sky-600 hover:text-sky-800 p-1 rounded font-bold hover:bg-sky-50 leading-none"
                                    title={`Chỉnh sửa ${proj}`}
                                  >
                                    ✏️
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleDeleteProjectForm(proj)}
                                    className="text-rose-500 hover:text-rose-700 p-1 rounded font-bold hover:bg-rose-50 leading-none mr-1"
                                    title={`Xóa dự án ${proj}`}
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. PPE TYPES CONFIGURATION CARD */}
                  <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm flex flex-col h-[600px]">
                    <div className="border-b border-slate-100 pb-2 mb-3">
                      <h4 className="font-bold text-sky-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <span>🛡️</span> Chủng loại PPE ({ppeTypesDetailed.length})
                      </h4>
                    </div>
                    
                    {/* Addition Form */}
                    {currentUserRole !== "Staff" ? (
                      <form onSubmit={handleAddNewPpeForm} className="space-y-2 mb-4 shrink-0 bg-slate-50 p-2.5 rounded border border-slate-200">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Tên PPE mới</label>
                          <input 
                            type="text" 
                            placeholder="Tên trang bị (VD: Áo ghi lê phản quang)" 
                            value={newPpeName}
                            onChange={(e) => setNewPpeName(e.target.value)}
                            className="w-full p-2 border border-slate-200 bg-white rounded text-xs focus:ring-1 focus:ring-sky-500 font-bold"
                            required
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Đơn vị tính</label>
                            <input 
                              type="text" 
                              placeholder="Cái, Bộ, Đôi..." 
                              value={newPpeUnit}
                              onChange={(e) => setNewPpeUnit(e.target.value)}
                              className="w-full p-2 border border-slate-200 bg-white rounded text-xs focus:ring-1 focus:ring-sky-500 font-bold"
                              required
                            />
                          </div>
                          <div className="flex items-end">
                            <button 
                              type="submit" 
                              className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded cursor-pointer select-none transition text-xs"
                            >
                              Thêm PPE
                            </button>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Mô tả định mức (Nếu có)</label>
                          <input 
                            type="text" 
                            placeholder="Ghi chú sử dụng (VD: Cấp 3 cái/năm)" 
                            value={newPpeDescription}
                            onChange={(e) => setNewPpeDescription(e.target.value)}
                            className="w-full p-2 border border-slate-200 bg-white rounded text-xs focus:ring-1 focus:ring-sky-500 font-medium"
                          />
                        </div>
                      </form>
                    ) : (
                      <div className="mb-4 p-3 bg-slate-50 text-slate-400 font-bold text-center border rounded">
                        🔒 Quyền Staff: Đọc danh mục PPE
                      </div>
                    )}

                    {/* List */}
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                      {ppeTypesDetailed.map((item, idx) => (
                        <div key={idx} className="py-2 pl-1 group hover:bg-slate-50 rounded transition">
                          {editingCatalogPpeId === item.id ? (
                            <form 
                              key={idx}
                              onSubmit={(e) => { e.preventDefault(); handleSavePpeCatalogEdit(item.id!); }}
                              className="space-y-1.5 p-1.5 bg-sky-50/50 border border-sky-100 rounded"
                            >
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Tên trang bị *</label>
                                <input
                                  type="text"
                                  value={catalogPpeForm.name}
                                  onChange={(e) => setCatalogPpeForm({ ...catalogPpeForm, name: e.target.value })}
                                  className="w-full p-1 border border-sky-400 bg-white rounded text-xs font-black focus:outline-none"
                                  required
                                  autoFocus
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Đơn vị *</label>
                                  <input
                                    type="text"
                                    value={catalogPpeForm.unit}
                                    onChange={(e) => setCatalogPpeForm({ ...catalogPpeForm, unit: e.target.value })}
                                    className="w-full p-1 border border-slate-300 bg-white rounded text-xs font-bold"
                                    required
                                  />
                                </div>
                                <div className="flex items-end justify-end gap-1">
                                  <button
                                    type="submit"
                                    className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] rounded cursor-pointer h-7 flex items-center justify-center flex-1 font-bold"
                                  >
                                    Lưu
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCatalogPpeId(null)}
                                    className="px-2 py-1 bg-slate-200 text-slate-700 font-bold text-[10px] rounded cursor-pointer h-7 flex items-center justify-center flex-1 font-bold"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Ghi chú định mức / mô tả</label>
                                <input
                                  type="text"
                                  placeholder="Không bắt buộc"
                                  value={catalogPpeForm.description}
                                  onChange={(e) => setCatalogPpeForm({ ...catalogPpeForm, description: e.target.value })}
                                  className="w-full p-1 border border-slate-300 bg-white rounded text-[11px]"
                                />
                              </div>
                            </form>
                          ) : (
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 pr-2">
                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <span>{item.name}</span>
                                  <span className="text-[10px] text-sky-600 px-1.5 bg-sky-50 border border-sky-100 rounded font-black">{item.unit || "Cái"}</span>
                                </div>
                                {item.description && (
                                  <p className="text-[10px] text-slate-400 italic mt-0.5 truncate" title={item.description}>{item.description}</p>
                                )}
                              </div>
                              {currentUserRole !== "Staff" && (
                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 mt-0.5">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setEditingCatalogPpeId(item.id || null);
                                      setCatalogPpeForm({
                                        name: item.name,
                                        unit: item.unit || "Cái",
                                        description: item.description || ""
                                      });
                                    }}
                                    className="text-sky-600 hover:text-sky-800 p-1 rounded font-bold hover:bg-sky-50 leading-none"
                                    title={`Sửa ${item.name}`}
                                  >
                                    ✏️
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleDeletePpeForm(item.name)}
                                    className="text-rose-500 hover:text-rose-700 p-1 rounded font-bold hover:bg-rose-50 leading-none mr-1"
                                    title={`Xóa trang bị ${item.name}`}
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. ROLES CONFIGURATION CARD */}
                  <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm flex flex-col h-[600px]">
                    <div className="border-b border-slate-100 pb-2 mb-3">
                      <h4 className="font-bold text-sky-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <span>👷</span> Chức vụ Nhân sự ({employeeRoles.length})
                      </h4>
                    </div>
                    
                    {/* Addition Form */}
                    {currentUserRole !== "Staff" ? (
                      <form onSubmit={handleAddNewRoleForm} className="space-y-2 mb-4 shrink-0 bg-slate-50 p-2.5 rounded border border-slate-200">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Tên Chức vụ mới</label>
                          <input 
                            type="text" 
                            placeholder="Chức vụ (VD: Chỉ huy phó, Giám sát viên)" 
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            className="w-full p-2 border border-slate-200 bg-white rounded text-xs focus:ring-1 focus:ring-sky-500 font-bold"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Mô tả vai trò</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="Mô tả công việc" 
                              value={newRoleDescription}
                              onChange={(e) => setNewRoleDescription(e.target.value)}
                              className="flex-1 p-2 border border-slate-200 bg-white rounded text-xs focus:ring-1 focus:ring-sky-500 font-medium"
                            />
                            <button 
                              type="submit" 
                              className="px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded cursor-pointer select-none transition text-xs shrink-0"
                            >
                              Thêm
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <div className="mb-4 p-3 bg-slate-50 text-slate-400 font-bold text-center border rounded">
                        🔒 Quyền Staff: Đọc danh mục chức vụ
                      </div>
                    )}

                    {/* List */}
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                      {employeeRoles.map((role, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 pl-1 group hover:bg-slate-50 rounded transition">
                          {editingRoleName === role ? (
                            <form key={idx} onSubmit={(e) => { e.preventDefault(); handleSaveRoleEdit(role); }} className="flex items-center gap-1.5 w-full pr-1">
                              <input
                                type="text"
                                value={roleFormName}
                                onChange={(e) => setRoleFormName(e.target.value)}
                                className="flex-1 p-1 border border-sky-400 bg-sky-50 rounded text-xs font-black focus:outline-none"
                                required
                                autoFocus
                              />
                              <button
                                type="submit"
                                className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] rounded cursor-pointer"
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRoleName(null)}
                                className="px-1.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 text-[10px] rounded cursor-pointer font-bold"
                              >
                                Hủy
                              </button>
                            </form>
                          ) : (
                            <>
                              <span className="font-bold text-slate-800">{role}</span>
                              {currentUserRole !== "Staff" && (
                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setEditingRoleName(role);
                                      setRoleFormName(role);
                                      setRoleFormDescription("");
                                    }}
                                    className="text-sky-600 hover:text-sky-800 p-1 rounded font-bold hover:bg-sky-50 leading-none"
                                    title={`Chỉnh sửa ${role}`}
                                  >
                                    ✏️
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleDeleteRoleForm(role)}
                                    className="text-rose-500 hover:text-rose-700 p-1 rounded font-bold hover:bg-rose-50 leading-none mr-1"
                                    title={`Xóa chức vụ ${role}`}
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* Sub-tab 2: Suppliers Catalog */}
              {settingsSubTab === "suppliers" && (
                <div className="space-y-6">
                  
                  {/* Supplier Form */}
                  <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-sm">
                    <h4 className="font-bold text-sky-900 text-xs uppercase tracking-wider mb-3 border-b pb-2 flex items-center justify-between">
                      <span>{editingSupplierId ? "✍️ CẬP NHẬT THÔNG TIN NHÀ CUNG CẤP" : "➕ THÊM NHÀ CUNG CẤP ĐỐI TÁC MỚI"}</span>
                      {editingSupplierId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSupplierId(null);
                            setSupplierForm({ name: "", contact_person: "", phone: "", note: "", status: "Đang sử dụng" });
                          }}
                          className="text-[9px] bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded font-bold"
                        >
                          Hủy Chỉnh Sửa
                        </button>
                      )}
                    </h4>

                    {currentUserRole !== "Staff" ? (
                      <form onSubmit={handleSaveSupplier} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tên Nhà Cung Cấp *</label>
                          <input
                            type="text"
                            placeholder="VD: Bảo hộ lao động An Phát"
                            value={supplierForm.name}
                            onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                            className="w-full p-2 border border-slate-250 bg-slate-50/50 rounded focus:bg-white text-xs font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Người Liên Hệ</label>
                          <input
                            type="text"
                            placeholder="VD: Ông Nguyễn Văn Phát"
                            value={supplierForm.contact_person}
                            onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                            className="w-full p-2 border border-slate-250 bg-slate-50/50 rounded focus:bg-white text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Số Điện Thoại</label>
                          <input
                            type="text"
                            placeholder="VD: 0901234567"
                            value={supplierForm.phone}
                            onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                            className="w-full p-2 border border-slate-250 bg-slate-50/50 rounded focus:bg-white text-xs font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Trạng Thái Đang Dùng</label>
                          <select
                            value={supplierForm.status}
                            onChange={(e) => setSupplierForm({ ...supplierForm, status: e.target.value })}
                            className="w-full p-2 border border-slate-250 bg-slate-50/50 rounded focus:bg-white text-xs font-bold text-sky-900 mb-0.5"
                          >
                            <option value="Đang sử dụng">🟢 Đang sử dụng</option>
                            <option value="Ngừng sử dụng">🔴 Ngừng sử dụng</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            type="submit"
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded shadow transition cursor-pointer"
                            id="btn-save-supplier"
                          >
                            {editingSupplierId ? "Cập Nhật NCC" : "Kích Hoạt NCC"}
                          </button>
                        </div>
                        <div className="md:col-span-5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ghi Chú Chung</label>
                          <input
                            type="text"
                            placeholder="VD: Nhà cung ứng nón bảo hộ chính và đồng phục cấp phát cho dự án miền Nam..."
                            value={supplierForm.note}
                            onChange={(e) => setSupplierForm({ ...supplierForm, note: e.target.value })}
                            className="w-full p-2 border border-slate-250 bg-slate-50/50 rounded focus:bg-white text-xs"
                          />
                        </div>
                      </form>
                    ) : (
                      <div className="p-4 bg-amber-50 text-amber-900 border border-amber-200 rounded font-bold text-center">
                        ⚠️ Bạn đang xem dưới quyền Staff. Chỉ tài khoản Quản trị viên và HSE mới có thể Sửa/Xóa nhà cung cấp!
                      </div>
                    )}
                  </div>

                  {/* Suppliers List Table */}
                  <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-sky-50 flex items-center justify-between">
                      <h4 className="font-bold text-sky-900 text-xs uppercase tracking-wider">
                        Danh sách đối tác cung ứng PPE hiện hành ({suppliers.length})
                      </h4>
                    </div>

                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-250">
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide">STT</th>
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide">Nhà cung cấp</th>
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide">Người liên hệ</th>
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide">Điện thoại</th>
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide">Ghi chú vận hành</th>
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide">Trạng thái</th>
                          {currentUserRole !== "Staff" && (
                            <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide text-right">Hành động</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {suppliers.map((s, idx) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 transition">
                            <td className="p-3 font-mono">{idx + 1}</td>
                            <td className="p-3">
                              <span className="font-extrabold text-slate-900">{s.name}</span>
                            </td>
                            <td className="p-3 font-medium text-slate-700">{s.contact_person || "---"}</td>
                            <td className="p-3 font-mono font-bold text-slate-700">{s.phone || "---"}</td>
                            <td className="p-3 text-slate-500 max-w-xs truncate" title={s.note}>{s.note || "---"}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.status === "Đang sử dụng" ? "bg-green-100 text-green-800" : "bg-rose-100 text-rose-800"
                              }`}>
                                {s.status}
                              </span>
                            </td>
                            {currentUserRole !== "Staff" && (
                              <td className="p-3 text-right space-x-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSupplierId(s.id);
                                    setSupplierForm({
                                      name: s.name,
                                      contact_person: s.contact_person || "",
                                      phone: s.phone || "",
                                      note: s.note || "",
                                      status: s.status
                                    });
                                  }}
                                  className="px-2 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-bold rounded transition-colors"
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSupplier(s.id, s.name)}
                                  className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold rounded transition-colors"
                                >
                                  Xóa
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {suppliers.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                              Chưa có đối tác nhà cung cấp nào được cấu hình trên luồng dữ liệu.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

              {/* Sub-tab 3: Price Lists & Logs */}
              {settingsSubTab === "pricelists" && (
                <div className="space-y-6">
                  
                  {/* Detailed pricing editor form drawer */}
                  {editingPpeItem && (
                    <div className="bg-white p-5 rounded-xl border-2 border-sky-450 shadow-md animate-fade-in/70">
                      <h4 className="font-bold text-sky-900 text-xs uppercase tracking-wider mb-3 border-b pb-2 flex items-center justify-between">
                        <span>🏷️ ĐIỀU CHỈNH ĐƠN GIÁ DANH MỤC: {editingPpeItem.name}</span>
                        <button
                          type="button"
                          onClick={() => setEditingPpeItem(null)}
                          className="text-[9px] bg-slate-100 text-slate-600 hover:bg-slate-200 px-2.5 py-1 rounded font-bold cursor-pointer"
                        >
                          Hủy Bỏ
                        </button>
                      </h4>

                      {currentUserRole !== "Staff" ? (
                        <form onSubmit={handleSavePpeDetailed} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mã Định Danh (Mã PPE) *</label>
                            <input
                              type="text"
                              value={editingPpeItem.code || ""}
                              onChange={(e) => setEditingPpeItem({ ...editingPpeItem, code: e.target.value })}
                              placeholder="VD: PPE001"
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs font-mono font-bold animate-pulse"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Đơn Giá Kế Hoạch (VNĐ) *</label>
                            <input
                              type="number"
                              value={editingPpeItem.unit_price || 0}
                              onChange={(e) => setEditingPpeItem({ ...editingPpeItem, unit_price: Number(e.target.value) })}
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs font-mono font-black text-rose-700"
                              min={0}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Đơn vị tính *</label>
                            <input
                              type="text"
                              value={editingPpeItem.unit}
                              onChange={(e) => setEditingPpeItem({ ...editingPpeItem, unit: e.target.value })}
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs font-bold"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">NCC Áp Dụng Mặc Định *</label>
                            <select
                              value={editingPpeItem.supplier_name || ""}
                              onChange={(e) => setEditingPpeItem({ ...editingPpeItem, supplier_name: e.target.value })}
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs font-bold text-sky-950"
                              required
                            >
                              <option value="">-- Chọn Nhà Cung Cấp --</option>
                              {suppliers.map(s => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ngày Áp Dụng Đơn Giá *</label>
                            <input
                              type="date"
                              value={editingPpeItem.price_apply_date || ""}
                              onChange={(e) => setEditingPpeItem({ ...editingPpeItem, price_apply_date: e.target.value })}
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs font-mono font-bold"
                              required
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Lý do điều chỉnh (Lưu vào lịch sử)</label>
                            <input
                              type="text"
                              placeholder="VD: Đối tác tăng giá nguyên vật liệu, trượt giá đồng, v.v..."
                              value={editingPpeItem.note || ""}
                              onChange={(e) => setEditingPpeItem({ ...editingPpeItem, note: e.target.value })}
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs"
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              type="submit"
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded hover:shadow-lg transition duration-200 cursor-pointer"
                            >
                              Lưu Đơn Giá & Ghi Lịch Sử
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="p-3 bg-red-50 text-red-900 rounded font-bold text-center">
                          🔒 Bạn không có quyền chỉnh sửa bảng giá này dưới chế độ Staff!
                        </div>
                      )}
                    </div>
                  )}

                  {/* New pricing creation form drawer */}
                  {isAddingPpeItem && (
                    <div className="bg-white p-5 rounded-xl border-2 border-sky-500 shadow-md animate-fade-in/70">
                      <h4 className="font-bold text-sky-950 text-xs uppercase tracking-wider mb-3 border-b pb-2 flex items-center justify-between">
                        <span>➕ THÊM MỚI TRANG BỊ BẢO HỘ (PPE) VÀO DANH MỤC</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingPpeItem(false);
                            setNewPpeItemForm({
                              name: "",
                              unit: "Cái",
                              description: "",
                              code: "",
                              unit_price: 0,
                              supplier_name: "",
                              price_apply_date: "",
                              note: ""
                            });
                          }}
                          className="text-[9px] bg-slate-100 text-slate-600 hover:bg-slate-200 px-2.5 py-1 rounded font-bold cursor-pointer"
                        >
                          Hủy Bỏ
                        </button>
                      </h4>

                      {currentUserRole !== "Staff" ? (
                        <form onSubmit={handleCreatePpeItem} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tên Trang Bị (Mặt hàng) *</label>
                            <input
                              type="text"
                              value={newPpeItemForm.name}
                              onChange={(e) => setNewPpeItemForm({ ...newPpeItemForm, name: e.target.value })}
                              placeholder="VD: Quần áo chống hóa chất, Kính an toàn..."
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs font-bold"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mã Định Danh (Mã PPE)</label>
                            <input
                              type="text"
                              value={newPpeItemForm.code}
                              onChange={(e) => setNewPpeItemForm({ ...newPpeItemForm, code: e.target.value })}
                              placeholder="VD: PPE020"
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Đơn Giá Kế Hoạch (VNĐ) *</label>
                            <input
                              type="number"
                              value={newPpeItemForm.unit_price}
                              onChange={(e) => setNewPpeItemForm({ ...newPpeItemForm, unit_price: Number(e.target.value) })}
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs font-mono font-black text-rose-700"
                              min={0}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Đơn vị tính *</label>
                            <input
                              type="text"
                              value={newPpeItemForm.unit}
                              onChange={(e) => setNewPpeItemForm({ ...newPpeItemForm, unit: e.target.value })}
                              placeholder="VD: Cái, Đôi, Bộ"
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs font-bold"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">NCC Áp Dụng Mặc Định</label>
                            <select
                              value={newPpeItemForm.supplier_name}
                              onChange={(e) => setNewPpeItemForm({ ...newPpeItemForm, supplier_name: e.target.value })}
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs font-bold text-sky-950"
                            >
                              <option value="">-- Chọn Nhà Cung Cấp --</option>
                              {suppliers.map(s => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ngày Áp Dụng Đơn Giá *</label>
                            <input
                              type="date"
                              value={newPpeItemForm.price_apply_date || getTodayString()}
                              onChange={(e) => setNewPpeItemForm({ ...newPpeItemForm, price_apply_date: e.target.value })}
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs font-mono font-bold"
                              required
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mô tả / Ghi chú</label>
                            <input
                              type="text"
                              placeholder="VD: Sử dụng cho kĩ sư hiện trường, hãng 3M..."
                              value={newPpeItemForm.note}
                              onChange={(e) => setNewPpeItemForm({ ...newPpeItemForm, note: e.target.value })}
                              className="w-full p-2 border border-slate-250 bg-slate-50 rounded focus:bg-white text-xs"
                            />
                          </div>
                          <div className="md:col-span-4 flex justify-end gap-2 pt-2 border-t mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingPpeItem(false);
                                setNewPpeItemForm({
                                  name: "",
                                  unit: "Cái",
                                  description: "",
                                  code: "",
                                  unit_price: 0,
                                  supplier_name: "",
                                  price_apply_date: "",
                                  note: ""
                                });
                              }}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded transition duration-200 cursor-pointer"
                            >
                              Hủy bỏ
                            </button>
                            <button
                              type="submit"
                              className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs uppercase rounded hover:shadow-lg transition duration-200 cursor-pointer"
                            >
                              Tạo Mới & Đồng Bộ
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="p-3 bg-red-50 text-red-900 rounded font-bold text-center">
                          🔒 Bạn không có quyền thêm mới bảng giá này dưới chế độ Staff!
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main Catalog Price List Table */}
                  <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-sky-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <h4 className="font-bold text-sky-900 text-xs uppercase tracking-wider">
                        Bảng giá kế hoạch phân bổ an toàn (Cơ bản của Ngân sách 9.07.02)
                      </h4>
                      {currentUserRole !== "Staff" && !isAddingPpeItem && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingPpeItem(true);
                            setEditingPpeItem(null);
                          }}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow active:scale-95"
                        >
                          <span>➕</span> Thêm Mặt Hàng PPE Mới
                        </button>
                      )}
                    </div>

                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-250">
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide">Mã PPE</th>
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide">Mặt hàng bảo hộ</th>
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide">ĐVT</th>
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide text-right">Đơn giá định mức (đ)</th>
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide">Nhà cung ứng mặc định</th>
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide">Ngày áp dụng</th>
                          <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide">Mô tả/Ghi chú</th>
                          {currentUserRole !== "Staff" && (
                            <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wide text-right">Thao tác</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {ppeTypesDetailed.map((item) => {
                          const price = item.unit_price ? Number(item.unit_price) : 0;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition">
                              <td className="p-3 font-mono font-bold text-sky-950">{item.code || "N/A"}</td>
                              <td className="p-3 font-extrabold text-slate-900">{item.name}</td>
                              <td className="p-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-[10px]">{item.unit || "Cái"}</span></td>
                              <td className="p-3 text-right font-mono font-extrabold text-rose-700">
                                {price > 0 ? `${price.toLocaleString()}đ` : (
                                  <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">Chưa thiết lập</span>
                                )}
                              </td>
                              <td className="p-3 font-semibold text-slate-700">{item.supplier_name || "---"}</td>
                              <td className="p-3 font-mono text-slate-500">{item.price_apply_date || "2026-01-01"}</td>
                              <td className="p-3 text-slate-500 italic max-w-xs truncate" title={item.note}>{item.note || "---"}</td>
                              {currentUserRole !== "Staff" && (
                                <td className="p-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingPpeItem({
                                        id: item.id,
                                        name: item.name,
                                        unit: item.unit || "Cái",
                                        description: item.description || "",
                                        code: item.code || `PPE${String(item.id).padStart(3, '0')}`,
                                        unit_price: price,
                                        supplier_name: item.supplier_name || (suppliers.length > 0 ? suppliers[0].name : ""),
                                        price_apply_date: item.price_apply_date || getTodayString(),
                                        note: ""
                                      });
                                      // Scroll smoothly to form
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-black rounded transition shadow-sm cursor-pointer"
                                  >
                                    Chỉnh giá
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pricing adjustments historic timeline logs */}
                  <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-900 text-slate-100 border-b border-slate-800 flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <span>📜</span> LỊCH SỬ BIẾN ĐỘNG & ĐIỀU CHỈNH ĐƠN GIÁ CHI TIẾT ({ppePriceHistory.length})
                      </h4>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                      {ppePriceHistory.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-slate-50/50 transition text-[11px] flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-xs">{log.ppe_name}</span>
                              <span className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-500 px-1 py-0.5 rounded font-bold font-mono">ID: #{log.ppe_id}</span>
                            </div>
                            <p className="text-[10px] text-slate-500">
                              Lý do: <span className="font-medium text-slate-700 italic">"{log.note || "Không có lý do chi tiết"}"</span>
                            </p>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-slate-500 font-bold">Giá cũ:</span>
                            <span className="font-mono text-slate-600 line-through">{(log.old_price || 0).toLocaleString()}đ</span>
                            <span className="text-emerald-700 font-black">➔</span>
                            <span className="text-slate-500 font-bold">Giá mới:</span>
                            <span className="font-mono font-black text-rose-700 text-xs bg-rose-50 px-2 py-0.5 rounded border border-rose-150">{(log.new_price || 0).toLocaleString()}đ</span>
                          </div>

                          <div className="text-right text-[10px] text-slate-400 font-bold font-mono space-y-0.5">
                            <div>Thay đổi: <span className="text-slate-600">{log.change_date}</span></div>
                            <div>Bởi: <span className="text-sky-700">{log.changed_by}</span></div>
                          </div>
                        </div>
                      ))}
                      {ppePriceHistory.length === 0 && (
                        <div className="p-6 text-center text-slate-400 font-bold italic">
                          Chưa ghi nhận biến động giá hay điều chỉnh ngân sách nào từ xuất bản hệ thống.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* Sub-tab 4: Database Backups */}
              {settingsSubTab === "backups" && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl border border-sky-100 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
                      <div>
                        <h4 className="font-extrabold text-sky-950 text-xs uppercase tracking-wide">
                          💾 SAO LƯU VÀ PHỤC HỒI CƠ SỞ DỮ LIỆU (SQLITE BACKUPS)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                          Hệ thống hỗ trợ cơ chế tự động sao lưu dữ liệu SQLite hàng tuần vào thư mục riêng biệt. Bạn cũng có thể chủ động tạo bản sao lưu thủ công hoặc phục hồi lại trạng thái dữ liệu cũ từ danh sách bên dưới.
                        </p>
                      </div>
                      
                      {currentUserRole !== 'Staff' && (
                        <button
                          type="button"
                          onClick={handleCreateBackup}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                        >
                          <span>➕</span> Tạo Bản Sao Lưu Thủ Công
                        </button>
                      )}
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-[11px] leading-relaxed text-slate-600">
                      <p className="font-bold text-slate-700"><span className="text-sky-600">💡 Lưu ý quan trọng:</span></p>
                      <ul className="list-disc pl-4 mt-1 space-y-1">
                        <li>Bản sao lưu tự động hàng tuần được kí hiệu bằng hậu tố <span className="font-mono text-xs font-bold bg-slate-100 px-1 rounded">auto</span>.</li>
                        <li><strong>Khi phục hồi:</strong> Toàn bộ dữ liệu hiện tại trong cơ sở dữ liệu sẽ bị thay thế triệt để bởi nội dung file phục hồi. Vui lòng cân nhắc kĩ trước khi thực hiện.</li>
                        <li>Đảm bảo hệ thống không chạy các tác vụ sửa đổi lớn trong lúc phục hồi để tránh xung đột khoá dữ liệu (SQLite file lock).</li>
                      </ul>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-100 overflow-hidden shadow-sm">
                      <div className="p-3 bg-slate-900 text-slate-100 font-bold text-xs uppercase tracking-wider">
                        Danh sách các bản sao lưu đã lưu trữ ({backupsList.length})
                      </div>
                      <div className="divide-y divide-slate-100">
                        {backupsList.map((bk) => (
                          <div key={bk.filename} className="p-4 hover:bg-slate-50 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-[11px]">
                            <div className="space-y-1">
                              <p className="font-mono text-slate-800 font-black text-xs flex items-center gap-1.5">
                                <span>📄</span> {bk.filename}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-bold font-mono">
                                <span>Kích thước: <strong className="text-slate-600">{(bk.size / 1024).toFixed(1)} KB</strong></span>
                                <span>&bull;</span>
                                <span>Loại: {bk.is_auto ? <span className="text-sky-600">📅 Tự động hàng tuần</span> : <span className="text-amber-600">👤 Thủ công</span>}</span>
                                <span>&bull;</span>
                                <span>Ngày khởi tạo: <strong className="text-slate-600">{bk.created_at}</strong></span>
                              </div>
                            </div>

                            {currentUserRole !== 'Staff' && (
                              <button
                                type="button"
                                onClick={() => handleRestoreBackup(bk.filename)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold rounded border border-rose-200 transition-all cursor-pointer"
                              >
                                🔄 Phục hồi dữ liệu này
                              </button>
                            )}
                          </div>
                        ))}
                        {backupsList.length === 0 && (
                          <div className="p-8 text-center text-slate-400 font-bold italic">
                            Chưa có bất kì bản sao lưu SQLite nào được ghi nhận trong thư mục backups.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 5: User Accounts and Passwords */}
              {settingsSubTab === "accounts" && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl border border-sky-100 shadow-sm space-y-4">
                    <div>
                      <h4 className="font-extrabold text-sky-950 text-xs uppercase tracking-wide">
                        👤 QUẢN TRỊ TÀI KHOẢN & ĐỔI MẬT KHẨU HỆ THỐNG
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Thay đổi mật khẩu tài khoản hiện tại hoặc quản lý phân quyền và khởi tạo nhân sự truy cập mới (đối với quản trị viên Admin).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                      {/* Left side: Change Password (All users can perform this) */}
                      <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                        <div>
                          <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                            🔒 Thay Đổi Mật Khẩu
                          </h5>
                          <p className="text-[10px] text-slate-400">Đổi mật khẩu cho tài khoản hiện tại: <strong className="text-sky-700 font-bold">{currentLoginUsername} ({currentUserName})</strong></p>
                        </div>

                        <form onSubmit={handleChangeCurrentUserPassword} className="space-y-3">
                          {changePasswordSuccess && (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded font-medium">
                              ✅ {changePasswordSuccess}
                            </div>
                          )}
                          {changePasswordError && (
                            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded font-medium">
                              ⚠️ {changePasswordError}
                            </div>
                          )}

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Mật khẩu hiện tại:</label>
                            <input
                              type="password"
                              placeholder="Nhập mật khẩu hiện tại"
                              value={passwordForm.currentPassword}
                              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                              className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Mật khẩu mới:</label>
                            <input
                              type="password"
                              placeholder="Nhập mật khẩu mới"
                              value={passwordForm.newPassword}
                              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                              className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Xác nhận mật khẩu mới:</label>
                            <input
                              type="password"
                              placeholder="Nhập lại mật khẩu mới"
                              value={passwordForm.confirmPassword}
                              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                              className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded text-xs transition-colors cursor-pointer"
                          >
                            Cập nhật mật khẩu mới
                          </button>
                        </form>
                      </div>

                      {/* Right side: Accounts list and assignment (Only Admin role users can view/add/delete) */}
                      <div className="lg:col-span-7 space-y-6">
                        {currentUserRole === "Admin" ? (
                          <>
                            {/* Card 1: Add Account */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                              <div>
                                <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                                  ➕ Thêm Tài Khoản Mới
                                </h5>
                                <p className="text-[10px] text-slate-400">Khởi tạo nhân khẩu truy cập và thiết lập phân quyền trực thuộc</p>
                              </div>

                              <form onSubmit={handleCreateUserAccount} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="md:col-span-2">
                                  {addUserSuccess && (
                                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded font-medium">
                                      ✅ {addUserSuccess}
                                    </div>
                                  )}
                                  {addUserError && (
                                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded font-medium">
                                      ⚠️ {addUserError}
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tên đăng nhập (username):</label>
                                  <input
                                    type="text"
                                    placeholder="Ví dụ: nguyenlena, hse_crew"
                                    value={newUserForm.username}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Mật khẩu ban đầu:</label>
                                  <input
                                    type="password"
                                    placeholder="Nhập mật khẩu cho thành viên"
                                    value={newUserForm.password}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Họ và Tên chủ sở hữu:</label>
                                  <input
                                    type="text"
                                    placeholder="Ví dụ: Nguyễn Lê Nam"
                                    value={newUserForm.fullname}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, fullname: e.target.value })}
                                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Phân quyền vai trò:</label>
                                  <select
                                    value={newUserForm.role}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                                  >
                                    <option value="Admin">🔑 Admin (Toàn quyền)</option>
                                    <option value="HSE">📋 HSE Admin (Duyệt/Ký)</option>
                                    <option value="Staff">🔒 Staff (Chỉ đọc dữ liệu)</option>
                                  </select>
                                </div>

                                <div className="md:col-span-2 pt-2">
                                  <button
                                    type="submit"
                                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded text-xs transition-colors cursor-pointer"
                                  >
                                    Khởi tạo tài khoản
                                  </button>
                                </div>
                              </form>
                            </div>

                            {/* Card 2: Users List */}
                            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                              <div className="p-3 bg-slate-900 text-slate-100 font-bold text-xs uppercase tracking-wider flex justify-between items-center">
                                <span>👥 Danh sách tài khoản hệ thống ({usersList.length})</span>
                                <span className="text-[10px] text-slate-400 normal-case font-medium">Bảo mật SQLite</span>
                              </div>
                              <div className="divide-y divide-slate-100">
                                {usersList.map((user) => (
                                  <div key={user.id} className="p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-[11px]">
                                    <div className="space-y-1">
                                      <p className="font-bold text-slate-800 text-xs flex items-center gap-2">
                                        <span>👤 {user.fullname}</span>
                                        <span className="text-[10px] font-mono text-slate-400 font-normal">(@{user.username})</span>
                                      </p>
                                      <div className="flex items-center gap-2">
                                        {user.role === "Admin" && (
                                          <span className="px-1.5 py-0.5 bg-red-50 text-red-700 font-bold text-[9px] rounded-full border border-red-200 uppercase tracking-wide">
                                            🔑 Admin
                                          </span>
                                        )}
                                        {user.role === "HSE" && (
                                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 font-bold text-[9px] rounded-full border border-amber-200 uppercase tracking-wide">
                                            📋 HSE Admin
                                          </span>
                                        )}
                                        {user.role === "Staff" && (
                                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[9px] rounded-full border border-emerald-200 uppercase tracking-wide">
                                            🔒 Staff
                                          </span>
                                        )}
                                        <span className="text-[10px] text-slate-400">• ID: {user.id}</span>
                                      </div>
                                    </div>

                                    {user.username !== "admin" ? (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteUserAccount(user.id, user.username)}
                                        className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-white hover:bg-rose-600 hover:border-transparent font-bold rounded border border-rose-200 transition-all cursor-pointer"
                                      >
                                        🗑 Xóa tài khoản
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">Mặc định hệ thống</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-850 leading-relaxed font-medium text-xs flex flex-col items-center gap-2.5">
                            <span className="text-2xl">🚧</span>
                            <div>
                              <p className="font-bold">Quyền hạn chế khởi tạo!</p>
                              <p className="text-[10px] text-amber-700 mt-1">
                                Bạn hiện đang truy cập với quyền <strong className="font-bold text-amber-850">{currentUserRole}</strong>. Chỉ tài khoản vai trò <strong className="font-bold text-sky-950">Admin</strong> mới có đặc quyền xem danh sách tài khoản, khởi tạo nhân tài và gán nhãn phân quyền dữ liệu.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}


          {/* =========================================
               TAB 6: QUOTAS & TRANSFERS (Định mức & Điều chuyển)
             ========================================= */}
          {activeTab === "quotas" && (
            <div className="space-y-6 animate-fade-in text-xs text-slate-700 leading-relaxed">
              
              {/* Header Title */}
              <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-sky-900 text-sm flex items-center gap-1.5">
                    <span className="animate-pulse">⚖️</span> Quản lý Định mức PPE & Lịch sử Điều chuyển Dự án
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xl font-medium">
                    Kiểm duyệt sự tuân thủ định mức khi nhân sự di chuyển từ dự án này sang dự án khác. Dữ liệu lịch sử cấp phát được tích lũy liên bang và không tính lại từ đầu.
                  </p>
                </div>
                
                {/* Rules reference quick drawer */}
                <div className="bg-slate-900 text-slate-200 p-3.5 rounded-lg border border-slate-800 text-[11px] font-medium leading-normal space-y-1 shadow-sm shrink-0">
                  <p className="font-bold text-sky-400 uppercase text-[10px] tracking-wider flex items-center gap-1">📊 CHÍNH SÁCH ĐỊNH MỨC DOANH NGHIỆP:</p>
                  <div>• <span className="font-bold text-white">Áo ghi lê:</span> 3 cái/lần cấp, tối đa 2 lần/năm (Cộng dồn năm: 6 cái)</div>
                  <div>• <span className="font-bold text-white">Giày Jogger (Kỹ sư):</span> Tối đa 4 đôi/năm</div>
                  <div>• <span className="font-bold text-white">Giày Ziben (CHT/Giám đốc):</span> Tối đa 2 đôi/năm</div>
                </div>
              </div>

              {/* Grid 2-column: Search and Roster, and Interactive Timeline Lookups */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left panel: Employee Roster & Quota Meters */}
                <div className="lg:col-span-8 bg-white p-5 rounded-xl shadow-sm border border-sky-100 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-sky-50 pb-3">
                    <div>
                      <h4 className="font-bold text-sky-900 text-sm flex items-center gap-1.5">👥 Bảng Theo Dõi Định Mức Từng Nhân Sự</h4>
                      <p className="text-[11px] text-slate-400">Tự động cộng dồn và bảo tồn lịch sử khi thuyên chuyển công tác</p>
                    </div>
                    
                    {/* Search employee input */}
                    <div className="relative shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">🔍</span>
                      <input 
                        type="text"
                        placeholder="Tìm kiếm nhân sự..."
                        value={quotaSearch}
                        onChange={(e) => setQuotaSearch(e.target.value)}
                        className="p-1.5 pl-7 text-[11px] border border-slate-200 bg-slate-50 rounded focus:outline-none focus:border-sky-500 w-48 font-medium"
                      />
                    </div>
                  </div>

                  {/* Employees Table with Quota progress bars */}
                  {Object.keys(employeeStats).length > 0 ? (
                    <div className="overflow-auto max-h-[500px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-sky-900 font-bold border-b border-sky-100 uppercase text-[10px] tracking-wider sticky top-0">
                          <tr>
                            <th className="p-3">Họ và tên</th>
                            <th className="p-3">Chức vụ</th>
                            <th className="p-3">Dự án đã làm</th>
                            <th className="p-3 text-center">Định mức Áo ghi lê</th>
                            <th className="p-3 text-center">Định mức Giày bảo hộ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sky-100/30 font-medium">
                          {Object.values(employeeStats)
                            .filter(emp => !quotaSearch.trim() || emp.name.toLowerCase().includes(quotaSearch.toLowerCase().trim()))
                            .map(emp => {
                              // Calculate warnings or violations
                              const violetGhileText = emp.quotas.aoGhile.times > emp.quotas.aoGhile.maxTimes ? "Vượt số lần (max 2/năm)" : "";
                              const violetJoggerText = emp.role === "Kỹ sư" && emp.quotas.giayJogger.count > emp.quotas.giayJogger.maxCount ? "Vượt số lượng (max 4 đôi/năm)" : "";
                              const violetZibenText = emp.role === "Chỉ huy trưởng / Giám đốc dự án" && emp.quotas.giayZiben.count > emp.quotas.giayZiben.maxCount ? "Vượt số lượng (max 2 đôi/năm)" : "";
                              const hasViolation = violetGhileText || violetJoggerText || violetZibenText;

                              return (
                                <tr key={emp.name} className={`hover:bg-sky-50/25 transition-colors ${hasViolation ? 'bg-rose-50/15' : ''}`}>
                                  <td className="p-3 font-bold text-slate-900">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="text-slate-800">{emp.name}</span>
                                      {hasViolation && <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-black border-none tracking-wider animate-pulse" title="Vượt định mức cấp phát năm!">⚠️ OVER</span>}
                                    </div>
                                  </td>
                                  <td className="p-3 text-[10.5px] font-semibold text-slate-500 font-mono">{emp.role}</td>
                                  <td className="p-3">
                                    <div className="flex flex-wrap gap-1">
                                      {Array.from(emp.projects).map(proj => (
                                        <span key={proj} className="bg-sky-100 text-sky-800 text-[9.5px] font-bold px-2 py-0.5 rounded transition shadow-sm border border-sky-150">
                                          {proj}
                                        </span>
                                      ))}
                                      {emp.projects.size > 1 && (
                                        <span className="bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded tracking-wider shadow animate-bounce" title="Xác minh lưu giữ lịch sử qua dự án.">
                                          ĐÃ ĐIỀU CHUYỂN ⇄
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  
                                  {/* Áo ghi lê gauge mapping */}
                                  <td className="p-3">
                                    <div className="space-y-1 font-mono text-xs w-40 mx-auto">
                                      <div className="flex justify-between text-[9px] text-slate-400">
                                        <span>Ghi lê: {emp.quotas.aoGhile.count} cái ({emp.quotas.aoGhile.times} lần)</span>
                                        <span className="font-bold text-sky-800">{emp.quotas.aoGhile.times}/2 lần</span>
                                      </div>
                                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                                        <div 
                                          className={`h-full rounded-full transition-all duration-300 ${emp.quotas.aoGhile.times > emp.quotas.aoGhile.maxTimes ? 'bg-rose-500 shadow-sm' : 'bg-emerald-500 shadow-sm'}`}
                                          style={{ width: `${Math.min(100, (emp.quotas.aoGhile.times / emp.quotas.aoGhile.maxTimes) * 100)}%` }}
                                        />
                                      </div>
                                      {violetGhileText && <span className="text-[8.5px] text-rose-500 font-black uppercase text-center block tracking-wide">{violetGhileText}</span>}
                                    </div>
                                  </td>

                                  {/* Giày bảo hộ gauge mapping */}
                                  <td className="p-3 text-center">
                                    <div className="space-y-1 font-mono text-xs w-40 mx-auto">
                                      {emp.role === "Kỹ sư" ? (
                                        <>
                                          <div className="flex justify-between text-[9px] text-slate-400">
                                            <span>Jogger: {emp.quotas.giayJogger.count} đôi</span>
                                            <span className="font-bold text-sky-800">{emp.quotas.giayJogger.count}/4 đôi</span>
                                          </div>
                                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                                            <div 
                                              className={`h-full rounded-full transition-all duration-300 ${emp.quotas.giayJogger.count > emp.quotas.giayJogger.maxCount ? 'bg-rose-500' : 'bg-sky-500'}`}
                                              style={{ width: `${Math.min(100, (emp.quotas.giayJogger.count / emp.quotas.giayJogger.maxCount) * 100)}%` }}
                                            />
                                          </div>
                                          {violetJoggerText && <span className="text-[8.5px] text-rose-500 font-black uppercase text-center block tracking-wide">{violetJoggerText}</span>}
                                        </>
                                      ) : emp.role === "Chỉ huy trưởng / Giám đốc dự án" ? (
                                        <>
                                          <div className="flex justify-between text-[9px] text-slate-400">
                                            <span>Ziben: {emp.quotas.giayZiben.count} đôi</span>
                                            <span className="font-bold text-sky-800">{emp.quotas.giayZiben.count}/2 đôi</span>
                                          </div>
                                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                                            <div 
                                              className={`h-full rounded-full transition-all duration-300 ${emp.quotas.giayZiben.count > emp.quotas.giayZiben.maxCount ? 'bg-rose-500' : 'bg-blue-600'}`}
                                              style={{ width: `${Math.min(100, (emp.quotas.giayZiben.count / emp.quotas.giayZiben.maxCount) * 100)}%` }}
                                            />
                                          </div>
                                          {violetZibenText && <span className="text-[8.5px] text-rose-500 font-black uppercase text-center block tracking-wide">{violetZibenText}</span>}
                                        </>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic">Cấp thông thường</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center p-12 text-slate-400">
                      Chưa ghi nhận nhân sự cụ thể nào trong hệ thống SQLite.
                    </div>
                  )}
                </div>

                {/* Right panel: Dynamic timeline of selected profile (Transfer history proving no totals reset!) */}
                <div className="lg:col-span-4 bg-white p-5 rounded-xl shadow-sm border border-sky-100 space-y-4">
                  <div className="border-b border-sky-50 pb-2">
                    <h4 className="font-bold text-sky-900 text-sm flex items-center gap-1">⏰ Dòng Thời Gian Điều Chuyển Chi Tiết</h4>
                    <p className="text-[11px] text-slate-400">Tra cứu chi tiết lịch sử móng hầm từ SQLite an toàn</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chọn nhân viên từ danh sách *</label>
                    <select
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500 font-bold text-slate-800"
                      onChange={(e) => setQuotaSearch(e.target.value)}
                      value={quotaSearch}
                    >
                      <option value="">-- Mọi nhân sự --</option>
                      {Object.keys(employeeStats).map(key => (
                        <option key={key} value={employeeStats[key].name}>{employeeStats[key].name} ({employeeStats[key].role})</option>
                      ))}
                    </select>
                  </div>

                  {quotaSearch.trim() && employeeStats[quotaSearch.toLowerCase().trim()] ? (
                    <div className="space-y-4 pt-2">
                      <div className="p-3 bg-slate-900 rounded-lg text-slate-300">
                        <div className="font-bold text-white text-xs">{employeeStats[quotaSearch.toLowerCase().trim()].name}</div>
                        <div className="text-[11px] text-sky-300 font-bold">{employeeStats[quotaSearch.toLowerCase().trim()].role}</div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          Lưu trữ tại: {Array.from(employeeStats[quotaSearch.toLowerCase().trim()].projects).join(", ")}
                        </div>
                      </div>

                      {/* Timeline flow chart */}
                      <p className="font-black text-slate-500 text-[9px] uppercase tracking-wider">Mốc thời gian tích lũy trang bị:</p>
                      
                      <div className="relative border-l-2 border-dashed border-sky-200 pl-4 ml-2.5 space-y-3.5">
                        {employeeStats[quotaSearch.toLowerCase().trim()].records
                          .sort((a,b) => b.delivery_date.localeCompare(a.delivery_date))
                          .map((rec, rIdx) => (
                          <div key={rec.id} className="relative">
                            {/* Dot icon */}
                            <span className="absolute -left-[23.5px] top-1.5 h-2.5 w-2.5 rounded-full bg-sky-600 ring-4 ring-sky-100" />
                            
                            <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 space-y-1 shadow-sm">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-sky-950 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">{rec.project}</span>
                                <span className="font-mono text-slate-400">{rec.delivery_date}</span>
                              </div>
                              <div className="font-bold text-slate-800 text-[11px] mt-1">{rec.ppe_type}</div>
                              <div className="text-[10px] text-slate-600 font-bold flex justify-between items-center">
                                <span>Số lượng: {rec.quantity} cái</span>
                                <span className="text-[9px] text-slate-400 font-mono bg-white px-1 border rounded">BBGH: {rec.delivery_note_no}</span>
                              </div>
                              {rec.note && <div className="text-[10px] italic text-slate-500 font-mono bg-white p-1 rounded border border-slate-100 mt-1">Lưu ý: {rec.note}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-6 rounded-lg text-center text-[11px] text-slate-400 italic border border-dashed">
                      Vui lòng chọn một nhân sự cụ thể để hiển thị dòng thời gian tích lũy bảo hộ trên các công trường khác nhau.
                    </div>
                  )}

                </div>

              </div>

            </div>
          )}

        </div>

        {/* =========================================
             OVERLAY MODAL: SUPPLIER PAYMENT DOSSIER FORM
           ========================================= */}
        {showDossierModal && (() => {
          // Compute matching deliveries dynamically inside the layout for selection
          const currentProject = dossierForm.project_name;
          const currentSupplierNormalized = (dossierForm.supplier_name || "").toLowerCase().trim();
          
          const matchingDeliveries = deliveries.filter(del => 
            del.project === currentProject && 
            (del.supplier || "").toLowerCase().trim() === currentSupplierNormalized
          );

          const selectedDel = dossierForm.linked_delivery_id 
            ? deliveries.find(x => x.id === Number(dossierForm.linked_delivery_id)) 
            : null;

          const isQuantityMismatch = selectedDel && Number(dossierForm.payment_ppe_quantity || 0) !== selectedDel.quantity;

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in select-none">
              <div className="bg-white rounded-xl shadow-2xl border border-sky-100 max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
                
                {/* Header */}
                <div className="bg-sky-950 text-white px-6 py-4 rounded-t-xl flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-1.5 leading-none">
                      <span>📑</span> {isEditingDossier ? "Biên Tập Hồ Sơ Thanh Toán NCC" : "Tiếp Nhận &amp; Kiểm Soát HS Thanh Toán NCC mới"}
                    </h3>
                    <p className="text-[10px] text-sky-200 mt-1 font-medium italic">Vui lòng hoàn tất biểu mẫu kiểm định theo quy định ban HSE của tổng công ty</p>
                  </div>
                  <button 
                    onClick={() => setShowDossierModal(false)}
                    className="text-sky-200 hover:text-white transition-colors cursor-pointer text-base font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Form Main Body */}
                <form onSubmit={handleSaveDossier} className="p-6 space-y-5 text-slate-700 text-xs flex-1">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* SECTION 1: ADMIN & GENERAL */}
                    <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <h4 className="font-extrabold text-sky-950 uppercase text-[10px] tracking-wider border-b pb-1">
                        1. Thông Tin Tiếp Nhận Hành Chính
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Ngày HSE Nhận Hồ Sơ *</label>
                          <input 
                            type="date"
                            value={dossierForm.received_date}
                            onChange={(e) => setDossierForm({...dossierForm, received_date: e.target.value})}
                            required
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-sky-500 outline-none text-xs font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Dự Án Đăng Ký *</label>
                          <select
                            value={dossierForm.project_name}
                            onChange={(e) => setDossierForm({...dossierForm, project_name: e.target.value, linked_delivery_id: "", payment_ppe_quantity: ""})}
                            required
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-sky-500 outline-none text-xs font-semibold"
                          >
                            {projects.map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Tên Đơn Vị Cung Cấp (Vendor) *</label>
                        <input 
                          type="text"
                          placeholder="Ví dụ: Công ty Zinben, Jogger Corp..."
                          value={dossierForm.supplier_name}
                          onChange={(e) => setDossierForm({...dossierForm, supplier_name: e.target.value, linked_delivery_id: "", payment_ppe_quantity: ""})}
                          required
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-sky-500 outline-none text-xs font-semibold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Số Hợp Đồng / Đơn PO</label>
                          <input 
                            type="text"
                            placeholder="Mã HĐ-654 hoặc Số PO..."
                            value={dossierForm.contract_po_no}
                            onChange={(e) => setDossierForm({...dossierForm, contract_po_no: e.target.value})}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-sky-500 outline-none text-xs font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Mã Ngân Sách Định Biên</label>
                          <select
                            value={dossierForm.cost_code}
                            onChange={(e) => setDossierForm({...dossierForm, cost_code: e.target.value})}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-sky-500 outline-none text-xs font-semibold"
                          >
                            {COST_CODES.map(c => (
                              <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Nội Dung Thanh Toán Chi Tiết</label>
                        <input 
                          type="text"
                          placeholder="Đợt 1 / Đợt quyết toán cuối trang bị BHLĐ..."
                          value={dossierForm.payment_content}
                          onChange={(e) => setDossierForm({...dossierForm, payment_content: e.target.value})}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-sky-500 outline-none text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Tổng Số Tiền Quyết Toán (đã bao gồm VAT) *</label>
                        <div className="relative">
                          <input 
                            type="number"
                            min="0"
                            placeholder="Số tiền bằng VNĐ..."
                            value={dossierForm.payment_amount || ""}
                            onChange={(e) => setDossierForm({...dossierForm, payment_amount: Number(e.target.value)})}
                            required
                            className="w-full bg-white border border-slate-300 rounded pl-2.5 pr-10 py-1.5 focus:border-sky-500 outline-none text-xs font-mono font-bold"
                          />
                          <span className="absolute right-3 top-1.5 text-slate-400 font-extrabold text-[10px]">VNĐ</span>
                        </div>
                      </div>

                    </div>

                    {/* SECTION 2: MANDATORY CHECKLIST */}
                    <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="font-extrabold text-sky-950 uppercase text-[10px] tracking-wider border-b pb-1">
                          2. Đánh Giá Thành Phần Hồ Sơ Đính Kèm
                        </h4>
                        <p className="text-[9.5px] text-slate-400 mb-2 leading-tight italic">Tích chọn các chứng từ do NCC gửi để định dạng độ đầy đủ hồ sơ quy định.</p>
                        
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-2 font-semibold">
                          <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white transition-colors">
                            <input 
                              type="checkbox"
                              checked={dossierForm.has_invoice === 1}
                              onChange={(e) => setDossierForm({...dossierForm, has_invoice: e.target.checked ? 1 : 0})}
                              className="w-3.5 h-3.5 accent-sky-900 cursor-pointer"
                            />
                            <span>🧾 Hóa Đơn (VAT Invoice)</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white transition-colors">
                            <input 
                              type="checkbox"
                              checked={dossierForm.has_delivery_note === 1}
                              onChange={(e) => setDossierForm({...dossierForm, has_delivery_note: e.target.checked ? 1 : 0})}
                              className="w-3.5 h-3.5 accent-sky-900 cursor-pointer"
                            />
                            <span>🚚 BBGH Thực Tế</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white transition-colors">
                            <input 
                              type="checkbox"
                              checked={dossierForm.has_ppe_request === 1}
                              onChange={(e) => setDossierForm({...dossierForm, has_ppe_request: e.target.checked ? 1 : 0})}
                              className="w-3.5 h-3.5 accent-sky-900 cursor-pointer"
                            />
                            <span>📝 Phiếu Yêu Cầu Cấp</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white transition-colors">
                            <input 
                              type="checkbox"
                              checked={dossierForm.has_quotation_po === 1}
                              onChange={(e) => setDossierForm({...dossierForm, has_quotation_po: e.target.checked ? 1 : 0})}
                              className="w-3.5 h-3.5 accent-sky-900 cursor-pointer"
                            />
                            <span>📜 Báo Giá &amp; Đơn Đặt PO</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white transition-colors">
                            <input 
                              type="checkbox"
                              checked={dossierForm.has_acceptance_cert === 1}
                              onChange={(e) => setDossierForm({...dossierForm, has_acceptance_cert: e.target.checked ? 1 : 0})}
                              className="w-3.5 h-3.5 accent-sky-900 cursor-pointer"
                            />
                            <span>🤝 BB Nghiệm Thu Lắp Đặt</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white transition-colors">
                            <input 
                              type="checkbox"
                              checked={dossierForm.has_other_docs === 1}
                              onChange={(e) => setDossierForm({...dossierForm, has_other_docs: e.target.checked ? 1 : 0})}
                              className="w-3.5 h-3.5 accent-sky-900 cursor-pointer"
                            />
                            <span>📂 Thư từ, bổ sung khác</span>
                          </label>
                        </div>
                      </div>

                      {/* WORKFLOW STATUS CONTROL IN MIDDLE-RIGHT */}
                      <div className="bg-white/80 p-3 rounded border border-indigo-100 mt-2 space-y-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Trạng Thái Quy Trình Xử Lý *</label>
                          <select
                            value={dossierForm.status}
                            onChange={(e) => setDossierForm({...dossierForm, status: e.target.value as any})}
                            required
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-indigo-500 outline-none text-xs font-bold text-indigo-900"
                          >
                            <option value="Chưa gửi">Chưa gửi / Draft</option>
                            <option value="Chờ duyệt">Chờ duyệt / Lưu tạm</option>
                            <option value="Đã gửi dự án">Đã gửi dự án</option>
                            <option value="Dự án đã phản hồi">Dự án đã phản hồi</option>
                            <option value="Thiếu hồ sơ">Thiếu hồ sơ (Phản hồi chưa đạt)</option>
                            <option value="HSE đã kiểm tra">HSE đã kiểm tra Đạt</option>
                            <option value="Đã chuyển kế toán">Đã chuyển kế toán</option>
                            <option value="Hoàn tất thanh toán">Hoàn tất thanh toán</option>
                          </select>
                        </div>
                      </div>

                    </div>

                  </div>

                  {/* SECTION 3: PPE MATCHING & DATA EXCHANGES VÀ LƯU TRỮ */}
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                    <h4 className="font-extrabold text-orange-950 uppercase text-[10px] tracking-wider border-b border-orange-200 pb-1 flex items-center gap-1">
                      <span>🧩</span> Khớp Đối Chiếu Khối Lượng PPE Công Trường Thực Tế
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* Linked device list select */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Liên kết BBGH tại Công trường</label>
                        <select
                          value={dossierForm.linked_delivery_id}
                          onChange={(e) => {
                            const val = e.target.value;
                            const delRec = deliveries.find(x => x.id === Number(val));
                            setDossierForm({
                              ...dossierForm, 
                              linked_delivery_id: val,
                              payment_ppe_quantity: delRec ? delRec.quantity : ""
                            });
                          }}
                          className="w-full bg-white border border-amber-300 rounded px-2.5 py-1.5 focus:border-amber-500 outline-none text-xs font-semibold"
                        >
                          <option value="">-- Chọn Biên bản giao hàng phù hợp --</option>
                          {matchingDeliveries.map(x => (
                            <option key={x.id} value={x.id}>
                              {x.delivery_note_no} - {x.ppe_type} ({x.quantity} cái) - {x.delivery_date}
                            </option>
                          ))}
                        </select>
                        <p className="text-[9px] text-slate-400 mt-0.5 leading-none">
                          {matchingDeliveries.length > 0 
                            ? `Phát hiện ${matchingDeliveries.length} BBGH khớp với "${dossierForm.project_name}" &amp; "${dossierForm.supplier_name}"`
                            : "Không có BBGH thích hợp cùng Project &amp; Vendor"}
                        </p>
                      </div>

                      {/* Decision qty */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Số lượng quyết toán trong hồ sơ</label>
                        <input 
                          type="number"
                          placeholder="Nhập SL cái/bộ đề nghị quyết toán..."
                          disabled={!dossierForm.linked_delivery_id}
                          value={dossierForm.payment_ppe_quantity || ""}
                          onChange={(e) => setDossierForm({...dossierForm, payment_ppe_quantity: e.target.value ? Number(e.target.value) : ""})}
                          className="w-full bg-white border border-amber-300 rounded px-2.5 py-1.5 focus:border-amber-500 outline-none text-xs font-semibold font-mono disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>

                      {/* Display warning feedback instantly */}
                      <div className="flex flex-col justify-center">
                        {selectedDel ? (
                          <div className={`p-2 rounded border text-center font-bold text-[10.5px] leading-tight flex flex-col justify-center ${
                            isQuantityMismatch 
                              ? "bg-rose-100 border-rose-300 text-rose-800 animate-pulse" 
                              : "bg-emerald-100 border-emerald-300 text-emerald-800"
                          }`}>
                            <div>{isQuantityMismatch ? "⚠️ Cảnh báo Lệch Số Liệu!" : "✓ Khớp Số Liệu Bảo Hộ"}</div>
                            <div className="text-[9px] font-mono font-medium mt-0.5">
                              {isQuantityMismatch 
                                ? `BBGH: ${selectedDel.quantity} cái | Thanh toán: ${dossierForm.payment_ppe_quantity} cái`
                                : `SL Trùng khớp: ${selectedDel.quantity} cái BHLĐ`}
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 border border-dashed rounded text-center text-slate-400 text-[10px] italic">
                            Chọn biên bản giao nhận để định lượng chênh lệch
                          </div>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* SECTION 4: WORKFLOW STAGES DATES */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h4 className="font-extrabold text-sky-950 uppercase text-[10px] tracking-wider border-b pb-1 mb-2">
                      3. Tiến Trình Phê Duyệt Luân Chuyển Hồ Sơ (HSE Office &amp; Công Trường)
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* Sub-block A: HSE to Project */}
                      <div className="space-y-2.5 p-2 bg-white rounded border border-slate-150">
                        <div className="font-bold text-[10.5px] text-slate-800 border-b pb-0.5 flex items-center justify-between">
                          <span>Bước 3a. HSE gửi cho DA</span>
                          <span className="text-[9px] text-slate-400 font-mono">Mail Out</span>
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-slate-400 mb-0.5">Ngày gửi email duyệt</label>
                          <input 
                            type="date"
                            value={dossierForm.hse_email_date || ""}
                            onChange={(e) => setDossierForm({...dossierForm, hse_email_date: e.target.value})}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 focus:border-sky-500 outline-none text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-slate-400 mb-0.5">Họ tên PIC Dự Án nhận</label>
                          <input 
                            type="text"
                            placeholder="Ví dụ: Chỉ huy trưởng B..."
                            value={dossierForm.project_pic || ""}
                            onChange={(e) => setDossierForm({...dossierForm, project_pic: e.target.value})}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 focus:border-sky-500 outline-none text-xs font-semibold"
                          />
                        </div>
                      </div>

                      {/* Sub-block B: Project feedback confirmation */}
                      <div className="space-y-2.5 p-2 bg-white rounded border border-slate-150">
                        <div className="font-bold text-[10.5px] text-slate-800 border-b pb-0.5 flex items-center justify-between">
                          <span>Bước 3b. Dự án phản hồi</span>
                          <span className="text-[9px] text-slate-400 font-mono">P.M Confirm</span>
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-slate-400 mb-0.5">Ngày phản hồi chính thức</label>
                          <input 
                            type="date"
                            value={dossierForm.project_response_date || ""}
                            onChange={(e) => setDossierForm({...dossierForm, project_response_date: e.target.value})}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 focus:border-sky-500 outline-none text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-slate-400 mb-0.5">Văn bản/Nội dung phản hồi từ CHT</label>
                          <textarea 
                            rows={1}
                            placeholder="Ví dụ: Dự án xác nhận đạt... hoặc bổ sung hồ sơ..."
                            value={dossierForm.project_response_content || ""}
                            onChange={(e) => setDossierForm({...dossierForm, project_response_content: e.target.value})}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 focus:border-sky-500 outline-none text-xs font-semibold"
                          />
                        </div>
                      </div>

                      {/* Sub-block C: Transfer to accounting */}
                      <div className="space-y-2.5 p-2 bg-white rounded border border-slate-150">
                        <div className="font-bold text-[10.5px] text-slate-800 border-b pb-0.5 flex items-center justify-between">
                          <span>Bước 3c. Chuyển kế toán</span>
                          <span className="text-[9px] text-slate-400 font-mono">Finance Pay</span>
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-slate-400 mb-0.5">Ngày HSE bàn giao kế toán</label>
                          <input 
                            type="date"
                            value={dossierForm.accounting_transfer_date || ""}
                            onChange={(e) => setDossierForm({...dossierForm, accounting_transfer_date: e.target.value})}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 focus:border-sky-500 outline-none text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-slate-400 mb-0.5">Kế toán viên tiếp nhận hồ sơ</label>
                          <input 
                            type="text"
                            placeholder="Tên kế toán viên đại diện..."
                            value={dossierForm.accounting_recipient || ""}
                            onChange={(e) => setDossierForm({...dossierForm, accounting_recipient: e.target.value})}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 focus:border-sky-500 outline-none text-xs font-semibold"
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Section 5: Internal notes */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Ghi Chú Hạch Toán Phòng HSE</label>
                    <textarea 
                      rows={2}
                      placeholder="Ghi nhận các lưu ý hồ sơ bổ sung, lý do từ chối hoặc mốc ngày thanh toán dự tính khác..."
                      value={dossierForm.notes || ""}
                      onChange={(e) => setDossierForm({...dossierForm, notes: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded p-2.5 focus:border-sky-500 outline-none text-xs font-medium"
                    />
                  </div>

                  {/* Submit and Cancel Footer bar */}
                  <div className="border-t pt-4 flex justify-end items-center gap-2 select-none shrink-0 text-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowDossierModal(false)}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded cursor-pointer transition-colors"
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-sky-900 hover:bg-sky-950 text-white font-bold rounded cursor-pointer transition-colors"
                    >
                      {isEditingDossier ? "💾 Lưu Thay Đổi" : "💾 Tiếp Nhận Hồ Sơ"}
                    </button>
                  </div>

                </form>

              </div>
            </div>
          );
        })()}

        {/* Footers for High Density layout */}
        <footer className="h-10 bg-white border-t border-sky-100 flex items-center px-8 text-[11px] text-slate-400 justify-between shrink-0 font-medium italic z-30">
          <div>Hệ thống quản lý nội bộ - HSE Department v2.4.0</div>
          <div className="flex space-x-3.5 uppercase font-bold tracking-widest text-sky-800">
            {projects.map(p => (
              <span key={p}>{p}</span>
            ))}
          </div>
        </footer>

      </main>

    </div>
  );
}
