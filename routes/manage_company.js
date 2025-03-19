var express = require('express');
var router = express.Router();
const db = require('../db'); // เชื่อมต่อฐานข้อมูล
// route หลัก
router.get('/', async (req, res) => {
    try {
      const sql = `
        SELECT 
          c.company_id,
          c.name AS company_name, 
          c.address AS company_address, 
          c.email AS company_email, 
          c.phone_number AS company_phone, 
          p.position_id,
          p.position_name AS position_title,
          p.number_of_open AS position_quantity,
          p.description
        FROM 
          position_open p
        INNER JOIN 
          company c ON p.company_id = c.company_id
        WHERE 
          c.delete_up IS NULL;
      `;
  
      // ดึงข้อมูลจากฐานข้อมูล
      db.query(sql, (err, results) => {
        if (err) {
          console.error('เกิดข้อผิดพลาด:', err);
          return res.status(500).send('Server Error');
        }
  
        if (results.length > 0) {
          const companyMap = new Map();
          const companies = [];
          const positions = [];
  
          results.forEach(row => {
            if (!companyMap.has(row.company_name)) {
              const companyData = {
                company_name: row.company_name,
                company_address: row.company_address,
                company_email: row.company_email,
                company_phone: row.company_phone
              };
              companies.push(companyData);
              companyMap.set(row.company_name, companyData);
            }
  
            positions.push({
              position_title: row.position_title,
              position_quantity: row.position_quantity,
              company_name: row.company_name
            });
          });
  
          res.render('manage_company', { companies, positions });
        } else {
          res.render('manage_company', { companies: [], positions: [], message: "ไม่มีตำแหน่งงานที่เปิดรับ" });
        }
      });
    } catch (err) {
      console.error('เกิดข้อผิดพลาด:', err);
      res.status(500).send('Server Error');
    }
  });
module.exports = router;
