<div align="center">

# 🏍️ Roberto de Frutos Jiménez — Portfolio 3D

### Experiencia web narrativa dirigida por scroll, con Angular + Three.js + GSAP

[![Angular](https://img.shields.io/badge/Angular-20-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.166-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![GSAP](https://img.shields.io/badge/GSAP-3.12-88CE02?style=for-the-badge&logo=greensock&logoColor=white)](https://gsap.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## Qué es

Un personaje 3D acompaña al visitante a lo largo de la página. El scroll es
**nativo**: no hay `pin`, ni saltos, ni bloqueo del navegador en ningún momento.

El recorrido, en orden:

1. **Hero** — el personaje espera de pie, en Idle.
2. **Sobre mí** — se va caminando por la izquierda y entra la moto, con él montado.
3. **Experiencia** — vuelve caminando y se sienta en el escritorio.
4. **Tecnologías** — la cámara se abre sobre el puesto; al pulsar una tecnología, su
   color tiñe la página entera y su código aparece en la pantalla del portátil.
5. **Proyectos / Contacto** — la cámara cierra sobre él mientras teclea.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Angular 20, componentes standalone y signals |
| 3D / WebGL | Three.js — `GLTFLoader`, `DRACOLoader`, `AnimationMixer`, `BokehPass` |
| Scroll | GSAP + `ScrollTrigger` |
| i18n | ngx-translate, con los textos en `assets/i18n/*.json` |
| Estilos | SCSS con tokens de diseño y tema claro/oscuro |

## Puesta en marcha

```bash
npm install
npm start          # http://localhost:4200
npm run build      # build de producción en dist/
```

## Arquitectura

```
src/
 ├── app/
 │   ├── components/          una carpeta por sección + navbar, loader y selectores
 │   │
 │   ├── three/
 │   │   ├── narrative.config.ts      todos los números del narrativo, en un sitio
 │   │   ├── character-timeline.ts    funciones PURAS de progress -> estado
 │   │   ├── scroll-progress.service  única fuente del scroll, normalizado [0,1]
 │   │   ├── animation.service.ts     orquestador: scroll -> timeline -> escena
 │   │   ├── three-scene.service.ts   renderer, luces, postprocesado, render loop
 │   │   ├── model-loader.service.ts  carga de GLB + personaje suplente
 │   │   ├── camera.service.ts        cámara y corrección de encuadre por aspecto
 │   │   ├── desk-setup.ts            mesa, silla y MacBook, construidos por código
 │   │   ├── code-screen.ts           editor pintado en canvas para la pantalla
 │   │   ├── motorbike-prop.ts        moto: presencia por scroll, giro por ratón
 │   │   ├── motorcycle-rider.ts      pose del jinete, resuelta con IK
 │   │   └── ik.ts                    IK analítica de dos huesos
 │   │
 │   └── shared/              idioma, tema, acento, catálogo de tecnologías
 │
 └── assets/
     ├── models/     roberto.glb (personaje) y motorbike.glb
     ├── draco/      decodificador Draco, autoalojado
     ├── fonts/      woff2 autoalojadas
     └── i18n/       es.json y en.json
```

Todo el WebGL vive en `app/three/*`. Ningún componente de sección toca Three.js.

## Cómo funciona el narrativo

`ScrollProgressService` expone un único `progress` en `[0,1]`, con un solo
`ScrollTrigger` y un solo listener. `character-timeline.ts` lo convierte en
posición, rotación, mezcla de animaciones y cámara mediante **funciones puras**:
sin estado interno ni acumuladores, el mismo `progress` da siempre el mismo
resultado.

De ahí sale que subir el scroll deshaga el recorrido exactamente: no es una
animación de vuelta, es la misma función evaluada al revés.

`AnimationService` es el único punto que conoce a la vez el scroll, el timeline
y la escena, y todo corre en un único `requestAnimationFrame` fuera de la zona
de Angular.

## Añadir o cambiar el modelo 3D

1. Exporta en `.glb` y déjalo en `src/assets/models/roberto.glb`.
2. Nombra los `AnimationClips` con alguna de estas palabras clave:

| Estado | Palabras clave |
|---|---|
| `Idle` | `idle`, `breathing`, `stand_idle` |
| `Walking` | `walk`, `walking`, `run` |
| `Typing` | `typ`, `keyboard`, `work` |
| `Looking` | `look`, `turn`, `greet` |
| `Standing` | `standing`, `stand`, `pose`, `presentation` |
| `Motorcycle` | `motor`, `bike`, `ride` |

3. El jinete de la moto necesita los huesos de Mixamo con sus nombres
   (`mixamorigHips`, `mixamorigLeftArm`…). Si faltan, la moto sale sola.

Si el modelo llega sin cargar, entra un personaje suplente procedural que
responde al scroll igual que el real.

**Comprime siempre los modelos antes de subirlos.** Sin comprimir, `motorbike.glb`
pesaba 38 MB:

```bash
npm run opt:models
```

## Scripts de generación

Los assets estáticos no se editan a mano, se generan:

```bash
npm run gen:fonts     # descarga las woff2 de Google y escribe fonts.css
npm run gen:og        # imagen de compartir (assets/images/og-cover.jpg)
npm run gen:favicon   # rasteriza favicon.svg a PNG
```

`gen:og` y `gen:favicon` usan Chrome a través de puppeteer-core; la ruta al
navegador está al principio de cada script.

## Rendimiento

- Bundle inicial: ~283 kB transferidos.
- Modelos comprimidos con Draco y texturas WebP a 1024 px.
- Fuentes autoalojadas, solo subconjunto `latin`.
- Sombras, antialiasing y desenfoque de profundidad desactivados por debajo de 768 px.
- `NgZone.runOutsideAngular` en el render loop y en los listeners de scroll;
  todos los componentes en `OnPush`.

## Accesibilidad

- Contraste AA verificado en los dos temas.
- Con `prefers-reduced-motion` se apaga el movimiento que va solo (giro de la
  moto, partículas, parpadeo de la pantalla); el recorrido por scroll se
  mantiene, porque lo controla el propio usuario.
- El menú móvil plegado va `inert`, y las copias del carrusel de proyectos
  `aria-hidden`.
- Si no hay WebGL se avisa y el contenido sigue siendo accesible.

## Despliegue

`dist/roberto-portfolio/browser` es estático. `src/_headers` trae CSP y cabeceras
de caché para Netlify y Cloudflare Pages; en otros hosts hay que traducirlas.

Antes de publicar, cambia `https://robertodfj.com/` por tu dominio real en
`src/index.html` (canonical, Open Graph), `src/robots.txt` y `src/sitemap.xml`.

---

<div align="center">

Hecho por **Roberto de Frutos Jiménez**

</div>
