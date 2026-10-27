/* Heartfall — translation tables (see js/i18n.js).
 * Each row: [English key, es-419, de-DE, fr-FR, pt-BR, it-IT]. en-GB, es-ES and
 * fr-CA list only where they differ from en-US, es-419 and fr-FR.
 * "Heartfall", "StarHermit" and the persona names (Fern, Moth, Luna, Pip) stay
 * as they are; card faces use rank letters and suit glyphs in every locale.
 * The Graphics-panel and StarHermit account strings live in js/gfx.js.
 */
(function (root) {
  'use strict';
  var ROWS = [
    ['Back', 'Atrás', 'Zurück', 'Retour', 'Voltar', 'Indietro'],
    ['Selected', 'Seleccionada', 'Ausgewählt', 'Sélectionnée', 'Selecionada', 'Selezionata'],
    ['Not playable', 'No se puede jugar', 'Nicht spielbar', 'Injouable', 'Não pode ser jogada', 'Non giocabile'],
    // ---- static markup (index.html)
    ['Learn', 'Aprender', 'Lernen', 'Apprendre', 'Aprender', 'Impara'],
    ['Journey', 'Viaje', 'Reise', 'Voyage', 'Jornada', 'Viaggio'],
    ['Practice', 'Práctica', 'Training', 'Entraînement', 'Treino', 'Allenamento'],
    ['Challenge', 'Desafío', 'Herausforderung', 'Défi', 'Desafio', 'Sfida'],
    ['Settings', 'Ajustes', 'Einstellungen', 'Paramètres', 'Ajustes', 'Impostazioni'],
    ['Help', 'Ayuda', 'Hilfe', 'Aide', 'Ajuda', 'Aiuto'],
    ['Play', 'Jugar', 'Spielen', 'Jouer', 'Jogar', 'Gioca'],
    ['Pause game', 'Pausar la partida', 'Spiel pausieren', 'Mettre en pause', 'Pausar o jogo', 'Metti in pausa'],
    ['A moonlit conservatory card table.', 'Una mesa de cartas en un invernadero a la luz de la luna.', 'Ein Kartentisch im mondbeschienenen Wintergarten.', 'Une table de cartes dans une serre au clair de lune.', 'Uma mesa de cartas numa estufa ao luar.', 'Un tavolo da gioco in una serra al chiaro di luna.'],
    ['Daily Challenge', 'Desafío diario', 'Tägliche Herausforderung', 'Défi du jour', 'Desafio diário', 'Sfida giornaliera'],
    ['Modes', 'Modos', 'Modi', 'Modes', 'Modos', 'Modalità'],
    ['Tutorial — the rules, one at a time.', 'Tutorial: las reglas, de una en una.', 'Tutorial – die Regeln, eine nach der anderen.', 'Tutoriel — les règles, une à la fois.', 'Tutorial — as regras, uma de cada vez.', 'Tutorial: le regole, una alla volta.'],
    ['An authored path through 40 stages.', 'Un recorrido diseñado de 40 etapas.', 'Ein gestalteter Weg durch 40 Etappen.', 'Un parcours conçu en 40 étapes.', 'Um caminho criado com 40 etapas.', 'Un percorso d’autore in 40 tappe.'],
    ['One shared table for everyone, today only.', 'Una mesa compartida por todos, solo hoy.', 'Ein gemeinsamer Tisch für alle, nur heute.', 'Une même table pour tous, aujourd’hui seulement.', 'Uma mesa igual para todos, só hoje.', 'Un tavolo condiviso da tutti, solo oggi.'],
    ['Select your difficulty. Undo and hints allowed.', 'Elige la dificultad. Se permiten deshacer y pistas.', 'Wähle deinen Schwierigkeitsgrad. Rückgängig und Tipps erlaubt.', 'Choisissez la difficulté. Annuler et indices autorisés.', 'Escolha a dificuldade. Desfazer e dicas permitidos.', 'Scegli la difficoltà. Annulla e suggerimenti consentiti.'],
    ['Six constrained tables with their own rules.', 'Seis mesas con restricciones y reglas propias.', 'Sechs Tische mit Auflagen und eigenen Regeln.', 'Six tables contraintes, chacune avec ses règles.', 'Seis mesas com restrições e regras próprias.', 'Sei tavoli vincolati con regole proprie.'],
    ['Six lessons. Each one isolates a single rule; perform the action to continue.', 'Seis lecciones. Cada una aísla una regla; realiza la acción para continuar.', 'Sechs Lektionen. Jede zeigt eine einzelne Regel; führe die Aktion aus, um weiterzumachen.', 'Six leçons. Chacune isole une règle ; effectuez l’action pour continuer.', 'Seis lições. Cada uma isola uma regra; faça a ação para continuar.', 'Sei lezioni. Ognuna isola una regola; esegui l’azione per continuare.'],
    ['Forty stages. The conservatory keeps its own ledger.', 'Cuarenta etapas. El invernadero lleva su propio registro.', 'Vierzig Etappen. Der Wintergarten führt sein eigenes Buch.', 'Quarante étapes. La serre tient son propre registre.', 'Quarenta etapas. A estufa mantém seu próprio registro.', 'Quaranta tappe. La serra tiene il suo registro.'],
    ['Seven days, one table each. The rules change with the moon.', 'Siete días, una mesa cada uno. Las reglas cambian con la luna.', 'Sieben Tage, je ein Tisch. Die Regeln wechseln mit dem Mond.', 'Sept jours, une table chacun. Les règles changent avec la lune.', 'Sete dias, uma mesa cada. As regras mudam com a lua.', 'Sette giorni, un tavolo ciascuno. Le regole cambiano con la luna.'],
    ['Three tables. Undo and hints are on.', 'Tres mesas. Deshacer y pistas activados.', 'Drei Tische. Rückgängig und Tipps sind an.', 'Trois tables. Annuler et indices activés.', 'Três mesas. Desfazer e dicas ativados.', 'Tre tavoli. Annulla e suggerimenti attivi.'],
    ['Six tables, each with its own rules and its own price.', 'Seis mesas, cada una con sus reglas y su precio.', 'Sechs Tische, jeder mit eigenen Regeln und eigenem Preis.', 'Six tables, chacune avec ses règles et son prix.', 'Seis mesas, cada uma com suas regras e seu preço.', 'Sei tavoli, ognuno con le sue regole e il suo prezzo.'],
    ['Paused', 'En pausa', 'Pausiert', 'En pause', 'Pausado', 'In pausa'],
    ['Resume', 'Continuar', 'Fortsetzen', 'Reprendre', 'Continuar', 'Riprendi'],
    ['Leave to title', 'Salir al título', 'Zum Titelbildschirm', 'Retour à l’écran titre', 'Sair para o título', 'Torna al titolo'],
    // ---- lists and help
    ['{day} · {seats} seats · {pts} pts', '{day} · {seats} asientos · {pts} pts', '{day} · {seats} Plätze · {pts} Pkt.', '{day} · {seats} places · {pts} pts', '{day} · {seats} lugares · {pts} pts', '{day} · {seats} posti · {pts} pt'],
    ['Today', 'Hoy', 'Heute', 'Aujourd’hui', 'Hoje', 'Oggi'],
    ['Heartfall is a trick-taking card game. Pass cards, follow suit, avoid penalty hearts and the Nightshade Queen (Q♠) — or capture every penalty for an Eclipse.', 'Heartfall es un juego de cartas de bazas. Pasa cartas, sigue el palo, evita los corazones de penalización y la Reina Belladona (Q♠), o captura todas las penalizaciones para un Eclipse.', 'Heartfall ist ein Stichspiel. Gib Karten weiter, bediene die Farbe, meide Strafherzen und die Nachtschattenkönigin (Q♠) – oder hol dir alle Strafkarten für eine Finsternis.', 'Heartfall est un jeu de cartes à plis. Passez des cartes, fournissez à la couleur, évitez les cœurs de pénalité et la Reine Belladone (Q♠) — ou capturez toutes les pénalités pour une Éclipse.', 'Heartfall é um jogo de cartas de vazas. Passe cartas, siga o naipe, evite as copas de penalidade e a Rainha Beladona (Q♠) — ou capture todas as penalidades para um Eclipse.', 'Heartfall è un gioco di carte a prese. Passa le carte, rispondi al seme, evita i cuori di penalità e la Regina Belladonna (Q♠), oppure cattura tutte le penalità per un’Eclissi.'],
    ['Lowest match score wins once anyone reaches the threshold; full-penalty capture applies the declared room rule.', 'Gana la puntuación más baja cuando alguien alcanza el límite; capturar todas las penalizaciones aplica la regla de la sala.', 'Sobald jemand die Grenze erreicht, gewinnt die niedrigste Punktzahl; wer alle Strafkarten holt, löst die angesagte Tischregel aus.', 'Le score le plus bas l’emporte dès qu’un joueur atteint le seuil ; capturer toutes les pénalités applique la règle de la table.', 'Vence a menor pontuação quando alguém atinge o limite; capturar todas as penalidades aplica a regra da mesa.', 'Vince il punteggio più basso quando qualcuno raggiunge la soglia; catturare tutte le penalità applica la regola del tavolo.'],
    ['Results show a component breakdown rather than one unexplained total. Ties use, in order: primary objective completion, fewer invalid actions, lower authoritative elapsed time, then stable session identifier.', 'Los resultados muestran el desglose en lugar de un total sin explicar. Los empates se resuelven por: objetivo principal cumplido, menos acciones no válidas, menor tiempo oficial y, por último, el identificador de sesión.', 'Ergebnisse zeigen eine Aufschlüsselung statt einer unerklärten Summe. Gleichstände entscheiden der Reihe nach: Hauptziel erfüllt, weniger ungültige Aktionen, kürzere offizielle Zeit, dann die Sitzungskennung.', 'Les résultats détaillent chaque composante plutôt qu’un total inexpliqué. Les égalités se départagent ainsi : objectif principal atteint, moins d’actions invalides, temps officiel plus court, puis identifiant de session.', 'Os resultados mostram cada componente em vez de um total sem explicação. Empates usam, em ordem: objetivo principal cumprido, menos ações inválidas, menor tempo oficial e, por fim, o identificador da sessão.', 'I risultati mostrano ogni componente invece di un totale non spiegato. I pareggi si risolvono così: obiettivo principale raggiunto, meno azioni non valide, tempo ufficiale minore, infine l’identificativo di sessione.'],
    ['Controls: click or tap a card to select or play it. In Practice and Learn, {hint} asks for a hint and {undo} undoes your last action. {pause} or the pause button opens the pause menu.', 'Controles: haz clic o toca una carta para seleccionarla o jugarla. En Práctica y Aprender, {hint} pide una pista y {undo} deshace tu última acción. {pause} o el botón de pausa abre el menú de pausa.', 'Steuerung: Klicke oder tippe auf eine Karte, um sie zu wählen oder zu spielen. In Training und Lernen gibt {hint} einen Tipp und {undo} macht deine letzte Aktion rückgängig. {pause} oder die Pausetaste öffnet das Pausenmenü.', 'Commandes : cliquez ou touchez une carte pour la sélectionner ou la jouer. En Entraînement et Apprendre, {hint} donne un indice et {undo} annule votre dernière action. {pause} ou le bouton pause ouvre le menu.', 'Controles: clique ou toque numa carta para selecioná-la ou jogá-la. Em Treino e Aprender, {hint} pede uma dica e {undo} desfaz sua última ação. {pause} ou o botão de pausa abre o menu de pausa.', 'Comandi: fai clic o tocca una carta per selezionarla o giocarla. In Allenamento e Impara, {hint} chiede un suggerimento e {undo} annulla l’ultima azione. {pause} o il pulsante di pausa apre il menu.'],
    ['Daily {date}', 'Diario {date}', 'Tagesrunde {date}', 'Défi du {date}', 'Desafio {date}', 'Sfida del {date}'],
    // ---- refused actions
    ['The match is over.', 'La partida terminó.', 'Die Partie ist vorbei.', 'La partie est terminée.', 'A partida acabou.', 'La partita è finita.'],
    ['Not now.', 'Ahora no.', 'Nicht jetzt.', 'Pas maintenant.', 'Agora não.', 'Non ora.'],
    ['It is not your turn.', 'No es tu turno.', 'Du bist nicht am Zug.', 'Ce n’est pas votre tour.', 'Não é a sua vez.', 'Non è il tuo turno.'],
    ['That card is not in your hand.', 'Esa carta no está en tu mano.', 'Diese Karte hast du nicht auf der Hand.', 'Cette carte n’est pas dans votre main.', 'Essa carta não está na sua mão.', 'Quella carta non è nella tua mano.'],
    ['The first trick must open with the starting card.', 'La primera baza debe abrirse con la carta inicial.', 'Der erste Stich muss mit der Startkarte beginnen.', 'Le premier pli doit s’ouvrir avec la carte de départ.', 'A primeira vaza deve começar com a carta inicial.', 'La prima presa deve aprirsi con la carta iniziale.'],
    ['You must follow suit.', 'Debes seguir el palo.', 'Du musst Farbe bedienen.', 'Vous devez fournir à la couleur.', 'Você precisa seguir o naipe.', 'Devi rispondere al seme.'],
    ['Hearts are not broken yet — lead another suit.', 'Los corazones aún no se rompieron: sal con otro palo.', 'Herz ist noch nicht gebrochen – spiel eine andere Farbe aus.', 'Les cœurs ne sont pas encore ouverts — entamez une autre couleur.', 'As copas ainda não foram quebradas — saia com outro naipe.', 'I cuori non sono ancora aperti: apri con un altro seme.'],
    ['No penalty cards on the first trick.', 'No se juegan cartas de penalización en la primera baza.', 'Keine Strafkarten im ersten Stich.', 'Pas de carte de pénalité au premier pli.', 'Nada de cartas de penalidade na primeira vaza.', 'Niente carte di penalità nella prima presa.'],
    ['Select the right number of cards to pass.', 'Selecciona el número correcto de cartas para pasar.', 'Wähle die richtige Anzahl Karten zum Weitergeben.', 'Sélectionnez le bon nombre de cartes à passer.', 'Selecione o número certo de cartas para passar.', 'Seleziona il numero giusto di carte da passare.'],
    ['Each card can be passed only once.', 'Cada carta solo se puede pasar una vez.', 'Jede Karte kann nur einmal weitergegeben werden.', 'Chaque carte ne peut être passée qu’une fois.', 'Cada carta só pode ser passada uma vez.', 'Ogni carta si può passare una sola volta.'],
    ['You already passed.', 'Ya pasaste tus cartas.', 'Du hast schon weitergegeben.', 'Vous avez déjà passé vos cartes.', 'Você já passou suas cartas.', 'Hai già passato le carte.'],
    ['Not allowed.', 'No permitido.', 'Nicht erlaubt.', 'Non autorisé.', 'Não permitido.', 'Non consentito.'],
    ['Try this.', 'Prueba esto.', 'Versuch es damit.', 'Essayez ceci.', 'Tente isto.', 'Prova questo.'],
    ['Nothing to undo.', 'Nada que deshacer.', 'Nichts rückgängig zu machen.', 'Rien à annuler.', 'Nada para desfazer.', 'Niente da annullare.'],
    ['You took the trick — try to stay out of it.', 'Te llevaste la baza: intenta mantenerte al margen.', 'Du hast den Stich genommen – versuch, dich herauszuhalten.', 'Vous avez pris le pli — essayez de rester en dehors.', 'Você levou a vaza — tente ficar de fora.', 'Hai preso la presa: cerca di restarne fuori.'],
    ['Cannot pass those.', 'No puedes pasar esas.', 'Diese kannst du nicht weitergeben.', 'Impossible de passer ces cartes.', 'Não é possível passar essas.', 'Non puoi passare quelle.'],
    ['Cannot play that.', 'No puedes jugar esa.', 'Diese kannst du nicht spielen.', 'Impossible de jouer cette carte.', 'Não é possível jogar essa.', 'Non puoi giocare quella.'],
    ['Only {n} cards.', 'Solo {n} cartas.', 'Nur {n} Karten.', 'Seulement {n} cartes.', 'Só {n} cartas.', 'Solo {n} carte.'],
    // ---- lessons, play, results
    ['Lesson complete.', 'Lección completada.', 'Lektion geschafft.', 'Leçon terminée.', 'Lição concluída.', 'Lezione completata.'],
    ['{lesson} — done.', '{lesson}: hecho.', '{lesson} – erledigt.', '{lesson} — fait.', '{lesson} — feito.', '{lesson}: fatto.'],
    ['Next lesson', 'Siguiente lección', 'Nächste Lektion', 'Leçon suivante', 'Próxima lição', 'Lezione successiva'],
    ['Back to lessons', 'Volver a las lecciones', 'Zurück zu den Lektionen', 'Retour aux leçons', 'Voltar às lições', 'Torna alle lezioni'],
    ['to the left', 'a la izquierda', 'nach links', 'à gauche', 'para a esquerda', 'a sinistra'],
    ['to the right', 'a la derecha', 'nach rechts', 'à droite', 'para a direita', 'a destra'],
    ['across', 'al frente', 'nach gegenüber', 'en face', 'para a frente', 'di fronte'],
    ['Pass 1 card {dir}.', 'Pasa 1 carta {dir}.', 'Gib 1 Karte {dir} weiter.', 'Passez 1 carte {dir}.', 'Passe 1 carta {dir}.', 'Passa 1 carta {dir}.'],
    ['Pass {n} cards {dir}.', 'Pasa {n} cartas {dir}.', 'Gib {n} Karten {dir} weiter.', 'Passez {n} cartes {dir}.', 'Passe {n} cartas {dir}.', 'Passa {n} carte {dir}.'],
    ['Your turn — play a card.', 'Tu turno: juega una carta.', 'Du bist dran – spiel eine Karte.', 'À vous — jouez une carte.', 'Sua vez — jogue uma carta.', 'Tocca a te: gioca una carta.'],
    ['{seat} is thinking…', '{seat} está pensando…', '{seat} überlegt …', '{seat} réfléchit…', '{seat} está pensando…', '{seat} sta pensando…'],
    ['Match over.', 'Partida terminada.', 'Partie vorbei.', 'Partie terminée.', 'Partida encerrada.', 'Partita finita.'],
    ['Pass {n}/{total}', 'Pasar {n}/{total}', 'Weitergeben {n}/{total}', 'Passer {n}/{total}', 'Passar {n}/{total}', 'Passa {n}/{total}'],
    ['Select {n} cards to pass.', 'Selecciona {n} cartas para pasar.', 'Wähle {n} Karten zum Weitergeben.', 'Sélectionnez {n} cartes à passer.', 'Selecione {n} cartas para passar.', 'Seleziona {n} carte da passare.'],
    ['Hint', 'Pista', 'Tipp', 'Indice', 'Dica', 'Suggerimento'],
    ['Undo', 'Deshacer', 'Rückgängig', 'Annuler', 'Desfazer', 'Annulla'],
    ['Round {n} · hearts broken', 'Ronda {n} · corazones rotos', 'Runde {n} · Herz gebrochen', 'Manche {n} · cœurs ouverts', 'Rodada {n} · copas quebradas', 'Mano {n} · cuori aperti'],
    ['Round {n}', 'Ronda {n}', 'Runde {n}', 'Manche {n}', 'Rodada {n}', 'Mano {n}'],
    ['Achievement unlocked: {names}', 'Logro desbloqueado: {names}', 'Erfolg freigeschaltet: {names}', 'Succès débloqué : {names}', 'Conquista desbloqueada: {names}', 'Obiettivo sbloccato: {names}'],
    ['{seat}: {score}', '{seat}: {score}', '{seat}: {score}', '{seat} : {score}', '{seat}: {score}', '{seat}: {score}'],
    ['You win the table.', 'Ganas la mesa.', 'Du gewinnst den Tisch.', 'Vous remportez la table.', 'Você vence a mesa.', 'Vinci il tavolo.'],
    ['{seat} takes the table.', '{seat} gana la mesa.', '{seat} gewinnt den Tisch.', '{seat} remporte la table.', '{seat} vence a mesa.', '{seat} vince il tavolo.'],
    ['Play again', 'Jugar de nuevo', 'Nochmal spielen', 'Rejouer', 'Jogar de novo', 'Gioca ancora'],
    ['{goal} — achieved', '{goal}: conseguido', '{goal} – geschafft', '{goal} — réussi', '{goal} — cumprido', '{goal}: riuscito'],
    ['{goal} — not met', '{goal}: no conseguido', '{goal} – verfehlt', '{goal} — manqué', '{goal} — não cumprido', '{goal}: mancato'],
    ['Saving…', 'Guardando…', 'Wird gespeichert …', 'Enregistrement…', 'Salvando…', 'Salvataggio…'],
    ['Cloud synced', 'Sincronizado en la nube', 'Cloud synchronisiert', 'Synchronisé en ligne', 'Sincronizado na nuvem', 'Sincronizzato nel cloud'],
    ['Cloud unreachable', 'Nube inaccesible', 'Cloud nicht erreichbar', 'Sauvegarde en ligne injoignable', 'Nuvem inacessível', 'Cloud non raggiungibile'],
    ['Player {id}', 'Jugador {id}', 'Spieler {id}', 'Joueur {id}', 'Jogador {id}', 'Giocatore {id}'],
    ['You', 'Tú', 'Du', 'Vous', 'Você', 'Tu'],
    // ---- hints (rules engine)
    ['Shed your most dangerous cards.', 'Deshazte de tus cartas más peligrosas.', 'Gib deine gefährlichsten Karten ab.', 'Débarrassez-vous de vos cartes les plus dangereuses.', 'Livre-se das suas cartas mais perigosas.', 'Liberati delle carte più pericolose.'],
    ['Pass the Nightshade Queen — she is 13 points of trouble.', 'Pasa la Reina Belladona: son 13 puntos de problemas.', 'Gib die Nachtschattenkönigin weiter – sie bringt 13 Punkte Ärger.', 'Passez la Reine Belladone — elle vaut 13 points d’ennuis.', 'Passe a Rainha Beladona — ela vale 13 pontos de problemas.', 'Passa la Regina Belladonna: sono 13 punti di guai.'],
    ['High spades attract the Queen. Let them go.', 'Las picas altas atraen a la Reina. Suéltalas.', 'Hohe Pik ziehen die Königin an. Gib sie ab.', 'Les piques hauts attirent la Reine. Laissez-les partir.', 'Espadas altas atraem a Rainha. Livre-se delas.', 'Le picche alte attirano la Regina. Lasciale andare.'],
    ['Pass your highest hearts before they stick to you.', 'Pasa tus corazones más altos antes de que se te queden.', 'Gib deine höchsten Herzen ab, bevor sie an dir kleben bleiben.', 'Passez vos plus hauts cœurs avant qu’ils ne vous collent.', 'Passe suas copas mais altas antes que fiquem com você.', 'Passa i cuori più alti prima che ti restino addosso.'],
    ['Lead low and stay out of trouble.', 'Sal con una carta baja y evita problemas.', 'Spiel niedrig aus und halte dich aus Ärger heraus.', 'Entamez bas et restez hors de danger.', 'Saia com carta baixa e fique longe de problemas.', 'Apri basso e stai fuori dai guai.'],
    ['You are void — drop the Queen on someone.', 'No tienes ese palo: endósale la Reina a alguien.', 'Du bist blank – wirf jemandem die Königin zu.', 'Vous n’avez plus de cette couleur — refilez la Reine à quelqu’un.', 'Você não tem o naipe — jogue a Rainha em alguém.', 'Sei scoperto: scarica la Regina su qualcuno.'],
    ['You are void — shed a heart.', 'No tienes ese palo: deshazte de un corazón.', 'Du bist blank – wirf ein Herz ab.', 'Vous n’avez plus de cette couleur — défaussez un cœur.', 'Você não tem o naipe — descarte uma copa.', 'Sei scoperto: scarta un cuore.'],
    ['You are void — discard your most dangerous card.', 'No tienes ese palo: descarta tu carta más peligrosa.', 'Du bist blank – wirf deine gefährlichste Karte ab.', 'Vous n’avez plus de cette couleur — défaussez votre carte la plus dangereuse.', 'Você não tem o naipe — descarte sua carta mais perigosa.', 'Sei scoperto: scarta la carta più pericolosa.'],
    ['Duck under — let someone else eat the points.', 'Juega por debajo: que otro se coma los puntos.', 'Duck dich – lass jemand anderen die Punkte schlucken.', 'Passez dessous — laissez un autre ramasser les points.', 'Jogue por baixo — deixe outro levar os pontos.', 'Stai sotto: lascia i punti a qualcun altro.'],
    ['Follow suit, low and safe.', 'Sigue el palo, bajo y seguro.', 'Bediene die Farbe, niedrig und sicher.', 'Fournissez à la couleur, bas et sans risque.', 'Siga o naipe, baixo e seguro.', 'Rispondi al seme, basso e sicuro.'],
    // ---- content: goals
    ['Win the match', 'Gana la partida', 'Gewinne die Partie', 'Gagnez la partie', 'Vença a partida', 'Vinci la partita'],
    ['Win with your score at {v} or less', 'Gana con {v} puntos o menos', 'Gewinne mit höchstens {v} Punkten', 'Gagnez avec {v} points ou moins', 'Vença com {v} pontos ou menos', 'Vinci con {v} punti o meno'],
    ['Win without taking the Nightshade Queen', 'Gana sin llevarte la Reina Belladona', 'Gewinne, ohne die Nachtschattenkönigin zu nehmen', 'Gagnez sans prendre la Reine Belladone', 'Vença sem pegar a Rainha Beladona', 'Vinci senza prendere la Regina Belladonna'],
    ['Win, and capture every penalty card in one round', 'Gana y captura todas las cartas de penalización en una ronda', 'Gewinne und hol in einer Runde alle Strafkarten', 'Gagnez et capturez toutes les cartes de pénalité en une manche', 'Vença e capture todas as cartas de penalidade numa rodada', 'Vinci e cattura tutte le carte di penalità in una mano'],
    ['Win, with one round of zero hearts taken', 'Gana con una ronda sin llevarte ningún corazón', 'Gewinne mit einer Runde ohne ein einziges Herz', 'Gagnez avec une manche sans aucun cœur pris', 'Vença com uma rodada sem pegar nenhuma copa', 'Vinci con una mano senza prendere cuori'],
    // ---- content: modes and lessons
    ['Casual', 'Casual', 'Locker', 'Détente', 'Casual', 'Rilassata'],
    ['Apprentice', 'Aprendiz', 'Lehrling', 'Apprenti', 'Aprendiz', 'Apprendista'],
    ['Expert', 'Experto', 'Experte', 'Expert', 'Especialista', 'Esperto'],
    ['Follow the suit', 'Sigue el palo', 'Farbe bedienen', 'Fournir à la couleur', 'Siga o naipe', 'Rispondi al seme'],
    ['Pass three cards', 'Pasa tres cartas', 'Drei Karten weitergeben', 'Passer trois cartes', 'Passe três cartas', 'Passa tre carte'],
    ['Duck the points', 'Esquiva los puntos', 'Den Punkten ausweichen', 'Esquiver les points', 'Fuja dos pontos', 'Schiva i punti'],
    ['Dump the Queen', 'Endosa la Reina', 'Die Königin loswerden', 'Refiler la Reine', 'Descarte a Rainha', 'Scarica la Regina'],
    ['Catch the Eclipse', 'Logra el Eclipse', 'Die Finsternis fangen', 'Réussir l’Éclipse', 'Faça o Eclipse', 'Cattura l’Eclissi'],
    ['Second chances', 'Segundas oportunidades', 'Zweite Chancen', 'Deuxièmes chances', 'Segundas chances', 'Seconde possibilità'],
    // ---- content: challenges and achievements
    ['Queen Dodger', 'Esquivarreinas', 'Königinnen-Ausweicher', 'Esquive-Reine', 'Foge da Rainha', 'Schivaregina'],
    ['Total Eclipse', 'Eclipse total', 'Totale Finsternis', 'Éclipse totale', 'Eclipse total', 'Eclissi totale'],
    ['Sprint Night', 'Noche exprés', 'Sprintnacht', 'Nuit éclair', 'Noite relâmpago', 'Notte sprint'],
    ['Three’s Company', 'Tres son multitud', 'Zu dritt', 'Jamais deux sans trois', 'Três é demais', 'Tre è il numero perfetto'],
    ['Clean Hands', 'Manos limpias', 'Saubere Hände', 'Mains propres', 'Mãos limpas', 'Mani pulite'],
    ['Moon Marathon', 'Maratón lunar', 'Mondmarathon', 'Marathon lunaire', 'Maratona lunar', 'Maratona lunare'],
    ['First Sitting', 'Primera partida', 'Erste Runde am Tisch', 'Première séance', 'Primeira partida', 'Prima seduta'],
    ['Regular', 'Habitual', 'Stammgast', 'Habitué', 'Frequentador', 'Habitué'],
    ['Half the Night', 'Media noche', 'Die halbe Nacht', 'La moitié de la nuit', 'Meia noite', 'Mezza notte'],
    ['Conservatory Master', 'Maestro del invernadero', 'Meister des Wintergartens', 'Maître de la serre', 'Mestre da estufa', 'Maestro della serra'],
    ['Moon Watcher', 'Observador de la luna', 'Mondbeobachter', 'Guetteur de lune', 'Observador da lua', 'Osservatore della luna'],
    ['Night Owl', 'Ave nocturna', 'Nachteule', 'Oiseau de nuit', 'Coruja', 'Nottambulo'],
    // ---- content: journey stages
    ['First Hand', 'Primera mano', 'Erstes Blatt', 'Première donne', 'Primeira mão', 'Prima mano'],
    ['Open Windows', 'Ventanas abiertas', 'Offene Fenster', 'Fenêtres ouvertes', 'Janelas abertas', 'Finestre aperte'],
    ['Night Shift', 'Turno de noche', 'Nachtschicht', 'Service de nuit', 'Turno da noite', 'Turno di notte'],
    ['Watch the Queen', 'Vigila a la Reina', 'Achte auf die Königin', 'Surveillez la Reine', 'De olho na Rainha', 'Occhio alla Regina'],
    ['Three at the Table', 'Tres en la mesa', 'Zu dritt am Tisch', 'Trois à table', 'Três à mesa', 'Tre al tavolo'],
    ['Quiet Hands', 'Manos tranquilas', 'Ruhige Hände', 'Mains tranquilles', 'Mãos tranquilas', 'Mani tranquille'],
    ['Passing Trade', 'Intercambio', 'Tauschhandel', 'Échange de bons procédés', 'Troca de cartas', 'Scambio di carte'],
    ['Heartbreak Hotel', 'Hotel de los corazones rotos', 'Hotel der gebrochenen Herzen', 'L’hôtel des cœurs brisés', 'Hotel dos corações partidos', 'Hotel dei cuori infranti'],
    ['Long Night', 'Noche larga', 'Lange Nacht', 'Longue nuit', 'Noite longa', 'Notte lunga'],
    ['Glasshouse Trial', 'Prueba del invernadero', 'Prüfung im Glashaus', 'Épreuve de la serre', 'Prova da estufa', 'Prova della serra'],
    ['No Passing Lane', 'Sin pases', 'Ohne Weitergeben', 'Sans passe', 'Sem passes', 'Niente passaggi'],
    ['Queen’s Garden', 'El jardín de la Reina', 'Der Garten der Königin', 'Le jardin de la Reine', 'O jardim da Rainha', 'Il giardino della Regina'],
    ['Short Visit', 'Visita corta', 'Kurzer Besuch', 'Courte visite', 'Visita curta', 'Visita breve'],
    ['Moon Debt', 'Deuda lunar', 'Mondschuld', 'Dette lunaire', 'Dívida lunar', 'Debito lunare'],
    ['Triple Moon', 'Triple luna', 'Dreifacher Mond', 'Triple lune', 'Lua tripla', 'Triplice luna'],
    ['Eclipse Season', 'Temporada de eclipses', 'Finsternis-Saison', 'Saison des éclipses', 'Temporada de eclipses', 'Stagione delle eclissi'],
    ['High Stakes Tea', 'Té de altas apuestas', 'Tee mit hohem Einsatz', 'Thé à gros enjeux', 'Chá de apostas altas', 'Tè ad alta posta'],
    ['Right Hand Only', 'Solo a la derecha', 'Nur nach rechts', 'Uniquement à droite', 'Só para a direita', 'Solo a destra'],
    ['Duel at Dusk', 'Duelo al anochecer', 'Duell in der Dämmerung', 'Duel au crépuscule', 'Duelo ao anoitecer', 'Duello al tramonto'],
    ['Conservatory Exam', 'Examen del invernadero', 'Wintergarten-Prüfung', 'Examen de la serre', 'Exame da estufa', 'Esame della serra'],
    ['Hard Frost', 'Helada dura', 'Strenger Frost', 'Gelée dure', 'Geada forte', 'Gelata'],
    ['Queen’s Gambit', 'Gambito de dama', 'Damengambit', 'Gambit de la Reine', 'Gambito da Rainha', 'Gambetto di donna'],
    ['Lean Table', 'Mesa austera', 'Magerer Tisch', 'Table maigre', 'Mesa enxuta', 'Tavolo magro'],
    ['No Mercy Rule', 'Regla sin piedad', 'Gnadenlos', 'Règle sans pitié', 'Regra sem piedade', 'Regola senza pietà'],
    ['Swift Night', 'Noche veloz', 'Schnelle Nacht', 'Nuit rapide', 'Noite veloz', 'Notte veloce'],
    ['Garden of Hearts', 'Jardín de corazones', 'Garten der Herzen', 'Jardin des cœurs', 'Jardim de copas', 'Giardino dei cuori'],
    ['Duel of Wits', 'Duelo de ingenio', 'Duell der Köpfe', 'Duel d’esprit', 'Duelo de inteligência', 'Duello d’ingegno'],
    ['Across the Moon', 'Al otro lado de la luna', 'Quer über den Mond', 'De l’autre côté de la lune', 'Do outro lado da lua', 'Oltre la luna'],
    ['Thin Ice', 'Hielo fino', 'Dünnes Eis', 'Glace mince', 'Gelo fino', 'Ghiaccio sottile'],
    ['Midnight Mastery', 'Maestría de medianoche', 'Mitternachtsmeisterschaft', 'Maîtrise de minuit', 'Maestria da meia-noite', 'Maestria di mezzanotte'],
    ['Pip’s Riddle', 'El acertijo de Pip', 'Pips Rätsel', 'L’énigme de Pip', 'O enigma de Pip', 'L’indovinello di Pip'],
    ['The Long Count', 'La cuenta larga', 'Die lange Zählung', 'Le long compte', 'A longa contagem', 'Il lungo conto'],
    ['Queen Hunting', 'Caza de la Reina', 'Königinnenjagd', 'Chasse à la Reine', 'Caça à Rainha', 'Caccia alla Regina'],
    ['Cheap Victory', 'Victoria barata', 'Billiger Sieg', 'Victoire à bon compte', 'Vitória barata', 'Vittoria a buon mercato'],
    ['Trio Finale', 'Final a tres', 'Trio-Finale', 'Finale à trois', 'Final a três', 'Finale a tre'],
    ['Duel Under Glass', 'Duelo bajo el cristal', 'Duell unter Glas', 'Duel sous verre', 'Duelo sob o vidro', 'Duello sotto vetro'],
    ['Eclipse or Bust', 'Eclipse o nada', 'Finsternis oder nichts', 'Éclipse ou rien', 'Eclipse ou nada', 'Eclissi o niente'],
    ['Iron Nerves', 'Nervios de acero', 'Nerven aus Stahl', 'Nerfs d’acier', 'Nervos de aço', 'Nervi d’acciaio'],
    ['Last Lamp Burning', 'La última lámpara encendida', 'Die letzte Lampe brennt', 'La dernière lampe allumée', 'A última lâmpada acesa', 'L’ultima lampada accesa']
  ];

  // Regional variants: only where they differ from en-US, es-419 and fr-FR.
  var EN_GB = {};
  var ES_ES = {
    'You already passed.': 'Ya has pasado tus cartas.',
    'The match is over.': 'La partida ha terminado.',
    'Hearts are not broken yet — lead another suit.': 'Los corazones aún no se han roto: sal con otro palo.',
    'You took the trick — try to stay out of it.': 'Te has llevado la baza: intenta mantenerte al margen.',
    'Casual': 'Informal'
  };
  var FR_CA = {
    'Cloud synced': 'Synchronisé dans le nuage',
    'Cloud unreachable': 'Nuage injoignable'
  };

  var T = { 'es-419': {}, 'de-DE': {}, 'fr-FR': {}, 'pt-BR': {}, 'it-IT': {} };
  var COLS = ['es-419', 'de-DE', 'fr-FR', 'pt-BR', 'it-IT'];
  ROWS.forEach(function (r) {
    for (var i = 0; i < COLS.length; i++) T[COLS[i]][r[0]] = r[i + 1];
  });
  T['en-GB'] = EN_GB;
  T['es-ES'] = ES_ES;
  T['fr-CA'] = FR_CA;
  root.HF_STRINGS = T;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
