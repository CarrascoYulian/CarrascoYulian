# Preguntón de Daniel

Juego de preguntas del libro de Daniel (capítulos 1 al 12) en la Reina Valera 1960, para campamentos y grupos de jóvenes.

- **Jugar**: 60 preguntas con 30 segundos cada una (20, 30, 45 o 60 según elija la organizadora).
- **Posiciones**: lugares y puntos por equipo y por jugador. Nadie ve las respuestas falladas de otros.
- **Panel** (con clave): quién acertó, falló o se quedó sin tiempo; rondas por capítulos; equipos; reiniciar; CSV.

## Cómo funciona
- `public/index.html`: toda la interfaz (sin pasos de compilación).
- `api/game.js` + `lib/`: API en una función de Vercel. Las respuestas correctas y el reloj de cada pregunta viven solo en el servidor.
- Datos: un archivo JSON por jugador en un Vercel Blob **privado**.

## Variables de entorno
- `BLOB_READ_WRITE_TOKEN`: la crea Vercel al conectar el Blob al proyecto.
- `ADMIN_PIN`: clave del panel de la organizadora.
- `GAME_SECRET` (opcional): secreto para firmar los relojes de las preguntas.

## Pruebas locales
```
npm test        # lógica del servidor
npm run dev     # http://localhost:3000 con datos en memoria (clave 123456)
```
Texto bíblico: Reina-Valera 1960® © Sociedades Bíblicas en América Latina, 1960. Utilizado con permiso.
