var createError = require('http-errors');
var express = require('express');
var path = require('path');
const fs = require('fs');
const db = require('./db'); // สำหรับการเชื่อมต่อฐานข้อมูล
const bcrypt = require('bcryptjs');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var ejs = require('ejs');
var session = require('express-session');
require('dotenv').config();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var historyRouter = require('./routes/history');
var documentRouter = require('./routes/document');
var addRouter = require('./routes/add');
var addminRouter = require('./routes/addmin');
var detailsRouter = require('./routes/details');
var professorRouter = require('./routes/professor');
var reqforinternRouter = require('./routes/reqforintern');
var listofrequestsRouter = require('./routes/listofrequests');
var addmindashboardRouter = require('./routes/addmindashboard');
var send_reportRouter = require('./routes/send_report');
var status_stdRouter = require('./routes/status_std');
var adviser_nites_evaluationRouter = require('./routes/adviser_nites_evaluation');
var adviser_present_evaluationRouter = require('./routes/adviser_present_evaluation');
var check_reportRouter = require('./routes/check_report');
var adviser_profileRouter = require('./routes/adviser_profile');
var exter_profileRouter = require('./routes/exter_profile');
var externalevaluatorrRouter = require('./routes/externalevaluator');
var mentor_evaluationRouter = require('./routes/mentor_evaluation');
var mentor_proflieRouter = require('./routes/mentor_proflie');
var std_profileRouter = require('./routes/std_profile');
var add_userRouter = require('./routes/add_user');
var admin_edit_userRouter = require('./routes/admin_edit_user');
var edit_userRouter = require('./routes/edit_user');
var assign_mentorRouter = require('./routes/assign_mentor');
var assign_nitesRouter = require('./routes/assign_nites');
var manage_companyRouter = require('./routes/manage_company');
var manage_documentRouter = require('./routes/manage_document');
var manage_userRouter = require('./routes/manage_user');
var ex_dashboardRouter = require('./routes/ex_dashboard');
var ex_evaluatorRouter = require('./routes/ex_evaluator');
var mentor_dashboardRouter = require('./routes/mentor_dashboard');

var app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.engine('html', ejs.renderFile);

// ตั้งค่า session
app.use(session({
    secret: process.env.SESSION_SECRET || 'V!v6Kq9mVnP5B2j4!7@uHw$Lp6S9g7f7X0',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));
const cors = require('cors');
app.use(cors({ origin: 'https://kkbs-internship-github-io.onrender.com', credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(logger('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// ตั้งค่าเส้นทาง
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/history', historyRouter);
app.use('/document', documentRouter);
app.use('/add', addRouter);
app.use('/addmin', addminRouter);
app.use('/details', detailsRouter);
app.use('/professor', professorRouter);
app.use('/reqforintern', reqforinternRouter);
app.use('/listofrequests', listofrequestsRouter);
app.use('/admin', addmindashboardRouter);
app.use('/update-status', listofrequestsRouter);
app.use('/send_report', send_reportRouter);
app.use('/status_std', status_stdRouter);
app.use('/adviser_nites_evaluation', adviser_nites_evaluationRouter);
app.use('/adviser_present_evaluation', adviser_present_evaluationRouter);
app.use('/check_report', check_reportRouter);
app.use('/report_evaluation', check_reportRouter);
app.use('/adviser_profile', adviser_profileRouter);
app.use('/exter_profile', exter_profileRouter);
app.use('/externalevaluatorr', externalevaluatorrRouter);
app.use('/mentor_evaluation', mentor_evaluationRouter);
app.use('/mentor_proflie', mentor_proflieRouter);
app.use('/std_profile', std_profileRouter);
app.use('/add_user', add_userRouter);
app.use('/admin_edit_user', admin_edit_userRouter);
app.use('/edit_user', edit_userRouter);
app.use('/assign_mentor', assign_mentorRouter);
app.use('/assign_nites', assign_nitesRouter);
app.use('/manage_company', manage_companyRouter);
app.use('/manage_document', manage_documentRouter);
app.use('/manage_user', manage_userRouter);
app.use('/ex_dashboard', ex_dashboardRouter);
app.use('/ex_evaluator', ex_evaluatorRouter);
app.use('/mentor_dashboard', mentor_dashboardRouter);

// 📌 กำหนดเส้นทางของโฟลเดอร์ uploads และ documents
const uploadDir = path.join(__dirname, 'routes', 'uploads', 'uploads');
const documentsDir = path.join(uploadDir, 'documents');

// 📌 ให้ Express จัดการเส้นทางไฟล์
app.use('/uploads', express.static(uploadDir));
app.use('/uploads/documents', express.static(documentsDir));

app.get('/documents/:request_id', async (req, res) => {
    const requestId = req.params.request_id;
    console.log(`🔎 Request received for document ID: ${requestId}`);

    try {
        // 🔍 ค้นหาไฟล์ทั้งหมดที่เกี่ยวข้องกับ request_id
        const [results] = await db.promise().query(
            "SELECT file_path FROM document WHERE request_id = ?", [requestId]
        );

        if (results.length === 0) {
            console.error(`❌ No documents found for request_id ${requestId}`);
            return res.status(404).json({ error: 'No documents found in the database' });
        }

        let foundDocuments = results.map(doc => {
            let filePath = doc.file_path ? doc.file_path.replace(/\\/g, '/') : null;
            if (!filePath) return null;

            // ตรวจสอบให้แน่ใจว่า path เริ่มต้นด้วย 'uploads/'
            if (!filePath.startsWith('uploads/')) {
                filePath = `uploads/${filePath}`;
            }

            return { file_path: filePath };
        }).filter(doc => doc !== null);

        console.log("📂 Found documents:", foundDocuments);

        // ส่ง JSON ที่มีรายการไฟล์ทั้งหมดกลับไปให้ Frontend
        res.json({ foundDocuments });

    } catch (err) {
        console.error('❌ Database query error:', err);
        return res.status(500).json({ error: 'Error fetching document data' });
    }
});

// จัดการ favicon.ico
app.get('/favicon.ico', (req, res) => res.status(204).end());

// จัดการข้อผิดพลาด 404
app.use((req, res) => {
    res.status(404).render('error', {
        message: 'ไม่พบหน้าที่ร้องขอ',
        error: {}
    });
});

// Error handler สำหรับข้อผิดพลาดอื่น ๆ
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).render('error', {
        message: 'เกิดข้อผิดพลาด!',
        error: err
    });
});

module.exports = app;
