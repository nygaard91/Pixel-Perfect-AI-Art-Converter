/*********************
 * Global Variables
 *********************/
let currentStep = 1;
let gridWidth = 16, gridHeight = 16; // separate grid dimensions
let image = new Image();
let imgLoaded = false;

// For Step 2: positioning of source image
let imageScale = 1, offsetX = 0, offsetY = 0;
let dragStartX, dragStartY, dragStartOffsetX, dragStartOffsetY;

// For Step 3: pixel art data and canvas zoom
let pixelColors = []; // 2D array [row][col] with color strings (or "transparent")
let conversionBackup = []; // stores conversion result for potential reset
let canvasZoom = 1; // Zoom factor (each grid cell becomes canvasZoom × canvasZoom pixels)
let currentDrawColor = "#000000";
let drawingActive = false; // for left-click drawing

// For tool selection in Step 3
let currentTool = "brush"; // "brush", "eraser", "magicWand"

// For brush highlighting in Step 3
let highlightI = undefined;
let highlightJ = undefined;

// For recent colors (only added when drawing occurs)
let recentColors = [];

// Undo/Redo history
let historyStack = [];
let redoStack = [];
let drawingOccurred = false; // flag to know if a drawing action occurred

// Preview cell size for Step 2 (in pixels); now controlled by a slider
let previewCellSize = 4;  // default value

// Magice wand default threshold
let magicWandThreshold = 5;

// Toggle between light and dark background
let isDarkBackground = true;


/*********************
 * DOM Elements
 *********************/
const step1Div = document.getElementById("step1");
const step2Div = document.getElementById("step2");
const step3Div = document.getElementById("step3");

const gridWidthSelect = document.getElementById("gridWidthSelect");
const gridHeightSelect = document.getElementById("gridHeightSelect");
const imageInput = document.getElementById("imageInput");
const uploadBtn = document.getElementById("uploadBtn");

const zoomSlider = document.getElementById("zoomSlider");
const previewSizeSlider = document.getElementById("previewSizeSlider");
const previewSizeValue = document.getElementById("previewSizeValue");
const convMethodSelect = document.getElementById("convMethod");
const convertBtn = document.getElementById("convertBtn");
const resetPositionBtn = document.getElementById("resetPositionBtn");

const canvasZoomSlider = document.getElementById("canvasZoomSlider");
const resetCanvasZoomBtn = document.getElementById("resetCanvasZoomBtn");
const drawColorPicker = document.getElementById("drawColor");
const transparentBtn = document.getElementById("transparentBtn");
const brushSizeSelect = document.getElementById("brushSizeSelect");
const gridToggle = document.getElementById("gridToggle");
const recentColorsSection = document.getElementById("recentColorsSection");
const recentColorsContainer = document.getElementById("recentColorsContainer");
const resetEditBtn = document.getElementById("resetEditBtn");

// New tool buttons
const brushToolBtn = document.getElementById("brushToolBtn");
const eraserToolBtn = document.getElementById("eraserToolBtn");
const magicWandBtn = document.getElementById("magicWandBtn");

const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");
const mainContent = document.getElementById("mainContent");

// Offscreen canvas for image analysis
let originalCanvas = document.createElement("canvas");
let origCtx = originalCanvas.getContext("2d");

// Magic Wand Threshold Slider
const magicWandThresholdSlider = document.getElementById("magicWandThresholdSlider");
const magicWandThresholdValue = document.getElementById("magicWandThresholdValue");
magicWandThresholdSlider.addEventListener("input", function() {
  magicWandThreshold = parseInt(this.value);
  magicWandThresholdValue.textContent = this.value;
});

// Event listeners for new export buttons (Step 3)
document.getElementById("exportX1Btn").addEventListener("click", () => exportImage(1));
document.getElementById("exportX4Btn").addEventListener("click", () => exportImage(4));
document.getElementById("exportX8Btn").addEventListener("click", () => exportImage(8));


/*********************
 * Utility Functions
 *********************/
function toHex(num) {
  return num.toString(16).padStart(2, "0").toUpperCase();
}

function deepCopyPixels(pixels) {
  return pixels.map(row => row.slice());
}

function saveHistory() {
  historyStack.push(deepCopyPixels(pixelColors));
  // Clear redo stack on new action.
  redoStack = [];
}

/*********************
 * Tool UI Functions
 *********************/
function updateToolHighlight() {
  // Remove active-tool class from all tool buttons.
  [brushToolBtn, eraserToolBtn, magicWandBtn].forEach(btn => {
    btn.classList.remove("active-tool");
  });
  // Add active-tool to the currently selected tool button.
  if (currentTool === "brush") {
    brushToolBtn.classList.add("active-tool");
  } else if (currentTool === "eraser") {
    eraserToolBtn.classList.add("active-tool");
  } else if (currentTool === "magicWand") {
    magicWandBtn.classList.add("active-tool");
  }
}

function toggleMainContentBackground() {
  if (isDarkBackground) {
    mainContent.style.background = "repeating-conic-gradient(#d2d2d2 0% 25%, #909090 0% 50%) 50% / 20px 20px";
  } else {
    mainContent.style.background = "repeating-conic-gradient(#222222 0% 25%, #333333 0% 50%) 50% / 20px 20px";
  }
  isDarkBackground = !isDarkBackground;
}

// Toggle background when Alt+B is pressed.
window.addEventListener("keydown", (e) => {
  if (e.altKey && e.key.toLowerCase() === "b") {
    toggleMainContentBackground();
    e.preventDefault();
  }
});

/*********************
 * Step Switching
 *********************/
function switchStep(step) {
  currentStep = step;
  step1Div.style.display = (step === 1) ? "block" : "none";
  step2Div.style.display = (step === 2) ? "block" : "none";
  step3Div.style.display = (step === 3) ? "block" : "none";

  if (step === 2) {
    // Set preview canvas size based on grid dimensions and previewCellSize.
    canvas.width = gridWidth * previewCellSize;
    canvas.height = gridHeight * previewCellSize;
    mainContent.style.overflow = "auto";
    // Recalculate image scale and offset to fit the new canvas.
    if (imgLoaded) {
      imageScale = Math.min(canvas.width / image.width, canvas.height / image.height);
      offsetX = (canvas.width - image.width * imageScale) / 2;
      offsetY = (canvas.height - image.height * imageScale) / 2;
    }
    drawPreview();
  } else if (step === 3) {
    // For editing, the canvas size will be gridWidth×canvasZoom by gridHeight×canvasZoom.
    updateCanvasSizeForEdit();
    mainContent.style.overflow = "auto";
    drawPixelArt();
    updateToolHighlight();
    // Save initial state for undo history.
    historyStack = [];
    redoStack = [];
    saveHistory();
  }
}

/*********************
 * Canvas Update Functions
 *********************/
function updateCanvasSizeForEdit() {
  canvas.width = gridWidth * canvasZoom;
  canvas.height = gridHeight * canvasZoom;
}

function drawPreview() {
  // Draw the source image and overlay grid on the preview canvas (Step 2)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#333333";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (imgLoaded) {
    ctx.drawImage(image, offsetX, offsetY, image.width * imageScale, image.height * imageScale);
  }
  // Draw grid lines for preview using gridWidth and gridHeight
  const cellW = canvas.width / gridWidth;
  const cellH = canvas.height / gridHeight;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < gridWidth; i++) {
    ctx.moveTo(i * cellW, 0);
    ctx.lineTo(i * cellW, canvas.height);
  }
  for (let j = 1; j < gridHeight; j++) {
    ctx.moveTo(0, j * cellH);
    ctx.lineTo(canvas.width, j * cellH);
  }
  ctx.stroke();
}

function drawPixelArt() {
  // Draw the pixel art on the edit canvas (Step 3)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cellW = canvas.width / gridWidth;
  const cellH = canvas.height / gridHeight;
  for (let j = 0; j < gridHeight; j++) {
    for (let i = 0; i < gridWidth; i++) {
      if (pixelColors[j][i] !== "transparent") {
        ctx.fillStyle = pixelColors[j][i];
        ctx.fillRect(i * cellW, j * cellH, cellW, cellH);
      }
    }
  }
  // Draw grid lines if toggle is checked
  if (gridToggle.checked) {
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < gridWidth; i++) {
      ctx.moveTo(i * cellW, 0);
      ctx.lineTo(i * cellW, canvas.height);
    }
    for (let j = 1; j < gridHeight; j++) {
      ctx.moveTo(0, j * cellH);
      ctx.lineTo(canvas.width, j * cellH);
    }
    ctx.stroke();
  }
  // Draw brush highlight if defined
  if (typeof highlightI === "number" && typeof highlightJ === "number") {
    const brushSize = parseInt(brushSizeSelect.value);
    ctx.strokeStyle = "rgba(255,0,0,0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      highlightI * (canvas.width / gridWidth),
      highlightJ * (canvas.height / gridHeight),
      brushSize * (canvas.width / gridWidth),
      brushSize * (canvas.height / gridHeight)
    );
  }
}

/*********************
 * Recent Colors Functions
 *********************/
function addRecentColor(color) {
  if (color === "transparent") return;
  recentColors = recentColors.filter(c => c !== color);
  recentColors.unshift(color);
  if (recentColors.length > 6) recentColors.pop();
  updateRecentColorsUI();
}

function updateRecentColorsUI() {
  if (recentColors.length === 0) {
    recentColorsSection.style.display = "none";
    return;
  }
  recentColorsSection.style.display = "block";
  recentColorsContainer.innerHTML = "";
  recentColors.forEach(color => {
    const swatch = document.createElement("div");
    swatch.className = "recent-swatch";
    swatch.style.backgroundColor = color;
    swatch.title = color;
    swatch.addEventListener("click", () => {
      currentDrawColor = color;
      drawColorPicker.value = color;
      currentTool = "brush";
      updateToolHighlight();
    });
    recentColorsContainer.appendChild(swatch);
  });
}

/*********************
 * Step 1: Setup
 *********************/
uploadBtn.addEventListener("click", () => {
  gridWidth = parseInt(gridWidthSelect.value);
  gridHeight = parseInt(gridHeightSelect.value);
  const file = imageInput.files[0];
  if (!file) {
    alert("Please select an image.");
    return;
  }
  const url = URL.createObjectURL(file);
  image.src = url;
  imgLoaded = false;
  image.onload = () => {
    URL.revokeObjectURL(url);
    imgLoaded = true;
    // Set up offscreen canvas for analysis
    originalCanvas.width = image.width;
    originalCanvas.height = image.height;
    origCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
    origCtx.drawImage(image, 0, 0);
    drawPreview();
  };
  switchStep(2);
});

/*********************
 * Step 2: Position & Convert
 *********************/
// Slider to adjust previewCellSize
previewSizeSlider.addEventListener("input", function() {
  previewCellSize = parseInt(this.value);
  previewSizeValue.textContent = this.value;
  if (currentStep === 2) {
    canvas.width = gridWidth * previewCellSize;
    canvas.height = gridHeight * previewCellSize;
    if (imgLoaded) {
      imageScale = Math.min(canvas.width / image.width, canvas.height / image.height);
      offsetX = (canvas.width - image.width * imageScale) / 2;
      offsetY = (canvas.height - image.height * imageScale) / 2;
    }
    drawPreview();
  }
});

// Zoom slider: adjust source image scale
zoomSlider.addEventListener("input", () => {
  if (!imgLoaded) return;
  let newScale = parseFloat(zoomSlider.value) / 100;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const centerOrigX = (centerX - offsetX) / imageScale;
  const centerOrigY = (centerY - offsetY) / imageScale;
  imageScale = newScale;
  offsetX = centerX - centerOrigX * imageScale;
  offsetY = centerY - centerOrigY * imageScale;
  drawPreview();
});

// Drag to reposition the image (left mouse button only)
canvas.addEventListener("pointerdown", (e) => {
  if (currentStep === 2 && imgLoaded) {
    if (e.button === 0) {
      const rect = canvas.getBoundingClientRect();
      dragStartX = (e.clientX - rect.left) * (canvas.width / rect.width);
      dragStartY = (e.clientY - rect.top) * (canvas.height / rect.height);
      dragStartOffsetX = offsetX;
      dragStartOffsetY = offsetY;
      canvas.setPointerCapture(e.pointerId);
    }
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (currentStep === 2 && imgLoaded && dragStartX !== undefined) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    offsetX = dragStartOffsetX + (x - dragStartX);
    offsetY = dragStartOffsetY + (y - dragStartY);
    drawPreview();
  }
});
canvas.addEventListener("pointerup", (e) => {
  if (currentStep === 2) {
    dragStartX = undefined;
    dragStartY = undefined;
    canvas.releasePointerCapture(e.pointerId);
  }
});

// Reset positioning button (Step 2)
//resetPositionBtn.addEventListener("click", () => {
//  if (!imgLoaded) return;
//  imageScale = Math.min(canvas.width / image.width, canvas.height / image.height);
//  offsetX = (canvas.width - image.width * imageScale) / 2;
//  offsetY = (canvas.height - image.height * imageScale) / 2;
//  zoomSlider.value = (imageScale * 100).toFixed(0);
//  drawPreview();
//});

resetPositionBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to delete everything and go back to Step 1?")) {
    resetAll();
  }
});


// Conversion: analyze image to create pixel art using selected method
convertBtn.addEventListener("click", () => {
  if (!imgLoaded) return;
  // Initialize pixelColors array with dimensions gridHeight x gridWidth
  pixelColors = Array.from({ length: gridHeight }, () => Array(gridWidth).fill("transparent"));
  const cellWCanvas = canvas.width / gridWidth;
  const cellHCanvas = canvas.height / gridHeight;
  for (let j = 0; j < gridHeight; j++) {
    for (let i = 0; i < gridWidth; i++) {
      const cx0 = i * cellWCanvas;
      const cy0 = j * cellHCanvas;
      const cx1 = cx0 + cellWCanvas;
      const cy1 = cy0 + cellHCanvas;
      const method = convMethodSelect.value;
      if (method === "most") {
        const ox0 = (cx0 - offsetX) / imageScale;
        const oy0 = (cy0 - offsetY) / imageScale;
        const ox1 = (cx1 - offsetX) / imageScale;
        const oy1 = (cy1 - offsetY) / imageScale;
        const rOx0 = Math.max(0, Math.floor(ox0));
        const rOy0 = Math.max(0, Math.floor(oy0));
        const rOx1 = Math.min(image.width, Math.ceil(ox1));
        const rOy1 = Math.min(image.height, Math.ceil(oy1));
        
        if (rOx1 <= rOx0 || rOy1 <= rOy0) {
          pixelColors[j][i] = "transparent";
          continue;
        }
        
        const imgData = origCtx.getImageData(rOx0, rOy0, rOx1 - rOx0, rOy1 - rOy0).data;
        let cellPixels = [];
        for (let idx = 0; idx < imgData.length; idx += 4) {
          const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
          if (a === 0) continue;  // Skip transparent pixels.
          cellPixels.push({ r, g, b });
        }
        
        if (cellPixels.length === 0) {
          pixelColors[j][i] = "transparent";
        } else {
          const repColor = getRepresentativeColor(cellPixels, 30);
          if (!repColor) {
            pixelColors[j][i] = "transparent";
          } else {
            pixelColors[j][i] = `#${toHex(repColor.r)}${toHex(repColor.g)}${toHex(repColor.b)}`;
          }
        }
      } else if (method === "average") {
        // Average color within the cell:
        const ox0 = (cx0 - offsetX) / imageScale;
        const oy0 = (cy0 - offsetY) / imageScale;
        const ox1 = (cx1 - offsetX) / imageScale;
        const oy1 = (cy1 - offsetY) / imageScale;
        const rOx0 = Math.max(0, Math.floor(ox0));
        const rOy0 = Math.max(0, Math.floor(oy0));
        const rOx1 = Math.min(image.width, Math.ceil(ox1));
        const rOy1 = Math.min(image.height, Math.ceil(oy1));
        if (rOx1 <= rOx0 || rOy1 <= rOy0) {
          pixelColors[j][i] = "transparent";
          continue;
        }
        const imgData = origCtx.getImageData(rOx0, rOy0, rOx1 - rOx0, rOy1 - rOy0).data;
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let idx = 0; idx < imgData.length; idx += 4) {
          const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
          if (a === 0) continue;
          sumR += r;
          sumG += g;
          sumB += b;
          count++;
        }
        if (count === 0) {
          pixelColors[j][i] = "transparent";
        } else {
          const rAvg = Math.round(sumR / count);
          const gAvg = Math.round(sumG / count);
          const bAvg = Math.round(sumB / count);
          pixelColors[j][i] = `#${toHex(rAvg)}${toHex(gAvg)}${toHex(bAvg)}`;
        }
      } else if (method === "neighbor") {
        // Neighbor-Aware Average: Expand sampling area by 25% margin on each side.
        const marginX = cellWCanvas * 0.25;
        const marginY = cellHCanvas * 0.25;
        const ecx0 = i * cellWCanvas - marginX;
        const ecy0 = j * cellHCanvas - marginY;
        const ecx1 = (i + 1) * cellWCanvas + marginX;
        const ecy1 = (j + 1) * cellHCanvas + marginY;
        const ox0 = (ecx0 - offsetX) / imageScale;
        const oy0 = (ecy0 - offsetY) / imageScale;
        const ox1 = (ecx1 - offsetX) / imageScale;
        const oy1 = (ecy1 - offsetY) / imageScale;
        const rOx0 = Math.max(0, Math.floor(ox0));
        const rOy0 = Math.max(0, Math.floor(oy0));
        const rOx1 = Math.min(image.width, Math.ceil(ox1));
        const rOy1 = Math.min(image.height, Math.ceil(oy1));
        if (rOx1 <= rOx0 || rOy1 <= rOy0) {
          pixelColors[j][i] = "transparent";
          continue;
        }
        const imgData = origCtx.getImageData(rOx0, rOy0, rOx1 - rOx0, rOy1 - rOy0).data;
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let idx = 0; idx < imgData.length; idx += 4) {
          const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
          if (a === 0) continue;
          sumR += r;
          sumG += g;
          sumB += b;
          count++;
        }
        if (count === 0) {
          pixelColors[j][i] = "transparent";
        } else {
          const rAvg = Math.round(sumR / count);
          const gAvg = Math.round(sumG / count);
          const bAvg = Math.round(sumB / count);
          pixelColors[j][i] = `#${toHex(rAvg)}${toHex(gAvg)}${toHex(bAvg)}`;
        }
      } else if (method === "most_light" || method === "most_dark") {
        const ox0 = (cx0 - offsetX) / imageScale;
        const oy0 = (cy0 - offsetY) / imageScale;
        const ox1 = (cx1 - offsetX) / imageScale;
        const oy1 = (cy1 - offsetY) / imageScale;
        const rOx0 = Math.max(0, Math.floor(ox0));
        const rOy0 = Math.max(0, Math.floor(oy0));
        const rOx1 = Math.min(image.width, Math.ceil(ox1));
        const rOy1 = Math.min(image.height, Math.ceil(oy1));
        
        if (rOx1 <= rOx0 || rOy1 <= rOy0) {
          pixelColors[j][i] = "transparent";
          continue;
        }
        
        const imgData = origCtx.getImageData(rOx0, rOy0, rOx1 - rOx0, rOy1 - rOy0).data;
        let cellPixels = [];
        for (let idx = 0; idx < imgData.length; idx += 4) {
          const r = imgData[idx],
                g = imgData[idx + 1],
                b = imgData[idx + 2],
                a = imgData[idx + 3];
          if (a === 0) continue; // Skip transparent pixels.
          cellPixels.push({ r, g, b });
        }
        
        if (cellPixels.length === 0) {
          pixelColors[j][i] = "transparent";
        } else {
          const repColor = getRepresentativeColorWeighted(cellPixels, method, 30);
          if (!repColor) {
            pixelColors[j][i] = "transparent";
          } else {
            pixelColors[j][i] = `#${toHex(repColor.r)}${toHex(repColor.g)}${toHex(repColor.b)}`;
          }
        }
      }
    }
  }
  historyStack = [];
  redoStack = [];
  saveHistory();
  conversionBackup = deepCopyPixels(pixelColors);
  switchStep(3);
});

function getRepresentativeColor(cellPixels, similarityThreshold = 30) {
  if (cellPixels.length === 0) return null;  // Added check for empty pixels

  // Count exact colors using a Map.
  const colorCounts = new Map();
  for (let i = 0; i < cellPixels.length; i++) {
    const { r, g, b } = cellPixels[i];
    const colorKey = (r << 16) | (g << 8) | b;
    colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
  }
  
  if (colorCounts.size === 1) {
    const onlyColorKey = colorCounts.keys().next().value;
    return { 
      r: (onlyColorKey >> 16) & 0xFF, 
      g: (onlyColorKey >> 8) & 0xFF, 
      b: onlyColorKey & 0xFF 
    };
  }
  
  // Convert map to an array and sort by frequency.
  const colorEntries = [];
  for (let [key, count] of colorCounts) {
    colorEntries.push({ key, count });
  }
  colorEntries.sort((a, b) => b.count - a.count);
  
  // Group similar colors.
  const clusters = [];
  for (let entry of colorEntries) {
    const colorKey = entry.key;
    const count = entry.count;
    const color = { 
      r: (colorKey >> 16) & 0xFF, 
      g: (colorKey >> 8) & 0xFF, 
      b: colorKey & 0xFF 
    };
    let matchedCluster = null;
    for (let cluster of clusters) {
      const rep = cluster.repColor;
      const dr = color.r - rep.r;
      const dg = color.g - rep.g;
      const db = color.b - rep.b;
      if ((dr * dr + dg * dg + db * db) <= similarityThreshold * similarityThreshold) {
        matchedCluster = cluster;
        break;
      }
    }
    if (matchedCluster) {
      matchedCluster.totalCount += count;
      matchedCluster.members.push({ color, count });
      const t = matchedCluster.totalCount;
      const w = count;
      matchedCluster.repColor = {
        r: Math.round((matchedCluster.repColor.r * (t - w) + color.r * w) / t),
        g: Math.round((matchedCluster.repColor.g * (t - w) + color.g * w) / t),
        b: Math.round((matchedCluster.repColor.b * (t - w) + color.b * w) / t)
      };
    } else {
      clusters.push({
        repColor: { r: color.r, g: color.g, b: color.b },
        totalCount: count,
        members: [ { color, count } ]
      });
    }
  }
  
  // Find the cluster with the highest count.
  let dominantCluster = clusters[0];
  for (let cluster of clusters) {
    if (cluster.totalCount > dominantCluster.totalCount) {
      dominantCluster = cluster;
    }
  }
  
  // Pick the most frequent color from the dominant cluster.
  let representativeColor = dominantCluster.members[0].color;
  let highestCount = dominantCluster.members[0].count;
  for (let entry of dominantCluster.members) {
    if (entry.count > highestCount) {
      representativeColor = entry.color;
      highestCount = entry.count;
    }
  }
  
  return representativeColor;
}

function getRepresentativeColorWeighted(cellPixels, method, similarityThreshold = 30) {
  if (cellPixels.length === 0) return null;  // Added check for empty pixels

  // cellPixels: an array of {r, g, b} objects.
  // method: either "most_light" or "most_dark"
  // similarityThreshold: defines how similar colors need to be to be grouped.

  // We'll build clusters where each cluster holds a weighted sum of pixel contributions.
  const clusters = [];
  
  // Process each pixel and compute its weight based on brightness.
  for (let i = 0; i < cellPixels.length; i++) {
    const { r, g, b } = cellPixels[i];
    // Calculate brightness using a standard formula.
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    let rawWeight;
    if (method === "most_light") {
      rawWeight = brightness / 255;
    } else if (method === "most_dark") {
      rawWeight = (255 - brightness) / 255;
    } else {
      rawWeight = 1; // fallback in case of an unexpected method value
    }
    const weight = 0.25 + 0.50 * rawWeight;
    
    // Create an object for this pixel.
    const pixelColor = { r, g, b, weight };

    // Try to find a cluster with a similar representative color.
    let matchedCluster = null;
    for (let cluster of clusters) {
      const rep = cluster.repColor;
      const dr = r - rep.r;
      const dg = g - rep.g;
      const db = b - rep.b;
      if ((dr * dr + dg * dg + db * db) <= similarityThreshold * similarityThreshold) {
        matchedCluster = cluster;
        break;
      }
    }
    
    if (matchedCluster) {
      // Update the cluster: add the pixel's weight.
      matchedCluster.totalWeight += weight;
      matchedCluster.members.push(pixelColor);
      
      // Recalculate the representative color as the weighted average of the cluster.
      let sumR = 0, sumG = 0, sumB = 0;
      for (let member of matchedCluster.members) {
        sumR += member.r * member.weight;
        sumG += member.g * member.weight;
        sumB += member.b * member.weight;
      }
      matchedCluster.repColor = {
        r: Math.round(sumR / matchedCluster.totalWeight),
        g: Math.round(sumG / matchedCluster.totalWeight),
        b: Math.round(sumB / matchedCluster.totalWeight)
      };
    } else {
      // Start a new cluster with this pixel.
      clusters.push({
        repColor: { r, g, b },
        totalWeight: weight,
        members: [ pixelColor ]
      });
    }
  }
  
  // Find the cluster with the highest total weight.
  let dominantCluster = clusters[0];
  for (let cluster of clusters) {
    if (cluster.totalWeight > dominantCluster.totalWeight) {
      dominantCluster = cluster;
    }
  }
  
  // Return the representative color of the dominant cluster.
  return dominantCluster.repColor;
}


/*********************
 * Step 3: Edit & Export
 *********************/
// Update canvas size when canvas zoom slider changes
canvasZoomSlider.addEventListener("input", () => {
  canvasZoom = parseFloat(canvasZoomSlider.value);
  updateCanvasSizeForEdit();
  drawPixelArt();
});
resetCanvasZoomBtn.addEventListener("click", () => {
  canvasZoom = 1;
  canvasZoomSlider.value = "1";
  updateCanvasSizeForEdit();
  drawPixelArt();
});

// Update brush highlight on pointer move in Step 3 (for brush preview)
canvas.addEventListener("pointermove", (e) => {
  if (currentStep === 3) {
    updateHighlight(e);
    if (drawingActive) {
      handleDrawing(e);
    } else {
      drawPixelArt();
    }
  }
});

canvas.addEventListener("pointerdown", (e) => {
  if (currentStep === 3) {
    if (e.button === 0) { // left-click
      if (currentTool === "magicWand") {
        // When Magic Wand is active, perform flood fill once (do not set drawingActive)
        const rect = canvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
        const cellW = canvas.width / gridWidth;
        const cellH = canvas.height / gridHeight;
        let i = Math.floor(cx / cellW);
        let j = Math.floor(cy / cellH);
        const brushSize = parseInt(brushSizeSelect.value);
        const startI = i;
        const startJ = j;
        const endI = Math.min(gridWidth - 1, i + brushSize - 1);
        const endJ = Math.min(gridHeight - 1, j + brushSize - 1);
        // Collect all unique non-transparent colors in the brush area.
        let colorsToDelete = new Set();
        for (let m = startJ; m <= endJ; m++) {
          for (let n = startI; n <= endI; n++) {
            let col = pixelColors[m][n];
            if (col !== "transparent") {
              colorsToDelete.add(col);
            }
          }
        }
        // For each unique color, run flood fill from the first cell in the brush area with that color.
        colorsToDelete.forEach(color => {
          let filled = false;
          for (let m = startJ; m <= endJ && !filled; m++) {
            for (let n = startI; n <= endI && !filled; n++) {
              if (pixelColors[m][n] === color) {
                floodFill(m, n, color, "transparent");
                filled = true;
              }
            }
          }
        });
        saveHistory();
        drawPixelArt();
      } else {
        // For Brush and Eraser tools:
        drawingActive = true;
        if (currentTool === "brush" || currentTool === "eraser") {
          if (currentDrawColor !== "transparent") {
            addRecentColor(currentDrawColor);
          }
          handleDrawing(e);
        }
      }
      e.preventDefault();
    }
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (currentStep === 3) {
    // If Magic Wand is selected, do not call handleDrawing (so no continuous fill)
    if (currentTool !== "magicWand") {
      updateHighlight(e);
      if (drawingActive) {
        handleDrawing(e);
      } else {
        drawPixelArt();
      }
    } else {
      updateHighlight(e);
      drawPixelArt();
    }
  }
});

canvas.addEventListener("pointerup", (e) => {
  if (currentStep === 3 && e.button === 0) {
    drawingActive = false;
    if (drawingOccurred) {
      saveHistory();
      drawingOccurred = false;
    }
  }
});

// New: Global pointerup and pointercancel events to catch releases outside the canvas.
window.addEventListener("pointerup", (e) => {
  if (currentStep === 3 && drawingActive) {
    drawingActive = false;
    drawPixelArt();
  }
});
window.addEventListener("pointercancel", (e) => {
  if (currentStep === 3 && drawingActive) {
    drawingActive = false;
    drawPixelArt();
  }
});

// Calculate and update brush highlight based on pointer position
function updateHighlight(e) {
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
  const cellW = canvas.width / gridWidth;
  const cellH = canvas.height / gridHeight;
  let i = Math.floor(cx / cellW);
  let j = Math.floor(cy / cellH);
  i = Math.max(0, Math.min(gridWidth - 1, i));
  j = Math.max(0, Math.min(gridHeight - 1, j));
  highlightI = i;
  highlightJ = j;
}

// Handle drawing: fill cells based on selected brush size.
function handleDrawing(e) {
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
  const cellW = canvas.width / gridWidth;
  const cellH = canvas.height / gridHeight;
  let i = Math.floor(cx / cellW);
  let j = Math.floor(cy / cellH);
  i = Math.max(0, Math.min(gridWidth - 1, i));
  j = Math.max(0, Math.min(gridHeight - 1, j));
  const brushSize = parseInt(brushSizeSelect.value);
  for (let dj = 0; dj < brushSize; dj++) {
    for (let di = 0; di < brushSize; di++) {
      let ni = Math.min(i + di, gridWidth - 1);
      let nj = Math.min(j + dj, gridHeight - 1);
      pixelColors[nj][ni] = currentDrawColor;
    }
  }
  drawingOccurred = true;
  drawPixelArt();
}

// Flood fill for Magic Wand tool (simple 4-directional fill)
function floodFill(startRow, startCol, targetColor, replacementColor) {
  if (targetColor === replacementColor) return;
  const stack = [];
  stack.push({ row: startRow, col: startCol });
  while (stack.length) {
    const { row, col } = stack.pop();
    if (row < 0 || row >= gridHeight || col < 0 || col >= gridWidth) continue;
    const currentColor = pixelColors[row][col];
    if (currentColor === "transparent") continue;
    // Use color distance comparison instead of strict equality.
    if (colorDistance(currentColor, targetColor) > magicWandThreshold) continue;
    pixelColors[row][col] = replacementColor;
    stack.push({ row: row - 1, col: col });
    stack.push({ row: row + 1, col: col });
    stack.push({ row: row, col: col - 1 });
    stack.push({ row: row, col: col + 1 });
  }
}

function hexToRGB(hex) {
  // Returns an object {r, g, b} for a hex color in the format "#RRGGBB"
  hex = hex.replace("#", "");
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  };
}

function colorDistance(hex1, hex2) {
  const rgb1 = hexToRGB(hex1);
  const rgb2 = hexToRGB(hex2);
  const dr = rgb1.r - rgb2.r;
  const dg = rgb1.g - rgb2.g;
  const db = rgb1.b - rgb2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}


// Tool button event listeners
brushToolBtn.addEventListener("click", () => {
  currentTool = "brush";
  // When brush is selected, restore the color picker value if not transparent.
  if (drawColorPicker.value !== "#000000") {
    currentDrawColor = drawColorPicker.value;
  }
  updateToolHighlight();
});
eraserToolBtn.addEventListener("click", () => {
  currentTool = "eraser";
  currentDrawColor = "transparent";
  updateToolHighlight();
});
magicWandBtn.addEventListener("click", () => {
  currentTool = "magicWand";
  updateToolHighlight();
});

// Update drawing color from the color picker
drawColorPicker.addEventListener("input", () => {
  currentTool = "brush";
  currentDrawColor = drawColorPicker.value;
  updateToolHighlight();
});
transparentBtn.addEventListener("click", () => {
  currentTool = "eraser";
  currentDrawColor = "transparent";
  updateToolHighlight();
});

// Undo/Redo: Listen for Ctrl+Z (undo) and Ctrl+Y (redo)
window.addEventListener("keydown", (e) => {
  if (currentStep !== 3) return;
  if (e.ctrlKey && e.key === "z") {
    // Undo
    if (historyStack.length > 1) {
      redoStack.push(historyStack.pop());
      pixelColors = deepCopyPixels(historyStack[historyStack.length - 1]);
      drawPixelArt();
    }
    e.preventDefault();
  } else if (e.ctrlKey && e.key === "y") {
    // Redo
    if (redoStack.length > 0) {
      const state = redoStack.pop();
      historyStack.push(deepCopyPixels(state));
      pixelColors = deepCopyPixels(state);
      drawPixelArt();
    }
    e.preventDefault();
  }
});

// Reset button: confirmation alert then reset everything to Step 1.
resetEditBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to reset everything and go back to Step 1?")) {
    resetAll();
  }
});

// Export pixel art as PNG at native resolution (each cell becomes one pixel)
//exportBtn.addEventListener("click", () => {
//  const exportCanvas = document.createElement("canvas");
//  exportCanvas.width = gridWidth;
//  exportCanvas.height = gridHeight;
//  const exportCtx = exportCanvas.getContext("2d");
//  for (let j = 0; j < gridHeight; j++) {
//    for (let i = 0; i < gridWidth; i++) {
//      if (pixelColors[j][i] !== "transparent") {
//        exportCtx.fillStyle = pixelColors[j][i];
//        exportCtx.fillRect(i, j, 1, 1);
//      }
//    }
//  }
//  const dataURL = exportCanvas.toDataURL("image/png");
//  const link = document.createElement("a");
//  link.href = dataURL;
//  link.download = `pixel_art_${gridWidth}x${gridHeight}.png`;
//  document.body.appendChild(link);
//  link.click();
//  document.body.removeChild(link);
//});

function exportImage(scale) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = gridWidth * scale;
  exportCanvas.height = gridHeight * scale;
  const exportCtx = exportCanvas.getContext("2d");
  for (let j = 0; j < gridHeight; j++) {
    for (let i = 0; i < gridWidth; i++) {
      if (pixelColors[j][i] !== "transparent") {
        exportCtx.fillStyle = pixelColors[j][i];
        exportCtx.fillRect(i * scale, j * scale, scale, scale);
      }
    }
  }
  const dataURL = exportCanvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = `pixel_art_${gridWidth}x${gridHeight}_x${scale}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


/*********************
 * Reset All Function
 *********************/
function resetAll() {
  currentStep = 1;
  imgLoaded = false;
  image = new Image();
  pixelColors = [];
  conversionBackup = [];
  recentColors = [];
  historyStack = [];
  redoStack = [];
  drawingOccurred = false;
  highlightI = undefined;
  highlightJ = undefined;
  currentTool = "brush";
  // Reset UI elements
  gridWidthSelect.value = "16";
  gridHeightSelect.value = "16";
  imageInput.value = "";
  drawColorPicker.value = "#000000";
  currentDrawColor = "#000000";
  canvasZoom = 1;
  canvasZoomSlider.value = "1";
  previewSizeSlider.value = "4";
  previewSizeValue.textContent = "4";
  previewCellSize = 4;
  recentColorsContainer.innerHTML = "";
  recentColorsSection.style.display = "none";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  switchStep(1);
}

/*********************
 * Initialize
 *********************/
switchStep(1);
