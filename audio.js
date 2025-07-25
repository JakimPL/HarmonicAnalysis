const SAMPLE_RATE = 44100;

let audioContext = null;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }
    return audioContext;
}

function createWaveform(harmonicSeries) {
    const normalizer = 1.0 / Object.values(harmonicSeries).reduce((sum, amplitude) => sum + amplitude, 0);
    return (time, frequency) => {
        return Object.entries(harmonicSeries).reduce((sum, [harmonic, amplitude]) => {
            return sum + normalizer * amplitude * Math.sin(2 * Math.PI * frequency * harmonic * time);
        }, 0);
    };
}

function applyEnvelope(waveform, duration = 1.0, baseAmplitude = 1.0) {
    return (time, frequency) => {
        const amplitude = baseAmplitude * Math.max(0, 1.0 - time / duration);
        return amplitude * waveform(time, frequency);
    };
}

function combineWaves(wave, ratio, weight = 0.5) {
    return (time, frequency) => {
        return (1 - weight) * wave(time, frequency) + weight * wave(time, frequency * ratio);
    };
}

function playSound(waveform, frequency, duration = 1.0) {
    const context = getAudioContext();
    const bufferSize = Math.ceil(SAMPLE_RATE * duration);
    const buffer = context.createBuffer(1, bufferSize, SAMPLE_RATE);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        const time = i / SAMPLE_RATE;
        data[i] = waveform(time, frequency);
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();

    return source;
}
