const MAX_HARMONICS = 32;
const BASE_FREQUENCY = 220;
const EDO_LIMIT = 10000;
const WIDTH = 450;
const HEIGHT = 250;
const MARGIN = {top: 20, right: 20, bottom: 30, left: 40};

let harmonicSeries = Array(MAX_HARMONICS).fill(0)
    .map((_, i) => ({harmonic: i + 1, amplitude: 1 / (i + 1) ** (1.5)}));

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

function updateHarmonicSeries() {
    const x = d3.scaleBand()
        .range([MARGIN.left, WIDTH - MARGIN.right])
        .domain(harmonicSeries.map(d => d.harmonic))
        .padding(0.1);

    const y = d3.scaleLinear()
        .range([HEIGHT - MARGIN.bottom, MARGIN.top])
        .domain([0, 1]);

    let isDragging = false;
    let hoveredBar = null;

    function updateAmplitude(event) {
        const mouseX = d3.pointer(event)[0];
        const mouseY = d3.pointer(event)[1];
        const harmonicNumber = Math.floor(x.domain().length *
            (mouseX - MARGIN.left) / (WIDTH - MARGIN.left - MARGIN.right)) + 1;

        if (harmonicNumber >= 1 && harmonicNumber <= MAX_HARMONICS) {
            const newAmplitude = Math.max(0, Math.min(1, y.invert(mouseY)));
            const harmonicData = harmonicSeries.find(h => h.harmonic === harmonicNumber);
            if (harmonicData) {
                harmonicData.amplitude = newAmplitude;
                harmonicsSvg.selectAll("rect")
                    .data(harmonicSeries)
                    .attr("y", d => y(d.amplitude))
                    .attr("height", d => HEIGHT - MARGIN.bottom - y(d.amplitude));
            }
        }
    }

    function clearHighlights() {
        harmonicsSvg.selectAll("rect").attr("fill", "#1f77b4");
        harmonicsSvg.selectAll(".amplitude-label").remove();
    }

    harmonicsSvg.selectAll("rect")
        .data(harmonicSeries)
        .join("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.harmonic))
        .attr("y", d => y(d.amplitude))
        .attr("width", x.bandwidth())
        .attr("height", d => HEIGHT - MARGIN.bottom - y(d.amplitude))
        .attr("fill", "#1f77b4")
        .on("mouseover", function(event, d) {
            if (!isDragging) {
                hoveredBar = d.harmonic;
                d3.select(this).attr("fill", "#ff7f0e");

                const label = harmonicsSvg.append("text")
                    .attr("class", "amplitude-label")
                    .attr("x", x(d.harmonic) + x.bandwidth() / 2)
                    .attr("y", y(d.amplitude) - 5)
                    .attr("text-anchor", "middle")
                    .attr("font-size", "10px")
                    .text(`H${d.harmonic}: ${d.amplitude.toFixed(3)}`);
            }
        })
        .on("mouseout", function(event, d) {
            if (!isDragging) {
                hoveredBar = null;
                d3.select(this).attr("fill", "#1f77b4");
                harmonicsSvg.selectAll(".amplitude-label").remove();
            }
        });

    harmonicsSvg
        .on("mousedown", event => {
            isDragging = true;
            clearHighlights();
            updateAmplitude(event);
            updateEdoError();
            updateHarmonicCircle(parseInt(document.getElementById("edo-input").value));
        })
        .on("mousemove", event => {
            if (isDragging) {
                updateAmplitude(event);
                updateEdoError();
                updateHarmonicCircle(parseInt(document.getElementById("edo-input").value));
            }
        });

    d3.select(window)
        .on("mouseup.harmonics", () => {
            if (isDragging) {
                isDragging = false;
                updateDissonanceGraph();
            }
        });

    harmonicsSvg.selectAll(".axis").remove();

    harmonicsSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${HEIGHT - MARGIN.bottom})`)
        .call(d3.axisBottom(x));

    harmonicsSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${MARGIN.left},0)`)
        .call(d3.axisLeft(y));

    harmonicsSvg.selectAll(".axis, .axis-label").remove();

    harmonicsSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${HEIGHT - MARGIN.bottom})`)
        .call(d3.axisBottom(x));

    harmonicsSvg.append("text")
        .attr("class", "axis-label")
        .attr("x", WIDTH / 2)
        .attr("y", HEIGHT - 1)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("harmonic");

    harmonicsSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${MARGIN.left},0)`)
        .call(d3.axisLeft(y));

    harmonicsSvg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -(HEIGHT / 2))
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("amplitude");
}

function updateDissonanceGraph() {
    const baseFrequency = parseFloat(document.getElementById("base-frequency").value) || 220;

    const series = {};
    harmonicSeries.forEach(h => {
        if (h.amplitude > 0) {
            series[h.harmonic] = h.amplitude;
        }
    });

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

    overlay
        .on("mousemove", function(event) {
            const mouseX = d3.pointer(event)[0];
            const ratio = x.invert(mouseX);

            if (ratio >= 1 && ratio <= 2) {
                const value = graph.function(ratio) * graph.normalizer;
                const yPos = y(value);

                hoverPoint
                    .attr("cx", mouseX)
                    .attr("cy", yPos)
                    .style("opacity", 1);

                hoverLabel
                    .attr("x", mouseX)
                    .attr("y", yPos - 10)
                    .text(`${ratio.toFixed(3)} : ${value.toFixed(3)}`)
                    .style("opacity", 1);
            }
        })
        .on("mouseout", function() {
            hoverPoint.style("opacity", 0);
            hoverLabel.style("opacity", 0);
        })
        .on("click", function(event) {
            const mouseX = d3.pointer(event)[0];
            const ratio = x.invert(mouseX);

            if (ratio >= 1 && ratio <= 2) {
                const baseFrequency = parseFloat(document.getElementById("base-frequency").value) || 220;
                const wave1 = createWaveform(harmonicSeries);
                const wave2 = createWaveform(harmonicSeries);
                const envelopedWave1 = applyEnvelope(wave1);
                const envelopedWave2 = applyEnvelope(wave2);
                const combinedWave = combineWaves(envelopedWave1, envelopedWave2);

                playSound(combinedWave, baseFrequency, 2.0);
                playSound(combinedWave, baseFrequency * ratio, 2.0);
            }
        });
}

function updateEdoError() {
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = WIDTH - margin.left - margin.right;
    const height = HEIGHT - margin.top - margin.bottom;

    const series = {};
    harmonicSeries.forEach(h => {
        if (h.amplitude > 0) {
            series[h.harmonic] = h.amplitude;
        }
    });

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
            updateHarmonicCircle(d.edo);
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

function updateHarmonicCircle(edo) {
    let maxEdo = parseInt(maxEdoInput.value);
    if (maxEdo !== null && edo > maxEdo) {
        edo = maxEdo;
   }

    const radius = (HEIGHT / 2 - MARGIN.top) * 0.75;
    const center = HEIGHT / 2;
    const maxAmplitude = d3.max(harmonicSeries, d => d.amplitude);

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
                tooltip.html(`Note: ${i + 1}<br/>Ratio: ${ratio.toFixed(3)}`)
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
            });
    }

    function showTooltip(event, data) {
        tooltip.transition()
            .duration(200)
            .style("opacity", .9);

        const log_harmonic = Math.log2(data.harmonic) % 1;
        const ratio = Math.pow(2, log_harmonic);
        const note = 1.0 + log_harmonic * edo;

        tooltip.html(`Harmonic: ${data.harmonic}<br/>Amplitude: ${data.amplitude.toFixed(3)}<br/>Error: ${data.error.toFixed(3)}<br/>Note: ${note.toFixed(3)}<br/>Ratio: ${ratio.toFixed(3)}`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
    }

    function hideTooltip() {
        tooltip.transition()
            .duration(500)
            .style("opacity", 0);
    }

    harmonicSeries.forEach(({harmonic, amplitude}) => {
        if (amplitude > 0 && harmonic % 2) {
            const angle = (2 * Math.PI * Math.log2(harmonic)) % (2 * Math.PI) - Math.PI / 2;
            const error = toneError(harmonic, edo);
            const color = colorScale(error);
            const barStart = radius;
            const barEnd = radius * (1.02 + (amplitude / maxAmplitude) * 0.5);
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
                });

            harmonicCircleSvg.append("text")
                .attr("x", center + (radius - 15) * Math.cos(angle))
                .attr("y", center + (radius - 15) * Math.sin(angle))
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "10px")
                .text(harmonic)
                .on("mouseover", function(event) {
                    line.attr("stroke-width", 6);
                    showTooltip(event, data);
                })
                .on("mouseout", function() {
                    line.attr("stroke-width", 4);
                    hideTooltip();
                });
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
    updateHarmonicCircle(parseInt(document.getElementById("edo-input").value));
}

document.getElementById("edo-input").addEventListener("change", (e) => {
    updateHarmonicCircle(parseInt(e.target.value));
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
    updateHarmonicCircle(parseInt(document.getElementById("edo-input").value));
});

updateAll();
