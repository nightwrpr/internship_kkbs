const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid'); // สำหรับสร้าง UUID
const db = require('../db'); // เชื่อมต่อกับฐานข้อมูลที่ตั้งค่าไว้

// Middleware สำหรับตรวจสอบการเข้าสู่ระบบและสิทธิ์ admin
function isAdmin(req, res, next) {
  console.log('Session user:', req.session.user); // Debug ข้อมูล session

  if (!req.session.user) {
    console.log('User is not logged in.');
    return res.redirect('/users/login');
  }

  if (req.session.user.role.toLowerCase() !== 'admin') {
    console.log(`Access denied: user role is ${req.session.user.role}`);
    return res.status(403).send('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
  }

  next();
}

// Route แสดงฟอร์มเพิ่มบริษัท (เฉพาะ admin เท่านั้น)
router.get('/', isAdmin, (req, res) => {
  const admin = req.session.user;
  res.render('add', { admin });
});

// Route บันทึกข้อมูลบริษัทและตำแหน่งงาน
router.post('/', isAdmin, (req, res) => {
  const { company_name, address, email, phone_number, position_name, number_of_open, description } = req.body;

  if (!company_name || !address || !position_name) {
    return res.status(400).send('กรุณากรอกข้อมูลให้ครบถ้วน');
  }

  const companyId = uuidv4(); // สร้าง UUID

  const companyQuery = `
    INSERT INTO company (company_id, name, address, email, phone_number, create_up)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  db.query(companyQuery, [companyId, company_name, address, email, phone_number], (err, companyResult) => {
    if (err) {
      console.error('❌ Error saving company data:', err);
      return res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูลบริษัท');
    }

    console.log('✅ Company saved with ID:', companyId);

    // ตรวจสอบว่าตำแหน่งงานเป็นหลายตำแหน่งหรือไม่
    if (Array.isArray(position_name)) {
      let errorOccurred = false;
      let positionsProcessed = 0;

      position_name.forEach((position, index) => {
        const positionQuery = `
          INSERT INTO position_open (company_id, position_name, number_of_open, description, create_up)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        db.query(positionQuery, [companyId, position, number_of_open[index], description[index]], (err, result) => {
          positionsProcessed++;

          if (err && !errorOccurred) {
            errorOccurred = true;
            console.error('❌ Error saving job position:', err);
            return res.status(500).send('เกิดข้อผิดพลาดในการบันทึกตำแหน่งงาน');
          }

          if (positionsProcessed === position_name.length && !errorOccurred) {
            return res.redirect('/admin/dashboard');
          }
        });
      });

    } else {
      // ถ้ามีแค่ตำแหน่งเดียว
      const positionQuery = `
        INSERT INTO position_open (company_id, position_name, number_of_open, description, create_up)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      db.query(positionQuery, [companyId, position_name, number_of_open, description], (err, result) => {
        if (err) {
          console.error('❌ Error saving job position:', err);
          return res.status(500).send('เกิดข้อผิดพลาดในการบันทึกตำแหน่งงาน');
        }

        return res.redirect('/admin/dashboard');
      });
    }
  });
});
module.exports = router;
