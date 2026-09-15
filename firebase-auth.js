import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase Console > Project settings > Your apps > Web app config.
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const auth = getAuth(initializeApp(firebaseConfig));
let confirmationResult = null;
let recaptchaVerifier = null;

const inputs = document.querySelectorAll(".otp-input");
const setStatus = (message, isError = false) => {
    const status = document.getElementById("authStatus");
    if (status) {
        status.textContent = message;
        status.className = `text-sm text-center mb-4 ${isError ? "text-red-600" : "text-green-700"}`;
    } else {
        alert(message);
    }
};

const resetOtpInputs = () => {
    inputs.forEach((input, index) => {
        input.value = "";
        input.disabled = index !== 0;
    });
    inputs[0]?.focus();
};

const showOtpSection = (mobile) => {
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("otpSection").classList.remove("hidden");
    document.getElementById("displayMobile").textContent = `+91 ${mobile}`;
    resetOtpInputs();
    window.startTimer();
};

window.handleSendOTP = async (isResend = false) => {
    const mobile = document.getElementById("mobileInput").value.trim().replace(/\D/g, "");
    if (mobile.length !== 10) {
        setStatus("Please enter a valid 10-digit mobile number.", true);
        return;
    }

    try {
        if (!recaptchaVerifier) {
            recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
                size: "invisible"
            });
        }
        confirmationResult = await signInWithPhoneNumber(auth, `+91${mobile}`, recaptchaVerifier);
        if (isResend) {
            setStatus("OTP resent successfully.");
        } else {
            showOtpSection(mobile);
            setStatus("OTP sent. Please enter the 6-digit OTP.");
        }
    } catch (error) {
        console.error("Firebase send OTP error:", error);
        recaptchaVerifier?.clear();
        recaptchaVerifier = null;
        setStatus("OTP could not be sent. Check Firebase settings and try again.", true);
    }
};

window.handleVerifyOTP = async () => {
    const otp = Array.from(inputs).map((input) => input.value).join("");
    if (!confirmationResult || !/^\d{6}$/.test(otp)) {
        setStatus("Please enter the complete 6-digit OTP.", true);
        return;
    }

    try {
        const result = await confirmationResult.confirm(otp);
        setStatus(`Login successful for ${result.user.phoneNumber}.`);
    } catch (error) {
        console.error("Firebase verify OTP error:", error);
        resetOtpInputs();
        setStatus("Invalid or expired OTP. Please try again.", true);
    }
};

window.resendOTP = () => window.handleSendOTP(true);
window.goBackToLogin = () => {
    document.getElementById("otpSection").classList.add("hidden");
    document.getElementById("loginSection").classList.remove("hidden");
    window.clearTimer?.();
    resetOtpInputs();
};

inputs.forEach((input, index) => {
    input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 1);
        if (input.value && inputs[index + 1]) {
            inputs[index + 1].disabled = false;
            inputs[index + 1].focus();
        }
    });
    input.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !input.value && inputs[index - 1]) {
            inputs[index - 1].value = "";
            inputs[index - 1].focus();
        }
    });
});
