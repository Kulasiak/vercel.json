/**
 * Generatore di codici QR — JavaScript puro, nessuna dipendenza.
 *
 * Implementa ISO/IEC 18004: codifica byte (UTF-8), correzione d'errore
 * Reed-Solomon, scelta automatica della versione e della maschera migliore.
 * Usato da build.mjs per produrre gli SVG dei due QR (menu e sito) a
 * tempo di compilazione: le pagine pubblicate non caricano alcuno script.
 *
 *   import { qrSvg } from "./qr.mjs";
 *   const svg = qrSvg("https://esempio.it/menu/", { ecl: "H" });
 */

/* ------------------------------------------------------------ tabelle ISO */

// Codeword di correzione per blocco, indicizzate [livello][versione].
const ECC_CODEWORDS_PER_BLOCK = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

// Numero di blocchi di correzione, indicizzati [livello][versione].
const NUM_ERROR_CORRECTION_BLOCKS = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

const ECL_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

const MIN_VERSION = 1;
const MAX_VERSION = 40;

/* ------------------------------------------------------ campo di Galois */

/** Moltiplicazione in GF(2^8) con polinomio primitivo 0x11D. */
function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/** Coefficienti del polinomio generatore di grado `degree`. */
function reedSolomonDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

/** Resto della divisione polinomiale: sono le codeword di correzione. */
function reedSolomonRemainder(data, divisor) {
  const result = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < result.length; i++) result[i] ^= gfMultiply(divisor[i], factor);
  }
  return result;
}

/* ------------------------------------------------- capacita e geometria */

/** Moduli disponibili per i dati, esclusi i pattern di servizio. */
function numRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

/** Codeword di dati effettivamente utilizzabili. */
function numDataCodewords(ver, ecl) {
  return (
    Math.floor(numRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver]
  );
}

/** Coordinate dei pattern di allineamento per la versione data. */
function alignmentPatternPositions(ver) {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = ver * 4 + 17 - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

/* --------------------------------------------------------------- bitstream */

class BitBuffer {
  constructor() { this.bits = []; }
  append(value, length) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
}

/* ------------------------------------------------------------- costruzione */

class QrCode {
  constructor(version, ecl, dataCodewords, forcedMask = -1) {
    this.version = version;
    this.ecl = ecl;
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array(this.size).fill(false));

    this.#drawFunctionPatterns();
    this.#drawCodewords(this.#addEccAndInterleave(dataCodewords));

    // La maschera migliore e quella con il punteggio di penalita piu basso.
    let mask = forcedMask;
    if (mask === -1) {
      let minPenalty = Infinity;
      for (let i = 0; i < 8; i++) {
        this.#applyMask(i);
        this.#drawFormatBits(i);
        const penalty = this.#penaltyScore();
        if (penalty < minPenalty) { mask = i; minPenalty = penalty; }
        this.#applyMask(i); // xor: annulla
      }
    }
    this.mask = mask;
    this.#applyMask(mask);
    this.#drawFormatBits(mask);
  }

  get(x, y) { return this.modules[y][x]; }

  #setFunction(x, y, isDark) {
    this.modules[y][x] = isDark;
    this.isFunction[y][x] = true;
  }

  #drawFunctionPatterns() {
    const size = this.size;
    for (let i = 0; i < size; i++) {
      this.#setFunction(6, i, i % 2 === 0);
      this.#setFunction(i, 6, i % 2 === 0);
    }
    this.#drawFinderPattern(3, 3);
    this.#drawFinderPattern(size - 4, 3);
    this.#drawFinderPattern(3, size - 4);

    const align = alignmentPatternPositions(this.version);
    for (let i = 0; i < align.length; i++) {
      for (let j = 0; j < align.length; j++) {
        const corner = (i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0);
        if (!corner) this.#drawAlignmentPattern(align[i], align[j]);
      }
    }
    this.#drawFormatBits(0); // segnaposto: riscritto con la maschera scelta
    this.#drawVersion();
  }

  #drawFinderPattern(cx, cy) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
          this.#setFunction(x, y, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  #drawAlignmentPattern(cx, cy) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.#setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  #drawFormatBits(mask) {
    const data = (ECL_FORMAT_BITS[this.ecl] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;

    const bit = (i) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) this.#setFunction(8, i, bit(i));
    this.#setFunction(8, 7, bit(6));
    this.#setFunction(8, 8, bit(7));
    this.#setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.#setFunction(14 - i, 8, bit(i));

    for (let i = 0; i < 8; i++) this.#setFunction(this.size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.#setFunction(8, this.size - 15 + i, bit(i));
    this.#setFunction(8, this.size - 8, true); // modulo scuro fisso
  }

  #drawVersion() {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.#setFunction(a, b, bit);
      this.#setFunction(b, a, bit);
    }
  }

  /** Divide in blocchi, calcola la correzione d'errore e interlaccia. */
  #addEccAndInterleave(data) {
    const ver = this.version, ecl = this.ecl;
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][ver];
    const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);

    // Ogni blocco occupa shortBlockLen + 1 celle: i dati in testa, la
    // correzione in coda. Nei blocchi corti resta un buco fra le due parti,
    // che l'interlacciamento salta.
    const blocks = [];
    const divisor = reedSolomonDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const len = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
      const dat = data.slice(k, k + len);
      k += len;
      const ecc = reedSolomonRemainder(dat, divisor);
      const block = new Array(shortBlockLen + 1).fill(0);
      for (let x = 0; x < dat.length; x++) block[x] = dat[x];
      for (let x = 0; x < ecc.length; x++) block[block.length - ecc.length + x] = ecc[x];
      blocks.push(block);
    }

    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      for (let j = 0; j < numBlocks; j++) {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(blocks[j][i]);
      }
    }
    return result;
  }

  /** Percorso a zig-zag dal basso a destra verso l'alto a sinistra. */
  #drawCodewords(data) {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // la colonna 6 e il timing pattern
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  }

  #applyMask(mask) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.isFunction[y][x]) continue;
        let invert;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: throw new Error("maschera non valida");
        }
        this.modules[y][x] = this.modules[y][x] !== invert;
      }
    }
  }

  /** Le quattro regole di penalita dello standard. */
  #penaltyScore() {
    const size = this.size;
    let result = 0;

    // Regola 1: sequenze di 5 o piu moduli uguali, in riga e in colonna.
    for (let y = 0; y < size; y++) {
      let runColor = false, runX = 0;
      const runHistory = new Array(7).fill(0);
      for (let x = 0; x < size; x++) {
        if (this.modules[y][x] === runColor) {
          runX++;
          if (runX === 5) result += 3;
          else if (runX > 5) result++;
        } else {
          this.#finderPenaltyAddHistory(runX, runHistory);
          if (!runColor) result += this.#finderPenaltyCountPatterns(runHistory) * 40;
          runColor = this.modules[y][x];
          runX = 1;
        }
      }
      result += this.#finderPenaltyTerminateAndCount(runColor, runX, runHistory) * 40;
    }
    for (let x = 0; x < size; x++) {
      let runColor = false, runY = 0;
      const runHistory = new Array(7).fill(0);
      for (let y = 0; y < size; y++) {
        if (this.modules[y][x] === runColor) {
          runY++;
          if (runY === 5) result += 3;
          else if (runY > 5) result++;
        } else {
          this.#finderPenaltyAddHistory(runY, runHistory);
          if (!runColor) result += this.#finderPenaltyCountPatterns(runHistory) * 40;
          runColor = this.modules[y][x];
          runY = 1;
        }
      }
      result += this.#finderPenaltyTerminateAndCount(runColor, runY, runHistory) * 40;
    }

    // Regola 2: blocchi 2x2 dello stesso colore.
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = this.modules[y][x];
        if (c === this.modules[y][x + 1] && c === this.modules[y + 1][x] && c === this.modules[y + 1][x + 1]) {
          result += 3;
        }
      }
    }

    // Regola 4: sbilanciamento tra moduli chiari e scuri.
    let dark = 0;
    for (const row of this.modules) for (const cell of row) if (cell) dark++;
    const total = size * size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * 10;
    return result;
  }

  #finderPenaltyCountPatterns(runHistory) {
    const n = runHistory[1];
    const core = n > 0 && runHistory[2] === n && runHistory[3] === n * 3 && runHistory[4] === n && runHistory[5] === n;
    return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) +
           (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
  }

  #finderPenaltyTerminateAndCount(currentRunColor, currentRunLength, runHistory) {
    let len = currentRunLength;
    if (currentRunColor) {
      this.#finderPenaltyAddHistory(len, runHistory);
      len = 0;
    }
    len += this.size; // margine bianco virtuale
    this.#finderPenaltyAddHistory(len, runHistory);
    return this.#finderPenaltyCountPatterns(runHistory);
  }

  #finderPenaltyAddHistory(currentRunLength, runHistory) {
    if (runHistory[0] === 0) currentRunLength += this.size; // margine bianco virtuale
    runHistory.pop();
    runHistory.unshift(currentRunLength);
  }
}

/* ------------------------------------------------------------- API pubblica */

/** Costruisce la matrice del QR per il testo dato. */
export function qrMatrix(text, { ecl = "M", minVersion = MIN_VERSION, maxVersion = MAX_VERSION, boost = true } = {}) {
  if (!ECL_FORMAT_BITS.hasOwnProperty(ecl)) throw new Error(`Livello di correzione non valido: ${ecl}`);
  const bytes = Array.from(new TextEncoder().encode(String(text)));

  // Versione piu piccola che contiene i dati.
  let version = minVersion;
  for (; ; version++) {
    if (version > maxVersion) throw new Error("Testo troppo lungo per un codice QR");
    const capacityBits = numDataCodewords(version, ecl) * 8;
    const charCountBits = version < 10 ? 8 : 16;
    if (4 + charCountBits + bytes.length * 8 <= capacityBits) break;
  }

  // A parita di versione, alza il livello di correzione se i dati ci stanno lo stesso.
  let level = ecl;
  if (boost) {
    for (const candidate of ["M", "Q", "H"]) {
      const charCountBits = version < 10 ? 8 : 16;
      const needed = 4 + charCountBits + bytes.length * 8;
      if (["L", "M", "Q", "H"].indexOf(candidate) > ["L", "M", "Q", "H"].indexOf(level) &&
          needed <= numDataCodewords(version, candidate) * 8) {
        level = candidate;
      }
    }
  }

  const bb = new BitBuffer();
  bb.append(0b0100, 4);                                   // modalita byte
  bb.append(bytes.length, version < 10 ? 8 : 16);          // lunghezza
  for (const b of bytes) bb.append(b, 8);

  const dataCapacityBits = numDataCodewords(version, level) * 8;
  bb.append(0, Math.min(4, dataCapacityBits - bb.bits.length)); // terminatore
  bb.append(0, (8 - (bb.bits.length % 8)) % 8);                 // allineamento al byte
  for (let pad = 0xec; bb.bits.length < dataCapacityBits; pad ^= 0xec ^ 0x11) bb.append(pad, 8);

  const codewords = [];
  for (let i = 0; i < bb.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bb.bits[i + j];
    codewords.push(byte);
  }

  const qr = new QrCode(version, level, codewords);
  return {
    size: qr.size,
    version: qr.version,
    ecl: qr.ecl,
    mask: qr.mask,
    modules: qr.modules,
    get: (x, y) => qr.get(x, y),
  };
}

/**
 * SVG del codice QR, in un solo path: leggero, nitido a ogni dimensione,
 * stampabile senza perdita di qualita.
 */
export function qrSvg(text, options = {}) {
  const { border = 4, dark = "#111111", light = "#ffffff", radius = 0, label = "" } = options;
  const qr = qrMatrix(text, options);
  const dim = qr.size + border * 2;

  let path = "";
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) path += `M${x + border} ${y + border}h1v1h-1z`;
    }
  }

  const title = label ? `<title>${label.replace(/[<>&]/g, "")}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="${label.replace(/["<>&]/g, "")}">${title}<rect width="${dim}" height="${dim}" fill="${light}"${radius ? ` rx="${radius}"` : ""}/><path d="${path}" fill="${dark}"/></svg>`;
}

export { numDataCodewords, alignmentPatternPositions };
