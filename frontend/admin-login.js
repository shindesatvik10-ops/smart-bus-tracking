document.addEventListener("DOMContentLoaded", function () {

    const loginForm = document.getElementById("adminLoginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const loginMessage = document.getElementById("loginMessage");

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const inputVal = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!inputVal) {
            loginMessage.textContent = "Please enter Admin ID or Email.";
            loginMessage.style.color = "red";
            return;
        }
        if (!password) {
            loginMessage.textContent = "Please enter your password.";
            loginMessage.style.color = "red";
            return;
        }

        loginMessage.textContent = "Signing in...";
        loginMessage.style.color = "#2563eb";

        const inputLower = inputVal.toLowerCase();

        // ==========================================
        // 1. BUILT-IN ADMIN CREDENTIALS (ALWAYS RELIABLE)
        // Accepts: Admin / 123, admin / admin123, admin@smartbus.com / 123, etc.
        // ==========================================
        const isBuiltInAdminId =
            inputLower === "admin" ||
            inputLower === "admin@smartbus.com" ||
            inputLower === "admin-root-uid" ||
            inputLower === "admin1" ||
            inputLower === "root";

        const isBuiltInAdminPassword =
            password === "123" ||
            password === "admin123" ||
            password === "admin" ||
            password === "password123";

        if (isBuiltInAdminId && isBuiltInAdminPassword) {
            sessionStorage.setItem("adminLoggedIn", "true");
            sessionStorage.setItem("adminRole", "admin");
            sessionStorage.setItem("adminName", "Admin");
            sessionStorage.setItem("adminUid", "admin-root-uid");
            sessionStorage.setItem("adminEmail", "admin@smartbus.com");

            // Background Firebase Auth if available (non-blocking)
            if (typeof auth !== "undefined" && auth && typeof auth.signInWithEmailAndPassword === "function") {
                auth.signInWithEmailAndPassword("admin@smartbus.com", "admin123").catch(() => {});
            }

            loginMessage.textContent = "Login successful! Redirecting...";
            loginMessage.style.color = "green";

            setTimeout(function () {
                window.location.href = "./admin-dashboard.html";
            }, 300);
            return;
        }

        // ==========================================
        // 2. CHECK CUSTOM ADMINS FROM LOCAL STORAGE
        // ==========================================
        try {
            const localAdmins = JSON.parse(localStorage.getItem("smartbus_admins") || "{}");
            const foundAdmin = Object.values(localAdmins).find(
                (a) =>
                    (a.id?.toLowerCase() === inputLower ||
                        a.email?.toLowerCase() === inputLower ||
                        a.username?.toLowerCase() === inputLower) &&
                    a.password === password
            );
            if (foundAdmin) {
                sessionStorage.setItem("adminLoggedIn", "true");
                sessionStorage.setItem("adminRole", "admin");
                sessionStorage.setItem("adminName", foundAdmin.name || "Admin");
                sessionStorage.setItem("adminUid", foundAdmin.uid || "admin-custom-uid");
                sessionStorage.setItem("adminEmail", foundAdmin.email || "");

                loginMessage.textContent = "Login successful! Redirecting...";
                loginMessage.style.color = "green";
                setTimeout(function () {
                    window.location.href = "./admin-dashboard.html";
                }, 300);
                return;
            }
        } catch (e) {}

        // ==========================================
        // 3. FIREBASE AUTHENTICATION FALLBACK
        // ==========================================
        if (typeof auth !== "undefined" && auth && typeof auth.signInWithEmailAndPassword === "function") {
            const emailToTry = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputVal)
                ? inputVal
                : `${inputLower}@smartbus.com`;

            try {
                const userCredential = await auth.signInWithEmailAndPassword(emailToTry, password);
                const user = userCredential.user;

                let adminName = user.displayName || "Admin";

                // Verify admin role in Firestore if collection exists
                if (typeof firestoreDb !== "undefined" && firestoreDb && typeof firestoreDb.collection === "function") {
                    try {
                        const doc = await firestoreDb.collection("users").doc(user.uid).get();
                        if (doc.exists && doc.data().role !== "admin") {
                            await auth.signOut();
                            loginMessage.textContent = "This account does not have Admin privileges.";
                            loginMessage.style.color = "red";
                            return;
                        }
                        if (doc.exists && doc.data().name) {
                            adminName = doc.data().name;
                        }
                    } catch (fsErr) {
                        console.warn("Firestore admin check notice:", fsErr.message);
                    }
                }

                sessionStorage.setItem("adminLoggedIn", "true");
                sessionStorage.setItem("adminRole", "admin");
                sessionStorage.setItem("adminName", adminName);
                sessionStorage.setItem("adminUid", user.uid);
                sessionStorage.setItem("adminEmail", user.email || emailToTry);

                loginMessage.textContent = "Login successful! Redirecting...";
                loginMessage.style.color = "green";

                setTimeout(function () {
                    window.location.href = "./admin-dashboard.html";
                }, 300);
                return;
            } catch (authError) {
                console.warn("Firebase Admin auth notice:", authError.message);
            }
        }

        // ==========================================
        // 4. INVALID CREDENTIALS
        // ==========================================
        loginMessage.textContent = "Invalid Admin ID or Password. (Default: Admin / 123)";
        loginMessage.style.color = "red";
    });

    // ==========================
    // SHOW / HIDE PASSWORD
    // ==========================
    const togglePassword = document.getElementById("togglePassword");
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener("click", function () {
            if (passwordInput.type === "password") {
                passwordInput.type = "text";
                togglePassword.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
            } else {
                passwordInput.type = "password";
                togglePassword.innerHTML = '<i class="fa-solid fa-eye"></i>';
            }
        });
    }

});
