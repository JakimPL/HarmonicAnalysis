const POINTS = 1000;

function score(sine1, sine2) {
    const f1 = sine1.frequency;
    const l1 = sine1.amplitude;
    const f2 = sine2.frequency;
    const l2 = sine2.amplitude;

    const x = 0.24
    const s1 = 0.0207
    const s2 = 18.96
    const fmin = Math.min(f1, f2);
    const fmax = Math.max(f1, f2);
    const s = x / (s1 * fmin + s2);
    const p = s * (fmax - fmin);

    const b1 = 3.51;
    const b2 = 5.75;

    const l12 = Math.min(l1, l2);

    return l12 * (Math.exp(-b1 * p) - Math.exp(-b2 * p));
}

class Sine {
    constructor(frequency, amplitude) {
        this.frequency = frequency;
        this.amplitude = amplitude;
    }

    toWave() {
        return new Wave(this.frequency, { 1: this.amplitude });
    }
}

class Wave {
    constructor(frequency, harmonics) {
        this.frequency = frequency;
        this.harmonics = harmonics;
    }

    sine(harmonic) {
        const frequency = this.frequency * harmonic;
        const amplitude = this.harmonics[harmonic] || 0.0;
        return new Sine(frequency, amplitude);
    }
}

function dissonance(wave1, wave2) {
    if (wave1 instanceof Sine && wave2 instanceof Sine) {
        return score(wave1, wave2);
    }

    if (wave1 instanceof Sine) {
        wave1 = wave1.toWave();
    }

    if (wave2 instanceof Sine) {
        wave2 = wave2.toWave();
    }

    let d = 0;
    for (const h1 in wave1.harmonics) {
        for (const h2 in wave2.harmonics) {
            d += score(wave1.sine(h1), wave2.sine(h2));
        }
    }

    return d;
}

function getDissonanceGraph(series, baseFrequency = BASE_FREQUENCY, points = POINTS) {
    const wave = new Wave(baseFrequency, series);
    const ratios = new Array(points).fill(0).map((_, i) =>
        Math.pow(2, (2.0 * i) / (points - 1))
    );

    const graphFunction = (ratio) => {
        const wave2 = new Wave(baseFrequency * ratio, series);
        return dissonance(wave, wave2);
    };

    const values = ratios.map(graphFunction);
    const maxValue = Math.max(...values);
    const normalizer = maxValue !== 0 ? 1 / maxValue : 1.0;
    const normalizedValues = values.map(v => v * normalizer);

    return {
        ratios: ratios,
        values: normalizedValues,
        function: graphFunction,
        normalizer: normalizer
    };
}

function toneError(harmonic, edo) {
    const f = Math.log2(harmonic) % 1;
    const x = f * edo;
    return Math.pow(x - Math.round(x), 2);
}

function scaleError(edo, series) {
    const maxError = 0.25 * Object.values(series).reduce((a, b) => a + b, 0);

    let totalError = 0.0;
    for (const [harmonic, amplitude] of Object.entries(series)) {
        const error = toneError(harmonic, edo);
        totalError += error * amplitude;
    }

    return Math.sqrt(totalError / maxError);
}

function getLog2Scale(scale) {
    let log2Scale = Array.from(new Set(scale.map(x => ((Math.log2(x) % 1) + 1) % 1)));
    log2Scale.sort((a, b) => a - b);
    if (log2Scale[log2Scale.length - 1] < 1.0 - 1e-8) log2Scale.push(1.0);

    return log2Scale;
}

function distanceToneError(harmonic, log2Scale) {
    const x = ((Math.log2(harmonic) % 1) + 1) % 1;
    let minDiff = Infinity;
    for (let i = 0; i < log2Scale.length; i++) {
        let diff = x - log2Scale[i];
        minDiff = Math.min(minDiff, diff * diff);
    }

    return minDiff * log2Scale.length * log2Scale.length;
}

function distanceScaleError(scale, series) {
    const maxError = Object.values(series).reduce((a, b) => a + b, 0);
    const log2Scale = getLog2Scale(scale);

    let totalError = 0.0;
    for (const [harmonic, amplitude] of Object.entries(series)) {
        const error = distanceToneError(harmonic, log2Scale);
        totalError += amplitude * error;
    }

    return Math.sqrt(totalError / maxError);
}

