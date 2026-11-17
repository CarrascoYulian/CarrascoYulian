# Resumen: Instalar Metrolist (IPA) en iPhone

## Contexto
- **Metrolist**: app de música de código abierto (tipo Spotify, sin anuncios). Nació en Android; el soporte para iOS puede ser nuevo y tener fallos.
- Descargué desde metrolist.cc un archivo **.ipa sin firmar** (iOS 17+) y está en la app Archivos del iPhone.
- Problema: iOS no instala IPAs sin firmar tocándolos. Hay que firmarlos con una herramienta de *sideloading*.

## Cómo instalarlo

### Opción 1: Sideloadly (la más sencilla, requiere PC/Mac)
1. Instalar Sideloadly (sideloadly.io) en la computadora.
2. Pasar el IPA a la computadora (AirDrop, iCloud, correo).
3. Conectar el iPhone por cable y tocar **Confiar**.
4. Arrastrar el IPA a Sideloadly, poner el Apple ID y pulsar **Start**.
5. En el iPhone: Ajustes → General → VPN y gestión de dispositivos → tu Apple ID → **Confiar**.
6. Activar **Modo desarrollador**: Ajustes → Privacidad y seguridad → Modo desarrollador (el teléfono se reinicia).

### Opción 2: AltStore
Instalar AltServer en la computadora (misma red Wi-Fi) y abrir el IPA desde la app AltStore. Se renueva solo por Wi-Fi.

### Opción 3: SideStore
Como AltStore, pero tras la configuración inicial ya no necesita computadora. Es la mejor opción si no tengo PC a mano, aunque su configuración inicial es más técnica.

## Limitaciones del Apple ID gratuito
- La app **caduca a los 7 días** y hay que volver a firmarla (AltStore y SideStore lo hacen automáticamente).
- Máximo 3 apps sideloadeadas a la vez.
- Con cuenta de desarrollador de pago (99 USD/año) dura 1 año.

## ESign: ¿qué tan peligroso es?
(Asumí que "ESing" = **ESign**, app que firma IPAs con certificados de terceros. Confirmar si era otra.)

**Cómo funciona:** usa certificados de empresa o desarrollador filtrados o vendidos en mercados grises. Apple los revoca con frecuencia y las apps dejan de abrir.

**Riesgos:**
- Confiar en un desconocido (el dueño del certificado).
- El riesgo principal es el contenido del IPA: puede traer código malicioso o rastreadores.
- Phishing: nunca poner el Apple ID principal en servicios que no sean AltStore, SideStore o Sideloadly.
- Perfiles MDM o de configuración: rechazar cualquier perfil que no se entienda.
- Inestabilidad: el certificado puede caer en cualquier momento.

iOS aísla cada app, así que el certificado por sí solo no da acceso a otras apps ni a las fotos.

## Recomendación final
- Para Metrolist, usar **SideStore, AltStore o Sideloadly con mi propio Apple ID** (sin certificados de terceros).
- Descargar el IPA **solo del sitio oficial o del GitHub oficial** del proyecto.
- Preferiblemente usar un **Apple ID secundario** y no instalar apps bancarias o sensibles por este método.
- Si uso ESign: no usar el Apple ID principal y no aceptar perfiles raros. Es la opción menos segura.

## Pendiente
- Decidir si tengo PC/Mac disponible (Sideloadly/AltStore) o si voy con SideStore.
- Confirmar qué es "ESing"/ESign si era otra app.
