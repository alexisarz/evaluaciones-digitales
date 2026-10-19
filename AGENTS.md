# Reglas de arquitectura del proyecto

- Usar Redux Toolkit y React-Redux para el estado compartido de la aplicación. Registrar cada dominio nuevo en `src/app/store.js`.
- Definir cambios de estado (mutaciones) en reducers/slices de `src/features/<dominio>/`; no mutar el store desde componentes.
- Ejecutar operaciones asíncronas de Firebase mediante servicios y acciones/thunks. Las suscripciones externas deben despachar acciones y limpiarse al desmontar.
- Leer datos derivados mediante selectores reutilizables y memoizados cuando devuelvan arrays u objetos. No persistir contadores o estados derivados que puedan calcularse.
- Mantener el store serializable: convertir `Timestamp`/`Date` de Firestore a strings ISO antes de despachar. No guardar instancias de Firebase, archivos, callbacks ni objetos del navegador.
- Conservar el estado transitorio de formularios, modales y cronómetros en hooks locales cuando no se comparte entre vistas. El estado de rendición con autoguardado debe mantenerse encapsulado y probarse antes de moverlo.
- Extraer componentes de interfaz reutilizables a `src/shared/components/` y lógica específica de dominio a `src/features/<dominio>/`. Evitar duplicar UI y reglas de negocio.
- Al cambiar lógica de estado, añadir o actualizar pruebas y ejecutar `npm run test:unit`, `npm run test:e2e` cuando aplique, `npm run lint` y `npm run build`.
