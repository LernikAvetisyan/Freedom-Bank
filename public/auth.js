// /public/auth.js
(function () {
  const auth = () => firebase.auth();

  const $ = (id) => document.getElementById(id);
  const show = (el) => el.classList.remove("hidden");
  const hide = (el) => el.classList.add("hidden");
  const setErr = (el, msg) => { el.textContent = msg || ""; msg ? show(el) : hide(el); };

  // Modal controls
  const modal = $("signupModal");
  const openModal = () => modal.classList.remove("hidden");
  const closeModal = () => modal.classList.add("hidden");

  // Open/close modal
  $("signupBtn").addEventListener("click", openModal);
  $("closeSignupBtn").addEventListener("click", closeModal);
  $("cancelSignupBtn").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  // Login
  $("loginBtn").addEventListener("click", async () => {
    const email = $("email").value.trim();
    const password = $("password").value;
    const loginError = $("loginError");

    setErr(loginError, "");
    if (!email || !password) {
      setErr(loginError, "Enter email and password.");
      return;
    }

    try {
      await auth().signInWithEmailAndPassword(email, password);
      location.href = "dashboard.html";
    } catch (e) {
      setErr(loginError, e.message || String(e));
    }
  });

  // Signup
  $("createAccountBtn").addEventListener("click", async () => {
    const email = $("suEmail").value.trim();
    const pass1 = $("suPassword").value;
    const pass2 = $("suConfirm").value;
    const signupError = $("signupError");

    setErr(signupError, "");
    if (!email || !pass1) {
      setErr(signupError, "Email and password are required.");
      return;
    }
    if (pass1.length < 6) {
      setErr(signupError, "Password must be at least 6 characters.");
      return;
    }
    if (pass1 !== pass2) {
      setErr(signupError, "Passwords do not match.");
      return;
    }

    try {
      await auth().createUserWithEmailAndPassword(email, pass1);
      closeModal();
      location.href = "dashboard.html";
    } catch (e) {
      setErr(signupError, e.message || String(e));
    }
  });

  // If already logged in, go straight to dashboard
  firebase.auth().onAuthStateChanged((u) => {
    if (u && location.pathname.endsWith("/index.html")) {
      location.href = "dashboard.html";
    }
  });
})();
