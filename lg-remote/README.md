# Control LG (PWA)

Control remoto para televisores **LG webOS** (2014 en adelante) que se instala en el celular como una app.
Se comunica directo con la TV por tu Wi‑Fi. No usa servidores intermedios ni la nube.

## Qué puede hacer

- Cruceta, OK, Atrás, Inicio, Ajustes, Info, Salir (mantén pulsado para repetir)
- Volumen y canales, silencio, volumen actual en vivo
- Reproducir, pausa, adelantar y retroceder
- Cambiar de entrada (HDMI, TV en vivo…)
- Abrir cualquier app instalada (Netflix, YouTube…)
- Teclado de números y botones de colores
- Touchpad para el puntero Magic Remote
- Escribir texto en los buscadores de la TV
- Apagar la TV

## Cómo usarla

1. **Publícala en HTTPS** (es obligatorio para PWA). Lo más fácil es GitHub Pages:
   en GitHub, *Settings → Pages → Deploy from a branch*, elige la rama y la carpeta raíz.
   La app queda en `https://<usuario>.github.io/<repo>/lg-remote/`.
2. En la TV activa **«LG Connect Apps»** o **«Control móvil de TV»**
   (en *Configuración → General → Dispositivos externos* o *Red*, según el modelo).
3. Busca la **IP de la TV**: *Configuración → General → Red → Wi‑Fi → Configuración avanzada*.
   Te recomiendo reservarla en tu router (DHCP estático) para que no cambie.
4. Abre la app en tu celular, escribe la IP y toca **Abrir https://IP:3001**.
   Acepta la advertencia del certificado («Avanzado → Continuar»). Eso le dice al navegador que confíe en la TV.
5. Vuelve y toca **Conectar**. Acepta el aviso que sale en la TV. Quedará emparejada y la app la recordará.
6. En el menú del navegador elige **«Instalar app» / «Agregar a pantalla de inicio»**.

## Limitaciones conocidas

- **No puede buscar la TV automáticamente.** Los navegadores no pueden hacer el descubrimiento SSDP que usan las TVs, por eso pide la IP una vez.
- **No puede encender la TV.** Para encenderla hace falta Wake‑on‑LAN (paquetes UDP), y los navegadores no pueden enviarlos. Sí puede apagarla.
- Si la TV se actualiza o se reinicia, puede que tengas que aceptar el certificado otra vez (paso 4).
- Funciona mejor en Chrome para Android. En iPhone, Safari tiene que aceptar el certificado; si la app instalada no conecta, prueba desde Safari normal.

## Archivos

| Archivo | Para qué sirve |
| --- | --- |
| `index.html`, `style.css` | Interfaz |
| `app.js` | Lógica de la app (configuración, botones, paneles) |
| `lgtv.js` | Cliente del protocolo SSAP de webOS (WebSocket `wss://IP:3001`) |
| `pairing.js` | Manifiesto de emparejamiento estándar de webOS (de [lgtv2](https://github.com/hobbyquaker/lgtv2), MIT) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Lo que la convierte en PWA instalable y que abre sin internet |

Para probarla en tu computadora: `python3 -m http.server 8080` dentro de esta carpeta y abre `http://localhost:8080`.
