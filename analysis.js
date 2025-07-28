const MAX_HARMONICS = 100;
const BASE_FREQUENCY = 220;
const EDO_LIMIT = 10000;
const SOUND_DURATION = 1.0;
const SNAPPING_THRESHOLD = 0.01;

let baseWidth = -1;
let baseHeight = -1;

let width = -1;
let height = -1;
let margins = {};

let harmonics = 32;
let harmonicSeries = {};
let customScale = null;
let customScaleOriginal = null;
let customLog2Scale = null;

const intervals = [
    { ratio: 1, name: "unison" },
    { ratio: 9/8, name: "major second" },
    { ratio: 5/4, name: "major third" },
    { ratio: 4/3, name: "perfect fourth" },
    { ratio: 3/2, name: "perfect fifth" },
    { ratio: 5/3, name: "major sixth" },
    { ratio: 15/8, name: "major seventh" },
    { ratio: 2, name: "octave" }
];


const harmonicsSvg = d3.select("#harmonics")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const dissonanceSvg = d3.select("#dissonance")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const edoErrorSvg = d3.select("#edo-error")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const harmonicCircleSvg = d3.select("#harmonic-circle")
    .append("svg")
    .attr("width", height)
    .attr("height", height);


const minEdoInput = document.getElementById("min-edo-input");
const maxEdoInput = document.getElementById("max-edo-input");
const edoInput = document.getElementById("edo-input");

const urlParams = new URLSearchParams(window.location.search);


function parseURLParameters() {
    parseCustomScale();
    const newHarmonicSeries = parseHarmonicSeries();
    assignHarmonicSeries(newHarmonicSeries);
}

function parseCustomScale() {
    if (urlParams.has("scale")) {
        const scaleStr = urlParams.get("scale");
        if (scaleStr) {
            const scaleArr = cleanCustomScale(scaleStr);
            assignCustomScale(scaleArr);
        }
    }
}

function cleanCustomScale(scaleStr) {
    let scaleArr = [1.0];
    scaleArr = scaleArr.concat(
        scaleStr.split(",")
            .map(Number)
            .filter(x => !isNaN(x) && x !== 0)
            .map(x => 2 ** (((Math.log2(Math.abs(x)) % 1) + 1) % 1))
    );
    const EPS = 1e-8;
    scaleArr = scaleArr.filter(x => x > 0)
        .sort((a, b) => a - b)
        .filter((x, i, arr) => i === 0 || Math.abs(x - arr[i - 1]) > EPS);
    return scaleArr;
}

function assignCustomScale(scaleArr) {
    if (scaleArr.length > 1) {
        customScale = scaleArr;
        customScaleOriginal = scaleArr.slice();
        customLog2Scale = getLog2Scale(scaleArr);
    }
}

function parseHarmonicSeries() {
    const newHarmonicSeries = {};
    urlParams.forEach((value, key) => {
        const harmonic = parseFloat(key);
        const amplitude = parseFloat(value);
        if (!isNaN(harmonic) && !isNaN(amplitude) && harmonic > 0 && amplitude >= 0 && amplitude <= 1) {
            newHarmonicSeries[harmonic] = amplitude;
        }
    });
    return newHarmonicSeries;
}

function assignHarmonicSeries(newHarmonicSeries) {
    if (Object.keys(newHarmonicSeries).length > 0) {
        harmonicSeries = newHarmonicSeries;
    } else {
        if (urlParams.has("harmonics")) {
            const parsedValue = parseInt(urlParams.get("harmonics"));
            if (!isNaN(parsedValue) && parsedValue >= 1) {
                harmonics = Math.min(parsedValue, MAX_HARMONICS);
            }
        }
        for (let i = 1; i <= harmonics; i++) {
            harmonicSeries[i] = 1 / Math.pow(i, 1.5);
        }
    }
}

function updateGraphDimensions() {
    const root = getComputedStyle(document.documentElement);
    const gap = parseInt(root.getPropertyValue('--gap'));
    const paddingX = parseInt(root.getPropertyValue('--padding-x'));
    const paddingY = parseInt(root.getPropertyValue('--padding-y'));
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (vw < vh) {
        baseWidth = vw - 2 * paddingX;
        baseHeight = (vh - 3 * gap - 2 * paddingY) / 4;
    } else {
        baseWidth = (vw - gap - 2 * paddingX) / 2;
        baseHeight = (vh - gap - 2 * paddingY) / 2;
    }

    document.documentElement.style.setProperty('--width', `${baseWidth}px`);
    document.documentElement.style.setProperty('--height', `${baseHeight}px`);
}

function setDimensions() {
    const root = getComputedStyle(document.documentElement);
    width = parseInt(root.getPropertyValue('--width'));
    height = parseInt(root.getPropertyValue('--height'));
    margins = {
        top: parseInt(root.getPropertyValue('--margin-top')),
        right: parseInt(root.getPropertyValue('--margin-right')),
        bottom: parseInt(root.getPropertyValue('--margin-bottom')),
        left: parseInt(root.getPropertyValue('--margin-left'))
    };
}

function sortHarmonicSeries() {
    harmonicSeries = Object.fromEntries(
        Object.entries(harmonicSeries)
            .map(([key, value]) => [parseFloat(key), value])
            .sort(([a], [b]) => a - b)
    );
}

function updateHarmonicSeries() {
    sortHarmonicSeries();

    const maxKey = Math.max(...Object.keys(harmonicSeries).map(Number));

    const x = d3.scaleLinear()
        .range([margins.left, width - margins.right])
        .domain([0, maxKey + 1]);

    const y = d3.scaleLinear()
        .range([height - margins.bottom, margins.top])
        .domain([-0.05, 1]);

    let isDragging = false;
    let isTouchDragging = false;

    const harmonicKeys = Object.keys(harmonicSeries).map(Number).sort((a, b) => a - b);
    let barWidth = 10;
    if (harmonicKeys.length > 1) {
        const distances = harmonicKeys.map((key, i) => {
            if (i === 0) return Infinity;
            return x(harmonicKeys[i]) - x(harmonicKeys[i - 1]);
        });
        barWidth = Math.min(...distances) * 0.8;
    }

    function updateAmplitude(event) {
        let pointer;
        if (event.type && event.type.startsWith('touch')) {
            const touch = event.touches && event.touches[0] ? event.touches[0] : (event.changedTouches && event.changedTouches[0]);
            if (!touch) return;
            const svgRect = harmonicsSvg.node().getBoundingClientRect();
            pointer = [
                touch.clientX - svgRect.left,
                touch.clientY - svgRect.top
            ];
        } else {
            pointer = d3.pointer(event);
        }
        const mouseX = pointer[0];
        const harmonicNumber = x.invert(mouseX);
        const mouseY = pointer[1];
        const newAmplitude = Math.max(0, Math.min(1, y.invert(mouseY)));

        const closestHarmonic = Object.keys(harmonicSeries)
            .map(Number)
            .reduce((a, b) => (Math.abs(b - harmonicNumber) < Math.abs(a - harmonicNumber) ? b : a));

        if (Math.abs(closestHarmonic - harmonicNumber) <= 0.5) {
            if (harmonicSeries.hasOwnProperty(closestHarmonic)) {
                harmonicSeries[closestHarmonic] = newAmplitude;
                harmonicsSvg.selectAll("rect")
                    .data(Object.entries(harmonicSeries))
                    .join("rect")
                    .attr("y", ([_, amplitude]) => Math.min(y(amplitude), y(0)))
                    .attr("height", ([_, amplitude]) => Math.abs(y(amplitude) - y(0)))
                    .attr("fill", ([harmonic, _]) => {
                        const barStart = x(harmonic) - barWidth / 2;
                        const barEnd = x(harmonic) + barWidth / 2;
                        return mouseX >= barStart && mouseX <= barEnd ? "#ff7f0e" : "#1f77b4";
                    });
            }
        }
    }

    harmonicsSvg.selectAll("*").remove();

    harmonicsSvg
        .attr("width", width)
        .attr("height", height);

    harmonicsSvg.selectAll("rect")
        .data(Object.entries(harmonicSeries))
        .join("rect")
        .attr("class", "bar")
        .attr("x", ([harmonic, _]) => x(harmonic) - barWidth / 2)
        .attr("y", ([_, amplitude]) => Math.min(y(amplitude), y(0)))
        .attr("width", barWidth)
        .attr("height", ([_, amplitude]) => Math.abs(y(amplitude) - y(0)))
        .attr("fill", "#1f77b4")
        .on("mouseover", function (event, [harmonic, amplitude]) {
            d3.select(this).attr("fill", "#ff7f0e");
            harmonicsSvg.append("text")
                .attr("class", "hover-label")
                .attr("x", x(harmonic))
                .attr("y", y(amplitude) - 5)
                .attr("text-anchor", "middle")
                .attr("font-size", "10px")
                .text(`H${harmonic}:${amplitude.toFixed(2)}`);
        })
        .on("mouseout", function () {
            d3.select(this).attr("fill", "#1f77b4");
            harmonicsSvg.selectAll(".hover-label").remove();
        });


    harmonicsSvg.on("mousedown", function (event) {
        isDragging = true;
        updateAmplitude(event);
    });

    harmonicsSvg.on("mousemove", function (event) {
        const mouseX = d3.pointer(event)[0];
        const mouseY = d3.pointer(event)[1];

        if (mouseX < margins.left || mouseX > width - margins.right || mouseY < margins.top || mouseY > height - margins.bottom) {
            harmonicsSvg.selectAll("rect").attr("fill", "#1f77b4");
            harmonicsSvg.selectAll(".hover-label").remove();
            return;
        }

        let isOverBar = false;

        harmonicsSvg.selectAll("rect")
            .each(function ([harmonic, amplitude]) {
                const barStart = x(harmonic) - barWidth / 2;
                const barEnd = x(harmonic) + barWidth / 2;

                if (mouseX >= barStart && mouseX <= barEnd) {
                    isOverBar = true;

                    d3.select(this).attr("fill", "#ff7f0e");
                    harmonicsSvg.selectAll(".hover-label").remove();
                    harmonicsSvg.append("text")
                        .attr("class", "hover-label")
                        .attr("x", x(harmonic))
                        .attr("y", y(amplitude) - 5)
                        .attr("text-anchor", "middle")
                        .attr("font-size", "10px")
                        .text(`H${harmonic}:${amplitude.toFixed(2)}`);
                } else {
                    d3.select(this).attr("fill", "#1f77b4");
                }
            });

        if (!isOverBar) {
            harmonicsSvg.selectAll(".hover-label").remove();
        }

        if (isDragging) {
            updateAmplitude(event);
        }
    });

    harmonicsSvg.on("mouseup", function () {
        if (isDragging) {
            isDragging = false;
            updateDissonanceGraph();
            updateEdoError();
            updateHarmonicCircle();
        }
    });

    harmonicsSvg.on("mouseleave", function () {
        if (isDragging) {
            isDragging = false;
            updateDissonanceGraph();
            updateEdoError();
            updateHarmonicCircle();
        }
    });

    harmonicsSvg.on("touchstart", function(event) {
        if (event.cancelable) event.preventDefault();
        isTouchDragging = true;
        updateAmplitude(event);
    }, { passive: false });
    harmonicsSvg.on("touchmove", function(event) {
        if (!isTouchDragging) return;
        if (event.cancelable) event.preventDefault();
        updateAmplitude(event);
    }, { passive: false });
    harmonicsSvg.on("touchend", function(event) {
        if (event.cancelable) event.preventDefault();
        if (isTouchDragging) {
            isTouchDragging = false;
            updateDissonanceGraph();
            updateEdoError();
            updateHarmonicCircle();
        }
    }, { passive: false });

    harmonicsSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${y(0)})`)
        .call(d3.axisBottom(x));

    harmonicsSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${margins.left},0)`)
        .call(d3.axisLeft(y));

    harmonicsSvg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height - 2)
        .attr("text-anchor", "middle")
        .text("harmonic");

    harmonicsSvg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -(height / 2))
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .text("amplitude");
}

function updateDissonanceGraph() {
    const baseFrequency = parseFloat(document.getElementById("base-frequency").value) || 220;
    const edo = parseInt(document.getElementById("edo-input").value) || 12;
    const series = { ...harmonicSeries };
    const graph = getDissonanceGraph(series, baseFrequency);
    const points = graph.ratios.map((ratio, i) => [ratio, graph.values[i]]);

    const x = d3.scaleLog()
        .range([margins.left, width - margins.right])
        .domain([0.99, 2.02]);

    const y = d3.scaleLinear()
        .range([height - margins.bottom, margins.top])
        .domain([-0.04, 1.04]);

    const line = d3.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]));

    dissonanceSvg.selectAll("*").remove();

    dissonanceSvg
        .attr("width", width)
        .attr("height", height);

    if (Array.isArray(customScale)) {
        customScale.forEach((ratio) => {
            if (ratio >= 1 && ratio <= 2) {
                const xPos = x(ratio);
                dissonanceSvg.append("line")
                    .attr("x1", xPos)
                    .attr("y1", margins.top)
                    .attr("x2", xPos)
                    .attr("y2", height - margins.bottom)
                    .attr("stroke", "gray")
                    .attr("stroke-dasharray", "4,2")
                    .attr("stroke-width", 1);
            }
        });
    } else {
        for (let i = 0; i <= edo; i++) {
            const ratio = Math.pow(2, i / edo);
            const xPos = x(ratio);
            dissonanceSvg.append("line")
                .attr("x1", xPos)
                .attr("y1", margins.top)
                .attr("x2", xPos)
                .attr("y2", height - margins.bottom)
                .attr("stroke", "gray")
                .attr("stroke-dasharray", "4,2")
                .attr("stroke-width", 1);
        }
    }

    dissonanceSvg.append("path")
        .datum(points)
        .attr("fill", "none")
        .attr("stroke", "#1f77b4")
        .attr("stroke-width", 2)
        .attr("d", line);

    dissonanceSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${y(0)})`)
        .call(d3.axisBottom(x).tickFormat(d3.format(".2f")));

    dissonanceSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${margins.left},0)`)
        .call(d3.axisLeft(y));

    dissonanceSvg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height - 2)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("frequency ratio");

    dissonanceSvg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -(height / 2))
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("dissonance");

    dissonanceSvg.selectAll(".annotation")
        .data(intervals)
        .enter()
        .append("g")
        .attr("class", "annotation")
        .each(function(d) {
            const xPos = x(d.ratio);
            const yPos = y(graph.function(d.ratio) * graph.normalizer);
            d3.select(this)
                .append("circle")
                .attr("cx", xPos)
                .attr("cy", yPos)
                .attr("r", 3)
                .attr("fill", "#ffa500");
            d3.select(this)
                .append("text")
                .attr("x", xPos)
                .attr("y", yPos + 10)
                .attr("text-anchor", "middle")
                .attr("font-size", "10px")
                .text(d.name);
        });


    const hoverBox = dissonanceSvg.append("rect")
        .attr("class", "dissonance-hover-box")
        .attr("rx", 4)
        .attr("ry", 4);

    const hoverPoint = dissonanceSvg.append("circle")
        .attr("class", "dissonance-hover-point")
        .attr("r", 4);

    const hoverLabel = dissonanceSvg.append("text")
        .attr("class", "dissonance-hover-label")
        .attr("text-anchor", "middle")
        .attr("font-size", "10px");


    const overlay = dissonanceSvg.append("rect")
        .attr("class", "dissonance-overlay")
        .attr("x", margins.left)
        .attr("y", margins.top)
        .attr("width", width - margins.left - margins.right)
        .attr("height", height - margins.top - margins.bottom);

    function getSnappedRatio(ratio, edo) {
        const predefinedIntervals = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2];
        let closestInterval = predefinedIntervals[0];
        let minIntervalDiff = Math.abs(ratio - closestInterval);
        for (let i = 1; i < predefinedIntervals.length; i++) {
            const diff = Math.abs(ratio - predefinedIntervals[i]);
            if (diff < minIntervalDiff) {
                minIntervalDiff = diff;
                closestInterval = predefinedIntervals[i];
            }
        }

        if (Array.isArray(customScale)) {
            let closest = customScale[0];
            let minDiff = Math.abs(ratio - closest);
            for (let i = 1; i < customScale.length; i++) {
                const diff = Math.abs(ratio - customScale[i]);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = customScale[i];
                }
            }
            if (minDiff < SNAPPING_THRESHOLD && minDiff < minIntervalDiff) {
                return [closest, 'custom'];
            }
            if (minIntervalDiff < SNAPPING_THRESHOLD) {
                return [closestInterval, 'interval'];
            }
            return [ratio, null];
        } else {
            const logRatio = Math.log2(ratio);
            const closestEdoNote = Math.round(logRatio * edo) / edo;
            const edoSnappedRatio = Math.pow(2, closestEdoNote);
            const edoDiff = Math.abs(ratio - edoSnappedRatio);
            if (edoDiff < SNAPPING_THRESHOLD && edoDiff < minIntervalDiff) {
                return [edoSnappedRatio, 'edo'];
            }
            if (minIntervalDiff < SNAPPING_THRESHOLD) {
                return [closestInterval, 'interval'];
            }
            return [ratio, null];
        }
    }

    function combineAndPlayWaves(ratio) {
        ratio = getSnappedRatio(ratio, edo)[0];
        const baseFrequency = parseFloat(document.getElementById("base-frequency").value) || 220;
        const waveform = createWaveform(harmonicSeries);
        const envelopedWave = applyEnvelope(waveform);
        const combinedWave = combineWaves(envelopedWave, ratio);
        playSound(combinedWave, baseFrequency, SOUND_DURATION);
    }

    function prepareNoteText(ratio, edo, snapType) {
        let noteText = null;
        if (snapType === 'edo') {
            const logRatio = Math.log2(ratio);
            const note = Math.round(logRatio * edo);
            noteText = `Note: ${note}`;
        } else if (snapType === 'custom') {
            const idx = customScale.findIndex(r => Math.abs(r - ratio) < 1e-8);
            if (idx !== -1) noteText = `Note: ${idx}`;
        } else if (snapType === 'interval') {
            const interval = intervals.find(i => Math.abs(i.ratio - ratio) < 1e-8);
            if (interval) noteText = interval.name;
        }
        return noteText;
    }

    function showDissonanceHover(mouseX) {
        let ratio = x.invert(mouseX);
        if (ratio >= 1 && ratio <= 2) {
            let snapType;
            [ratio, snapType] = getSnappedRatio(ratio, edo);
            const noteText = prepareNoteText(ratio, edo, snapType);
            const value = graph.function(ratio) * graph.normalizer;
            const xPos = x(ratio);
            const yPos = y(value);
            const ratioText = `${ratio.toFixed(4)} : ${value.toFixed(4)}`;
            const lines = noteText ? [noteText, ratioText] : [ratioText];
            hoverPoint
                .attr("cx", xPos)
                .attr("cy", yPos)
                .style("opacity", 1);
            hoverLabel
                .attr("x", xPos)
                .attr("y", yPos - 10 - (lines.length - 1) * 15)
                .html(() => lines.map((line, i) => `<tspan x=\"${xPos}\" dy=\"${i === 0 ? 0 : 15}\">${line}</tspan>`).join(""))
                .style("opacity", 1)
                .style("fill", "black");
            const textBBox = hoverLabel.node().getBBox();
            hoverBox
                .attr("x", textBBox.x - 5)
                .attr("y", textBBox.y - 2)
                .attr("width", textBBox.width + 10)
                .attr("height", textBBox.height + 4)
                .style("opacity", 1);
        }
    }

    overlay
        .on("mousemove", function(event) {
            const mouseX = d3.pointer(event)[0];
            showDissonanceHover(mouseX);
        })
        .on("mouseout", function() {
            hoverPoint.style("opacity", 0);
            hoverLabel.style("opacity", 0);
            hoverBox.style("opacity", 0);
        })
        .on("click", function(event) {
            const mouseX = d3.pointer(event)[0];
            let ratio = x.invert(mouseX);
            if (ratio >= 1 && ratio <= 2) {
                combineAndPlayWaves(ratio);
            }
        })
        .on("touchstart", function(event) {
            if (event.cancelable) event.preventDefault();
        }, { passive: false })
        .on("touchmove", function(event) {
            if (event.cancelable) event.preventDefault();
            const touch = event.touches && event.touches[0] ? event.touches[0] : (event.changedTouches && event.changedTouches[0]);
            if (!touch) return;
            const svgRect = dissonanceSvg.node().getBoundingClientRect();
            const mouseX = touch.clientX - svgRect.left;
            showDissonanceHover(mouseX);
        }, { passive: false })
        .on("touchend", function(event) {
            if (event.cancelable) {
                event.preventDefault();
            }

            const touch = event.changedTouches && event.changedTouches[0] ? event.changedTouches[0] : (event.touches && event.touches[0]);
            if (!touch) {
                return;
            }

            const svgRect = dissonanceSvg.node().getBoundingClientRect();
            const mouseX = touch.clientX - svgRect.left;
            let ratio = x.invert(mouseX);
            if (ratio >= 1 && ratio <= 2) {
                combineAndPlayWaves(ratio);
            }
        }, { passive: false });
}

function updateEdoError() {
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;
    const series = { ...harmonicSeries };

    const data = [];
    let minEdo = parseInt(minEdoInput.value);
    let maxEdo = parseInt(maxEdoInput.value);
    if (isNaN(minEdo) || minEdo < 1) {
        minEdo = 1;
    } else if (minEdo > EDO_LIMIT) {
        minEdo = EDO_LIMIT;
    }

    if (isNaN(maxEdo) || maxEdo < minEdo + 1) {
        maxEdo = minEdo + 1;
    } else if (maxEdo > EDO_LIMIT) {
        maxEdo = EDO_LIMIT;
    }

    for (let edo = minEdo; edo <= maxEdo; edo++) {
        if (customScale) {
            const scale = Array.from({length: edo}, (_, i) => Math.pow(2, i / edo));
            data.push({ edo: edo, error: distanceScaleError(scale, series) });
        } else {
            data.push({ edo: edo, error: scaleError(edo, series) });
        }
    }

    let customPoint = null;
    if (Array.isArray(customScale)) {
        let customError = distanceScaleError(customScale, series);
        customPoint = { N: customScale.length, error: customError };
    }

    const xScale = d3.scaleLinear()
        .domain([minEdo - 1, maxEdo + 1])
        .range([0, graphWidth]);

    const customError = customPoint ? customPoint.error : 0;
    const maxError = Math.max(customError, d3.max(data, d => d.error));
    const yScale = d3.scaleLinear()
        .domain([0, maxError + 0.05])
        .range([graphHeight, 0]);

    edoErrorSvg.selectAll("*").remove();

    edoErrorSvg
        .attr("width", width)
        .attr("height", height);

    const svg = edoErrorSvg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${graphHeight})`)
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(yScale));

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "edo-error-tooltip");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", graphWidth / 2)
        .attr("y", graphHeight + margin.bottom - 1)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("EDO");

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(yScale));

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -graphHeight / 2)
        .attr("y", -margin.left + 7)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("error");

    function showTooltip(event, d) {
        tooltip.transition()
            .duration(200)
            .style("opacity", .9);
        tooltip.html(`EDO: ${d.edo}<br/>Error: ${d.error.toFixed(4)}`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
    }

    function hideTooltip() {
        tooltip.transition()
            .duration(500)
            .style("opacity", 0);
    }

    svg.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => xScale(d.edo))
        .attr("cy", d => yScale(d.error))
        .attr("r", 3.5)
        .attr("fill", "#1f77b4")
        .attr("class", "edo-error-plot")
        .on("click", function(event, d) {
            const edoInput = document.getElementById("edo-input");
            edoInput.value = d.edo;
            customScale = null;
            updateHarmonicCircle();
            updateDissonanceGraph();
        })
        .on("mouseover", function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("fill", "#ff7f0e");
            showTooltip(event, d);
        })
        .on("mouseout", function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("fill", "#1f77b4");
            hideTooltip();
        });

    if (customPoint) {
        svg.append("circle")
            .attr("cx", xScale(customPoint.N))
            .attr("cy", yScale(customPoint.error))
            .attr("r", 4)
            .attr("fill", "#e07b39")
            .attr("stroke", "#b36a5e")
            .attr("stroke-width", 1.5)
            .attr("class", "edo-error-custom-point")
            .on("mouseover", function(event) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("fill", "#ffb97a");
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltip.html(`N: ${customPoint.N}<br/>Error: ${customPoint.error.toFixed(4)}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("fill", "#e07b39");
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .on("click", function() {
                if (Array.isArray(customScaleOriginal)) {
                    customScale = customScaleOriginal.slice();
                    updateHarmonicCircle();
                    updateDissonanceGraph();
                }
            });
        svg.append("text")
            .attr("x", xScale(customPoint.N))
            .attr("y", yScale(customPoint.error) - 10)
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("fill", "#e07b39")
            .attr("font-weight", "bold")
            .text("C");
    }

    svg.selectAll(".edo-label")
        .data(data)
        .join("text")
        .attr("class", "edo-label")
        .attr("x", d => xScale(d.edo))
        .attr("y", d => yScale(d.error) - 6)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .text(d => d.edo)
        .on("mouseover", showTooltip)
        .on("mouseout", hideTooltip);
}

function getScaleToUse(edo) {
    let scaleToUse = null;
    let log2ScaleToUse = null;
    let isCustom = false;
    if (Array.isArray(customScale)) {
        scaleToUse = customScale;
        isCustom = true;
    } else {
        let maxEdo = parseInt(maxEdoInput.value);
        if (maxEdo !== null && edo > maxEdo) {
            edo = maxEdo;
        }
        scaleToUse = Array.from({length: edo}, (_, i) => Math.pow(2, i / edo));
    }

    log2ScaleToUse = scaleToUse.map(r => Math.log2(r));
    return [scaleToUse, log2ScaleToUse, isCustom];
}

function playHarmonic(harmonic) {
    const baseFrequency = parseFloat(document.getElementById("base-frequency").value) || 220;
    const wave = createWaveform(harmonicSeries);
    const factor = Math.pow(2, Math.log2(harmonic) % 1);
    const envelopedWave = applyEnvelope(wave, SOUND_DURATION, 0.5);
    playSound(envelopedWave, baseFrequency * factor, SOUND_DURATION);
}

function updateHarmonicCircle() {
    let edo = parseInt(document.getElementById("edo-input").value) || 12;
    let [scaleToUse, log2ScaleToUse, isCustom] = getScaleToUse(edo);

    function calculateAngle(ratio, i) {
        let angle;
        if (isCustom) {
            angle = 2 * Math.PI * (Math.log2(ratio) % 1) - Math.PI / 2;
        } else {
            angle = (2 * Math.PI * i) / scaleToUse.length - Math.PI / 2;
        }
        return angle;
    }

    const radius = (height / 2 - margins.top) * 0.75;
    const center = height / 2;
    const maxAmplitude = d3.max(Object.values(harmonicSeries));

    const colorScale = d3.scaleLinear()
        .domain([0, 0.25])
        .range(["#4daf4a", "#e41a1c"]);

    harmonicCircleSvg.selectAll("*").remove();

    harmonicCircleSvg
        .attr("width", height)
        .attr("height", height);

    harmonicCircleSvg.append("circle")
        .attr("cx", center)
        .attr("cy", center)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "3,3");

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "harmonic-circle-tooltip");

    for (let i = 0; i < scaleToUse.length; i++) {
        const ratio = scaleToUse[i];
        const angle = calculateAngle(ratio, i);

        const x1 = center + radius * Math.cos(angle);
        const y1 = center + radius * Math.sin(angle);
        const x2 = center + (radius + 40) * Math.cos(angle);
        const y2 = center + (radius + 40) * Math.sin(angle);

        harmonicCircleSvg.append("line")
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2)
            .attr("y2", y2)
            .attr("stroke", "#13b5dc")
            .attr("stroke-width", 3)
            .on("mouseover", function(event) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltip.html(`Note: ${i}<br/>Ratio: ${ratio.toFixed(4)}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
                d3.select(this)
                    .attr("stroke", "#088080")
                    .attr("stroke-width", 4);
            })
            .on("mouseout", function() {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
                d3.select(this)
                    .attr("stroke", "#13b5dc")
                    .attr("stroke-width", 3);
            })
            .on("click", function() {
                playHarmonic(ratio);
            });
    }

    function interpolateNote(data) {
        const logH = Math.log2(data.harmonic) % 1;
        const scale = scaleToUse;
        const scaleWith2 = scale[scale.length - 1] < 2.0 - 1e-8 ? [...scale, 2.0] : scale;
        const logScaleWith2 = scaleWith2.map(r => Math.log2(r));

        let idx = 0;
        while (idx < logScaleWith2.length - 1 && logH > logScaleWith2[idx + 1] - 1e-8) {
            idx++;
        }
        if (idx >= logScaleWith2.length - 1) {
            idx = logScaleWith2.length - 2;
        }

        const l0 = logScaleWith2[idx];
        const l1 = logScaleWith2[idx + 1];
        const n0 = idx;
        const n1 = idx + 1;
        let frac = 0;
        if (l1 - l0 > 1e-8) {
            frac = (logH - l0) / (l1 - l0);
        }
        note = n0 + frac;
        ratio = Math.pow(2, logH);
        return [note, ratio];
    }

    function getEdoNote(data) {
        const logHarmonic = Math.log2(data.harmonic) % 1;
        const ratio = Math.pow(2, logHarmonic);
        const note = logHarmonic * edo;
        return [note, ratio];
    }

    function showTooltip(event, data) {
        tooltip.transition()
            .duration(200)
            .style("opacity", .9);

        let note = null;
        let ratio = null;
        if (isCustom && Array.isArray(scaleToUse)) {
            [note, ratio] = interpolateNote(data);
        } else {
            [note, ratio] = getEdoNote(data);
        }

        tooltip.html(`Harmonic: ${data.harmonic}<br/>Amplitude: ${data.amplitude.toFixed(4)}<br/>Error: ${data.error.toFixed(4)}<br/>Note: ${note.toFixed(4)}<br/>Ratio: ${ratio.toFixed(4)}`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
    }

    function hideTooltip() {
        tooltip.transition()
            .duration(500)
            .style("opacity", 0);
    }

    Object.entries(harmonicSeries).forEach(([harmonic, amplitude]) => {
        if (amplitude > 0 && harmonic % 2) {
            const angle = (2 * Math.PI * Math.log2(harmonic)) % (2 * Math.PI) - Math.PI / 2;
            const error = Array.isArray(customLog2Scale) ? distanceToneError(harmonic, log2ScaleToUse) : toneError(harmonic, edo);
            const color = colorScale(error);
            const barStart = radius;
            const barEnd = radius * (1.05 + (amplitude / maxAmplitude) * 0.5);
            const data = { harmonic, amplitude, error };

            const line = harmonicCircleSvg.append("line")
                .attr("x1", center + barStart * Math.cos(angle))
                .attr("y1", center + barStart * Math.sin(angle))
                .attr("x2", center + barEnd * Math.cos(angle))
                .attr("y2", center + barEnd * Math.sin(angle))
                .attr("stroke", color)
                .attr("stroke-width", 4)
                .on("mouseover", function(event) {
                    d3.select(this).attr("stroke-width", 6);
                    showTooltip(event, data);
                })
                .on("mouseout", function() {
                    d3.select(this).attr("stroke-width", 4);
                    hideTooltip();
                })
                .on("click", function() {
                    playHarmonic(harmonic);
                });

            harmonicCircleSvg.append("text")
                .attr("x", center + (radius - 15) * Math.cos(angle))
                .attr("y", center + (radius - 15) * Math.sin(angle))
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "10px")
                .text(harmonic % 1 === 0 ? harmonic : parseFloat(harmonic).toFixed(2))
                .on("mouseover", function(event) {
                    line.attr("stroke-width", 6);
                    showTooltip(event, data);
                })
                .on("mouseout", function() {
                    line.attr("stroke-width", 4);
                    hideTooltip();
                })
                .on("click", function() {
                    playHarmonic(harmonic);
                })
        }
    });
}

function updateEdoInputs() {
    const minEdo = parseInt(minEdoInput.value);
    const maxEdo = parseInt(maxEdoInput.value);

    if (!maxEdoInput.matches(':focus')) {
        if (maxEdo <= minEdo) {
            maxEdoInput.value = minEdo + 1;
        }
    }

    edoInput.max = maxEdoInput.value;

    if (parseInt(edoInput.value) > maxEdoInput.value) {
        edoInput.value = maxEdoInput.value;
    }
}

function updateAll() {
    updateHarmonicSeries();
    updateDissonanceGraph();
    updateEdoError();
    updateHarmonicCircle();
}

document.getElementById("edo-input").addEventListener("change", (e) => {
    customScale = null;
    updateHarmonicCircle();
    updateDissonanceGraph();
});

document.getElementById("base-frequency").addEventListener("change", (e) => {
    if (e.target.value < 20) e.target.value = 20;
    if (e.target.value > 20000) e.target.value = 20000;
    updateDissonanceGraph();
});

document.addEventListener('DOMContentLoaded', function() {
    var scrollIndicator = document.querySelector('.scroll-indicator');
    var description = document.querySelector('.description');
    if (scrollIndicator && description) {
        scrollIndicator.addEventListener('click', function() {
            description.scrollIntoView({ behavior: 'smooth' });
        });
    }
});

document.querySelectorAll('.enlarge-icon').forEach(icon => {
    icon.addEventListener('click', (event) => {
        const graph = event.target.closest('.graph');
        const root = document.documentElement;
        const iconElement = icon.querySelector('i');

        if (graph.classList.contains('fullscreen')) {
            graph.classList.remove('fullscreen');
            root.style.setProperty('--width', `${baseWidth}px`);
            root.style.setProperty('--height', `${baseHeight}px`);
            iconElement.classList.remove('fa-search-minus');
            iconElement.classList.add('fa-search-plus');
        } else {
            document.querySelectorAll('.graph').forEach(g => g.classList.remove('fullscreen'));
            graph.classList.add('fullscreen');
            const computedStyle = getComputedStyle(document.documentElement);
            const paddingX = parseInt(computedStyle.getPropertyValue('--padding-x')) || 0;
            const paddingY = parseInt(computedStyle.getPropertyValue('--padding-y')) || 0;
            let fullscreenWidth = window.innerWidth - 2 * paddingX;
            let fullscreenHeight = window.innerHeight - 2 * paddingY;
            if (window.innerHeight > window.innerWidth) {
                const size = Math.min(fullscreenWidth, fullscreenHeight);
                fullscreenWidth = size;
                fullscreenHeight = size;
            }
            root.style.setProperty('--width', `${fullscreenWidth}px`);
            root.style.setProperty('--height', `${fullscreenHeight}px`);
            iconElement.classList.remove('fa-search-plus');
            iconElement.classList.add('fa-search-minus');
        }

        setDimensions();
        updateAll();
    });
});

minEdoInput.addEventListener("input", () => {
    if (parseInt(minEdoInput.value) < 1) {
        minEdoInput.value = 1;
    }
    updateEdoInputs();
    updateEdoError();
});

maxEdoInput.addEventListener("input", () => {
    updateEdoInputs();
    updateEdoError();
    updateHarmonicCircle();
});


window.addEventListener("orientationchange", () => {
    updateGraphDimensions();
    setDimensions();
    updateAll();
});

updateGraphDimensions();
setDimensions();
parseURLParameters();
updateAll();
