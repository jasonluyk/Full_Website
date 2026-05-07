// javascriptCode.js
// Legacy utility functions kept for compatibility.
// Game logic has been moved inline to myprojects.html.
// This file can be safely removed once all pages are confirmed working.

// Unit converter (used by legacy pages if any)
function convert() {
    const inputValue = document.getElementById("userInput")?.value;
    const unit = document.getElementById("unit")?.value;
    const result = document.getElementById("resultElement");
    if (!result || inputValue === undefined) return;
    const milesToKm = unit === "milesToKm";
    result.innerHTML = milesToKm
        ? (inputValue * 1.60934).toFixed(3)
        : (inputValue / 1.60934).toFixed(3);
}

// Show/hide divs (used by any page with dropdown selects)
function showDiv(divId, divId2, divId3, divId4, divId5, element) {
    const ids = [divId, divId2, divId3, divId4, divId5];
    ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) el.style.display = element.value == (i + 1) ? 'block' : 'none';
    });
}