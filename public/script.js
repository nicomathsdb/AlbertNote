const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('canvasViewport'); 

let isDrawing = false;
let isPanning = false; 
let startX, startY, startScrollLeft, startScrollTop;

let currentTool = 'pen'; // Par défaut, on utilise le stylo
let penSize = 3;       // Épaisseur par défaut du stylo
let eraserSize = 20;   // Épaisseur par défaut de la gomme
let penColor = 'black'; // Couleur par défaut

// Appliquer le curseur de base
viewport.classList.add('viewport-pen');


// Initialiser le fond en blanc
ctx.fillStyle = "white";
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// --- Gestion des Outils (Stylo / Gomme / ...) ---
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const panBtn = document.getElementById('panBtn');

const sizeSlider = document.getElementById('sizeSlider');
const colorPicker = document.getElementById('colorPicker');

function setActiveTool(toolId) {
    currentTool = toolId;
    penBtn.classList.toggle('active', toolId === 'pen');
    eraserBtn.classList.toggle('active', toolId === 'eraser');
    panBtn.classList.toggle('active', toolId === 'pan');

    // Changer l'icône de la souris
    viewport.className = 'canvas-viewport viewport-' + toolId;
}

penBtn.addEventListener('click', () => {
    setActiveTool('pen');
    sizeSlider.value = penSize;
});

eraserBtn.addEventListener('click', () => {
    setActiveTool('eraser');
    sizeSlider.value = eraserSize;
});

panBtn.addEventListener('click', () => {
    setActiveTool('pan');
});

// Écouteur pour le slider d'épaisseur
sizeSlider.addEventListener('input', (e) => {
    if (currentTool === 'pen') {
        penSize = e.target.value;
    } else {
        eraserSize = e.target.value;
    }
});

// Écouteur pour le menu de couleur
colorPicker.addEventListener('change', (e) => {
    penColor = e.target.value;
    // Si on change de couleur, on repasse automatiquement sur le stylo
    if (currentTool !== 'pen') penBtn.click(); 
});

// --- Logique de dessin et de déplacement ---
function startPosition(e) { 
    let clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    let clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    if (currentTool === 'pan') {
        isPanning = true;
        startX = clientX;
        startY = clientY;
        startScrollLeft = viewport.scrollLeft;
        startScrollTop = viewport.scrollTop;
    } else {
        isDrawing = true; 
        draw(e); 
    }
}

function endPosition() { 
    isDrawing = false; 
    isPanning = false;
    ctx.beginPath(); 
}

function draw(e) {
    let clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    let clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    // GESTION DU DÉPLACEMENT (PAN)
    if (isPanning) {
        e.preventDefault(); // Évite de sélectionner du texte sur la page
        const dx = clientX - startX;
        const dy = clientY - startY;
        viewport.scrollLeft = startScrollLeft - dx;
        viewport.scrollTop = startScrollTop - dy;
        return;
    }

    // GESTION DU DESSIN (STYLO/GOMME)
    if (!isDrawing) return;
    e.preventDefault();
    
    // Le calcul des coordonnées fonctionne même si on a scrollé !
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (currentTool === 'pen') {
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penSize;
    } else if (currentTool === 'eraser') {
        ctx.strokeStyle = 'white'; 
        ctx.lineWidth = eraserSize;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}

// Événements
canvas.addEventListener('mousedown', startPosition);
canvas.addEventListener('mouseup', endPosition);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseout', endPosition);
canvas.addEventListener('touchstart', startPosition, {passive: false});
canvas.addEventListener('touchend', endPosition);
canvas.addEventListener('touchmove', draw, {passive: false});

// --- Boutons d'action ---
document.getElementById('clearBtn').addEventListener('click', () => {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    document.getElementById('latexCode').innerText = "Le code apparaîtra ici...";
    document.getElementById('pdfFrame').src = "about:blank";
});

document.getElementById('convertBtn').addEventListener('click', async () => {
    const loading = document.getElementById('loading');
    const latexCodeEl = document.getElementById('latexCode');
    const pdfFrame = document.getElementById('pdfFrame');
    
    const base64Image = canvas.toDataURL('image/jpeg', 1.0); // Qualité max

    loading.classList.remove('hidden');
	latexCodeEl.innerText = "Le code apparaîtra ici...";
    pdfFrame.src = "about:blank";
    
    try {
        const response = await fetch('/api/albert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
        });

        if (!response.ok) throw new Error("Erreur lors de la requête");
        
        const data = await response.json();
        const latex = data.latex;

        latexCodeEl.innerText = latex;
        compileLaTeXtoPDF(latex);

    } catch (error) {
        console.error(error);
        latexCodeEl.innerText = "Erreur de communication avec l'IA.";
    } finally {
        loading.classList.add('hidden');
    }
});

// Fonction pour compiler via texlive.net
function compileLaTeXtoPDF(latexCode) {
    const form = document.createElement('form');
    form.target = 'pdfFrame'; 
    form.method = 'POST';
    form.action = 'https://texlive.net/cgi-bin/latexcgi';
    form.enctype = 'multipart/form-data'; // Indispensable !
    form.style.display = 'none';

    const fileInput = document.createElement('input');
    fileInput.type = 'hidden';
    fileInput.name = 'filecontents[]';
    fileInput.value = latexCode;
    form.appendChild(fileInput);

    const nameInput = document.createElement('input');
    nameInput.type = 'hidden';
    nameInput.name = 'filename[]';
    nameInput.value = 'document.tex';
    form.appendChild(nameInput);

    const engineInput = document.createElement('input');
    engineInput.type = 'hidden';
    engineInput.name = 'engine';
    engineInput.value = 'pdflatex';
    form.appendChild(engineInput);

    const returnInput = document.createElement('input');
    returnInput.type = 'hidden';
    returnInput.name = 'return';
    returnInput.value = 'pdf';
    form.appendChild(returnInput);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}