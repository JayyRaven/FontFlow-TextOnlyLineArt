import './style.css';
import { generatePegPath, type PegPathResult } from './font.ts';

let gridHtml = '';
for (let c = 1; c <= 30; c++) {
  for (let r = 1; r <= 40; r++) {
    if ((c % 2) !== (r % 2)) {
      gridHtml += `<circle cx="${c}" cy="${r}" r="0.25" fill="#ccc" />`;
    }
  }
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Pegboard Path Generator</h1>
    <p>Type a word or group of letters below. Each letter will be mapped to its own 30x40 pegboard.</p>
    
    <div class="input-container">
      <input type="text" id="text-input" placeholder="Enter text here..." value="hello" />
    </div>

    <div id="boards-container"></div>
    
    <div class="controls">
      <div class="anim-controls">
        <button id="download-btn">Download All SVGs</button>
        <button id="scribus-btn" style="margin-left: 8px;">Send to Scribus (Python Script)</button>
      </div>
    </div>
  </div>
`;

const textInput = document.querySelector<HTMLInputElement>('#text-input')!;
const boardsContainer = document.querySelector<HTMLDivElement>('#boards-container')!;
const downloadBtn = document.querySelector<HTMLButtonElement>('#download-btn')!;
const scribusBtn = document.querySelector<HTMLButtonElement>('#scribus-btn')!;

let currentResults: PegPathResult[] = [];

const updateSvg = () => {
  const text = textInput.value || ' ';
  currentResults = generatePegPath(text);
  
  boardsContainer.innerHTML = '';

  currentResults.forEach((res, index) => {
    const boardHtml = `
      <div class="board-wrapper">
        <h2>Board ${index + 1} ('${res.char}')</h2>
        <div class="layout">
          <div class="svg-container">
            <svg id="output-svg-${index}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42">
              <g id="peg-grid">${gridHtml}</g>
              <path id="output-path-${index}" d="${res.path}" fill="none" stroke="black" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="map-container">
            <h3>Coordinate Map</h3>
            <ul class="peg-list">
              ${res.pegs.map((p, i) => `<li><span class="index">${i + 1}.</span> ${p.label}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
    boardsContainer.insertAdjacentHTML('beforeend', boardHtml);
  });
};

textInput.addEventListener('input', updateSvg);

downloadBtn.addEventListener('click', () => {
  currentResults.forEach((res, index) => {
    const svgEl = document.querySelector(`#output-svg-${index}`);
    if (!svgEl) return;
    
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pegboard-board${index + 1}-${res.char}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});

scribusBtn.addEventListener('click', () => {
  if (currentResults.length === 0) return;

  const boardsData = currentResults.map(res => 
    res.pegs.map(p => [p.col, p.row])
  );

  const pythonScript = `
import scribus

def main():
    if not scribus.haveDoc():
        try:
            scribus.newDocument(scribus.PAPER_LETTER, (36, 36, 36, 36), scribus.PORTRAIT, 1, scribus.UNIT_POINTS, scribus.PAGE_1, 0, 1)
        except Exception:
            pass # Fallback if specific constants change in API

    # Array of boards, each board is a list of [col, row] pegs
    boards = ${JSON.stringify(boardsData)}

    scribus.setRedraw(False)

    for i, board in enumerate(boards):
        page_index = i // 4
        position_index = i % 4
        
        if position_index == 0 and page_index > 0:
            scribus.newPage(-1)
            scribus.gotoPage(page_index + 1)
            
        if position_index == 0:
            x_offset, y_offset = 36, 36
        elif position_index == 1:
            x_offset, y_offset = 36 + 270, 36
        elif position_index == 2:
            x_offset, y_offset = 36, 36 + 360
        elif position_index == 3:
            x_offset, y_offset = 36 + 270, 36 + 360
            
        radius = 2.0
        
        # 1. Draw grid lines instead of all empty circles
        for c in range(1, 31):
            x = x_offset + (c - 1) * 9.0
            line = scribus.createLine(x, y_offset, x, y_offset + 39 * 9.0)
            scribus.setLineColor("Black", line)
            scribus.setLineWidth(0.1, line)
            
        for r in range(1, 41):
            y = y_offset + (r - 1) * 9.0
            line = scribus.createLine(x_offset, y, x_offset + 29 * 9.0, y)
            scribus.setLineColor("Black", line)
            scribus.setLineWidth(0.1, line)
            
        # 2. Draw 4 corner circles (hollow)
        corners = [(1, 2), (30, 1), (1, 40), (30, 39)]
        for (c, r) in corners:
            cx = x_offset + (c - 1) * 9.0
            cy = y_offset + (r - 1) * 9.0
            obj = scribus.createEllipse(cx - radius, cy - radius, radius * 2, radius * 2)
            scribus.setFillColor("None", obj)
            scribus.setLineColor("Black", obj)
            scribus.setLineWidth(0.5, obj)
            
        # 3. Draw plot points (filled)
        pegs_set = set(tuple(p) for p in board)
        for (c, r) in pegs_set:
            cx = x_offset + (c - 1) * 9.0
            cy = y_offset + (r - 1) * 9.0
            obj = scribus.createEllipse(cx - radius, cy - radius, radius * 2, radius * 2)
            scribus.setFillColor("Black", obj)
            scribus.setLineColor("Black", obj)
            scribus.setLineWidth(0.5, obj)
            
        # 4. Draw connecting lines between the appropriate places
        if len(board) > 1:
            path_coords = []
            for (c, r) in board:
                cx = x_offset + (c - 1) * 9.0
                cy = y_offset + (r - 1) * 9.0
                path_coords.extend([cx, cy])
            polyline = scribus.createPolyLine(path_coords)
            scribus.setLineColor("Black", polyline)
            scribus.setLineWidth(1.0, polyline)
            scribus.setFillColor("None", polyline)
    
    scribus.setRedraw(True)
    scribus.redrawAll()

if __name__ == '__main__':
    main()
`;

  const blob = new Blob([pythonScript], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'scribus_pegboard_template.py';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Initial render
updateSvg();

