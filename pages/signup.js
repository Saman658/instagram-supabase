const signupForm = document.getElementById("signup-form");
const signupMessage = document.getElementById("signup-message");

if (signupForm) {
    (async () => {
        if (await window.authAPI?.isLoggedIn()) {
            window.location.href = "../index.html";
        }
    })();

    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const usernameInput = document.getElementById("signup-username");
        const emailInput = document.getElementById("signup-email");
        const passwordInput = document.getElementById("signup-password");
        const confirmInput = document.getElementById("signup-confirm");

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;

        if (!username || !email || !password || !confirmPassword) {
            signupMessage.textContent = "Please fill in all fields.";
            signupMessage.style.color = "#dc3545";
            return;
        }

        if (username.length < 3) {
            signupMessage.textContent = "Username must be at least 3 characters.";
            signupMessage.style.color = "#dc3545";
            return;
        }

        if (password.length < 6) {
            signupMessage.textContent = "Password must be at least 6 characters.";
            signupMessage.style.color = "#dc3545";
            return;
        }

        if (password !== confirmPassword) {
            signupMessage.textContent = "Passwords do not match.";
            signupMessage.style.color = "#dc3545";
            return;
        }

        const submitButton = signupForm.querySelector("button[type=\"submit\"]");
        submitButton.disabled = true;
        signupMessage.textContent = "Creating account...";
        signupMessage.style.color = "#777";

        const { data, error } = await window.authAPI.signup(email, password, username);
        submitButton.disabled = false;

        if (error) {
            signupMessage.textContent = error;
            signupMessage.style.color = "#dc3545";
            return;
        }

        if (!data?.session) {
            signupMessage.textContent = "Account created. Please check your email to confirm, then log in.";
            signupMessage.style.color = "#28a745";
            return;
        }

        signupMessage.textContent = "Account created! Redirecting...";
        signupMessage.style.color = "#28a745";

        setTimeout(() => {
            window.location.href = "../index.html";
        }, 500);
    });
}