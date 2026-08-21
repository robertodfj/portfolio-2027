# Cómo añadir el modelo 3D definitivo

Este proyecto funciona out-of-the-box con un **personaje placeholder procedural**
(hecho con primitivas de Three.js) para que puedas revisar toda la experiencia
— hero, cámara, narrativa por scroll, secciones — sin depender del modelo final.

## Pasos para sustituirlo

1. Exporta tu personaje en formato **`.glb`** (GLTF binario). Recomendado:
   Blender → `File > Export > glTF 2.0 (.glb/.gltf)`, formato binario `.glb`.
2. Copia el archivo a:

   ```
   src/assets/models/roberto.glb
   ```

3. No toques nada de código. `ModelLoaderService` (`src/app/three/model-loader.service.ts`)
   intenta cargar automáticamente esa ruta con `GLTFLoader`, y en cuanto detecta
   el archivo deja de usar el placeholder.

## Animaciones esperadas dentro del GLB

Si el `.glb` incluye **AnimationClips**, el sistema los detecta por nombre
(sin distinguir mayúsculas) y los mapea a los estados narrativos. Nombra tus
clips de animación usando alguna de estas palabras clave:

| Estado narrativo | Palabras clave aceptadas en el nombre del clip |
|---|---|
| `Idle`       | `idle`, `breathing`, `stand_idle` |
| `Walking`    | `walk`, `walking`, `run` |
| `Typing`     | `typ`, `keyboard`, `work` |
| `Looking`    | `look`, `turn`, `greet` |
| `Standing`   | `standing`, `stand`, `pose`, `presentation` |
| `Motorcycle` | `motor`, `bike`, `ride` |

Ejemplo válido de nombres de clip: `Idle`, `Walk_Cycle`, `Typing_Loop`,
`Look_Around`, `Standing_Pose`, `Motorcycle_Ride`.

Si tus clips no siguen esta nomenclatura, ajusta el diccionario `CLIP_ALIASES`
en `model-loader.service.ts`, o renómbralos en Blender antes de exportar.

## Recomendaciones de export

- Mantén el modelo por debajo de ~5-8 MB para no penalizar el tiempo de carga.
- Usa texturas comprimidas (`.jpg`/`.webp` embebidas, resolución ≤2K).
- Si el archivo pesa mucho, actívale compresión **Draco** al exportar — el
  loader ya trae `DRACOLoader` configurado y listo para decodificarlo.
- Orienta el personaje mirando hacia `+Z` y colócalo con los pies en `y = 0`
  para que encaje directamente con las posiciones ya calculadas en
  `animation.service.ts`.
