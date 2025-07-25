# Musical Harmony Analysis Tool

## Features

This interactive tool helps explore musical harmony through four connected visualizations:

- **Harmonic Series:**
  Drag the blue bars to adjust the strength of each harmonic. These changes affect how the sound will be produced.

- **Dissonance Graph:**
  Shows how pleasant or harsh two notes sound together at different intervals. Click anywhere on the line to hear the sound. You can change the base note frequency below the graph.

- **EDO Error Graph:**
  Displays how well different Equal Division of Octave (EDO) systems match our harmonic series. Common Western music uses 12-EDO. Click any point to see its representation in the circle.

  The error is calculated as the weighted distance of harmonics to the closest EDO note:

  ![Equation](https://latex.codecogs.com/png.latex?e%20=%20\sqrt{\sum_{n=1}^{+\infty}a_{n}%20(x_{n}%20-%20[x_{n}])^2})

  where:
  - `a_n` is the _n_-th harmonic amplitude
  - `x_n` is the pitch value (in "semitones") (`EDO × (log₂(n) mod 1)`)

  - **Harmonic Circle:**
  Shows harmonics arranged in a circle, with colors indicating how well they match the selected EDO system (green = good match, red = poor match). Blue lines show the EDO divisions.

## Advanced editing

### Number of harmonics

To set more harmonics than the default range, set the `harmonics` variable in the URL. For example, to set 80 harmonics, enter:

[`https://edo.jakim.it/?harmonics=80`](https://edo.jakim.it/?harmonics=80)

### Custom series

If you want to provide non-standard (fractional) harmonics, or harmonics beyond the given range, you may use the console and edit the `harmonicSeries` variable directly. For example, you can add a single harmonic by:

```javascript
harmonicSeries[1.5] = 0.5;
```

You can also provide the entire harmonic series as a dictionary:

```javascript
harmonicSeries = {1: 1.0, 1.75: 0.25, 2.44: 0.1, 3: 0.05, 4.47: 0.02};
```

Update all graphs by calling:

```javascript
updateAll();
```

Finally, you can provide a custom series via a URL in the following format:

[`https://edo.jakim.it/?1.0=1.0&1.75=0.25&2.44=0.1&3=0.05&4.47=0.02`](https://edo.jakim.it/?1.0=1.0&1.75=0.25&2.44=0.1&3=0.05&4.47=0.02)

where each harmonic is set by `harmonic=value` pairs, joined by `&`.
