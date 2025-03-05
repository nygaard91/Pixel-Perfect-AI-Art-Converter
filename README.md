# Pixel Perfect - AI Art Converter
AI-generated pixel art is popular, but it often isn’t truly “pixel perfect.” Many available solutions produce images that are too large, lack precision, or simply aren’t suitable as game assets. Pixel Perfect - AI Art Converter was built to address these challenges by giving you the ability to:

* Define custom grid dimensions: Tailor the output to the exact pixel dimensions you need for your project.
* Precisely position and scale images: Adjust the image’s placement and zoom level so that every cell captures the detail you want.
* Choose from multiple conversion methods: Select an approach that best fits your image and creative goals, whether it’s the dominant color, an average blend, or a neighbor-aware method.

This hands-on approach makes it easier to generate pixel art that meets the specific requirements of game assets and other professional applications.

## Usage Guide

### Step 1: Setup
- **Select Art Dimensions:**  
  Choose your canvas size using the width and height dropdowns.

- **Upload Image:**  
  Use the file input to load your source image. The image is drawn on an offscreen canvas to prepare for processing.

- **Proceed to Next Step:**  
  Click the “Upload (Next Step)” button. The associated code (in the upload button event listener in `script.js`) handles image loading and sets up the preview.

### Step 2: Position & Convert
- **Adjust Grid Cell Size & Image Zoom:**  
  - **Grid Cell Size:** Use the *Preview Size* slider to adjust the size of the preview cells.  
  - **Image Zoom:** Use the *Zoom* slider to scale the image, recalculating offsets and scale as needed.

- **Position the Image:**  
  Drag the image on the canvas to ensure each grid cell represents the area you want to convert.

- **Select Conversion Method:**  
  Pick a conversion algorithm:  
  - **Most Used Color:** Finds the dominant color within each cell.  
  - **Most Used Color (Prioritize Light/Dark):** Uses brightness weighting for color selection.  
  - **Average Color:** Averages the RGB values for a smooth result.  
  - **Neighbor Color:** Samples a slightly larger area to produce a blended color effect.  
  The conversion methods are implemented in functions like `getRepresentativeColor` and `getRepresentativeColorWeighted` in the JavaScript code.

- **Generate Pixel Art:**  
  Click the “Convert (Next Step)” button to process the image. The resulting pixel art is stored in an array for further editing.

### Step 3: Edit & Export
- **Editing Tools:**  
  - **Brush:** Paint using your chosen color.  
  - **Eraser:** Remove color by replacing pixels with transparency.  
  - **Magic Wand:** Use a flood-fill algorithm to clear contiguous areas of the same color.  
  Tool functionality is managed via event listeners and functions such as `handleDrawing` and `floodFill`.

- **Canvas Zoom & Grid Toggle:**  
  - Use the *Canvas Zoom* slider to adjust the view.  
  - Toggle grid lines to help see individual cells clearly.

- **Export Your Art:**  
  Export your pixel art as a PNG using the available export buttons. The image is generated at your chosen scale for download.


## Installation
Just download the folder and extract it to any location on your computer. No installation is required! Simply open the file named 'index.html' in your browser, and you're good to go. The code is designed to run directly in the browser without the need for a local environment.

## Technical Details

### Grid Cell System

**Definition:**  
The grid is defined by two primary variables:
- `gridWidth`: The number of cells horizontally.
- `gridHeight`: The number of cells vertically.

These values determine the resolution of your final pixel art, with each cell representing one "pixel" in the output image.

**Dynamic Resizing:**  
The canvas is resized dynamically based on the grid dimensions and user-selected parameters:
- **Step 2 (Preview Mode):**  
  The canvas size is calculated as:
  
      canvas.width = gridWidth * previewCellSize;
      canvas.height = gridHeight * previewCellSize;
  
  This ensures that the preview accurately reflects how many cells (and thus pixels) the final art will contain.

- **Step 3 (Editing/Export Mode):**  
  When editing or exporting, the canvas size is adjusted according to the zoom level:
  
      canvas.width = gridWidth * canvasZoom;
      canvas.height = gridHeight * canvasZoom;
  
  This allows for a closer look at the details during editing or for exporting the art at different scales.

**Mapping to the Source Image:**  
Each cell in the grid corresponds to a specific region of the source image. This mapping is achieved through calculated offsets and scaling:
- **Offsets:**  
  `offsetX` and `offsetY` represent the translation of the source image relative to the canvas. They allow you to reposition the image so that the desired part is captured by the grid.
- **Scale Factor:**  
  `imageScale` is used to adjust the size of the source image when drawing it on the canvas.

For a given cell at grid position `(i, j)`, the boundaries on the canvas are:

    const cx0 = i * cellWidth;
    const cy0 = j * cellHeight;
    const cx1 = cx0 + cellWidth;
    const cy1 = cy0 + cellHeight;

These boundaries are then converted back to source image coordinates by applying the inverse of the offset and scale:

    const ox0 = (cx0 - offsetX) / imageScale;
    const oy0 = (cy0 - offsetY) / imageScale;
    const ox1 = (cx1 - offsetX) / imageScale;
    const oy1 = (cy1 - offsetY) / imageScale;

This precise mapping ensures that the conversion methods process exactly the region of the image that is visible in the preview.


### Conversion Methods

Each conversion method analyzes the pixel data from the corresponding source image region and determines a representative color for that grid cell. The main methods are detailed below:

**Most Used Color:**  
- **Overview:**  
  This method counts the frequency of each color present within a grid cell and selects the most common one.
- **How It Works:**  
  - The image data for the region is obtained using `getImageData` from an offscreen canvas.
  - The code iterates over the pixel data in steps of 4 (for R, G, B, and A channels).
  - Fully transparent pixels (alpha equals 0) are skipped.
  - Each remaining pixel’s RGB values are stored and a frequency count is maintained (typically using a Map or similar data structure).
  - Finally, the color with the highest frequency is chosen as the representative color for that cell.
- **Example Code:**

    const imgData = origCtx.getImageData(rOx0, rOy0, width, height).data;
    let cellPixels = [];
    for (let idx = 0; idx < imgData.length; idx += 4) {
      const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
      if (a === 0) continue;
      cellPixels.push({ r, g, b });
    }
    const repColor = getRepresentativeColor(cellPixels, similarityThreshold);

**Most Used Color (Prioritize Light/Dark):**  
- **Overview:**  
  This variant adjusts the basic method by weighting pixels based on their brightness—either favoring lighter or darker shades.
- **How It Works:**  
  - For each pixel, brightness is calculated using a standard formula (e.g., `0.299*r + 0.587*g + 0.114*b`).
  - A weight is derived from the brightness value, emphasizing either high or low brightness.
  - Pixels are grouped based on color similarity (using a defined similarity threshold) and a weighted average is computed for each group.
  - The group with the highest total weighted value determines the representative color.
- **Helper Function:**  
  The function `getRepresentativeColorWeighted` manages these calculations.

**Average Color:**  
- **Overview:**  
  This method computes the average color of all non-transparent pixels in the cell, resulting in a smooth, blended color.
- **How It Works:**  
  - Image data is retrieved from the relevant region.
  - The RGB values of all valid pixels are summed.
  - The total for each channel is divided by the number of valid pixels to obtain the average.
- **Example Code:**

    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    for (let idx = 0; idx < imgData.length; idx += 4) {
      const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
      if (a === 0) continue;
      sumR += r;
      sumG += g;
      sumB += b;
      count++;
    }
    if (count > 0) {
      const rAvg = Math.round(sumR / count);
      const gAvg = Math.round(sumG / count);
      const bAvg = Math.round(sumB / count);
      // The averaged color is then applied to the cell.
    }

**Neighbor Color:**  
- **Overview:**  
  This method enhances the average color approach by sampling a slightly larger region around the cell—typically by adding a 25% margin to each side.
- **How It Works:**  
  - The cell boundaries are expanded to include adjacent pixels.
  - Image data is then collected from this larger region.
  - The average color is computed over the extended area, allowing neighboring pixels to influence the final color.
  - This results in a more blended and unified appearance.

All of these conversion methods are integrated into the conversion event listener in `script.js`. They process each grid cell’s pixel data, update the corresponding entry in the `pixelColors` array, and ultimately render the final pixel art on the canvas for editing and export.

