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

Lokaler Start
-------------
Python 3 installieren und im Projektordner unter Windows «py server.py» oder
unter macOS/Linux «python3 server.py» starten. Im Browser http://localhost:8000
öffnen. Zum Beenden im Terminal Ctrl+C drücken. Die Kontofunktionen brauchen
localhost oder HTTPS. Beim direkten Öffnen der index.html funktioniert nur der
Gastmodus. Der Browser speichert Noten pro Adresse.

Speicherung
-----------
Im Gastmodus werden alle Semester, Module, Noten, Zielnoten, Reihenfolgen sowie die geöffneten und eingeklappten Semester und Module automatisch im localStorage des Browsers gespeichert.
Ein Neuladen der Seite löscht die Eingaben nicht.

Modulkatalog
------------
Der Katalog in modules.js enthält alle Module des Studiengangs BSc
Wirtschaftsinformatik aus dem HSLU-Modulverzeichnis (Stand November 2026)
sowie die Arabisch-Sprachmodule, jeweils mit ECTS, Leistungsnachweisen und
Gewichtungen. Die Suche filtert nach Modulname und Modulnummer.
Bereits belegte Module bleiben sichtbar und zeigen an, in welchem Semester
sie vorkommen (z. B. für eine Wiederholung). Hinzugefügte Module sind
persönliche Kopien und lassen sich frei anpassen. Eigene Module können über
«Eigenes Modul» erfasst werden.

Berechnung
----------
Modulnote: gewichteter Durchschnitt der Leistungsnachweise, auf halbe Noten
gerundet. Ergeben die Gewichtungen nicht 100 %, wird anteilig gerechnet und
ein Hinweis angezeigt.
Semester- und Gesamtschnitt: Durchschnitt der gerundeten Modulnoten aller
abgeschlossenen Module, gewichtet nach ECTS. Offene Module und Module ohne
ECTS zählen nicht.

Hinweis
-------
Bei Arabisch A1.1 und A1.2 ist im Modulbeschrieb nur ein Leistungsnachweis aufgeführt, jedoch keine separate Gewichtung angegeben. Für den Rechner wird dieser einzelne Leistungsnachweis deshalb als 100 Prozent behandelt.
