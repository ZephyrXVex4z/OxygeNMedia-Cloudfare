import { auth } from "../firebase-config.js";
import { onAuthStateChanged, signInWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const err = document.getElementById("loginError");
const MSG = {
  "auth/operation-not-allowed": "El acceso por correo y contraseña no está habilitado en Firebase.",
  "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase (Authentication → Settings).",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
  "auth/network-request-failed": "Sin conexión. Revisa tu red.",
  "auth/user-disabled": "Esta cuenta está deshabilitada."
};
onAuthStateChanged(auth, u => { if (u) location.replace("../"); });
document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault(); err.textContent = "";
  const f = new FormData(e.target);
  try { await signInWithEmailAndPassword(auth, f.get("email").trim(), f.get("password")); }
  catch (x) { err.textContent = MSG[x.code] || "Correo o contraseña incorrectos."; console.error(x.code); }
});
