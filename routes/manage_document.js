var express = require('express');
var router = express.Router();
const db = require('../db'); // เชื่อมต่อฐานข้อมูล

// ดึงข้อมูลเอกสาร
router.get('/', (req, res) => {
    const sql = `
        SELECT d.document_id, d.document_type, d.file_path, d.create_up, u.student_id, u.name
        FROM document d
        LEFT JOIN internship_request r ON d.request_id = r.request_id
        LEFT JOIN user u ON r.student_id = u.student_id
        WHERE d.delete_up IS NULL
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ เกิดข้อผิดพลาดในการดึงข้อมูลเอกสาร:', err);
            return res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
        }

        if (!Array.isArray(results)) {
            console.error('⚠️ ผลลัพธ์ที่ได้ไม่ใช่ array:', results);
            return res.status(500).send('ข้อมูลไม่ถูกต้อง');
        }

        console.log('✅ ดึงข้อมูลเอกสารสำเร็จ, จำนวน:', results.length);
        // log ตัวอย่างข้อมูลแรก
        if (results.length > 0) {
            console.log('ตัวอย่างข้อมูล:', results[0]);
        }

        res.render('manage_document', { documents: results }); // ส่งข้อมูลไป view
    });
});

// ลบเอกสาร
router.post('/documents/delete/:id', (req, res) => {
    const docId = req.params.id;
    const sql = `UPDATE document SET delete_up = NOW() WHERE document_id = ?`;

    db.query(sql, [docId], (err, result) => {
        if (err) {
            console.error('❌ ลบเอกสารไม่สำเร็จ:', err);
            return res.status(500).json({ success: false });
        }

        console.log('✅ ลบเอกสารสำเร็จ:', docId);
        res.json({ success: true });
    });
});

module.exports = router;
