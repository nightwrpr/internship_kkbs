var express = require('express');
var router = express.Router();
const db = require('../db');


// ฟังก์ชันที่ใช้แปลงสถานะ
function statusText(status) {
  if (status === 'P') return 'รอการอนุมัติ'; // รอการอนุมัติ
  if (status === 'A') return 'อนุมัติแล้ว'; // อนุมัติแล้ว
  if (status === 'R') return 'ถูกปฏิเสธ'; // ถูกปฏิเสธ
  return 'Unknown Status'; // กรณีไม่พบสถานะ
}

router.get('/', async (req, res) => {
  try {
    // ตรวจสอบว่าผู้ใช้งานล็อกอินแล้วหรือไม่
    if (!req.session.user) {
      return res.redirect('/users/login');
    }

    const { user } = req.session;
    const user_id = user.id;
    console.log('User ID:', user_id);

    // คำสั่ง SQL สำหรับดึงข้อมูลคำร้องของนักศึกษา
    const requestQuery = 'SELECT * FROM internship_request WHERE student_id = ? AND delete_up IS NULL';
    const [requests] = await db.promise().query(requestQuery, [user_id]);

    // หากไม่พบข้อมูลคำร้อง
    if (requests.length === 0) {
      return res.render('status_std', {
        title: 'สถานะคำร้องฝึกงานของนักศึกษา',
        user: user,
        requests: [],
        documents: [],
        statusText: statusText // ส่งฟังก์ชันไปด้วย
      });
    }
    console.log('Requests found:', requests);  // ตรวจสอบคำร้องที่ดึงมา

    // ดึงข้อมูลบริษัทที่เกี่ยวข้อง
    const companyIds = requests.map(request => request.company_id);
    const companyQuery = 'SELECT company_id, name FROM company WHERE company_id IN (?)';
    const [companies] = await db.promise().query(companyQuery, [companyIds]);

    // สร้างแผนที่บริษัท
    const companyMap = companies.reduce((map, company) => {
      map[company.company_id] = company.name;
      return map;
    }, {});

    // ใส่ชื่อบริษัทในแต่ละคำร้อง
    requests.forEach(request => {
      request.company_name = companyMap[request.company_id];
    });

    // ดึงข้อมูลตำแหน่งที่เกี่ยวข้อง
    const positionIds = requests.map(req => req.position_id);
    const positionQuery = 'SELECT position_id, position_name FROM position_open WHERE position_id IN (?)';
    const [positions] = await db.promise().query(positionQuery, [positionIds]);

    // สร้างแผนที่ตำแหน่ง
    const positionMap = positions.reduce((map, position) => {
      map[position.position_id] = position.position_name;
      return map;
    }, {});

    // ใส่ชื่อตำแหน่งในแต่ละคำร้อง
    requests.forEach(request => {
      request.position_name = positionMap[request.position_id];
    });

    // ดึงข้อมูลเอกสารที่เกี่ยวข้อง
    const requestIds = requests.map(req => req.request_id);
    const documentQuery = 'SELECT * FROM document WHERE request_id IN (?)';
    const [documents] = await db.promise().query(documentQuery, [requestIds]);

    // เพิ่ม base URL สำหรับเข้าถึงไฟล์
    documents.forEach(doc => {
      doc.file_url = `/uploads/documents/${doc.file_path.split('/').pop()}`;  // ใช้ URL ที่สามารถเข้าถึงได้
    });

    // ส่งข้อมูลไปที่หน้า status_std
    res.render('status_std', {
      title: 'สถานะคำร้องฝึกงานของนักศึกษา',
      user: user,  // ส่งข้อมูลนักศึกษา
      requests: requests,  // ส่งข้อมูลคำร้อง
      documents: documents,  // ส่งข้อมูลเอกสาร
      statusText: statusText  // ส่งฟังก์ชัน statusText ไปที่ view
    });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).send('เกิดข้อผิดพลาดในการประมวลผลคำร้อง');
  }
});

module.exports = router;
