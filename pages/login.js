const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");

if (loginForm) {
    (async () => {
        if (await window.authAPI?.isLoggedIn()) {
            window.location.href = "../index.html";
        }
    })();

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const emailInput = document.getElementById("login-email");
        const passwordInput = document.getElementById("login-password");

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            loginMessage.textContent = "Please enter both email and password.";
            loginMessage.style.color = "#dc3545";
            return;
        }

        const submitButton = loginForm.querySelector("button[type=\"submit\"]");
        submitButton.disabled = true;
        loginMessage.textContent = "Logging in...";
        loginMessage.style.color = "#777";

        const { error, data } = await window.authAPI.login(email, password);
        submitButton.disabled = false;

        if (error) {
            loginMessage.textContent = error;
            loginMessage.style.color = "#dc3545";
            return;
        }

        if (!data?.session) {
            loginMessage.textContent = "Login failed: no Supabase session.";
            loginMessage.style.color = "#dc3545";
            return;
        }

        loginMessage.textContent = "Login successful! Redirecting...";
        loginMessage.style.color = "#28a745";

        setTimeout(() => {
            window.location.href = "../index.html";
        }, 500);
    });
}