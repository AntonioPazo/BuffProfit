// lógica de autenticación
const express = require("express")
const bcrypt = require("bcrypt")
const uuid = require("uuid")

const router = express.Router()

// Objeto para almacenar sesiones
const sesiones = {}

// Middleware para verificar sesión
function verificarSesion(req, res, next) {
  // Obtener token de headers, query o cookies
  const tokenFromQuery = req.query.token
  const token = req.headers["authorization"] || tokenFromQuery || req.cookies.token

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
  req.username = sesiones[token].username
  next()
}

// Ruta de login
router.post("/procesar_login", async (req, res) => {
  const { username, password } = req.body
  console.log("Intento de login para:", username)

  try {
    const connection = await global.poolPromise.getConnection()
    const [rows] = await connection.execute("SELECT * FROM user WHERE username = ?", [username])
    connection.release()

    if (rows.length > 0) {
      const user = rows[0]
      const passwordMatch = await bcrypt.compare(password, user.password)

      if (passwordMatch) {
        const token = uuid.v4()
        sesiones[token] = {
          token: token,
          userId: user.id_user,
          username: user.username,
          caducidad: Date.now() + 7 * 86400000,
        }

        console.log("Sesión creada:", token)
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
    res.status(500).json({ err: true, errmsg: "Error al procesar login" })
  }
})

// Ruta de registro
router.post("/procesar_registro", async (req, res) => {
  const { username, summoner, idSummoner, email, password } = req.body

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    const connection = await global.poolPromise.getConnection()
    const [result] = await connection.execute(
      "INSERT INTO user (username, summoner, id_summoner, email, password, reputation) VALUES (?, ?, ?, ?, ?, ?)",
      [username, summoner, idSummoner, email, hashedPassword, 0],
    )
    connection.release()

    if (result.affectedRows > 0) {
      res.json({ err: false, result: { message: "Usuario registrado correctamente" } })
    } else {
      res.status(500).json({ err: true, errmsg: "Error al registrar usuario" })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ err: true, errmsg: "Error al procesar registro" })
  }
})

module.exports = router

