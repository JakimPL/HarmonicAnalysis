const SAMPLE_RATE = 44100;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function createWaveform(harmonicSeries) {
    const normalizer = 1.0 / harmonicSeries.reduce((sum, { amplitude }) => sum + amplitude, 0);
    return (time, frequency) => {
        return harmonicSeries.reduce((sum, { harmonic, amplitude }) => {
            return sum + normalizer * amplitude * Math.sin(2 * Math.PI * frequency * harmonic * time);
        }, 0);
    };
}

function applyEnvelope(waveform, duration = 1.0) {
    return (time, frequency) => {
        const amplitude = Math.max(0, 1.0 - time / duration);
        return amplitude * waveform(time, frequency);
    };
}

function combineWaves(wave1, wave2) {
    return (time, frequency) => {
        return 0.5 * (wave1(time, frequency) + wave2(time, frequency));
    };
}

function playSound(waveform, frequency, duration = 2.0) {
    const bufferSize = Math.ceil(SAMPLE_RATE * duration);
    const buffer = audioContext.createBuffer(1, bufferSize, SAMPLE_RATE);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        const time = i / SAMPLE_RATE;
        data[i] = waveform(time, frequency);
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();

    return source;
}
