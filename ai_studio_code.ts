// 1. FILE: server.ts -> Sửa hàm DELETE
app.delete("/api/deliveries/:id", (req, res) => {
  try {
    const { id } = req.params;
    
    // Đã sửa: Truyền tham số id vào truy vấn .get(id)
    const delivery = db.prepare("SELECT * FROM deliveries WHERE id = ?").get(id) as any;
    if (!delivery) {
      return res.status(404).json({ error: "Không tìm thấy biên bản giao hàng" });
    }

    const runTransaction = db.transaction(() => {
      if (delivery.request_id) {
        db.prepare("UPDATE requests SET status = 'Đã duyệt' WHERE id = ?").run(delivery.request_id);
      }
      
      // Xóa các chi tiết bàn giao trước
      db.prepare("DELETE FROM delivery_details WHERE delivery_id = ?").run(id);
      // Xóa biên bản chính
      db.prepare("DELETE FROM deliveries WHERE id = ?").run(id);
    });

    runTransaction();
    res.json({ success: true, message: "Đã xóa biên bản và cập nhật liên kết thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// 2. FILE: server.ts -> Thêm mới hàm PUT (Chỉnh sửa)
app.put("/api/deliveries/:id", (req, res) => {
  try {
    const { id } = req.params;
    const {
      delivery_date, delivery_note_no, project, supplier, note,
      deliverer, receiver, attachment_data, attachment_name, attachment_type,
      items
    } = req.body;

    if (!delivery_date || !delivery_note_no || !project || !supplier) {
      return res.status(400).json({ error: "Thiếu các trường thông tin bắt buộc" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Biên bản phải có ít nhất 1 mặt hàng bảo hộ PPE" });
    }

    const existing = db.prepare("SELECT * FROM deliveries WHERE id = ?").get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: "Không tìm thấy biên bản giao nhận cần chỉnh sửa" });
    }

    const runTransaction = db.transaction(() => {
      const firstItem = items[0];
      const totalAmount = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price || 0)), 0);
      const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity), 0);

      // Cập nhật thông tin Header
      db.prepare(`
        UPDATE deliveries SET
          delivery_date = ?, delivery_note_no = ?, project = ?, ppe_type = ?, quantity = ?, supplier = ?, note = ?, 
          attachment_data = COALESCE(?, attachment_data), attachment_name = COALESCE(?, attachment_name), 
          attachment_type = COALESCE(?, attachment_type), deliverer = ?, receiver = ?, amount = ?
        WHERE id = ?
      `).run(
        delivery_date, delivery_note_no, project, firstItem.ppe_type, totalQuantity, supplier, note || "", 
        attachment_data || null, attachment_name || null, attachment_type || null,
        deliverer || null, receiver || null, totalAmount, id
      );

      // Làm mới danh sách chi tiết chi phí
      db.prepare("DELETE FROM delivery_details WHERE delivery_id = ?").run(id);

      const insertDetail = db.prepare(`
        INSERT INTO delivery_details (delivery_id, ppe_type, quantity, unit_price, amount, cost_code)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const uPrice = Number(item.unit_price || 0);
        const qty = Number(item.quantity || 0);
        const amt = item.amount !== undefined ? Number(item.amount) : uPrice * qty;
        insertDetail.run(id, item.ppe_type, qty, uPrice, amt, item.cost_code || "9.07.02");
      }
    });

    runTransaction();
    res.json({ success: true, message: "Cập nhật Biên bản giao nhận thành công!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});