HSLU Notenrechner
==================

Supabase einrichten
-------------------
1. Im Supabase-Projekt den SQL Editor öffnen. Den gesamten Inhalt von
   supabase-sync.sql einmal ausführen. Er ergänzt die vier vorhandenen Tabellen
   um die persönliche Studienzielnote, den Speicherstand und die Synchronisation.
2. Den Rechner unter localhost oder via HTTPS öffnen. Für den Start ohne Python
   im Projektordner «pnpm install» und «pnpm dev» ausführen und die angezeigte
   lokale Adresse öffnen. Für das statische Hosting «pnpm build» verwenden und
   den Ordner dist veröffentlichen. Der mitgelieferte Katalog funktioniert statisch.
3. Unter «Konto und Synchronisation» registrieren. Falls eine Bestätigung
   verlangt wird, den Link in der E-Mail öffnen und danach im Rechner anmelden.
4. Auf dem zweiten Gerät die veröffentlichte HTTPS-Adresse öffnen, mit demselben
   Konto anmelden und «Kontostand laden» wählen, um neue Änderungen zu sehen.
5. Bestehende lokale Semester erscheinen im Gastmodus derselben Browseradresse.
   Im leeren Konto «Lokale Noten übernehmen» wählen. Die lokale Kopie bleibt
   erhalten. Für den Umzug von einer alten file-Adresse kann die neue Fassung
   am gleichen Dateipfad geöffnet werden, sofern der Browser dort Konten zulässt.
6. Bei gleichzeitigem Bearbeiten schützt eine Versionsprüfung den gespeicherten
   Stand. Bei einem Konflikt die eigenen Änderungen ablesen, den Kontostand
   laden und die gewünschten Werte erneut eintragen. Bei Netzfehlern bleibt
   der Kontoentwurf in diesem Tab. Vor dem Schliessen «Im Konto gespeichert»
   abwarten. Das Konto verwendet eine tabbezogene Sitzung.

Start mit optionalem HSLU-Katalogdienst
---------------------------------------
Für den HSLU-Livekatalog Python 3 installieren und im entpackten Projektordner
unter Windows «py server.py» oder unter macOS/Linux «python3 server.py» starten.
Im Browser http://localhost:8000 öffnen. Zum Beenden im Terminal Ctrl+C drücken.
Beim direkten Öffnen der index.html steht der mitgelieferte Katalog zur Verfügung.
Der Browser speichert Noten pro Adresse. Frühere Eingaben unter einer anderen
Adresse sind dort weiterhin abrufbar.

Speicherung
-----------
Im Gastmodus werden alle Semester, Module, Noten, Zielnoten, Reihenfolgen sowie die geöffneten und eingeklappten Semester und Module automatisch im localStorage des Browsers gespeichert.
Ein Neuladen der Seite löscht die Eingaben nicht.

Modulkatalog
------------
Öffnen, Suchen und «Katalog aktualisieren» fragen das HSLU-Verzeichnis neu ab.
Weitere Treffer lassen sich seitenweise laden. Beim Hinzufügen ruft der Rechner
die Moduldetails ab. Fehlende Gewichtungen erscheinen mit 0 und sind editierbar.
Bereits hinzugefügte Module sind persönliche Semesterkopien.
Die lokale API bietet GET /api/modules?q=DAPRAD&field=modulnummer&offset=0
und GET /api/modules/{id}. Für die Namenssuche lautet field=modulname.
Ein HSLU-Ausfall wird im Modulkatalog angezeigt.

Der mitgelieferte Modulkatalog enthält die bisher erfassten Module sowie die neu ergänzten HSLU Module aus den bereitgestellten Modulbeschrieben.
Die Leistungsnachweise und Gewichtungen sind in modules.js hinterlegt.
Eigene Module und zusätzliche Leistungsnachweise können weiterhin manuell ergänzt werden.

Hinweis
-------
Bei Arabisch A1.1 und A1.2 ist im Modulbeschrieb nur ein Leistungsnachweis aufgeführt, jedoch keine separate Gewichtung angegeben. Für den Rechner wird dieser einzelne Leistungsnachweis deshalb als 100 Prozent behandelt.
