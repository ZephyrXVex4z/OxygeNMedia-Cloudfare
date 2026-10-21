// Ejecutar SOLO en tu equipo (entorno de confianza). Nunca subir al hosting.
// 1) npm i firebase-admin
// 2) Firebase Console > Configuración > Cuentas de servicio > Generar clave privada
//    y guardarla FUERA del sitio, p. ej. ./serviceAccount.json (no publicar)
// 3) node set-admin.js correo@ejemplo.com
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./serviceAccount.json")) });
const email = process.argv[2];
if (!email) { console.error("Uso: node set-admin.js correo"); process.exit(1); }
admin.auth().getUserByEmail(email)
  .then(u => admin.auth().setCustomUserClaims(u.uid, { admin: true }))
  .then(() => console.log("Claim admin asignado. La persona debe cerrar sesión y volver a entrar."))
  .catch(e => { console.error(e.message); process.exit(1); });
