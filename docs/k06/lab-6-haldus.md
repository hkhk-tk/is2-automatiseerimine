---
tags:
  - Jenkins
  - turve
  - varundus
---

# 6. Õigused, varundus ja taaste

Tee see leht pärast lehte [Jenkins koodina](lab-5-jenkins-koodina.md), sest annad õigused, varundad ja taastad sama sandbox-Jenkinsit `jenkins-liivakast`.

Jenkinsi varukoopia, mida pole kunagi taastatud, on oletus, ja liiga lai roll annab igale kasutajale ligipääsu kõigi credential'itele. Mõlemad probleemid ilmnevad tavaliselt alles intsidendi ajal. Klassis tõendad, et naabri folder ja agent on sulle kinni. Oma sandbox-Jenkinsis annad kasutajale ainult lugemisõiguse, teed varukoopia, uuendad pluginat ja taastad varukoopia teise konteinerisse. Taaste on õnnestunud alles siis, kui jobid, õigused ja credential töötavad ka uues Jenkinsis.

**Kui teed seda tööl iga päev:** oled Jenkinsi `JENKINS_HOME`-i varukoopiast juba teise masinasse taastanud ja credential'id töötasid. Kui see on sul juba korras, mine otse etappi [„Taasta ilma võtmeta“](#taasta-ilma-votmeta).

## Proovi naabri folderit ja agenti

Paaristöö. Folderi roll ja agendi piirang eraldavad õppijad teineteisest kahel tasemel. Esimene tase on nähtavus: sa ei näe naabri jobe. Teine tase on täitmine: isegi kui sinu Jenkinsfile küsib naabri agenti, ei võta see agent sinu tööd vastu.

Kui ainult esimene tase töötaks, saaks sinu Jenkinsfile panna buildi töötama naabri masinas ja lugeda seal tema workspace'i ning `~/.m2`-s olevaid faile. Seepärast kontrollid mõlemat.

1. Küsi naabrilt tema `<gh>` ja ava brauseris `http://jenkins.lab.hkhk.ee:8080/job/<naabri-gh>/`.
2. Pane oma Jenkinsfile'is ajutiselt `agent { label '<naabri-gh>' }`, push ja vaata buildi järjekorras.
3. Taasta oma label, push.

403 või "not found" tähendab, et rolli regex ei kata naabri folderit. Ootav build tähendab, et Job Restrictions agendil lubab ainult sinu folderi jobe. Kui naabri agent oleks su buildi võtnud, oleks see turvaviga ja koolitaja peab sellest kohe teadma.

**Edasi saad minna, kui** naabri folder annab 403 või "not found", võõra labeliga build jäi ootama (naabri agent ei võta võõraid jobe, job-restrictions) ja sinu label on taastatud.

## Anna kasutajale ainult lugemisõigus

Nüüd seadistad õigused ise sandboxis. Matrix-strateegia on tabel, kus read on kasutajad ja veerud õigused. Lisaks globaalsele tabelile saab igal jobil olla oma tabel, mis annab õigusi juurde.

Kõige levinum viga on enda väljalukustamine: salvestad tabeli, kus admin puudub, ja keegi ei saa enam Manage Jenkinsisse. Seepärast lisad oma admin-kasutaja enne kõike muud.

1. `docker start jenkins-liivakast`, logi sisse adminina.
2. **Manage Jenkins → Users → Create User**: `vaatleja`.
3. [**Manage Jenkins → Security**](https://www.jenkins.io/doc/book/security/managing-security/) **→ Authorization**: *Project-based Matrix Authorization Strategy*.
4. Lisa **kõigepealt oma admin-kasutaja** ja anna talle *Overall/Administer*, siis `vaatleja`-le ainult *Overall/Read*. Salvesta.
5. Jobi `ehitus` → Configure → *Enable project-based security* → `vaatleja`: *Job/Read*.
6. Logi privaatses aknas sisse `vaatleja`-na.

<!-- EKRAANIPILT: sandbox-Jenkins (http://<control node>:8090) privaatses aknas kasutajana vaatleja: avalehel ainult job ehitus, jobi lehel puuduvad Build Now ja Configure. Sammu 30.4 esimese osa lõpus.
<figure markdown="span">
  ![Sandbox-Jenkins kasutaja vaatleja vaates: ainult job ehitus, nuppe Build Now ja Configure pole](assets/k06_vaatleja.png)
  <figcaption>Joonis L6.10. Kasutajal `vaatleja` on ainult ühe jobi lugemisõigus.</figcaption>
</figure>
-->

> Kui lukustasid end välja (admin jäi tabelist välja), lülita turve ajutiselt välja: `docker exec jenkins-liivakast sed -i 's#<useSecurity>true#<useSecurity>false#' /var/jenkins_home/config.xml && docker restart jenkins-liivakast`, siis sea õigused uuesti.

`vaatleja` näeb ainult jobi, millele andsid *Job/Read*, ja tal pole ühtegi nuppu, mis midagi muudaks. *Overall/Read* üksi lubab ainult sisse logida ja avalehte näha. *Overall/Read* on eeldus kõigele muule: ilma selleta ei näe kasutaja ka job'i, millele tal on *Job/Read*.

**Edasi saad minna, kui** `vaatleja` näeb ainult jobi `ehitus`, nupud Build Now ja Configure puuduvad ja ekraanipilt on PR-i kirjelduses.

## Tee varukoopia

Varukoopia tehakse peatatud teenuse kaustast `JENKINS_HOME`. Peatad Jenkinsi, sest töötav Jenkins kirjutab buildide logisid, `build.xml`-e ja pipeline'i olekut pidevalt. Et taastamise proovil oleks midagi kontrollida, lisad enne üht credential'i ja jobi, mis seda kasutab.

Arhiivis on koos `secrets/master.key` ja `secrets/hudson.util.Secret` ning `credentials.xml`, nii et arhiivi lugeja saab kõik credential'id lahti krüpteerida ilma Jenkinsita.

1. **Manage Jenkins → Credentials → System → Global → Add Credentials**: *Secret text*, ID `proov`, väärtus suvaline.
2. Jobi `ehitus` → Configure → *Build Environment → Use secret text(s) or file(s)* → muutuja `PROOV`, credential `proov`. Lisa Maveni sammu ette *Execute shell*: `test -n "$PROOV" && echo "credential loetav"`. **Build Now**.
3. Vaata, mis võtab ruumi, peata Jenkins ja paki volume kokku.

    ```bash
    docker exec jenkins-liivakast sh -c 'du -sh /var/jenkins_home/*' | sort -h | tail -5
    docker stop jenkins-liivakast
    docker run --rm -v jenkins-liivakast:/data -v "$HOME":/backup ubuntu:24.04 \
        tar czf /backup/jenkins-liivakast.tgz -C /data .
    ls -lh ~/jenkins-liivakast.tgz
    ```

4. Arhiivi tegi konteineris `root`. Vaata omanikku ja õigusi, tee fail ainult enda omaks ja kontrolli sisu.

    ```bash
    sudo chown "$USER": ~/jenkins-liivakast.tgz && chmod 600 ~/jenkins-liivakast.tgz
    ls -l ~/jenkins-liivakast.tgz && tar tzf ~/jenkins-liivakast.tgz | grep -c 'secrets/master.key'
    ```

> Arhiivi ei tohi kunagi Giti lisada, sest selles on `secrets/master.key` ja krüpteeritud credential'id.

`du` näitab tavaliselt, et suurimad osad on `plugins/`, `tools/` ja `jobs/`. Esimest kahte saaks uuesti paigaldada, aga `jobs/` ja `secrets/` on asendamatud.

**Edasi saad minna, kui** `ehitus` logis on `credential loetav`, arhiiv on kodukaustas õigustega `-rw-------`, `grep -c` annab `1` ja PR-i kirjelduses on kirjas, mis on arhiivi suurimad osad.

## Uuenda pluginat

Uuendus tehakse alles pärast varukoopiat. Pluginauuendus on Jenkinsi tavaline rikkeallikas: uus versioon võib nõuda uuemat Jenkinsit, muuta seadistuse XML-i kuju või eemaldada sammu, mida mõni Jenkinsfile kasutab. Plugin Manager jätab eelmise versiooni faili `plugins/<nimi>.bak` ja pakub nuppu *Downgrade*, aga see ei pööra tagasi seadistust, mille uus versioon juba ümber kirjutas.

1. `docker start jenkins-liivakast`, oota avalehte.
2. **Manage Jenkins → Plugins → Updates**: vali üks plugin, mis oli sandboxi paigaldamisel uuendatavate nimekirjas, ja vaata enne uuendamist selle lehelt *Release notes*.
3. Uuenda ja vajuta *Restart Jenkins when installation is complete and no jobs are running*.
4. Käivita `ehitus` ja kirjuta `plugins.txt` uuesti sama `curl … | jq` käsuga, millega selle tegid.

    ```bash
    git diff k06-jenkins/casc/plugins.txt
    ```

`git diff` näitab täpselt, mis muutus: üks rida või mitu, kui uuendus tõi kaasa sõltuvusi. See diff on sinu muudatuse kirje ja kui midagi läheb hiljem katki, tead, mida rollback'iga tagasi võtta. Roheline `ehitus` tõestab, et vähemalt see job uuendust talub.

**Edasi saad minna, kui** `ehitus` on pärast uuendust roheline ja `git diff` näitab ühe (või mõne sõltuva) plugina versiooni muutust.

## Taasta varukoopia teise konteinerisse

Taastad varukoopia uude volume'isse ja käivitad kõrvale teise Jenkinsi. Originaal jääb puutumata, nii et saad võrrelda ja vajadusel uuesti proovida. Mõõda ka aega: suure `jobs/` kaustaga Jenkinsil võtab lahtipakkimine ja esimene käivitus kauem kui sandboxil.

1. Peata sandbox, et RAM jaguks, ja paki arhiiv uude volume'isse lahti.

    ```bash
    docker stop jenkins-liivakast
    docker volume create jenkins-taaste
    docker run --rm -v jenkins-taaste:/data -v "$HOME":/backup ubuntu:24.04 \
        tar xzf /backup/jenkins-liivakast.tgz -C /data
    ```

2. Käivita taastatud Jenkins pordil 8091.

    ```bash
    docker run -d --name jenkins-taaste --memory 1536m -p 8091:8080 \
        -v jenkins-taaste:/var/jenkins_home jenkins/jenkins:lts-jdk21
    ```

3. Logi `http://<control node'i IP>:8091` sisse sama admin-kasutajaga. Kontrolli: süsteemiteade, job `ehitus` koos ajalooga, `vaatleja` õigused.
4. Käivita `ehitus` ja vaata logist rida `credential loetav`.
5. Vaata **Manage Jenkins → Plugins → Installed** selle plugina versiooni, mille enne uuendasid.

Rida `credential loetav` tõendab, et `master.key` ja krüpteeritud credential'id tulid kaasa ning sobivad kokku. Plugin on taastatud Jenkinsis vana versiooniga, sest varukoopia tehti enne uuendust.

**Edasi saad minna, kui** taastatud Jenkinsis on jobid, ajalugu ja õigused alles, `ehitus` logis on `credential loetav` ja PR-i kirjelduses on kirjas, kumb plugina versioon taastatud Jenkinsis on ja miks.

## Taasta ilma võtmeta

Nüüd teed sama taaste, aga jätad välja ühe faili: `secrets/master.key`. Nii näed, mis juhtub, kui keegi varundab "ainult konfiguratsiooni" või kui võti on varundusest turvakaalutlustel välja jäetud ja teist koopiat pole.

Ilma võtmeta varukoopiast käivitub Jenkins ja näeb esmapilgul korras välja. Viga ilmneb alles siis, kui mõni job vajab credential'it.

**Ennusta:** kas taastatud Jenkins saab credential'it lugeda, kui `secrets/master.key` puudub?

1. Peata eelmine taaste ja taasta kolmandasse volume'isse ilma võtmeta.

    ```bash
    docker stop jenkins-taaste
    docker volume create jenkins-ilmavotmeta
    docker run --rm -v jenkins-ilmavotmeta:/data -v "$HOME":/backup ubuntu:24.04 \
        tar xzf /backup/jenkins-liivakast.tgz -C /data --exclude=./secrets/master.key
    docker run -d --name jenkins-ilmavotmeta --memory 1536m -p 8092:8080 \
        -v jenkins-ilmavotmeta:/var/jenkins_home jenkins/jenkins:lts-jdk21
    ```

2. Logi `http://<control node'i IP>:8092` sisse sama admin-kasutajaga ja käivita `ehitus`.
3. Vaata buildi logi, Jenkinsi logi ja võrdle võtmeid.

    ```bash
    docker logs jenkins-ilmavotmeta 2>&1 | grep -iE 'master.key|decrypt|secret' | head -5
    tar xzf ~/jenkins-liivakast.tgz -O ./secrets/master.key | sha1sum
    docker exec jenkins-ilmavotmeta sha1sum /var/jenkins_home/secrets/master.key
    ```

Sisselogimine töötas, sest kasutajate paroolid on räsina `users/` all ja ei vaja `master.key`-d. Credential'i väärtus aga ei dekrüpteeru ja `ehitus` ei jõua reani `credential loetav`. `master.key` on kaustas olemas, aga räsi erineb arhiivi omast: Jenkins lõi käivitusel uue võtme, mis vanu saladusi ei ava. Järeldus: varukoopia ilma `secrets/`-ita taastab jobid, aga mitte ühtegi credential'it.

**Edasi saad minna, kui** `ehitus` logis pole rida `credential loetav`, kaks `master.key` räsi erinevad ja PR-i kirjelduses on lause selle kohta, mida taaste ilma võtmeta tootmises tähendaks.

## Koristus

Sandboxid ja arhiiv olid ajutised. Arhiivis on krüptovõti ja credential'id, nii et selle kustutamine on samuti turvasamm.

1. Kustuta kõik kolm konteinerit, volume'id ja arhiiv.

    ```bash
    docker rm -f jenkins-liivakast jenkins-taaste jenkins-ilmavotmeta
    docker volume rm jenkins-liivakast jenkins-taaste jenkins-ilmavotmeta
    rm ~/jenkins-liivakast.tgz
    git commit -am "k06: plugins.txt pärast uuendust" && git push
    git status --short
    ```

Sandboxide kustutamine vabastab umbes gigabaidi, mida Maven ja Sonar intsidendiülesandes vajavad.

**Edasi saad minna, kui** `docker ps -a` ja `docker volume ls` ei näita sandboxi, arhiivi pole ja `git status` ei näita ühtki `.tgz` faili.

**Selle mooduli tõend:** PR-i kirjelduses naabri folderi 403 ekraanipilt, `vaatleja` vaate ekraanipilt, `du` ja `ls -l` väljund enne ja pärast `chmod`-i, `plugins.txt` `git diff`, taastatud Jenkinsi `credential loetav` logirida, lause plugina versiooni kohta ja võtmeta taaste tulemus; commit uuendatud `plugins.txt`-iga.

## Miks see nii töötab

**Role-based ja Matrix.** Klassis kasutatakse Role-based strategy't, sest rolle on vähe ja inimesi palju: üks muster katab folderi ja kõik selle sisu. Matrix-strateegia sobib väikesele Jenkinsile, kus inimesi on vähe ja igaühe õigused erinevad.

**Varukoopia.** Kaustu `workspace/`, `tools/` ja `caches/` ei ole vaja varundada, need luuakse uuesti.

**Taastamine.** Taastatud Jenkins sisaldab kõike, ka pluginate versioone.

**`master.key`.** `master.key` krüpteerib faili `secrets/hudson.util.Secret`, mis omakorda krüpteerib credential'id. Mõned organisatsioonid hoiavad võtit varukoopiast eraldi, kuid siis tuleb harjutada ka võtme taastamist.

Lisaülesanne [Lisaprojekt: sandboxi varundusskript](lisa.md#lisaprojekt-sandboxi-varundusskript): kirjutad sandboxi varundusskripti kontrolli ja rotatsiooniga.
