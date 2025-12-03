export class Random {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  next() {
    return (this.seed = (this.seed * 16807) % 2147483647);
  }
  nextFloat() {
    return (this.next() - 1) / 2147483646;
  }
}

export function sampleUniform(random, min, max) {
  return random.nextFloat() * (max - min) + min;
}
