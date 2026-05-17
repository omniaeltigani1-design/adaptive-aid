const API_BASE_URL = "https://corrosive-tipper-daydream.ngrok-free.dev";
const REGISTER_ENDPOINT = `${API_BASE_URL}/auth/register`;

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  const registerMessage = document.getElementById("registerMessage");
  const registerBtn = document.getElementById("registerBtn");
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get("verification") === "invalid") {
    showMessage(
      "This verification link is invalid or expired. Please register again with the same email and we will send you a new verification email.",
      "error"
   );
  }

  const passwordInput = document.getElementById("password");
  const ruleLength = document.getElementById("rule-length");
  const ruleUppercase = document.getElementById("rule-uppercase");
  const ruleLowercase = document.getElementById("rule-lowercase");
  const ruleNumber = document.getElementById("rule-number");

  function showMessage(text, type = "error") {
    registerMessage.className = "message";
    void registerMessage.offsetWidth;
    registerMessage.textContent = text;
    registerMessage.className = `message ${type} flash`;
  }

  function showHtmlMessage(html, type = "success") {
    registerMessage.className = "message";
    void registerMessage.offsetWidth;
    registerMessage.innerHTML = html;
    registerMessage.className = `message ${type} flash`;
  }

  function clearMessage() {
    registerMessage.textContent = "";
    registerMessage.className = "message";
  }

  function setButtonLoading(isLoading) {
    if (isLoading) {
      registerBtn.disabled = true;
      registerBtn.classList.add("loading");
      registerBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Registering...`;
    } else {
      registerBtn.disabled = false;
      registerBtn.classList.remove("loading");
      registerBtn.innerHTML = `<i class="fas fa-user-check"></i> Register`;
    }
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function updatePasswordRules(password) {
    ruleLength.className = password.length >= 8 ? "valid" : "invalid";
    ruleUppercase.className = /[A-Z]/.test(password) ? "valid" : "invalid";
    ruleLowercase.className = /[a-z]/.test(password) ? "valid" : "invalid";
    ruleNumber.className = /[0-9]/.test(password) ? "valid" : "invalid";
  }

  function validatePassword(password, name, email) {
    const commonPasswords = [
      "password",
      "password123",
      "12345678",
      "qwerty123",
      "admin123"
    ];

    const passwordLower = password.toLowerCase();
    const nameLower = name.toLowerCase();
    const emailName = email.split("@")[0].toLowerCase();

    if (commonPasswords.includes(passwordLower)) {
      return "Password is too common.";
    }

    if (password.length < 8) {
      return "Password must be at least 8 characters long.";
    }

    if (password.length > 64) {
      return "Password must not be longer than 64 characters.";
    }

    if (emailName && passwordLower.includes(emailName)) {
      return "Password cannot contain your email name.";
    }

    if (nameLower && passwordLower.includes(nameLower)) {
      return "Password cannot contain your name.";
    }

    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter.";
    }

    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter.";
    }

    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number.";
    }

    return null;
  }

  if (passwordInput) {
    passwordInput.addEventListener("input", () => {
      updatePasswordRules(passwordInput.value);
    });
  }

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const name = document.getElementById("name")?.value.trim();
    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value;

    if (!name || !email || !password) {
      showMessage("Please fill in all fields.");
      return;
    }

    if (!validateEmail(email)) {
      showMessage("Please enter a valid email address.");
      return;
    }

    const passwordError = validatePassword(password, name, email);

    if (passwordError) {
      showMessage(passwordError);
      return;
    }

    setButtonLoading(true);

    try {
      const response = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name,
          email: email,
          password: password
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.detail || data.message || "Registration failed.");
        return;
      }

      if (data.account_exists && data.is_email_verified === false) {
        if (data.verification_link) {
          showHtmlMessage(`
            This email is already registered but has not been verified yet.<br><br>
            We could not send the verification email. Use this testing link to verify your account:<br>
            <a href="${data.verification_link}">Verify Email</a>
          `);
        } else {
          showMessage(
            "This email is already registered but has not been verified yet. Please check your email to verify your account before logging in.",
            "success"
          );
        }

        return;
      }

      if (data.verification_link) {
        showHtmlMessage(`
          Account created, but the verification email could not be sent.<br><br>
          Use this testing link to verify your account:<br>
          <a href="${data.verification_link}">Verify Email</a>
        `);

        return;
      }

      showMessage(
        "Account created successfully. Please check your email to verify your account before logging in.",
        "success"
      );

    } catch (error) {
      console.error("Registration error:", error);
      showMessage("Could not connect to the server.");
    } finally {
      setButtonLoading(false);
    }
  });
});