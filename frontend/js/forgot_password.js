const API_BASE_URL = "http://https://adaptive-aid-production.up.railway.app";

document.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.getElementById("email");
  const sendBtn = document.getElementById("sendBtn");
  const msg = document.getElementById("msg");

  
  function showMessage(text, type = "success") {
    msg.className = `message ${type}`;
    msg.textContent = text;
  }

  function showHtmlMessage(html, type = "success") {
    msg.className = `message ${type}`;
    msg.innerHTML = html;
  }

  sendBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();

    msg.className = "message";
    msg.textContent = "";

    if (!email) {
      showMessage("Please enter your email address.", "error");
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";

    try {
      const res = await fetch(
        `${API_BASE_URL}/auth/forgot-password?email=${encodeURIComponent(email)}`,
        {
          method: "POST"
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showMessage("Could not send reset link. Please try again.", "error");
        return;
      }

      if (data.reset_link) {
        showHtmlMessage(`
          Password reset email could not be sent.<br>
          Use this reset link for testing:<br>
          <a href="${data.reset_link}">Reset Password</a>
        `);
        return;
      }

      showMessage(
        "If an account exists with this email, a password reset link has been sent.",
        "success"
      );

    } catch (err) {
      console.error("Forgot password error:", err);
      showMessage("Could not connect to the server.", "error");
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send Reset Link";
    }
  });
});