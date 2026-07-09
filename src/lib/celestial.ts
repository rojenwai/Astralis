import * as THREE from "three";

/** J2000 RA/Dec (degrees) → unit direction on the installation's celestial sphere. */
export function raDecToDir(raDeg: number, decDeg: number): THREE.Vector3 {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(dec) * Math.cos(ra),
    Math.sin(dec),
    -Math.cos(dec) * Math.sin(ra),
  );
}

/**
 * Approximate constellation centroids (RA hours, Dec degrees) — nearest-center lookup.
 * Art-grade accuracy: correct for panel copy, not for astrometry.
 */
const CONSTELLATIONS: [string, number, number][] = [
  ["Andromeda", 0.8, 37], ["Antlia", 10.3, -32], ["Apus", 16.0, -75],
  ["Aquarius", 22.3, -10], ["Aquila", 19.7, 3], ["Ara", 17.4, -56],
  ["Aries", 2.6, 20], ["Auriga", 6.0, 42], ["Boötes", 14.7, 31],
  ["Caelum", 4.7, -38], ["Camelopardalis", 6.0, 69], ["Cancer", 8.6, 20],
  ["Canes Venatici", 13.0, 40], ["Canis Major", 6.8, -22], ["Canis Minor", 7.6, 6],
  ["Capricornus", 21.0, -18], ["Carina", 8.7, -60], ["Cassiopeia", 1.0, 62],
  ["Centaurus", 13.0, -47], ["Cepheus", 22.0, 71], ["Cetus", 1.7, -7],
  ["Chamaeleon", 10.7, -79], ["Circinus", 14.6, -63], ["Columba", 5.8, -35],
  ["Coma Berenices", 12.8, 23], ["Corona Australis", 18.6, -41], ["Corona Borealis", 15.8, 33],
  ["Corvus", 12.4, -18], ["Crater", 11.4, -15], ["Crux", 12.4, -60],
  ["Cygnus", 20.6, 42], ["Delphinus", 20.7, 12], ["Dorado", 5.2, -59],
  ["Draco", 17.0, 65], ["Equuleus", 21.2, 8], ["Eridanus", 3.3, -28],
  ["Fornax", 2.8, -31], ["Gemini", 7.0, 23], ["Grus", 22.5, -46],
  ["Hercules", 17.4, 27], ["Horologium", 3.3, -53], ["Hydra", 11.6, -14],
  ["Hydrus", 2.3, -70], ["Indus", 21.3, -60], ["Lacerta", 22.5, 46],
  ["Leo", 10.7, 13], ["Leo Minor", 10.2, 32], ["Lepus", 5.6, -19],
  ["Libra", 15.2, -15], ["Lupus", 15.2, -42], ["Lynx", 8.0, 47],
  ["Lyra", 18.9, 37], ["Mensa", 5.4, -77], ["Microscopium", 20.9, -36],
  ["Monoceros", 7.0, -3], ["Musca", 12.6, -70], ["Norma", 15.9, -51],
  ["Octans", 21.0, -82], ["Ophiuchus", 17.2, -8], ["Orion", 5.6, 6],
  ["Pavo", 19.6, -65], ["Pegasus", 22.7, 19], ["Perseus", 3.2, 45],
  ["Phoenix", 0.9, -48], ["Pictor", 5.7, -53], ["Pisces", 0.5, 14],
  ["Piscis Austrinus", 22.3, -30], ["Puppis", 7.3, -31], ["Pyxis", 8.9, -27],
  ["Reticulum", 3.9, -60], ["Sagitta", 19.7, 19], ["Sagittarius", 19.1, -28],
  ["Scorpius", 16.9, -27], ["Sculptor", 0.4, -32], ["Scutum", 18.7, -10],
  ["Serpens", 15.6, 10], ["Sextans", 10.3, -2], ["Taurus", 4.7, 15],
  ["Telescopium", 19.3, -51], ["Triangulum", 2.2, 31], ["Triangulum Australe", 16.1, -65],
  ["Tucana", 23.8, -66], ["Ursa Major", 11.3, 51], ["Ursa Minor", 15.0, 78],
  ["Vela", 9.6, -47], ["Virgo", 13.4, -4], ["Volans", 7.8, -69],
  ["Vulpecula", 20.2, 24],
];

const CONSTELLATION_DIRS = CONSTELLATIONS.map(([name, raH, dec]) => ({
  name,
  dir: raDecToDir(raH * 15, dec),
}));

export function constellationOf(raDeg: number, decDeg: number): string {
  const d = raDecToDir(raDeg, decDeg);
  let best = "";
  let bestDot = -2;
  for (const c of CONSTELLATION_DIRS) {
    const dot = d.dot(c.dir);
    if (dot > bestDot) {
      bestDot = dot;
      best = c.name;
    }
  }
  return best;
}
