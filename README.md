# CeroClawd

Workspace operativo para freelancers que ejecutan más y coordinan menos.

Orquestá agentes de IA especializados desde la terminal — sin suscripciones, sin API keys, sin costos por token.

→ [cli.ceroclawd.com](https://cli.ceroclawd.com)

---

## Instalación

```bash
npm install -g ceroclawd
```

Requiere Node.js 20+

---

## Uso

```bash
ceroclawd
```

Al iniciarlo, el orquestador principal analiza tu tarea y la delega a los agentes correspondientes: `backend`, `frontend`, `qa`, u otros según el contexto.

Para cambiar de modelo durante una sesión:

```
/model
```

Muestra los modelos disponibles en tu Ollama local y te deja elegir con cuál continuar.

---

## Agentes y orquestación

CeroClawd funciona con un sistema multi-agente donde cada agente tiene un rol definido:

| Agente | Rol |
|--------|-----|
| `main` | Lead orchestrator — analiza, planifica y delega |
| `backend` | APIs, bases de datos, integraciones, servidores |
| `frontend` | React, UI, estilos, componentes |
| `qa` | Tests, auditorías, detección de bugs |

Los agentes se comunican entre sí y pueden trabajar en paralelo. El agente `main` coordina el flujo completo antes de darte una respuesta.

---

## Modelos y tool calling

CeroClawd está optimizado para modelos con soporte de **tool calling** — la capacidad de ejecutar herramientas reales (leer archivos, correr comandos, hacer requests) durante la conversación.

Los modelos disponibles en `/model` son los que tengas descargados en Ollama. CeroClawd los detecta automáticamente desde `localhost:11434`.

### Modelos recomendados

| Modelo | Tamaño | Ideal para |
|--------|--------|------------|
| `qwen3:8b` | ~5 GB | Uso diario, buena velocidad |
| `qwen3:14b` | ~9 GB | Tareas más complejas |
| `qwen3:32b` | ~20 GB | Máxima capacidad, hardware potente |

Qwen3 es el modelo open-source con mejor desempeño en tareas de agentes y tool calling.

---

## Setup con Ollama

```bash
# 1. Instalar Ollama
# https://ollama.com

# 2. Descargar un modelo con soporte de tool calling
ollama pull qwen3:8b

# 3. Iniciar CeroClawd (Ollama debe estar corriendo)
ceroclawd
```

Sin API keys. Sin suscripciones. Sin factura al final del mes.

---

## Licencia

Apache-2.0
