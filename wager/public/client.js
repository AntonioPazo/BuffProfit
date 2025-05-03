document.addEventListener("DOMContentLoaded", () => {
    const storedToken = localStorage.getItem("token");

    // Verificar si el token está en localStorage y es válido
    if (storedToken) {
        fetch(`/matchfinder?token=${storedToken}`, {
            method: "GET",
            headers: {
                "Authorization": storedToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.err) {
                // Si hay un error, redirigir al login
                localStorage.removeItem("token");
                window.location.href = "/login";
            } else {
                // Si el token es válido, redirigir a matchfinder
                window.location.href = "/matchfinder";
            }
        })
        .catch(error => {
            console.error("Error al verificar el token:", error);
            localStorage.removeItem("token");
            window.location.href = "/login";
        });
    }
});