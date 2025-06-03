function appData() {
  return {
    // State variables
    screen: 'start',
    aiMode: false,
    disableButtons: false,
    docs: [],           // 10 Dokumente pro Spielrunde
    currentIndex: 0,
    currentDoc: null,
    timeElapsed: 0,
    timerInterval: null,
    currentScore: 0,
    correctCount: 0,
    resultsList: [],    // alle gespeicherten Ergebnisse
    leaderboard: [],    // Top-5 Einträge aus resultsList
    currentResult: null,
    rank: null,
    percentile: null,
    showDataModal: false,
    rawDocs: [],
    docs: [],
    reviewDocs: [],
    reviewIndex: 0,
    // Form fields
    playerName: '',
    playerEmail: '',
    playerConsent: false,
    // Flag für Antworten-Vergleich (Ergebnisansicht)
    showAnswers: false,
    // Konstanten
    maxTime: 300,       // maximale Zeit (Sekunden) für Diagramm X-Achse
    maxCorrect: 10,     // maximale korrekte Antworten (Y-Achse)
    scatterWidth: 600,
    scatterHeight: 300,
    // Abteilungs-Liste mit Icons
    departments: [
      { name: 'Personalabteilung', description: 'z.B. bei Bewerbungen und Personalfragen', icon: '👥' },
      { name: 'Finanzabteilung', description: 'z.B. bei Rechnungen und Zahlungen', icon: '💰' },
      { name: 'Rechtsabteilung', description: 'z.B. bei juristischen Fragen und Verträgen', icon: '⚖️' },
      { name: 'Leitungsebene', description: 'z.B. bei strategischen Entscheidungen und Eskalationen', icon: '👔' },
      { name: 'Kundenservice', description: 'z.B. bei allgemeinen Fragen und Beschwerden', icon: '🎧' }
    ],

    // Initialisierung bei App-Start
    initApp() {
      // Dokumente fürs Spiel laden
      fetch('data/data.json')
        .then(res => res.json())
        .then(data => {
          this.rawDocs = data;
        })
        .catch(err => console.error("Failed to load docs:", err));
      // Daten aus localStorage laden (falls vorhanden)
      const all = localStorage.getItem('resultsList');
      this.resultsList = all ? JSON.parse(all) : [];
      // Bestenliste initialisieren
      this.updateLeaderboard();
      // Beispiel-Dokument für Vorschau im Setup-Screen generieren
      this.docs = this.generateDemoDoc();
      this.currentDoc = this.docs[0];
    },

    // Spiel starten (neue Runde)
    startGame() {
      if (!this.playerName || this.playerName.trim() === '') {
        alert("Bitte geben Sie einen Spielernamen ein, um fortzufahren.");
        return;
      }

      const sampleSize = 10; // or however many per round
      this.docs = this.shuffleArray(this.rawDocs).slice(0, sampleSize).map(d => ({
        body: d.text,
        highlightedBody: d.highlights,
        correctDept: d.label,
        aiSuggestion: d.prediction
      }));
      // Status zurücksetzen
      this.currentIndex = 0;
      this.correctCount = 0;
      this.currentDoc = this.docs[0];
      this.currentDoc.userAnswer = null;
      this.startTime = Date.now();
      this.timeElapsed = 0;
      this.currentScore = 0;
      this.currentResult = null;
      this.rank = null;
      this.percentile = null;
      this.showAnswers = false;
      // Wechsel zum Spiel-Screen
      this.screen = 'game';
      // Timer starten (Sekundenzähler)
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        this.timeElapsed++;
        // Score laufend aktualisieren (basiert auf correctCount und timeElapsed)
        this.currentScore = this.calculateScore(this.correctCount, this.timeElapsed);
      }, 1000);
    },

    highlightedHtml(html) {
      return html.replace(/class='mark'/g, `class="mark ${this.aiMode ? 'yellow' : 'white'}"`);
    },

    shuffleArray(array) {
      const copy = [...array];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },

    // Dummy-Dokumente generieren (Beispieldaten und Spielrunden-Daten)
  generateDemoDoc() {
    const demoDoc = {
      body: `Sehr geehrte Damen und Herren, \n \n ich wende mich mit einem Anliegen an Sie, das mit meiner beruflichen Weiterentwicklung im Rahmen eines Praktikums bei Ihrer Verwaltung zusammenhängt. Vor kurzem habe ich ein Praktikum in Ihrer Abteilung abgeschlossen, das mir wertvolle Einblicke in die Arbeitsprozesse und Organisationsstrukturen Ihrer Behörde ermöglicht hat. \n\n Im Zuge meiner späteren beruflichen Laufbahn und für die Vervollständigung meiner Unterlagen benötige ich eine offizielle Bestätigung über den Zeitraum und die Art des durchgeführten Praktikums. \n\n Ihre Unterstützung hierbei wäre mir eine große Hilfe. \n\n Ich danke Ihnen im Voraus für Ihre Mühe und hoffe, bald von Ihnen zu hören. Bei Fragen stehe ich selbstverständlich telefonisch oder per E-Mail zur Verfügung. \n \n Mit freundlichen Grüßen, \n \n Sophie Müller`,
      highlights: ["Praktikum", "Verwaltung", "Bestätigung", "Bewerbungsunterlagen"],
      correctDept: "Personalabteilung",
      aiSuggestion: "Personalabteilung"
    };

    // Insert markup for highlight terms
    let text = demoDoc.body;
    demoDoc.highlights.forEach(term => {
      const regex = new RegExp(term, 'g'); // global search
      text = text.replace(regex, `<mark>${term}</mark>`);
    });

    demoDoc.highlightedBody = text;

    return [demoDoc];
  },

    // Auswahl einer Abteilung verarbeiten (gemeinsame Logik für Demo und Spiel)
    processSelection(deptName, advance = true) {
      if (!this.currentDoc || this.disableButtons) return;
      this.disableButtons = true;
      const correct = (deptName === this.currentDoc.correctDept);
      const now = Date.now();
      this.currentDoc.userAnswer = deptName;
      this.currentDoc.timeTaken = (now - this.startTime) / 1000;

      // Add this document to reviewDocs
      this.reviewDocs.push({
        text: this.currentDoc.body || '',
        correctDept: this.currentDoc.correctDept || '',
        playerChoice: this.currentDoc.userAnswer || '',
        isCorrect: this.currentDoc.isCorrect,
        aiSuggestion: this.currentDoc.aiSuggestion || '',
        highlightedBody: this.currentDoc.highlightedBody || '',
      });

      const buttons = document.querySelectorAll('.dept-btn');
      buttons.forEach(btn => {
        const name = btn.dataset.name?.trim();
        btn.classList.add('disabled');
        if (name === deptName) {
          btn.classList.add(correct ? 'correct-blink' : 'wrong-blink');
        }
        if (!correct && name === this.currentDoc.correctDept) {
          btn.classList.add('correct-blink');
        }
      });
      setTimeout(() => {
        buttons.forEach(btn => {
          btn.classList.remove('correct-blink', 'wrong-blink', 'disabled');
        });
        if (advance) {
          // Im Spiel: bei korrekter Auswahl Zähler erhöhen
          if (correct) this.correctCount++;
          // Nächstes Dokument oder Spiel beenden
          if (this.currentIndex < this.docs.length - 1) {
            this.currentIndex++;
            this.currentDoc = this.docs[this.currentIndex];
            this.startTime = Date.now();
            this.currentScore = this.calculateScore(this.correctCount, this.timeElapsed);
          } else {
            this.endGame();
          }
        }
        this.disableButtons = false;
      }, 1000);
    },

    // Demo: Auswahl einer Abteilung (nur visuelles Blinksignal, kein Fortschritt)
    blinkDemoDept(deptName) {
      this.processSelection(deptName, false);
    },

    // Spiel: Auswahl einer Abteilung (normaler Fortschritt)
    selectDepartment(deptName) {
      this.processSelection(deptName, true);
    },

    // Spiel beenden und Ergebnis verarbeiten
    endGame() {
      // Timer stoppen
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      // Finalen Score berechnen
      const finalScore = this.calculateScore(this.correctCount, this.timeElapsed);
      this.currentScore = finalScore;
      // Ergebnisobjekt erstellen
    this.currentResult = {
      email: this.playerConsent ? this.playerEmail : '',
      name: this.playerName,
      consent: this.playerConsent,
      score: finalScore,
      totalTime: this.timeElapsed,
      date: new Date().toISOString(),
      aiMode: this.aiMode,
      correct: this.correctCount
    };
      // Ergebnis in Liste speichern
      this.resultsList.push(this.currentResult);
      // Bestenliste & Rang aktualisieren
      this.updateLeaderboard();
      this.rank = this.resultsList
        .slice()  // Kopie zum Sortieren
        .sort((a, b) => b.score - a.score || a.time - b.time)
        .indexOf(this.currentResult) + 1;
      // Perzentil berechnen (% der Spieler mit niedrigerem Score)
      if (this.resultsList.length > 1) {
        const betterCount = this.resultsList.filter(r => r.score < finalScore).length;
        this.percentile = Math.floor((betterCount / (this.resultsList.length - 1)) * 100);
      } else {
        this.percentile = 100; // erster Spieler => 100%
      }
      // Wechsel zum Ergebnis-Screen
      this.screen = 'result';
    },

    prevDoc() {
      if (this.reviewIndex > 0) this.reviewIndex--;
    },
    nextDoc() {
      if (this.reviewIndex < this.docs.length - 1) this.reviewIndex++;
    },

    savePlayerData() {
      // Collect game-level data
      const finalScore = this.currentScore;
      const totalTime = this.timeElapsed;
      const name = this.playerName;
      const email = (this.playerConsent && this.playerEmail && this.playerEmail.length > 3)
        ? this.playerEmail
        : '';
      const consent = this.playerConsent;
      const aiMode = this.aiMode;

      // Collect per-document answers
      const gameResults = this.docs.map((doc, i) => ({
        text: doc.body || '',
        correctDept: doc.correctDept || '',
        playerChoice: doc.userAnswer || '',
        isCorrect: doc.userAnswer === doc.correctDept,
        responseTime: doc.timeTaken || 0
      }));

      // Build result entry
      const entry = {
        name,
        email,
        consent,
        score: finalScore,
        totalTime: totalTime,
        aiMode: aiMode,
        correct: this.correctCount,
        date: new Date().toISOString(),
        gameResults
      };

      // Load, update, and save unified results list
      const existing = JSON.parse(localStorage.getItem('resultsList') || '[]');
      existing.push(entry);
      localStorage.setItem('resultsList', JSON.stringify(existing));

      // Also update in-memory list
      this.resultsList = existing;
      this.updateLeaderboard();
    },

    resetGame() {
      this.docs = [];
      this.answers = [];
      this.currentScore = 0;
      this.timeElapsed = 0;
      this.aiMode = false;
      this.currentDocIndex = 0;
      this.correctCount = 0;
      this.docs = this.generateDemoDoc();
      this.currentDoc = this.docs[0];
      this.playerName = '';
      this.playerEmail = '';
      this.playerConsent = false;
      this.reviewDocs = [];
      this.reviewIndex = 0;
    },

    backToStart() {
      this.savePlayerData();
      this.resetGame();
      this.screen = "start";
    },

    // Streudiagramm: Datenpunkte (SVG <circle>) generieren
    generateCircles() {
      console.log(this.resultsList)
      if (!Array.isArray(this.resultsList)) return '';
      return this.resultsList.map(res => {
        const cx = (res.totalTime / this.maxTime) * this.scatterWidth;
        const cy = this.scatterHeight - (res.correct / this.maxCorrect * this.scatterHeight);
        const fill = res.aiMode ? '#f1c40f' : '#333';
        return `<circle cx="${cx}" cy="${cy}" r="6" fill="${fill}" stroke="#555" opacity="0.9" />`;
      }).join('');
    },
    // Streudiagramm: Achsen-Ticks (SVG) generieren
    generateTicks() {
      const maxY = this.maxCorrect;
      const maxX = Math.max(this.maxTime, ...this.resultsList.map(r => r.time || 0));
      const xStep = 25;
      const yStep = 2;
      const ticks = [];
      // Y-Achse Ticks (horizontale Markierungen)
      for (let y = 0; y <= maxY; y += yStep) {
        const cy = this.scatterHeight - (y / maxY * this.scatterHeight);
        ticks.push(`<line x1="0" y1="${cy}" x2="-5" y2="${cy}" class="tick" />`);
        ticks.push(`<text x="-10" y="${cy + 4}" text-anchor="end" class="tick-label">${y}</text>`);
      }
      // X-Achse Ticks (vertikale Markierungen)
      for (let x = 0; x <= maxX; x += xStep) {
        const cx = x / maxX * this.scatterWidth;
        ticks.push(`<line x1="${cx}" y1="${this.scatterHeight}" x2="${cx}" y2="${this.scatterHeight + 5}" class="tick" />`);
        ticks.push(`<text x="${cx}" y="${this.scatterHeight + 20}" text-anchor="middle" class="tick-label">${x}</text>`);
      }
      return ticks.join('');
    },
    // Streudiagramm: Gitterlinien (SVG) generieren
    generateGrid() {
      const maxY = this.maxCorrect;
      const maxX = Math.max(this.maxTime, ...this.resultsList.map(r => r.time || 0));
      const yStep = 2;
      const xStep = 25;
      const lines = [];
      // Horizontale Linien (Y-Achse)
      for (let y = 0; y <= maxY; y += yStep) {
        const cy = this.scatterHeight - (y / maxY * this.scatterHeight);
        lines.push(`<line x1="0" y1="${cy}" x2="${this.scatterWidth}" y2="${cy}" class="grid-line" />`);
      }
      // Vertikale Linien (X-Achse)
      for (let x = 0; x <= maxX; x += xStep) {
        const cx = x / maxX * this.scatterWidth;
        lines.push(`<line x1="${cx}" y1="0" x2="${cx}" y2="${this.scatterHeight}" class="grid-line" />`);
      }
      return lines.join('');
    },

    // Score berechnen aus Korrektheit und Zeit
    calculateScore(correctCount, timeSec) {
      const correctScore = (correctCount / 10) * 70;
      const timeScore = (timeSec <= this.maxTime)
        ? ((this.maxTime - timeSec) / this.maxTime) * 30
        : 0;
      return Math.round(correctScore + timeScore);
    },

    // Bestenliste (Top 5) aus resultsList aktualisieren
    updateLeaderboard() {
      if (!this.resultsList.length) {
        this.leaderboard = [];
        return;
      }
      // Sortieren: Score absteigend, bei Gleichstand korrekte Antworten absteigend, dann Zeit aufsteigend
      const sorted = this.resultsList.slice().sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.correct !== b.correct) return b.correct - a.correct;
        return a.time - b.time;
      });
      this.leaderboard = sorted.slice(0, 5);
    },

    // Ergebnisse als CSV herunterladen
    downloadCSV() {
      if (!this.resultsList || this.resultsList.length === 0) return;

      // Get all top-level keys from the first result
      const headers = Object.keys(this.resultsList[0]);

      // Create CSV rows
      const rows = this.resultsList.map(entry =>
        headers.map(key => {
          const value = entry[key];
          // Convert arrays/objects to JSON strings to store in CSV safely
          if (typeof value === 'object') {
            return JSON.stringify(value);
          }
          return value ?? ''; // default to empty string if null/undefined
        })
      );

      // Join into CSV string
      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');

      // Trigger download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Postkorb-Panic_Ergebnisse.csv';
      a.click();
      URL.revokeObjectURL(url);
    },

    // Admin: Datenanzeige via Passwort
    promptAdmin() {
      const pw = prompt("Passwort eingeben:");
      if (pw === "anacision") {
        this.showDataModal = true;
      }
    },

    // Hilfsfunktionen
    formatTime(seconds) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    },
    isCurrentResult(res) {
      return this.currentResult && res === this.currentResult;
    },
  };
}
window.appData = appData;
