const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

// CORS aur JSON parsing setup
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// 🗄️ LOCAL DATABASE SETUP
// ==========================================
const DB_FILE = path.join(__dirname, 'database.json');

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }));
}

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4));

const otpStore = {};

const logUsers = (users) => users.map(user => ({
    id: user.id,
    mobile: user.mobile,
    name: user.fullName
}));

// ==========================================
// 1. LOGIN: SEND OTP API 
// ==========================================
app.post('/api/send-otp', (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile || mobile.toString().length !== 10) {
            return res.status(400).json({ success: false, message: "Invalid mobile number format." });
        }

        const db = readDB();
        const userExists = db.users.find(u => u.mobile === mobile);

        if (!userExists) {
            console.log(`❌ [LOGIN OTP] Number not registered: +91 ${mobile}`);
            return res.status(400).json({ success: false, message: "Number not registered. Please Register first." });
        }

        const demoOtp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[mobile] = demoOtp;

        console.log(`\n📲 [LOGIN] OTP sent to +91 ${mobile}: ${demoOtp}`);

        return res.status(200).json({
            success: true,
            message: `OTP successfully sent to +91 ${mobile}`,
            demoOtp: demoOtp
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ==========================================
// 2. LOGIN: VERIFY OTP API 
// ==========================================
app.post('/api/verify-otp', (req, res) => {
    try {
        const { mobile, otp } = req.body;

        if (otpStore[mobile] === otp || otp === '123456') {
            const db = readDB();
            const user = db.users.find(u => u.mobile === mobile);

            delete otpStore[mobile];
            console.log(`✅ [LOGIN SUCCESS] Welcome back, ${user.fullName}`);

            return res.status(200).json({
                success: true,
                message: "Login Successful!",
                userData: {
                    name: user.fullName,
                    location: user.address ? `${user.address.village || ''}, ${user.address.district || ''}` : '',
                    id: user.id
                }
            });
        } else {
            console.log(`❌ [LOGIN VERIFY] Incorrect OTP for +91 ${mobile}`);
            return res.status(400).json({ success: false, message: "Incorrect OTP." });
        }
    } catch (error) {
        console.error('[LOGIN VERIFY ERROR]', error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ==========================================
// 3. PROFILE: UPDATE FARMER DATA 
// ==========================================
app.post('/api/updateProfile', (req, res) => {
    try {
        const profileData = req.body;
        let db = readDB();

        let userIndex = db.users.findIndex(u => u.id === profileData.id || u.mobile === profileData.phone);

        if (userIndex !== -1) {
            db.users[userIndex].fullName = profileData.name;
            db.users[userIndex].mobile = profileData.phone;
            db.users[userIndex].email = profileData.email;
            db.users[userIndex].crops = profileData.crops;

            if (!db.users[userIndex].address) db.users[userIndex].address = {};
            db.users[userIndex].address.village = profileData.village;

            console.log(`✅ [PROFILE UPDATE] Data updated for: ${profileData.name}`);
        } else {
            const newUser = {
                id: profileData.id,
                mobile: profileData.phone,
                fullName: profileData.name,
                email: profileData.email,
                address: { village: profileData.village },
                crops: profileData.crops,
                registrationDate: new Date().toISOString()
            };
            db.users.push(newUser);
            console.log(`✅ [PROFILE CREATED] New profile saved for: ${profileData.name}`);
        }

        writeDB(db);
        return res.status(200).json({ success: true, message: "Profile saved to Database!" });
    } catch (error) {
        console.error('[PROFILE UPDATE ERROR]', error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ==========================================
// 4. REGISTER: SEND OTP API 
// ==========================================
app.post('/api/register/send-otp', (req, res) => {
    try {
        const { mobile } = req.body;
        const db = readDB();
        if (db.users.find(u => u.mobile === mobile)) {
            console.log(`❌ [REGISTER OTP] Already registered: +91 ${mobile}`);
            return res.status(400).json({ success: false, message: "This number is already registered! Please Login." });
        }
        console.log(`📲 [REGISTER OTP] OTP sent to +91 ${mobile} (test OTP: 123456)`);
        return res.status(200).json({ success: true, message: `OTP successfully sent to +91 ${mobile}` });
    } catch (error) {
        console.error('[REGISTER OTP ERROR]', error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ==========================================
// 5. REGISTER: VERIFY OTP API
// ==========================================
app.post('/api/register/verify-otp', (req, res) => {
    try {
        const { mobile, otp } = req.body;
        if (otp === '123456') {
            console.log(`✅ [REGISTER VERIFY] Phone verified: +91 ${mobile || 'number unavailable'}`);
            return res.status(200).json({ success: true, message: "Phone verified successfully!" });
        }
        console.log(`❌ [REGISTER VERIFY] Incorrect OTP for +91 ${mobile || 'number unavailable'}`);
        return res.status(400).json({ success: false, message: "Incorrect OTP." });
    } catch (error) {
        console.error('[REGISTER VERIFY ERROR]', error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ==========================================
// 6. REGISTER: SUBMIT BASIC INFO
// ==========================================
app.post('/api/register/submit-basic-info', (req, res) => {
    try {
        const formData = req.body;
        const db = readDB();

        const newUser = {
            id: "FRM" + Math.floor(Math.random() * 90000 + 10000),
            mobile: formData.mobile,
            fullName: formData.fullName,
            email: formData.email,
            dob: formData.dob,
            gender: formData.gender,
            maritalStatus: formData.maritalStatus,
            address: formData.address,
            bankDetails: formData.bankDetails,
            registrationDate: new Date().toISOString()
        };

        db.users.push(newUser);
        writeDB(db);

        console.log(`✅ [REGISTER COMPLETE] ${newUser.fullName} | +91 ${newUser.mobile} | ID: ${newUser.id}`);

        return res.status(200).json({ success: true, message: "Registration completed successfully! Welcome to KisanQueue." });
    } catch (error) {
        console.error('[REGISTER COMPLETE ERROR]', error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ==========================================
// 7. ADMIN: GET ALL USERS API
// ==========================================
app.get('/api/admin/users', (req, res) => {
    try {
        const db = readDB();
        console.log(`📋 [ADMIN LIST] ${db.users.length} farmer(s) fetched.`);
        return res.status(200).json({ success: true, users: db.users.reverse() });
    } catch (error) {
        console.error('[ADMIN LIST ERROR]', error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ==========================================
// 8. ADMIN: DELETE USER API
// ==========================================
app.delete('/api/admin/users/:id', (req, res) => {
    try {
        const userId = req.params.id;
        let db = readDB();

        const initialCount = db.users.length;
        db.users = db.users.filter(user => user.id !== userId);

        if (db.users.length < initialCount) {
            writeDB(db);
            console.log(`🗑️ [ADMIN DELETE] User deleted: ID ${userId}`);
            return res.status(200).json({ success: true, message: "User removed successfully!" });
        } else {
            console.log(`❌ [ADMIN DELETE] User not found: ID ${userId}`);
            return res.status(404).json({ success: false, message: "User not found!" });
        }
    } catch (error) {
        console.error('[ADMIN DELETE ERROR]', error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ==========================================
// 9. ADMIN SCANNER: SYNC APIS
// ==========================================
let scannedTokens = {};

app.post('/api/admin/scan', (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, message: "Token missing" });

        const normalizedToken = String(token).trim().toUpperCase();
        scannedTokens[normalizedToken] = true;
        console.log(`📱 [ADMIN SCAN] Token scanned successfully via phone: ${normalizedToken}`);

        return res.status(200).json({ success: true, message: "Token scanned successfully" });
    } catch (error) {
        console.error('[ADMIN SCAN ERROR]', error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

app.get('/api/check-token-status', (req, res) => {
    try {
        const token = String(req.query.token || '').trim().toUpperCase();
        if (scannedTokens[token]) {
            return res.status(200).json({ isScanned: true });
        } else {
            return res.status(200).json({ isScanned: false });
        }
    } catch (error) {
        console.error('[CHECK STATUS ERROR]', error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ==========================================
// 📱 10. SMART SHORTCUT FOR PHONE SCANNER 
// ==========================================
app.get('/scan', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-scanner.html'));
});

// ==========================================
// SERVER START
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 KisanQueue Backend is running on Port ${PORT}`);
});