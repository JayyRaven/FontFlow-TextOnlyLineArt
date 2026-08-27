import fontMap from 'hersheytext/hersheytext.min.json';

export interface Peg {
  col: number;
  row: number;
  label: string;
}

export interface PegPathResult {
  char: string;
  path: string;
  pegs: Peg[];
  width: number;
  height: number;
}

function colLabel(col: number): string {
  if (col <= 26) return String.fromCharCode(64 + col);
  return 'A' + String.fromCharCode(64 + col - 26);
}

function quantizeToPeg(x: number, y: number): { col: number, row: number } {
  let cx = Math.round(x);
  let cy = Math.round(y);
  
  cx = Math.max(1, Math.min(30, cx));
  cy = Math.max(1, Math.min(40, cy));
  
  if ((cx % 2) === (cy % 2)) {
    const dx = x - cx;
    const dy = y - cy;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      cx = dx > 0 ? cx + 1 : cx - 1;
    } else {
      cy = dy > 0 ? cy + 1 : cy - 1;
    }
    
    cx = Math.max(1, Math.min(30, cx));
    cy = Math.max(1, Math.min(40, cy));
    if ((cx % 2) === (cy % 2)) {
      if (cx <= 1 || cx >= 30) {
        cy = cy === 40 ? 39 : cy + 1;
      } else {
        cx = cx === 30 ? 29 : cx + 1;
      }
    }
  }
  return { col: cx, row: cy };
}

interface CharData {
  char: string;
  points: [number, number][];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const generatePegPath = (text: string): PegPathResult[] => {
  const font = (fontMap as any)['scripts'] || (fontMap as any)['cursive'];
  
  if (!font || text.trim() === '') {
    return [];
  }

  const chars: CharData[] = [];
  let globalMinY = Infinity;
  let globalMaxY = -Infinity;
  let maxCharWidth = 0;

  // 1. Gather points per character
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === ' ') continue;
    
    const charCode = char.charCodeAt(0);
    if (charCode < 33) continue;
    
    const index = charCode - 33;
    const charData = font.chars[index];
    
    if (charData && charData.d) {
      const commands = charData.d.split(/(?=[MLZ])/);
      const points: [number, number][] = [];
      
      let cMinX = Infinity, cMaxX = -Infinity;
      let cMinY = Infinity, cMaxY = -Infinity;

      for (let cmd of commands) {
        if (!cmd.trim()) continue;
        const coordString = cmd.slice(1).trim();
        if (!coordString) continue;
        
        const coords = coordString.split(' ').map((s: string) => s.split(',').map(Number));
        
        for (const pt of coords) {
          if (pt.length >= 2) {
             const x = pt[0], y = pt[1];
             points.push([x, y]);
             
             if (x < cMinX) cMinX = x;
             if (x > cMaxX) cMaxX = x;
             if (y < cMinY) cMinY = y;
             if (y > cMaxY) cMaxY = y;
             
             if (y < globalMinY) globalMinY = y;
             if (y > globalMaxY) globalMaxY = y;
          }
        }
      }

      if (points.length > 0) {
        const cWidth = cMaxX - cMinX;
        if (cWidth > maxCharWidth) maxCharWidth = cWidth;
        chars.push({ char, points, minX: cMinX, maxX: cMaxX, minY: cMinY, maxY: cMaxY });
      }
    }
  }

  if (chars.length === 0) return [];

  const globalHeight = globalMaxY - globalMinY;
  
  const targetWidth = 26; // leave room for connecting lines on edges
  const targetHeight = 38;

  const effWidth = maxCharWidth || 1;
  const effHeight = globalHeight || 1;

  const scale = Math.min(targetWidth / effWidth, targetHeight / effHeight);
  const offsetY = 20.5 - (globalHeight * scale) / 2 - globalMinY * scale;

  const results: PegPathResult[] = [];

  // Determine connection Ys between characters
  const connectYs: number[] = [];
  for (let i = 0; i < chars.length - 1; i++) {
    const p1 = chars[i].points[chars[i].points.length - 1];
    const p2 = chars[i+1].points[0];
    const y1 = p1[1] * scale + offsetY;
    const y2 = p2[1] * scale + offsetY;
    let midY = Math.round((y1 + y2) / 2);
    // Force midY to be an odd row (since it connects to col 30 which needs odd rows)
    if (midY % 2 === 0) midY++; 
    connectYs.push(midY);
  }

  for (let i = 0; i < chars.length; i++) {
    const { char, points, minX, maxX } = chars[i];
    const cWidth = maxX - minX;
    const offsetX = 15.5 - (cWidth * scale) / 2 - minX * scale;

    let pegs: Peg[] = [];
    
    // Add left connection (entry) if not first letter
    if (i > 0) {
      const prevExitY = connectYs[i - 1];
      const entryY = prevExitY + 1 <= 40 ? prevExitY + 1 : prevExitY - 1;
      const peg = quantizeToPeg(1, entryY);
      pegs.push({ col: peg.col, row: peg.row, label: colLabel(peg.col) + peg.row });
    }

    // Process character points
    for (const pt of points) {
      const px = pt[0] * scale + offsetX;
      const py = pt[1] * scale + offsetY;
      const peg = quantizeToPeg(px, py);
      
      // Only add if it's different from the last peg
      if (pegs.length === 0 || pegs[pegs.length - 1].col !== peg.col || pegs[pegs.length - 1].row !== peg.row) {
        pegs.push({ col: peg.col, row: peg.row, label: colLabel(peg.col) + peg.row });
      }
    }

    // Add right connection (exit) if not last letter
    if (i < chars.length - 1) {
      const exitY = connectYs[i];
      const peg = quantizeToPeg(30, exitY);
      if (pegs.length === 0 || pegs[pegs.length - 1].col !== peg.col || pegs[pegs.length - 1].row !== peg.row) {
        pegs.push({ col: peg.col, row: peg.row, label: colLabel(peg.col) + peg.row });
      }
    }

    let path = '';
    for (let j = 0; j < pegs.length; j++) {
      const p = pegs[j];
      path += j === 0 ? `M ${p.col} ${p.row} ` : `L ${p.col} ${p.row} `;
    }

    results.push({ char, path, pegs, width: 30, height: 40 });
  }

  return results;
};
