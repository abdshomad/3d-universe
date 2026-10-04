/**
 * Units for a scene that spans metres to gigaparsecs.
 *
 * Everything public is float64 in world metres. Only values handed to the GPU
 * are float32, and only after the floating origin has brought them near zero.
 */

export const METRES_PER_PC = 3.0856775814913673e16;
export const PC_PER_METRE = 1 / METRES_PER_PC;
export const METRES_PER_AU = 1.495978707e11;
export const PC_PER_AU = METRES_PER_AU * PC_PER_METRE;

/** Largest magnitude a float32 can hold. Scene cells must stay well inside it. */
export const F32_MAX = 3.4028234663852886e38;

/** Float32 has ~7 decimal digits: past this magnitude, metres stop being meaningful. */
export const F32_SAFE_METRES = 1e7;

export const pcToMetres = (pc) => pc * METRES_PER_PC;
export const metresToPc = (metres) => metres * PC_PER_METRE;
export const auToMetres = (au) => au * METRES_PER_AU;

export function formatScale(metres) {
  if (metres < 1e3) return `${metres.toFixed(1)} m`;
  if (metres < METRES_PER_AU) return `${(metres / 1e3).toFixed(1)} km`;
  if (metres < METRES_PER_PC) return `${(metres / METRES_PER_AU).toFixed(2)} AU`;
  return `${metresToPc(metres).toFixed(2)} pc`;
}