const API_BASE_URL = "http://https://adaptive-aid-production.up.railway.app";

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const passwordInput = document.getElementById("password");
  const resetBtn = document.getElementById("resetBtn");
  const msg = document.getElementById("msg");

  const ruleLength = document.getElementById("rule-length");
  const ruleUppercase = document.getElementById("rule-uppercase");
  const ruleLowercase = document.getElementById("rule-lowercase");
  const ruleNumber = document.getElementById("rule-number");

  function showMessage(text, type = "error") {
    msg.className = `message ${type}`;
    msg.textContent = text;
  }

  function clearMessage() {
    msg.className = "message";
    msg.textContent = "";
  }

  function updatePasswordRules(password) {
    if (ruleLength) {
      ruleLength.className = password.length >= 8 ? "valid" : "invalid";
    }

    if (ruleUppercase) {
      ruleUppercase.className = /[A-Z]/.test(password) ? "valid" : "invalid";
    }

    if (ruleLowercase) {
      ruleLowercase.className = /[a-z]/.test(password) ? "valid" : "invalid";
    }

    if (ruleNumber) {
      ruleNumber.className = /[0-9]/.test(password) ? "valid" : "invalid";
    }
  }

  function validatePassword(password) {
    if (!password) return "Please enter a new password.";
    if (password.length < 8) return "Password must be at least 8 characters long.";
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
    if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
    if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
    return null;
  }

  function getErrorMessage(data, fallback = "Password reset failed.") {
    if (!data) return fallback;

    if (typeof data.detail === "string") {
      return data.detail;
    }

    if (typeof data.message === "string") {
      return data.message;
    }

    if (Array.isArray(data.detail)) {
      return data.detail
        .map((error) => error.msg || "Invalid input.")
        .join(" ");
    }

    return fallback;
  }

  if (!token) {
    showMessage("Invalid reset link. Please request a new password reset email.", "error");

    if (resetBtn) {
      resetBtn.disabled = true;
    }

    return;
  }

  if (passwordInput) {
    passwordInput.addEventListener("input", () => {
      clearMessage();
      updatePasswordRules(passwordInput.value);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      clearMessage();

      const password = passwordInput.value;

      const passwordError = validatePassword(password);

      if (passwordError) {
        showMessage(passwordError, "error");
        return;
      }

      resetBtn.disabled = true;
      resetBtn.textContent = "Resetting...";

      try {
        const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            token: token,
            new_password: password
          })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showMessage(getErrorMessage(data), "error");
          return;
        }

        showMessage("Password reset successful. Redirecting to login...", "success");

        setTimeout(() => {
          window.location.href = "login.html";
        }, 1500);

      } catch (err) {
        console.error("Reset password error:", err);
        showMessage("Could not connect to the server.", "error");
      } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = "Reset Password";
      }
    });
  }
});