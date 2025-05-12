document.addEventListener("DOMContentLoaded", () => {
  console.log("auth.js cargado correctamente")
  const loginForm = document.getElementById("loginForm")
  const registerForm = document.getElementById("registerForm")

  if (loginForm) {
    console.log("Formulario de login encontrado")
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault()
      console.log("Formulario de login enviado")

      const username = document.getElementById("loginUsername").value
      const password = document.getElementById("loginPassword").value

      console.log("Intentando login con:", username)

      try {
        const resHttp = await fetch("/procesar_login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
          credentials: "include",
        })

        console.log("Respuesta recibida, status:", resHttp.status)
        const resBody = await resHttp.json()
        console.log("Respuesta del servidor:", resBody)

        if (resHttp.ok && !resBody.err) {
          const token = resBody.result.token
          localStorage.setItem("token", token)
          console.log("Token guardado en localStorage:", token)

          // Redirigir a matchfinder
          window.location.href = "/matchfinder"
        } else {
          console.error("Error en login:", resBody.errmsg)
          alert("❌ Usuario o contraseña incorrectos: " + (resBody.errmsg || "Error desconocido"))
        }
      } catch (error) {
        console.error("Error en fetch:", error)
        alert("❌ Error al conectar con el servidor")
      }
    })
  } else {
    console.log("Formulario de login NO encontrado")
  }

  if (registerForm) {
    console.log("Formulario de registro encontrado")
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault()
      console.log("Formulario de registro enviado")

      const username = document.getElementById("registerUsername").value
      const summoner = document.getElementById("registerSummoner").value
      const idSummoner = document.getElementById("registerIdSummoner").value
      const email = document.getElementById("registerEmail").value
      const password = document.getElementById("registerPassword").value
      const confirmPassword = document.getElementById("confirmPassword").value

      if (password !== confirmPassword) {
        alert("❌ Las contraseñas no coinciden")
        return
      }

      try {
        const resHttp = await fetch("/procesar_registro", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, summoner, idSummoner, email, password }),
          credentials: "include",
        })

        const resBody = await resHttp.json()
        console.log("Respuesta del registro:", resBody)

        if (resHttp.ok && !resBody.err) {
          alert("✅ Usuario registrado correctamente")
          window.location.href = "/login"
        } else {
          alert("❌ Error al registrar usuario: " + resBody.errmsg)
        }
      } catch (error) {
        console.error("Error en fetch de registro:", error)
        alert("❌ Error al conectar con el servidor")
      }
    })
  } else {
    console.log("Formulario de registro NO encontrado")
  }

  // Función para configurar el token en el encabezado de autorización
  function configureAuthHeader(token) {
    const originalFetch = window.fetch
    window.fetch = (url, options = {}) => {
      options = options || {}
      options.headers = options.headers || {}
      options.credentials = "include"

      // Agregar el token de autorización a todas las solicitudes
      if (token) {
        options.headers["Authorization"] = token
      }

      return originalFetch(url, options)
    }
  }

  // Verificar si ya hay un token almacenado y configurarlo
  const storedToken = localStorage.getItem("token")
  if (storedToken) {
    console.log("Token encontrado en localStorage:", storedToken)
    configureAuthHeader(storedToken)
  } else {
    console.log("No se encontró token en localStorage")
  }
})
