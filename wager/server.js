const express = require("express")
const bodyParser = require("body-parser")
const mysql = require("mysql2/promise")
const path = require("path")
const routes = require("./routes")
const uuid = require("uuid")
const cookieParser = require("cookie-parser")

const app = express()
const port = process.env.PORT || 3000

// Configuración de la conexión a la base de datos
const config = {
  host: "localhost",
  user: "root",
  password: "",
  database: "buffprofit",
}
;(async () => {
  try {
    const pool = await mysql.createPool(config)
    global.poolPromise = pool
    console.log("Conexión a la base de datos establecida")

    // Verificar la conexión con una consulta simple
    const connection = await pool.getConnection()
    const [rows] = await connection.execute("SELECT 1")
    connection.release()
    console.log("Prueba de conexión exitosa:", rows)

    // Verificar la estructura de la tabla user
    try {
      const connection = await pool.getConnection()
      const [columns] = await connection.execute("DESCRIBE user")
      connection.release()
      console.log(
        "Estructura de la tabla user:",
        columns.map((col) => col.Field),
      )
    } catch (err) {
      console.error("Error al verificar la tabla user:", err)
    }
  } catch (err) {
    console.error("Error al conectar a la base de datos:", err)
    process.exit(1) // Salir si hay un error en la conexión a la base de datos
  }
})()

// Configuración de EJS
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))

// Middleware
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "public")))
app.use(cookieParser()) // Middleware para manejar cookies

// Middleware para logging de solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  if (req.method === "POST") {
    console.log("Body:", req.body)
  }
  console.log("Headers:", req.headers)
  console.log("Cookies:", req.cookies)
  next()
})

// Rutas
app.use("/", routes)

// Manejo de errores
app.use((err, req, res, next) => {
  console.error("Error no controlado:", err)
  res.status(500).json({ err: true, errmsg: "Error interno del servidor: " + err.message })
})

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`)
})
