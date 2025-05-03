const express = require("express")
const router = express.Router()
const bcrypt = require("bcrypt")
const uuid = require("uuid")

const sesiones = {}

// Middleware de test
router.use((req, res, next) => {
  console.log(req.method, ":", req.url)
  next()
})

// Middleware de verificación de token para rutas protegidas
function verificarSesion(req, res, next) {
  // Verificar si hay un token en la URL
  const tokenFromQuery = req.query.token
  let token = req.headers["authorization"]

  // Si hay un token en la URL, usarlo
  if (tokenFromQuery) {
    token = tokenFromQuery
  }

  // También verificar en cookies
  if (!token) {
    token = req.cookies.token
  }

  console.log("Verificando sesión con token:", token)

  if (!token || !sesiones[token]) {
    console.log("Token no válido o no encontrado:", token)
    return res.status(401).json({ err: true, errmsg: "Sesión no válida" })
  }

  if (sesiones[token].caducidad < Date.now()) {
    console.log("Sesión expirada:", sesiones[token])
    delete sesiones[token]
    return res.status(401).json({ err: true, errmsg: "Sesión expirada" })
  }

  req.userId = sesiones[token].userId
  req.username = sesiones[token].username // Guardar el nombre del usuario
  next()
}

// Función para obtener el userame desde la sesión basada en el token
function getUsernameFromToken(req) {
  const tokenFromQuery = req.query.token
  let token = req.headers["authorization"]

  if (tokenFromQuery) {
    token = tokenFromQuery
  }

  if (!token) {
    token = req.cookies.token
  }

  if (token && sesiones[token]) {
    return sesiones[token].username
  }

  return null
}

// Rutas estáticas
router.get("/", (req, res) => {
  const username = getUsernameFromToken(req)
  console.log("Username obtenido:", username)
  res.render("loginNregister", { title: "Authentication", username: username })
})

router.get("/login", (req, res) => {
  const username = getUsernameFromToken(req)
  console.log("Username obtenido:", username)
  res.render("loginNregister", { title: "Authentication", username: username })
})

router.get("/dashboard", verificarSesion, (req, res) => {
  console.log("Username obtenido en dashboard:", req.username)
  res.render("dashboard", { title: "Dashboard", username: req.username })
})

// Modificar la ruta de matchfinder para aceptar token por query param
router.get("/matchfinder", (req, res) => {
  console.log("Solicitando /matchfinder")

  // Verificar si hay un token en la URL
  const tokenFromQuery = req.query.token
  let token = req.headers["authorization"]

  // Si hay un token en la URL, usarlo
  if (tokenFromQuery) {
    token = tokenFromQuery
  }

  // También verificar en cookies
  if (!token) {
    token = req.cookies.token
  }

  console.log("Token en matchfinder:", token)

  if (!token || !sesiones[token]) {
    console.log("Token no válido o no encontrado en matchfinder:", token)
    const username = getUsernameFromToken(req)
    return res.render("loginNregister", { title: "Authentication", username: username })
  }

  if (sesiones[token].caducidad < Date.now()) {
    console.log("Sesión expirada en matchfinder:", sesiones[token])
    delete sesiones[token]
    return res.redirect("/login")
  }

  res.render("match_finder_inicio", { title: "Matchfinder", username: sesiones[token].username })
})

// Rutas para otras páginas
router.get("/tournament", (req, res) => {
  const username = getUsernameFromToken(req)
  console.log("Username obtenido en tournament:", username)
  res.render("tournament", { title: "League of Legends - Tournaments", username: username })
})

router.get("/more", (req, res) => {
  const username = getUsernameFromToken(req)
  console.log("Username obtenido en more:", username)
  res.render("more", { title: "Gaming Community", username: username })
})

router.get("/Mapa_del_sitio", (req, res) => {
  const username = getUsernameFromToken(req)
  console.log("Username obtenido en Mapa_del_sitio:", username) 
  res.render("Mapa_del_sitio", { title: "Mapa del Sitio - Buff Profit", username: username })
})

// Login y creación de sesión con token
router.post("/procesar_login", async (req, res) => {
  const { username, password } = req.body
  console.log("Intento de login para:", username)
  console.log("Datos recibidos:", req.body)

  try {
    const connection = await global.poolPromise.getConnection()
    const [rows] = await connection.execute("SELECT * FROM user WHERE username = ?", [username])
    connection.release()

    console.log("Resultados de la consulta:", rows.length > 0 ? "Usuario encontrado" : "Usuario no encontrado")

    if (rows.length > 0) {
      const user = rows[0]
      console.log("Usuario encontrado:", user.username)

      const passwordMatch = await bcrypt.compare(password, user.password)
      console.log("Contraseña coincide:", passwordMatch)

      if (passwordMatch) {
        const token = uuid.v4()
        sesiones[token] = {
          token: token,
          userId: user.id_user,
          username: user.username,
          caducidad: Date.now() + 7 * 86400000, 
        }

        console.log("Sesión creada:", token)
        console.log("Sesiones actuales:", Object.keys(sesiones))

        res.cookie("token", token, { httpOnly: true, maxAge: 7 * 86400000 }) 
        return res.json({ err: false, result: { token } })
      } else {
        console.log("Contraseña incorrecta para:", username)
        res.status(401).json({ err: true, errmsg: "Contraseña incorrecta" })
      }
    } else {
      console.log("Usuario no encontrado:", username)
      res.status(404).json({ err: true, errmsg: "Usuario no encontrado" })
    }
  } catch (err) {
    console.error("Error en login:", err)
    res.status(500).json({ err: true, errmsg: "Error al procesar login: " + err.message })
  }
})

// Registro de usuario
router.post("/procesar_registro", async (req, res) => {
  const { username, summoner, idSummoner, email, password } = req.body
  console.log("Intento de registro para:", username)

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    const connection = await global.poolPromise.getConnection()
    const [result] = await connection.execute(
      "INSERT INTO user (username, summoner, id_summoner, email, password, reputation) VALUES (?, ?, ?, ?, ?, ?)",
      [username, summoner, idSummoner, email, hashedPassword, 0],
    )
    connection.release()

    if (result.affectedRows > 0) {
      console.log("Usuario registrado correctamente:", username)
      res.json({ err: false, result: { message: "Usuario registrado correctamente" } })
    } else {
      console.log("Error al registrar usuario:", username)
      res.status(500).json({ err: true, errmsg: "Error al registrar usuario" })
    }
  } catch (err) {
    console.error("Error en registro:", err)
    res.status(500).json({ err: true, errmsg: "Error al procesar registro: " + err.message })
  }
})

module.exports = router
