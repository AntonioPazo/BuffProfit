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

router.get("/dashboard", verificarSesion, (req, res) => {
  console.log("Username obtenido en dashboard:", req.username) // Registro de depuración
  res.render("dashboard", { title: "Dashboard", username: req.username })
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

    // Obtener partidas donde id_summoner_red es NULL (partidas sin oponente)
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

    await connection.execute("UPDATE user SET reputation = reputation + ? WHERE id_summoner = ?", [
      ratingValue,
      opponentId,
    ])

    // Marcar que el usuario ha calificado al oponente
    const ratedField = isBluePlayer ? "blue_rated_red" : "red_rated_blue"

    await connection.execute(`UPDATE game SET ${ratedField} = true WHERE id_game = ?`, [matchId])

    connection.release()

    // Redirigir a la página de matchfinder en lugar de volver a la página de resultados
    return res.redirect(`/matchfinder?message=rating-submitted`)
  } catch (err) {
    console.error("Error al calificar al oponente:", err)
    return res.redirect(`/matchfinder?error=server-error`)
  }
})

// Rutas para otras páginas
router.get("/tournament", (req, res) => {
  const username = getUsernameFromToken(req)
  console.log("Username obtenido en tournament:", username) // Registro de depuración
  res.render("tournament", { title: "League of Legends - Tournaments", username: username })
})

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
    const [userRows] = await connection.execute("SELECT creditos FROM user WHERE username = ?", [username])
    connection.release()

    const userCreditos = userRows.length > 0 ? userRows[0].creditos : 0

    res.render("create_match", {
      title: "Create Match",
      username: username,
      userCreditos: userCreditos,
    })
  } catch (err) {
    console.error("Error al obtener créditos del usuario:", err)
    res.render("create_match", {
      title: "Create Match",
      username: username,
      userCreditos: 0,
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

module.exports = router
