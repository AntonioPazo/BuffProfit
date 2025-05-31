const express = require("express")
const router = express.Router()
const bcrypt = require("bcrypt")
const uuid = require("uuid")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const paypal = require('@paypal/checkout-server-sdk');

// Configuración de multer para subir imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "public/uploads/match-results")
    // Crear el directorio si no existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, "result-" + uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
  fileFilter: (req, file, cb) => {
    // Aceptar solo imágenes
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error("Solo se permiten archivos de imagen"))
    }
    cb(null, true)
  },
})

// Configuración de multer para subir imágenes de torneos
const tournamentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "public/uploads/tournaments")
    // Crear el directorio si no existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, "tournament-" + uniqueSuffix + path.extname(file.originalname))
  },
})

const uploadTournament = multer({
  storage: tournamentStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
  fileFilter: (req, file, cb) => {
    // Aceptar solo imágenes
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error("Solo se permiten archivos de imagen"))
    }
    cb(null, true)
  },
})

// Configuración de multer para subir logos de equipos
const teamStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "public/uploads/teams")
    // Crear el directorio si no existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, "team-" + uniqueSuffix + path.extname(file.originalname))
  },
})

const uploadTeam = multer({
  storage: teamStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
  fileFilter: (req, file, cb) => {
    // Aceptar solo imágenes
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error("Solo se permiten archivos de imagen"))
    }
    cb(null, true)
  },
})

// Simulación de sesiones (en un entorno real, usar base de datos)
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
    return res.redirect("/login");
  }

  if (sesiones[token].caducidad < Date.now()) {
    console.log("Sesión expirada:", sesiones[token])
    delete sesiones[token]
    return res.status(401).json({ err: true, errmsg: "Sesión expirada" })
  }

  req.userId = sesiones[token].userId
  req.username = sesiones[token].username // Guardar el nombre del usuario
  req.isAdmin = sesiones[token].isAdmin || false // Verificar si es admin
  next()
}

// Middleware para verificar si el usuario es administrador
function verificarAdmin(req, res, next) {
  if (!req.isAdmin) {
    return res.status(403).json({ err: true, errmsg: "Acceso denegado. Se requieren permisos de administrador." })
  }
  next()
}

// Función para obtener el username desde la sesión basada en el token
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

// Función para verificar si el usuario es administrador
function isAdminFromToken(req) {
  const tokenFromQuery = req.query.token
  let token = req.headers["authorization"]

  if (tokenFromQuery) {
    token = tokenFromQuery
  }

  if (!token) {
    token = req.cookies.token
  }

  if (token && sesiones[token]) {
    return sesiones[token].isAdmin || false
  }

  return false
}

// Función para crear una notificación
async function createNotification(userId, type, message, relatedId = null) {
  try {
    const connection = await global.poolPromise.getConnection()
    await connection.execute(
      `INSERT INTO notification (id_summoner, type, message, related_id)
       VALUES (?, ?, ?, ?)`,
      [userId, type, message, relatedId],
    )
    connection.release()
    return true
  } catch (err) {
    console.error("Error al crear notificación:", err)
    return false
  }
}

// Rutas estáticas
router.get("/", (req, res) => {
  const username = getUsernameFromToken(req)
  console.log("Username obtenido:", username) // Registro de depuración
  res.render("loginNregister", { title: "Authentication", username: username })
})

router.get("/login", (req, res) => {
  const username = getUsernameFromToken(req)
  console.log("Username obtenido:", username) // Registro de depuración
  res.render("loginNregister", { title: "Authentication", username: username })
})

router.get("/dashboard", verificarSesion, async (req, res) => {
  console.log("Username obtenido en dashboard:", req.username)

  try {
    const connection = await global.poolPromise.getConnection()

    // Obtener el id_summoner del usuario
    const [userRows] = await connection.execute(`SELECT id_summoner FROM user WHERE username = ?`, [req.username])

    if (userRows.length === 0) {
      connection.release()
      return res.redirect("/login")
    }

    const userId = userRows[0].id_summoner

    // Obtener notificaciones no leídas
    const [notifications] = await connection.execute(
      `SELECT * FROM notification 
       WHERE id_summoner = ? AND is_read = FALSE
       ORDER BY created_at DESC`,
      [userId],
    )

    connection.release()

    res.render("dashboard", {
      title: "Dashboard",
      username: req.username,
      notifications: notifications,
      notificationCount: notifications.length,
    })
  } catch (err) {
    console.error("Error al cargar notificaciones:", err)
    res.render("dashboard", {
      title: "Dashboard",
      username: req.username,
      notifications: [],
      notificationCount: 0,
    })
  }
})
// ruta logout

router.get('/logout', (req, res) => {
    res.clearCookie('token', { path: '/' });
    res.redirect('/');
});

// Ruta para el panel de administración
router.get("/admin", verificarSesion, verificarAdmin, async (req, res) => {
  try {
    const connection = await global.poolPromise.getConnection()

    // Obtener los torneos existentes
    const [tournaments] = await connection.execute("SELECT * FROM tournament ORDER BY start_date DESC")

    // Obtener todos los usuarios
    const [users] = await connection.execute(`
      SELECT id_summoner, username, email, summoner, creditos, reputation, created_at 
      FROM user 
      ORDER BY created_at DESC
    `)

    // Obtener los créditos y id_summoner del usuario admin actual
    let userCreditos = 0;
    let notifications = [];
    let notificationCount = 0;

    if (req.username) {
      // Obtener créditos e id_summoner en una sola consulta
      const [adminRows] = await connection.execute(
        "SELECT creditos, id_summoner FROM user WHERE username = ?", 
        [req.username]
      )
      
      if (adminRows.length > 0) {
        userCreditos = adminRows[0].creditos || 0
        const adminIdSummoner = adminRows[0].id_summoner;
        
        // Obtener notificaciones no leídas (igual que en matchfinder)
        const [notificationRows] = await connection.execute(
          `SELECT * FROM notification 
           WHERE id_summoner = ? 
           AND is_read = FALSE
           ORDER BY created_at DESC`,
          [adminIdSummoner]
        )
        
        notifications = notificationRows;
        notificationCount = notifications.length;
      }
    }

    connection.release()

    res.render("admin", {
      title: "Admin Panel",
      username: req.username,
      userCreditos: userCreditos,
      notifications: notifications,        // Añadir esta línea
      notificationCount: notificationCount, // Añadir esta línea
      tournaments: tournaments,
      users: users,
      message: req.query.message,
      error: req.query.error,
    })
  } catch (err) {
    console.error("Error al obtener datos del admin:", err)
    res.render("admin", {
      title: "Admin Panel",
      username: req.username,
      userCreditos: 0,
      notifications: [],        // Añadir esta línea
      notificationCount: 0,     // Añadir esta línea
      tournaments: [],
      users: [],
      error: "Error al cargar datos",
    })
  }
})

// Route to edit a tournament
router.get("/edit-tournament/:id", verificarSesion, verificarAdmin, async (req, res) => {
  try {
    const tournamentId = req.params.id

    const connection = await global.poolPromise.getConnection()

    // Get tournament information
    const [tournamentRows] = await connection.execute("SELECT * FROM tournament WHERE id_tournament = ?", [
      tournamentId,
    ])

    connection.release()

    if (tournamentRows.length === 0) {
      return res.redirect("/admin?error=tournament-not-found")
    }

    const tournament = tournamentRows[0]

    res.render("edit-tournament", {
      title: "Edit Tournament",
      username: req.username,
      tournament: tournament,
      error: null,
    })
  } catch (err) {
    console.error("Error loading tournament for editing:", err)
    return res.redirect("/admin?error=server-error")
  }
})

// Route to update a tournament
router.post(
  "/update-tournament/:id",
  verificarSesion,
  verificarAdmin,
  uploadTournament.single("tournament_image"),
  async (req, res) => {
    try {
      const tournamentId = req.params.id
      const {
        name,
        description,
        start_date,
        start_time,
        entry_fee,
        prize_pool,
        team_size,
        format,
        map,
        region,
        skill_level,
        max_participants,
        status,
      } = req.body

      // Combine date and time
      const startDateTime = new Date(`${start_date}T${start_time}`)

      const connection = await global.poolPromise.getConnection()

      // Check if tournament exists
      const [tournamentCheck] = await connection.execute("SELECT * FROM tournament WHERE id_tournament = ?", [
        tournamentId,
      ])

      if (tournamentCheck.length === 0) {
        connection.release()
        return res.redirect("/admin?error=tournament-not-found")
      }

      // Prepare update query
      let updateQuery = `UPDATE tournament SET 
        name = ?, 
        description = ?, 
        start_date = ?, 
        entry_fee = ?, 
        prize_pool = ?, 
        team_size = ?, 
        format = ?, 
        map = ?, 
        region = ?, 
        skill_level = ?, 
        max_participants = ?,
        status = ?`

      const updateParams = [
        name,
        description,
        startDateTime,
        Number.parseFloat(entry_fee),
        Number.parseFloat(prize_pool),
        team_size,
        format,
        map,
        region,
        skill_level,
        Number.parseInt(max_participants),
        status,
      ]

      // If a new image was uploaded, add it to the update
      if (req.file) {
        const imagePath = `/uploads/tournaments/${req.file.filename}`
        updateQuery += `, image_path = ?`
        updateParams.push(imagePath)
      }

      // Add WHERE clause
      updateQuery += ` WHERE id_tournament = ?`
      updateParams.push(tournamentId)

      // Update tournament
      const [result] = await connection.execute(updateQuery, updateParams)

      connection.release()

      if (result.affectedRows > 0) {
        return res.redirect("/admin?message=tournament-updated")
      } else {
        return res.redirect("/admin?error=failed-to-update-tournament")
      }
    } catch (err) {
      console.error("Error updating tournament:", err)
      return res.redirect("/admin?error=server-error")
    }
  },
)

// Route to view tournament details and participants
router.get("/view-tournament/:id", verificarSesion, verificarAdmin, async (req, res) => {
  try {
    const tournamentId = req.params.id

    const connection = await global.poolPromise.getConnection()

    // Get tournament information
    const [tournamentRows] = await connection.execute("SELECT * FROM tournament WHERE id_tournament = ?", [
      tournamentId,
    ])

    if (tournamentRows.length === 0) {
      connection.release()
      return res.redirect("/admin?error=tournament-not-found")
    }

    const tournament = tournamentRows[0]

    // Get participants (teams)
    const [participants] = await connection.execute(
      `SELECT tt.*, t.name as team_name, t.tag as team_tag, t.logo_path
       FROM tournament_team tt
       JOIN team t ON tt.id_team = t.id_team
       WHERE tt.id_tournament = ?
       ORDER BY tt.registration_date ASC`,
      [tournamentId],
    )

    connection.release()

    res.render("view-tournament", {
      title: "View Tournament",
      username: req.username,
      tournament: tournament,
      participants: participants,
    })
  } catch (err) {
    console.error("Error loading tournament details:", err)
    return res.redirect("/admin?error=server-error")
  }
})

// Route to remove a team from a tournament
router.post("/remove-team-from-tournament", verificarSesion, verificarAdmin, async (req, res) => {
  try {
    const { team_id, tournament_id } = req.body

    const connection = await global.poolPromise.getConnection()

    // Check if the tournament and team exist
    const [tournamentCheck] = await connection.execute("SELECT * FROM tournament WHERE id_tournament = ?", [
      tournament_id,
    ])
    const [teamCheck] = await connection.execute("SELECT * FROM team WHERE id_team = ?", [team_id])

    if (tournamentCheck.length === 0 || teamCheck.length === 0) {
      connection.release()
      return res.redirect(`/view-tournament/${tournament_id}?error=tournament-or-team-not-found`)
    }

    // Remove the team from the tournament
    const [result] = await connection.execute("DELETE FROM tournament_team WHERE id_tournament = ? AND id_team = ?", [
      tournament_id,
      team_id,
    ])

    if (result.affectedRows > 0) {
      // Update the participant count
      await connection.execute(
        "UPDATE tournament SET current_participants = current_participants - 1 WHERE id_tournament = ?",
        [tournament_id],
      )

      // Refund the entry fee to the team captain if needed
      // This is optional and depends on your business logic
      // You might want to add this functionality later

      connection.release()
      return res.redirect(`/view-tournament/${tournament_id}?message=team-removed`)
    } else {
      connection.release()
      return res.redirect(`/view-tournament/${tournament_id}?error=failed-to-remove-team`)
    }
  } catch (err) {
    console.error("Error removing team from tournament:", err)
    return res.redirect(`/admin?error=server-error`)
  }
})

// Ruta para crear un nuevo torneo
router.post(
  "/create-tournament",
  verificarSesion,
  verificarAdmin,
  uploadTournament.single("tournament_image"),
  async (req, res) => {
    try {
      const {
        name,
        description,
        start_date,
        start_time,
        entry_fee,
        prize_pool,
        team_size,
        format,
        map,
        region,
        skill_level,
        max_participants,
      } = req.body

      // Combinar fecha y hora
      const startDateTime = new Date(`${start_date}T${start_time}`)

      // Obtener la ruta de la imagen si se subió
      let imagePath = null
      if (req.file) {
        imagePath = `/uploads/tournaments/${req.file.filename}`
      }

      const connection = await global.poolPromise.getConnection()

      // Insertar el torneo en la base de datos
      const [result] = await connection.execute(
        `INSERT INTO tournament (
        name, description, start_date, entry_fee, prize_pool, 
        team_size, format, map, region, skill_level, 
        max_participants, image_path, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          description,
          startDateTime,
          Number.parseFloat(entry_fee),
          Number.parseFloat(prize_pool),
          team_size,
          format,
          map,
          region,
          skill_level,
          Number.parseInt(max_participants),
          imagePath,
          req.username,
        ],
      )

      connection.release()

      if (result.affectedRows > 0) {
        return res.redirect("/admin?message=tournament-created")
      } else {
        return res.redirect("/admin?error=failed-to-create-tournament")
      }
    } catch (err) {
      console.error("Error al crear torneo:", err)
      return res.redirect("/admin?error=server-error")
    }
  },
)

// Ruta para eliminar un torneo
router.get("/delete-tournament/:id", verificarSesion, verificarAdmin, async (req, res) => {
  try {
    const tournamentId = req.params.id

    const connection = await global.poolPromise.getConnection()

    // Eliminar el torneo
    const [result] = await connection.execute("DELETE FROM tournament WHERE id_tournament = ?", [tournamentId])

    connection.release()

    if (result.affectedRows > 0) {
      return res.redirect("/admin?message=tournament-deleted")
    } else {
      return res.redirect("/admin?error=tournament-not-found")
    }
  } catch (err) {
    console.error("Error al eliminar torneo:", err)
    return res.redirect("/admin?error=server-error")
  }
})

// Ruta para crear un nuevo usuario desde admin
router.post("/admin-create-user", verificarSesion, verificarAdmin, async (req, res) => {
  try {
    const { username, email, password, summoner, creditos, id_summoner } = req.body

    const connection = await global.poolPromise.getConnection()

    // Validar formato de id_summoner (debe contener # y tener al menos 3 caracteres)
    if (!id_summoner || !id_summoner.includes("#") || id_summoner.length < 3) {
      connection.release()
      return res.redirect("/admin?error=invalid-summoner-format")
    }

    // Verificar si el usuario ya existe
    const [existingUsers] = await connection.execute(
      "SELECT username, email, id_summoner FROM user WHERE username = ? OR email = ? OR id_summoner = ?",
      [username, email, id_summoner],
    )

    if (existingUsers.length > 0) {
      connection.release()
      return res.redirect("/admin?error=user-already-exists")
    }

    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(password, 10)

    // Insertar el nuevo usuario (id_summoner como string)
    const [result] = await connection.execute(
      `INSERT INTO user (id_summoner, username, email, password, summoner, creditos) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_summoner, username, email, hashedPassword, summoner, Number.parseInt(creditos) || 100],
    )

    connection.release()

    if (result.affectedRows > 0) {
      return res.redirect("/admin?message=user-created")
    } else {
      return res.redirect("/admin?error=failed-to-create-user")
    }
  } catch (err) {
    console.error("Error al crear usuario:", err)
    return res.redirect("/admin?error=server-error")
  }
})

// Ruta para editar un usuario desde admin
router.post("/admin-edit-user", verificarSesion, verificarAdmin, async (req, res) => {
  try {
    const { user_id, username, email, summoner, creditos, password, id_summoner } = req.body

    const connection = await global.poolPromise.getConnection()

    // Validar formato de id_summoner (debe contener # y tener al menos 3 caracteres)
    if (!id_summoner || !id_summoner.includes("#") || id_summoner.length < 3) {
      connection.release()
      return res.redirect("/admin?error=invalid-summoner-format")
    }

    // Verificar si el usuario existe
    const [userCheck] = await connection.execute("SELECT * FROM user WHERE id_summoner = ?", [user_id])

    if (userCheck.length === 0) {
      connection.release()
      return res.redirect("/admin?error=user-not-found")
    }

    // Verificar si el username, email o id_summoner ya existen (excepto para el usuario actual)
    const [existingUsers] = await connection.execute(
      "SELECT username, email, id_summoner FROM user WHERE (username = ? OR email = ? OR id_summoner = ?) AND id_summoner != ?",
      [username, email, id_summoner, user_id],
    )

    if (existingUsers.length > 0) {
      connection.release()
      return res.redirect("/admin?error=username-email-or-id-exists")
    }

    // Preparar la consulta de actualización
    let updateQuery = `UPDATE user SET id_summoner = ?, username = ?, email = ?, summoner = ?, creditos = ?`
    const updateParams = [id_summoner, username, email, summoner, Number.parseInt(creditos)]

    // Si se proporcionó una nueva contraseña, incluirla en la actualización
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10)
      updateQuery += `, password = ?`
      updateParams.push(hashedPassword)
    }

    updateQuery += ` WHERE id_summoner = ?`
    updateParams.push(user_id)

    // Actualizar el usuario
    const [result] = await connection.execute(updateQuery, updateParams)

    connection.release()

    if (result.affectedRows > 0) {
      return res.redirect("/admin?message=user-updated")
    } else {
      return res.redirect("/admin?error=failed-to-update-user")
    }
  } catch (err) {
    console.error("Error al actualizar usuario:", err)
    return res.redirect("/admin?error=server-error")
  }
})

// Ruta para ver disputas
router.get("/admin/disputes", verificarSesion, verificarAdmin, async (req, res) => {
  try {
    const connection = await global.poolPromise.getConnection()

    // Obtener partidas en disputa
    const [disputes] = await connection.execute(`
      SELECT g.*, 
             ub.username as blue_username, 
             ur.username as red_username,
             ub.id_summoner as blue_id,
             ur.id_summoner as red_id
      FROM game g 
      JOIN user ub ON g.id_summoner_blue = ub.id_summoner 
      JOIN user ur ON g.id_summoner_red = ur.id_summoner 
      WHERE g.dispute = true AND g.winner IS NULL
      ORDER BY g.created_at DESC
    `)

    connection.release()

    res.render("admin-disputes", {
      title: "Gestión de Disputas",
      username: req.username,
      disputes: disputes,
      message: req.query.message,
      error: req.query.error,
    })
  } catch (err) {
    console.error("Error al cargar disputas:", err)
    res.redirect("/admin?error=server-error")
  }
})

// Ruta para resolver una disputa
router.post("/admin/resolve-dispute", verificarSesion, verificarAdmin, async (req, res) => {
  try {
    const { match_id, resolution, winner_id } = req.body

    const connection = await global.poolPromise.getConnection()

    // Obtener información de la partida
    const [matchRows] = await connection.execute("SELECT * FROM game WHERE id_game = ? AND dispute = true", [match_id])

    if (matchRows.length === 0) {
      connection.release()
      return res.redirect("/admin/disputes?error=match-not-found")
    }

    const match = matchRows[0]

    if (resolution === "declare_winner" && winner_id) {
      // Asignar ganador y transferir créditos
      await connection.execute("UPDATE game SET winner = ?, dispute = false WHERE id_game = ?", [winner_id, match_id])

      const totalCredits = match.creditos * 2
      await connection.execute("UPDATE user SET creditos = creditos + ? WHERE id_summoner = ?", [
        totalCredits,
        winner_id,
      ])

      // Marcar créditos como transferidos
      await connection.execute("UPDATE game SET credits_transferred = true WHERE id_game = ?", [match_id])

      // Notificar a ambos jugadores
      await createNotification(
        match.id_summoner_blue,
        "dispute_resolved",
        `La disputa de tu partida ha sido resuelta por un administrador.`,
        match_id,
      )

      await createNotification(
        match.id_summoner_red,
        "dispute_resolved",
        `La disputa de tu partida ha sido resuelta por un administrador.`,
        match_id,
      )

      if (winner_id === match.id_summoner_blue || winner_id === match.id_summoner_red) {
        await createNotification(
          winner_id,
          "match_won",
          `¡Has ganado la partida disputada! Se han añadido ${totalCredits} créditos a tu cuenta.`,
          match_id,
        )
      }
    } else if (resolution === "no_winner") {
      // Devolver créditos a ambos jugadores
      await connection.execute("UPDATE game SET dispute = false WHERE id_game = ?", [match_id])

      await connection.execute("UPDATE user SET creditos = creditos + ? WHERE id_summoner = ?", [
        match.creditos,
        match.id_summoner_blue,
      ])

      await connection.execute("UPDATE user SET creditos = creditos + ? WHERE id_summoner = ?", [
        match.creditos,
        match.id_summoner_red,
      ])

      // Notificar a ambos jugadores
      await createNotification(
        match.id_summoner_blue,
        "dispute_resolved",
        `La disputa de tu partida ha sido resuelta. Se han devuelto tus créditos.`,
        match_id,
      )

      await createNotification(
        match.id_summoner_red,
        "dispute_resolved",
        `La disputa de tu partida ha sido resuelta. Se han devuelto tus créditos.`,
        match_id,
      )
    }

    connection.release()
    return res.redirect("/admin/disputes?message=dispute-resolved")
  } catch (err) {
    console.error("Error al resolver disputa:", err)
    return res.redirect("/admin/disputes?error=server-error")
  }
})

// Ruta para eliminar un usuario
router.get("/delete-user/:id_summoner", verificarSesion, verificarAdmin, async (req, res) => {
  let connection;

  try {
    const idSummoner = req.params.id_summoner;
    console.log("Intentando eliminar usuario con id_summoner:", idSummoner);

    connection = await global.poolPromise.getConnection();
    await connection.beginTransaction();

    const [userCheck] = await connection.execute(
      "SELECT id_user, username, id_summoner FROM user WHERE id_summoner = ?", 
      [idSummoner]
    );

    if (userCheck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.redirect("/admin?error=user-not-found");
    }

    const user = userCheck[0];
    const userId = user.id_user;

    if (user.username === "admin") {
      await connection.rollback();
      connection.release();
      return res.redirect("/admin?error=cannot-delete-admin");
    }

    // ... aquí continúa todo el flujo de eliminación ...

    const [userResult] = await connection.execute("DELETE FROM user WHERE id_user = ?", [userId]);

    await connection.commit();
    connection.release();

    return userResult.affectedRows > 0
      ? res.redirect("/admin?message=user-deleted")
      : res.redirect("/admin?error=failed-to-delete-user");

  } catch (err) {
    console.error("❌ Error al eliminar usuario:", err);
    if (connection) {
      try {
        await connection.rollback();
        connection.release();
      } catch (rollbackErr) {
        console.error("Error en rollback:", rollbackErr);
      }
    }
    return res.redirect("/admin?error=server-error");
  }
});



router.get("/debug-user/:id", verificarSesion, verificarAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const connection = await global.poolPromise.getConnection();

    // Verificar usuario
    const [user] = await connection.execute("SELECT * FROM user WHERE id_user = ?", [userId]);
    console.log("Usuario:", user);

    if (user.length > 0) {
      const idSummoner = user[0].id_summoner;
      
      // Verificar dependencias
      const [notifications] = await connection.execute("SELECT COUNT(*) as count FROM notification WHERE id_summoner = ?", [idSummoner]);
      const [invitations] = await connection.execute("SELECT COUNT(*) as count FROM team_invitation WHERE id_summoner = ? OR invited_by = ?", [idSummoner, idSummoner]);
      const [members] = await connection.execute("SELECT COUNT(*) as count FROM team_member WHERE id_summoner = ?", [idSummoner]);
      const [teams] = await connection.execute("SELECT COUNT(*) as count FROM team WHERE created_by = ?", [idSummoner]);
      const [games] = await connection.execute("SELECT COUNT(*) as count FROM game WHERE id_summoner_blue = ? OR id_summoner_red = ?", [idSummoner, idSummoner]);
      
      const dependencies = {
        notifications: notifications[0].count,
        invitations: invitations[0].count,
        members: members[0].count,
        teams: teams[0].count,
        games: games[0].count
      };
      
      console.log("Dependencias:", dependencies);
      
      connection.release();
      return res.json({ user: user[0], dependencies });
    }
    
    connection.release();
    return res.json({ error: "Usuario no encontrado" });
    
  } catch (err) {
    console.error("Error en debug:", err);
    return res.json({ error: err.message });
  }
});

// Modificar la ruta de matchfinder para obtener y mostrar las partidas disponibles
router.get("/matchfinder", async (req, res) => {
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

  try {
    // Obtener las partidas disponibles de la base de datos
    const connection = await global.poolPromise.getConnection()

    // Obtener el id_summoner del usuario actual
    const [userRows] = await connection.execute("SELECT id_summoner, creditos FROM user WHERE username = ?", [
      sesiones[token].username,
    ])
    const currentUserSummonerId = userRows[0].id_summoner
    const userCreditos = userRows[0].creditos

    // Obtener notificaciones no leídas
    const [notifications] = await connection.execute(
      `SELECT * FROM notification 
       WHERE id_summoner = ? 
       AND is_read = FALSE
       ORDER BY created_at DESC`,
      [currentUserSummonerId],
    )

    // Obtener partidas donde id_summoner_red es NULL (partidas sin oponente)
    // y donde id_summoner_blue no es el del usuario actual (no mostrar sus propias partidas)
    // y donde el usuario tiene suficientes créditos para la entry fee
    const [matches] = await connection.execute(
      `
      SELECT g.*, u.username as creator_username 
      FROM game g 
      JOIN user u ON g.id_summoner_blue = u.id_summoner 
      WHERE g.id_summoner_red IS NULL
      AND g.id_summoner_blue != ?
      AND g.creditos <= ?
      ORDER BY g.created_at DESC
    `,
      [currentUserSummonerId, userCreditos],
    )

    // Obtener partidas activas del usuario (donde es blue o red)
    const [activeMatches] = await connection.execute(
      `
      SELECT g.*, 
             ub.username as blue_username, 
             ur.username as red_username
      FROM game g 
      JOIN user ub ON g.id_summoner_blue = ub.id_summoner 
      LEFT JOIN user ur ON g.id_summoner_red = ur.id_summoner 
      WHERE (g.id_summoner_blue = ? OR g.id_summoner_red = ?)
      AND g.id_summoner_red IS NOT NULL
      AND g.winner IS NULL
      ORDER BY g.created_at DESC
    `,
      [currentUserSummonerId, currentUserSummonerId],
    )

    // Obtener partidas completadas del usuario (donde es blue o red y hay un ganador)
    const [completedMatches] = await connection.execute(
      `
      SELECT g.*, 
             ub.username as blue_username, 
             ur.username as red_username
      FROM game g 
      JOIN user ub ON g.id_summoner_blue = ub.id_summoner 
      JOIN user ur ON g.id_summoner_red = ur.id_summoner 
      WHERE (g.id_summoner_blue = ? OR g.id_summoner_red = ?)
      AND g.winner IS NOT NULL
      ORDER BY g.created_at DESC
      LIMIT 5
    `,
      [currentUserSummonerId, currentUserSummonerId],
    )

    // Obtener torneos próximos
    const [tournaments] = await connection.execute(
      `
      SELECT * FROM tournament 
      WHERE start_date > NOW() 
      ORDER BY start_date ASC 
      LIMIT 2
    `,
    )

    connection.release()

    console.log(
      `Se encontraron ${matches.length} partidas disponibles, ${activeMatches.length} partidas activas y ${completedMatches.length} partidas completadas`,
    )

    // Renderizar la página con las partidas
    res.render("match_finder_inicio", {
      title: "Matchfinder",
      username: sesiones[token].username,
      matches: matches,
      activeMatches: activeMatches,
      completedMatches: completedMatches,
      tournaments: tournaments,
      userCreditos: userCreditos,
      notifications: notifications,
      notificationCount: notifications.length,
      message: req.query.message,
      error: req.query.error,
    })
  } catch (err) {
    console.error("Error al obtener partidas:", err)
    // En caso de error, renderizar la página sin partidas
    res.render("match_finder_inicio", {
      title: "Matchfinder",
      username: sesiones[token].username,
      matches: [],
      activeMatches: [],
      completedMatches: [],
      tournaments: [],
      userCreditos: 0,
      notifications: [],
      notificationCount: 0,
    })
  }
})

// Ruta para unirse a una partida
router.get("/join-match/:id", verificarSesion, async (req, res) => {
  const matchId = req.params.id
  const username = req.username

  try {
    // Obtener el id_summoner y créditos del usuario actual
    const connection = await global.poolPromise.getConnection()
    const [userRows] = await connection.execute("SELECT id_summoner, creditos FROM user WHERE username = ?", [username])

    if (userRows.length === 0) {
      connection.release()
      return res.redirect("/matchfinder?error=user-not-found")
    }

    const id_summoner_red = userRows[0].id_summoner
    const userCreditos = userRows[0].creditos

    // Verificar que el usuario no sea el creador de la partida y tenga suficientes créditos
    const [matchRows] = await connection.execute("SELECT id_summoner_blue, creditos FROM game WHERE id_game = ?", [
      matchId,
    ])

    if (matchRows.length === 0) {
      connection.release()
      return res.redirect("/matchfinder?error=match-not-found")
    }

    if (matchRows[0].id_summoner_blue === id_summoner_red) {
      connection.release()
      return res.redirect("/matchfinder?error=cannot-join-own-match")
    }

    const matchCreditos = matchRows[0].creditos
    if (userCreditos < matchCreditos) {
      connection.release()
      return res.redirect("/matchfinder?error=insufficient-credits")
    }

    // Restar los créditos al usuario que se une
    await connection.execute("UPDATE user SET creditos = creditos - ? WHERE id_summoner = ?", [
      matchCreditos,
      id_summoner_red,
    ])

    // Actualizar la partida con el id_summoner_red
    const [result] = await connection.execute(
      "UPDATE game SET id_summoner_red = ? WHERE id_game = ? AND id_summoner_red IS NULL",
      [id_summoner_red, matchId],
    )

    if (result.affectedRows > 0) {
      // Notificar al creador de la partida
      const [creatorInfo] = await connection.execute(
        "SELECT u.id_summoner FROM game g JOIN user u ON g.id_summoner_blue = u.id_summoner WHERE g.id_game = ?",
        [matchId],
      )

      if (creatorInfo.length > 0) {
        await createNotification(
          creatorInfo[0].id_summoner,
          "match_joined",
          `${username} se ha unido a tu partida.`,
          matchId,
        )
      }

      // Redirigir a la página de resultados
      connection.release()
      return res.redirect(`/match-result/${matchId}?joined=true`)
    } else {
      // La partida ya no está disponible, devolver los créditos
      await connection.execute("UPDATE user SET creditos = creditos + ? WHERE id_summoner = ?", [
        matchCreditos,
        id_summoner_red,
      ])
      connection.release()
      return res.redirect("/matchfinder?error=match-unavailable")
    }
  } catch (err) {
    console.error("Error al unirse a la partida:", err)
    return res.redirect("/matchfinder?error=server-error")
  }
})

// Ruta para mostrar la página de resultados de una partida
router.get("/match-result/:id", verificarSesion, async (req, res) => {
  const matchId = req.params.id
  const username = req.username

  try {
    const connection = await global.poolPromise.getConnection()

    // Obtener información de la partida
    const [matchRows] = await connection.execute(
      `
      SELECT g.*, 
             ub.username as blue_username, ub.id_summoner as blue_summoner_id,
             ur.username as red_username, ur.id_summoner as red_summoner_id,
             ub.reputation as blue_reputation, ur.reputation as red_reputation
      FROM game g 
      JOIN user ub ON g.id_summoner_blue = ub.id_summoner 
      LEFT JOIN user ur ON g.id_summoner_red = ur.id_summoner 
      WHERE g.id_game = ?
    `,
      [matchId],
    )

    if (matchRows.length === 0) {
      connection.release()
      return res.redirect("/matchfinder?error=match-not-found")
    }

    const match = matchRows[0]

    // Verificar que el usuario sea parte de la partida
    const isBluePlayer = match.blue_username === username
    const isRedPlayer = match.red_username === username

    if (!isBluePlayer && !isRedPlayer) {
      connection.release()
      return res.redirect("/matchfinder?error=not-in-match")
    }

    // Obtener información sobre si el usuario ya ha calificado a su oponente
    const hasRatedOpponent = isBluePlayer ? match.blue_rated_red : isRedPlayer ? match.red_rated_blue : false

    // Determinar si el usuario ha ganado o perdido
    let userWon = null
    let creditsWon = 0

    if (match.winner) {
      if (isBluePlayer) {
        userWon = match.winner === match.blue_summoner_id
      } else {
        userWon = match.winner === match.red_summoner_id
      }

      if (userWon) {
        creditsWon = match.creditos * 2
      }
    }

    // Obtener notificaciones no leídas
    const [userInfo] = await connection.execute("SELECT id_summoner FROM user WHERE username = ?", [username])
    const [notifications] = await connection.execute(
      `SELECT * FROM notification 
       WHERE id_summoner = ? 
       AND is_read = FALSE
       ORDER BY created_at DESC`,
      [userInfo[0].id_summoner],
    )

    connection.release()

    // Renderizar la página de resultados
    res.render("match_result", {
      title: "Match Result",
      username: username,
      match: match,
      isBluePlayer: isBluePlayer,
      isRedPlayer: isRedPlayer,
      resultSubmitted: match.reported_by_blue && match.reported_by_red,
      hasRatedOpponent: hasRatedOpponent,
      userWon: userWon,
      creditsWon: creditsWon,
      notifications: notifications,
      notificationCount: notifications.length,
      message: req.query.message,
      error: req.query.error,
      joined: req.query.joined === "true",
    })
  } catch (err) {
    console.error("Error al obtener información de la partida:", err)
    return res.redirect("/matchfinder?error=server-error")
  }
})

// Ruta para enviar el resultado de una partida
router.post("/submit-result/:id", verificarSesion, upload.array("proof_images", 5), async (req, res) => {
  const matchId = req.params.id
  const username = req.username
  const { winner } = req.body
  const proofImages = req.files

  try {
    const connection = await global.poolPromise.getConnection()

    // Obtener información de la partida
    const [matchRows] = await connection.execute(
      `
      SELECT g.*, 
             ub.username as blue_username, ub.id_summoner as blue_summoner_id,
             ur.username as red_username, ur.id_summoner as red_summoner_id
      FROM game g 
      JOIN user ub ON g.id_summoner_blue = ub.id_summoner 
      LEFT JOIN user ur ON g.id_summoner_red = ur.id_summoner 
      WHERE g.id_game = ?
    `,
      [matchId],
    )

    if (matchRows.length === 0) {
      connection.release()
      return res.redirect("/matchfinder?error=match-not-found")
    }

    const match = matchRows[0]

    // Verificar que el usuario sea parte de la partida
    const isBluePlayer = match.blue_username === username
    const isRedPlayer = match.red_username === username

    if (!isBluePlayer && !isRedPlayer) {
      connection.release()
      return res.redirect("/matchfinder?error=not-in-match")
    }

    // Verificar si la partida ya tiene un ganador
    if (match.winner) {
      connection.release()
      return res.redirect(`/match-result/${matchId}?error=already-has-result`)
    }

    // Guardar el resultado reportado por el usuario
    const reportedBy = isBluePlayer ? "blue" : "red"
    const reportedWinner = winner

    // Si es el primer reporte, guardarlo
    if (!match.reported_by_blue && !match.reported_by_red) {
      // Guardar las rutas de las imágenes si se proporcionaron
      let proofImagePaths = []
      if (proofImages && proofImages.length > 0) {
        proofImagePaths = proofImages.map((file) => `/uploads/match-results/${file.filename}`)
      }

      // Actualizar la partida con el resultado reportado
      await connection.execute(
        `UPDATE game SET 
         reported_by_${reportedBy} = ?, 
         ${reportedBy}_reported_winner = ?,
         ${reportedBy}_proof_images = ?
         WHERE id_game = ?`,
        [true, reportedWinner, JSON.stringify(proofImagePaths), matchId],
      )

      // Notificar al otro jugador
      const opponentId = isBluePlayer ? match.red_summoner_id : match.blue_summoner_id
      await createNotification(
        opponentId,
        "match_result_reported",
        `${username} ha reportado un resultado para tu partida. Por favor, confirma el resultado.`,
        matchId,
      )

      connection.release()
      return res.redirect(`/match-result/${matchId}?message=result-submitted`)
    }
    // Si ya hay un reporte del otro jugador, verificar si coinciden
    else {
      const otherReportedBy = isBluePlayer ? "red" : "blue"
      const otherReportedWinner = match[`${otherReportedBy}_reported_winner`]

      // Si los reportes coinciden, establecer el ganador
      if (reportedWinner === otherReportedWinner) {
        await connection.execute(
          `UPDATE game SET 
           winner = ?,
           reported_by_${reportedBy} = true,
           ${reportedBy}_reported_winner = ?
           WHERE id_game = ?`,
          [reportedWinner, reportedWinner, matchId],
        )

        // Transferir los créditos al ganador si aún no se han transferido
        if (!match.credits_transferred) {
          // Obtener el monto de créditos de la partida
          const matchCredits = match.creditos
          const totalCredits = matchCredits * 2 // El doble de la entry fee

          // Actualizar los créditos del ganador
          await connection.execute("UPDATE user SET creditos = creditos + ? WHERE id_summoner = ?", [
            totalCredits,
            reportedWinner,
          ])

          // Marcar los créditos como transferidos
          await connection.execute("UPDATE game SET credits_transferred = true WHERE id_game = ?", [matchId])

          // Notificar al ganador
          const [winnerInfo] = await connection.execute("SELECT username FROM user WHERE id_summoner = ?", [
            reportedWinner,
          ])
          if (winnerInfo.length > 0) {
            await createNotification(
              reportedWinner,
              "match_won",
              `¡Has ganado la partida! Se han añadido ${totalCredits} créditos a tu cuenta.`,
              matchId,
            )
          }
        }

        connection.release()
        return res.redirect(`/match-result/${matchId}?message=result-confirmed`)
      }
      // Si no coinciden, guardar el reporte y las imágenes
      else {
        // Guardar las rutas de las imágenes si se proporcionaron
        let proofImagePaths = []
        if (proofImages && proofImages.length > 0) {
          proofImagePaths = proofImages.map((file) => `/uploads/match-results/${file.filename}`)
        }

        // Actualizar la partida con el resultado reportado
        await connection.execute(
          `UPDATE game SET 
           reported_by_${reportedBy} = ?, 
           ${reportedBy}_reported_winner = ?,
           ${reportedBy}_proof_images = ?,
           dispute = true
           WHERE id_game = ?`,
          [true, reportedWinner, JSON.stringify(proofImagePaths), matchId],
        )

        // Notificar a ambos jugadores sobre la disputa
        const blueId = match.blue_summoner_id
        const redId = match.red_summoner_id

        await createNotification(
          blueId,
          "match_dispute",
          `Hay una disputa en el resultado de tu partida. Los administradores revisarán las pruebas.`,
          matchId,
        )

        await createNotification(
          redId,
          "match_dispute",
          `Hay una disputa en el resultado de tu partida. Los administradores revisarán las pruebas.`,
          matchId,
        )

        connection.release()
        return res.redirect(`/match-result/${matchId}?message=result-disputed`)
      }
    }
  } catch (err) {
    console.error("Error al enviar resultado de la partida:", err)
    return res.redirect(`/match-result/${matchId}?error=server-error`)
  }
})

// Ruta para calificar la reputación del oponente
router.post("/rate-opponent/:id", verificarSesion, async (req, res) => {
  const matchId = req.params.id
  const username = req.username
  const { rating } = req.body

  // Convertir la calificación a un valor numérico
  let ratingValue = 0
  switch (rating) {
    case "very_positive":
      ratingValue = 2
      break
    case "positive":
      ratingValue = 1
      break
    case "neutral":
      ratingValue = 0
      break
    case "negative":
      ratingValue = -1
      break
    case "very_negative":
      ratingValue = -2
      break
    default:
      ratingValue = 0
  }

  try {
    const connection = await global.poolPromise.getConnection()

    // Obtener información de la partida
    const [matchRows] = await connection.execute(
      `
      SELECT g.*, 
             ub.username as blue_username, ub.id_summoner as blue_summoner_id,
             ur.username as red_username, ur.id_summoner as red_summoner_id
      FROM game g 
      JOIN user ub ON g.id_summoner_blue = ub.id_summoner 
      JOIN user ur ON g.id_summoner_red = ur.id_summoner 
      WHERE g.id_game = ?
    `,
      [matchId],
    )

    if (matchRows.length === 0) {
      connection.release()
      return res.redirect("/matchfinder?error=match-not-found")
    }

    const match = matchRows[0]

    // Verificar que el usuario sea parte de la partida
    const isBluePlayer = match.blue_username === username
    const isRedPlayer = match.red_username === username

    if (!isBluePlayer && !isRedPlayer) {
      connection.release()
      return res.redirect("/matchfinder?error=not-in-match")
    }

    // Verificar que la partida tenga un ganador
    if (!match.winner) {
      connection.release()
      return res.redirect(`/match-result/${matchId}?error=match-not-completed`)
    }

    // Verificar que el usuario no haya calificado ya al oponente
    if ((isBluePlayer && match.blue_rated_red) || (isRedPlayer && match.red_rated_blue)) {
      connection.release()
      return res.redirect(`/match-result/${matchId}?error=already-rated`)
    }

    // Actualizar la reputación del oponente
    const opponentId = isBluePlayer ? match.red_summoner_id : match.blue_summoner_id
    const opponentName = isBluePlayer ? match.red_username : match.blue_username

    await connection.execute("UPDATE user SET reputation = reputation + ? WHERE id_summoner = ?", [
      ratingValue,
      opponentId,
    ])

    // Marcar que el usuario ha calificado al oponente
    const ratedField = isBluePlayer ? "blue_rated_red" : "red_rated_blue"
    await connection.execute(`UPDATE game SET ${ratedField} = true WHERE id_game = ?`, [matchId])

    // Notificar al oponente sobre la calificación
    let ratingText = "neutral"
    if (ratingValue > 0) ratingText = ratingValue > 1 ? "muy positiva" : "positiva"
    if (ratingValue < 0) ratingText = ratingValue < -1 ? "muy negativa" : "negativa"

    await createNotification(
      opponentId,
      "reputation_rating",
      `${username} te ha dado una calificación ${ratingText} (${ratingValue > 0 ? "+" : ""}${ratingValue}).`,
      matchId,
    )

    connection.release()

    // Redirigir a la página de matchfinder en lugar de volver a la página de resultados
    return res.redirect(`/matchfinder?message=rating-submitted`)
  } catch (err) {
    console.error("Error al calificar al oponente:", err)
    return res.redirect(`/matchfinder?error=server-error`)
  }
})

// Ruta para la página de torneos
router.get("/tournament", verificarSesion, async (req, res) => {
  const username = req.username

  try {
    const connection = await global.poolPromise.getConnection()

    // Obtener los créditos del usuario
    const [userRows] = await connection.execute("SELECT id_summoner, creditos FROM user WHERE username = ?", [username])

    if (userRows.length === 0) {
      connection.release()
      return res.redirect("/login")
    }

    const userId = userRows[0].id_summoner
    const userCreditos = userRows[0].creditos

    // Obtener notificaciones no leídas
    const [notifications] = await connection.execute(
      `SELECT * FROM notification 
       WHERE id_summoner = ? 
       AND is_read = FALSE
       ORDER BY created_at DESC`,
      [userId],
    )

    // Obtener invitaciones pendientes
    const [invitations] = await connection.execute(
      `SELECT ti.*, t.name as team_name, t.tag as team_tag, u.username as inviter_username
       FROM team_invitation ti
       JOIN team t ON ti.id_team = t.id_team
       JOIN user u ON ti.invited_by = u.id_summoner
       WHERE ti.id_summoner = ? AND ti.status = 'pending'
       ORDER BY ti.invitation_date DESC`,
      [userId],
    )

    // Obtener los torneos disponibles
    const [tournaments] = await connection.execute(
      `SELECT * FROM tournament 
       WHERE start_date > NOW() 
       ORDER BY start_date ASC`,
    )

    // Obtener los equipos creados por el usuario
    const [userTeams] = await connection.execute(
      `SELECT t.*, COUNT(tm.id_team_member) as member_count
       FROM team t
       LEFT JOIN team_member tm ON t.id_team = tm.id_team
       WHERE t.created_by = ?
       GROUP BY t.id_team
       ORDER BY t.created_at DESC`,
      [userId],
    )

    // Obtener los equipos donde el usuario es miembro pero no creador
    const [memberTeams] = await connection.execute(
      `SELECT t.*, tm.role
       FROM team t
       JOIN team_member tm ON t.id_team = tm.id_team
       WHERE tm.id_summoner = ? AND t.created_by != ?
       ORDER BY tm.joined_at DESC`,
      [userId, userId],
    )

    connection.release()

    res.render("tournament", {
      title: "Tournaments",
      username: username,
      tournaments: tournaments,
      userTeams: userTeams,
      memberTeams: memberTeams,
      userCreditos: userCreditos,
      notifications: notifications,
      notificationCount: notifications.length,
      invitations: invitations,
      message: req.query.message,
      error: req.query.error,
    })
  } catch (err) {
    console.error("Error al cargar la página de torneos:", err)
    res.render("tournament", {
      title: "Tournaments",
      username: username,
      tournaments: [],
      userTeams: [],
      memberTeams: [],
      userCreditos: 0,
      notifications: [],
      notificationCount: 0,
      invitations: [],
      error: "Error al cargar los datos",
    })
  }
})

// Ruta para ver detalles de un torneo específico
router.get("/tournament/:id", verificarSesion, async (req, res) => {
  const tournamentId = req.params.id
  const username = req.username

  try {
    const connection = await global.poolPromise.getConnection()

    // Obtener información del usuario INCLUYENDO LOS CRÉDITOS
    const [userRows] = await connection.execute(
      "SELECT id_summoner, creditos FROM user WHERE username = ?", 
      [username]
    )
    const userId = userRows[0].id_summoner
    const userCreditos = userRows[0].creditos || 0 // Agregar los créditos

    // Obtener notificaciones no leídas
    const [notifications] = await connection.execute(
      `SELECT * FROM notification 
       WHERE id_summoner = ? 
       AND is_read = FALSE 
       ORDER BY created_at DESC`,
      [userId],
    )

    // Obtener información del torneo
    const [tournamentRows] = await connection.execute(
      `SELECT * FROM tournament WHERE id_tournament = ?`, 
      [tournamentId]
    )

    if (tournamentRows.length === 0) {
      connection.release()
      return res.redirect("/tournament?error=tournament-not-found")
    }

    const tournament = tournamentRows[0]

    // Obtener equipos participantes
    const [participants] = await connection.execute(
      `SELECT tt.*, t.name as team_name, t.tag as team_tag, t.logo_path
       FROM tournament_team tt
       JOIN team t ON tt.id_team = t.id_team
       WHERE tt.id_tournament = ?
       ORDER BY tt.registration_date ASC`,
      [tournamentId],
    )

    // Obtener los equipos del usuario
    const [userTeams] = await connection.execute(
      `SELECT t.*, tm.is_captain
       FROM team t
       JOIN team_member tm ON t.id_team = tm.id_team
       WHERE tm.id_summoner = (SELECT id_summoner FROM user WHERE username = ?)
       AND tm.is_captain = true`,
      [username],
    )

    // Verificar si alguno de los equipos del usuario ya está inscrito
    let userTeamRegistered = false
    let registeredTeamId = null

    if (userTeams.length > 0 && participants.length > 0) {
      for (const team of userTeams) {
        for (const participant of participants) {
          if (team.id_team === participant.id_team) {
            userTeamRegistered = true
            registeredTeamId = team.id_team
            break
          }
        }
        if (userTeamRegistered) break
      }
    }

    connection.release()

    res.render("tournament_detail", {
      title: tournament.name,
      username: username,
      userCreditos: userCreditos, // AGREGAR LOS CRÉDITOS AQUÍ
      tournament: tournament,
      participants: participants,
      userTeams: userTeams,
      userTeamRegistered: userTeamRegistered,
      registeredTeamId: registeredTeamId,
      notifications: notifications,
      notificationCount: notifications.length,
      message: req.query.message,
      error: req.query.error,
    })
  } catch (err) {
    console.error("Error al cargar detalles del torneo:", err)
    return res.redirect("/tournament?error=server-error")
  }
})

// Ruta para crear un nuevo equipo
router.post("/create-team", verificarSesion, uploadTeam.single("team_logo"), async (req, res) => {
  try {
    const { team_name, team_tag, team_description, captain_role } = req.body

    // Obtener el id_summoner del usuario
    const connection = await global.poolPromise.getConnection()
    const [userRows] = await connection.execute("SELECT id_summoner FROM user WHERE username = ?", [req.username])

    if (userRows.length === 0) {
      connection.release()
      return res.redirect("/tournament?error=user-not-found")
    }

    const userId = userRows[0].id_summoner

    // Verificar si el nombre o tag ya existen
    const [existingTeams] = await connection.execute("SELECT * FROM team WHERE name = ? OR tag = ?", [
      team_name,
      team_tag,
    ])

    if (existingTeams.length > 0) {
      connection.release()
      return res.redirect("/tournament?error=team-name-or-tag-exists")
    }

    // Obtener la ruta del logo si se subió
    let logoPath = null
    if (req.file) {
      logoPath = `/uploads/teams/${req.file.filename}`
    }

    // Insertar el equipo en la base de datos
    const [result] = await connection.execute(
      `INSERT INTO team (name, tag, logo_path, description, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [team_name, team_tag, logoPath, team_description, userId],
    )

    if (result.affectedRows === 0) {
      connection.release()
      return res.redirect("/tournament?error=failed-to-create-team")
    }

    const teamId = result.insertId

    // Determinar el rol del capitán (si no eligió uno, será "Capitán")
    const role = captain_role || "Capitán"

    // Añadir al creador como capitán del equipo con el rol seleccionado
    await connection.execute(
      `INSERT INTO team_member (id_team, id_summoner, role, is_captain)
       VALUES (?, ?, ?, ?)`,
      [teamId, userId, role, true],
    )

    connection.release()
    return res.redirect("/tournament?message=team-created")
  } catch (err) {
    console.error("Error al crear equipo:", err)
    return res.redirect("/tournament?error=server-error")
  }
})

// Añadir esta nueva ruta GET para crear equipos
router.get("/create-team", verificarSesion, async (req, res) => {
  const username = req.username

  try {
    const connection = await global.poolPromise.getConnection()

    // Obtener el id_summoner del usuario
    const [userRows] = await connection.execute("SELECT id_summoner FROM user WHERE username = ?", [username])

    if (userRows.length === 0) {
      connection.release()
      return res.redirect("/login")
    }

    const userId = userRows[0].id_summoner

    // Obtener notificaciones no leídas
    const [notifications] = await connection.execute(
      `SELECT * FROM notification 
       WHERE id_summoner = ? 
       AND is_read = FALSE
       ORDER BY created_at DESC`,
      [userId],
    )

    connection.release()

    res.render("create_team", {
      title: "Crear Equipo",
      username: username,
      notifications: notifications,
      notificationCount: notifications.length,
      error: null, // Asegurarnos de que error siempre esté definido
    })
  } catch (err) {
    console.error("Error al cargar la página de crear equipo:", err)
    res.render("create_team", {
      title: "Crear Equipo",
      username: username,
      notifications: [],
      notificationCount: 0,
      error: "Error al cargar la página",
    })
  }
})

// Ruta para ver detalles de un equipo
router.get("/team/:id", verificarSesion, async (req, res) => {
  const teamId = req.params.id
  const username = req.username

  try {
    const connection = await global.poolPromise.getConnection()

    // Obtener información del usuario
    const [userRows] = await connection.execute("SELECT id_summoner FROM user WHERE username = ?", [username])
    const userId = userRows[0].id_summoner

    // Obtener notificaciones no leídas
    const [notifications] = await connection.execute(
      `SELECT * FROM notification 
       WHERE id_summoner = ? AND is_read = FALSE
       ORDER BY created_at DESC`,
      [userId],
    )

    // Obtener información del equipo
    const [teamRows] = await connection.execute(
      `SELECT t.*, u.username as creator_username
       FROM team t
       JOIN user u ON t.created_by = u.id_summoner
       WHERE t.id_team = ?`,
      [teamId],
    )

    if (teamRows.length === 0) {
      connection.release()
      return res.redirect("/tournament?error=team-not-found")
    }

    const team = teamRows[0]

    // Obtener miembros del equipo
    const [members] = await connection.execute(
      `SELECT tm.*, u.username, u.reputation
       FROM team_member tm
       JOIN user u ON tm.id_summoner = u.id_summoner
       WHERE tm.id_team = ?
       ORDER BY tm.is_captain DESC, tm.joined_at ASC`,
      [teamId],
    )

    // Verificar si el usuario es miembro del equipo
    const [userMemberRows] = await connection.execute(
      `SELECT * FROM team_member tm
       JOIN user u ON tm.id_summoner = u.id_summoner
       WHERE tm.id_team = ? AND u.username = ?`,
      [teamId, username],
    )

    const isTeamMember = userMemberRows.length > 0
    const isTeamCaptain = isTeamMember && userMemberRows[0].is_captain

    // Obtener torneos en los que participa el equipo
    const [tournaments] = await connection.execute(
      `SELECT t.*, tt.registration_date
       FROM tournament t
       JOIN tournament_team tt ON t.id_tournament = tt.id_tournament
       WHERE tt.id_team = ?
       ORDER BY t.start_date ASC`,
      [teamId],
    )

    // Obtener invitaciones pendientes para este equipo (solo para el capitán)
    const [pendingInvitations] = await connection.execute(
      `SELECT ti.*, u.username as invited_username
       FROM team_invitation ti
       JOIN user u ON ti.id_summoner = u.id_summoner
       WHERE ti.id_team = ? AND ti.status = 'pending'
       ORDER BY ti.invitation_date DESC`,
      [teamId],
    )

    connection.release()

    res.render("team_detail", {
      title: team.name,
      username: username,
      team: team,
      members: members,
      tournaments: tournaments,
      isTeamMember: isTeamMember,
      isTeamCaptain: isTeamCaptain,
      pendingInvitations: pendingInvitations,
      notifications: notifications,
      notificationCount: notifications.length,
      message: req.query.message,
      error: req.query.error,
    })
  } catch (err) {
    console.error("Error al cargar detalles del equipo:", err)
    return res.redirect("/tournament?error=server-error")
  }
})

// Añadir la ruta para editar un equipo
router.post("/edit-team", verificarSesion, uploadTeam.single("team_logo"), async (req, res) => {
  try {
    const { team_id, team_name, team_tag, team_description } = req.body
    const username = req.username

    console.log("Editando equipo:", team_id, team_name, team_tag, team_description)
    console.log("Archivo:", req.file)

    const connection = await global.poolPromise.getConnection()

    // Verificar si el usuario es capitán del equipo
    const [captainRows] = await connection.execute(
      `SELECT tm.* FROM team_member tm
       JOIN user u ON tm.id_summoner = u.id_summoner
       WHERE tm.id_team = ? AND u.username = ? AND tm.is_captain = true`,
      [team_id, username],
    )

    if (captainRows.length === 0) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=not-team-captain`)
    }

    // Verificar si el nombre o tag ya existen (excepto para el equipo actual)
    const [existingTeams] = await connection.execute(
      "SELECT * FROM team WHERE (name = ? OR tag = ?) AND id_team != ?",
      [team_name, team_tag, team_id],
    )

    if (existingTeams.length > 0) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=team-name-or-tag-exists`)
    }

    // Preparar la consulta SQL para actualizar el equipo
    let updateQuery = `UPDATE team SET name = ?, tag = ?, description = ?`
    const updateParams = [team_name, team_tag, team_description]

    // Si se subió un nuevo logo, añadirlo a la actualización
    if (req.file) {
      const logoPath = `/uploads/teams/${req.file.filename}`
      updateQuery += `, logo_path = ?`
      updateParams.push(logoPath)
    }

    // Añadir la condición WHERE
    updateQuery += ` WHERE id_team = ?`
    updateParams.push(team_id)

    console.log("Query:", updateQuery)
    console.log("Params:", updateParams)

    // Actualizar el equipo en la base de datos
    const [result] = await connection.execute(updateQuery, updateParams)

    connection.release()

    if (result.affectedRows > 0) {
      return res.redirect(`/team/${team_id}?message=team-updated`)
    } else {
      return res.redirect(`/team/${team_id}?error=failed-to-update-team`)
    }
  } catch (err) {
    console.error("Error al actualizar equipo:", err)
    return res.redirect(`/team/${req.body.team_id}?error=server-error`)
  }
})

// Ruta para inscribir un equipo en un torneo
router.post("/join-tournament", verificarSesion, async (req, res) => {
  try {
    const { tournament_id, team_id } = req.body

    const connection = await global.poolPromise.getConnection()

    // Verificar si el usuario es capitán del equipo
    const [captainRows] = await connection.execute(
      `SELECT tm.* FROM team_member tm
       JOIN user u ON tm.id_summoner = u.id_summoner
       WHERE tm.id_team = ? AND u.username = ? AND tm.is_captain = true`,
      [team_id, req.username],
    )

    if (captainRows.length === 0) {
      connection.release()
      return res.redirect(`/tournament?error=not-team-captain`)
    }

    // Verificar si el equipo ya está inscrito en el torneo
    const [registrationRows] = await connection.execute(
      `SELECT * FROM tournament_team
       WHERE id_tournament = ? AND id_team = ?`,
      [tournament_id, team_id],
    )

    if (registrationRows.length > 0) {
      connection.release()
      return res.redirect(`/tournament?error=already-registered`)
    }

    // Obtener información del torneo
    const [tournamentRows] = await connection.execute(`SELECT * FROM tournament WHERE id_tournament = ?`, [
      tournament_id,
    ])

    if (tournamentRows.length === 0) {
      connection.release()
      return res.redirect(`/tournament?error=tournament-not-found`)
    }

    const tournament = tournamentRows[0]

    // Verificar si hay espacio en el torneo
    if (tournament.current_participants >= tournament.max_participants) {
      connection.release()
      return res.redirect(`/tournament?error=tournament-full`)
    }

    // Verificar si el usuario tiene suficientes créditos
    const [userRows] = await connection.execute(`SELECT creditos FROM user WHERE username = ?`, [req.username])

    if (userRows[0].creditos < tournament.entry_fee) {
      connection.release()
      return res.redirect(`/tournament?error=insufficient-credits`)
    }

    // Restar los créditos al usuario
    await connection.execute(`UPDATE user SET creditos = creditos - ? WHERE username = ?`, [
      tournament.entry_fee,
      req.username,
    ])

    // Inscribir al equipo en el torneo
    await connection.execute(
      `INSERT INTO tournament_team (id_tournament, id_team)
       VALUES (?, ?)`,
      [tournament_id, team_id],
    )

    // Actualizar el contador de participantes
    await connection.execute(
      `UPDATE tournament SET current_participants = current_participants + 1
       WHERE id_tournament = ?`,
      [tournament_id],
    )

    // Obtener información del equipo
    const [teamInfo] = await connection.execute("SELECT name FROM team WHERE id_team = ?", [team_id])

    // Notificar a todos los miembros del equipo
    const [teamMembers] = await connection.execute(
      "SELECT u.id_summoner FROM team_member tm JOIN user u ON tm.id_summoner = u.id_summoner WHERE tm.id_team = ?",
      [team_id],
    )

    for (const member of teamMembers) {
      if (member.id_summoner !== userRows[0].id_summoner) {
        // No notificar al capitán que inscribió al equipo
        await createNotification(
          member.id_summoner,
          "tournament_joined",
          `Tu equipo ${teamInfo[0].name} ha sido inscrito en el torneo ${tournament.name}.`,
          tournament_id,
        )
      }
    }

    connection.release()
    return res.redirect(`/tournament?message=tournament-joined`)
  } catch (err) {
    console.error("Error al inscribir equipo en torneo:", err)
    return res.redirect(`/tournament?error=server-error`)
  }
})

// Ruta para invitar a un jugador a un equipo (modificada para usar invitaciones)
router.post("/invite-player", verificarSesion, async (req, res) => {
  try {
    const { team_id, player_username, player_role } = req.body
    const username = req.username

    const connection = await global.poolPromise.getConnection()

    // Verificar si el usuario es capitán del equipo
    const [captainRows] = await connection.execute(
      `SELECT tm.* FROM team_member tm
       JOIN user u ON tm.id_summoner = u.id_summoner
       WHERE tm.id_team = ? AND u.username = ? AND tm.is_captain = true`,
      [team_id, username],
    )

    if (captainRows.length === 0) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=not-team-captain`)
    }

    // Verificar si el jugador existe
    const [playerRows] = await connection.execute(`SELECT id_summoner FROM user WHERE username = ?`, [player_username])

    if (playerRows.length === 0) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=player-not-found`)
    }

    const player_id = playerRows[0].id_summoner

    // Verificar si el jugador ya es miembro del equipo
    const [memberRows] = await connection.execute(`SELECT * FROM team_member WHERE id_team = ? AND id_summoner = ?`, [
      team_id,
      player_id,
    ])

    if (memberRows.length > 0) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=player-already-in-team`)
    }

    // Verificar si ya existe un jugador con ese rol en el equipo
    const [roleRows] = await connection.execute(`SELECT * FROM team_member WHERE id_team = ? AND role = ?`, [
      team_id,
      player_role,
    ])

    if (roleRows.length > 0) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=role-already-taken`)
    }

    // Verificar si ya existe una invitación pendiente para este jugador en este equipo
    const [invitationRows] = await connection.execute(
      `SELECT * FROM team_invitation 
       WHERE id_team = ? AND id_summoner = ? AND status = 'pending'`,
      [team_id, player_id],
    )

    if (invitationRows.length > 0) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=invitation-already-sent`)
    }

    // Obtener el id_summoner del usuario que invita
    const [inviterRows] = await connection.execute(`SELECT id_summoner FROM user WHERE username = ?`, [username])
    const inviter_id = inviterRows[0].id_summoner

    // Obtener información del equipo para la notificación
    const [teamInfo] = await connection.execute(`SELECT name FROM team WHERE id_team = ?`, [team_id])

    // Crear la invitación
    await connection.execute(
      `INSERT INTO team_invitation (id_team, id_summoner, role, invited_by)
       VALUES (?, ?, ?, ?)`,
      [team_id, player_id, player_role, inviter_id],
    )

    // Crear notificación para el jugador invitado
    await createNotification(
      player_id,
      "team_invitation",
      `Has sido invitado a unirte al equipo ${teamInfo[0].name} como ${player_role}.`,
      team_id,
    )

    connection.release()
    return res.redirect(`/team/${team_id}?message=invitation-sent`)
  } catch (err) {
    console.error("Error al invitar jugador:", err)
    return res.redirect(`/team/${req.body.team_id}?error=server-error`)
  }
})

// Ruta para aceptar una invitación a un equipo
router.post("/accept-invitation", verificarSesion, async (req, res) => {
  try {
    const { invitation_id } = req.body
    const username = req.username

    const connection = await global.poolPromise.getConnection()

    // Verificar si la invitación existe y pertenece al usuario
    const [invitationRows] = await connection.execute(
      `SELECT ti.*, t.name as team_name, u.username as inviter_username
       FROM team_invitation ti
       JOIN team t ON ti.id_team = t.id_team
       JOIN user u ON ti.invited_by = u.id_summoner
       WHERE ti.id_invitation = ? 
       AND ti.id_summoner = (SELECT id_summoner FROM user WHERE username = ?)
       AND ti.status = 'pending'`,
      [invitation_id, username],
    )

    if (invitationRows.length === 0) {
      connection.release()
      return res.redirect(`/tournament?error=invitation-not-found`)
    }

    const invitation = invitationRows[0]

    // Verificar si el rol ya está ocupado (podría haber cambiado desde que se envió la invitación)
    const [roleRows] = await connection.execute(`SELECT * FROM team_member WHERE id_team = ? AND role = ?`, [
      invitation.id_team,
      invitation.role,
    ])

    if (roleRows.length > 0) {
      // Actualizar el estado de la invitación a rechazada
      await connection.execute(`UPDATE team_invitation SET status = 'rejected' WHERE id_invitation = ?`, [
        invitation_id,
      ])
      connection.release()
      return res.redirect(`/tournament?error=role-already-taken`)
    }

    // Añadir al jugador al equipo
    await connection.execute(
      `INSERT INTO team_member (id_team, id_summoner, role, is_captain)
       VALUES (?, ?, ?, false)`,
      [invitation.id_team, invitation.id_summoner, invitation.role],
    )

    // Actualizar el estado de la invitación a aceptada
    await connection.execute(`UPDATE team_invitation SET status = 'accepted' WHERE id_invitation = ?`, [invitation_id])

    // Notificar al capitán que la invitación fue aceptada
    await createNotification(
      invitation.invited_by,
      "invitation_accepted",
      `${username} ha aceptado tu invitación para unirse al equipo ${invitation.team_name} como ${invitation.role}.`,
      invitation.id_team,
    )

    connection.release()
    return res.redirect(`/tournament?message=invitation-accepted`)
  } catch (err) {
    console.error("Error al aceptar invitación:", err)
    return res.redirect(`/tournament?error=server-error`)
  }
})

// Ruta para rechazar una invitación a un equipo
router.post("/reject-invitation", verificarSesion, async (req, res) => {
  try {
    const { invitation_id } = req.body
    const username = req.username

    const connection = await global.poolPromise.getConnection()

    // Verificar si la invitación existe y pertenece al usuario
    const [invitationRows] = await connection.execute(
      `SELECT ti.*, t.name as team_name, u.username as inviter_username
       FROM team_invitation ti
       JOIN team t ON ti.id_team = t.id_team
       JOIN user u ON ti.invited_by = u.id_summoner
       WHERE ti.id_invitation = ? 
       AND ti.id_summoner = (SELECT id_summoner FROM user WHERE username = ?)
       AND ti.status = 'pending'`,
      [invitation_id, username],
    )

    if (invitationRows.length === 0) {
      connection.release()
      return res.redirect(`/tournament?error=invitation-not-found`)
    }

    const invitation = invitationRows[0]

    // Actualizar el estado de la invitación a rechazada
    await connection.execute(`UPDATE team_invitation SET status = 'rejected' WHERE id_invitation = ?`, [invitation_id])

    // Notificar al capitán que la invitación fue rechazada
    await createNotification(
      invitation.invited_by,
      "invitation_rejected",
      `${username} ha rechazado tu invitación para unirte al equipo ${invitation.team_name}.`,
      invitation.id_team,
    )

    connection.release()
    return res.redirect(`/tournament?message=invitation-rejected`)
  } catch (err) {
    console.error("Error al rechazar invitación:", err)
    return res.redirect(`/tournament?error=server-error`)
  }
})

// Ruta para cancelar una invitación (por parte del capitán)
router.post("/cancel-invitation", verificarSesion, async (req, res) => {
  try {
    const { invitation_id, team_id } = req.body
    const username = req.username

    const connection = await global.poolPromise.getConnection()

    // Verificar si el usuario es capitán del equipo
    const [captainRows] = await connection.execute(
      `SELECT tm.* FROM team_member tm
       JOIN user u ON tm.id_summoner = u.id_summoner
       WHERE tm.id_team = ? AND u.username = ? AND tm.is_captain = true`,
      [team_id, username],
    )

    if (captainRows.length === 0) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=not-team-captain`)
    }

    // Verificar si la invitación existe
    const [invitationRows] = await connection.execute(
      `SELECT ti.*, u.username as invited_username
       FROM team_invitation ti
       JOIN user u ON ti.id_summoner = u.id_summoner
       WHERE ti.id_invitation = ? AND ti.id_team = ? AND ti.status = 'pending'`,
      [invitation_id, team_id],
    )

    if (invitationRows.length === 0) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=invitation-not-found`)
    }

    const invitation = invitationRows[0]

    // Actualizar el estado de la invitación a rechazada
    await connection.execute(`UPDATE team_invitation SET status = 'rejected' WHERE id_invitation = ?`, [invitation_id])

    // Notificar al jugador que la invitación fue cancelada
    await createNotification(
      invitation.id_summoner,
      "invitation_canceled",
      `Tu invitación para unirte al equipo ha sido cancelada por el capitán.`,
      team_id,
    )

    connection.release()
    return res.redirect(`/team/${team_id}?message=invitation-canceled`)
  } catch (err) {
    console.error("Error al cancelar invitación:", err)
    return res.redirect(`/team/${req.body.team_id}?error=server-error`)
  }
})

// Ruta para eliminar a un miembro del equipo
router.post("/remove-team-member", verificarSesion, async (req, res) => {
  try {
    const { team_id, member_id } = req.body
    const username = req.username

    const connection = await global.poolPromise.getConnection()

    // Verificar si el usuario es capitán del equipo
    const [captainRows] = await connection.execute(
      `SELECT tm.* FROM team_member tm
       JOIN user u ON tm.id_summoner = u.id_summoner
       WHERE tm.id_team = ? AND u.username = ? AND tm.is_captain = true`,
      [team_id, username],
    )

    if (captainRows.length === 0) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=not-team-captain`)
    }

    // Verificar que no se esté intentando eliminar al capitán
    const [memberRows] = await connection.execute(
      `SELECT is_captain, u.username FROM team_member tm
       JOIN user u ON tm.id_summoner = u.id_summoner
       WHERE tm.id_team = ? AND tm.id_summoner = ?`,
      [team_id, member_id],
    )

    if (memberRows.length === 0) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=member-not-found`)
    }

    if (memberRows[0].is_captain) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=cannot-remove-captain`)
    }

    // Eliminar al miembro del equipo
    await connection.execute(`DELETE FROM team_member WHERE id_team = ? AND id_summoner = ?`, [team_id, member_id])

    // Notificar al miembro que ha sido eliminado
    await createNotification(member_id, "removed_from_team", `Has sido eliminado del equipo por el capitán.`, team_id)

    connection.release()
    return res.redirect(`/team/${team_id}?message=member-removed`)
  } catch (err) {
    console.error("Error al eliminar miembro del equipo:", err)
    return res.redirect(`/team/${req.body.team_id}?error=server-error`)
  }
})

// Ruta para abandonar un equipo
router.post("/leave-team", verificarSesion, async (req, res) => {
  try {
    const { team_id } = req.body
    const username = req.username

    const connection = await global.poolPromise.getConnection()

    // Obtener el id_summoner del usuario
    const [userRows] = await connection.execute(`SELECT id_summoner FROM user WHERE username = ?`, [username])

    if (userRows.length === 0) {
      connection.release()
      return res.redirect(`/tournament?error=user-not-found`)
    }

    const user_id = userRows[0].id_summoner

    // Verificar si el usuario es capitán
    const [memberRows] = await connection.execute(
      `SELECT is_captain FROM team_member WHERE id_team = ? AND id_summoner = ?`,
      [team_id, user_id],
    )

    if (memberRows.length === 0) {
      connection.release()
      return res.redirect(`/tournament?error=not-team-member`)
    }

    // Si es capitán, no puede abandonar el equipo (debe eliminarlo)
    if (memberRows[0].is_captain) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=captain-cannot-leave`)
    }

    // Obtener información del equipo para la notificación
    const [teamInfo] = await connection.execute(
      `SELECT t.name, u.id_summoner as captain_id
       FROM team t
       JOIN team_member tm ON t.id_team = tm.id_team
       JOIN user u ON tm.id_summoner = u.id_summoner
       WHERE t.id_team = ? AND tm.is_captain = true`,
      [team_id],
    )

    // Eliminar al usuario del equipo
    await connection.execute(`DELETE FROM team_member WHERE id_team = ? AND id_summoner = ?`, [team_id, user_id])

    // Notificar al capitán que un miembro ha abandonado el equipo
    if (teamInfo.length > 0) {
      await createNotification(
        teamInfo[0].captain_id,
        "member_left_team",
        `${username} ha abandonado tu equipo ${teamInfo[0].name}.`,
        team_id,
      )
    }

    connection.release()
    return res.redirect(`/tournament?message=left-team`)
  } catch (err) {
    console.error("Error al abandonar equipo:", err)
    return res.redirect(`/tournament?error=server-error`)
  }
})

// Ruta para eliminar un equipo
router.post("/delete-team", verificarSesion, async (req, res) => {
  try {
    const { team_id } = req.body
    const username = req.username

    const connection = await global.poolPromise.getConnection()

    // Verificar si el usuario es capitán del equipo
    const [captainRows] = await connection.execute(
      `SELECT tm.* FROM team_member tm
       JOIN user u ON tm.id_summoner = u.id_summoner
       WHERE tm.id_team = ? AND u.username = ? AND tm.is_captain = true`,
      [team_id, username],
    )

    if (captainRows.length === 0) {
      connection.release()
      return res.redirect(`/tournament?error=not-team-captain`)
    }

    // Verificar si el equipo está inscrito en algún torneo
    const [tournamentRows] = await connection.execute(`SELECT * FROM tournament_team WHERE id_team = ?`, [team_id])

    if (tournamentRows.length > 0) {
      connection.release()
      return res.redirect(`/team/${team_id}?error=team-in-tournament`)
    }

    // Obtener información del equipo y sus miembros para notificaciones
    const [teamInfo] = await connection.execute(`SELECT name FROM team WHERE id_team = ?`, [team_id])
    const [teamMembers] = await connection.execute(
      `SELECT u.id_summoner, u.username 
       FROM team_member tm 
       JOIN user u ON tm.id_summoner = u.id_summoner 
       WHERE tm.id_team = ? AND tm.is_captain = false`,
      [team_id],
    )

    // Eliminar todas las invitaciones pendientes
    await connection.execute(`DELETE FROM team_invitation WHERE id_team = ?`, [team_id])

    // Eliminar todos los miembros del equipo
    await connection.execute(`DELETE FROM team_member WHERE id_team = ?`, [team_id])

    // Eliminar el equipo
    await connection.execute(`DELETE FROM team WHERE id_team = ?`, [team_id])

    // Notificar a todos los miembros que el equipo ha sido eliminado
    for (const member of teamMembers) {
      await createNotification(
        member.id_summoner,
        "team_deleted",
        `El equipo ${teamInfo[0].name} ha sido eliminado por el capitán.`,
        null,
      )
    }

    connection.release()
    return res.redirect(`/tournament?message=team-deleted`)
  } catch (err) {
    console.error("Error al eliminar equipo:", err)
    return res.redirect(`/tournament?error=server-error`)
  }
})

// Ruta para ver notificaciones
router.get("/notifications", verificarSesion, async (req, res) => {
  const username = req.username

  try {
    const connection = await global.poolPromise.getConnection()

    // Obtener el id_summoner del usuario
    const [userRows] = await connection.execute(`SELECT id_summoner FROM user WHERE username = ?`, [username])

    if (userRows.length === 0) {
      connection.release()
      return res.redirect("/dashboard")
    }

    const userId = userRows[0].id_summoner

    // Obtener todas las notificaciones del usuario
    const [notifications] = await connection.execute(
      `SELECT n.*, 
   CASE 
     WHEN n.type = 'team_invitation' THEN (
       SELECT status FROM team_invitation 
       WHERE id_invitation = n.related_id
     )
     ELSE NULL 
   END as invitation_status
   FROM notification n
   WHERE n.id_summoner = ? 
   ORDER BY n.created_at DESC`,
      [userId],
    )

    // Marcar todas las notificaciones como leídas
    await connection.execute(`UPDATE notification SET is_read = true WHERE id_summoner = ?`, [userId])

    connection.release()

    res.render("notifications", {
      title: "Notificaciones",
      username: username,
      notifications: notifications,
      message: req.query.message || null,
      error: req.query.error || null,
      notificationCount: 0, // Ya que acabamos de marcar todas como leídas
    })
  } catch (err) {
    console.error("Error al cargar notificaciones:", err)
    res.render("notifications", {
      title: "Notificaciones",
      username: username,
      notifications: [],
      message: null,
      error: "Error al cargar notificaciones",
      notificationCount: 0,
    })
  }
})

// Ruta para marcar una notificación como leída
router.post("/mark-notification-read", verificarSesion, async (req, res) => {
  try {
    const { notification_id } = req.body
    const username = req.username

    const connection = await global.poolPromise.getConnection()

    // Verificar que la notificación pertenezca al usuario
    const [userRows] = await connection.execute(`SELECT id_summoner FROM user WHERE username = ?`, [username])

    if (userRows.length === 0) {
      connection.release()
      return res.redirect("/notifications?error=user-not-found")
    }

    const userId = userRows[0].id_summoner

    // Marcar la notificación como leída
    await connection.execute(
      `UPDATE notification SET is_read = true 
       WHERE id_notification = ? AND id_summoner = ?`,
      [notification_id, userId],
    )

    connection.release()
    return res.redirect("/notifications?message=notification-marked-read")
  } catch (err) {
    console.error("Error al marcar notificación como leída:", err)
    return res.redirect("/notifications?error=server-error")
  }
})

// Ruta para eliminar una notificación
router.post("/delete-notification", verificarSesion, async (req, res) => {
  try {
    const { notification_id } = req.body
    const username = req.username

    const connection = await global.poolPromise.getConnection()

    // Verificar que la notificación pertenezca al usuario
    const [userRows] = await connection.execute(`SELECT id_summoner FROM user WHERE username = ?`, [username])

    if (userRows.length === 0) {
      connection.release()
      return res.redirect("/notifications?error=user-not-found")
    }

    const userId = userRows[0].id_summoner

    // Eliminar la notificación
    await connection.execute(
      `DELETE FROM notification 
       WHERE id_notification = ? AND id_summoner = ?`,
      [notification_id, userId],
    )

    connection.release()
    return res.redirect("/notifications?message=notification-deleted")
  } catch (err) {
    console.error("Error al eliminar notificación:", err)
    return res.redirect("/notifications?error=server-error")
  }
})

// Ruta para marcar todas las notificaciones como leídas
router.get("/mark-all-notifications-read", verificarSesion, async (req, res) => {
  try {
    const username = req.username

    const connection = await global.poolPromise.getConnection()

    // Obtener el id_summoner del usuario
    const [userRows] = await connection.execute(`SELECT id_summoner FROM user WHERE username = ?`, [username])

    if (userRows.length === 0) {
      connection.release()
      return res.redirect("/notifications?error=user-not-found")
    }

    const userId = userRows[0].id_summoner

    // Marcar todas las notificaciones como leídas
    await connection.execute(
      `UPDATE notification SET is_read = true 
       WHERE id_summoner = ?`,
      [userId],
    )

    connection.release()
    return res.redirect("/notifications?message=all-notifications-marked-read")
  } catch (err) {
    console.error("Error al marcar todas las notificaciones como leídas:", err)
    return res.redirect("/notifications?error=server-error")
  }
})

// Ruta para eliminar todas las notificaciones
router.get("/delete-all-notifications", verificarSesion, async (req, res) => {
  try {
    const username = req.username

    const connection = await global.poolPromise.getConnection()

    // Obtener el id_summoner del usuario
    const [userRows] = await connection.execute(`SELECT id_summoner FROM user WHERE username = ?`, [username])

    if (userRows.length === 0) {
      connection.release()
      return res.redirect("/notifications?error=user-not-found")
    }

    const userId = userRows[0].id_summoner

    // Eliminar todas las notificaciones
    await connection.execute(
      `DELETE FROM notification 
       WHERE id_summoner = ?`,
      [userId],
    )

    connection.release()
    return res.redirect("/notifications?message=all-notifications-deleted")
  } catch (err) {
    console.error("Error al eliminar todas las notificaciones:", err)
    return res.redirect("/notifications?error=server-error")
  }
})

// Rutas para otras páginas
router.get("/more", async (req, res) => {
  try {
    const username = getUsernameFromToken(req)
    console.log("Username obtenido en more:", username) // Registro de depuración
    
    let userCreditos = 0;
    let notifications = [];
    let notificationCount = 0;
    
    // Si hay un usuario logueado, obtener sus créditos y notificaciones
    if (username) {
      const connection = await global.poolPromise.getConnection()
      try {
        // Obtener créditos e id_summoner en una sola consulta
        const [userRows] = await connection.execute(
          "SELECT creditos, id_summoner FROM user WHERE username = ?", 
          [username]
        )
        
        if (userRows.length > 0) {
          userCreditos = userRows[0].creditos || 0
          const userIdSummoner = userRows[0].id_summoner;
          
          // Obtener notificaciones no leídas
          const [notificationRows] = await connection.execute(
            `SELECT * FROM notification 
             WHERE id_summoner = ? 
             AND is_read = FALSE
             ORDER BY created_at DESC`,
            [userIdSummoner]
          )
          
          notifications = notificationRows;
          notificationCount = notifications.length;
        }
      } catch (error) {
        console.error("Error al obtener datos del usuario:", error)
      } finally {
        connection.release()
      }
    }
    
    res.render("more", { 
      title: "Gaming Community", 
      username: username,
      userCreditos: userCreditos,
      notifications: notifications,        // Añadir esta línea
      notificationCount: notificationCount // Añadir esta línea
    })
  } catch (error) {
    console.error("Error en ruta /more:", error)
    res.render("more", { 
      title: "Gaming Community", 
      username: getUsernameFromToken(req),
      userCreditos: 0,
      notifications: [],        // Añadir esta línea
      notificationCount: 0      // Añadir esta línea
    })
  }
})

router.get("/Mapa_del_sitio", (req, res) => {
  const username = getUsernameFromToken(req)
  console.log("Username obtenido en Mapa_del_sitio:", username) // Registro de depuración
  res.render("Mapa_del_sitio", { title: "Mapa del Sitio - Buff Profit", username: username })
})

// Añadir la nueva ruta para crear partidas
router.get("/create-match", verificarSesion, async (req, res) => {
  const username = getUsernameFromToken(req)
  console.log("Username obtenido en create-match:", username)

  try {
    // Obtener los créditos del usuario
    const connection = await global.poolPromise.getConnection()
    const [userRows] = await connection.execute("SELECT id_summoner, creditos FROM user WHERE username = ?", [username])

    // Obtener notificaciones no leídas
    const [notifications] = await connection.execute(
      `SELECT * FROM notification 
       WHERE id_summoner = ? 
       AND is_read = FALSE
       ORDER BY created_at DESC`,
      [userRows[0].id_summoner],
    )

    connection.release()

    const userCreditos = userRows.length > 0 ? userRows[0].creditos : 0

    res.render("create_match", {
      title: "Create Match",
      username: username,
      userCreditos: userCreditos,
      notifications: notifications,
      notificationCount: notifications.length,
    })
  } catch (err) {
    console.error("Error al obtener créditos del usuario:", err)
    res.render("create_match", {
      title: "Create Match",
      username: username,
      userCreditos: 0,
      notifications: [],
      notificationCount: 0,
    })
  }
})

// Ruta para procesar la creación de partidas
router.post("/process-create-match", verificarSesion, async (req, res) => {
  try {
    const { creditos, region, map, mode, format, skill_level } = req.body
    const username = req.username

    console.log("Datos recibidos:", { creditos, region, map, mode, format, skill_level, username })

    // Validar que los campos requeridos existan
    if (!creditos || !region || !map) {
      return res.json({ err: true, errmsg: "Faltan campos requeridos" })
    }

    // Limpiar y validar los datos
    const cleanCreditos = Number.parseFloat(creditos)
    const cleanRegion = region || "euw"
    const cleanMap = map || "Grieta del Invocador"
    const cleanMode = mode || "1vs1"
    const cleanFormat = format || "Partida completa"
    const cleanSkillLevel = skill_level || "Unranked"

    console.log("Datos limpiados:", { cleanCreditos, cleanRegion, cleanMap, cleanMode, cleanFormat, cleanSkillLevel })

    if (isNaN(cleanCreditos) || cleanCreditos <= 0) {
      return res.json({ err: true, errmsg: "Cantidad de créditos inválida" })
    }

    const connection = await global.poolPromise.getConnection()

    // Obtener el id_summoner del usuario
    const [userRows] = await connection.execute("SELECT id_summoner, creditos FROM user WHERE username = ?", [username])

    if (userRows.length === 0) {
      connection.release()
      return res.json({ err: true, errmsg: "Usuario no encontrado" })
    }

    const userId = userRows[0].id_summoner
    const userCreditos = userRows[0].creditos

    console.log("Usuario encontrado:", { userId, userCreditos, cleanCreditos })

    // Verificar que el usuario tenga suficientes créditos
    if (userCreditos < cleanCreditos) {
      connection.release()
      return res.json({ err: true, errmsg: "No tienes suficientes créditos para crear esta partida" })
    }

    // Restar los créditos al usuario
    await connection.execute("UPDATE user SET creditos = creditos - ? WHERE id_summoner = ?", [cleanCreditos, userId])

    // Crear la partida en la base de datos
    const [result] = await connection.execute(
      `INSERT INTO game (id_summoner_blue, creditos, region, map, mode, format, skill_level, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, cleanCreditos, cleanRegion, cleanMap, cleanMode, cleanFormat, cleanSkillLevel],
    )

    connection.release()

    if (result.affectedRows > 0) {
      console.log("Partida creada exitosamente con ID:", result.insertId)
      return res.json({
        err: false,
        result: {
          message: "Partida creada exitosamente",
          matchId: result.insertId,
        },
      })
    } else {
      // Si falla, devolver los créditos
      const connection2 = await global.poolPromise.getConnection()
      await connection2.execute("UPDATE user SET creditos = creditos + ? WHERE id_summoner = ?", [
        cleanCreditos,
        userId,
      ])
      connection2.release()
      return res.json({ err: true, errmsg: "Error al crear la partida" })
    }
  } catch (err) {
    console.error("Error al crear partida:", err)
    return res.status(500).json({
      err: true,
      errmsg: "Error en el servidor: " + err.message,
    })
  }
})

router.post("/rate-opponent/:id", verificarSesion, async (req, res) => {
  const matchId = req.params.id
  const username = req.username
  const { rating } = req.body

  // Convert rating to numeric value
  let ratingValue = 0
  switch (rating) {
    case "very_positive":
      ratingValue = 2
      break
    case "positive":
      ratingValue = 1
      break
    case "neutral":
      ratingValue = 0
      break
    case "negative":
      ratingValue = -1
      break
    case "very_negative":
      ratingValue = -2
      break
    default:
      ratingValue = 0
  }

  try {
    const connection = await global.poolPromise.getConnection()

    // Get match information with rating status
    const [matchRows] = await connection.execute(
      `SELECT g.*, 
             ub.username as blue_username, ub.id_summoner as blue_summoner_id,
             ur.username as red_username, ur.id_summoner as red_summoner_id,
             g.blue_rated_red, g.red_rated_blue
      FROM game g 
      JOIN user ub ON g.id_summoner_blue = ub.id_summoner 
      JOIN user ur ON g.id_summoner_red = ur.id_summoner 
      WHERE g.id_game = ?`,
      [matchId],
    )

    if (matchRows.length === 0) {
      connection.release()
      return res.redirect("/matchfinder?error=match-not-found")
    }

    const match = matchRows[0]
    const isBluePlayer = match.blue_username === username
    const isRedPlayer = match.red_username === username

    if (!isBluePlayer && !isRedPlayer) {
      connection.release()
      return res.redirect("/matchfinder?error=not-in-match")
    }

    // Verify match is completed
    if (!match.winner) {
      connection.release()
      return res.redirect(`/match-result/${matchId}?error=match-not-completed`)
    }

    // CRITICAL: Check if user has already rated opponent
    const hasAlreadyRated = (isBluePlayer && match.blue_rated_red) || (isRedPlayer && match.red_rated_blue)

    if (hasAlreadyRated) {
      connection.release()
      return res.redirect(`/match-result/${matchId}?error=already-rated`)
    }

    // Update opponent's reputation
    const opponentId = isBluePlayer ? match.red_summoner_id : match.blue_summoner_id

    await connection.execute("UPDATE user SET reputation = reputation + ? WHERE id_summoner = ?", [
      ratingValue,
      opponentId,
    ])

    // Mark that user has rated opponent (PREVENT FUTURE RATINGS)
    const ratedField = isBluePlayer ? "blue_rated_red" : "red_rated_blue"
    await connection.execute(`UPDATE game SET ${ratedField} = true WHERE id_game = ?`, [matchId])

    // Create notification
    let ratingText = "neutral"
    if (ratingValue > 0) ratingText = ratingValue > 1 ? "muy positiva" : "positiva"
    if (ratingValue < 0) ratingText = ratingValue < -1 ? "muy negativa" : "negativa"

    await createNotification(
      opponentId,
      "reputation_rating",
      `${username} te ha dado una calificación ${ratingText} (${ratingValue > 0 ? "+" : ""}${ratingValue}).`,
      matchId,
    )

    connection.release()
    return res.redirect(`/matchfinder?message=rating-submitted`)
  } catch (err) {
    console.error("Error al calificar al oponente:", err)
    return res.redirect(`/matchfinder?error=server-error`)
  }
})

// Ruta para procesar el login
router.post("/procesar_login", async (req, res) => {
  const { username, password } = req.body
  console.log("Procesando login para:", username)

  try {
    // Verificar si es el usuario admin
    if (username === "admin" && password === "admin") {
      const token = uuid.v4()
      sesiones[token] = {
        token: token,
        userId: 0, // ID especial para admin
        username: "admin",
        isAdmin: true, // Marcar como admin
        caducidad: Date.now() + 7 * 86400000, // 7 días
      }

      console.log("Sesión de administrador creada:", token)
      res.cookie("token", token, {
        httpOnly: true,
        maxAge: 7 * 86400000,
        path: "/",
      })

      console.log("Login exitoso para admin, enviando respuesta")
      return res.json({
        err: false,
        result: {
          token,
          isAdmin: true,
          redirect: "/admin",
        },
      })
    }

    // Verificar usuarios normales en la base de datos
    const connection = await global.poolPromise.getConnection()
    const [rows] = await connection.execute("SELECT id_summoner, username, password FROM user WHERE username = ?", [
      username,
    ])
    connection.release()

    if (rows.length === 0) {
      console.log("Usuario no encontrado:", username)
      return res.json({ err: true, errmsg: "Usuario no encontrado" })
    }

    const user = rows[0]
    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      console.log("Contraseña incorrecta para:", username)
      return res.json({ err: true, errmsg: "Contraseña incorrecta" })
    }

    // Crear sesión para usuario normal
    const token = uuid.v4()
    sesiones[token] = {
      token: token,
      userId: user.id_summoner,
      username: user.username,
      isAdmin: false,
      caducidad: Date.now() + 7 * 86400000, // 7 días
    }

    console.log("Sesión creada para usuario:", username)
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 86400000,
      path: "/",
    })

    return res.json({
      err: false,
      result: {
        token,
        isAdmin: false,
        redirect: "/dashboard",
      },
    })
  } catch (err) {
    console.error("Error en login:", err)
    return res.status(500).json({
      err: true,
      errmsg: "Error en el servidor: " + err.message,
    })
  }
})

// Ruta para procesar el registro
router.post("/procesar_registro", async (req, res) => {
  const { username, idSummoner, email, password, summoner } = req.body

  console.log("req.body Datos recibidos:", req.body)

  console.log("Procesando registro para:", username)

  try {
    // Verificar si el usuario ya existe
    const connection = await global.poolPromise.getConnection()
    const [existingUsers] = await connection.execute(
      "SELECT username, email FROM user WHERE username = ? OR email = ?",
      [username, email],
    )

    if (existingUsers.length > 0) {
      connection.release()
      return res.json({
        err: true,
        errmsg: "El usuario o email ya existe",
      })
    }

    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(password, 10)

    // Insertar el nuevo usuario
    const [result] = await connection.execute(
      `INSERT INTO user (username, id_summoner, email, password, summoner, creditos) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, idSummoner, email, hashedPassword, summoner, 100], // 100 créditos iniciales
    )

    console.log("result Resultado del insert:", result)

    connection.release()

    if (result.affectedRows > 0) {
      console.log("Usuario registrado exitosamente:", username)
      return res.json({
        err: false,
        result: { message: "Usuario registrado exitosamente" },
      })
    } else {
      return res.json({
        err: true,
        errmsg: "Error al registrar usuario",
      })
    }
  } catch (err) {
    console.error("Error en registro:", err)
    return res.status(500).json({
      err: true,
      errmsg: "Error en el servidor: " + err.message,
    })
  }
})

//// Paypal ===========================================================
require('dotenv').config({ path: './.env' });
// PayPal configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENVIRONMENT = process.env.NODE_ENV === 'production'
  ? new paypal.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
  : new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);

const paypalClient = new paypal.core.PayPalHttpClient(PAYPAL_ENVIRONMENT);

// PayPal routes
router.post('/paypal/create-payment', verificarSesion, async (req, res) => {
  try {
    const { value } = req.body;

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD', // Replace with your currency
          value: value,
        }
      }]
    });

    let order;
    try {
      order = await paypalClient.execute(request);
    } catch (err) {

      console.error(err);
      return res.status(500).json({ err: true, errmsg: 'Error creating payment', details: err.message });
    }


    res.json({ id: order.result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ err: true, errmsg: 'Error creating payment', details: err.message });
  }
});

router.post('/paypal/capture-payment', verificarSesion, async (req, res) => {
  const { orderID } = req.body;

  const request = new paypal.orders.OrdersCaptureRequest(orderID);
  request.requestBody({});

  try {
    const capture = await paypalClient.execute(request);
    // TODO: Verify capture.result.status is 'COMPLETED'
    // TODO: Save transaction details to your database.

    res.json({ success: true, details: capture });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ err: true, errmsg: 'Error capturing payment', details: err.message });
  }
});

// Ruta para mostrar la página de añadir créditos
router.get('/add-credits', verificarSesion, async (req, res) => {
  try {
    // El middleware verificarSesion ya ha validado el token y establecido req.username
    const username = req.username;
    
    if (!username) {
      return res.redirect('/login');
    }

    const connection = await global.poolPromise.getConnection();
    const [userRows] = await connection.execute(
      'SELECT creditos FROM user WHERE username = ?',
      [username]
    );
    connection.release();

    if (userRows.length === 0) {
      return res.redirect('/login');
    }

    const userCreditos = parseFloat(userRows[0].creditos) || 0;

    res.render('add_credits', {
      username: username,
      userCreditos: userCreditos
    });
  } catch (err) {
    console.error('Error al cargar página de créditos:', err);
    res.status(500).json({ err: true, errmsg: 'Error interno del servidor' });
  }
});

// PayPal routes para créditos
// Update the PayPal create payment route to use your function:
router.post('/paypal/create-credits-payment', verificarSesion, async (req, res) => {
  try {
    const { value, credits } = req.body;
    const creditsNum = parseInt(credits);
    const valueNum = parseFloat(value);

    // Validar que la conversión sea correcta (100 créditos = 1 euro)
    const expectedValue = (creditsNum / 100).toFixed(2);
    if (Math.abs(valueNum - parseFloat(expectedValue)) > 0.01) {
      return res.status(400).json({ err: true, errmsg: 'Conversión de créditos incorrecta' });
    }

    if (creditsNum < 100) {
      return res.status(400).json({ err: true, errmsg: 'Cantidad mínima: 100 créditos' });
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'EUR',
          value: valueNum.toFixed(2),
        },
        description: `${creditsNum} créditos para BuffProfit`
      }],
      application_context: {
        brand_name: 'BuffProfit',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW'
      }
    });

    let order;
    try {
      order = await paypalClient.execute(request);
    } catch (err) {
      console.error('PayPal Error:', err);
      return res.status(500).json({ err: true, errmsg: 'Error creando el pago', details: err.message });
    }

    // Guardar la información del pedido temporalmente usando el objeto sesiones
    const token = req.cookies.token;
    const username = getUsernameFromToken(req); // Use your function
    
    if (sesiones[token]) {
      sesiones[token].pendingCreditsOrder = {
        orderID: order.result.id,
        credits: creditsNum,
        amount: valueNum,
        username: username
      };
    } else {
      sesiones[token] = {
        pendingCreditsOrder: {
          orderID: order.result.id,
          credits: creditsNum,
          amount: valueNum,
          username: username
        }
      };
    }

    res.json({ id: order.result.id });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ err: true, errmsg: 'Error interno del servidor', details: err.message });
  }
});

router.post('/paypal/capture-credits-payment', verificarSesion, async (req, res) => {
  const { orderID } = req.body;

  try {
    const token = req.cookies.token;
    const pendingOrder = sesiones[token]?.pendingCreditsOrder;
    
    // Verificar que el pedido pertenece al usuario actual
    if (!pendingOrder || pendingOrder.orderID !== orderID) {
      return res.status(400).json({ err: true, errmsg: 'Pedido no válido' });
    }

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const capture = await paypalClient.execute(request);
    
    if (capture.result.status === 'COMPLETED') {
      const { credits, amount, username } = pendingOrder;
      
      // Actualizar los créditos del usuario en la base de datos
      const connection = await global.poolPromise.getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Obtener créditos actuales
        const [userRows] = await connection.execute(
          'SELECT creditos FROM user WHERE username = ?',
          [username]
        );
        
        if (userRows.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ err: true, errmsg: 'Usuario no encontrado' });
        }
        
        const currentCredits = parseFloat(userRows[0].creditos) || 0;
        const newCredits = currentCredits + credits;
        
        // Actualizar créditos
        await connection.execute(
          'UPDATE user SET creditos = ? WHERE username = ?',
          [newCredits, username]
        );
        
        // Registrar la transacción (opcional - crear tabla de transacciones)
        try {
          await connection.execute(
            `INSERT INTO transactions (username, type, amount, credits, paypal_order_id, status, created_at) 
             VALUES (?, 'credit_purchase', ?, ?, ?, 'completed', NOW())`,
            [username, amount, credits, orderID]
          );
        } catch (transErr) {
          console.log('Tabla transactions no existe, saltando registro de transacción');
        }
        
        await connection.commit();
        connection.release();
        
        // Limpiar el pedido pendiente
        if (sesiones[token]) {
          delete sesiones[token].pendingCreditsOrder;
        }
        
        res.json({ 
          success: true, 
          details: capture,
          newCredits: newCredits,
          addedCredits: credits
        });
        
      } catch (dbErr) {
        await connection.rollback();
        connection.release();
        console.error('Error de base de datos:', dbErr);
        res.status(500).json({ err: true, errmsg: 'Error actualizando créditos' });
      }
      
    } else {
      res.status(400).json({ err: true, errmsg: 'Pago no completado' });
    }
    
  } catch (err) {
    console.error('Error capturando pago:', err);
    res.status(500).json({ err: true, errmsg: 'Error procesando el pago', details: err.message });
  }
});

// Ruta para mostrar la página de retirada
router.get('/withdraw-credits', verificarSesion, async (req, res) => {
  try {
    const username = req.username;
    console.log('Usuario accediendo a withdraw-credits:', username);
    
    if (!username) {
      console.log('No hay username, redirigiendo a login');
      return res.redirect('/login');
    }

    const connection = await global.poolPromise.getConnection();
    const [userRows] = await connection.execute(
      'SELECT creditos FROM user WHERE username = ?',
      [username]
    );
    connection.release();

    if (userRows.length === 0) {
      console.log('Usuario no encontrado en BD:', username);
      return res.redirect('/login');
    }

    const userCreditos = parseFloat(userRows[0].creditos) || 0;
    console.log('Créditos del usuario:', userCreditos);

    res.render('withdraw_credits', {
      username: username,
      userCreditos: userCreditos
    });
  } catch (err) {
    console.error('Error al cargar página de retirada:', err);
    res.status(500).json({ err: true, errmsg: 'Error interno del servidor: ' + err.message });
  }
});

router.post('/process-withdrawal', verificarSesion, async (req, res) => {
  console.log('=== INICIO PROCESS-WITHDRAWAL ===');
  console.log('Body recibido:', req.body);
  console.log('Username desde middleware:', req.username);
  
  try {
    const { creditsAmount, paypalEmail } = req.body;
    const username = req.username;
    
    if (!username) {
      console.log('ERROR: Usuario no autenticado');
      return res.status(401).json({ err: true, errmsg: 'Usuario no autenticado' });
    }
    
    const creditsNum = parseInt(creditsAmount);
    console.log('Créditos a retirar:', creditsNum);
    console.log('Email PayPal:', paypalEmail);
    
    // Validaciones
    if (creditsNum < 1000) {
      console.log('ERROR: Cantidad mínima no alcanzada');
      return res.status(400).json({ err: true, errmsg: 'Cantidad mínima: 1000 créditos' });
    }
    
    if (!paypalEmail || !paypalEmail.includes('@')) {
      console.log('ERROR: Email inválido');
      return res.status(400).json({ err: true, errmsg: 'Email de PayPal inválido' });
    }
    
    console.log('Obteniendo conexión a BD...');
    const connection = await global.poolPromise.getConnection();
    
    try {
      console.log('Iniciando transacción...');
      await connection.beginTransaction();
      
      // Verificar créditos actuales del usuario
      console.log('Verificando créditos del usuario...');
      const [userRows] = await connection.execute(
        'SELECT creditos FROM user WHERE username = ?',
        [username]
      );
      
      if (userRows.length === 0) {
        console.log('ERROR: Usuario no encontrado en BD');
        await connection.rollback();
        connection.release();
        return res.status(400).json({ err: true, errmsg: 'Usuario no encontrado' });
      }
      
      const currentCredits = parseFloat(userRows[0].creditos) || 0;
      console.log('Créditos actuales del usuario:', currentCredits);
      
      if (currentCredits < creditsNum) {
        console.log('ERROR: Créditos insuficientes');
        await connection.rollback();
        connection.release();
        return res.status(400).json({ err: true, errmsg: 'Créditos insuficientes' });
      }
      
      // Calcular montos
      const grossAmount = creditsNum / 100;
      const feeAmount = (grossAmount * 0.02) + 0.35;
      const netAmount = grossAmount - feeAmount;
      
      console.log('Montos calculados:');
      console.log('- Bruto:', grossAmount);
      console.log('- Comisión:', feeAmount);
      console.log('- Neto:', netAmount);
      
      // Restar créditos del usuario
      console.log('Actualizando créditos del usuario...');
      const newCredits = currentCredits - creditsNum;
      await connection.execute(
        'UPDATE user SET creditos = ? WHERE username = ?',
        [newCredits, username]
      );
      
      console.log('Créditos actualizados. Nuevos créditos:', newCredits);
      
      await connection.commit();
      connection.release();
      
      console.log('=== PROCESO COMPLETADO EXITOSAMENTE ===');
      
      // Devolver respuesta exitosa
      res.json({ 
        success: true, 
        message: 'Retirada procesada correctamente',
        withdrawalAmount: netAmount,
        remainingCredits: newCredits,
        grossAmount: grossAmount,
        feeAmount: feeAmount
      });
      
    } catch (dbErr) {
      console.error('ERROR DE BASE DE DATOS:', dbErr);
      await connection.rollback();
      connection.release();
      res.status(500).json({ 
        err: true, 
        errmsg: 'Error procesando la retirada: ' + dbErr.message 
      });
    }
    
  } catch (err) {
    console.error('ERROR GENERAL:', err);
    res.status(500).json({ 
      err: true, 
      errmsg: 'Error interno del servidor: ' + err.message 
    });
  }
});


module.exports = router
