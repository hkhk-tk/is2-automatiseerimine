---
tags:
  - Jenkins
  - SonarQube
  - Nexus
  - CI/CD
---

# Lisaülesanded: Jenkins, SonarQube ja Nexus

Ülesanded jätkavad IS1 praktikumi [Jenkins, SonarQube ja Nexus](https://hkhk-tk.github.io/is1-automatiseerimine/k06/lab/) pipeline'i ja eeldavad selle osi, mis on ülesande juures kirjas.

| Ülesanne | Tase | Tulemus |
|---|---|---|
| [1. Freestyle: arhiveeritud artefakt ja workspace](#1-freestyle-arhiveeritud-artefakt-ja-workspace) | lihtne | workspace tühi, artefakt buildi juures alles |
| [2. Ajastatud ja upstream trigger](#2-ajastatud-ja-upstream-trigger) | lihtne | öine ajastus ja upstream-ahel töötavad |
| [3. Avatud õigused sandboxis](#3-avatud-oigused-sandboxis) | lihtne | tõestatud, mida `vaatleja` avatud sättega saab |
| [4. Jenkinsfile'i kontroll enne push'i](#4-jenkinsfilei-kontroll-enne-pushi) | keskmine | `pre-push`-hook peatab vigase Jenkinsfile'i |
| [5. Actions käivitab Jenkinsi](#5-actions-kaivitab-jenkinsi) | keskmine | push käivitab Jenkinsi buildi sekunditega |
| [6. `mvn deploy` ilma pluginata](#6-mvn-deploy-ilma-pluginata) | keskmine | WAR Nexuses Maveni enda vahenditega |
| [7. Paralleelsed testid ja jagatud workspace](#7-paralleelsed-testid-ja-jagatud-workspace) | keskmine | paralleelsed harud ei kirjuta samu faile |
| [8. Kinnitus ilma executorita](#8-kinnitus-ilma-executorita) | keskmine | kinnituse ootamise ajal on executorid vabad |
| [9. Multibranch ja `when { branch }`](#9-multibranch-ja-when-branch) | keskmine | multibranch-job, `when { branch }` töötab |
| [10. Parameeter ja muutujad sandboxis](#10-parameeter-ja-muutujad-sandboxis) | keskmine | parameetriga build, käsusüst tõrjutud |
| [11. Sandboxis rollipõhised õigused](#11-sandboxis-rollipohised-oigused) | keskmine | rollipõhised õigused JCasC failis |
| [12. Sama pipeline Actionsis](#12-sama-pipeline-actionsis) | keskmine | importeri workflow ja erinevuste loetelu |
| [Lisaprojekt: sandboxi varundusskript](#lisaprojekt-sandboxi-varundusskript) | keskmine | varundusskript kontrolli ja rotatsiooniga |
| [13. Saladuste rotatsioon ilma punase buildita](#13-saladuste-rotatsioon-ilma-punase-buildita) | raske | tokenid vahetatud, vana tõestatult kehtetu |
| [14. WAR Nexusest app01-le koos rollback'iga](#14-war-nexusest-app01-le-koos-rollbackiga) | raske | app01 deploy Nexusest automaatse rollback'iga |
| [15. Agendi olek monitooringusse](#15-agendi-olek-monitooringusse) | raske | agendi nelja olekuga kontroll timer'iga |
| [16. Neli silma ja muudatuse kirje](#16-neli-silma-ja-muudatuse-kirje) | raske | kinnitaja ei ole käivitaja, audit-fail püsib |
| [Lisaprojekt: shared library samm](#lisaprojekt-shared-library-samm) | raske | `labseisVersion()` tag'iga kinnitatud teegist |
| [17. vorgukogu öösel Jenkinsiga](#17-vorgukogu-oosel-jenkinsiga) | keskmine | ruuterite väljund öösel Giti, ainult muutusel |

Iga ülesanne on sinu repositooriumis eraldi issue (label `edasijõudnu`) ja failid lähevad kausta `k06-jenkins/`.

## Lisaülesanded edasijõudnule

## Lihtsad ülesanded

### 1. Freestyle: arhiveeritud artefakt ja workspace

**Tase:** lihtne · **Eeldus:** [Agent ja esimene pipeline](https://hkhk-tk.github.io/is1-automatiseerimine/k06/lab-1-agent/)

Pipeline arhiveerib WAR-i `post`-plokis sammuga `archiveArtifacts`, kuid buildi lehelt ei ole näha, mis sellest buildist alles jääb ja kus. Kontrollid seda Freestyle job'iga `kes-olen`.

- Eemalda job'i shell-sammust `sleep` ja lisa lõppu `date > aeg.txt`.
- Lisa *Post-build Actions → Archive the artifacts*, muster `*.txt`.
- Käivita job kaks korda ja vali seejärel job'i menüüst **Wipe Out Current Workspace**.
- Kirjuta issue'sse, kus `aeg.txt` nüüd füüsiliselt asub: agendil või controlleris.

**Kontroll:**

```bash
j=http://jenkins.lab.hkhk.ee:8080/job/$JENKINS_USER/job/kes-olen
printf 'user = "%s:%s"\n' "$JENKINS_USER" "$JENKINS_TOKEN" | curl -fsS -K- "$j/lastSuccessfulBuild/artifact/aeg.txt"
sudo ls /opt/jenkins/workspace/$JENKINS_USER/kes-olen
```

**Valmis, kui:**

- `curl` väljastab teise käivituse kellaaja;
- `ls` annab `No such file or directory`;
- buildi lehel jaotises *Build Artifacts* on `aeg.txt`;
- issue's on faili täpne asukoht.

Vihje: token nagu triggerite osas.

??? success "Lahendus"
    Fail on controlleris: `$JENKINS_HOME/jobs/<gh>/jobs/kes-olen/builds/<n>/archive/aeg.txt`. `archiveArtifacts` kopeerib selle buildi lõpus agendilt Remoting-kanali kaudu. **Wipe Out Current Workspace** kustutab ainult agendi kausta. Ilma artifact manager'i pluginata (näiteks S3) on iga arhiveeritud bait controlleri kettal.

    ```bash
    # job'i Execute shell
    whoami; id; pwd; df -h .; ls -la
    date > aeg.txt
    ```

    **Miks nii.** Workspace on ajutine, arhiveeritud artefakt kuulub buildile. Seepärast kasutab arhiveerimine controlleri kettaruumi ja `buildDiscarder` piirab ka artefaktide arvu. Suured artefaktid kuuluvad Nexusesse, mitte Jenkinsi arhiivi: Jenkinsi arhiiv on mõeldud väikestele raportitele ja logidele, mida tahad buildi juurest leida.

### 2. Ajastatud ja upstream trigger

**Tase:** lihtne · **Eeldus:** [süvenemise osa 2](syvenemine.md#osa-2-triggerid-piirid-ja-post)

Pollimise korral käivitab buildi ainult muudatus repositooriumis. Öine kontroll peab aga käivituma kellaaja järgi ja mõni töö alles pärast teist job'i.

- Folderis **New Item → `oine-kontroll` → Pipeline**, *Definition: Pipeline script* (mitte SCM), sisu allpool. Käivita job üks kord käsitsi ja oota ilma ühegi commit'ita.
- Muuda ajastus nii, et kontroll käivitub tööpäeviti kell 2 Tallinna aja järgi ja öised job'id jagunevad tunni esimesele poolele. Käivita job üks kord, et Jenkins loeks uue ajastuse.
- **New Item → `parast-labori-seis` → Freestyle project**, label `<gh>`, *Build Triggers → Build after other projects are built*: `labori-seis`, *Trigger only if build is stable*, Execute shell `echo "labori-seis valmis, käivitan järeltöö"`.
- Käivita `labori-seis`. Seejärel muuda see ajutiselt ebaõnnestuvaks (näiteks vale tööriista nimega), käivita uuesti ja taasta.

```groovy
pipeline {
    agent { label "${env.JOB_NAME.split('/')[0]}" }
    triggers { cron('H/3 * * * *') }
    stages { stage('Kontroll') { steps { sh 'date; df -h /opt/jenkins | tail -1' } } }
}
```

**Kontroll:**

```bash
j=http://jenkins.lab.hkhk.ee:8080/job/$JENKINS_USER/job/parast-labori-seis
printf 'user = "%s:%s"\n' "$JENKINS_USER" "$JENKINS_TOKEN" | curl -gfsS -K- \
    "$j/lastBuild/api/json?tree=number,actions[causes[_class]]" \
    | jq -c '[.number, [.actions[].causes? // empty | .[]._class]]'
```

**Valmis, kui:**

- `oine-kontroll` ajaloos on ilma commit'ita tekkinud build tekstiga „Started by timer“;
- pärast rohelist `labori-seis`-i on väljund `[<n>,["hudson.model.Cause$UpstreamCause"]]`;
- pärast punast `labori-seis`-i on number sama;
- job'i `oine-kontroll` seadistuses näitab Jenkins ajastuse all järgmist käivitusaega tööpäeva öösel kella 2 ja 2:29 vahel.

??? success "Lahendus"
    Öine kontroll Tallinna aja järgi tööpäeviti 2:00–2:29. `TZ` on ajastuse esimene rida, seepärast on string mitmerealine.

    ```groovy
    pipeline {
        agent { label "${env.JOB_NAME.split('/')[0]}" }
        triggers {
            cron('''TZ=Europe/Tallinn
    H(0-29) 2 * * 1-5''')
        }
        stages { stage('Kontroll') { steps { sh 'date; df -h /opt/jenkins | tail -1' } } }
    }
    ```

    Sama upstream-seos Pipeline job'is: `triggers { upstream(upstreamProjects: 'labori-seis', threshold: hudson.model.Result.SUCCESS) }`. Nimi on suhteline sama folderi suhtes.

    **Miks nii.** `cron` käivitab buildi kellaaja järgi, `pollSCM` ainult muudatuse korral, ja upstream-seos ühendab job'id ahelaks nii, et ülemine job ei pea alumisest teadma. `H 2 * * 1-5` valib minuti job'i nime järgi, kuid tunni määrad sina. Kui kõik öised job'id on kell 2, algavad need ikkagi samal tunnil. Vahemik `H(0-29) 2 * * 1-5` jagab need tunni esimesele poolele ja jätab teise poole varunduseks. Kui ajastuse ees ei ole rida `TZ=Europe/Tallinn`, kasutatakse controlleri ajavööndit, mitte sinu masina oma. Kontrolli seda, kui ajastus tundub tunni võrra nihkes olevat.

    Järeltöö jäi ebaõnnestunud buildi järel käivitamata, sest tingimus oli „stable“. Upstream-seos on mugav, kuid peidab sõltuvuse: `labori-seis` lehelt ei ole näha, et mõni teine job sellest sõltub. Suuremas süsteemis on selgem kutsuda järgmist job'i sammuga `build job: '…'` otse Jenkinsfile'ist, kus seos on koodis kirjas.

### 3. Avatud õigused sandboxis

**Tase:** lihtne · **Eeldus:** [Õigused, varundus ja taaste](lab-6-haldus.md), enne koristust

Paljud kiirpaigalduse juhendid valivad *Logged-in users can do anything*, sest sellega hakkab kõik kohe tööle. Kontrollid sandboxis, mida see säte kasutajale `vaatleja` annab.

- Vali sandboxis ajutiselt *Logged-in users can do anything* ja värskenda kasutaja `vaatleja` akent.
- Kontrolli allolevate käskudega, kas `vaatleja` jõuab lehtedele Manage Jenkins ja Script Console.
- Kirjuta issue'sse, mida `vaatleja` saab Script Console'i kaudu credential'itega teha.
- Taasta maatriks ja korda kontrolli.

**Kontroll:**

```bash
docker exec jenkins-liivakast grep -o 'authorizationStrategy class="[^"]*"' /var/jenkins_home/config.xml
read -rs P    # vaatleja parool
for u in manage/ script; do
    printf 'user = "vaatleja:%s"\n' "$P" | curl -sS -K- -o /dev/null -w "$u %{http_code}\n" "http://localhost:8090/$u"
done
```

**Valmis, kui:**

- avatud sättega on klass `FullControlOnceLoggedInAuthorizationStrategy`, `manage/ 200` ja `script 200`;
- pärast maatriksi taastamist on klass `ProjectMatrixAuthorizationStrategy`, `manage/ 403` ja `script 403`;
- issue's on vastus Script Console'i kohta.

??? success "Lahendus"
    Säte salvestub `config.xml`-i klassina `FullControlOnceLoggedInAuthorizationStrategy`. Sandboxi `jenkins.yaml` ei sisalda `authorizationStrategy`-t, nii et JCasC reload seda tagasi ei muuda. Muudatus jääb alles, kuni keegi selle käsitsi taastab. JCasC-s on sama säte `jenkins.authorizationStrategy.loggedInUsersCanDoAnything.allowAnonymousRead: false`.

    **Miks nii.** See valik annab igale sisselogitud kasutajale administraatori õigused: `vaatleja` saab job'i seadistada ja avada lehe Manage Jenkins. Kui kasutajate registreerimine on avatud, saab administraatoriks ka iga võõras. Jenkinsi administraator saab käivitada controlleris Groovy skripte (*Script Console*) ja lugeda sealt kõiki credential'e lahtisel kujul. Seetõttu tähendab säte „kõik sisselogitud kasutajad on administraatorid“ sisuliselt, et kõik sisselogitud kasutajad näevad kõiki paroole.

## Keskmised ülesanded

### 4. Jenkinsfile'i kontroll enne push'i

**Tase:** keskmine · **Eeldus:** [Agent ja esimene pipeline](https://hkhk-tk.github.io/is1-automatiseerimine/k06/lab-1-agent/) · **Esita:** `k06-jenkins/validate-jenkinsfile.sh`

Põhiülesannetes said süntaksiveast teada alles pärast push'i, kui build ebaõnnestus esimesel real. Iga selline katse jääb commit'ide ajalukku ja buildide järjekorda. Jenkinsil on API, mis kontrollib deklaratiivse faili süntaksit ilma buildi käivitamata.

- Skript saadab faili `POST`-päringuga aadressile `$JENKINS_URL/pipeline-model-converter/validate` (vorm `-F "jenkinsfile=<fail"`).
- Token läheb `curl`-ile standardsisendist (`-K-`), nagu skriptis `trigger-jenkins.sh` ja faili `plugins.txt` koostamisel.
- Väljumiskood on 0 ainult siis, kui vastuses on `successfully validated`.
- Giti `pre-push`-hook (`.git/hooks/pre-push`) kontrollib faili ainult siis, kui see muutus.
- Kirjuta issue'sse, milliseid vigu see kontroll ei näe.

**Kontroll:**

```bash
chmod +x .git/hooks/pre-push; shellcheck -S warning k06-jenkins/validate-jenkinsfile.sh .git/hooks/pre-push
k06-jenkins/validate-jenkinsfile.sh; echo "kood $?"
sed 's/stages {/stagess {/' k06-jenkins/Jenkinsfile > /tmp/vigane && k06-jenkins/validate-jenkinsfile.sh /tmp/vigane; echo "kood $?"
git switch -c proov-hook && sed -i 's/stages {/stagess {/' k06-jenkins/Jenkinsfile && git commit -qam proov && git push -u origin proov-hook
git switch k06-jenkins && git branch -D proov-hook
```

**Valmis, kui:**

- `shellcheck` ei väljasta midagi;
- õige fail annab `Jenkinsfile successfully validated.` ja koodi 0;
- vigane fail annab reanumbriga veateate ja koodi 1;
- push katkeb reaga `pre-push: ... push katkestatud` ja GitHubis haru `proov-hook` ei teki.

??? success "Lahendus"
    Skript kontrollib faili, hook kontrollib seda versiooni, mis push'itakse (`git show <sha>:<fail>`), mitte töökausta. Nii ei pääse läbi commit'imata parandus ega commit'itud viga. Uue haru puhul võrreldakse `origin/main`-iga.

    ```bash
    #!/usr/bin/env bash
    # k06-jenkins/validate-jenkinsfile.sh [fail]   (JENKINS_USER, JENKINS_TOKEN keskkonnast)
    set -euo pipefail
    file="${1:-k06-jenkins/Jenkinsfile}"
    url="${JENKINS_URL:-http://jenkins.lab.hkhk.ee:8080}"
    url="${url%/}"
    : "${JENKINS_USER:?JENKINS_USER puudub}"
    : "${JENKINS_TOKEN:?JENKINS_TOKEN puudub}"
    [[ -f "$file" ]] || { echo "FAIL: $file puudub" >&2; exit 1; }
    out=$(printf 'user = "%s:%s"\n' "$JENKINS_USER" "$JENKINS_TOKEN" \
        | curl -sS -K- -X POST -F "jenkinsfile=<$file" "$url/pipeline-model-converter/validate") \
        || { echo "FAIL: Jenkins ei vastanud ($url)" >&2; exit 1; }
    echo "$out"
    grep -q 'successfully validated' <<< "$out"
    ```

    ```bash
    #!/usr/bin/env bash
    # .git/hooks/pre-push
    set -euo pipefail
    f=k06-jenkins/Jenkinsfile
    z=0000000000000000000000000000000000000000
    while read -r _ lsha _ rsha; do
        [[ "$lsha" == "$z" ]] && continue                                   # haru kustutamine
        base="$rsha"
        [[ "$rsha" == "$z" ]] && base=$(git merge-base origin/main "$lsha")  # uus haru
        git diff --quiet "$base" "$lsha" -- "$f" && continue
        tmp=$(mktemp)
        git show "$lsha:$f" > "$tmp"
        if ! k06-jenkins/validate-jenkinsfile.sh "$tmp"; then
            rm -f "$tmp"
            echo "pre-push: $f ei läbinud kontrolli (${lsha:0:7}), push katkestatud" >&2
            exit 1
        fi
        rm -f "$tmp"
    done
    ```

    **Miks nii.** Kontroll toimub controlleris sama parseriga, mida kasutab build, nii et süntaksi tulemus on täpne. Vale tööriista nime või puuduvat credential'it see ei näe: need avastab ikkagi alles build. `pre-push`-hook on ainult sinu masinas: see ei ole Gitis ja teised meeskonnaliikmed seda ei saa, ning `git push --no-verify` läheb hook'ist mööda. Meeskonnas lisatakse sama kontroll seetõttu ka PR-i CI-sse.

### 5. Actions käivitab Jenkinsi

**Tase:** keskmine · **Eeldus:** [süvenemise osa 2](syvenemine.md#osa-2-triggerid-piirid-ja-post) · **Esita:** `.github/workflows/jenkins.yml`

`pollSCM` tähendab laboris määratud ajastusega kuni kaheminutilist viivitust ja pidevaid päringuid GitHubi. Build peab algama kohe pärast push'i, mitte järgmise pollimise ajal.

- Workflow `on: push`, `runs-on: [self-hosted, linux, labseis]` (GitHub Actionsi kohtumise runner).
- Samm `k06-jenkins/trigger-jenkins.sh --wait`, API token tuleb secret'ist `JENKINS_TOKEN`.
- `pollSCM` jääb alles pikema intervalliga: `pollSCM('H * * * *')`. Pollimine on varuks juhuks, kui runner on maas, ja automaatse hindaja `triggers` kontroll vajab plokki `triggers`.
- Kirjuta issue'sse, mis muutus kiiruse ja mis töökindluse osas, ning kas etapp `Deploy` käivitub Actionsi käivitatud buildis, miks (`triggeredBy`) ja kas see on soovitud.

**Kontroll:**

```bash
gh run list --workflow jenkins.yml -L 1
bash autograde/check.sh k06 triggers
```

**Valmis, kui:**

- `gh run list` näitab `completed success`;
- Jenkinsi buildi leht näitab "Started by user `<gh>`" sama minuti sees, kui push tehti;
- `triggers` kontroll annab `OK`;
- issue's on vastused kiiruse, töökindluse ja `Deploy` kohta.

??? success "Lahendus"
    Workflow `.github/workflows/jenkins.yml`. Tokenil pole repositooriumi õigusi vaja (`permissions: {}`), runner'il on VPN. `concurrency` ilma katkestuseta: Jenkinsis on `disableConcurrentBuilds` niikuinii.

    ```yaml
    name: jenkins
    on:
      push:
        branches: [k06-jenkins, main]
        paths: ['k06-jenkins/**', 'src/**', 'pom.xml']
    permissions: {}
    concurrency:
      group: jenkins-${{ github.ref }}
      cancel-in-progress: false
    jobs:
      jenkins:
        runs-on: [self-hosted, linux, labseis]
        timeout-minutes: 30
        permissions:
          contents: read
        steps:
          - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09  # v5.1.0
          - name: Jenkinsi build
            env:
              JENKINS_USER: ${{ vars.JENKINS_USER }}
              JENKINS_TOKEN: ${{ secrets.JENKINS_TOKEN }}
            run: k06-jenkins/trigger-jenkins.sh --wait
    ```

    Vastused:

    - Kiirus: build algab sekunditega.
    - Töökindlus: uus sõltuvus on runner'i ja VPN-i olek. Pikk pollimine on varuks.
    - `Deploy`: põhjus on `UserIdCause`, nii et `Deploy` jääb `input`-i taha ootama. Kümne minuti pärast on build ABORTED ja workflow punane. See ei ole soovitud.
    - Parandus: automaatikal on oma Jenkinsi kasutaja ja `Deploy` tingimus on `triggeredBy cause: 'UserIdCause', detail: '<gh>'`.
    - Job ehitab oma *Branch Specifier*'i haru, mitte tingimata push'itud commit'i: väga kiire teine push võib anda ühe buildi kahe commit'i peale.

    **Miks nii.** API tokeniga käivitatud build on Jenkinsi jaoks kasutaja käivitatud build, sest token kuulub kasutajale. Käivitusviisi muutus muudab tingimuse `triggeredBy` tähendust, ilma et Jenkinsfile'is midagi muutuks.

### 6. `mvn deploy` ilma pluginata

**Tase:** keskmine · **Eeldus:** [Quality gate ja Nexus](https://hkhk-tk.github.io/is1-automatiseerimine/k06/lab-3-sonar-nexus/) · **Esita:** `k06-jenkins/Jenkinsfile`

`nexusArtifactUploader` on Jenkinsi plugin ja töötab ainult Jenkinsis. Kui pipeline viiakse teise CI-süsteemi, peab WAR jõudma Nexusesse Maveni enda vahenditega.

- Etapis `Nexus` ei ole enam `nexusArtifactUploader`-it. Automaatse hindaja `nexus` kontroll leiab üleslaadimise URL-ist `/repository/`.
- Parool tuleb `withCredentials([usernamePassword(credentialsId: 'nexus', ...)])` kaudu ajutisse settings-faili `<server>`-plokiga.
- Proovi `mvn deploy -DskipTests -DaltDeploymentRepository=nexus::http://nexus.lab.hkhk.ee:8081/repository/labori-seis/`. Pom-faili ei muuda.
- Lõplik üleslaadimine käib `mvn deploy:deploy-file`-iga, groupId ja versiooni annad ise.
- Kirjuta issue'sse, miks `mvn deploy` ebaõnnestub, kui pom-is on groupId `ee.hkhk`, mitte `ee.hkhk.<gh>`.

**Kontroll:**

```bash
bash autograde/check.sh k06 nexus
bash autograde/check.sh k06 secrets
```

**Valmis, kui:**

- logis on `Uploaded to nexus: http://nexus.lab.hkhk.ee:8081/repository/labori-seis/ee/hkhk/<gh>/labori-seis/<versioon>/labori-seis-<versioon>.war`;
- `nexus` ja `secrets` annavad `OK`;
- Nexuse `.sha1` on sama mis Jenkinsi arhiveeritud WAR-il;
- issue's on `mvn deploy` ebaõnnestumise põhjus.

??? success "Lahendus"
    Settings-failis pole parooli: Maven asendab `${env.NU}` ja `${env.NP}` käivitamisel. Fail on `WORKSPACE_TMP`-is, mitte workspace'is, nii et `archiveArtifacts` ega `git add` seda kaasa ei võta. `mvn deploy` laeb `ee/hkhk/labori-seis/1.1.0/` alla ja saab `403`, sest sinu õigus on ainult teel `ee/hkhk/<gh>/`. Teisel katsel tuleks `400`, sest pom-i versioon ei muutu. `deploy:deploy-file` võtab koordinaadid käsurealt.

    ```groovy
    stage('Nexus') {
        steps {
            withCredentials([usernamePassword(credentialsId: 'nexus', usernameVariable: 'NU', passwordVariable: 'NP')]) {
                sh '''
                    cat > "$WORKSPACE_TMP/nexus-settings.xml" <<'EOF'
    <settings>
      <servers>
        <server><id>nexus</id><username>${env.NU}</username><password>${env.NP}</password></server>
      </servers>
      <mirrors>
        <mirror><id>kooli-nexus</id><url>http://nexus.lab.hkhk.ee:8081/repository/maven-public/</url><mirrorOf>*</mirrorOf></mirror>
      </mirrors>
    </settings>
    EOF
                    mvn -B -s "$WORKSPACE_TMP/nexus-settings.xml" deploy:deploy-file \
                        -Dfile=target/labori-seis.war -Dpackaging=war \
                        -DgroupId="$NEXUS_GROUP" -DartifactId=labori-seis -Dversion="$ART_VERSION" \
                        -DrepositoryId=nexus -Durl="http://$NEXUS_HOST/repository/$NEXUS_REPO/"
                '''
            }
        }
    }
    ```

    **Miks nii.** `mvn deploy` loeb groupId pom-failist, plugin aga Jenkinsfile'ist. Nexuse õigused on seotud teega, nii et sama fail sama parooliga võib ühe tööriistaga õnnestuda ja teisega anda vastuse `403`.

### 7. Paralleelsed testid ja jagatud workspace

**Tase:** keskmine · **Eeldus:** [süvenemise osa 4](syvenemine.md#osa-4-image-paralleel-ja-deploy) · **Esita:** `k06-jenkins/Jenkinsfile`

Põhiülesannetes käivitusid paralleelselt ainult etapid, mis loevad valmis WAR-i. Test ja Checkstyle samas workspace'is paralleelselt annavad buildist buildi eri tulemuse.

- Mõõda vaates Pipeline Graph View buildi kestus.
- Pane Checkstyle ja Test `parallel {}`-plokki, käivita mitu korda ja võrdle `target/checkstyle-result.xml`-i ja katvust Sonaris.
- Paranda nii, et harud ei jaga kausta `target/` faile: Checkstyle'i väljund eraldi faili (`-Dcheckstyle.output.file=…`) või harud eri workspace'idesse (`ws()`) koos sammudega `stash`/`unstash`.
- Kirjuta issue'sse kestus enne ja pärast ning mis jääb jagatud ressursiks.

**Kontroll:** käivita kolm buildi järjest, seejärel

```bash
bash autograde/check.sh k06 stages
```

**Valmis, kui:**

- Checkstyle'i haru viimane rida (leidude arv) on kõigis kolmes buildis sama;
- Test-raporti testide arv on kõigis kolmes sama;
- `stages` annab `OK`;
- issue's on kestused ja jagatud ressursid.

??? success "Lahendus"
    `verify` käivitab pom-is seotud `checkstyle:check`-i, mis kirjutab samuti faili `target/checkstyle-result.xml` ja vahemälu `target/checkstyle-cachefile`. Kaks haru kirjutavad sama faili ja Sonar loeb seda, mis jäi viimasena. Eraldi väljundfail ja vahemälu teevad harud sõltumatuks. Jagatuks jäävad workspace, `target/classes` (Test kompileerib, Checkstyle loeb ainult lähtekoodi) ja `~/.m2`.

    ```groovy
    stage('Kontrollid') {
        parallel {
            stage('Test') {
                steps { sh '$MVN verify -Dcheckstyle.failOnViolation=false' }
                post { always { junit allowEmptyResults: true, testResults: 'target/surefire-reports/*.xml' } }
            }
            stage('Checkstyle') {
                steps {
                    sh '''
                        $MVN checkstyle:checkstyle -Dcheckstyle.output.file=target/checkstyle-jenkins.xml \
                            -Dcheckstyle.cache.file=target/checkstyle-cache-jenkins
                        grep -c '<error' target/checkstyle-jenkins.xml || true
                    '''
                }
            }
        }
    }
    ```

    Etapis SonarQube: `-Dsonar.java.checkstyle.reportPaths=target/checkstyle-jenkins.xml`.

    **Miks nii.** Ajavõit on tavaliselt alla 20 %, sest Maven ja Checkstyle kasutavad sama protsessorit ja ketast ning parallel-harud töötavad ühe executori peal. Agendi 4 GB mälu peab mahutama kaks JVM-i korraga. Maven 3.9 ei lukusta kohalikku hoidlat vaikimisi. Kahe samaaegse allalaadimise korral võib `~/.m2`-sse jääda poolik fail, kui pole seatud `-Daether.syncContext.named.factory=file-lock`.

### 8. Kinnitus ilma executorita

**Tase:** keskmine · **Eeldus:** [süvenemise osa 4](syvenemine.md#osa-4-image-paralleel-ja-deploy) · **Esita:** `k06-jenkins/Jenkinsfile.agentnone`

Põhiülesannetes hoiab kinnitust ootav build executorit kinni ja agendil on executoreid ainult kaks. Kaks ootavat buildi peatavad kogu agendi.

- Tee Jenkinsfile'ist koopia `k06-jenkins/Jenkinsfile.agentnone` (põhifail jääb samaks): ülaosas `agent none`, ehitavatel etappidel `agent { label "${GH}" }`.
- Etapil `Deploy` on `input` ilma agendita, paigaldus on eraldi etapis agendiga.
- Loo sellest ajutine job (Copy from `labori-seis`, *Script Path* koopia järgi).
- Käivita job, jäta kinnitus ootama ja vaata vaadet Build Executor Status.
- Kirjuta issue'sse, mis juhtub workspace'iga etappide vahel (`stash`/`unstash` või sama label ja sama workspace).

**Kontroll:** ajal, kui build ootab nuppu **Paigalda**:

```bash
printf 'user = "%s:%s"\n' "$JENKINS_USER" "$JENKINS_TOKEN" | curl -fsS -K- \
    "http://jenkins.lab.hkhk.ee:8080/computer/$JENKINS_USER/api/json?tree=idle" ; echo
```

**Valmis, kui:**

- väljund on `{"_class":"hudson.slaves.SlaveComputer","idle":true}`;
- Build Executor Status näitab agendi mõlemat executorit vabana;
- pärast kinnitust töötab Deploy agendil ja build on roheline;
- issue's on vastus workspace'i kohta.

??? success "Lahendus"
    Ehitavad etapid on ühe välise etapi all, millel on agent ja tööriistad. Ülemine `post` töötab ilma node'ita, seepärast liiguvad `archiveArtifacts` ja `cleanWs()` agendiga etapi `post`-i. Ilma selleta annab `cleanWs()` vea `Required context class hudson.FilePath is missing`. Deploy ei vaja workspace'i faile, ainult image'it agendi Dockeris ja `ART_VERSION`-it. Seepärast pole `stash`-i vaja.

    ```groovy
    def GH = env.JOB_NAME.split('/')[0].toLowerCase()
    pipeline {
        agent none
        environment { /* sama mis põhifailis */ }
        options { /* sama mis põhifailis */ }
        stages {
            stage('Ehitus') {
                agent { label "${GH}" }
                tools {
                    maven 'maven3'
                    jdk 'jdk21'
                }
                stages { /* Build, Test, Checkstyle, SonarQube, Quality Gate, Avaldamine põhifailist */ }
                post {
                    success { archiveArtifacts artifacts: 'target/labori-seis.war', fingerprint: true }
                    cleanup { cleanWs() }
                }
            }
            stage('Kinnitus') {
                when {
                    beforeInput true
                    expression { env.GIT_BRANCH ==~ /(origin\/)?(main|k06-jenkins)/ }
                    triggeredBy 'UserIdCause'
                }
                options { timeout(time: 10, unit: 'MINUTES') }
                input {
                    message 'Paigaldan selle versiooni testkeskkonda (agent, port 8085)?'
                    ok 'Paigalda'
                }
                steps { echo "Kinnitatud: ${env.ART_VERSION}" }
            }
            stage('Deploy') {
                agent { label "${GH}" }
                when {
                    expression { env.GIT_BRANCH ==~ /(origin\/)?(main|k06-jenkins)/ }
                    triggeredBy 'UserIdCause'
                }
                steps { sh '''/* sama docker rm, docker run ja /version kontroll mis põhifailis */''' }
            }
        }
    }
    ```

    Pärast kinnitust töötab Deploy samas node'is. Workspace on sama tee, kui samal ajal ei tööta teist buildi, muidu `@2`.

    **Miks nii.** `agent none` muudab iga etapi eraldi töökohaks. See vabastab executori, kuid etapid ei jaga enam automaatselt faile: mida rohkem etappe, seda rohkem on vaja `stash`-sammu ja seda aeglasem on build. Valik sõltub sellest, kumb on sinu Jenkinsis kallim, executor või aeg.

### 9. Multibranch ja `when { branch }`

**Tase:** keskmine · **Eeldus:** [süvenemise osa 4](syvenemine.md#osa-4-image-paralleel-ja-deploy)

Proovi-haru jaoks lõid põhiülesannetes käsitsi eraldi job'i. Jenkinsfile'iga repositooriumi jaoks on tööl tavaliselt multibranch-job: Jenkins leiab ise iga haru ja PR-i, milles on Jenkinsfile.

- Folderis **New Item → `labori-seis-mb` → Multibranch Pipeline**: Git, sinu repositoorium, credential `github`, *Build Configuration → Script Path* `k06-jenkins/Jenkinsfile`.
- Vaata, millised harud Jenkins leidis ja miks teised välja jäid.
- Asenda koopias `expression { env.GIT_BRANCH ==~ … }` tingimusega `branch pattern: 'main|k06-jenkins', comparator: 'REGEXP'` ja vaata, kas etapp `Avaldamine` käivitub.
- Kirjuta issue'sse, miks tingimus `branch` töötab multibranch-job'is, kuid mitte põhiülesannete job'is, ja mida see tähendab Sonari projekti ja Nexuse versioonide jaoks.
- Kustuta job pärast proovi: kaks samast harust ehitavat job'i avaldaksid samad versioonid.

**Kontroll:**

```bash
printf 'user = "%s:%s"\n' "$JENKINS_USER" "$JENKINS_TOKEN" | curl -gfsS -K- \
    "http://jenkins.lab.hkhk.ee:8080/job/$JENKINS_USER/job/labori-seis-mb/api/json?tree=jobs[name,color]" | jq -c '.jobs'
```

**Valmis, kui:**

- väljundis on ainult Jenkinsfile'iga harud (`k06-jenkins`, pärast merge'i ka `main`);
- harul `k06-jenkins` on etapp `Avaldamine` roheline, mitte hall;
- issue's on vastused `branch`-i, Sonari ja Nexuse kohta;
- pärast koristust annab sama käsk `404`.

??? success "Lahendus"
    `when { branch }` võrdleb muutujat `BRANCH_NAME`, mille seab ainult multibranch-job (ilma `origin/` eesliiteta). Pipeline job'is on ainult `GIT_BRANCH=origin/k06-jenkins`, `BRANCH_NAME` puudub ja tingimus on alati väär. Jenkins leiab ainult harud, kus on fail `k06-jenkins/Jenkinsfile`, teised jäävad välja teatega `Does not meet criteria`.

    ```groovy
    stage('Avaldamine') {
        when { branch pattern: 'main|k06-jenkins', comparator: 'REGEXP' }
        // parallel { ... } nagu põhifailis
    }
    ```

    Tagajärjed:

    - Sonar Community Build ei analüüsi harusid eraldi. Iga haru kirjutab sama `labori-seis-<gh>` projekti üle ja quality gate'i leht näitab viimati analüüsitud haru.
    - Nexus: pärast merge'i on sama commit `main`-is ja `k06-jenkins`-is. Kui kahe haru job'il on sama `BUILD_NUMBER`, arvutavad mõlemad sama versiooni ja teine saab `400`.

    **Miks nii.** Multibranch-job'is on igal harul oma job ja oma `BUILD_NUMBER`. Kaks haru võivad seega saada sama numbri ja versiooni teeb unikaalseks ainult commit'i räsi.

### 10. Parameeter ja muutujad sandboxis

**Tase:** keskmine · **Eeldus:** [Jenkins koodina](lab-5-jenkins-koodina.md)

Parameeter võimaldab käivitajal anda buildile väärtuse, näiteks versiooni või sihtkeskkonna. Paned faili nime kokku kolmest allikast: `BUILD_NUMBER` ja `BUILD_TIMESTAMP` tulevad Jenkinsist, `VERSIOON` käivitajalt. Parameeter on sisend, mida sa ei kontrolli.

- Ava sandbox-Jenkinsis job `ehitus` → Configure → *This project is parameterized → String Parameter* `VERSIOON`, vaikeväärtus `dev`.
- Lisa pärast Maveni sammu *Execute shell* allolevast alusest. Samm keeldub väärtusest, milles on muid märke kui `0-9 A-Z a-z . -`, ja workspace'i ei jää eelmiste buildide faile.
- Lisa *Archive the artifacts*: `versioonid/*.war`.
- Käivita **Build with Parameters** väärtustega `1.1.0`, `1.1.1`, `1.1.2; touch /tmp/sisse` ja `1.1.2`.
- Kirjuta issue'sse, miks Nexusesse saadetav versioon pannakse kokku commit'i räsist, mitte kellaajast.

```bash
mkdir -p versioonid
cp target/labori-seis.war "versioonid/labori-seis-${VERSIOON}-${BUILD_NUMBER}-${BUILD_TIMESTAMP}.war"
ls -l versioonid
```

**Kontroll:**

```bash
docker exec jenkins-liivakast ls /tmp/sisse
```

**Valmis, kui:**

- väärtusega `1.1.2; touch /tmp/sisse` lõpeb build FAILURE-ga ja logis on `VERSIOON '1.1.2; touch /tmp/sisse' ei sobi`;
- `ls /tmp/sisse` annab `No such file or directory`;
- väärtusega `1.1.2` on build roheline ja *Build Artifacts* all on üks fail;
- issue's on räsi ja kellaaja võrdlus.

??? success "Lahendus"
    Shell-samm kontrollib väärtust enne kasutamist. Freestyle käivitab sammu `/bin/sh -xe`-ga, seepärast on kontroll POSIX `case`, mitte `[[ =~ ]]`. `versioonid/` jääb workspace'i ja kasvab iga buildiga. Seepärast kustutab samm enne kopeerimist vanad failid ja alles jääb ainult arhiveeritud koopia.

    ```bash
    case "$VERSIOON" in
        ''|*[!0-9A-Za-z.-]*) echo "VERSIOON '$VERSIOON' ei sobi: lubatud 0-9 A-Z a-z . -"; exit 1 ;;
    esac
    rm -rf versioonid && mkdir versioonid
    cp target/labori-seis.war "versioonid/labori-seis-${VERSIOON}-${BUILD_NUMBER}-${BUILD_TIMESTAMP}.war"
    ls -l versioonid
    ```

    Pipeline'is on ohutu kuju ühekordsete jutumärkidega `sh 'cp target/labori-seis.war "versioonid/labori-seis-$VERSIOON.war"'`. Parameetrid on keskkonnamuutujad ja shell asendab need ise.

    **Miks nii.** Kellaaeg näitab, millal fail loodi, kuid mitte seda, millisest lähtekoodist. Kaks buildi samast commit'ist annavad eri kellaaja, kaks buildi eri commit'idest võivad anda sama minuti. Räsi seob faili lähtekoodiga üheselt ja seda saab kontrollida käsuga `git show`. Jenkinsi workspace ei ole artefaktide repositoorium.

    Freestyle job'i shell-sammus on `VERSIOON` keskkonnamuutuja ja jutumärkides ohutu. Käsusüst tekib siis, kui väärtus lisatakse käsu teksti enne shelli, näiteks Pipeline'is `sh "cp … ${params.VERSIOON}"`, kus Groovy asendab väärtuse enne, kui shell rea saab. Tootmises piiratakse parameetrit lisaks *Choice Parameter*-iga või kontrollitakse seda enne kasutamist regulaaravaldisega.

### 11. Sandboxis rollipõhised õigused

**Tase:** keskmine · **Eeldus:** [Jenkins koodina](lab-5-jenkins-koodina.md), enne sandboxi koristamist · **Esita:** `k06-jenkins/casc/jenkins.yaml`

Matrix-tabel muutub kümne kasutaja korral raskesti loetavaks. Seadistad sandboxis sama rollipõhise mudeli, mis on kasutusel klassis, ja kirjutad selle koodina.

- Paigalda plugin `Role-based Authorization Strategy`.
- Loo globaalne roll `lugeja` ja item-roll mustriga `ehitus.*` ning anna mõlemad kasutajale `vaatleja`.
- Kirjuta sama seadistus faili `k06-jenkins/casc/jenkins.yaml` (`authorizationStrategy.roleBased`, vaata faili `klass-jenkins.yaml`) ja laadi seadistus uuesti (reload).
- Loo proovimiseks job `muu`.
- Kirjuta issue'sse, kuidas seadistus vastab loengu joonisele 6.5.

**Kontroll:**

```bash
python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' k06-jenkins/casc/jenkins.yaml
read -rs P    # vaatleja parool
printf 'user = "vaatleja:%s"\n' "$P" | curl -gsS -K- 'http://localhost:8090/api/json?tree=jobs[name]' | jq -c '[.jobs[].name]'
```

**Valmis, kui:**

- YAML-i kontroll ei väljasta midagi;
- `vaatleja` loendis on ainult `ehitus`-ga algavad nimed ja `muu` puudub;
- pärast reload'i pääsed oma admin-kasutajaga endiselt lehele Manage Jenkins;
- issue's on võrdlus joonisega 6.5.

??? success "Lahendus"
    Administraatori roll on failis esimesena. Kui see puudub, lukustab reload sinu enda välja (taaste nagu õiguste ja varunduse osas: `useSecurity` → `false`). `plugins.txt`-i lisandub rida `role-strategy:<versioon>`.

    ```yaml
    jenkins:
      authorizationStrategy:
        roleBased:
          roles:
            global:
              - name: "admin"
                permissions:
                  - "Overall/Administer"
                entries:
                  - user: "<sinu admin-kasutaja>"
              - name: "lugeja"
                permissions:
                  - "Overall/Read"
                entries:
                  - user: "vaatleja"
            items:
              - name: "ehitus"
                pattern: "ehitus.*"
                permissions:
                  - "Job/Read"
                entries:
                  - user: "vaatleja"
    ```

    **Miks nii.** Rollipõhise mudeli eelis on see, et uue kasutaja lisamine on üks rida rolli `entries`-loendis, mitte uus veerg tabelis. Kui seadistus on JCasC failis, on ka õiguste muudatus commit, mille saab üle vaadata.

### 12. Sama pipeline Actionsis

**Tase:** keskmine · **Eeldus:** [Esitamine](https://hkhk-tk.github.io/is1-automatiseerimine/k06/lab-5-esitamine/), GitHub Actionsi kohtumise `ci.yml`

Paljud meeskonnad viivad pipeline'id Jenkinsist GitHub Actionsisse või vastupidi. Vaatad, kui suur osa sinu pipeline'ist ei sõltu tööriistast.

- Käivita GitHub Actions Importeri käsk `audit` oma Jenkinsi kohta.
- Käivita `dry-run` job'i `labori-seis` kohta ja võrdle tulemust oma failiga `ci.yml`.
- Kirjuta issue'sse, mis on Jenkinsis lihtsam ja mis keerulisem, eriti `input`, `when` ja `parallel` puhul.

**Kontroll:**

```bash
ls ~/importer/audit ~/importer/dry-run
actionlint <dry-run'i workflow fail>
```

**Valmis, kui:**

- `~/importer/audit` sisaldab auditi raportit;
- `~/importer/dry-run` sisaldab workflow faili;
- issue's on `actionlint`-i leitud vead ja võrdlus kolme konstruktsiooni kohta.

??? success "Lahendus"
    Importer töötab Dockeri konteineris control node'il ja loeb Jenkinsit API kaudu sinu kasutaja õigustega. Väljund läheb repositooriumist välja: selles on sinu Jenkinsi URL ja job'ide nimed.

    ```bash
    gh extension install github/gh-actions-importer
    gh actions-importer update
    gh actions-importer configure      # vali Jenkins; URL, kasutaja <gh>, API token; GitHubi token
    gh actions-importer audit jenkins --output-dir ~/importer/audit
    gh actions-importer dry-run jenkins --output-dir ~/importer/dry-run \
        --source-url "http://jenkins.lab.hkhk.ee:8080/job/<gh>/job/labori-seis"
    ```

    Tüüpiline tulemus:

    | Jenkinsis | Importer annab | Mida teed käsitsi |
    |---|---|---|
    | `input` | kommentaar või `environment` koos *required reviewers*-iga | keskkond ja ülevaatajad repositooriumi seadetes |
    | `when` | `if:` | põhjuse tingimus (`triggeredBy`) ei tõlgi, Actionsis on `github.event_name` |
    | `parallel` | eraldi job'id | `needs` ja failide jagamine artefaktidega (`upload-artifact`) |
    | `withSonarQubeEnv`, `waitForQualityGate` | tõlkimata samm | Sonari action ja quality gate'i ootamine |
    | `nexusArtifactUploader` | tõlkimata samm | `mvn deploy:deploy-file` (ülesanne 6) |

    `actionlint` loetleb vead, mille parandad enne kasutamist.

    **Miks nii.** Importer tõlgib struktuuri, kuid mitte keskkonda: agendi label, folderi credential'id ja Sonari webhook tuleb Actionsis uuesti seadistada. Mida rohkem loogikat on shell-skriptides ja mida vähem Jenkinsi pluginates, seda lihtsam on üleminek.

### Lisaprojekt: sandboxi varundusskript

**Tase:** keskmine · **Eeldus:** [Õigused, varundus ja taaste](lab-6-haldus.md), konteiner `jenkins-liivakast` on olemas, `docker run --rm ubuntu:24.04 true` töötab · **Esita:** `k06-jenkins/jenkins-backup.sh`

Laboris tegid Jenkinsi varukoopia käsitsi. Skript teeb koopia ühe käsuga, kontrollib seda ja hoiab alles ainult mõne viimase.

- Argumendid: konteineri nimi, sihtkaust (vaikimisi `~/jenkins-varukoopiad`) ja alles jäävate arhiivide arv (vaikimisi 3).
- Volume leitakse `docker inspect` abil sihtkoha `/var/jenkins_home` järgi, mitte nime järgi oletades.
- Töötav Jenkins peatatakse enne `tar`-i ja käivitatakse lõpus uuesti, ka vea korral (`trap … EXIT`).
- Arhiivis ei ole kaustu `workspace/`, `caches/` ega `tools/`.
- Arhiivi omanik on käivitaja ja õigused `600`, sihtkausta õigused `700`. Saladust sisaldav fail tekib kohe nende õigustega.
- Kui arhiivis ei ole `./config.xml`-i ja `./secrets/master.key`-d, on väljumiskood 1 ja rida `FAIL:`.
- Alles jääb N uusimat arhiivi. Viimane rida on `OK: <arhiiv> (<suurus>)`.
- `shellcheck -S warning` ei leia vigu.

**Kontroll:**

```bash
shellcheck -S warning k06-jenkins/jenkins-backup.sh
for i in 1 2 3 4; do k06-jenkins/jenkins-backup.sh jenkins-liivakast ~/jenkins-varukoopiad 3; done
ls -l ~/jenkins-varukoopiad; stat -c '%a %U' ~/jenkins-varukoopiad/*.tgz
tar tzf "$(ls -t ~/jenkins-varukoopiad/*.tgz | head -1)" | grep -c '^./workspace'
docker ps --filter name=jenkins-liivakast --format '{{.Status}}'
```

**Valmis, kui:**

- neli käivitust lõpevad reaga `OK:`;
- kaustas on kolm arhiivi, `stat` annab igaühe kohta `600 <sinu kasutaja>`;
- `grep -c` annab `0` ja `docker ps` näitab olekut `Up`;
- kirjutuskaitstud sihtkaustaga lõpeb skript `FAIL`-iga ja `docker ps` näitab konteinerit ikka töötavana;
- skript töötab ka konteineriga `jenkins-taaste`, tühja volume'iga konteiner annab `FAIL`.

Vihje: 1. kohtumise `systemd/labseis-check.service` ja `.timer` sobivad ka sellele skriptile.

??? tip "Lahenduse suund"
    - **Volume.** `docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/jenkins_home"}}{{.Name}}{{end}}{{end}}'` annab volume'i nime. Tühi tulemus tähendab bind mount'i või vale konteinerit, siis on õige `FAIL`.
    - **Peatamine ja trap.** Loe `{{.State.Running}}` enne `docker stop`-i ja pane `trap` enne peatamist. Taaskäivita ainult see, mis töötas.
    - **Arhiiv.** Abikonteiner (`ubuntu:24.04`) kus volume on `:ro` ja sihtkaust bind mount'ina. `tar`-ile `--exclude=./workspace` jne. Fail tekib `root`-i omana, seepärast teeb teine abikonteiner `chown $(id -u):$(id -g)` ja `chmod 600`. `umask` siin ei aita.
    - **Kontroll.** `tar tzf` ja `grep -qx './secrets/master.key'`.
    - **Rotatsioon.** `find -printf '%T@ %p\n' | sort -rn | tail -n +$((N+1))`, ainult sama konteineri arhiivid.
    - **Lõksud.** Suhteline sihtkaust muutub `docker -v` juures nimega volume'iks: tee see enne absoluutseks. Kasutaja timer vajab `loginctl enable-linger`-it.
    - **Koristus.** Kustuta kaust koos arhiividega sandboxi koristamise ajal.

    **Miks nii.** `trap … EXIT` ei käivitu `kill -9` ega systemd `TimeoutStopSec` järel saadetud `SIGKILL`-i korral: siis jääb Jenkins peatatuks ja selle peab tabama monitooring, mitte skript. Volume'i otsimine sihtkoha järgi teeb skripti taaskasutatavaks: sama skript sobib igale ametliku image'iga Jenkinsile.

    Teenuse peatamine on lihtsaim viis saada järjepidev varukoopia. Suurem Jenkins ei saa iga öö seisma jääda. Seal pannakse Jenkins *Prepare for Shutdown* režiimi (`/quietDown`), mis laseb käimasolevatel buildidel lõppeda ega alusta uusi, ja tehakse LVM- või ZFS-snapshot. Snapshot on crash-consistent: pooleli olevate pipeline'ide olek võib olla poolik, aga `config.xml`-id kirjutab Jenkins ajutise faili ja ümbernimetamisega, nii et need on terved.

    Skripti viimane rida sobib monitooringule ja `journalctl`-ile: kontrolli viimase `OK`-rea vanust, mitte ainult viimase käivituse väljumiskoodi, sest timer, mis üldse ei käivitunud, ei kirjuta ka `FAIL`-i.

## Rasked ülesanded

### 13. Saladuste rotatsioon ilma punase buildita

**Tase:** raske · **Eeldus:** [Quality gate ja Nexus](https://hkhk-tk.github.io/is1-automatiseerimine/k06/lab-3-sonar-nexus/) · **Esita:** `k06-jenkins/rotatsiooni-kontroll.sh`

Folderis on kaks pikaajalist saladust: Sonari token (`sonar`) ja GitHubi token (`github`). Need vahetatakse, kui token lekib, kui inimene lahkub või kui aegumiskuupäev läheneb. Vahetus peab käima nii, et pipeline ei seisku ja vana token on pärast seda tõestatult kehtetu.

- Jenkinsfile'i ega job'i seadistust ei muudeta, credential'ite ID-d jäävad samaks. Tokenid ei käi käsureal ega Gitis.
- Üks build töötab vahetuse ajal ja lõpeb rohelisena. Ükski pollimine ei ebaõnnestu rotatsiooni ajal autentimisel (Git Polling Log).
- Vana Sonari token on kehtetu ja uus kehtib (`GET /api/authentication/validate`).
- Vana GitHubi token ei loe repositooriumi ja uus loeb (`GET https://api.github.com/repos/hkhk-tk/<repo>`).
- `rotatsiooni-kontroll.sh` kontrollib nelja tokenit ja job'i viimast 3 buildi (Jenkinsi API `builds[number,result]{0,3}`, `curl -g`), väljastab iga kontrolli kohta rea `OK:` või `FAIL:` ja lõpetab koodiga 0 ainult siis, kui kõik on täidetud.
- Skript loeb tokenid failidest õigustega `600` ja annab need `curl`-ile `-K-` kaudu.

**Kontroll:**

```bash
shellcheck -S warning k06-jenkins/rotatsiooni-kontroll.sh
GH_REPO=hkhk-tk/<repo> JENKINS_USER=<gh> k06-jenkins/rotatsiooni-kontroll.sh 3; echo "kood $?"
grep -c 'curl -u' k06-jenkins/rotatsiooni-kontroll.sh
```

**Valmis, kui:**

- skript väljastab seitse rida `OK:` (neli tokenit, kolm buildi) ja koodi `0`;
- Sonar annab vanale tokenile `{"valid":false}` ja uuele `{"valid":true}`, GitHub vanale `401` ja uuele `200`;
- viimastest 3 buildist on kõik SUCCESS ja üks neist töötas vahetuse ajal;
- `grep -c` annab `0`;
- PR-i kirjelduses on rotatsiooni järjekord koos põhjendusega ja Git Polling Logi ekraanipilt pärast vana tokeni tühistamist.

??? tip "Lahenduse suund"
    - **Põhiidee.** Lisa uus token, vaheta väärtus, tõesta, tühista vana. Nii Sonar kui GitHub lubavad mitut kehtivat tokenit korraga, nii et vahepeal kehtivad mõlemad.
    - **Mehhanism.** Credential'i **Update** sama ID all. Jenkins lahendab ID väärtuseks siis, kui samm (`withSonarQubeEnv`, `checkout`, pollimine) käivitub, mitte buildi alguses. Etapis Build vahetatud credential jõuab sama buildi SonarQube etappi.
    - **Tööriistad.** Sonar: **My Account → Security**, *Project Analysis Token*. GitHub: fine-grained token, *Contents: Read-only*. Kontrollskriptis `curl -K-` (`user = "<token>:"`, `header = "Authorization: Bearer <token>"`) ja `jq`.
    - **Kontroll.** Vana tokeni kehtetus on tõend. Roheline build tõestab ainult seda, et uus token töötab.
    - **Lõksud.** Vana token tühistatakse enne credential'i vahetust: pollimine ebaõnnestub vaikselt ja punast värvi pole. Uus credential uue ID-ga vajab koodimuudatust. Kasutaja token projektitokeni asemel laiendab lekke ulatust.

### 14. WAR Nexusest app01-le koos rollback'iga

**Tase:** raske · **Eeldus:** [süvenemise osa 4](syvenemine.md#osa-4-image-paralleel-ja-deploy) · **Esita:** `k06-jenkins/deploy-app01.sh`, `k06-jenkins/Jenkinsfile`

Põhiülesannetes paigaldas pipeline image'i agendile endale. Nüüd paigaldab Jenkins Nexuses oleva WAR-i 2. kohtumise Tomcatisse app01-l (`k02-ansible/deploy.yml`, roll `tomcat`). Vigase versiooni korral jääb app01 tööle eelmise versiooniga.

- Kolm hosti: agent (control node), app01 (Tomcat) ja web01, mille kaudu `deploy.yml` teeb health check'i. Etapp `Deploy app01` on pärast etappi `Deploy` ja töötab ainult inimese käivitatud buildis pärast kinnitust, nagu `Deploy`.
- `deploy-app01.sh` keeldub versioonist, mis ei ole kujul `<pom>-<build>-<sha>`.
- Build once: app01-le läheb Nexusest laaditud fail, mille `sha1` võrreldakse enne Ansible'it Nexuse `.sha1`-ga, ja Maven ei käivitu uuesti.
- SSH-võti ja Vaulti parool on folderi credential'id (`app01-ssh`, `vault-pass`). Agendi kasutaja `jenkins` kettale ei jää kumbagi.
- Pärast deploy'd loetakse app01-st custom fact ja `ROOT.war`-i räsi. Etapi logi viimane rida on `OK: app01 <versioon> <sha1>`.
- Vigane versioon ei jäta app01-d maha: rollback on automaatne ja tõestatud app01-st, mitte Jenkinsi etapi värvist.

**Kontroll** (control node'il, kaustas `k02-ansible`):

```bash
ansible app01 -m ansible.builtin.command -a 'cat /etc/ansible/facts.d/deploy.fact' -o
ansible app01 -m ansible.builtin.command -a 'sha1sum /opt/tomcat/webapps/ROOT.war' -o
printf 'katki' > /tmp/katki.war
ansible-playbook deploy.yml -e labseis_version=1.1.0-0-0000000 -e labseis_war_local=/tmp/katki.war | tail -3
ansible app01 -m ansible.builtin.command -a 'cat /etc/ansible/facts.d/deploy.fact' -o
curl -s -o /dev/null -w '%{http_code}\n' http://10.10.1.12:8080/health
sudo grep -rl --exclude-dir=tools 'PRIVATE KEY' /opt/jenkins | wc -l
../k06-jenkins/deploy-app01.sh 1.1.0; echo "kood $?"
```

**Valmis, kui:**

- fact näitab Jenkinsi buildi versiooni ja `ROOT.war`-i räsi on sama mis Nexuse `.sha1`;
- vigase WAR-i proov lõpeb `failed=1`-ga ja fact näitab endiselt sama versiooni;
- `curl` annab `200` ja `grep … | wc -l` annab `0`;
- `deploy-app01.sh 1.1.0` annab `FAIL: …` ja koodi `1`, vale räsi korral ei käivitu `ansible-playbook`;
- pollSCM-i buildis on `Deploy app01` vahele jäetud.

??? tip "Lahenduse suund"
    - **Põhiidee.** Agent laadib WAR-i Nexusest, võrdleb räsi ja annab faili `deploy.yml`-ile muutujaga `labseis_war_local`. Rolli `tomcat` deploy-osa teeb block/rescue rollback'i ise: eelmine versioon on custom fact'is.
    - **Saladused.** `withCredentials([sshUserPrivateKey(credentialsId: 'app01-ssh', keyFileVariable: 'SSH_KEY'), file(credentialsId: 'vault-pass', variable: 'VAULT_PASS_FILE')])` ja `ansible-playbook --private-key "$SSH_KEY" --vault-password-file "$VAULT_PASS_FILE"`. Mõlemad on ajutised failid, mis kustutatakse pärast sammu.
    - **Tõend.** Pärast playbook'i loe app01-st `/etc/ansible/facts.d/deploy.fact` ja `sha1sum /opt/tomcat/webapps/ROOT.war`. `/version` siin ei sobi: `GIT_SHA` tuleb failist `/etc/labori-seis/env`, mille kirjutab `install.yml`, mitte `deploy.yml`.
    - **Rollback'i proov.** Vigane WAR (`printf 'katki'`) ei käivitu, `/version` jääb 404-ks 30 × 4 s jooksul ja rescue paneb eelmise faili tagasi.
    - **Lõksud.** Vault jäetakse vahele: `group_vars/all/vault.yml` laaditakse inventory lugemisel ja ilma paroolita ebaõnnestub ka ainult `deploy.yml`. Võti agendi kasutaja `~/.ssh`-is annab igale sellel agendil töötavale Jenkinsfile'ile root'i app01-l. Kaks job'i (näiteks multibranch) võivad paigaldada korraga, sest `disableConcurrentBuilds` kehtib ühele job'ile.

### 15. Agendi olek monitooringusse

**Tase:** raske · **Eeldus:** [Neli punast buildi](lab-7-neli-punast.md) · **Esita:** `k06-jenkins/check-jenkins-agent.sh`

Intsidendiülesandes avastasid offline-olekus agendi alles siis, kui build jäi järjekorda. Administraator tahab sellest teada enne, kui keegi commit'i teeb, aga ei taha öist häiret iga agendi restart'i või VPN-i katkestuse peale.

- Allikas on controlleri API `…/computer/<gh>/api/json?tree=offline,temporarilyOffline,offlineCauseReason`. Skript väljastab ühe rea `<OLEK>: <node> …` ja väljumiskoodi nagu 1. kohtumise `check.sh`: `OK` (0), `WARNING` (1), `CRITICAL` (2), `UNKNOWN` (3).
- Kui controller ei vasta, on tulemus `UNKNOWN`, mitte `CRITICAL`: agendi olekut siis ei tea.
- `CRITICAL` tuleb alles teisel järjestikusel offline-tulemusel, esimene on `WARNING`. Järjestikuste offline-tulemuste arv on failis kaustas `~/.local/state/`.
- Käsitsi kasutusest välja võetud node (`temporarilyOffline`) on `WARNING` koos põhjusega.
- Token on failis õigustega `600` ja läheb `curl`-ile `-K-` kaudu.
- Kontroll käivitub kasutaja tasemel `systemd`-timer'iga iga 5 minuti järel. Proovimiseks peata agent (`sudo systemctl stop jenkins-agent`), oota kaks käivitust ja käivita agent uuesti.

**Kontroll:**

```bash
shellcheck -S warning k06-jenkins/check-jenkins-agent.sh
JENKINS_URL=http://127.0.0.1:9 JENKINS_USER=<gh> k06-jenkins/check-jenkins-agent.sh; echo "kood $?"
journalctl --user -u jenkins-agent-check -o cat --since "-30min" | grep -E '^(OK|WARNING|CRITICAL|UNKNOWN):'
```

**Valmis, kui:**

- `shellcheck` ei väljasta midagi;
- teine käsk annab `UNKNOWN` ja koodi `3`;
- journal'is on järjest `OK`, `WARNING` (1/2), `CRITICAL` ja uuesti `OK`;
- PR-i kirjelduses on vastus, miks see kontroll ei tohi töötada samal agendil, mida see jälgib, kui agendi masin ise ei tööta.

??? tip "Lahenduse suund"
    - **Põhiidee.** Allikas on controlleri vaade, mitte `systemctl is-active jenkins-agent`. Teenus võib olla `active` ja ühendus ikka puududa (vale saladus, VPN).
    - **Mehhanism.** `curl -f --max-time 10` ebaõnnestumine tähendab `UNKNOWN` ja loendurit ei puututa. `offline: false` kustutab loenduri faili, `offline: true` suurendab seda ja võrdleb lävega. `jq -r '.offlineCauseReason // ""'`.
    - **Tööriistad.** Bash, `curl -K-`, `jq`. Kasutaja `systemd` teenus (`Type=oneshot`) ja timer (`OnCalendar=*:0/5`). `loginctl enable-linger`, et timer töötaks ka väljalogitult.
    - **Kontroll.** Võlts-URL annab `UNKNOWN 3`. Agendi peatamine annab journal'isse järjestuse `WARNING (1/2)` ja `CRITICAL`.
    - **Lõksud.** Controlleri kättesaamatus loetakse `CRITICAL`-iks: VPN-i katkestus annab siis häire kõigi agentide kohta. Ilma loendurita annab iga restart häire. Kui kogu masin on maas, ei kirjuta see kontroll midagi: seda tabab teisest masinast tehtud kontroll, mis vaatab viimase `OK`-rea vanust.

    **Miks nii.** Jenkinsi API näitab iga node'i olekut ja ühenduse katkemise põhjust. `offlineCauseReason` on kasulik tekst häire juurde: see näitab, kas node võeti kasutusest välja käsitsi või katkes ühendus. Esimene on plaaniline hooldus ega vaja öist häiret, teine on rike.

### 16. Neli silma ja muudatuse kirje

**Tase:** raske · **Eeldus:** [Õigused, varundus ja taaste](lab-6-haldus.md), enne sandboxi koristamist · **Esita:** `k06-jenkins/neli-silma/Jenkinsfile`

Auditis küsitakse iga tootmise deploy kohta, kes selle käivitas, kes kinnitas ja kas need olid eri inimesed. Põhiülesannete `input` laseb kinnitada igaühel, kellel on *Job/Build*, ja buildi logi kaob koos buildiga.

- Sandboxi pipeline job `muudatus` (*Pipeline script*) tuleb failist `k06-jenkins/neli-silma/Jenkinsfile`. Parameetrit `VERSIOON` kontrollitakse enne kasutamist, `buildDiscarder` hoiab kolme viimast buildi.
- Kinnitada saab ainult `kinnitaja`. Kui kinnitaja on buildi käivitaja, peatub build enne deploy'd FAILURE-ga, ka administraatori puhul.
- `kinnitaja` saab maatriksis ainult kinnitamiseks vajalikud õigused: ta ei saa job'i seadistada ega ise käivitada.
- Kinnitus aegub 15 minutiga ja ootamise ajal ei hoita executorit kinni (sandboxis on `numExecutors: 1`).
- Iga build, ka tagasi lükatud, aegunud ja ebaõnnestunud, lisab ühe JSON-rea faili `/audit/muudatused.jsonl` volume'il `jenkins-audit`, mitte `$JENKINS_HOME`-i. Sandbox käivitub uuesti nii, et see volume on kaustas `/audit` ja `jenkins-liivakast` jääb alles.
- Proov: kolm buildi (kinnitad ise, kinnitab `kinnitaja`, kolmas aegub), siis veel kaks, et esimene kustuks.

**Kontroll:**

```bash
docker exec jenkins-liivakast cat /audit/muudatused.jsonl | jq -c '[.build, .kaivitaja, .kinnitaja, .tulemus]'
docker exec jenkins-liivakast ls /var/jenkins_home/jobs/muudatus/builds/
```

**Valmis, kui:**

- esimene käsk näitab vähemalt viit rida: build 1 käivitaja ja kinnitaja on sama ning `FAILURE`, build 2 kinnitaja `kinnitaja` ja `SUCCESS`, build 3 `ABORTED`;
- teine käsk ei näita enam buildi `1`, aga selle rida on audit-failis alles;
- PR-i kirjelduses on `kinnitaja` õigused ja lause selle kohta, kes saab audit-faili sandboxis muuta ja kuhu see tootmises läheb.

??? tip "Lahenduse suund"
    - **Põhiidee.** `submitter` ütleb, kes tohib kinnitada, aga administraator saab kinnitada alati ja Jenkins ei võrdle kinnitajat käivitajaga. Nelja silma kontroll on sinu kood pärast `input`-it.
    - **Mehhanism.** Deklaratiivse `input`-i `submitterParameter 'KINNITAJA'` paneb kinnitaja ID etapi keskkonda. Käivitaja on `currentBuild.getBuildCauses('hudson.model.Cause$UserIdCause')` esimese elemendi `userId`. Ülemine `agent none`, etapi `options { timeout(...) }` ümbritseb ka `input`-i. Kirje tuleb ülemisest `post { always { ... } }` plokist, kus `node('built-in')` sees `sh` lisab rea `printf`-iga. `currentBuild.currentResult` annab tulemuse.
    - **Tööriistad.** `docker volume create`, `docker run … -v jenkins-audit:/audit`, `docker exec -u root … chown jenkins:jenkins /audit`. Maatriks: `kinnitaja` vajab *Overall/Read* ja *Job/Read*. `jq` control node'il.
    - **Kontroll.** Kõige tähtsam on esimene build: administraatori kinnitust `input` ei keela, ainult sinu võrdlus peatab buildi.
    - **Lõksud.** Kirje kirjutatakse ainult õnnestunud deploy'st ja tagasi lükatud muudatus ei jäta jälge. Kirje on `$JENKINS_HOME/jobs/…` all ja kustub `buildDiscarder`-iga. `KINNITAJA` loetakse väljaspool `input`-iga etappi ja see on tühi, kui see pole `env`-i salvestatud. `VERSIOON` läheb `printf`-i Groovy stringi kaudu, mitte keskkonnamuutujana. Sandboxis saab administraator audit-faili ikka muuta: tootmises läheb rida syslogi või SIEM-i, kuhu Jenkinsil on ainult lisamise õigus.

### Lisaprojekt: shared library samm

**Tase:** raske · **Eeldus:** [süvenemise osa 4](syvenemine.md#osa-4-image-paralleel-ja-deploy) (etapis Build arvutatakse `env.ART_VERSION`), folderis on credential `github` · **Esita:** `k06-jenkins/shared-lib/vars/labseisVersion.groovy`

Versiooni arvutus on Jenkinsfile'is ja iga Nexusesse avaldav job peaks seda kordama. Shared library samm `labseisVersion()` teeb arvutuse ühes kohas, nii et versiooniskeemi muudatus tehakse ainult seal. Tag'iga kinnitatud teek ei muuda kõiki pipeline'e korraga.

- Teek on failis `k06-jenkins/shared-lib/vars/labseisVersion.groovy`, tag on `lib-v1` ja teek laaditakse Jenkinsfile'i algusesse enne plokki `pipeline {}` (kuju allpool).
- Etapis Build on versiooni arvutuse asemel üks sammu kutse, `readMavenPom` Jenkinsfile'is puudub.
- Samm tagastab `<pom.version>-<BUILD_NUMBER>-<commit'i 7 märki>`.
- Pom-faili tee on argument `pom`, vaikimisi `pom.xml`: `labseisVersion()` ja `labseisVersion(pom: 'pom.xml')` annavad sama tulemuse.
- Kui `GIT_COMMIT` puudub, lõpetab samm töö selge veateatega (`error`).
- Samm kasutab ainult Groovy sandboxis lubatud meetodeid (`substring`, mitte `take`).
- Teegi muudatus harul ei muuda buildi enne, kui Jenkinsfile viitab uuele tag'ile.

```groovy
library identifier: 'labseis@lib-v1', retriever: modernSCM(
    scm: [$class: 'GitSCMSource', remote: 'https://github.com/hkhk-tk/<sinu repo>.git', credentialsId: 'github'],
    libraryPath: 'k06-jenkins/shared-lib/')
```

**Kontroll:**

```bash
grep -n 'library identifier' k06-jenkins/Jenkinsfile
grep -c readMavenPom k06-jenkins/Jenkinsfile
git rev-parse 'lib-v1^{commit}'
for t in stages nexus secrets docker; do bash autograde/check.sh k06 "$t"; done
git add k06-jenkins/ && git commit -m "k06: shared library labseisVersion" && git push
```

**Valmis, kui:**

- buildi logi alguses on `Loading library labseis@lib-v1` ja teegi räsi on sama mis `git rev-parse` väljund, ka pärast seda, kui muutsid harul teegi veateksti ja tegid push'i;
- `grep -c readMavenPom` annab `0`, buildi nimi ja Nexuse versioon on sama kujuga nagu enne;
- ajutine kutse `script {}`-plokis enne checkout'i annab sinu veateate;
- logis ei ole teadet „Scripts not permitted“ ja automaatse hindaja kontrollid annavad `OK`.

Vihje: juhendi [Shared Libraries](https://www.jenkins.io/doc/book/pipeline/shared-libraries/) jaotised „Directory structure“, „Defining custom steps“ ja „Loading libraries dynamically“.

??? tip "Lahenduse suund"
    - **Põhiidee.** `vars/labseisVersion.groovy` sisaldab `def call(Map args = [:])`. `args.pom ?: 'pom.xml'`, `readMavenPom file: …` ja `env.GIT_COMMIT.substring(0, 7)`.
    - **Mehhanism.** `library` samm võtab `retriever`-i Jenkinsfile'ist, `libraryPath` ütleb, kus repositooriumis teegi juur on. Versioon `lib-v1` on tag. Uus teegi versioon on uus tag ja Jenkinsfile'i muudatus, mis on üle vaadatav commit.
    - **Kontroll.** Veateate proovis `options { skipDefaultCheckout() }` ja esimene etapp `script { labseisVersion() }` annavad `GIT_COMMIT puudub`, mitte `NullPointerException`-i.
    - **Lõksud.** `take(7)` annab sandboxis `Scripts not permitted`. `libraryPath` vale kaustaga annab `No such DSL method 'labseisVersion'`. `@Library` annotatsioon ilma globaalse või folderi teegi seadistuseta ei leia teeki. Teek *Trusted* globaalse teegina töötab ilma sandboxita.

    **Miks nii.** Shared library on Groovy kood, mis laaditakse buildi alguses Gitist. Kaustas `vars/` on globaalsed muutujad: failinimi on sammu nimi ja meetod `call` muudab selle sammuks, mida kutsutakse nagu sisseehitatud sammu `sh`. Keerulisem loogika paigutatakse kausta `src/` klassidena ja template'id kausta `resources/`, kust neid loeb samm `libraryResource`.

    Teegi usaldustase sõltub sellest, kus teek on seadistatud. Administraatori seadistatud globaalne teek (**Manage Jenkins → System → Global Trusted Pipeline Libraries**) töötab ilma Groovy sandboxita ja saab teha kõike, mida controller. Seetõttu on selle teegi repositooriumi kirjutusõigus sama tundlik kui administraatori parool. Folderi tasemel teek ja sammuga `library` laaditud teek töötavad Groovy sandboxis nagu Jenkinsfile ise.

    Annotatsioon `@Library('nimi@versioon')` laadib teegi enne skripti kompileerimist ja on tavaline kuju globaalse teegi puhul. Samm `library` laadib teegi käivitamise ajal ja võimaldab seadistuse kirjutada Jenkinsfile'i. Haru nimi versioonina (`@k06-jenkins`) tähendaks, et iga teegi commit muudab kohe kõiki pipeline'e.

    Jagatud kood vajab ka oma teste. Väikest sammu nagu `labseisVersion()` on lihtne kontrollida ühe job'iga, kuid kui teeki kasutab kümme meeskonda, kirjutatakse sellele ühiktestid (näiteks JenkinsPipelineUnit) ja teegi repositooriumile tehakse oma CI. Muidu avastab teegi vea esimene meeskond, kelle build hommikul ebaõnnestub.

## Võrguinsenerile

Rada jätkab tööriistaga `vorgukogu` (1. kohtumise lisa 21, image [3. kohtumise lisa 15](https://hkhk-tk.github.io/is2-automatiseerimine/k03/lisa/)). Jenkins teeb siin sama, mida võrgumeeskondades teevad RANCID või Oxidized: kogub igal ööl ruuterite väljundi ja commit'ib selle Giti ainult siis, kui midagi muutus, nii et igal muudatusel on aeg ja diff. Eeldus: koolitaja on loonud `rtr01` ja `rtr02`, sinu agent (control node) jõuab neile pordil 22 ja ehitab image'eid (põhilabori Image ja deploy).

### 17. vorgukogu öösel Jenkinsiga

**Tase:** keskmine · **Eeldus:** [süvenemise osa 2](syvenemine.md#osa-2-triggerid-piirid-ja-post), [3. kohtumise lisa 15](https://hkhk-tk.github.io/is2-automatiseerimine/k03/lisa/), tühi privaatne repositoorium `vork-konf` · **Esita:** `vorgukogu/Jenkinsfile`, `vorgukogu/varunda.sh`

Pärast riket küsitakse, mis ruuteris eile teisiti oli, ja vastus on "keegi ei tea". Job `vorgukogu` ehitab igal ööl image'i, kogub mõlemalt ruuterilt väljundi ja paneb selle repositooriumisse `vork-konf`, mille sisu võib proovides kustutada.

- Folderi credential'id: `rtr-ssh` (*SSH Username with private key*, kasutaja `kasutaja`, sinu automatiseerimise võti) ja `vork-git` (*Username with password*, fine-grained token ainult repositooriumile `vork-konf`, *Contents: Read and write*). Job: *Pipeline from SCM*, *Script Path* `vorgukogu/Jenkinsfile`.
- `cron('H 2 * * *')`, sinu agent, korraga üks build, ajapiir.
- Image ehitatakse buildis ja kustutatakse lõpus, konteiner saab võtme ainult mount'iga credential'i ajutisest failist.
- `vorgukogu` kood 2 (üks ruuter maas) annab `UNSTABLE`, mitte `FAILURE` ega rohelist, muu nullist erinev kood `FAILURE`. Ruuter, kes ei vastanud, jätab oma eelmise varukoopia `vork-konf`-is muutmata.
- Commit ja push ainult siis, kui mõni fail muutus. Commit'i teates on muutunud ruuterid.
- Token ei ole URL-is, käsureal ega `.git/config`-is.

**Kontroll:**

```bash
shellcheck vorgukogu/varunda.sh
git clone https://github.com/<github>/vork-konf.git ~/vork-konf
grep -rnE '(password|key-string|md5) +[^* ]' ~/vork-konf; echo "kood $?"
grep -r github_pat_ ~/vork-konf/.git; echo "kood $?"
# rtr02 muudatus enne kolmandat build'i:
sudo vtysh -c 'configure terminal' -c 'interface lo' -c 'description hooldus'
git -C ~/vork-konf pull -q && git -C ~/vork-konf log --stat -1
```

**Valmis, kui:**

- teise järjestikuse buildi logis on `OK: muudatusi pole`, `git log --oneline` ei pikene;
- pärast rtr02 muudatust näitab `git log --stat -1` ainult `rtr02/show-running-config.txt`;
- rtr01 Proxmoxis *Shutdown*: build kollane, logis `FAIL rtr01`, `rtr01/` failid muutmata;
- mõlemad `grep`-id annavad koodi 1, buildi logis on token kujul `****`;
- PR-is on kontrollid buildide numbritega, rtr01 töötab ja rtr02-l on `no description`.

??? success "Lahendus"
    `sshUserPrivateKey` kirjutab võtme buildi ajaks ajutisse faili ja kustutab selle pärast plokki; `docker run -v "$RTR_KEY:…:ro"` annab selle konteinerile ilma image'isse panemata. `--user "$(id -u):$(id -g)"` käivitab konteineri agendi kasutajana (`jenkins`): ajutine võtmefail on ainult tema loetav. `sh(returnStatus: true)` annab koodi Groovy'le ja `unstable()` teeb buildi kollaseks, nii et osaline rike ei ole vaikne roheline ega peida teise ruuteri varundust punase taha. `varunda.sh` kloonib repositooriumi ajutisse kausta, kopeerib väljundi ilma `--delete`-ita (maas ruuteri vanad failid jäävad) ja teeb commit'i ainult `git diff --cached --quiet` mittenulli korral. Credential helper loeb tokeni keskkonnast push'i hetkel: URL-is ja `.git/config`-is seda pole.

    ```groovy
    // vorgukogu öösel: image, kogumine kahelt ruuterilt, commit varunduse repo'sse ainult muutusel.
    // Job: Pipeline from SCM, Script Path vorgukogu/Jenkinsfile. Credential'id sinu folderis: rtr-ssh, vork-git.
    def GH = env.JOB_NAME.split('/')[0].toLowerCase()

    pipeline {
        agent { label "${GH}" }
        triggers { cron('H 2 * * *') }
        options {
            disableConcurrentBuilds()
            timeout(time: 15, unit: 'MINUTES')
            buildDiscarder(logRotator(numToKeepStr: '30'))
        }
        environment {
            IMAGE = "vorgukogu:jenkins-${BUILD_NUMBER}"
            VORK_BACKUP_REPO = "https://github.com/${GH}/vork-konf.git"
        }
        stages {
            stage('Image') {
                steps {
                    dir('vorgukogu') { sh 'docker build -q -t "$IMAGE" .' }
                }
            }
            stage('Kogu') {
                steps {
                    withCredentials([sshUserPrivateKey(credentialsId: 'rtr-ssh', keyFileVariable: 'RTR_KEY', usernameVariable: 'RTR_USER')]) {
                        script {
                            // 0 kõik korras, 2 mõni ruuter ei vastanud (teised kogutud), muu: viga
                            def rc = sh(returnStatus: true, script: '''
                                rm -rf out && mkdir out
                                docker run --rm --user "$(id -u):$(id -g)" \
                                  -e VORK_USER="$RTR_USER" -e VORK_KEY_FILE=/run/secrets/rtr_key \
                                  -v "$RTR_KEY:/run/secrets/rtr_key:ro" -v "$PWD/out:/app/out" "$IMAGE"
                            ''')
                            if (rc == 2) {
                                unstable('mõni ruuter ei vastanud: tema eelmine varukoopia jääb muutmata')
                            } else if (rc != 0) {
                                error("vorgukogu lõppes koodiga ${rc}")
                            }
                        }
                    }
                }
            }
            stage('Commit') {
                steps {
                    withCredentials([usernamePassword(credentialsId: 'vork-git', usernameVariable: 'GIT_USER', passwordVariable: 'GIT_TOKEN')]) {
                        sh 'vorgukogu/varunda.sh out'
                    }
                }
            }
        }
        post {
            always { sh 'docker image rm -f "$IMAGE" > /dev/null 2>&1 || true' }
        }
    }
    ```

    ```bash
    #!/usr/bin/env bash
    # varunda.sh <kaust> : kopeerib vorgukogu väljundi varunduse repo'sse, commit ja push ainult muutusel.
    # Keskkond: VORK_BACKUP_REPO (https URL), GIT_USER, GIT_TOKEN (Jenkinsi credential vork-git).
    set -euo pipefail

    src=${1:?kasutus: $0 <vorgukogu väljundi kaust>}
    repo=${VORK_BACKUP_REPO:?VORK_BACKUP_REPO puudub}
    : "${GIT_USER:?GIT_USER puudub}" "${GIT_TOKEN:?GIT_TOKEN puudub}"
    [[ -d $src ]] || { echo "kausta $src pole" >&2; exit 1; }

    wt=$(mktemp -d)
    trap 'rm -rf -- "$wt"' EXIT
    # token ei lähe URL-i, käsureale ega .git/config-i: helper loeb selle keskkonnast
    # shellcheck disable=SC2016  # $GIT_USER ja $GIT_TOKEN avab helper'i shell, mitte see skript
    auth=(-c credential.helper= -c 'credential.helper=!f() { echo "username=$GIT_USER"; echo "password=$GIT_TOKEN"; }; f')

    git "${auth[@]}" clone -q --depth 1 "$repo" "$wt" 2> >(grep -v 'empty repository' >&2)
    # ilma --delete-ta: ruuter, kes täna ei vastanud, jätab oma eelmise varukoopia alles
    cp -r "$src"/. "$wt"/
    cd "$wt"
    git add -A
    if git diff --cached --quiet; then
        echo "OK: muudatusi pole"
        exit 0
    fi
    hosts=$(git diff --cached --name-only | cut -d/ -f1 | sort -u | tr '\n' ' ')
    git -c user.name="vorgukogu (Jenkins)" -c user.email="vorgukogu@labseis.invalid" \
        commit -q -m "vorgukogu: ${hosts% }"
    git "${auth[@]}" push -q origin HEAD:refs/heads/main
    echo "OK: commit $(git rev-parse --short HEAD) (${hosts% })"
    ```

    Täislahendus: `labori-seis/deploy/lisa-lahendused/k06/vork-jenkins/`. Kontrollitud: ShellCheck, `varunda.sh` kohaliku bare-repositooriumiga (tühi repositoorium, muutuseta käivitus, ühe ruuteri muudatus, puuduv ruuter ei kustuta tema faile). Kontrollimata: Jenkinsfile Jenkinsis ja `docker run` agendil.

## Arutelu

**Eeldus:** [Esitamine](https://hkhk-tk.github.io/is1-automatiseerimine/k06/lab-5-esitamine/) · **Esita:** `k06-jenkins/NOTES.md`

Vasta lühidalt failis `k06-jenkins/NOTES.md`. Mitmele küsimusele ei ole üht õiget vastust: vastus sõltub sellest, kui palju inimesi Jenkinsit kasutab, kui tundlik on kood ja kui palju maksab tund seisakut.

1. **Agent.** Agent loob ühenduse controlleriga, mitte vastupidi. Mida see tähendab tulemüüri jaoks ja kas controller peab teadma sinu VM-i IP-aadressi?
2. **Triggerid.** Milline on pollSCM-i koormus võrreldes webhookiga, kui job'e on 500 ja intervall on üks minut?
3. **options.** `disableConcurrentBuilds` hoiab ära kaks samaaegset deploy'd. Millal oleks parem `abortPrevious: true` ja millal oleks see ohtlik?
4. **Turve.** Miks on kasutaja `jenkins` lisamine [`docker`-gruppi](https://docs.docker.com/engine/security/#docker-daemon-attack-surface) sinu masinas aktsepteeritav, kuid controlleris mitte?
5. **Võti.** Kus peaks `master.key` varukoopia asuma, et üks lekkinud arhiiv ei annaks ligipääsu kõigile paroolidele, kuid taastamine oleks endiselt võimalik?

## Kodutöö

| Issue | Mis | Juhend |
|---|---|---|
| `K6.K` | Jenkins: image ECR-i ja deploy EC2-le | [`kodutood/k06-aws.md`](../kodutood/k06-aws.md) |
| `K6.M` | Monitooring: öine kontroll ajalooga Jenkinsis | [`kodutood/monitooring.md`](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/monitooring/#6-kohtumine-oine-kontroll-ajalooga) → 6. kohtumine |

AWS-i kodutöö on tasuline ja jätab pilve ressursse alles, kui koristus jääb tegemata: loe enne alustamist juhendi koristusosa ja käivita lõpus allesjäänud ressursside kontroll. Monitooringu kodutöö kasutab sama `oine-kontroll` mustrit nagu ülesanne [2. Ajastatud ja upstream trigger](#2-ajastatud-ja-upstream-trigger).
