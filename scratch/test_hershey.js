import hershey from 'hersheytext';

const arr = hershey.renderTextArray("Hello", { font: 'scripts' });

let fullPath = "";
let currentX = 0;
const scale = 2; // to make it larger

for (let i = 0; i < arr.length; i++) {
  const char = arr[i];
  if (char.d) {
    // Offset char.d by currentX
    // parse d
    const commands = char.d.split(/(?=[MLZ])/);
    
    for (let cmd of commands) {
      if (!cmd.trim()) continue;
      const type = cmd[0];
      const coords = cmd.slice(1).trim().split(' ').map(s => s.split(',').map(Number));
      
      const newCmd = type + ' ' + coords.map(pt => `${(pt[0] + currentX) * scale},${pt[1] * scale}`).join(' ');
      
      fullPath += newCmd + ' ';
    }
  }
  currentX += char.width; // char spacing? Maybe a little extra space
}

// Now replace all M's after the first one with L's
const parts = fullPath.trim().split(/(?=[MLZ])/);
let singleContinuousPath = parts[0];
for (let i = 1; i < parts.length; i++) {
  let part = parts[i];
  if (part.startsWith('M')) {
    part = 'L' + part.substring(1);
  }
  singleContinuousPath += part;
}

console.log(singleContinuousPath);

