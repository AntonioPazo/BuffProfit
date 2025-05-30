document.addEventListener("DOMContentLoaded", () => {
    // Función para obtener parámetros de la URL
    function getUrlParameter(name) {
        name = name.replace(/[[]/, "\\[").replace(/[\]]/, "\\]");
        const regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
        const results = regex.exec(location.search);
        return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }

    // Obtener el token de la URL o del localStorage
    const tokenFromUrl = getUrlParameter("token");
    let token = localStorage.getItem("token");

    // Si hay un token en la URL, guardarlo en localStorage
    if (tokenFromUrl) {
        localStorage.setItem("token", tokenFromUrl);
        token = tokenFromUrl;

        // Limpiar el token de la URL para seguridad
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }

    // Si no hay token en localStorage, redirigir al login
    if (!token) {
        window.location.href = "/login";
        return;
    }

    console.log("Matchfinder inicializado correctamente con token:", token);

    // Aquí puedes agregar la lógica específica de la página matchfinder

    // Ejemplo: cargar datos del usuario
    loadUserData(token);

    function loadUserData(token) {
        // Esta función podría hacer una solicitud al servidor para obtener datos del usuario
        console.log("Cargando datos del usuario con token:", token);

        // Ejemplo de cómo hacer una solicitud autenticada
        /*
        fetch('/api/user-data', {
          headers: {
            'Authorization': token
          }
        })
        .then(response => response.json())
        .then(data => {
          console.log('Datos del usuario:', data);
          // Actualizar la interfaz con los datos del usuario
        })
        .catch(error => {
          console.error('Error al cargar datos del usuario:', error);
        });
        */
    }
});