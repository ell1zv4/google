const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta GET para manejar solicitudes al proxy
app.get('/proxy', async (req, res) => {
    const url = req.query.url; // Obtiene la URL del parámetro de consulta

    if (!url) {
        return res.status(400).send('URL is required');
    }

    try {
        // Realiza la solicitud a la URL
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0', // Establecer un User-Agent válido
            },
        });

        // Modificar el HTML de respuesta para interceptar enlaces, imágenes, scripts, y estilos
        let modifiedHtml = response.data;

        // Reescribir rutas relativas para que pasen por el proxy
        modifiedHtml = modifiedHtml
            // Reescribir enlaces <a> para que pasen por el proxy
            .replace(/href="(\/[^"]*)"/g, 'href="/proxy?url=' + encodeURIComponent(url) + '$1"')
            // Reescribir rutas de imágenes <img>
            .replace(/src="(\/[^"]*)"/g, 'src="/proxy?url=' + encodeURIComponent(url) + '$1"')
            // Reescribir hojas de estilos <link>
            .replace(/link rel="stylesheet" href="(\/[^"]*)"/g, 'link rel="stylesheet" href="/proxy?url=' + encodeURIComponent(url) + '$1"')
            // Reescribir scripts <script>
            .replace(/src="(\/[^"]*)"/g, 'src="/proxy?url=' + encodeURIComponent(url) + '$1"');

        // Inyectar un script en el <head> de la página para reescribir dinámicamente los enlaces
        modifiedHtml = modifiedHtml.replace('</head>', `
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    // Reescribir todos los enlaces <a> para que pasen por el proxy
                    document.querySelectorAll('a').forEach(function(link) {
                        const originalHref = link.getAttribute('href');
                        if (originalHref && !originalHref.startsWith('http')) {
                            link.setAttribute('href', '/proxy?url=' + encodeURIComponent('${url}') + originalHref);
                        }
                    });

                    // Reescribir todas las rutas de imágenes, estilos y scripts que sean relativas
                    document.querySelectorAll('img').forEach(function(img) {
                        const originalSrc = img.getAttribute('src');
                        if (originalSrc && !originalSrc.startsWith('http')) {
                            img.setAttribute('src', '/proxy?url=' + encodeURIComponent('${url}') + originalSrc);
                        }
                    });
                    document.querySelectorAll('link[rel="stylesheet"]').forEach(function(link) {
                        const originalHref = link.getAttribute('href');
                        if (originalHref && !originalHref.startsWith('http')) {
                            link.setAttribute('href', '/proxy?url=' + encodeURIComponent('${url}') + originalHref);
                        }
                    });
                    document.querySelectorAll('script').forEach(function(script) {
                        const originalSrc = script.getAttribute('src');
                        if (originalSrc && !originalSrc.startsWith('http')) {
                            script.setAttribute('src', '/proxy?url=' + encodeURIComponent('${url}') + originalSrc);
                        }
                    });
                });
            </script>
        </head>`);

        res.send(modifiedHtml); // Envía la respuesta modificada al cliente
    } catch (error) {
        console.error('Error fetching the URL:', error.message);
        res.status(500).send('Error fetching the URL');
    }
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`Proxy server is running on http://localhost:${PORT}`);
});
