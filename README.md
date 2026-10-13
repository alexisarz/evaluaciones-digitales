# Sistema de Evaluación Digital

Base en React + Vite para exámenes universitarios, con Firebase Authentication y Firestore.

## Ejecutar

```bash
npm install
npm run dev
```

## Autenticación

Los documentos de `users` deben existir antes del primer acceso y usar el legajo como ID. El primer ingreso crea la cuenta Auth con `<legajo>@evaluacionuade.edu.ar` y activa `contrasenaActiva`. Los siguientes accesos verifican nuevamente el perfil, estado `activo` y rol desde Firestore.

## Rendición de exámenes

La colección `examenesEntregados` se crea al comenzar el primer examen. Cada intento usa el ID `<examenId>_<legajo>` para impedir que el mismo alumno genere otro intento cambiando de tema. Contiene una copia de las preguntas y del tema, respuestas de texto, tiempos, estado de entrega/corrección, incidentes y nota pendiente. El alumno sólo puede iniciar un examen de un código presente en `users.cursosActivos`, desde `fechaInicio` hasta `fechaInicio + toleranciaMinutos`.

Durante la rendición, las respuestas se guardan cada 10 segundos en Firestore y en un respaldo local cifrado con Web Crypto e IndexedDB. El examen termina a `fechaInicio + duracionMinutos` (120 minutos en los nuevos exámenes), para todos los alumnos; quien ingresa durante la tolerancia dispone de menos tiempo. El temporizador depende de `fechaLimite` persistida, por lo que recargar la página no lo reinicia. Si una entrega no llega al servidor, el respaldo local permite reintentar desde `alumno/misExamenes` en ese mismo navegador y dispositivo. La corrección y la nota quedan pendientes de la intervención del profesor.

En el panel del profesor, `En curso` y `Finalizado` se calculan desde la fecha y duración al visualizar el examen, incluso si nadie dejó el panel abierto al producirse el cambio de hora. Al editar la fecha antes del inicio, el documento se guarda como `reprogramado`; durante y después del examen no se permite editar. Los cambios automáticos por horario no escriben `examenes.estado` en Firestore: para persistirlos sin clientes conectados se necesita un proceso programado del lado del servidor. La misma restricción temporal debe aplicarse en reglas o backend para impedir clientes modificados.

Los permisos de Firestore deben permitir que el alumno lea y actualice únicamente su propio intento y que el profesor consulte los intentos de sus cursos. La colección no necesita crearse manualmente, pero sin reglas compatibles las operaciones serán rechazadas. No se modifican reglas ni se despliegan cambios de Firebase desde este proyecto.

## Seguridad pendiente para producción

El flujo de primer acceso necesita poder localizar un legajo antes de autenticarlo. No se debe resolver abriendo la colección `users` a lectura pública. Antes de producción, trasladar esa validación/activación a un endpoint de confianza (por ejemplo, una Cloud Function callable) y aplicar reglas de Firestore que limiten cada usuario a su propio documento.

La pantalla completa y `visibilitychange` ofrecen avisos en una web, pero no bloquean el sistema operativo ni garantizan prevención de trampas. Para un examen de alta seguridad hacen falta un cliente kiosk nativo y validaciones del intento, temporizador y permisos en un backend confiable. La inscripción por comisión requiere un dato adicional en `users`: hoy `cursosActivos` sólo permite comprobar el código de curso.
