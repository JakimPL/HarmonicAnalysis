
# Musical Harmony Analysis Tool

This interactive tool allows you to explore the relationship between harmonic series and tuning systems, focusing on dissonance and scale alignment errors. Experiment with harmonics, dissonance, EDO alignment errors, and more, using real-time audio and intuitive visualizations.

## Features

This interactive tool helps explore musical harmony through four connected visualizations:

- **Harmonic Series:**
  Drag the blue bars to adjust the strength of each harmonic. These changes affect how the sound will be produced.


- **Dissonance Graph:**
  Shows how pleasant or harsh two notes sound together at different intervals. Click anywhere on the line to hear the sound. You can change the base note frequency below the graph.

  The dissonance graph is based on a model of the empirical Plomp-Levelt dissonance curve. Sethares models it as a difference of exponential functions:

  ![Equation](https://latex.codecogs.com/png.latex?d(x)%3De%5E%7B-b_1%20x%7D-e%5E%7B-b_2%20x%7D)

  where `b_1` and `b_2` are constants that define the curve's shape (`b_1 = 3.5` and `b_2 = 5.75` are the default values used in the model). The dissonance between two tones of frequencies `f_1` and `f_2` and loudness `l_1` and `l_2`, respectively, is given by:

  ![Equation](https://latex.codecogs.com/png.latex?d(f_1,f_2,l_1,l_2)%3Dl_%7B12%7D%5B%20e%5E%7B-b_1s(f_2-f_1)%7D-e%5E%7B-b_2s(f_2-f_1)%7D%20%5D)

  where:
  - `f_1 < f_2`
  - `l_12 = min(l_1, l_2)`
  - `s = 0.24 / (0.0207 f_1 + 18.96)`

# Advanced editing

- **EDO Error Graph:**
  Displays how well different Equal Division of Octave (EDO) systems match our harmonic series. Common Western music uses 12-EDO. Click any point to see its representation in the circle.

  The error is calculated as the weighted distance of harmonics to the closest EDO note:

  ![Equation](https://latex.codecogs.com/png.latex?e%20=%20\sqrt{\sum_{n=1}^{+\infty}a_{n}%20(x_{n}%20-%20[x_{n}])^2})

  where:
  - `a_n` is the _n_-th harmonic amplitude
  - `x_n` is the pitch value (in "semitones") (`EDO × (log₂(n) mod 1)`)

  - **Harmonic Circle:**
  Shows harmonics arranged in a circle, with colors indicating how well they match the selected EDO system (green — good match, red — poor match). Blue lines show the EDO divisions.

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

where each harmonic is set by `harmonic=amplitude` pairs, joined by `&`.

### Custom scale

You can examine non-standard scales. You can provide a custom scale as a series of frequency ratios separated by a comma:

[`https://edo.jakim.it/?scale=1.0,1.2,1.4,1.6,1.8`](https://edo.jakim.it/?scale=1.0,1.2,1.4,1.6,1.8)

Since the error calculation method is counted in the number of tones, the formula for custom scales cease to make sense as it assumes that each interval is of the same length.

A distance-based formula is being used instead:

![Equation](https://latex.codecogs.com/png.image?e=\sum_{n=1}^{&plus;\infty}|S|\sqrt{a_n\min_{s\in&space;S}\left(x_n-s\right)^2})

where:
- `S` is the scale of log2 frequency ratio (modulo 1)
- `x_n` is the pitch value (`log₂(n) mod 1`)

## References

- Plomp, R., & Levelt, W. J. M. (1965). **Tonal Consonance and Critical Bandwidth**. *Journal of the Acoustical Society of America, 38*(4), 548–560. [doi:10.1121/1.1909741](https://doi.org/10.1121/1.1909741)
- Sethares, W. A. (2005). **Tuning, Timbre, Spectrum, Scale** (2nd ed.). Springer. [Springer Link](https://link.springer.com/book/10.1007/b138848)
