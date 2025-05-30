const express = require("express")
const router = express.Router()
const bcrypt = require("bcrypt")
const uuid = require("uuid")
const multer = require("multer")
const path = require("path")
const fs = require("fs")

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
    return res.status(401).json({ err: true, errmsg: "Sesión no válida" })
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

// Ruta para el panel de administración
router.get("/admin", verificarSesion, verificarAdmin, async (req, res) => {
  try {
    // Obtener los torneos existentes
    const connection = await global.poolPromise.getConnection()
    const [tournaments] = await connection.execute("SELECT * FROM tournament ORDER BY start_date DESC")
    connection.release()

    res.render("admin", {
      title: "Admin Panel",
      username: req.username,
      tournaments: tournaments,
    })
  } catch (err) {
    console.error("Error al obtener torneos:", err)
    res.render("admin", {
      title: "Admin Panel",
      username: req.username,
      tournaments: [],
      error: "Error al cargar torneos",
    })
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

    // Obtener información del usuario
    const [userRows] = await connection.execute("SELECT id_summoner FROM user WHERE username = ?", [username])
    const userId = userRows[0].id_summoner

    // Obtener notificaciones no leídas
    const [notifications] = await connection.execute(
      `SELECT * FROM notification 
       WHERE id_summoner = ? 
       AND is_read = FALSE
       ORDER BY created_at DESC`,
      [userId],
    )

    // Obtener información del torneo
    const [tournamentRows] = await connection.execute(`SELECT * FROM tournament WHERE id_tournament = ?`, [
      tournamentId,
    ])

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
    const { team_name, team_tag, team_description } = req.body

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

    // Añadir al creador como capitán del equipo
    await connection.execute(
      `INSERT INTO team_member (id_team, id_summoner, role, is_captain)
       VALUES (?, ?, ?, ?)`,
      [teamId, userId, "Capitán", true],
    )

    connection.release()
    return res.redirect("/tournament?message=team-created")
  } catch (err) {
    console.error("Error al crear equipo:", err)
    return res.redirect("/tournament?error=server-error")
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
      `SELECT n.*, ti.status 
       FROM notification n
       LEFT JOIN team_invitation ti ON n.related_id = ti.id_invitation AND n.type = 'team_invitation'
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

// Rutas para otras páginas
router.get("/more", (req, res) => {
  const username = getUsernameFromToken(req)
  console.log("Username obtenido en more:", username) // Registro de depuración
  res.render("more", { title: "Gaming Community", username: username })
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
    const { idGameLol, mode, map, format, creditos, region, skill_level } = req.body
    const creditosValue = Number.parseFloat(creditos)

    // Obtener el id_summoner y créditos del usuario actual
    const connection = await global.poolPromise.getConnection()
    const [userRows] = await connection.execute("SELECT id_summoner, creditos FROM user WHERE username = ?", [
      req.username,
    ])

    if (userRows.length === 0) {
      connection.release()
      return res.status(404).json({ err: true, errmsg: "Usuario no encontrado" })
    }

    const id_summoner_blue = userRows[0].id_summoner
    const userCreditos = userRows[0].creditos

    // Verificar que el usuario tenga suficientes créditos
    if (userCreditos < creditosValue) {
      connection.release()
      return res.status(400).json({ err: true, errmsg: "No tienes suficientes créditos" })
    }

    // Restar los créditos al usuario creador
    await connection.execute("UPDATE user SET creditos = creditos - ? WHERE id_summoner = ?", [
      creditosValue,
      id_summoner_blue,
    ])

    // Insertar la nueva partida en la base de datos
    const [result] = await connection.execute(
      `INSERT INTO game (idGameLol, id_summoner_blue, mode, map, format, creditos, region, skill_level) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [idGameLol, id_summoner_blue, mode, map, format, creditosValue, region, skill_level],
    )
    connection.release()

    if (result.affectedRows > 0) {
      console.log("Partida creada correctamente:", idGameLol)
      res.json({ err: false, result: { message: "Partida creada correctamente", id: result.insertId } })
    } else {
      console.log("Error al crear partida")
      res.status(500).json({ err: true, errmsg: "Error al crear partida" })
    }
  } catch (err) {
    console.error("Error al procesar la creación de partida:", err)
    res.status(500).json({ err: true, errmsg: "Error al procesar la creación de partida: " + err.message })
  }
})

// Login y creación de sesión con token
router.post("/procesar_login", async (req, res) => {
  const { username, password } = req.body
  console.log("Intento de login para:", username)
  console.log("Datos recibidos:", req.body)

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
      res.cookie("token", token, { httpOnly: true, maxAge: 7 * 86400000 }) // Guardar token en cookie
      return res.json({ err: false, result: { token, isAdmin: true } })
    }

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
          username: user.username, // Guardar el nombre del usuario en la sesión
          caducidad: Date.now() + 7 * 86400000, // 7 días
        }

        console.log("Sesión creada:", token)
        console.log("Sesiones actuales:", Object.keys(sesiones))

        res.cookie("token", token, { httpOnly: true, maxAge: 7 * 86400000 }) // Guardar token en cookie
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
      "INSERT INTO user (username, summoner, id_summoner, email, password, reputation, creditos) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [username, summoner, idSummoner, email, hashedPassword, 0, 100.0], // Asignar 100 créditos iniciales
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

module.exports = router
