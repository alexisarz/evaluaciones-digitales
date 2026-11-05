# Estrategia de pruebas

## Objetivo

Detectar errores en los flujos que pueden impedir el acceso, perder una entrega o alterar una nota. Las pruebas de caja blanca se diseñan conociendo las decisiones del código: condiciones, límites, transiciones de estado y errores. Un test que sólo repite una línea de la implementación no aporta cobertura útil.

## Organización

```text
tests/
  unit/          Reglas puras, selectores y reducers, agrupados por dominio.
  integration/   Flujos entre servicios y estado con Firestore o IndexedDB simulados.
  e2e/           Interacciones reales en el navegador con Playwright.
  fixtures/      Datos de ejemplo compartidos entre pruebas.
  mocks/         Sustitutos de dependencias externas.
```

La aplicación sigue en `src/`. Los tests de servicios no usan el proyecto Firebase real ni credenciales de alumnos. Los dobles en memoria permiten comprobar escrituras, rechazos y reintentos sin modificar datos reales. Las pruebas de navegador existentes cubren la pantalla de login; los recorridos con Firebase real requieren un entorno de pruebas separado y datos controlados.

## Prioridades de caja blanca

1. **Acceso:** activación, contraseña incorrecta, blanqueo, cuenta inactiva y sesión restaurada.
2. **Rendición:** ventana horaria, CLOCK IN único, tema bloqueado, tiempo límite y cierre forzado.
3. **Resiliencia:** autoguardado remoto, respaldo local cifrado, recuperación y entrega repetida sin duplicados.
4. **Corrección:** propiedad del examen, puntajes límite, borrador, publicación y visibilidad de la nota.
5. **Administración:** legajos duplicados, cursos válidos, baja, bloqueo por examen en curso y errores por fila del CSV.

Para cada cambio de lógica, agregar un caso válido, uno inválido y los límites que correspondan. Preferir comprobar resultados observables (documentos, estado y errores) a comprobar detalles internos como la cantidad exacta de llamadas a una función auxiliar. Mantener los tests deterministas: fijar el reloj cuando intervienen fechas y aislar la base simulada entre casos.

## Cobertura

`npm run test:coverage` mide líneas, ramas, funciones y sentencias del código `src/**/*.{js,jsx}`, excepto los archivos de arranque `src/main.jsx` y `src/firebase.js`. Genera un resumen en consola, `coverage/coverage-summary.json` y el informe visual `coverage/index.html`. La carpeta `coverage/` no se versiona.

Línea base medida el 03/11/2026, después de iniciar esta estrategia: **96 pruebas aprobadas en 20 archivos; 40,08 % de líneas y 27,11 % de ramas globales**. El cálculo incluye las pantallas React que todavía no tienen tests de componente, por lo que ese porcentaje global no equivale a cobertura de los flujos de negocio. Las pruebas Playwright tampoco suman a la cobertura de Vitest.

El archivo `vitest.config.js` fija mínimos por archivo para las reglas y servicios críticos que ya están cubiertos. Estos mínimos impiden perder cobertura al modificar esa lógica. La meta de mejora es alcanzar al menos **80 % de líneas y ramas en cada flujo crítico**, empezando por las ramas de administración, intentos y respaldo local, y después añadir pruebas de componentes para elevar la cobertura global. No se declara cumplida esa meta mientras los porcentajes medidos no la respalden.

## Comandos

```bash
npm run test:unit          # Reglas y estado Redux
npm run test:integration   # Flujos con persistencia simulada
npm run test:all           # Ambas suites
npm run test:coverage      # Ambas suites con umbrales e informe
npm run test:e2e           # Navegador real: Playwright
npm run lint
npm run build
```

Antes de integrar un cambio de lógica, ejecutar las suites afectadas y `npm run test:coverage`. Ejecutar Playwright si cambia el comportamiento visible del login o del flujo cubierto por una prueba de navegador.
