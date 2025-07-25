# Musical Harmony Analysis Tool

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
