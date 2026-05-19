const API_BASE_URL = "http://https://adaptive-aid-production.up.railway.app";
const LOGIN_ENDPOINT = `${API_BASE_URL}/auth/login`;

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const loginMessage = document.getElementById("loginMessage");
  const loginBtn = document.getElementById("loginBtn");

  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get("verified") === "success") {
    showMessage(
      "Email verified successfully. You can now log in.",
      "success"
    );
  }

  function showMessage(text, type = "error") {
    loginMessage.textContent = text;
    loginMessage.className = `message ${type}`;
  }

  function clearMessage() {
    loginMessage.textContent = "";
    loginMessage.className = "message";
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      showMessage("Please fill in all fields.");
      return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Logging in...`;

    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.detail || data.message || "";

  
        if (response.status === 403 && errorMsg.toLowerCase().includes("not verified")) {
        showMessage(
        "Your account is not verified. We sent you a new verification email. Please check your inbox.",
        "error"
      );
        } else {
            showMessage(errorMsg || "Login failed. Please try again.");
        }

        return;
  } 

      localStorage.setItem("studentId", String(data.student_id));
      localStorage.setItem("studentName", data.name || "");
      localStorage.setItem("studentEmail", email);

      showMessage("Login successful.", "success");

      setTimeout(() => {
        window.location.href = "courses.html";
      }, 800);

    } catch (error) {
      console.error("Login error:", error);
      showMessage("Could not connect to the server.");
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Login`;
    }
  });
});