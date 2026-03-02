// ================================
// URL des CSV
// ================================
const urlJoueurs = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTz83PdE3cDlgUW73KoHWl_BenGejjjcvtMY58h3Kw3VTjb4rqli0ci3m1IKopG96zg_iNJcjZ0fcDU/pub?gid=849322671&single=true&output=csv";
const urlChampions = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTz83PdE3cDlgUW73KoHWl_BenGejjjcvtMY58h3Kw3VTjb4rqli0ci3m1IKopG96zg_iNJcjZ0fcDU/pub?gid=313852343&single=true&output=csv";
const urlParis = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTz83PdE3cDlgUW73KoHWl_BenGejjjcvtMY58h3Kw3VTjb4rqli0ci3m1IKopG96zg_iNJcjZ0fcDU/pub?gid=289499901&single=true&output=csv";

// ================================
// 1. Onglets
// ================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn, .page').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.page).classList.add('active');
    });
});

// ================================
// 3. Parser CSV
// ================================
function processCSV(csv, type) {
    const lines = csv.split("\n").filter(l => l.trim() !== "");
    const sep = lines[0].includes(";") ? ";" : ",";
    
    return lines.slice(1).map(line => {
        const cols = line.split(sep).map(c => c.trim().replace(/"/g, ""));
        if (type === "joueur") {
            return { 
                team: cols[1], 
                name: cols[2], 
                kills: parseFloat(cols[3]) || 0, 
                kda: parseFloat(cols[6]?.replace(',', '.')) || 0, 
                penta: parseFloat(cols[9]) || 0,
                champions: parseFloat(cols[10]) || 0,
                firstblood: parseFloat(cols[8]) || 0 
            };
        } else if (type === "champion") {
            return { 
                name: cols[2], 
                picked: parseFloat(cols[3]) || 0, 
                bans: parseFloat(cols[4]) || 0, 
                winrate: parseFloat(cols[10]?.replace(',', '.').replace('%', '')) || 0 
            };
        } else {
            return cols;
        }
    }).filter(i => 
        i && 
        i.name !== "Inconnu" && 
        i.name !== "Joueur" && 
        i.name !== "Champion" &&
        i.team !== "Equipe"
    );
}

// ================================
// 4. Charger toutes les données
// ================================
async function loadData() {
    try {
        const [resJ, resC, resP] = await Promise.all([fetch(urlJoueurs), fetch(urlChampions), fetch(urlParis)]);
        const players = processCSV(await resJ.text(), "joueur");
        const champs = processCSV(await resC.text(), "champion");
        const parisCsv = await resP.text();

        // Rendu Leaderboards
        renderLeaderboard(players, "kda", "podiumKDA", "tableKDA", "joueur");
        renderLeaderboard(players, "kills", "podiumKills", "tableKills", "joueur");
        renderLeaderboard(champs, "winrate", "podiumWinrate", "tableWinrate", "champion");
        renderLeaderboard(champs, "picked", "podiumPicked", "tablePicked", "champion");
        renderLeaderboard(players, "champions", "podiumChampDiff", "tableChampDiff", "joueur");
        renderLeaderboard(players, "firstblood", "podiumFirstBlood", "tableFirstBlood", "joueur");
        renderLeaderboard(champs, "winrate", "podiumWorstWinrate", "tableWorstWinrate", "champion", true);
        renderLeaderboard(champs, "bans", "podiumMostBanned", "tableMostBanned", "champion");

        // Rendu Paris
        updateParis(parisCsv, players, champs);

    } catch (e) { 
        console.error("Erreur de chargement des données :", e); 
    }
}

// ================================
// 6. Rendu Leaderboards
// ================================
function renderLeaderboard(data, key, podiumId, tableId, type, reverse = false) {

    let filtered = [...data];

    // 🔥 FILTRE SPECIAL POUR WINRATE AVEC MIN 5 PICKS
    if (key === "winrate") {
        filtered = filtered.filter(champ => champ.picked >= 5);
    }

    let sorted = [...filtered].sort((a, b) => b[key] - a[key]);

    if (reverse) {
        sorted = [...filtered].sort((a, b) => a[key] - b[key]);
    }

    const podiumEl = document.getElementById(podiumId);
    const tableEl = document.getElementById(tableId);

    if (!podiumEl || !tableEl) return;

    const top3 = sorted.slice(0, 3);

    podiumEl.innerHTML = [top3[1], top3[0], top3[2]]
        .filter(x => x)
        .map(p => `
        <div class="medal ${p === top3[0] ? 'gold' : ''}">
            <img src="Image/${p.name}.webp" onerror="this.src='Image/default.webp'">
            <div class="name">${p.name}</div>
            <div class="value">${p[key]}${key === 'winrate' ? '%' : ''}</div>
        </div>
    `).join("");

    const top10 = sorted.slice(0, 10);

    tableEl.innerHTML = top10.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            ${type === 'joueur' ? `<td><img src="Image/${p.team}.webp" class="team-logo" onerror="this.src='Image/default.webp'"></td>` : ''}
            <td><strong>${p.name}</strong></td>
            <td>${p[key]}${key === 'winrate' ? '%' : ''}</td>
        </tr>
    `).join("");
}

function updateParis(csv) {

    const parsed = Papa.parse(csv.trim(), {
        header: false,
        skipEmptyLines: true
    });

    const rows = parsed.data;
    const headers = rows[0];

    const head = document.getElementById("parisHead");
    const body = document.getElementById("parisBody");

    if (!head || !body) return;

    head.innerHTML = `
        <tr>${headers.map(col => `<th>${col}</th>`).join("")}</tr>
    `;

    let scores = new Array(headers.length).fill(0);
    let evolution = headers.map(() => []);

    const bodyRows = rows.slice(1).map(row => {

        if (row[0].toLowerCase() === "score") return null;

        const resultats = (row[1] || "")
            .split(",")
            .map(r => r.trim().toLowerCase());

        return `
            <tr>
                ${row.map((cell, index) => {

                    if (index === 1) {
                        return `<td class="real-val">${cell}</td>`;
                    }

                    if (index >= 2 && cell.trim() !== "") {

                        const isCorrect = resultats.includes(cell.trim().toLowerCase());

                        if (isCorrect) {
                            scores[index] += 50;
                        }

                        evolution[index].push(scores[index]);

                        return `
                            <td class="${isCorrect ? 'correct' : 'wrong'}">
                                ${cell}
                            </td>
                        `;
                    }

                    return `<td>${cell}</td>`;
                }).join("")}
            </tr>
        `;
    }).filter(Boolean).join("");

    // 🔥 Détection leader
    const playerScores = headers.slice(2).map((name, i) => ({
        name,
        score: scores[i + 2]
    }));

    playerScores.sort((a, b) => b.score - a.score);

    // Ligne score
    const scoreRow = `
        <tr class="total-row">
            <td>Score</td>
            <td>-</td>
            ${playerScores.map(p => `<td>${p.score}</td>`).join("")}
        </tr>
    `;

    body.innerHTML = bodyRows + scoreRow;

    renderPodium(playerScores);
    renderChart(headers.slice(2), evolution);
}

function formatCell(cell) {

    // Si la cellule contient plusieurs valeurs séparées par virgule
    if (cell.includes(",")) {

        const values = cell.split(",").map(v => v.trim());

        return `
            <td>
                ${values.map(v => `<div class="multi-value">${v}</div>`).join("")}
            </td>
        `;
    }

    return `<td>${cell}</td>`;
}

function renderPodium(players) {

    const podium = document.getElementById("parisPodium");
    if (!podium) return;

    const medals = ["🥇", "🥈", "🥉"];

    podium.innerHTML = players.slice(0, 3).map((p, i) => `
        <div class="podium-card ${i === 0 ? 'leader' : ''}">
            <div class="medal">${medals[i]}</div>
            <div class="name">${p.name}</div>
            <div class="score">${p.score} pts</div>
        </div>
    `).join("");

    
}

let chartInstance;

function renderChart(names, evolution) {

    const ctx = document.getElementById("scoreChart");

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: evolution[2]?.map((_, i) => `Q${i+1}`),
            datasets: names.map((name, i) => ({
                label: name,
                data: evolution[i + 2],
                tension: 0.3
            }))
        },
        options: {
            plugins: {
                legend: {
                    labels: { color: "white" }
                }
            },
            scales: {
                x: { ticks: { color: "white" }},
                y: { ticks: { color: "white" }}
            }
        }
    });
}

// Vérifie toutes les 2 secondes
setInterval(() => {

    const score1 = parseInt(document.getElementById("score1").textContent);
    const score2 = parseInt(document.getElementById("score2").textContent);
    const music = document.getElementById("winMusic");
    music.volume = 0.0080;

    if (score1 === 2 && score2 === 2) {
        music.play();
    }

}, 2000);


// ================================
// 7. Initialisation
// ================================
loadData();
setInterval(loadData, 60000); // rafraîchissement chaque minute