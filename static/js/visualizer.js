document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const canvas = document.getElementById('gcode-canvas');
    const gcodeInput = document.getElementById('gcode-input');
    const parseBtn = document.getElementById('parse-btn');
    const clearBtn = document.getElementById('clear-btn');
    const loadFileBtn = document.getElementById('load-file-btn');
    const fileInput = document.getElementById('file-input');
    const sendJobBtn = document.getElementById('send-job-btn');
    const jogBtns = document.querySelectorAll('.jog-btn');
    const bboxInfo = document.getElementById('bbox-info');
    const posXEl = document.getElementById('pos-x');
    const posYEl = document.getElementById('pos-y');
    const posZEl = document.getElementById('pos-z');
    
    // Create parser and renderer instances
    const parser = new GCodeParser();
    const renderer = new GCodeRenderer(canvas);
    
    // State variables
    let gcodeLines = [];
    let currentPosition = { x: 0, y: 0, z: 0 };
    const penUpZ = 1;  // Z height considered "pen up"
    
    // Initialize canvas
    renderer.clearCanvas();
    
    // Event Listeners
    parseBtn.addEventListener('click', parseAndRender);
    clearBtn.addEventListener('click', clearAll);
    loadFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    sendJobBtn.addEventListener('click', sendJob);
    
    // Jog button event listeners
    jogBtns.forEach(btn => {
        btn.addEventListener('click', handleJog);
    });
    
    // Functions
    function parseAndRender() {
        const gcode = gcodeInput.value.trim();
        if (!gcode) {
            alert('Please enter G-code first');
            return;
        }
        
        // Parse G-code
        parser.parseGcode(gcode);
        
        // Get results
        const parsedCommands = parser.getParsedCommands();
        const boundingBox = parser.getBoundingBox();
        
        // Render G-code
        renderer.render(parsedCommands, boundingBox);
        updateInfoBox(boundingBox);
    }
    
    function clearAll() {
        gcodeInput.value = '';
        currentPosition = { x: 0, y: 0, z: 0 };
        renderer.setCurrentPosition(0, 0, 0);
        updatePositionDisplay();
        renderer.clearCanvas();
        bboxInfo.textContent = 'No G-code loaded';
    }
    
    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            gcodeInput.value = e.target.result;
            // Auto visualize after file load
            parseAndRender();
        };
        reader.readAsText(file);
    }
    
    function handleJog(e) {
        const btn = e.target;
        const axis = btn.dataset.axis;
        const dir = parseInt(btn.dataset.dir || 0);
        const step = 10; // Step size for jogging
        
        if (axis === 'home') {
            currentPosition = { x: 0, y: 0, z: 0 };
        } else if (axis === 'x') {
            currentPosition.x += dir * step;
        } else if (axis === 'y') {
            currentPosition.y += dir * step;
        } else if (axis === 'z') {
            // In this G-code, higher Z values (Z5) are drawing moves, Z0.5 is pen up
            currentPosition.z = dir > 0 ? 5 : 0.5; // Pen down is Z5, pen up is Z0.5
        }
        
        // Update renderer's current position
        renderer.setCurrentPosition(currentPosition.x, currentPosition.y, currentPosition.z);
        
        // Re-render to show the updated position
        const parsedCommands = parser.getParsedCommands();
        const boundingBox = parser.getBoundingBox();
        renderer.render(parsedCommands, boundingBox);
        
        updatePositionDisplay();
    }
    
    function sendJob() {
        const gcode = gcodeInput.value.trim();
        if (!gcode) {
            alert('Please enter G-code first');
            return;
        }
        
        // Send job to backend
        fetch('/api/send_job', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ gcode: gcode }),
        })
        .then(response => response.json())
        .then(data => {
            alert(`Job sent successfully: ${data.message}\n\nPreview: ${data.preview}`);
        })
        .catch(error => {
            console.error('Error sending job:', error);
            alert('Error sending job. Check console for details.');
        });
    }
    
    function updateInfoBox(boundingBox) {
        if (!boundingBox || boundingBox.minX === Infinity) {
            bboxInfo.textContent = 'No G-code loaded';
        } else {
            bboxInfo.textContent = `X: ${boundingBox.minX.toFixed(2)} to ${boundingBox.maxX.toFixed(2)}, Y: ${boundingBox.minY.toFixed(2)} to ${boundingBox.maxY.toFixed(2)}`;
        }
        
        updatePositionDisplay();
    }
    
    function updatePositionDisplay() {
        posXEl.textContent = currentPosition.x.toFixed(2);
        posYEl.textContent = currentPosition.y.toFixed(2);
        posZEl.textContent = currentPosition.z.toFixed(2);
    }
    
    // Load sample G-code for testing
    const sampleGcode = `G21
G90
S1000
G0 Z0.50
G0 X0 Y0
G0 Z0.50 F8000
G00 X34.8533 Y43.9650
G0 Z5.00 F8000
G02 X44.0187 Y66.0922 I31.2925 J0.0000
G02 X66.1458 Y75.2576 I22.1272 J-22.1272
G02 X88.2730 Y66.0922 I0.0000 J-31.2925
G02 X97.4384 Y43.9650 I-22.1272 J-22.1272
G02 X88.2730 Y21.8379 I-31.2925 J0.0000
G02 X66.1458 Y12.6725 I-22.1272 J22.1272
G02 X44.0187 Y21.8379 I0.0000 J31.2925
G02 X34.8533 Y43.9650 I22.1272 J22.1272
G0 Z0.50 F8000
G00 X34.8533 Y88.3266
G0 Z5.00 F8000
G02 X44.0187 Y110.4538 I31.2925 J0.0000
G02 X66.1458 Y119.6192 I22.1272 J-22.1272
G02 X88.2730 Y110.4538 I0.0000 J-31.2925
G02 X97.4384 Y88.3266 I-22.1272 J-22.1272
G02 X88.2730 Y66.1995 I-31.2925 J0.0000
G02 X66.1458 Y57.0341 I-22.1272 J22.1272
G02 X44.0187 Y66.1995 I0.0000 J31.2925
G02 X34.8533 Y88.3266 I22.1272 J22.1272
G0 Z0.50 F8000
G00 X55.4485 Y58.8947
G0 Z5.00 F8000
G01 X46.2193 Y68.1239
G0 Z0.50 F8000
G00 X61.3534 Y57.4442
G0 Z5.00 F8000
G01 X48.8005 Y69.9974
G0 Z0.50 F8000
G00 X66.1826 Y57.0698
G0 Z5.00 F8000
G01 X51.5437 Y71.7087
G0 Z0.50 F8000
G00 X70.3696 Y57.3373
G0 Z5.00 F8000
G01 X54.6256 Y73.0814
G0 Z0.50 F8000
G00 X74.0730 Y58.0887
G0 Z5.00 F8000
G01 X57.9649 Y74.1968
G0 Z0.50 F8000
G00 X77.4417 Y59.1746
G0 Z5.00 F8000
G01 X61.6590 Y74.9573
G0 Z0.50 F8000
G00 X80.5148 Y60.5562
G0 Z5.00 F8000
G01 X65.7453 Y75.3258
G0 Z0.50 F8000
G00 X83.3353 Y62.1906
G0 Z5.00 F8000
G01 X70.5580 Y74.9676
G0 Z0.50 F8000
G00 X85.9049 Y64.0755
G0 Z5.00 F8000
G01 X76.4051 Y73.5753
G0 X0.00 Y0.00 Z0.00
M2`;

    gcodeInput.value = sampleGcode;
    // Auto visualize on load
    setTimeout(parseAndRender, 500);
});