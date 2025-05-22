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
    consentedList: [],  // Ergebnisse mit Einwilligung
    leaderboard: [],    // Top-5 Einträge aus resultsList
    currentResult: null,
    rank: null,
    percentile: null,
    showDataModal: false,
    // Form fields
    playerName: '',
    playerEmail: '',
    playerConsent: false,
    // Flag für Antworten-Vergleich (Ergebnisansicht)
    showAnswers: false,
    // Inactivity timer (Result screen auto-return)
    idleTimeoutId: null,
    idleTimeoutSeconds: 120,
    // Konstanten
    maxTime: 120,       // maximale Zeit (Sekunden) für Diagramm X-Achse
    maxCorrect: 10,     // maximale korrekte Antworten (Y-Achse)
    scatterWidth: 600,
    scatterHeight: 300,
    // Abteilungs-Liste mit Icons
    departments: [
      { name: 'Personalabteilung', icon: '👥' },
      { name: 'Finanzabteilung', icon: '💰' },
      { name: 'Rechtsabteilung', icon: '⚖️' },
      { name: 'Leitungsebene', icon: '👔' },
      { name: 'Kundenservice', icon: '🎧' }
    ],

    // Initialisierung bei App-Start
    initApp() {
      // Daten aus localStorage laden (falls vorhanden)
      const all = localStorage.getItem('resultsList');
      const consented = localStorage.getItem('consentedResults');
      this.resultsList = all ? JSON.parse(all) : [];
      this.consentedList = consented ? JSON.parse(consented) : [];
      // Bestenliste initialisieren
      this.updateLeaderboard();
      // Beispiel-Dokument für Vorschau im Setup-Screen generieren
      this.docs = this.generateDocs(1, true);
      this.currentDoc = this.docs[0];
    },

    // Spiel starten (neue Runde)
    startGame() {
      // 10 Dokumente generieren (Dummy-Daten)
      this.docs = this.generateDocs(10, false);
      // Status zurücksetzen
      this.currentIndex = 0;
      this.correctCount = 0;
      this.currentDoc = this.docs[0];
      this.currentDoc.userAnswer = null;
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

    // Dummy-Dokumente generieren (Beispieldaten und Spielrunden-Daten)
    generateDocs(n, demoMode) {
      const sampleDocs = demoMode
        ? [
            {
              from: "<max.mustermann@beispiel.de>",
              to: "<personal@firma.de>",
              body: "Sehr geehrte Damen und Herren, \n \n ich wende mich mit einem Anliegen an Sie, das mit meiner beruflichen Weiterentwicklung im Rahmen eines Praktikums bei Ihrer Verwaltung zusammenhängt. Vor kurzem habe ich ein Praktikum in Ihrer Abteilung abgeschlossen, das mir wertvolle Einblicke in die Arbeitsprozesse und Organisationsstrukturen Ihrer Behörde ermöglicht hat. Im Zuge meiner späteren beruflichen Laufbahn und für die Vervollständigung meiner Unterlagen benötige ich eine offizielle Bestätigung über den Zeitraum und die Art des durchgeführten Praktikums. Diese Bestätigung ist nicht nur ein wichtiger Bestandteil meiner Bewerbungsunterlagen, sondern auch von großem Wert für meine persönliche und professionelle Weiterentwicklung. Das Praktikum fand vom 1. Mai bis zum 31. Juli 2023 statt und umfasste eine Vielzahl an spannenden Aufgaben und Projekten, die mir ein fundiertes Verständnis des Arbeitsalltags in einer öffentlichen Institution vermittelt haben. Ihre Unterstützung hierbei wäre mir eine große Hilfe. Ich danke Ihnen im Voraus für Ihre Mühe und hoffe, bald von Ihnen zu hören. Bei Fragen stehe ich selbstverständlich telefonisch oder per E-Mail zur Verfügung. \n Mit freundlichen Grüßen, \n Sophie Müller ",
              highlights: ["Praktikum", "Verwaltung", "Bestätigung", "Bewerbungsunterlagen"],
              correctDept: "Personalabteilung",
              aiSuggestion: "Personalabteilung",
              highlightedBody: "Sehr geehrte Damen und Herren, ich möchte mich für die <mark>ausgeschriebene Stelle</mark> in Ihrer <mark>Personalabteilung</mark> bewerben. Anbei finden Sie meinen <mark>Lebenslauf</mark> und relevante Unterlagen."
            }
          ]
        : [
            {
              from: "<max.mustermann@soundso.de>",
              to: "<verwaltung@outlook.de>",
              body: "Sehr geehrte Damen und Herren, \n\n ich hoffe, diese Nachricht findet Sie wohl. Ich schreibe Ihnen in einer Angelegenheit, die vermutlich in Ihrem Verantwortungsbereich liegen könnte. Leider hat sich in letzter Zeit eine kleine Unstimmigkeit eingeschlichen, die eine Klärung benötigt. \n Es handelt sich um eine Überprüfung, die sich auf monetäre Angelegenheiten erstreckt, und ich wäre Ihnen sehr dankbar, wenn Sie in Betracht ziehen könnten, meinen Fall zu evaluieren. Falls es spezifische Abteilungen gibt, die sich regelmäßig mit numerischen Übersichten und Auswertungen beschäftigen, wäre eine Weiterleitung zu diesen Experten sicherlich hilfreich. Es wäre zudem sehr freundlich, wenn Sie die Gelegenheit hätten, dies baldmöglichst zu prüfen, da ich auf eine zeitnahe Antwort angewiesen bin. Mir ist bewusst, dass es viele dringliche Anfragen gibt, jedoch wäre eine zügige Rückmeldung äußerst willkommen. Sollten weitere Informationen oder Unterlagen benötigt werden, stehe ich natürlich zur Verfügung und wäre dankbar für jede weitere Instruktion. Ich bedanke mich bereits im Voraus für Ihre Unterstützung und Ihr Verständnis. Für den Fall, dass dieser Brief dennoch den falschen Adressaten erreicht hat, bitte ich höflich, ihn entsprechend weiterzuleiten. \n \n Mit besten Grüßen, \n Max Mustermann ",
              highlights: ["Angelegenheit", "Überprüfung", "monetäre Angelegenheiten"],
              correctDept: "Finanzabteilung",
              aiSuggestion: "Finanzabteilung"
            },
            {
              from: "<erika.musterfrau@firma.de>",
              to: "<verwaltung@outlook.de>",
              body: "Sehr geehrte Damen und Herren, ich hoffe, diese Nachricht erreicht Sie wohl. Ich wende mich heute an Ihre Verwaltung in einer Angelegenheit, die fachkundige Beurteilung erfordert. Am 15. Oktober 2023 bin ich auf ein Thema gestoßen, das für ein klares Verständnis der gesetzlichen Rahmenbedingungen von wesentlicher Bedeutung ist. Daher erachte ich es für angebracht, dieses direkt mit den zuständigen Stellen zu klären. Ich bin zuversichtlich, dass eine umfassende und sachgerechte Klärung zu einem für alle Parteien zufriedenstellenden Ergebnis führen wird. Innerhalb der Struktur Ihrer Organisation vermute ich, dass es möglicherweise Bereiche gibt, die in der Lage sind, auf die Besonderheiten der geltenden Bestimmungen einzugehen. Dabei vertraue ich auf das Engagement Ihres Hauses, bei kritischen Themen stets kompetente Beratung zu bieten. Bei früheren Kontakten mit Ihrer Behörde habe ich die klare Vorgehensweise und die wirksame Bearbeitung besonders geschätzt. Ich wäre Ihnen sehr verbunden, wenn Sie diese Angelegenheit an die entsprechenden Fachstellen weiterleiten könnten. Für Rückfragen stehe ich Ihnen gerne jederzeit zur Verfügung, um weitere Einzelheiten zu besprechen oder um weitere Dokumentationen zur Verfügung zu stellen. Vielen Dank im Voraus für Ihre Unterstützung und ich freue mich auf Ihre Rückmeldung. Mit freundlichen Grüßen, Jonas Müller ",
              highlights: ["Angelegenheit", "gesetzliche Rahmenbedingungen", "Klärung", "Fachstellen"],
              correctDept: "Rechtsabteilung",
              aiSuggestion: "Rechtsabteilung"
            }
          ];
      // Falls weniger als n Einträge definiert, Liste mehrfach nutzen
      const docs = [];
      for (let i = 0; i < n; i++) {
        docs.push({ ...sampleDocs[i % sampleDocs.length] });
      }
      // Highlight-Markup für jedes Dokument einfügen
      docs.forEach(doc => {
        if (doc.highlights) {
          let text = doc.body;
          doc.highlights.forEach(term => {
            const regex = new RegExp(term, 'g'); // einfache globale Suche
            text = text.replace(regex, `<mark>${term}</mark>`);
          });
          doc.highlightedBody = text;
        } else {
          doc.highlightedBody = doc.body;
        }
      });
      return docs;
    },

    // Auswahl einer Abteilung verarbeiten (gemeinsame Logik für Demo und Spiel)
    processSelection(deptName, advance = true) {
      if (!this.currentDoc || this.disableButtons) return;
      this.disableButtons = true;
      const correct = (deptName === this.currentDoc.correctDept);
      this.currentDoc.userAnswer = deptName;
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
        email: null,
        name: null,
        consent: false,
        score: finalScore,
        time: this.timeElapsed,
        date: new Date().toISOString(),
        ai: this.aiMode,
        correct: this.correctCount
      };
      // Ergebnis in Liste speichern (Persistenz via localStorage)
      this.resultsList.push(this.currentResult);
      localStorage.setItem('resultsList', JSON.stringify(this.resultsList));
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
      // Inaktivitäts-Timer für automatisches Zurücksetzen zum Start
      if (this.idleTimeoutId) clearTimeout(this.idleTimeoutId);
      this.idleTimeoutSeconds = 120;
      const tick = () => {
        this.idleTimeoutSeconds--;
        if (this.idleTimeoutSeconds <= 0) {
          this.submitScore();
        } else {
          this.idleTimeoutId = setTimeout(tick, 1000);
        }
      };
      this.idleTimeoutId = setTimeout(tick, 1000);
    },

    // Streudiagramm: Datenpunkte (SVG <circle>) generieren
    generateCircles() {
      if (!Array.isArray(this.resultsList)) return '';
      return this.resultsList.map(res => {
        const cx = Math.min(res.time, this.maxTime) / this.maxTime * this.scatterWidth;
        const cy = this.scatterHeight - (res.correct / this.maxCorrect * this.scatterHeight);
        const fill = res.ai ? '#f1c40f' : '#333';
        return `<circle cx="${cx}" cy="${cy}" r="6" fill="${fill}" stroke="#555" opacity="0.9" />`;
      }).join('');
    },
    // Streudiagramm: Achsen-Ticks (SVG) generieren
    generateTicks() {
      const maxY = this.maxCorrect;
      const maxX = Math.max(90, ...this.resultsList.map(r => r.time || 0));
      const xStep = 30;
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
      const maxX = Math.max(90, ...this.resultsList.map(r => r.time || 0));
      const yStep = 2;
      const xStep = 30;
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

    // Score absenden und zum Start zurückkehren
    submitScore() {
      if (!this.currentResult) return;
      // Namen (falls angegeben) eintragen
      this.currentResult.name = this.playerName.trim() || '';
      // Falls Einwilligung erteilt, E-Mail speichern
      if (this.playerConsent) {
        this.currentResult.email = this.playerEmail.trim() || '';
        this.currentResult.consent = true;
        this.consentedList.push(this.currentResult);
        localStorage.setItem('consentedResults', JSON.stringify(this.consentedList));
      }
      // Ergebnisliste mit Name/Email aktualisieren (Persistenz)
      localStorage.setItem('resultsList', JSON.stringify(this.resultsList));
      this.updateLeaderboard();
      // Formulardaten zurücksetzen
      this.playerName = '';
      this.playerEmail = '';
      this.playerConsent = false;
      // Inaktivitäts-Timer stoppen
      if (this.idleTimeoutId) {
        clearTimeout(this.idleTimeoutId);
        this.idleTimeoutId = null;
      }
      // Zurück zum Startbildschirm
      this.screen = 'start';
    },

    // Zusammenfassungstext der Ergebnisse (nur Einwilligungen) erzeugen
    generateSummaryText() {
      return this.consentedList.map(r => {
        const d = new Date(r.date).toLocaleString();
        return `Name: ${r.name || '–'}, Email: ${r.email || '–'}, Score: ${r.score}, Time: ${r.time}s, Date: ${d}`;
      }).join('\n');
    },

    // Summary als Textdatei herunterladen
    downloadSummary() {
      const summary = this.generateSummaryText();
      const blob = new Blob([summary], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'KI-Spiel_Summary.txt';
      a.click();
      URL.revokeObjectURL(url);
    },

    // Ergebnisse als CSV herunterladen
    downloadCSV() {
      const headers = ['Name', 'Email', 'Score', 'Time', 'Date'];
      const rows = this.consentedList.map(r => [
        r.name || '–',
        r.email || '–',
        r.score,
        r.time,
        new Date(r.date).toISOString()
      ]);
      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'KI-Spiel_Ergebnisse.csv';
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
