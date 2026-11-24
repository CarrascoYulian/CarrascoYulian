# Proyecto: Libro de Daniel (Gran Preguntón) — memoria para Claude

Repo remoto: https://github.com/CarrascoYulian/CarrascoYulian (cada trabajo vive en una rama; `main` solo tiene el README de perfil).
Esta carpeta es la copia LOCAL, sin red. Objetivo del usuario: seguir trabajando la ruleta en local.

## Qué hay aquí
- `ruletas/` ← rama `yulian/adoring-dijkstra-l0vlg9`. **Ruleta principal.** `index.html` todo-en-uno (cero dependencias externas), cronómetro, modo proyector (F), atajos (Espacio, C, X, flechas), PWA (`sw.js`, `manifest.webmanifest`) e instalador Windows (`Instalar-Windows.bat`, `instalar.ps1`). Ver `LEEME-INSTALAR.md`.
- `juego-daniel/` ← rama `yulian/upbeat-babbage-v2mm26`. `juego-daniel.html`: preguntas Daniel 1–12 (RVR1960, ~20 por capítulo), ruleta, 30 s, 4 tipos de pregunta. Fuentes Google descargadas a `fonts/` (antes eran remotas).
- `pregunton-daniel/` ← rama `yulian/great-bell-fwz8mx`. Versión multijugador: `public/index.html`, API Vercel `api/game.js`, `lib/logic.js`, `lib/answers.js`, `lib/store.js`, tests (`npm test`, `npm run dev`). Requiere Vercel/Blob para producción; el modo dev corre local.
- `repo-completo.bundle` ← todo el historial git y todas las ramas. Restaurar: `git clone repo-completo.bundle CarrascoYulian`.

## Historial de commits relevantes
- ruletas: "ruletas bíblicas del Gran Preguntón" → "app instalable sin internet, modo proyector y atajos" → "nuevo diseño vertical, ruleta con iniciar/parar, banderas ondeantes".
- juego-daniel: juego 1–12 → ~20 preguntas por capítulo → ruleta, 30 s y 4 tipos.

## Pendiente / próximas mejoras
Mejoras de la ruleta (a definir con el usuario). Mantener todo offline: no añadir CDN, fuentes ni fetch remotos.
