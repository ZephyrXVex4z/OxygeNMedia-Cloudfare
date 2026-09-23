// gemini-config.js

export const GEMINI_API_KEY = "AQ.Ab8RN6IF_SQuOG6n96hnhJ4yyQpfnvbvcPB0D-y2rI-3SAe4nw";

// Modelo principal para producción.
// 3.5 Flash = buena calidad + velocidad.
// Para máxima economía puedes cambiarlo por:
// "gemini-3.1-flash-lite"
export const MODELO = "gemini-3.5-flash";

// Si quieres forzar otro modelo:
// export const MODELO = "gemini-3.1-flash-lite";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_REINTENTOS = 3;

const esperar = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

async function generar(body, modelo = MODELO) {
  const url =
    `${ENDPOINT}/${modelo}:generateContent?key=${GEMINI_API_KEY}`;

  let ultimoError = null;

  for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
    try {
      const respuesta = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (respuesta.ok) {
        return await respuesta.json();
      }

      // Errores temporales
      if (
        respuesta.status === 408 ||
        respuesta.status === 429 ||
        respuesta.status >= 500
      ) {
        const texto = await respuesta.text().catch(() => "");

        ultimoError = `${respuesta.status}: ${texto}`;

        // Backoff exponencial + pequeño jitter
        const espera =
          Math.min(8000, 1000 * 2 ** intento) +
          Math.random() * 500;

        if (intento < MAX_REINTENTOS - 1) {
          await esperar(espera);
          continue;
        }
      }

      // Errores permanentes
      const detalle = await respuesta.text().catch(() => "");

      throw new Error(
        `Gemini ${respuesta.status}: ${detalle.slice(0, 300)}`
      );

    } catch (error) {
      ultimoError = error;

      // Si es un error de red, reintentar
      if (intento < MAX_REINTENTOS - 1) {
        const espera =
          Math.min(8000, 1000 * 2 ** intento) +
          Math.random() * 500;

        await esperar(espera);
      }
    }
  }

  throw new Error(
    `Gemini no respondió después de ${MAX_REINTENTOS} intentos. ` +
    String(ultimoError)
  );
}


export async function llamarGemini(
  contenidos,
  {
    maxOutputTokens = 8192,
    systemInstruction = null,
    thinkingLevel = "minimal"
  } = {}
) {

  const body = {
    contents: contenidos,

    generationConfig: {
      maxOutputTokens,
      thinkingConfig: {
        thinkingLevel
      }
    }
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [
        {
          text: systemInstruction
        }
      ]
    };
  }

  const data = await generar(body);

  const candidato = data.candidates?.[0];

  const texto = candidato?.content?.parts
    ?.map(part => part.text || "")
    .join("")
    .trim();

  const finishReason = candidato?.finishReason;

  console.log(
    "[Gemini]",
    "modelo:", MODELO,
    "finishReason:", finishReason
  );

  if (!texto) {
    throw new Error(
      finishReason
        ? `Gemini no generó respuesta. Motivo: ${finishReason}`
        : "Gemini no devolvió contenido."
    );
  }

  return texto;
}