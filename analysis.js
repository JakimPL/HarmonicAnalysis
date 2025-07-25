const MAX_HARMONICS = 32;
const BASE_FREQUENCY = 220;
const EDO_LIMIT = 10000;
const SOUND_DURATION = 1.0;
const SNAPPING_THRESHOLD = 0.01;

const dimensions = getDimensions();
const WIDTH = dimensions.width;
const HEIGHT = dimensions.height;
const MARGIN = dimensions.margins;

let harmonicSeries = {};
for (let i = 1; i <= MAX_HARMONICS; i++) {
    harmonicSeries[i] = 1 / Math.pow(i, 1.5);
}

const harmonicsSvg = d3.select("#harmonics")
    .append("svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT);

const dissonanceSvg = d3.select("#dissonance")
    .append("svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT);

const edoErrorSvg = d3.select("#edo-error")
    .append("svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT);

const harmonicCircleSvg = d3.select("#harmonic-circle")
    .append("svg")
    .attr("width", HEIGHT)
    .attr("height", HEIGHT);

const minEdoInput = document.getElementById("min-edo-input");
const maxEdoInput = document.getElementById("max-edo-input");
const edoInput = document.getElementById("edo-input");

function updateHarmonicSeriesFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const newHarmonicSeries = {};

    urlParams.forEach((value, key) => {
        const harmonic = parseFloat(key);
        const amplitude = parseFloat(value);

        if (!isNaN(harmonic) && !isNaN(amplitude) && harmonic > 0 && amplitude >= 0 && amplitude <= 1) {
            newHarmonicSeries[harmonic] = amplitude;
        }
    });

 if (Object.keys(newHarmonicSeries).length > 0) {
        harmonicSeries = newHarmonicSeries;
    }
}

function getDimensions(selector) {
    const root = getComputedStyle(document.documentElement);
    const width = parseInt(root.getPropertyValue('--width'));
    const height = parseInt(root.getPropertyValue('--height'));
    const margins = {
        top: parseInt(root.getPropertyValue('--margin-top')),
        right: parseInt(root.getPropertyValue('--margin-right')),
        bottom: parseInt(root.getPropertyValue('--margin-bottom')),
        left: parseInt(root.getPropertyValue('--margin-left'))
    };

    return { width, height, margins };
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
    const barWidth = 10;

    const x = d3.scaleLinear()
        .range([MARGIN.left, WIDTH - MARGIN.right])
        .domain([0, maxKey + 1]);

    const y = d3.scaleLinear()
        .range([HEIGHT - MARGIN.bottom, MARGIN.top])
        .domain([-0.05, 1]);

    let isDragging = false;

    function updateAmplitude(event) {
        const mouseX = d3.pointer(event)[0];
        const harmonicNumber = x.invert(mouseX);
        const mouseY = d3.pointer(event)[1];
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
                        const mouseX = d3.pointer(event)[0];
                        const barStart = x(harmonic) - barWidth / 2;
                        const barEnd = x(harmonic) + barWidth / 2;
                        return mouseX >= barStart && mouseX <= barEnd ? "#ff7f0e" : "#1f77b4";
                    });
            }
        }
    }

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

        if (mouseX < MARGIN.left || mouseX > WIDTH - MARGIN.right || mouseY < MARGIN.top || mouseY > HEIGHT - MARGIN.bottom) {
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
            updateHarmonicCircle();
        }
    });

    harmonicsSvg.selectAll(".axis").remove();

    harmonicsSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${y(0)})`)
        .call(d3.axisBottom(x));

    harmonicsSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${MARGIN.left},0)`)
        .call(d3.axisLeft(y));
}

function updateDissonanceGraph() {
    const baseFrequency = parseFloat(document.getElementById("base-frequency").value) || 220;
    const edo = parseInt(document.getElementById("edo-input").value) || 12;

    const series = { ...harmonicSeries };

    const graph = getDissonanceGraph(series, baseFrequency);

    const x = d3.scaleLog()
        .range([MARGIN.left, WIDTH - MARGIN.right])
        .domain([0.99, 2.02]);

    const y = d3.scaleLinear()
        .range([HEIGHT - MARGIN.bottom, MARGIN.top])
        .domain([0, 1.05]);

    const line = d3.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]));

    const points = graph.ratios.map((ratio, i) => [ratio, graph.values[i]]);

    dissonanceSvg.selectAll("*").remove();

    for (let i = 0; i <= edo; i++) {
        const ratio = Math.pow(2, i / edo);
        const xPos = x(ratio);

        dissonanceSvg.append("line")
            .attr("x1", xPos)
            .attr("y1", MARGIN.top)
            .attr("x2", xPos)
            .attr("y2", HEIGHT - MARGIN.bottom)
            .attr("stroke", "gray")
            .attr("stroke-dasharray", "4,2")
            .attr("stroke-width", 1);
    }

    dissonanceSvg.append("path")
        .datum(points)
        .attr("fill", "none")
        .attr("stroke", "#1f77b4")
        .attr("stroke-width", 2)
        .attr("d", line);

    dissonanceSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${HEIGHT - MARGIN.bottom})`)
        .call(d3.axisBottom(x).tickFormat(d3.format(".2f")));

    dissonanceSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${MARGIN.left},0)`)
        .call(d3.axisLeft(y));

    dissonanceSvg.append("text")
        .attr("class", "axis-label")
        .attr("x", WIDTH / 2)
        .attr("y", HEIGHT - 1)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("frequency ratio");

    dissonanceSvg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -(HEIGHT / 2))
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("dissonance");

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
        .attr("class", "hover-box")
        .attr("fill", "rgba(255, 255, 255, 0.8)")
        .attr("stroke", "#ccc")
        .attr("rx", 4)
        .attr("ry", 4)
        .style("opacity", 0);

    const hoverPoint = dissonanceSvg.append("circle")
        .attr("class", "hover-point")
        .attr("r", 4)
        .attr("fill", "#ff7f0e")
        .style("opacity", 0)
        .style("pointer-events", "none");

    const hoverLabel = dissonanceSvg.append("text")
        .attr("class", "hover-label")
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .style("opacity", 0)
        .style("pointer-events", "none");


    const overlay = dissonanceSvg.append("rect")
        .attr("class", "overlay")
        .attr("x", MARGIN.left)
        .attr("y", MARGIN.top)
        .attr("width", WIDTH - MARGIN.left - MARGIN.right)
        .attr("height", HEIGHT - MARGIN.top - MARGIN.bottom)
        .style("fill", "none")
        .style("pointer-events", "all");

    function getSnappedRatio(ratio, edo) {
        const logRatio = Math.log2(ratio);
        const closestEdoNote = Math.round(logRatio * edo) / edo;
        const edoSnappedRatio = Math.pow(2, closestEdoNote);

        const predefinedIntervals = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2];
        let closestInterval = ratio;
        let minIntervalDiff = Infinity;

        predefinedIntervals.forEach(interval => {
            const diff = Math.abs(ratio - interval);
            if (diff < minIntervalDiff) {
                minIntervalDiff = diff;
                closestInterval = interval;
            }
        });

        const edoDiff = Math.abs(ratio - edoSnappedRatio);
        if (edoDiff < SNAPPING_THRESHOLD || minIntervalDiff < SNAPPING_THRESHOLD) {
            if (minIntervalDiff < edoDiff) {
                return [closestInterval, false];
            } else {
                return [edoSnappedRatio, true];
            }
        }

        return [ratio, false];
    }

    overlay
        .on("mousemove", function(event) {
            const mouseX = d3.pointer(event)[0];
            let ratio = x.invert(mouseX);
            let snapped = false;

            if (ratio >= 1 && ratio <= 2) {
                const edo = parseInt(document.getElementById("edo-input").value) || 12;
                [ratio, snapped] = getSnappedRatio(ratio, edo);

                const logRatio = Math.log2(ratio);
                const note = Math.round(logRatio * edo);

                const value = graph.function(ratio) * graph.normalizer;
                const xPos = x(ratio);
                const yPos = y(value);

                const ratioText = `${ratio.toFixed(4)} : ${value.toFixed(4)}`;
                const lines = snapped ? [`Note: ${note}`, ratioText] : [ratioText];

                hoverPoint
                    .attr("cx", xPos)
                    .attr("cy", yPos)
                    .style("opacity", 1);

                hoverLabel
                    .attr("x", xPos)
                    .attr("y", yPos - 10 - (lines.length - 1) * 15)
                    .html(() => lines.map((line, i) => `<tspan x="${xPos}" dy="${i === 0 ? 0 : 15}">${line}</tspan>`).join(""))
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
                const edo = parseInt(document.getElementById("edo-input").value) || 12;
                ratio = getSnappedRatio(ratio, edo)[0];

                const baseFrequency = parseFloat(document.getElementById("base-frequency").value) || 220;
                const waveform = createWaveform(harmonicSeries);
                const envelopedWave = applyEnvelope(waveform);
                const combinedWave = combineWaves(envelopedWave, ratio);
                playSound(combinedWave, baseFrequency, SOUND_DURATION);
            }
        });
}

function updateEdoError() {
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = WIDTH - margin.left - margin.right;
    const height = HEIGHT - margin.top - margin.bottom;
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
        data.push({ edo: edo, error: scaleError(edo, series) });
    }

    const xScale = d3.scaleLinear()
        .domain([minEdo - 1, maxEdo + 1])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.error) + 0.05])
        .range([height, 0]);

    edoErrorSvg.selectAll("*").remove();

    const svg = edoErrorSvg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(yScale));

    const tooltip = d3.select("#edo-error")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "1px solid #ddd")
        .style("padding", "5px");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 1)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("EDO");

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(yScale));

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 8)
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

function updateHarmonicCircle() {
    const edo = parseInt(document.getElementById("edo-input").value);

    let maxEdo = parseInt(maxEdoInput.value);
    if (maxEdo !== null && edo > maxEdo) {
        edo = maxEdo;
    }

    function playHarmonic(harmonic) {
        const baseFrequency = parseFloat(document.getElementById("base-frequency").value) || 220;
        const wave = createWaveform(harmonicSeries);
        const factor = Math.pow(2, Math.log2(harmonic) % 1);
        const envelopedWave = applyEnvelope(wave, SOUND_DURATION, 0.5);
        playSound(envelopedWave, baseFrequency * factor, SOUND_DURATION);
    }

    const radius = (HEIGHT / 2 - MARGIN.top) * 0.75;
    const center = HEIGHT / 2;
    const maxAmplitude = d3.max(Object.values(harmonicSeries));

    harmonicCircleSvg.selectAll("*").remove();

    const colorScale = d3.scaleLinear()
        .domain([0, 0.25])
        .range(["#4daf4a", "#e41a1c"]);

    harmonicCircleSvg.append("circle")
        .attr("cx", center)
        .attr("cy", center)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "3,3");

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "1px solid #ddd")
        .style("padding", "5px")
        .style("pointer-events", "none");

    for (let i = 0; i < edo; i++) {
        const angle = (2 * Math.PI * i) / edo - Math.PI / 2;
        const x1 = center + radius * Math.cos(angle);
        const y1 = center + radius * Math.sin(angle);
        const x2 = center + (radius + 40) * Math.cos(angle);
        const y2 = center + (radius + 40) * Math.sin(angle);

        const ratio = Math.pow(2, i / edo);

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
                const baseFrequency = parseFloat(document.getElementById("base-frequency").value) || 220;
                const wave = createWaveform(harmonicSeries);
                const envelopedWave = applyEnvelope(wave, SOUND_DURATION, 0.5);
                playSound(envelopedWave, baseFrequency * ratio, SOUND_DURATION);
            });
    }

    function showTooltip(event, data) {
        tooltip.transition()
            .duration(200)
            .style("opacity", .9);

        const log_harmonic = Math.log2(data.harmonic) % 1;
        const ratio = Math.pow(2, log_harmonic);
        const note = log_harmonic * edo;

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
            const error = toneError(harmonic, edo);
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
                .text(harmonic % 1 === 0 ? harmonic : parseFloat(harmonic).toFixed(2)) // Apply toFixed(2) only if harmonic is not an integer
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
    const edo = parseInt(e.target.value);
    updateHarmonicCircle();
    updateDissonanceGraph();
});

document.getElementById("base-frequency").addEventListener("change", (e) => {
    if (e.target.value < 20) e.target.value = 20;
    if (e.target.value > 20000) e.target.value = 20000;
    updateDissonanceGraph();
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

updateHarmonicSeriesFromURL();
updateAll();
