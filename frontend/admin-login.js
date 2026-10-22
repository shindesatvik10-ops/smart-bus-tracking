document.addEventListener("DOMContentLoaded", function () {

    const loginForm = document.getElementById("adminLoginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const loginMessage = document.getElementById("loginMessage");

    loginForm.addEventListener("submit", function (event) {

        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        loginMessage.textContent = "Signing in...";
        loginMessage.style.color = "#2563eb";

        if (typeof auth === "undefined" || !auth || typeof auth.signInWithEmailAndPassword !== "function") {
            loginMessage.textContent = "Admin sign-in is unavailable because Firebase Authentication is not configured.";
            loginMessage.style.color = "red";
            return;
        }

        // Fallback Firebase Authentication
        if (typeof auth !== "undefined") {
            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;

                    // Verify admin role in users collection
                    if (typeof firestoreDb !== "undefined" && firestoreDb && firestoreDb.collection) {
                        return firestoreDb.collection("users").doc(user.uid).get().then((doc) => {
                            if (!doc.exists || doc.data().role !== "admin") {
                                auth.signOut();
                                throw new Error("This account is not registered as an Admin.");
                            }

                            sessionStorage.setItem("adminLoggedIn", "true");
                            sessionStorage.setItem("adminRole", "admin");
                            sessionStorage.setItem("adminName", doc.data().name || "Admin");
                            sessionStorage.setItem("adminUid", user.uid);

                            loginMessage.textContent = "Login successful! Redirecting...";
                            loginMessage.style.color = "green";

                            setTimeout(function () {
                                window.location.href = "./admin-dashboard.html";
                            }, 400);
                        });
                    } else {
                        sessionStorage.setItem("adminLoggedIn", "true");
                        sessionStorage.setItem("adminRole", "admin");
                        sessionStorage.setItem("adminName", "Admin");
                        sessionStorage.setItem("adminUid", user.uid);

                        loginMessage.textContent = "Login successful! Redirecting...";
                        loginMessage.style.color = "green";

                        setTimeout(function () {
                            window.location.href = "./admin-dashboard.html";
                        }, 400);
                    }
                })
                .catch((error) => {
                    console.log("Login error:", error.message);
                    loginMessage.textContent = "Invalid Admin email or password.";
                    loginMessage.style.color = "red";
                });
        } else {
            loginMessage.textContent = "Invalid Admin email or password.";
            loginMessage.style.color = "red";
        }

    });


    // ==========================
    // SHOW / HIDE PASSWORD
    // ==========================

    const togglePassword = document.getElementById("togglePassword");

    if (togglePassword) {
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
