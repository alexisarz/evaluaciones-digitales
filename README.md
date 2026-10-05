# Sistema de Evaluación Digital

Base en React + Vite para exámenes universitarios, con Firebase Authentication y Firestore.

## Ejecutar

```bash
npm install
npm run dev
```

## Autenticación

Los documentos de `users` deben existir antes del primer acceso y usar el legajo como ID. El primer ingreso crea la cuenta Auth con `<legajo>@evaluacionuade.edu.ar` y activa `contrasenaActiva`. Los siguientes accesos verifican nuevamente el perfil, estado `activo` y rol desde Firestore.

## Seguridad pendiente para producción

El flujo de primer acceso necesita poder localizar un legajo antes de autenticarlo. No se debe resolver abriendo la colección `users` a lectura pública. Antes de producción, trasladar esa validación/activación a un endpoint de confianza (por ejemplo, una Cloud Function callable) y aplicar reglas de Firestore que limiten cada usuario a su propio documento.
