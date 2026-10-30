// 1. Language Dictionary (English aur Hindi ke complete translations)
const translations = {
    "en": {
        "menu_dashboard": "Dashboard",
        "menu_book_slot": "Book New Slot",
        "menu_my_bookings": "My Bookings",
        "menu_my_token": "My Token",
        "menu_live_queue": "Live Queue",
        "menu_centers": "Procurement Centers",
        "menu_payments": "My Payments",
        "menu_profile": "Profile",
        "menu_support": "Support",
        "menu_logout": "Logout",
        "support_title": "Need Help?",
        "support_desc": "Our support team is always with you.",
        "support_btn": "Contact Support",
        
        // Dashboard Inner Content (English)
        "greeting": "Good Morning",
        "sub_greeting": "Welcome to KisanQueue. Book your slot and save your time.",
        "change_center": "Change Center",
        "slot_status_not": "Slot Not Booked",
        "banner_title": "Save your time and avoid long queues",
        "banner_desc": "Book your slot and arrive at the procurement center on time",
        "crop_label": "CROP",
        "crop_val": "Wheat",
        "date_label": "DATE",
        "time_label": "TIME SLOT",
        "stat1_title": "Next Booking",
        "stat1_desc": "No Bookings Found",
        "stat2_title": "Your Queue Status",
        "stat3_title": "Last Payment",
        "stat3_desc": "No Payments Made",
        "how_title": "How It Works",
        "step1_title": "1. Book Slot",
        "step1_desc": "Choose crop, quantity & time.",
        "step2_title": "2. Get QR Token",
        "step2_desc": "Receive digital token for appointment.",
        "step3_title": "3. Visit Center",
        "step3_desc": "Scan QR and check-in at center.",
        "step4_title": "4. Quality & Weight",
        "step4_desc": "Quality check and crop weighing.",
        "step5_title": "5. Get Payment",
        "step5_desc": "Direct transfer to bank account."
    },
    "hi": {
        "menu_dashboard": "डैशबोर्ड",
        "menu_book_slot": "नया स्लॉट बुक करें",
        "menu_my_bookings": "मेरी बुकिंग",
        "menu_my_token": "मेरा टोकन",
        "menu_live_queue": "लाइव कतार",
        "menu_centers": "खरीद केंद्र",
        "menu_payments": "मेरे भुगतान",
        "menu_profile": "प्रोफ़ाइल",
        "menu_support": "सहायता",
        "menu_logout": "लॉगआउट",
        "support_title": "सहायता चाहिए?",
        "support_desc": "हमारी सहायता टीम हमेशा आपके साथ है।",
        "support_btn": "संपर्क करें",
        
        // Dashboard Inner Content (Hindi)
        "greeting": "सुप्रभात",
        "sub_greeting": "किसानक्यू में आपका स्वागत है। अपना स्लॉट बुक करें और समय बचाएं।",
        "change_center": "केंद्र बदलें",
        "slot_status_not": "स्लॉट बुक नहीं है",
        "banner_title": "अपना समय बचाएं और लंबी लाइन से छुटकारा पाएं",
        "banner_desc": "स्लॉट बुक करें और निर्धारित समय पर खरीद केंद्र पर आएं",
        "crop_label": "फ़सल",
        "crop_val": "गेहूं",
        "date_label": "तारीख",
        "time_label": "समय स्लॉट",
        "stat1_title": "अगली बुकिंग",
        "stat1_desc": "कोई बुकिंग नहीं है",
        "stat2_title": "आपकी कतार स्थिति",
        "stat3_title": "आखिरी भुगतान",
        "stat3_desc": "कोई भुगतान नहीं हुआ है",
        "how_title": "यह कैसे काम करता है",
        "step1_title": "1. स्लॉट बुक करें",
        "step1_desc": "फ़सल, मात्रा और समय चुनें।",
        "step2_title": "2. QR टोकन प्राप्त करें",
        "step2_desc": "अपॉइंटमेंट के लिए टोकन पाएं।",
        "step3_title": "3. केंद्र पर आएं",
        "step3_desc": "क्यूआर स्कैन करके चेक-इन करें।",
        "step4_title": "4. जांच और वजन",
        "step4_desc": "गुणवत्ता जांच और फसल तौल।",
        "step5_title": "5. भुगतान प्राप्त करें",
        "step5_desc": "सीधे बैंक खाते में पैसे पाएं।"
    }
};

// 2. Language Apply Karne ka Function
function applyLanguage(lang) {
    const elements = document.querySelectorAll("[data-i18n]");
    
    elements.forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (translations[lang] && translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });
}

// 3. User Jab Button Dabaye Tab Language Change aur Save Karna
function changeLanguage(lang) {
    localStorage.setItem("kisanLanguage", lang);
    applyLanguage(lang);
}

// 4. Page Load Hote hi Save ki hui Language Apply Karna
document.addEventListener("DOMContentLoaded", () => {
    const savedLang = localStorage.getItem("kisanLanguage") || "hi"; 
    applyLanguage(savedLang);
});