# Plottery - G-code Visualizer for Pen Plotters

A web-based G-code visualizer and job management tool for pen plotters.

## Features

- Upload or paste G-code files
- 2D top-down visualization using HTML Canvas
- Y-axis flipped (origin at top-left, Y increases downward)
- Support for G0, G1, G2, G3 commands:
  - G0 (rapid moves) shown as dashed gray lines
  - G1 (drawing moves) shown as solid black lines
  - G2/G3 (arc moves) with radius (R) and center (I/J) format support
- Line color based on Z height (lower Z = darker color)
- Bounding box display around drawing area
- Manual jogging controls for X/Y/Z
- Job sending functionality (stub for now)
- Current tool position shown as a red dot

## Setup and Installation

1. Clone this repository
2. Create a virtual environment (recommended):
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install the dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Run the application:
   ```
   python app.py
   ```
5. Open your browser and navigate to `http://127.0.0.1:5000`

## Usage

- Paste G-code into the text area or upload a .gcode file
- Click "Visualize" to render the G-code on the canvas
- Use jogging controls to move the virtual tool
- Click "Send Job" to send the job to the plotter (currently just logs to console)

## Project Structure

- `app.py` - Flask application entry point
- `templates/` - HTML templates
- `static/` - Static assets
  - `css/style.css` - Main stylesheet
  - `js/gcode-parser.js` - G-code parsing logic
  - `js/gcode-renderer.js` - Canvas rendering logic
  - `js/visualizer.js` - Main application logic

## Technical Details

- Built as a Flask web application
- Frontend uses HTML5 Canvas for visualization
- Modular JavaScript architecture:
  - GCodeParser class for parsing G-code
  - GCodeRenderer class for canvas rendering
- Modern JavaScript (ES6+)
- Responsive design

## Future Enhancements

- Real plotter communication via serial port
- Job queue management
- G-code generation from SVG files
- More advanced visualization features