/**
 * G-code Renderer
 * Renders G-code commands on an HTML Canvas
 */

class GCodeRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scale = 1;
        this.offsetX = 20;
        this.offsetY = 20;
        this.penUpZ = 1; // Z height considered "pen up"
        this.currentPosition = { x: 0, y: 0, z: 0 };
        this.arcResolution = 120; // Number of segments to use when rendering arcs (higher = smoother)
    }
    
    setCurrentPosition(x, y, z) {
        this.currentPosition = { x, y, z };
        // This doesn't redraw automatically - call render to see the update
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw empty grid as background
        this.ctx.strokeStyle = '#eee';
        this.ctx.lineWidth = 1;
        
        // Draw grid lines
        const gridSize = 50;
        
        // Vertical lines
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    calculateScale(boundingBox) {
        const padding = 40; // Padding in pixels
        const canvasWidth = this.canvas.width - padding * 2;
        const canvasHeight = this.canvas.height - padding * 2;
        
        const rangeX = boundingBox.maxX - boundingBox.minX || 1;
        const rangeY = boundingBox.maxY - boundingBox.minY || 1;
        
        const scaleX = canvasWidth / rangeX;
        const scaleY = canvasHeight / rangeY;
        
        // Use the smaller scale to ensure everything fits
        this.scale = Math.min(scaleX, scaleY);
        
        // Calculate offset to center the drawing
        this.offsetX = padding + (canvasWidth - rangeX * this.scale) / 2 - boundingBox.minX * this.scale;
        this.offsetY = padding + (canvasHeight - rangeY * this.scale) / 2 - boundingBox.minY * this.scale;
    }
    
    transformX(x) {
        return x * this.scale + this.offsetX;
    }
    
    transformY(y) {
        // Flip Y-axis so +Y points down (screen coordinates)
        return this.canvas.height - (y * this.scale + this.offsetY);
    }
    
    drawBoundingBox(boundingBox) {
        const minX = this.transformX(boundingBox.minX);
        const maxX = this.transformX(boundingBox.maxX);
        const minY = this.transformY(boundingBox.maxY); // Note the flip
        const maxY = this.transformY(boundingBox.minY); // Note the flip
        
        this.ctx.beginPath();
        this.ctx.rect(minX, minY, maxX - minX, maxY - minY);
        this.ctx.strokeStyle = '#3498db';
        this.ctx.setLineDash([5, 5]);
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
    
    render(parsedCommands, boundingBox) {
        this.clearCanvas();
        
        if (parsedCommands.length === 0) return;
        
        // Calculate scale to fit canvas
        this.calculateScale(boundingBox);
        
        // Draw bounding box
        this.drawBoundingBox(boundingBox);
        
        // Draw G-code paths
        parsedCommands.forEach(cmd => {
            this.renderCommand(cmd);
        });
        
        // Draw current position
        this.drawCurrentPosition();
    }
    
    renderCommand(cmd) {
        if (cmd.mode === 'G0' || cmd.mode === 'G1') {
            // Linear movement
            this.drawLine(cmd);
        } 
        else if (cmd.mode === 'G2' || cmd.mode === 'G3') {
            // Arc movement - using high-quality smooth arc rendering
            this.drawSmoothArc(cmd);
        }
    }
    
    drawLine(cmd) {
        const fromX = this.transformX(cmd.from.x);
        const fromY = this.transformY(cmd.from.y);
        const toX = this.transformX(cmd.to.x);
        const toY = this.transformY(cmd.to.y);
        
        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(toX, toY);
        
        this.setStrokeStyleForCommand(cmd);
        this.ctx.stroke();
    }
    
    drawSmoothArc(cmd) {
        // Extract coordinates in real-world units
        const fromX = cmd.from.x;
        const fromY = cmd.from.y;
        const toX = cmd.to.x;
        const toY = cmd.to.y;
        
        let centerX, centerY, radius, startAngle, endAngle;
        
        // Calculate arc parameters
        if (cmd.i !== undefined && cmd.j !== undefined) {
            // I/J format (center relative to start point)
            centerX = fromX + cmd.i;
            centerY = fromY + cmd.j;
            
            // Calculate radius from center to start point
            radius = Math.sqrt(Math.pow(fromX - centerX, 2) + Math.pow(fromY - centerY, 2));
            
            // Calculate angles for arc drawing
            startAngle = Math.atan2(fromY - centerY, fromX - centerX);
            endAngle = Math.atan2(toY - centerY, toX - centerX);
            
        } else if (cmd.r !== undefined) {
            // R format (radius)
            radius = Math.abs(cmd.r);
            const dx = toX - fromX;
            const dy = toY - fromY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Check if valid arc is possible
            if (dist > 2 * radius) {
                console.warn('Arc radius too small for endpoints, drawing line instead');
                this.drawLine(cmd);
                return;
            }
            
            // Find center point(s) - there are two possibilities
            const midX = (fromX + toX) / 2;
            const midY = (fromY + toY) / 2;
            
            // Distance from midpoint to center
            const h = Math.sqrt(radius * radius - (dist / 2) * (dist / 2));
            
            // Unit vector perpendicular to line from start to end
            let nx, ny;
            if (Math.abs(dy) < 1e-10) {
                // Horizontal line
                nx = 0;
                ny = 1;
            } else if (Math.abs(dx) < 1e-10) {
                // Vertical line
                nx = 1;
                ny = 0;
            } else {
                // General case
                const slope = -dx / dy;
                const len = Math.sqrt(1 + slope * slope);
                nx = slope / len;
                ny = 1 / len;
            }
            
            // Choose center based on clockwise/counterclockwise and sign of radius
            const centerSign = (cmd.clockwise === (cmd.r < 0)) ? -1 : 1;
            if (cmd.mode === 'G3') {
                // G3 is counterclockwise, so invert
                centerSign *= -1;
            }
            
            centerX = midX + centerSign * h * nx;
            centerY = midY + centerSign * h * ny;
            
            // Calculate angles
            startAngle = Math.atan2(fromY - centerY, fromX - centerX);
            endAngle = Math.atan2(toY - centerY, toX - centerX);
        } else {
            console.error('Arc command missing center or radius information');
            return;
        }
        
        // Set stroke style before drawing
        this.setStrokeStyleForCommand(cmd);
        
        // Adjust angles for drawing direction
        // In JS canvas arc method, angles are measured clockwise from positive x-axis
        // And we need to handle the Y-axis flip
        
        // Check if we need a full circle
        const isFullCircle = (Math.abs(fromX - toX) < 1e-5 && 
                             Math.abs(fromY - toY) < 1e-5);
        
        if (isFullCircle) {
            // Draw a full circle
            this.drawSmoothCircle(centerX, centerY, radius, cmd);
        } else {
            // Draw an arc
            const clockwise = cmd.mode === 'G2'; // G2 is clockwise, G3 is counterclockwise
            this.drawSmoothArcSegment(centerX, centerY, radius, startAngle, endAngle, clockwise, cmd);
        }
    }
    
    drawSmoothCircle(centerX, centerY, radius, cmd) {
        // Transform to canvas coordinates
        const canvasCenterX = this.transformX(centerX);
        const canvasCenterY = this.transformY(centerY);
        const canvasRadius = radius * this.scale;
        
        this.ctx.beginPath();
        this.ctx.arc(canvasCenterX, canvasCenterY, canvasRadius, 0, 2 * Math.PI);
        this.ctx.stroke();
    }
    
    drawSmoothArcSegment(centerX, centerY, radius, startAngle, endAngle, clockwise, cmd) {
        // For smoother arcs, we'll manually create a polyline with many segments
        // This gives us more control over the quality

        // Transform center to canvas coordinates
        const canvasCenterX = this.transformX(centerX);
        const canvasCenterY = this.transformY(centerY);
        const canvasRadius = radius * this.scale;
        
        // Since we flipped Y-axis, the angles and direction in canvas are different
        // We need to adjust them
        
        // In canvas coords with flipped Y, angles are opposite
        const canvasStartAngle = -startAngle;
        const canvasEndAngle = -endAngle;
        
        // In canvas with flipped Y, clockwise in real world is counterclockwise in canvas
        const canvasClockwise = !clockwise;
        
        // Calculate correct sweep angle
        let sweepAngle = canvasEndAngle - canvasStartAngle;
        
        // Normalize sweep angle based on direction
        if (canvasClockwise) {
            // If going clockwise in canvas (counterclockwise in real world)
            if (sweepAngle > 0) sweepAngle -= 2 * Math.PI;
            if (sweepAngle === 0) sweepAngle = -2 * Math.PI;
        } else {
            // If going counterclockwise in canvas (clockwise in real world)
            if (sweepAngle < 0) sweepAngle += 2 * Math.PI;
            if (sweepAngle === 0) sweepAngle = 2 * Math.PI;
        }
        
        // Create a smooth polyline for the arc
        this.ctx.beginPath();
        
        // Number of segments to use for the arc
        const numSegments = this.arcResolution;
        const angleStep = sweepAngle / numSegments;
        
        // Start at the startAngle
        let angle = canvasStartAngle;
        let x = canvasCenterX + canvasRadius * Math.cos(angle);
        let y = canvasCenterY + canvasRadius * Math.sin(angle);
        this.ctx.moveTo(x, y);
        
        // Draw each segment of the arc
        for (let i = 1; i <= numSegments; i++) {
            angle = canvasStartAngle + i * angleStep;
            x = canvasCenterX + canvasRadius * Math.cos(angle);
            y = canvasCenterY + canvasRadius * Math.sin(angle);
            this.ctx.lineTo(x, y);
        }
        
        // Apply the current style and stroke
        this.ctx.stroke();
    }
    
    setStrokeStyleForCommand(cmd) {
        if (cmd.mode === 'G0') {
            // Rapid move - dashed gray line
            this.ctx.strokeStyle = '#aaa';
            this.ctx.setLineDash([5, 3]);
        } else if (cmd.mode === 'G1') {
            // Drawing move - solid line with color based on Z height
            const isPenDown = cmd.to.z > this.penUpZ;
            
            if (isPenDown) {
                // Darker when pen is down
                const zDepth = Math.min(1, Math.max(0, cmd.to.z / 10)); // Normalized between 0-1
                const color = Math.floor(40 + 180 * (1 - zDepth)); // Darker for higher Z values
                this.ctx.strokeStyle = `rgb(${color}, ${color}, ${color})`;
            } else {
                // Light gray when pen is up
                this.ctx.strokeStyle = '#ccc';
            }
            this.ctx.setLineDash([]);
        } else if (cmd.mode === 'G2' || cmd.mode === 'G3') {
            // Arc moves - solid blue-black line based on Z height
            const isPenDown = cmd.to.z > this.penUpZ;
            
            if (isPenDown) {
                // Blue-black when pen is down
                const zDepth = Math.min(1, Math.max(0, cmd.to.z / 10)); // Normalized between 0-1
                const r = Math.floor(20 * (1 - zDepth));
                const g = Math.floor(50 + 40 * (1 - zDepth));
                const b = Math.floor(100 + 80 * (1 - zDepth));
                this.ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
            } else {
                // Light blue when pen is up
                this.ctx.strokeStyle = '#a6d0ff';
            }
            this.ctx.setLineDash([]);
        }
        
        this.ctx.lineWidth = 2;
    }
    
    drawCurrentPosition() {
        const currentX = this.transformX(this.currentPosition.x);
        const currentY = this.transformY(this.currentPosition.y);
        
        this.ctx.beginPath();
        this.ctx.arc(currentX, currentY, 6, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'red';
        this.ctx.fill();
    }
}