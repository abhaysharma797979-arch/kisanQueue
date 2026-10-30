const express = require('express');
const cors = require('cors');
const path = require('path');

// Firebase Admin SDK
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const app = express();
const PORT = process.env.PORT || 5001;

// ===============================
// FIREBASE CONFIGURATION
// ===============================

const serviceAccount = require('./serviceAccountKey.json');

const firebaseApp = initializeApp({
    credential: cert(serviceAccount),
    databaseURL: 'https://kisanqueue-default-rtdb.firebaseio.com'
});

const database = getDatabase(firebaseApp);

console.log('🔥 Firebase initialized successfully!');

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ===============================
// DATABASE HELPERS
// ===============================

const USERS_PATH = 'users';
const PROCUREMENT_PATH = 'procurementScans';

// Development OTP storage
const otpStore = {};

function procurementKey(token) {
    return String(token).trim().replace(/[.#$\[\]/]/g, '_');
}

function normalizeProcurementRecord(record, key = '') {
    if (!record || typeof record !== 'object') return record;

    const farmer = record.farmer || record.farmerDetails || record.farmerInfo || record.user || record.userData || record.profile || {};
    const booking = record.booking || record.bookingDetails || record.bookingInfo || {};
    const village = String(farmer.village || farmer.address?.village || record.village || '').trim();
    const district = String(farmer.district || farmer.address?.district || record.district || '').trim();

    return {
        ...record,
        token: String(record.token || record.tokenNumber || record.bookingToken || key || ''),
        farmer: {
            ...farmer,
            id: String(farmer.id || farmer.farmerId || record.farmerId || ''),
            name: String(farmer.name || farmer.fullName || farmer.farmerName || record.farmerName || record.name || 'Farmer'),
            mobile: String(farmer.mobile || farmer.phone || record.mobile || record.phone || ''),
            village,
            district,
            state: String(farmer.state || farmer.address?.state || record.state || ''),
            location: String(farmer.location || record.location || [village, district].filter(Boolean).join(', '))
        },
        booking: {
            ...booking,
            crop: String(booking.crop || booking.cropName || record.bookingCrop || ''),
            quantity: Number(booking.quantity || booking.qty || record.bookingQuantity) || null,
            centerName: String(booking.centerName || booking.center || record.centerName || ''),
            date: String(booking.date || record.bookingDate || ''),
            time: String(booking.time || record.bookingTime || '')
        }
    };
}

// Read users from Firebase
async function normalizeUser(user) {
    if (!user || typeof user !== 'object') return user;

    const address = user.address && typeof user.address === 'object' ? user.address : {};
    const village = String(user.village || address.village || '').trim();
    const district = String(user.district || address.district || '').trim();
    const state = String(user.state || address.state || 'Uttar Pradesh').trim();

    return {
        ...user,
        name: String(user.name || user.fullName || user.farmerName || '').trim(),
        location: user.location || [village, district, state].filter(Boolean).join(', '),
        village,
        district,
        state
    };
}

async function readUsers() {
    const snapshot = await database.ref(USERS_PATH).get();
    const value = snapshot.val();

    if (!value) {
        return [];
    }

    const users = Array.isArray(value) ? value.filter(Boolean) : Object.values(value);
    return Promise.all(users.map(normalizeUser));
}

// Find user by mobile number
async function findUserByMobile(mobile) {
    const users = await readUsers();
    const normalizedMobile = String(mobile).replace(/\D/g, '').slice(-10);

    return users.find(
        user => user && String(user.mobile).replace(/\D/g, '').slice(-10) === normalizedMobile
    );
}

// Generate a six-digit OTP
function generateOTP() {
    return String(
        Math.floor(100000 + Math.random() * 900000)
    );
}

// Validate Indian mobile number
function isValidMobile(mobile) {
    return /^[6-9]\d{9}$/.test(String(mobile));
}

// ===============================
// HOME PAGE
// ===============================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Admin scanner page
app.get('/scan', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-scanner.html'));
});

app.get('/mandi.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'mandi.html'));
});

// ===============================
// HEALTH CHECK
// ===============================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'KisanQueue server is running',
        port: PORT
    });
});

// Firebase connection check
app.get('/api/firebase-health', async (req, res) => {
    try {
        const snapshot = await database.ref(USERS_PATH).get();

        const value = snapshot.val();

        let usersCount = 0;

        if (Array.isArray(value)) {
            usersCount = value.filter(Boolean).length;
        } else if (value && typeof value === 'object') {
            usersCount = Object.keys(value).length;
        }

        res.json({
            success: true,
            message: 'Firebase connected successfully',
            usersCount
        });
    } catch (error) {
        console.error('Firebase error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Firebase connection failed'
        });
    }
});

// Development-mode login OTP endpoints.
app.post('/api/send-otp', async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!isValidMobile(mobile)) {
            return res.status(400).json({
                success: false,
                message: 'Valid 10-digit mobile number enter karein'
            });
        }

        const user = await findUserByMobile(mobile);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User registered nahi hai. Pehle registration karein.'
            });
        }

        // Development OTP only
        const otp = generateOTP();

        otpStore[`login_${mobile}`] = {
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000,
            attempts: 0
        };

        // Development purpose: OTP terminal par print hoga
        console.log(`🔐 Login OTP for ${mobile}: ${otp}`);

        res.json({
            success: true,
            message: 'OTP generated successfully. Development mode mein terminal check karein.',
            demoOtp: otp
        });

    } catch (error) {
        console.error('Send OTP error:', error.message);

        res.status(500).json({
            success: false,
            message: 'OTP generate nahi ho paya'
        });
    }
});

// ===============================
// LOGIN: VERIFY OTP
// ===============================

app.post('/api/verify-otp', async (req, res) => {
    try {
        const { mobile, otp } = req.body;

        if (!isValidMobile(mobile) || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number aur OTP required hain'
            });
        }

        const key = `login_${mobile}`;
        const savedOTP = otpStore[key];

        if (!savedOTP) {
            return res.status(400).json({
                success: false,
                message: 'OTP nahi mila ya expire ho gaya'
            });
        }

        if (Date.now() > savedOTP.expiresAt) {
            delete otpStore[key];

            return res.status(400).json({
                success: false,
                message: 'OTP expire ho gaya. Dobara OTP mangwayein.'
            });
        }

        savedOTP.attempts++;

        if (savedOTP.attempts > 5) {
            delete otpStore[key];

            return res.status(429).json({
                success: false,
                message: 'Bahut attempts ho gaye. Dobara OTP mangwayein.'
            });
        }

        if (String(otp) !== savedOTP.otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        const user = await findUserByMobile(mobile);

        if (!user) {
            delete otpStore[key];

            return res.status(404).json({
                success: false,
                message: 'User nahi mila'
            });
        }

        delete otpStore[key];

        res.json({
            success: true,
            message: 'Login successful',
            userData: user
        });

    } catch (error) {
        console.error('Verify OTP error:', error.message);

        res.status(500).json({
            success: false,
            message: 'OTP verification failed'
        });
    }
});

// ===============================
// REGISTRATION: SEND OTP
// ===============================

app.post('/api/register/send-otp', async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!isValidMobile(mobile)) {
            return res.status(400).json({
                success: false,
                message: 'Valid mobile number enter karein'
            });
        }

        const existingUser = await findUserByMobile(mobile);

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Is mobile number se account pehle se registered hai'
            });
        }

        // Development OTP only
        const otp = generateOTP();

        otpStore[`register_${mobile}`] = {
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000,
            attempts: 0,
            verified: false
        };

        console.log(`📝 Registration OTP for ${mobile}: ${otp}`);

        res.json({
            success: true,
            message: 'Registration OTP generated. Development mode mein terminal check karein.',
            demoOtp: otp
        });

    } catch (error) {
        console.error('Registration OTP error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Registration OTP generate nahi ho paya'
        });
    }
});

// ===============================
// REGISTRATION: VERIFY OTP
// ===============================

app.post('/api/register/verify-otp', (req, res) => {
    try {
        const { mobile, otp } = req.body;

        if (!isValidMobile(mobile) || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number aur OTP required hain'
            });
        }

        const key = `register_${mobile}`;
        const savedOTP = otpStore[key];

        if (!savedOTP) {
            return res.status(400).json({
                success: false,
                message: 'OTP nahi mila. Dobara OTP mangwayein.'
            });
        }

        if (Date.now() > savedOTP.expiresAt) {
            delete otpStore[key];

            return res.status(400).json({
                success: false,
                message: 'OTP expire ho gaya'
            });
        }

        savedOTP.attempts++;

        if (savedOTP.attempts > 5) {
            delete otpStore[key];

            return res.status(429).json({
                success: false,
                message: 'Bahut attempts ho gaye. Dobara OTP mangwayein.'
            });
        }

        if (String(otp) !== savedOTP.otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // OTP verified; registration flow can now continue
        savedOTP.verified = true;

        res.json({
            success: true,
            message: 'Mobile number verified successfully'
        });

    } catch (error) {
        console.error('Registration verification error:', error.message);

        res.status(500).json({
            success: false,
            message: 'OTP verification failed'
        });
    }
});

// ===============================
// REGISTRATION: SUBMIT BASIC INFO
// ===============================

app.post('/api/register/submit-basic-info', async (req, res) => {
    try {
    const body = req.body || {};
    const address = body.address || {};
    const bankDetails = body.bankDetails || {};

    const {
        mobile,
        name,
        farmerName,
        fullName,
        village: formVillage,
        district: formDistrict,
        state: formState,
        aadhaar,
        address: legacyAddress
    } = body;

    if (!isValidMobile(mobile)) {
        return res.status(400).json({
            success: false,
            message: 'Valid mobile number required'
        });
    }

    const registrationOTP = otpStore[`register_${mobile}`];

    if (
        !registrationOTP ||
        !registrationOTP.verified ||
        Date.now() > registrationOTP.expiresAt
    ) {
        return res.status(403).json({
            success: false,
            message: 'Pehle registration OTP verify karein'
        });
    }

    const finalName = String(name || farmerName || fullName || '').trim();
    const village = String(formVillage || address.village || address?.village || legacyAddress?.village || '').trim();
    const district = String(formDistrict || address.district || legacyAddress?.district || '').trim();
    const state = String(formState || address.state || legacyAddress?.state || body.state || 'Uttar Pradesh').trim();
    const addressText = String(address?.houseNo || legacyAddress?.houseNo || '').trim() +
        (address?.street || legacyAddress?.street ? `, ${String(address?.street || legacyAddress?.street).trim()}` : '');

    if (!finalName || !district || !village) {
        return res.status(400).json({
            success: false,
            message: 'Name, village aur district required hain'
        });
    }

        const existingUser = await findUserByMobile(mobile);

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User pehle se registered hai'
            });
        }

        const userId = database.ref(USERS_PATH).push().key;

        const normalizedState = state ? String(state).trim() : 'Uttar Pradesh';
        const normalizedDistrict = String(district).trim();
        const normalizedVillage = String(village).trim();

        const normalizedAddress = typeof address === 'object' ? {
            houseNo: address.houseNo ? String(address.houseNo).trim() : '',
            street: address.street ? String(address.street).trim() : '',
            pincode: address.pincode ? String(address.pincode).trim() : '',
            state: normalizedState,
            district: normalizedDistrict,
            tehsil: address.tehsil ? String(address.tehsil).trim() : '',
            village: normalizedVillage
        } : {
            state: normalizedState,
            district: normalizedDistrict,
            village: normalizedVillage,
            fullAddress: address ? String(address).trim() : ''
        };

        const newUser = {
            id: userId,
            mobile: String(mobile),
            name: String(finalName).trim(),
            village: normalizedVillage,
            district: normalizedDistrict,
            state: normalizedState,
            location: `${normalizedVillage}, ${normalizedDistrict}, ${normalizedState}`,
            address: normalizedAddress,
            aadhaar: aadhaar ? String(aadhaar).trim() : '',
            bankDetails: typeof bankDetails === 'object' ? {
                bankName: bankDetails.bankName ? String(bankDetails.bankName).trim() : '',
                accountNumber: bankDetails.accountNumber ? String(bankDetails.accountNumber).trim() : '',
                ifscCode: bankDetails.ifscCode ? String(bankDetails.ifscCode).trim() : '',
                accountHolder: bankDetails.accountHolder ? String(bankDetails.accountHolder).trim() : ''
            } : {},
            role: 'farmer',
            createdAt: new Date().toISOString()
        };

        await database.ref(`${USERS_PATH}/${userId}`).set(newUser);

        delete otpStore[`register_${mobile}`];

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            userData: newUser
        });

    } catch (error) {
        console.error('Registration error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

// ===============================
// UPDATE FARMER PROFILE
// ===============================

app.post('/api/updateProfile', async (req, res) => {
    try {
        const { mobile, ...profileData } = req.body;

        if (!isValidMobile(mobile)) {
            return res.status(400).json({
                success: false,
                message: 'Valid mobile number required'
            });
        }

        const snapshot = await database
            .ref(USERS_PATH)
            .orderByChild('mobile')
            .equalTo(String(mobile))
            .get();

        const matches = snapshot.val();

        if (!matches) {
            return res.status(404).json({
                success: false,
                message: 'Farmer not found'
            });
        }

        const userId = Object.keys(matches)[0];

        await database.ref(`${USERS_PATH}/${userId}`).update({
            ...profileData,
            updatedAt: new Date().toISOString()
        });

        const updatedSnapshot = await database
            .ref(`${USERS_PATH}/${userId}`)
            .get();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            userData: updatedSnapshot.val()
        });

    } catch (error) {
        console.error('Profile update error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Profile update failed'
        });
    }
});

// ===============================
// ADMIN: GET ALL USERS
// ===============================

app.get('/api/admin/users', async (req, res) => {
    try {
        const snapshot = await database.ref(USERS_PATH).get();
        const value = snapshot.val();

        let users = [];

        if (Array.isArray(value)) {
            users = value.filter(Boolean);
        } else if (value && typeof value === 'object') {
            users = Object.values(value);
        }

        res.json({
            success: true,
            count: users.length,
            users
        });

    } catch (error) {
        console.error('Fetch users error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Users fetch nahi ho paye'
        });
    }
});

// ===============================
// ADMIN: DELETE USER
// ===============================

app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const userRef = database.ref(`${USERS_PATH}/${id}`);
        const snapshot = await userRef.get();

        if (!snapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await userRef.remove();

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error.message);

        res.status(500).json({
            success: false,
            message: 'User delete nahi ho paya'
        });
    }
});

// ===============================
// ADMIN: SCAN TOKEN
// ===============================

app.post('/api/admin/scan', async (req, res) => {
    try {
        const body = req.body || {};
        const payload = body.payload || body.qrData || body.data || body;
        const token = body.token || payload.token || payload.tokenNumber || payload.bookingToken || payload.tokenId;
        const farmer = body.farmer || payload.farmer || payload.farmerDetails || payload.farmerInfo || payload.user || payload.userData || payload.profile || {};
        const booking = body.booking || payload.booking || payload.bookingDetails || payload.bookingInfo || {};

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token required'
            });
        }

        const tokenId = String(token).trim();
        const scanRef = database.ref(`${PROCUREMENT_PATH}/${procurementKey(tokenId)}`);
        const existing = await scanRef.get();
        const mobile = String(farmer.mobile || farmer.phone || '').replace(/\D/g, '').slice(-10);
        const farmerId = String(farmer.id || farmer.farmerId || '').trim();
        const users = farmerId || mobile ? await readUsers() : [];
        const registeredFarmer = users.find(user => farmerId && String(user.id || '') === farmerId)
            || users.find(user => mobile && String(user.mobile || '').replace(/\D/g, '').slice(-10) === mobile)
            || null;
        const current = existing.val();
        if (current && current.token && current.token !== tokenId) {
            return res.status(409).json({
                success: false,
                message: `Token collision: QR has ${tokenId}, but the saved record belongs to ${current.token}.`,
                tokenStatus: current
            });
        }

        const currentFarmer = current?.farmer || {};
        const resolvedMobile = String(registeredFarmer?.mobile || mobile || '').replace(/\D/g, '').slice(-10);
        if (currentFarmer.mobile && resolvedMobile && currentFarmer.mobile !== resolvedMobile) {
            return res.status(409).json({
                success: false,
                message: 'This token is already linked to a different farmer. Check the QR token before scanning again.',
                tokenStatus: current
            });
        }
        const resolvedId = String(registeredFarmer?.id || farmer.id || '').trim();
        if (currentFarmer.id && resolvedId && currentFarmer.id !== resolvedId &&
            !currentFarmer.mobile && currentFarmer.name && currentFarmer.name !== 'Farmer') {
            return res.status(409).json({
                success: false,
                message: 'This token is already linked to a different farmer ID. Check the QR token before scanning again.',
                tokenStatus: current
            });
        }
        const incomingName = String(registeredFarmer?.name || farmer.name || farmer.fullName || farmer.farmerName || '').trim();
        const scanRecord = {
            ...(current || {}),
            token: tokenId,
            farmer: {
                id: String(registeredFarmer?.id || currentFarmer.id || farmer.id || farmer.farmerId || ''),
                name: String((currentFarmer.name && currentFarmer.name !== 'Farmer' ? currentFarmer.name : '') || incomingName || 'Farmer'),
                mobile: currentFarmer.mobile || resolvedMobile || null,
                village: String(currentFarmer.village || registeredFarmer?.village || farmer.village || farmer.address?.village || ''),
                district: String(currentFarmer.district || registeredFarmer?.district || farmer.district || farmer.address?.district || ''),
                state: String(currentFarmer.state || registeredFarmer?.state || farmer.state || farmer.address?.state || ''),
                location: String(currentFarmer.location || registeredFarmer?.location || farmer.location || '')
            },
            booking: {
                ...(current?.booking || {}),
                crop: String(current?.booking?.crop || booking.crop || booking.cropName || ''),
                quantity: Number(current?.booking?.quantity || booking.quantity || booking.qty) || null,
                centerName: String(current?.booking?.centerName || booking.centerName || booking.center || ''),
                date: String(current?.booking?.date || booking.date || ''),
                time: String(current?.booking?.time || booking.time || '')
            },
            status: current?.status || 'Scanned',
            date: current?.date || new Date().toISOString().slice(0, 10),
            scannedAt: current?.scannedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const result = await scanRef.transaction(value => {
            if (value === null) return scanRecord;
            if (value.token && value.token !== tokenId) return;
            return {
                ...scanRecord,
                ...value,
                token: tokenId,
                farmer: scanRecord.farmer,
                booking: scanRecord.booking,
                updatedAt: new Date().toISOString()
            };
        });
        if (!result.committed) {
            return res.status(409).json({
                success: false,
                message: `Token collision: QR has ${tokenId}, but the saved record belongs to ${result.snapshot.val()?.token || 'another record'}.`,
                tokenStatus: result.snapshot.val()
            });
        }

        res.json({
            success: true,
            message: current ? 'Existing scan refreshed with farmer details' : 'Token scanned successfully',
            data: result.snapshot.val()
        });

    } catch (error) {
        console.error('Scan error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Token scan failed'
        });
    }
});

app.get('/api/mandi/scans', async (req, res) => {
    try {
        const snapshot = await database.ref(PROCUREMENT_PATH).get();
        const value = snapshot.val();
        const scans = value
            ? Object.entries(value).map(([key, record]) => normalizeProcurementRecord(record, key))
            : [];
        scans.sort((a, b) => String(b.updatedAt || b.scannedAt).localeCompare(String(a.updatedAt || a.scannedAt)));
        res.json({ success: true, scans });
    } catch (error) {
        console.error('Fetch procurement scans error:', error.message);
        res.status(500).json({ success: false, message: 'Mandi scan list could not be loaded' });
    }
});

app.post('/api/mandi/procure', async (req, res) => {
    try {
        const { token, crop, quantity, quality, rate } = req.body || {};
        const tokenId = String(token || '').trim();
        const qty = Number(quantity);
        const price = Number(rate);
        if (!tokenId || !crop || !(qty > 0) || !Number.isFinite(price) || price < 0 || !['A', 'B', 'C'].includes(quality)) {
            return res.status(400).json({ success: false, message: 'Token, crop, valid quantity, quality and rate are required' });
        }

        const scanRef = database.ref(`${PROCUREMENT_PATH}/${procurementKey(tokenId)}`);
        const snapshot = await scanRef.get();
        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Scanned token not found' });
        }
        const current = snapshot.val();
        const now = new Date().toISOString();
        const record = {
            ...current,
            crop: String(crop).trim(),
            quantity: qty,
            quality,
            rate: price,
            amount: Math.round(qty * price * 100) / 100,
            status: current.status === 'Paid' ? 'Paid' : 'Pending',
            date: now.slice(0, 10),
            updatedAt: now
        };
        await scanRef.set(record);
        res.json({ success: true, message: 'Procurement saved', data: record });
    } catch (error) {
        console.error('Save procurement error:', error.message);
        res.status(500).json({ success: false, message: 'Procurement could not be saved' });
    }
});

app.post('/api/mandi/pay/:token', async (req, res) => {
    try {
        const tokenId = String(req.params.token || '').trim();
        const scanRef = database.ref(`${PROCUREMENT_PATH}/${procurementKey(tokenId)}`);
        const snapshot = await scanRef.get();
        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Procurement record not found' });
        }
        const current = snapshot.val();
        if (current.status !== 'Pending') {
            return res.status(409).json({ success: false, message: current.status === 'Paid' ? 'Payment is already marked as paid' : 'Record is not pending payment' });
        }
        if (!current.crop || !(Number(current.quantity) > 0) || !['A', 'B', 'C'].includes(current.quality) || !Number.isFinite(Number(current.amount))) {
            return res.status(409).json({ success: false, message: 'Procurement is not fully verified for payment' });
        }
        const now = new Date().toISOString();
        const record = { ...current, status: 'Paid', paidAt: now, updatedAt: now };
        await scanRef.set(record);
        res.json({ success: true, message: 'Payment marked as paid', data: record });
    } catch (error) {
        console.error('Mark payment paid error:', error.message);
        res.status(500).json({ success: false, message: 'Payment status could not be updated' });
    }
});

// ===============================
// CHECK TOKEN STATUS
// ===============================

app.get('/api/check-token-status', async (req, res) => {
    const token = req.query.token;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: 'Token required'
        });
    }

    const tokenId = String(token).trim();
    try {
        const snapshot = await database.ref(`${PROCUREMENT_PATH}/${procurementKey(tokenId)}`).get();
        const record = normalizeProcurementRecord(snapshot.val(), procurementKey(tokenId));
        res.json({
            success: true,
            token,
            scanned: Boolean(record),
            isScanned: Boolean(record),
            data: record || null
        });
    } catch (error) {
        console.error('Check token status error:', error.message);
        res.status(500).json({ success: false, message: 'Token status could not be loaded' });
    }
});

// ===============================
// 404 HANDLER
// ===============================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.path
    });
});

// ===============================
// GLOBAL ERROR HANDLER
// ===============================

app.use((error, req, res, next) => {
    console.error('Server error:', error.message);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
    console.log('');
    console.log('====================================');
    console.log('🚀 KISANQUEUE BACKEND RUNNING');
    console.log('====================================');
    console.log(`🌐 Local server: http://localhost:${PORT}`);
    console.log(`🔥 Firebase test: http://localhost:${PORT}/api/firebase-health`);
    console.log(`❤️ Health check: http://localhost:${PORT}/api/health`);
    console.log('====================================');
});