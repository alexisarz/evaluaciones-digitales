# Sistema de Evaluación Digital

Base en React + Vite para exámenes universitarios. En este prototipo, el acceso y los datos usan Firestore sin Firebase Authentication.

## Arquitectura

El estado compartido se organiza por dominio con Redux Toolkit. `src/app/store.js` registra los slices de autenticación, exámenes del profesor, exámenes del alumno y administración. Cada slice define reducers (las mutaciones de estado), acciones asíncronas para cargar/actualizar datos y selectores para leer datos derivados. Los servicios de `src/services/` son la capa de acceso a Firebase; las vistas no deben duplicar esas consultas cuando hay una acción del dominio.

Las fechas de Firestore se convierten a texto ISO antes de entrar al store para mantenerlo serializable. El estado que sólo interesa a una pantalla —por ejemplo campos de un formulario, un modal o el autoguardado de una rendición activa— permanece local. Componentes reutilizables como diálogos, campos y tarjetas están en `src/shared/components/`. Las nuevas funciones deben seguir las reglas de `AGENTS.md`.

```text
src/app/                 configuración del store
src/features/            slices, acciones y selectores por dominio
src/services/            acceso a Firebase y persistencia local
src/shared/components/   piezas visuales reutilizables
src/pages/               pantallas conectadas a las rutas
```

Para comprobar el estado sin depender de Firebase: `npm run test:unit`. También están disponibles `npm run lint` y `npm run build`.

## Ejecutar

```bash
npm install
npm run dev
```

## Pruebas del login con Playwright

Playwright está agregado como dependencia de desarrollo y configurado para usar el Google Chrome ya instalado en la Mac (`channel: 'chrome'`). No hace falta ejecutar `npx playwright install` ni descargar otro navegador.

Desde la carpeta del proyecto:

```bash
npm run test:e2e
```

El comando inicia Vite automáticamente, ejecuta las pruebas de la pantalla `/login` y genera un informe HTML en `playwright-report`. Para abrirlo: `npx playwright show-report`. Las pruebas comprueban el formulario, validación obligatoria, primer ingreso, recupero de contraseña y legajo inválido. No utilizan credenciales reales ni crean cuentas en Firebase. Un ingreso exitoso con Firebase requiere una prueba separada con datos de prueba controlados.

## Autenticación

Los documentos de `users` deben existir antes del primer acceso y usar el legajo como ID. El primer ingreso calcula en el navegador una derivación PBKDF2-SHA256 con sal aleatoria y guarda `passwordHash`, `passwordSalt` y `contrasenaActiva: true` en el documento. No se guarda la contraseña en texto plano. Los siguientes accesos comparan la contraseña ingresada con esa derivación y comprueban `activo` y rol. La sesión conserva el legajo en `localStorage` y se revalida contra Firestore al recargar.

**Migración desde Firebase Auth:** las claves existentes no se pueden leer ni convertir. Antes de usar la nueva versión, poner `contrasenaActiva: false` en el documento `users` del administrador desde Firebase Console; luego entrar por «Es mi primer ingreso» y definir una clave nueva. Una vez dentro, el administrador puede restablecer las claves de alumnos y profesores desde sus fichas para que también las definan de nuevo. No hace falta eliminar las cuentas viejas de Firebase Auth: esta versión no las consulta. Un documento con `contrasenaActiva: true` pero sin `passwordHash`/`passwordSalt` requiere blanqueo. Los exámenes y notas existentes permanecen vinculados por legajo.

## Administración y blanqueo de claves

Las pantallas de edición permiten modificar nombre, apellido, cursos del alumno, materia, comisiones y profesor responsable. La baja conserva el documento en `users` y marca `activo: false`; la sesión abierta se cierra al recibir el cambio. Si el profesor aún está a cargo de un curso, hay que reasignarlo antes de darle de baja; tampoco se mueve ni se da de baja a un alumno con un intento en curso.

El blanqueo elimina `passwordHash` y `passwordSalt`, marca `contrasenaActiva: false` y permite definir una clave nueva desde «Es mi primer ingreso». Las operaciones registran el legajo declarado del administrador en `auditoria`. Ya no dependen de Cloud Functions ni requieren el plan Blaze. Los archivos antiguos de `functions/` quedan como referencia, pero `firebase.json` no los despliega.

## Rendición de exámenes

La colección `examenesEntregados` se crea al comenzar el primer examen. Cada intento usa el ID `<examenId>_<legajo>` para impedir que el mismo alumno genere otro intento cambiando de tema. Contiene una copia de las preguntas y del tema, respuestas de texto, tiempos, estado de entrega/corrección, incidentes y nota pendiente. El alumno sólo puede iniciar un examen de un código presente en `users.cursosActivos`, desde `fechaInicio` hasta `fechaInicio + toleranciaMinutos`.

Durante la rendición, las respuestas se guardan cada 10 segundos en Firestore y en un respaldo local cifrado con Web Crypto e IndexedDB. El examen termina a `fechaInicio + duracionMinutos` (120 minutos en los nuevos exámenes), para todos los alumnos; quien ingresa durante la tolerancia dispone de menos tiempo. El temporizador depende de `fechaLimite` persistida, por lo que recargar la página no lo reinicia. Si una entrega no llega al servidor, el respaldo local permite reintentar desde `alumno/misExamenes` en ese mismo navegador y dispositivo. La corrección y la nota quedan pendientes de la intervención del profesor.

En el panel del profesor, `En curso` y `Finalizado` se calculan desde la fecha y duración al visualizar el examen, incluso si nadie dejó el panel abierto al producirse el cambio de hora. Al editar la fecha antes del inicio, el documento se guarda como `reprogramado`; durante y después del examen no se permite editar. Los cambios automáticos por horario no escriben `examenes.estado` en Firestore: para persistirlos sin clientes conectados se necesita un proceso programado del lado del servidor. La misma restricción temporal debe aplicarse en reglas o backend para impedir clientes modificados.

La colección no necesita crearse manualmente, pero sin reglas compatibles las operaciones serán rechazadas. No se modifican reglas ni se despliegan cambios de Firebase desde este proyecto.

## Seguridad pendiente para producción

**Este modo sólo es apto para una demo sin datos personales ni académicos reales.** Sin Firebase Auth, Firestore ve todas las solicitudes como anónimas; las reglas no pueden distinguir administrador, profesor y alumno. Para que funcionen el login, las altas, el blanqueo y los exámenes desde el navegador, las reglas tendrán que permitir lecturas y escrituras anónimas en las colecciones usadas. Cualquier persona con la configuración pública de Firebase podría leer los hashes, alterar roles, activar legajos o modificar notas; el hash y la validación de rol de React no impiden eso. La sesión en `localStorage` tampoco es una credencial verificable. No publicar este prototipo con datos reales ni presentar el login como seguro. Para producción, recuperar Firebase Auth u otro backend confiable y aplicar reglas por identidad.

La pantalla completa y `visibilitychange` ofrecen avisos en una web, pero no bloquean el sistema operativo ni garantizan prevención de trampas. Para un examen de alta seguridad hacen falta un cliente kiosk nativo y validaciones del intento, temporizador y permisos en un backend confiable. La inscripción por comisión requiere un dato adicional en `users`: hoy `cursosActivos` sólo permite comprobar el código de curso.
