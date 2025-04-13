/**
 * G-code Parser
 * Parses G-code and converts it to a sequence of drawing commands
 */

class GCodeParser {
    constructor() {
        this.parsedCommands = [];
        this.boundingBox = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        this.penUpZ = 0.5; // Z height considered "pen up"
    }

    parseGcode(gcode) {
        const lines = gcode.split('\n');
        this.parsedCommands = [];
        
        let currentMode = 'G0'; // Default mode is rapid move
        let position = { x: 0, y: 0, z: 0 }; // Starting position
        let isAbsolute = true; // G90 by default (absolute positioning)
        let feedRate = 0; // Feed rate for moves
        
        lines.forEach(line => {
            // Remove comments and trim
            line = line.split(';')[0].trim();
            if (!line) return;
            
            const parts = line.split(/\s+/);
            
            // Check for positioning mode
            if (parts.includes('G90')) {
                isAbsolute = true;
                return;
            } else if (parts.includes('G91')) {
                isAbsolute = false;
                return;
            }
            
            // Check for G command (movement mode)
            const gMatch = parts.find(p => /^G0*[0-3](\.|$)/.test(p));
            if (gMatch) {
                // Normalize G command format (G0, G00, G01 -> G0, G0, G1)
                const gNum = gMatch.match(/^G0*([0-3])(\.|$)/)[1];
                currentMode = 'G' + gNum;
            }
            
            // Extract coordinates and parameters
            const xMatch = parts.find(p => /^X-?\d*\.?\d*/.test(p));
            const yMatch = parts.find(p => /^Y-?\d*\.?\d*/.test(p));
            const zMatch = parts.find(p => /^Z-?\d*\.?\d*/.test(p));
            const iMatch = parts.find(p => /^I-?\d*\.?\d*/.test(p));
            const jMatch = parts.find(p => /^J-?\d*\.?\d*/.test(p));
            const rMatch = parts.find(p => /^R-?\d*\.?\d*/.test(p));
            const fMatch = parts.find(p => /^F-?\d*\.?\d*/.test(p));
            
            // Update feed rate if specified
            if (fMatch) {
                feedRate = parseFloat(fMatch.substring(1));
            }
            
            // Skip non-movement lines with no coordinates
            if (!xMatch && !yMatch && !zMatch && !['G2', 'G3'].includes(currentMode)) {
                return;
            }
            
            // If Z changes and it's the only change, it's a pen up/down move
            if (zMatch && !xMatch && !yMatch) {
                const z = parseFloat(zMatch.substring(1));
                const newZ = isAbsolute ? z : position.z + z;
                
                // Determine if it's a pen up or pen down operation
                const isPenDown = newZ > this.penUpZ;
                
                // Create a special pen up/down command
                const command = {
                    mode: currentMode,
                    from: { ...position },
                    to: { ...position, z: newZ },
                    feedRate: feedRate
                };
                
                position.z = newZ;
                this.parsedCommands.push(command);
                return;
            }
            
            // Create command object
            const command = {
                mode: currentMode,
                from: { ...position },
                feedRate: feedRate
            };
            
            // Parse coordinates
            let newX = position.x;
            let newY = position.y;
            let newZ = position.z;
            
            if (xMatch) {
                const x = parseFloat(xMatch.substring(1));
                newX = isAbsolute ? x : position.x + x;
            }
            
            if (yMatch) {
                const y = parseFloat(yMatch.substring(1));
                newY = isAbsolute ? y : position.y + y;
            }
            
            if (zMatch) {
                const z = parseFloat(zMatch.substring(1));
                newZ = isAbsolute ? z : position.z + z;
            }
            
            // For arcs, we need center or radius
            if (currentMode === 'G2' || currentMode === 'G3') {
                command.clockwise = currentMode === 'G2';
                
                if (iMatch && jMatch) {
                    // Arc center format
                    command.i = parseFloat(iMatch.substring(1)); // Relative to start X
                    command.j = parseFloat(jMatch.substring(1)); // Relative to start Y
                } else if (rMatch) {
                    // Radius format
                    command.r = parseFloat(rMatch.substring(1));
                } else {
                    // Missing arc parameters, treat as linear move
                    console.warn('Arc command missing I/J or R parameters, treating as linear move');
                    command.mode = 'G1';
                }
            }
            
            // Update position
            position = { x: newX, y: newY, z: newZ };
            command.to = { ...position };
            
            // Add command to list
            this.parsedCommands.push(command);
        });
        
        // Calculate bounding box after parsing
        this.calculateBoundingBox();
        
        return this.parsedCommands;
    }
    
    calculateBoundingBox() {
        if (this.parsedCommands.length === 0) return;
        
        this.boundingBox = {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity
        };
        
        // For straight lines, just check endpoints
        this.parsedCommands.forEach(cmd => {
            if (cmd.mode === 'G0' || cmd.mode === 'G1') {
                this.updateBoundingBoxForPoint(cmd.from.x, cmd.from.y);
                this.updateBoundingBoxForPoint(cmd.to.x, cmd.to.y);
            } else if (cmd.mode === 'G2' || cmd.mode === 'G3') {
                // For arcs, we need to find extreme points
                this.calculateArcBoundingBox(cmd);
            }
        });
    }
    
    updateBoundingBoxForPoint(x, y) {
        this.boundingBox.minX = Math.min(this.boundingBox.minX, x);
        this.boundingBox.maxX = Math.max(this.boundingBox.maxX, x);
        this.boundingBox.minY = Math.min(this.boundingBox.minY, y);
        this.boundingBox.maxY = Math.max(this.boundingBox.maxY, y);
    }
    
    calculateArcBoundingBox(cmd) {
        // Include arc endpoints in bounding box
        this.updateBoundingBoxForPoint(cmd.from.x, cmd.from.y);
        this.updateBoundingBoxForPoint(cmd.to.x, cmd.to.y);
        
        // For arcs with I/J format
        if (cmd.i !== undefined && cmd.j !== undefined) {
            const centerX = cmd.from.x + cmd.i;
            const centerY = cmd.from.y + cmd.j;
            const radius = Math.sqrt(cmd.i * cmd.i + cmd.j * cmd.j);
            
            // Find arc extreme points
            this.updateBoundingBoxForPoint(centerX - radius, centerY);
            this.updateBoundingBoxForPoint(centerX + radius, centerY);
            this.updateBoundingBoxForPoint(centerX, centerY - radius);
            this.updateBoundingBoxForPoint(centerX, centerY + radius);
        }
        // For arcs with R format, similar approach but calculate center first
        else if (cmd.r !== undefined) {
            // We won't be completely accurate with just radius for bounding box
            // but we'll add a conservative estimate
            const radius = Math.abs(cmd.r);
            const midX = (cmd.from.x + cmd.to.x) / 2;
            const midY = (cmd.from.y + cmd.to.y) / 2;
            
            this.updateBoundingBoxForPoint(midX - radius, midY);
            this.updateBoundingBoxForPoint(midX + radius, midY);
            this.updateBoundingBoxForPoint(midX, midY - radius);
            this.updateBoundingBoxForPoint(midX, midY + radius);
        }
    }
    
    isPenDown(z) {
        // In the specified G-code, higher Z values are for drawing
        return z > this.penUpZ;
    }
    
    getBoundingBox() {
        return this.boundingBox;
    }
    
    getParsedCommands() {
        return this.parsedCommands;
    }
}