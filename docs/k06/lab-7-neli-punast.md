---
tags:
  - Jenkins
  - CI/CD
  - veaotsing
---

# 7. Neli punast buildi

Tee see leht pärast IS1 praktikumi lõppu ja [süvenemise osa 4](syvenemine.md#osa-4-image-paralleel-ja-deploy): intsident eeldab, et Jenkinsfile'is on etapp `Avaldamine` (Nexus ja Docker image paralleelselt) ja `Deploy`. Kui fail `k06-jenkins/intsident.sh` puudub, võta see avalikust rakenduse repositooriumist:

```bash
curl -fsSL -o k06-jenkins/intsident.sh https://raw.githubusercontent.com/hkhk-tk/labori-seis/main/deploy/ci/intsident.sh
chmod +x k06-jenkins/intsident.sh
```

Kolleeg tegi enne puhkust harule `k06-jenkins` "väikese koristuse" ja samal õhtul vahetati agentide saladused. Pipeline on punane ja rikkeid on neli, eri kohtades: järgmist näed alles siis, kui eelmine on parandatud. Agendi, triggerid, quality gate'i ja Nexuse seadistasid täna ise. Raskus on selles, et sa ei tea, kus viga on. Liigu väljast sisse (kas build üldse käivitub, kas kood saab läbi, kas tulemus jõuab kohale), paranda iga rike eraldi commit'iga ja kirjuta sõnumisse põhjus.

**Kui teed seda tööl iga päev:** CI intsidendi koha leiad buildi logist ilma veaotsingu tabelita. Kui see on sul juba korras, jäta tabel vahele ja mine otse etappi [„Käivita intsident“](#kaivita-intsident); raskeim osa on [„Leia, mida intsident maha jättis“](#leia-mida-intsident-maha-jattis).

Veaotsingu tabel kitsendab otsingu ühe kohani, vastust see ei anna.

| Sümptom | Vaata esimesena | Tõenäoline koht |
|---|---|---|
| build ei alga, järjekorras `‘<gh>’ is offline` või "Waiting for next available executor" | Nodes leht, `journalctl -u jenkins-agent -n 30 --no-pager` | agendi masin: teenus, saladus, VPN |
| `Couldn't find any revision to build` | jobi Git seadistus, `git ls-remote origin` | haru või credential `github` |
| Quality Gate: `Pipeline aborted due to quality gate failure: ERROR` | Sonari projekt → Issues, viimase analüüsi uued leiud | viimases commit'is muutunud kood |
| Quality Gate ootab timeout'ini | Sonari *Administration → Background Tasks* | webhook (koolitaja pool) |
| Nexuse haru: 401 või teade credential'i kohta, kuigi parool pole muutunud | Nexuse haru konsool, folderi Credentials leht | Jenkinsfile'i `credentialsId` ja folderi ID-d |
| Nexuse haru: 400 | buildi nimi, Nexus Browse: kas see versioon on juba olemas | versiooni arvutus etapis Build |
| Nexuse haru: 403 | Nexuse tee konsoolis | `NEXUS_GROUP` ja groupId |

*Tabel L6.1. Veaotsingu tabel.*

> Kui pipeline'ist ei saa enam aru, näitab `git log --oneline -5`, kust "koristus" algas. Revert'i siin ei tehta, iga rike parandatakse eraldi.

## Käivita intsident

Skript muudab sinu repositooriumi ja agendi masinat nii, nagu kolleeg ja administraator oleksid teinud. Enne käivitamist peab viimane build olema roheline ja töökaust puhas, sest muidu ei tea sa hiljem, milline viga oli sinu oma ja milline tuli intsidendiga.

1. Veendu, et viimane build on roheline ja töökaust puhas: `git status --short` on tühi.
2. Käivita skript repositoorium juurest. See küsib kinnitust.

    ```bash
    k06-jenkins/intsident.sh
    ```

3. Ära loe skripti ega tee `git show HEAD` enne, kui oled kõik neli riket buildi logist leidnud: skripti sisu on vastuste võti.

Uus commit GitHubis on nüüd sinu "viimane muudatus". Pane tähele selle räsi: iga järgmise buildi juures kontrollid, kas build ehitas just seda või sinu parandust.

**Edasi saad minna, kui** skript ütles `Intsident käivitatud` ja GitHubis on harul `k06-jenkins` uus commit `chore: koristus enne puhkust`.

## Too build järjekorrast välja

Alustad kõige välimisest kohast. Kui build ei jõua isegi agendile, pole mõtet vaadata koodi ega Nexust: ükski neist pole veel käivitunud. Sümptom on järjekorras, põhjus on masinas.

1. Oota pollSCM-i buildi. Vaata, mis olekus see on ja mida ütleb järjekorra teade.
2. Liigu tabeli järgi: Nodes leht, siis agendi masinas teenus ja selle journal.
3. Paranda nii, et agent ühendub uuesti. Jenkinsis ega Jenkinsfile'is midagi ei muudeta.
4. Kirjuta PR-i kirjeldusse: sümptomi rida, journal'i rida, mis põhjuse näitas, ja parandus.

Kui ootav build algas kohe pärast agendi ühendumist, oli agent ainus takistus. Kui build algas ja ebaõnnestus kohe, oled järgmise vea juures.

**Edasi saad minna, kui** agent on Nodes all roheline ja ootav build algas.

## Veendu, et agent püsib

Kontrollid, et agent ühendub ka pärast teenuse ja masina taaskäivitust, ilma et sa midagi käsitsi teeksid.

1. Taaskäivita teenus ja vaata, kas see ühendub ise.

    ```bash
    sudo systemctl restart jenkins-agent && sleep 15
    journalctl -u jenkins-agent --since "-1min" --no-pager | grep -c Connected
    systemctl is-enabled jenkins-agent
    ```

2. Vaata Nodes lehte ja veendu, et agent on roheline.

`Connected` pärast restart'i ja `enabled` tähendavad, et parandus on teenuse püsivas seadistuses ja kehtib ka pärast masina taaskäivitust. Kui restart viis agendi uuesti punaseks, oli sinu parandus ajutine: vaata, mida teenus käivitamisel loeb.

**Edasi saad minna, kui** pärast restart'i on `grep -c` vähemalt `1`, `is-enabled` annab `enabled` ja agent on Nodes all roheline.

## Pane quality gate roheliseks

Build käivitub, aga peatub etapis, mis kontrollib koodi kvaliteeti. Nüüd on põhjus koodis ja tõendid on kahes kohas: Jenkinsi logis ja Sonari projektis. Logi ütleb, et quality gate ebaõnnestus, Sonar ütleb miks.

Quality gate'i "kiire parandus" oleks tingimuse leevendamine või etapi väljakommenteerimine. See teeb buildi roheliseks ja jätab vea koodi alles, ja automaatne hindaja kontrollib just seda, et etapp oleks failis.

1. Leia Graph View's esimene punane etapp ja selle logi viimased read.
2. Leia Sonari projektist leid, mis tegi hinde kehvemaks: reegel, fail ja rida.
3. Paranda kood ja tee commit kujul `fix(<koht>): <põhjus>`.
4. Push ja oota buildi.

Kui quality gate on roheline ja Sonaris pole uut leidu, parandasid põhjuse, mitte sümptomi. Kui hinne paranes, aga leid on ikka olemas, oli muudatus kuskil mujal ja reegel lihtsalt ei loe seda enam uueks koodiks.

**Edasi saad minna, kui** etapp Quality Gate on roheline ja logis on `Quality gate is OK`.

## Lase Nexusel WAR vastu võtta

Kood on korras, aga tulemus ei jõua Nexusesse. Nüüd on viga Jenkinsfile'i ja Jenkinsi credential'ite vahel. `Avaldamine` töötab paralleelselt: üks haru võib olla roheline ja teine punane. Vaata haru, mitte kogu buildi.

Paralleelse buildi viimane rida ütleb tavaliselt ainult, et "üks haru ebaõnnestus". Kui loed ainult seda, otsid viga valest harust ja Docker image'i haru roheline tulemus jätab mulje, et avaldamine töötas.

1. Ava Nexuse haru konsool ja leia esimene veateade.
2. Võrdle Jenkinsfile'i credential'i ID-d folderi Credentials lehega.
3. Paranda ja tee commit `fix(<koht>): <põhjus>`. Parandada saab kahes kohas: Jenkinsfile'is või folderi credential'ites. Kirjuta PR-i, kumma valisid ja miks.
4. Push ja oota buildi.

Kaks parandusviisi annavad sama rohelise tulemuse, aga erinevad selle poolest, kus on tõe allikas (source of truth). Üks muudab koodi ja jääb Giti ajalukku, teine muudab Jenkinsi olekut, mida Git ei näe. Sinu põhjendus PR-is näitab, kumba sa järgmisel korral eelistad ja miks.

**Edasi saad minna, kui** mõlemad `Avaldamine` harud on rohelised ja Nexuse haru logis on `Uploaded:`.

## Tee kaks rohelist buildi järjest

Üks roheline build ei tõesta, et versioonimine töötab. Rike on parandatud alles siis, kui ka järgmine build läheb läbi. Mõned vead ilmnevad alles teisel käivitusel, sest esimesel korral pole veel varasemat versiooni, millega konflikti minna.

1. Tee kaks väikest commit'i, igaühe järel oota pollSCM-i buildi lõppu.
2. Kui teine build ebaõnnestub, leia tabelist rida, paranda ja tee commit `fix(<koht>): <põhjus>`.
3. Kontrolli, et Nexuses on kaks erinevat uut versiooni.

    ```bash
    curl -s "http://nexus.lab.hkhk.ee:8081/service/rest/v1/search?repository=labori-seis&group=ee.hkhk.<gh>" \
        | grep -o '"version" : "[^"]*"' | sort -u | tail -3
    ```

Kaks erinevat versiooni Nexuses ja samad nimed buildi ajaloos tõestavad, et iga build saab unikaalse versiooni.

**Edasi saad minna, kui** kaks järjestikust buildi on rohelised, Nexuses on nende kaks eri versiooni kujul `<pom>-<build>-<sha>` ja buildide nimed näitavad samu versioone.

## Leia, mida intsident maha jättis

Rikked on parandatud, aga intsidendi ajal töötas `Avaldamine` edasi poolikult. Docker image'i haru lõpetas ka siis, kui Nexuse haru ebaõnnestus, ja vigase versiooniarvutusega buildid avaldasid versiooni ilma buildi numbri ja räsita. Agendil võib olla image, mida Nexuses pole, või sama tag'iga image, mille WAR erineb Nexuse failist. Nexusesse võis jääda versioon, mille kohta ei saa öelda, millisest commit'ist see tehti. Deploy, mis valib image'i tag'i järgi, paigaldaks siis faili, mida quality gate ja Nexus ei ole näinud.

Siin pole üht õiget parandust. Sina otsustad, mida kustutada, mida märkida ja kuidas pipeline peab osalise rikke korral käituma.

1. Kirjuta kontroll: shelli tsükkel või skript `k06-jenkins/image-vs-nexus.sh`. Nõuded:
    - iga `labori-seis` image'i kohta agendil on üks rida: tag ja tulemus `OK`, `ERINEB` või `NEXUSES POLE`;
    - räsi arvutatakse image'i seest (`/usr/local/tomcat/webapps/ROOT.war`) ja Nexuse räsi tuleb `.sha1` failist, nagu osas „Image, paralleel ja deploy“;
    - Nexuse `404` annab tulemuse `NEXUSES POLE`, mitte skripti vea.
2. Käivita kontroll ja pane väljund PR-i kirjeldusse.
3. Kustuta image'id, mille tulemus pole `OK`. Leia Nexuse REST API-st versioonid, mis ei ole kujul `<pom>-<build>-<sha>`. Neid sa kustutada ei saa: kirjuta need PR-i koos buildi numbriga, millest need tulid.
4. Otsusta, mida pipeline teeb, kui üks `Avaldamine` haru ebaõnnestub ja teine õnnestub. Variandid on näiteks `failFast true`, image alles pärast Nexuse haru või image'i kustutamine plokis `post { unsuccessful }`. Kirjuta PR-i valik, põhjus ja hind buildi ajas.

```bash
docker image ls labori-seis --format '{{.Tag}}'
curl -s "http://nexus.lab.hkhk.ee:8081/service/rest/v1/search?repository=labori-seis&group=ee.hkhk.<gh>" \
    | grep -o '"version" : "[^"]*"' | sort -u
```

> `failFast true` ei aita, kui Docker image'i haru lõpetab enne, kui Nexuse haru ebaõnnestub: katkestatakse ainult harud, mis veel töötavad.

Tag on nimi, räsi on sisu. Versiooniga `1.1.0` ehitatud image ja Nexusesse jõudnud `1.1.0` võivad tulla eri buildidest ja eri commit'idest. Plokk `cleanup` jätab alles kolm uusimat image'it, mitte kolm kontrollitut, nii et vana image võib jääda alles ka pärast rohelisi buildeid. Nexuse release-repositoorium ei luba versiooni üle kirjutada. Intsidendi ajal sinna jõudnud versioon jääb alles, kuni administraator selle kustutab. Kuni seda pole tehtud, peab iga deploy versiooni kuju kontrollima.

**Edasi saad minna, kui** kontrolli väljundis on iga image'i juures `OK`, `docker image ls labori-seis` ei näita tag'i ilma buildi numbri ja räsita ning PR-i kirjelduses on Nexuse ebatavalised versioonid ja otsus osalise rikke kohta koos põhjendusega.

## Kirjuta intsidendi kokkuvõte

Kokkuvõte on blameless postmortem'i lühike kuju. Sümptomi ja paranduse leiab logist ja Giti ajaloost, ennetus on sinu järeldus.

1. Kirjuta PR-i kirjeldusse tabel nelja reaga: sümptom, asukoht, põhjus, parandus (commit'i räsi), kuidas sama riket ennetada.
2. Alles nüüd loe `k06-jenkins/intsident.sh` ja `git show <chore commit>`. Kas leidsid kõik neli ja kas mõni sinu põhjus erineb tegelikust?
3. Käivita kõik automaatse hindaja kontrollid.

    ```bash
    for t in files agent stages triggers quality nexus secrets docker; do bash autograde/check.sh k06 "$t"; done
    git log --oneline -6
    ```

Kui sinu põhjus erineb skripti omast, kirjuta erinevus tabelisse. Sageli leiad sümptomi järgi õige koha, aga vale mehhanismi. Kaheksa `OK`-i tähendavad, et parandused ei lõhkunud midagi, mida automaatne hindaja kontrollib.

**Edasi saad minna, kui** tabelis on neli rida ennetusega, kõik kaheksa kontrolli annavad `OK` ja `git log` näitab pärast `chore` commit'i vähemalt kolme `fix(...)` commit'i.

**Selle mooduli tõend:** `fix(...)` commit'id põhjusega sõnumis; PR-i kirjelduses iga rikke sümptomi ja põhjuse logirida, agendi restart'i järel `Connected` ja `enabled`, credentiali parandusviisi põhjendus, Nexuse kaks versiooni, image'ite ja Nexuse räside võrdluse väljund, Nexuse ebatavalised versioonid, otsus osalise rikke kohta ja nelja reaga intsidendi tabel.

## Miks see nii töötab

**Paralleelsed harud.** Paralleelsete harude puhul on build ebaõnnestunud, kui üks haru ebaõnnestub, kuid teised harud töötavad lõpuni (`failFast` on vaikimisi välja lülitatud). Seetõttu vaata rikke korral haru logi, mitte buildi logi viimast rida.

**Agendi saladus.** Agendi saladus on node'i identiteet. Controller arvutab selle node'i nimest ja oma võtmest kaustas `secrets/`. Ümbernimetatud node või uue kaustaga `secrets/` Jenkins annab uue saladuse ja vana agent ei saa enam ühendust luua.

**Väljast sisse.** Väljast sisse otsimine on sama võte, mida kasutasid 1. kohtumisel moodulis „Kolm viga“. Väline viga (kas build üldse käivitub) varjab sisemisi vigu: kuni agent on offline, ei näe koodi ega Nexuse viga. Seetõttu on intsidendi alguses kõige kasulikum küsimus, mis on esimene koht, kus olukord erineb eilsest.

Lisaülesanne [15. Agendi olek monitooringusse](lisa.md#15-agendi-olek-monitooringusse): paned agendi oleku kontrolli timer'iga käivituma nii, et offline agent annab häire enne, kui build järjekorda jääb, aga restart ja controlleri katkestus häiret ei anna.
