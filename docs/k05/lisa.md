---
tags:
  - CI/CD
  - Maven
  - GitHub Actions
---

# Lisaülesanded: GitHub Actions

Ülesanded jätkavad IS1 praktikumi [Maven ja GitHub Actions](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab/) workflow'd `ci.yml`. Iga ülesande juures on kirjas, millise IS1 praktikumi osa või IS2 süvenemise osa see eeldab.

| Ülesanne | Tase | Tulemus |
|---|---|---|
| [1. Maveni hoidla ja tühi masin](#1-maveni-hoidla-ja-tuhi-masin) | lihtne | tead, mida `cache: maven` säästab |
| [2. Teine Maveni versioon](#2-teine-maveni-versioon) | lihtne | Maven 3.9.11 töötab apt'i versiooni kõrval |
| [3. Maven Wrapper](#3-maven-wrapper) | lihtne | CI ehitab repos kirjas oleva Maveniga |
| [4. Action'i sisendid](#4-actioni-sisendid) | lihtne | tead, millal checkout vajab kogu ajalugu |
| [5. Ruleset](#5-ruleset) | lihtne | otse push main'i on keelatud |
| [6. Trivy masinloetavalt](#6-trivy-masinloetavalt) | lihtne | Trivy leiud on JSON-ist kokku loetud |
| [7. Smoke test](#7-smoke-test) | lihtne | ajastatud kontroll märkab seiskunud teenust |
| [8. Matrix kahes mõõtmes](#8-matrix-kahes-mootmes) | keskmine | matrix proovib läbi JDK ja JaCoCo kombinatsioonid |
| [9. Kontekst ja sammu tingimus](#9-kontekst-ja-sammu-tingimus) | keskmine | tead, kuidas PR-i väärtus ohutult shelli jõuab |
| [10. Trivy poliitika](#10-trivy-poliitika) | keskmine | CRITICAL leid peatab image'i enne registry't |
| [11. Kus logimaskeering lõpeb](#11-kus-logimaskeering-lopeb) | keskmine | tead, millal maskeerimine secret'it ei peida |
| [12. Vanad image'id registry's ja runner'is](#12-vanad-imageid-registrys-ja-runneris) | keskmine | vanad image'id koristatud, rollback töötab |
| [13. Ebaõnnestunud deploy annab teada](#13-ebaonnestunud-deploy-annab-teada) | keskmine | katkine deploy avab issue |
| [14. Sama WAR app01 VM-ile](#14-sama-war-app01-vm-ile) | raske | sama WAR läheb Ansible'iga app01 VM-ile |
| [15. Ühekordne runner](#15-uhekordne-runner) | raske | iga deploy job saab uue runner'i |
| [16. Andmebaasi parooli rotatsioon ilma katkestuseta](#16-andmebaasi-parooli-rotatsioon-ilma-katkestuseta) | raske | parool vahetatud ilma ühegi `Access denied`-ita |
| [17. Allkirjastatud image ja deploy, mis allkirja kontrollib](#17-allkirjastatud-image-ja-deploy-mis-allkirja-kontrollib) | raske | deploy paigaldab ainult allkirjastatud image'i |
| [Lisaprojekt: korduvkasutatav deploy-workflow](#lisaprojekt-korduvkasutatav-deploy-workflow) | raske | deploy on eraldi kutsutav workflow |
| [18. vorgukogu testid ja CI](#18-vorgukogu-testid-ja-ci) | keskmine | `vorgukogu` testid käivituvad igal PR-il |

Ülesannetel, mille tulemus läheb repo kausta `.github/` või repo seadetesse, on GitHubis eraldi issue (label `edasijõudnu`).

## Lihtsad ülesanded

### 1. Maveni hoidla ja tühi masin

**Tase:** lihtne · **Eeldus:** [Maven](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-1-maven/)

GitHubi hallatud runner on iga job'i alguses tühi masin, kohalikku Maveni hoidlat seal pole. Sinu workflow'is on `cache: maven`, aga sa ei tea, kui palju see igal käivitusel säästab.

- mõõda kohaliku hoidla suurus enne ja pärast `mvn -B clean`
- ehita projekt nii, nagu hoidla oleks tühi, ilma et sinu `~/.m2` muutuks
- ehita uuesti täis hoidlaga ja võrdle kestust
- võrdle kaht `du` ja kaht `time` tulemust

**Kontroll:**

```bash
du -sh ~/.m2/repository
mvn -B clean
du -sh ~/.m2/repository
time mvn -B -Dmaven.repo.local=/tmp/m2-tuhi package -DskipTests | grep -m3 'Downloading from'
time mvn -B -q package -DskipTests
rm -rf /tmp/m2-tuhi
```

**Valmis, kui:**

- kaks `du -sh ~/.m2/repository` tulemust on samad
- tead tühja ja täis hoidlaga `time` tulemuste vahet
- `ls /tmp/m2-tuhi` annab pärast katset vea

??? success "Lahendus"
    `-Dmaven.repo.local` suunab ainult selle käivituse hoidla teise kausta. Tühja hoidla suurus pärast build'i näitab, kui palju `setup-java` vahemälu igal käivitusel taastab. Võti on `pom.xml`-i räsi, nii et sõltuvuse muutus teeb uue vahemälu.

    ```bash
    time mvn -B -Dmaven.repo.local=/tmp/m2-tuhi package -DskipTests > /tmp/tuhi.log
    grep -c 'Downloaded from' /tmp/tuhi.log      # allalaaditud failide arv
    du -sh /tmp/m2-tuhi                           # see läheb CI vahemällu
    time mvn -B -q package -DskipTests
    rm -rf /tmp/m2-tuhi /tmp/tuhi.log
    ```

    Kontroll: `grep -c` annab sadu ridu, `du` annab sadu megabaite ja teine `time` on mitu korda lühem kui esimene. Täpsed arvud sõltuvad võrgust ja Maveni pluginate versioonidest.

    **Miks nii.** `clean` kustutab ainult kausta `target/`, kohalik hoidla jääb samaks. Tühja hoidlaga laadib Maven aadressilt `https://repo.maven.apache.org/maven2/` sadu faile ja build kestab mitu korda kauem. Kahe `time` tulemuse vahe on aeg, mille `cache: maven` igal CI käivitusel säästab.

### 2. Teine Maveni versioon

**Tase:** lihtne · **Eeldus:** [Maven](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-1-maven/)

Projekt võib nõuda kindlat Maveni versiooni, näiteks kui mõni plugin vajab uuemat Maveni API-t. Control node'il on apt'iga paigaldatud Maven, mida teised projektid kasutavad edasi.

- paigalda Maven 3.9.11 kausta `~/opt` Apache'i tarball'ist, ilma apt'ita
- süsteemi Maven ja `PATH` jäävad muutmata
- ehita projekt mõlema versiooniga

**Kontroll:**

```bash
mvn -v | head -1
~/opt/apache-maven-3.9.11/bin/mvn -v | head -1
~/opt/apache-maven-3.9.11/bin/mvn -B -q verify; echo $?
```

**Valmis, kui:**

- `mvn -v` näitab apt'iga paigaldatud versiooni
- täistee kaudu käivitatud Maven näitab `Apache Maven 3.9.11`
- `verify` õnnestub mõlema versiooniga (`echo $?` annab `0`)

Vihje: tarball on aadressil `https://archive.apache.org/dist/maven/maven-3/3.9.11/binaries/`.

??? success "Lahendus"
    Tootmises paigaldatakse tarball alles pärast kontrollsumma võrdlust. Apache avaldab iga faili kõrval `.sha512`, milles on ainult räsi, seega tuleb `sha512sum -c` jaoks rida ise kokku panna.

    ```bash
    v=3.9.11; f=apache-maven-$v-bin.tar.gz
    base=https://archive.apache.org/dist/maven/maven-3/$v/binaries
    cd /tmp && curl -fsSLO "$base/$f" && curl -fsSLO "$base/$f.sha512"
    echo "$(cut -d' ' -f1 "$f.sha512")  $f" | sha512sum -c -
    mkdir -p ~/opt && tar -xzf "$f" -C ~/opt && rm -f "$f" "$f.sha512"
    ~/opt/apache-maven-$v/bin/mvn -v | head -1
    ```

    Kontroll: `sha512sum` annab `apache-maven-3.9.11-bin.tar.gz: OK`, viimane rida on `Apache Maven 3.9.11` ja `~/opt/apache-maven-3.9.11/bin/mvn -B -q verify; echo $?` annab repo kaustas `0`.

    **Miks nii.** Tarball kausta `~/opt` ei puutu paketihalduri faile ega `PATH`-i, nii et mõlemad versioonid on kõrvuti ja kumb käivitub, otsustab tee. Ülesanne [3. Maven Wrapper](#3-maven-wrapper) teeb sama nii, et versioon on repos kirjas.

### 3. Maven Wrapper

**Tase:** lihtne · **Eeldus:** [Maven](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-1-maven/) · **Esita:** `mvnw`, `mvnw.cmd`, `.mvn/`, `.github/workflows/ci.yml`

Ülesandes [2. Teine Maveni versioon](#2-teine-maveni-versioon) sõltus Maveni versioon sellest, mis masinasse on paigaldatud. Runner ja kolleegi masin võivad ehitada sama commit'i eri versiooniga.

- lisa repo juurde Maven Wrapper versiooniga 3.9.11 ja tee sellest commit
- CI kõik Maveni käivitused kasutavad `./mvnw`-d
- `mvnw` on Gitis käivitatav
- vaata kausta `~/.m2/wrapper` sisu ja võrdle tulemust ülesandega 2

**Kontroll:**

```bash
./mvnw -v | head -1
git ls-files -s mvnw
grep -c './mvnw -B verify' .github/workflows/ci.yml
bash autograde/check.sh k05 build
```

**Valmis, kui:**

- `./mvnw -v` annab `Apache Maven 3.9.11`
- `git ls-files -s mvnw` algab `100755`-ga
- `grep -c` annab `2` (build ja compat)
- automaatne hindaja annab `OK` ja CI käivitus õnnestub

Vihje: `mvn wrapper:wrapper -Dmaven=3.9.11`.

??? success "Lahendus"
    Wrapper'i plugin kirjutab `mvnw`, `mvnw.cmd` ja `.mvn/wrapper/maven-wrapper.properties`. `mvnw` laadib properties-failis nimetatud Maveni kausta `~/.m2/wrapper/dists/` ja kasutab seda edaspidi. `mvnw` peab Gitis olema käivitatav (`100755`), muidu ebaõnnestub CI `Permission denied`-iga.

    ```bash
    mvn -B wrapper:wrapper -Dmaven=3.9.11
    ./mvnw -v | head -1
    git add mvnw mvnw.cmd .mvn/ && git ls-files -s mvnw
    sed -i 's/- run: mvn -B verify/- run: .\/mvnw -B verify/' .github/workflows/ci.yml
    git commit -am "build: Maven Wrapper 3.9.11" && git push
    ```

    Kontroll: `./mvnw -v` annab `Apache Maven 3.9.11`, `git ls-files -s mvnw` algab `100755`-ga, `grep -c './mvnw -B verify' .github/workflows/ci.yml` annab `2` (build ja compat) ja `bash autograde/check.sh k05 build` annab endiselt `OK`.

    **Miks nii.** Erinevalt ülesandest 2 on versioon nüüd repos kirjas ja iga masin ning runner ehitab sama versiooniga, sõltumata sellest, mis sinna on paigaldatud.

### 4. Action'i sisendid

**Tase:** lihtne · **Eeldus:** [Esimene workflow](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-2-workflow/)

Action'it seadistatakse `with:`-sisenditega ja iga action'i README on selle dokumentatsioon. Sinu build job'i checkout kasutab vaikeväärtusi ja sa ei tea, kui palju Giti ajalugu runner'il on.

- leia [actions/checkout](https://github.com/actions/checkout#usage) README-st sisend `fetch-depth` ja selle vaikeväärtus
- lisa build job'is checkout'i järele allolev ajutine samm ja tee push
- lisa checkout'ile `with:` alla `fetch-depth: 0` ja tee uuesti push
- eemalda ajutine samm ja `fetch-depth`

```yaml
      - run: |
          git log --oneline | wc -l
          git describe --tags --always
```

**Kontroll:**

```bash
gh run list -w ci -L 2 --json databaseId,headSha
gh run view <id> --log | grep -A3 'git describe'
```

**Valmis, kui:**

- tead `fetch-depth` vaikeväärtust
- oled võrrelnud mõlema push'i `wc -l` ja `describe` tulemust
- oskad öelda, millal on kogu ajalugu vaja
- ajutist sammu ja `fetch-depth`-i workflow'is enam pole

??? success "Lahendus"
    `fetch-depth` vaikeväärtus on `1`: checkout teeb madala klooni ühest commit'ist ja tag'e ei too. `0` toob kogu ajaloo koos tag'idega. Kogu ajalugu on vaja siis, kui samm loeb ajalugu: `git describe`, muudatuste logi kahe tag'i vahel, SonarQube'i "uus kood" või `git diff` main'iga.

    ```yaml
          - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09  # v5.1.0
            with:
              fetch-depth: 0
          - run: |
              git log --oneline | wc -l
              git describe --tags --always
    ```

    Kontroll: esimeses käivituses on sammu väljund `1` ja 7-märgiline SHA, teises commit'ide koguarv ja kuju `<tag>-<n>-g<sha>`.

    **Miks nii.** Kogu ajalooga näitab `describe` viimast tag'i, näiteks `k04-3-gabc1234`: tag `k04`, sellest kolm commit'i edasi, commit `abc1234`.

### 5. Ruleset

**Tase:** lihtne · **Eeldus:** [Esimene workflow](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-2-workflow/)

Praegu saab main'i push'ida otse ja deploy käivitub ilma ühegi kontrollita.

- loo branch ruleset harule `main` (*Settings → Rules → New branch ruleset*)
- muudatus jõuab main'i ainult PR-iga
- nõutud kontrollid on `build` ja `security`
- reegel kehtib ka repo adminile
- proovi otse main'i push'ida

**Kontroll:**

```bash
git commit --allow-empty -m "test: otse main'i" && git push origin HEAD:main
gh api 'repos/{owner}/{repo}/rulesets' --jq '.[].name'
git reset --hard HEAD~1
```

**Valmis, kui:**

- push lõpeb teatega `GH013: Repository rule violations found`
- `gh api` näitab sinu ruleset'i nime
- avatud PR-i ei saa merge'ida enne, kui `build` ja `security` on õnnestunud

??? success "Lahendus"
    Ruleset koodina, et sama reegli saaks panna igale repole. Kontrolli nimi on job'i nimi (`build`), mitte graafis näidatav `ci / build`. `integration_id` 15368 on GitHub Actions: sama nimega staatust ei saa siis keegi teine API kaudu rohelisena seada. Bypass-nimekiri on tühi, nii et reegel kehtib ka repo adminile.

    ```bash
    gh api -X POST 'repos/{owner}/{repo}/rulesets' --input - << 'EOF'
    {"name": "main-kaitse", "target": "branch", "enforcement": "active",
     "conditions": {"ref_name": {"include": ["~DEFAULT_BRANCH"], "exclude": []}},
     "rules": [{"type": "deletion"}, {"type": "non_fast_forward"},
      {"type": "pull_request", "parameters": {"required_approving_review_count": 0,
       "dismiss_stale_reviews_on_push": false, "require_code_owner_review": false,
       "require_last_push_approval": false, "required_review_thread_resolution": false}},
      {"type": "required_status_checks", "parameters": {"strict_required_status_checks_policy": false,
       "required_status_checks": [{"context": "build", "integration_id": 15368},
                                  {"context": "security", "integration_id": 15368}]}}]}
    EOF
    git commit --allow-empty -m "test: otse main'i" && git push origin HEAD:main
    ```

    Kontroll: push lõpeb `GH013: Repository rule violations found for refs/heads/main` ja `gh api 'repos/{owner}/{repo}/rulesets' --jq '.[].name'` näitab `main-kaitse`. Võta tühi commit tagasi: `git reset --hard HEAD~1`. Kui API vastab `403` ja mainib plaani uuendamist, ei luba organisatsiooni plaan rulesetti privaatses repos. Kontrollimata: `integration_id` väärtus sinu GitHubi instantsis (vaata `gh api 'repos/{owner}/{repo}/commits/main/check-runs' --jq '.check_runs[0].app.id'`).

    **Miks nii.** Ruleset sulgeb tee, kus push main'i käivitab deploy ilma ühegi kontrollita.

### 6. Trivy masinloetavalt

**Tase:** lihtne · **Eeldus:** [Trivy, matrix ja õigused](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-3-trivy-matrix/)

Trivy tabel on mõeldud inimesele. Dashboard, piletisüsteem või quality gate vajab sama tulemust JSON-ina. Trivy paigaldasid control node'ile 3. kohtumisel.

- skänni repo (`trivy fs`, ainult `vuln`, tasemed `CRITICAL,HIGH`) JSON-vormingus faili `/tmp/trivy.json`
- loe `jq`-ga välja leidude arv taseme kaupa
- võrdle tulemust CI tabeliga

**Kontroll:**

```bash
trivy fs --scanners vuln --severity CRITICAL,HIGH --format json -o /tmp/trivy.json .
jq '[.Results[].Vulnerabilities[]?] | group_by(.Severity) | map({(.[0].Severity): length}) | add' /tmp/trivy.json
```

**Valmis, kui:**

- `jq` annab objekti kujul `{"CRITICAL": n, "HIGH": m}`
- arvud on CI tabeliga samad või väga lähedased

??? success "Lahendus"
    `Results` võib puududa ja `Vulnerabilities` võib olla `null`, seega `?` mõlemal tasemel ja `// {}` tühja tulemuse jaoks. Sama CVE võib olla mitmes target'is (näiteks `pom.xml` ja WAR), nii et unikaalne arv võib olla väiksem kui ridade arv.

    ```bash
    trivy fs --scanners vuln --severity CRITICAL,HIGH --format json -o /tmp/trivy.json .
    jq '[.Results[]?.Vulnerabilities[]?] | group_by(.Severity) | map({(.[0].Severity): length}) | add // {}' /tmp/trivy.json
    jq '[.Results[]?.Vulnerabilities[]?.VulnerabilityID] | unique | length' /tmp/trivy.json
    jq -r '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")
      | "\(.PkgName) \(.InstalledVersion) -> \(.FixedVersion // "parandus puudub")"] | unique[]' /tmp/trivy.json
    ```

    Kontroll: esimene `jq` annab objekti `{"CRITICAL": n, "HIGH": m}` või `{}`, teine unikaalsete CVE-de arvu ja kolmas kriitiliste leidude paketid koos versiooniga, milles viga on parandatud.

    **Miks nii.** Väike erinevus CI tabeliga tuleneb haavatavuste andmebaasi versioonist: control node'i ja runner'i Trivy laadisid andmebaasi eri ajal.

### 7. Smoke test

**Tase:** lihtne · **Eeldus:** [Health check ja rollback](lab-6-tagasipoore.md) · **Esita:** `.github/workflows/smoke.yml`

Deploy kontrollib rakendust ainult deploy ajal. Kui mõni teenus, näiteks rmq01, öösel seiskub, ei märka seda pipeline enne järgmist deploy'd.

- eraldi fail `.github/workflows/smoke.yml`, `ci.yml` jääb muutmata
- käivitub ajakava järgi ja käsitsi, sinu runner'il
- lõpeb veaga, kui `/health` ei vasta läbi web01 (port 8080 control node'il) koodiga 200
- peata rmq01 (`docker stop` selle konteinerile) ja käivita workflow käsitsi

**Kontroll:**

```bash
docker stop "$(docker ps -q -f label=com.docker.compose.service=rmq01)"
gh workflow run smoke.yml && sleep 10 && gh run watch "$(gh run list -w smoke.yml -L 1 --json databaseId --jq '.[0].databaseId')"
docker start "$(docker ps -aq -f label=com.docker.compose.service=rmq01)"
```

**Valmis, kui:**

- peatatud rmq01-ga on käivitus punane ja annotatsioon ütleb põhjuse
- pärast `docker start`-i on järgmine käivitus roheline
- `actionlint .github/workflows/smoke.yml` on vaikne

??? success "Lahendus"
    `verify-deploy` ei sobi siia, sest see vajab `expected-sha`-d ja `docker compose exec` vajab `.env`-i, mida deploy job kustutab. `curl` web01 kaudu kontrollib sama teed, mida kasutaja: web01 → app01 → db01 ja rmq01. Grupp `smoke` on eraldi: kui see oleks `deploy-proxmox`, võiks ootel smoke test asendada ootel deploy'i, sest grupis on korraga ainult üks ootel käivitus. Cron on UTC-s.

    ```yaml
    name: smoke

    on:
      schedule:
        - cron: "*/30 5-16 * * 1-5"
      workflow_dispatch:

    permissions: {}

    concurrency:
      group: smoke
      cancel-in-progress: true

    jobs:
      smoke:
        runs-on: [self-hosted, linux, labseis]
        timeout-minutes: 5
        steps:
          - name: /health läbi web01
            run: |
              if curl -fsS -o /dev/null --max-time 5 --retry 2 --retry-all-errors http://localhost:8080/health; then
                echo "smoke: /health 200" >> "$GITHUB_STEP_SUMMARY"
              else
                echo "::error::smoke: /health ei vasta 200 (web01 → app01 → db01/rmq01)"
                exit 1
              fi
    ```

    Kontroll: peatatud rmq01-ga on käivitus punane ja annotatsioonis on `/health ei vasta 200`. Pärast `docker start`-i ja paarikümmet sekundit on uus käivitus roheline.

    **Miks nii.** Smoke test leiab rikke, mis tekib ilma deploy'ta. `--retry 2` ei lase ühel aeglasel vastusel öösel häiret tekitada, aga seiskunud teenus jääb punaseks.

## Keskmised ülesanded

### 8. Matrix kahes mõõtmes

**Tase:** keskmine · **Eeldus:** [Trivy, matrix ja õigused](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-3-trivy-matrix/) · **Esita:** `.github/workflows/ci.yml`

Sinu `compat` job proovib kahte JDK-d. Kui JDK ja JaCoCo töötavad kumbki eraldi uuendatuna, ei tähenda see veel, et nende kombinatsioon töötab.

- lisa matrix'ile teine mõõde `jacoco: ["0.8.15", "0.8.12"]` ja anna see Mavenile võtmega `-Djacoco.version=${{ matrix.jacoco }}`
- **Ennusta** enne push'i, milline neljast kombinatsioonist ebaõnnestub ja miks
- ühe kombinatsiooni ebaõnnestumine ei katkesta teisi
- lisa `exclude:` kombinatsioonile, mida sa ei toeta, ja `include:` ühele lisakombinatsioonile (nt Java 21 + JaCoCo 0.8.14)

**Kontroll:**

```bash
actionlint .github/workflows/ci.yml
gh run view <id> --json jobs --jq '.jobs[] | select(.name | startswith("compat")) | [.name, .conclusion] | @tsv'
```

**Valmis, kui:**

- enne `exclude`-i on käivituses 4 `compat` job'i ja oled tulemust ennustusega võrrelnud
- tead ebaõnnestunud job'i veateadet
- pärast `exclude`-i ja `include`-i on 4 `compat` job'i ja kõik on rohelised

??? success "Lahendus"
    Ebaõnnestub Java 25 + JaCoCo 0.8.12. Projekti klassid on `release 21` ehk major 65 ja neid loeb ka vana JaCoCo. JaCoCo agent instrumenteerib aga käivitumisel ka JDK enda klassi ja JDK 25 klassifaile (major 69) tunneb alles 0.8.14. Agent ei käivitu ja testide JVM lõpeb enne esimest testi. `exclude` eemaldab selle kombinatsiooni. `include` lisab uue job'i, sest JaCoCo väärtus erineb kõigist olemasolevatest.

    ```yaml
        strategy:
          fail-fast: false
          matrix:
            java: ["21", "25"]
            jacoco: ["0.8.15", "0.8.12"]
            exclude:
              - java: "25"
                jacoco: "0.8.12"
            include:
              - java: "21"
                jacoco: "0.8.14"
        steps:
          # checkout ja setup-java nagu enne
          - run: mvn -B verify -Djacoco.version=${{ matrix.jacoco }}
    ```

    Kontroll: enne `exclude`-i on graafis 4 `compat` job'i ja `compat (25, 0.8.12)` on punane, logis `Unsupported class file major version 69`. Pärast on 4 job'i (3 + `include`) ja kõik on rohelised. Kontrollimata siin: veateate täpne sõnastus sõltub surefire'i versioonist.

    **Miks nii.** Ülesanne vastab küsimusele, kas kahe tööriista samaaegne uuendus töötab, kui kumbki eraldi uuendatuna töötab. Piir ei ole projekti koodis, vaid agendis, mis loeb JDK klassifaile: seda näeb ainult kombinatsiooni käivitades.

### 9. Kontekst ja sammu tingimus

**Tase:** keskmine · **Eeldus:** [Trivy, matrix ja õigused](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-3-trivy-matrix/)

Image'i ja deploy job'i `if:`-tingimused loevad [kontekstide](https://docs.github.com/actions/reference/workflows-and-actions/contexts) väärtusi. Osa väärtusi tuleb PR-i autorilt ja jõuab sinu runner'il shelli.

- lisa build job'ile kaks allolevat ajutist sammu ja käivita workflow nii push'il kui PR-il
- võrdle mõlema sündmuse `ref`-i ja sammu „PR info“ olekut
- kirjuta ühe sammu `run:`-ploki sisse otse `${{ github.head_ref }}` ja käivita `actionlint`
- eemalda ajutised sammud

```yaml
      - name: Kontekst
        run: echo "event=$GITHUB_EVENT_NAME ref=$GITHUB_REF" >> "$GITHUB_STEP_SUMMARY"
```

```yaml
      - name: PR info
        if: github.event_name == 'pull_request'
        env:
          HEAD_REF: ${{ github.head_ref }}
        run: |
          echo "PR haru: $HEAD_REF" >> "$GITHUB_STEP_SUMMARY"
```

**Kontroll:**

```bash
actionlint .github/workflows/ci.yml
gh run list -w ci -L 2 --json event,headBranch,url
```

**Valmis, kui:**

- tead push'i ja PR-i `ref` väärtust käivituste kokkuvõttest
- tead sammu „PR info“ olekut push'i korral
- oled näinud actionlint'i hoiatust otse kirjutatud `${{ github.head_ref }}` kohta ja oskad öelda, miks see on ohtlik
- `ci.yml`-is ajutisi samme pole

??? success "Lahendus"
    `${{ }}` asendatakse enne, kui shell skripti näeb: väärtus muutub skripti tekstiks. `env:` kaudu jõuab väärtus shelli muutujana ja jutumärkides `"$HEAD_REF"` jääb see andmeks. Rida `run: echo "PR haru: …"` ühel real ei parsi YAML-ina, sest `: ` on plain scalar'is võtme eraldaja ka siis, kui see on shelli jutumärkide sees. Seepärast on `run: |`.

    ```yaml
          - name: Ohtlik kuju (ainult actionlint'i jaoks, ära push'i)
            run: |
              echo "PR haru ${{ github.head_ref }}"
    ```

    Kontroll: `actionlint` annab sellele sammule `"github.head_ref" is potentially untrusted. avoid using it directly in inline scripts. instead, pass it through an environment variable.` Push'i kokkuvõttes on `event=push ref=refs/heads/k05-actions`, PR-i omas `event=pull_request ref=refs/pull/<nr>/merge` ja rida `PR haru: k05-actions`.

    **Miks nii.** Push'i korral on samm „PR info“ olekus *skipped*. Haru nime valib PR-i autor, seega antakse see edasi `env:` kaudu, mitte otse `run:`-ploki sisse: muidu saaks haru nimega `x$(curl …)` käske süstida ([turvajuhend](https://docs.github.com/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)).

### 10. Trivy poliitika

**Tase:** keskmine · **Eeldus:** [Image ja deploy](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-4-deploy/) · **Esita:** `.github/workflows/ci.yml`, `.trivyignore`

Trivy annab praegu ainult infot: kriitilise haavatavusega image jõuab ikkagi registry'sse ja sealt deploy'sse.

- Trivy peatab image job'i ainult tasemel `CRITICAL` (`exit-code: "1"`)
- skännitakse ehitatud image'it (`scan-type: image`) enne, kui see registry'sse läheb; skänniks ehitab `build-push-action` võtmega `load: true`
- iga leiu kohta, mida kohe parandada ei saa, on `.trivyignore`-s rida ja selle kohal kommentaar: miks erand ja millal see üle vaadata

**Kontroll:**

```bash
grep -n 'trivy-action\|push:' .github/workflows/ci.yml
grep -c '^CVE' .trivyignore; grep -c '^# CVE' .trivyignore
actionlint
```

**Valmis, kui:**

- Trivy rida on image job'is enne `push:`-rida
- kaks `grep -c` tulemust on võrdsed
- actionlint vaikib
- kui kustutad `.trivyignore`-st rea, mille leid on image'is, on image job punane ja *Packages* all uut tag'i pole

??? success "Lahendus"
    Esimene build laadib image'i ainult runner'i Dockerisse, Trivy skännib seda ja teine build lükkab sama image'i registry'sse. Teine build võtab kõik kihid buildx'i vahemälust, nii et see on kiire. `exp:` `.trivyignore` real paneb erandile aegumise: pärast seda kuupäeva on leid jälle punane ja keegi peab otsustama uuesti. Fail peab olemas olema, ka siis, kui selles on ainult kommentaar.

    ```yaml
          - name: Ehita skänniks (ainult kohalikku Dockerisse)
            uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc  # v7.4.0
            with:
              context: .
              file: k03-docker/app/Dockerfile
              load: true
              push: false
              tags: labori-seis-app:scan
              build-args: GIT_SHA=${{ github.sha }}
              cache-from: type=gha
          - name: Trivy image'i peal, CRITICAL peatab
            uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25  # v0.36.0
            with:
              scan-type: image
              image-ref: labori-seis-app:scan
              scanners: vuln
              severity: CRITICAL
              trivyignores: .trivyignore
              format: table
              exit-code: "1"
          # siia jääb senine build-push-action push'iga, muutmata
    ```

    ```text
    # .trivyignore: üks erand rea kohta, kommentaar alati erandi kohal
    # CVE-AAAA-NNNNN: <pakett> image'i baasis, parandatud versiooni pole; meie kood seda funktsiooni ei kasuta.
    # Üle vaadata, kui baasimage uueneb, hiljemalt kuupäeval exp.
    CVE-AAAA-NNNNN exp:2026-12-31
    ```

    Kontroll: `grep -n 'trivy-action\|push:' .github/workflows/ci.yml` näitab Trivy rida enne image job'i `push:`-rida, `grep -c '^CVE' .trivyignore` võrdub `grep -c '^# CVE' .trivyignore`-iga ja actionlint vaikib. Katse: kustuta `.trivyignore`-st üks rida, mille leid on image'is: image job on punane ja *Packages* all uut tag'i pole.

    **Miks nii.** Nii muutub skännimine quality gate'iks: kriitiline leid peatab pipeline'i enne, kui image registry'sse jõuab.

### 11. Kus logimaskeering lõpeb

**Tase:** keskmine · **Eeldus:** [Triggerid, saladused ja environment](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-5-saladused/)

GitHub asendab logis secret'i väärtuse tärnidega. Sa ei tea veel, millistel juhtudel see asendus ei toimi. Katse tehakse võltsväärtusega eraldi harus ja eraldi workflow failis, mitte `ci.yml`-is.

- lisa repo tasemele võltssecret ja loo haru `lisa-mask` (esimene plokk allpool)
- fail `.github/workflows/mask.yml` käivitub push'il harusse `lisa-mask`; selle ainsal sammul on `env: S: ${{ secrets.K05_MASK_TEST }}` ja kolm rida: `echo "$S"`, `echo "$S" | base64` ja `echo "${S:0:4}"`
- tee push ja vaata, mida iga rida logis näitas
- koristus: käivitused, secret ja haru kustutatakse (teine plokk)

```bash
printf 'tere-labor-123' | gh secret set K05_MASK_TEST
git switch -c lisa-mask
```

```bash
gh run list -b lisa-mask --json databaseId --jq '.[].databaseId' | xargs -n1 gh run delete
gh secret delete K05_MASK_TEST
git switch k05-actions && git push origin --delete lisa-mask && git branch -D lisa-mask
```

**Kontroll:**

```bash
gh run view "$(gh run list -b lisa-mask -L 1 --json databaseId --jq '.[0].databaseId')" --log   # enne koristust
gh secret list | grep -c K05_MASK_TEST
git ls-remote origin lisa-mask
```

**Valmis, kui:**

- tead iga kolme rea kohta, kas maskeerimine toimis
- `gh secret list | grep -c K05_MASK_TEST` annab `0`
- `git ls-remote origin lisa-mask` on tühi

??? success "Lahendus"
    Maskeerimine on tekstiasendus runner'i logiväljundis. Iga teisendus (base64, URL-kodeering, alamstring, JSON-i escape) annab uue stringi, mida runner ei tunne. Kui skript peab tuletatud väärtust väljastama, registreeri see enne `::add-mask::`-iga. Logis nähtud saladus on lekkinud: logi kustutamine ei aita, parool tuleb vahetada.

    ```yaml
    name: mask

    on:
      push:
        branches: [lisa-mask]

    permissions: {}

    jobs:
      mask:
        runs-on: ubuntu-latest
        timeout-minutes: 5
        steps:
          - env:
              S: ${{ secrets.K05_MASK_TEST }}
            run: |
              echo "$S"
              echo "$S" | base64
              echo "${S:0:4}"
    ```

    Kontroll: logis on read `***`, `dGVyZS1sYWJvci0xMjMK` ja `tere`. Pärast koristust annab `gh secret list | grep -c K05_MASK_TEST` `0` ja `git ls-remote origin lisa-mask` on tühi.

    **Miks nii.** Runner maskeerib ainult siis, kui väärtus ilmub logis täpselt sellisena, nagu see salvestati.

### 12. Vanad image'id registry's ja runner'is

**Tase:** keskmine · **Eeldus:** [Health check ja rollback](lab-6-tagasipoore.md) · **Esita:** `.github/workflows/koristus.yml`

Iga push main'i lisab registry'sse ghcr.io ühe image'i ja control node'ile ühe kohaliku koopia. Neid ei koristata ja mõne kuu pärast on control node'i ketas või registry kvoot täis.

- `.github/workflows/koristus.yml` käivitub kord nädalas ajakava järgi ja käsitsi
- registry's jäävad alles vähemalt kümme viimast versiooni, tag `latest` ja main'i viimaste roheliste käivituste image'id
- runner'i job kustutab kohalikud rakenduse image'id, mida ükski konteiner ei kasuta ja mis on vanemad kui nädal, kuid jätab alles kolm uusimat
- job'idel on ainult vajalikud õigused, `packages: write` ainult registry job'il
- rollback töötab pärast koristust edasi

**Kontroll:**

```bash
gh workflow run koristus.yml && sleep 10 && gh run watch
gh api "users/<owner>/packages/container/<repo>/versions" --jq length    # organisatsioonis orgs/…
docker image ls ghcr.io/<owner>/<repo>
```

**Valmis, kui:**

- koristuse käivitus õnnestub ja kokkuvõttes on versioonide ja kustutatute arv
- registry's on vähemalt 10 versiooni
- `docker image ls` näitab vähem rakenduse image'eid kui enne, kuid vähemalt kolm koos töötavaga
- katkise HEALTHCHECK'iga deploy teeb pärast koristust ikkagi rollback'i

Vihje: registry'st kustutatud versiooni tagasi ei saa, vaata enne esimest kustutavat käivitust versioonide nimekiri `gh api`-ga üle.

??? success "Lahendus"
    Registry poolel ei kasuta lahendus kolmanda osapoole action'it: `gh api` annab iga versiooni tag'id ja loomise aja, nii et poliitika on näha. Tag'ita versioone ei kustutata, sest buildx'i mitmeplatvormiline indeks ja attestation'id on ghcr.io-s eraldi tag'ita versioonid ning nende kustutamine rikub tag'iga image'i. Kohalikus job'is loetakse töötav image `docker ps` label'i järgi, sest `docker compose` vajaks `.env`-i.

    ```yaml
    name: koristus

    on:
      schedule:
        - cron: "41 5 * * 1"
      workflow_dispatch:

    permissions: {}

    concurrency:
      group: koristus
      cancel-in-progress: false

    jobs:
      registry:
        runs-on: ubuntu-latest
        timeout-minutes: 10
        permissions:
          packages: write
          actions: read
        env:
          GH_TOKEN: ${{ github.token }}
          GH_REPO: ${{ github.repository }}
          KEEP: "10"
        steps:
          - name: Vanad versioonid ghcr.io-st
            run: |
              owner="$GITHUB_REPOSITORY_OWNER"; pkg="${GITHUB_REPOSITORY#*/}"; pkg="${pkg,,}"
              if [[ "$(gh api "users/$owner" --jq .type)" == Organization ]]; then base="orgs/$owner"; else base="users/$owner"; fi
              # rollback'i jaoks: main'i kolme viimase rohelise käivituse sha7 jäävad alles igal juhul
              keep_tags=$(gh run list -w ci -b main -s success -L 3 --json headSha --jq '.[].headSha[0:7]')
              # ainult tag'iga versioonid, uuemad enne; tag'ita versioonid on mitmeplatvormilise indeksi osad
              gh api --paginate "$base/packages/container/$pkg/versions?per_page=100" \
                --jq '.[] | select(.metadata.container.tags | length > 0) | [.id, .created_at, (.metadata.container.tags | join(","))] | @tsv' \
                | sort -t $'\t' -k2,2r > "$RUNNER_TEMP/versions.tsv"
              n=0; del=0
              while IFS=$'\t' read -r id _ tags; do
                n=$((n + 1))
                if (( n <= KEEP )) || [[ ",$tags," == *,latest,* ]] || grep -qxF -f <(tr ',' '\n' <<< "$tags") <<< "$keep_tags"; then
                  continue
                fi
                gh api -X DELETE "$base/packages/container/$pkg/versions/$id" && echo "kustutatud $tags" && del=$((del + 1))
              done < "$RUNNER_TEMP/versions.tsv"
              echo "registry: $n tag'iga versiooni, kustutatud $del" >> "$GITHUB_STEP_SUMMARY"

      runner:
        runs-on: [self-hosted, linux, labseis]
        timeout-minutes: 10
        steps:
          - name: Vanad image'id control node'ilt
            run: |
              repo="ghcr.io/${GITHUB_REPOSITORY,,}"
              running=$(docker ps --filter label=com.docker.compose.service=app01 --format '{{.Image}}' | head -1)
              cutoff=$(date -d '7 days ago' +%s)
              for img in $(docker image ls "$repo" --format '{{.Repository}}:{{.Tag}}' | grep -v ':<none>$'); do
                printf '%s\t%s\n' "$(date -d "$(docker image inspect -f '{{.Created}}' "$img")" +%s)" "$img"
              done | sort -rn > "$RUNNER_TEMP/images.tsv"
              n=0
              while IFS=$'\t' read -r ts img; do
                n=$((n + 1))
                if (( n <= 3 )) || [[ "$img" == "$running" ]] || (( ts > cutoff )); then continue; fi
                docker image rm "$img" > /dev/null && echo "kustutatud $img"
              done < "$RUNNER_TEMP/images.tsv"
              docker image prune -f > /dev/null
              docker image ls "$repo" >> "$GITHUB_STEP_SUMMARY"
    ```

    Kontroll: `gh workflow run koristus.yml`, siis registry job'i kokkuvõttes on versioonide ja kustutatute arv, `gh api "users/<owner>/packages/container/<repo>/versions" --jq length` (organisatsioonis `orgs/…`) on vähemalt 10 ja `docker image ls ghcr.io/<owner>/<repo>` näitab vähemalt kolme image'it koos töötavaga. Seejärel korda rollback'i katset katkise HEALTHCHECK'iga: rollback õnnestub. Kontrollimata siin: `GITHUB_TOKEN` saab versiooni kustutada ainult siis, kui paketi seadetes (*Manage Actions access*) on sinu repol roll *Admin*. Workflow'ga loodud paketil on see tavaliselt nii.

    **Miks nii.** Rollback vajab eelmist image'it kas lokaalselt või registry's. Kui koristus kustutab selle mõlemast, ei ole rollback'i võimalik teha. Laboris saab iga image'i commit'ist uuesti ehitada, tootmises kontrolli enne, et image, millele rollback tugineb, jääb alles.

### 13. Ebaõnnestunud deploy annab teada

**Tase:** keskmine · **Eeldus:** [Health check ja rollback](lab-6-tagasipoore.md) · **Esita:** `.github/workflows/ci.yml`

Deploy ebaõnnestub öösel, rollback taastab eelmise versiooni ja keegi ei ava vahekaarti *Actions* enne hommikut. Rike jääb märkamata, kuni see kordub.

- deploy job'i lõpus on samm, mis ebaõnnestumise korral (`if: failure()`) avab käsuga `gh issue create` issue label'iga `deploy-rike`; `issues: write` on ainult deploy job'il
- pealkirjas on lühike SHA, sisus käivituse link (`$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID`) ja kas rollback käivitati
- kui sama label'iga issue on juba avatud, lisatakse sellele kommentaar, mitte uus issue
- issue'sse ei kirjutata ühtegi secret'it ega `.env`-faili sisu
- proovi rollback'i katses kasutatud vigase HEALTHCHECK'iga ja võta muudatus seejärel tagasi

**Kontroll:**

```bash
gh issue list --label deploy-rike --json number,title
gh issue view <nr> --json body,comments --jq '.body, (.comments | length)'
```

**Valmis, kui:**

- esimene katkine deploy avas ühe issue, mille sisus on käivituse link ja rollback'i tulemus
- teine katkine deploy lisas sellele kommentaari (`1`)
- rohelise deploy'i logis on teavituse samm *skipped*

??? success "Lahendus"
    Rollback'i sammule tuleb `id: rollback`, et `steps.rollback.outcome` ütleks `success`, `failure` või `skipped`. `gh label create --force` loob label'i või uuendab olemasolevat, seega ei ebaõnnestu `gh issue create` puuduva label'i tõttu. Issue'sse läheb ainult link, commit ja image'i nimi. Logi on lingi taga ja seal kehtib maskeerimine.

    Deploy job'i õigused:

    ```yaml
        permissions:
          contents: read
          packages: read
          issues: write
    ```

    Deploy job'i sammude lõpp:

    ```yaml
          - name: Tagasipööre
            id: rollback
            # tingimus ja sammud nagu enne
          - name: Teata rikkest
            if: failure()
            env:
              GH_TOKEN: ${{ github.token }}
              GH_REPO: ${{ github.repository }}
              ROLLBACK: ${{ steps.rollback.outcome }}
              PREV: ${{ steps.prev.outputs.image }}
            run: |
              url="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
              body=$(printf 'Käivitus: %s\nCommit: %s\nRollback: %s (%s)\n' \
                "$url" "$GITHUB_SHA" "$ROLLBACK" "${PREV:-eelmine puudus}")
              gh label create deploy-rike --color B60205 --description "deploy ebaõnnestus" --force
              nr=$(gh issue list --label deploy-rike --state open --limit 1 --json number --jq '.[0].number // empty')
              if [[ -n "$nr" ]]; then
                gh issue comment "$nr" --body "$body"
              else
                gh issue create --title "Deploy ebaõnnestus: ${GITHUB_SHA::7}" --label deploy-rike --body "$body"
              fi
          - name: Koristus
            if: always()
            run: rm -f .env
    ```

    Kontroll: pärast esimest katkist deploy'd annab `gh issue list --label deploy-rike --json number,title` ühe issue, mille sisus on käivituse link ja `Rollback: success`. Pärast teist on `gh issue view <nr> --json comments --jq '.comments | length'` `1`. Rohelise deploy'i logis on samm „Teata rikkest“ *skipped*.

    **Miks nii.** Üks avatud issue koos kommentaaridega näitab korduvat riket ühes kohas, iga rikke kohta uus issue tekitaks müra, mida keegi ei loe. `if: failure()` käivitub ka siis, kui rollback õnnestus, sest job on ikkagi punane.

## Rasked ülesanded

### 14. Sama WAR app01 VM-ile

**Tase:** raske · **Eeldus:** [Triggerid, saladused ja environment](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-5-saladused/) · **Esita:** `.github/workflows/ci.yml`

Sama pipeline peab sobima ka serverile, kus konteinereid ei kasutata. Sama WAR, mille build job ehitas ja testis, läheb app01 VM-ile Ansible'iga sinu `k02-ansible` playbook'i kaudu. Konteineri deploy jääb muutmata.

- eraldi job `deploy-vm` (`needs: build`), sinu runner'il, environment `proxmox`, oma concurrency-grupp; käivitub ainult main'i push'il ja siis, kui repo muutuja `DEPLOY_VM_ENABLED` on `true`
- VM-ile läheb sama käivituse artefakt, mitte runner'il uuesti ehitatud WAR
- iga commit on VM-il oma failina, nii et tomcat-rolli `rescue` saab eelmise versiooni tagasi panna
- Vaulti parool tuleb environment'i secret'ist faili, mida loeb ainult runner'i kasutaja; fail kustutatakse ka siis, kui käivitus tühistatakse
- job kontrollib, et VM-i `/version` näitab commit'i, ja kirjutab kokkuvõttesse `deploy.fact` järgi VM-i versiooni

**Kontroll:**

```bash
curl -s http://app01:8080/version; echo
ssh kasutaja@app01 'ls /opt/labori-seis/; cat /etc/ansible/facts.d/deploy.fact'
find ~/actions-runner/_work -name 'vault_pass*'
```

**Valmis, kui:**

- `/version` commit võrdub `git rev-parse origin/main`-iga
- `/opt/labori-seis/` all on kahe järjestikuse deploy kohta kaks eri nimega WAR-i ja `deploy.fact` näitab viimast
- `find` on tühi ka pärast käivitust, mille tühistasid playbook'i ajal (`gh run cancel`)

??? tip "Lahenduse suund"
    **Põhiidee.** Ansible'i deploy-osa juba oskab rollback'i (`block`/`rescue`) ja peab meeles viimast töötavat versiooni (`deploy.fact`). Pipeline'i töö on anda sellele õige WAR, unikaalne versiooninimi ja Vaulti parool ning pärast koristada.

    **Mehhanism ja tööriistad.** WAR tuleb sama käivituse artefaktist: `gh run download "$GITHUB_RUN_ID"` (job'il `actions: read`) või `actions/download-artifact` SHA-ga. Playbook on `site.yml --limit app01` koos `-e labseis_version=<sha7>`, `labseis_war_local` ja `labseis_git_sha`. Vaulti fail on `$RUNNER_TEMP`-is `umask 077`-ga ja `ANSIBLE_VAULT_PASSWORD_FILE` näitab sellele. Koristussamm on `if: always()`, mis käivitub ka tühistamisel.

    **Otsus.** `deploy.yml` on mõeldud just deploy'ks (`serial`, kontroll web01 kaudu), aga see ei kirjuta env-faili uuesti, nii et `GIT_SHA` ja `/version` jäävad vanaks. `site.yml` kirjutab env-faili, aga käib läbi terve rolli. Vali ja põhjenda valikut PR-i kirjelduses.

    **Kontroll.** Kokkuvõttes on `/version` commit ja `deploy.fact` sisu. VM-il on WAR-id sha7 nimedega. Tühistatud käivituse logis on koristussamm roheline.

    **Tüüpilised lõksud.** `labseis_version` vaikeväärtusega kirjutab iga deploy sama faili ja `rescue` paneb tagasi sama katkise WAR-i. `${{ runner.temp }}` ei ole job'i `env:`-is lubatud (actionlint ütleb seda), vaid ainult sammu tasemel. Koristussamm `working-directory: k02-ansible`-ga ebaõnnestub, kui checkout ei õnnestunud. `ansible-inventory` ja ad-hoc `ansible` vajavad samuti Vaulti parooli, sest `group_vars/all/vault.yml` dekrüpteeritakse inventory laadimisel. Pärast `rescue`-t jääb env-faili uus `GIT_SHA`: `/version` valetab ja tõene allikas on `deploy.fact`.

### 15. Ühekordne runner

**Tase:** raske · **Eeldus:** [Katkine pipeline](lab-7-katkine-pipeline.md) · **Esita:** `scripts/runner-jit.sh`

Püsiv runner jätab eelmise job'i failid kausta `_work/` ja käivitab järgmise job'i samas keskkonnas. [Just-in-time runner](https://docs.github.com/rest/actions/self-hosted-runners#create-configuration-for-a-just-in-time-runner-for-a-repository) registreeritakse ühe job'i jaoks ja eemaldatakse pärast selle lõppu. Allolev näide töötab, aga ei sobi tootmisse.

```bash
cfg=$(gh api -X POST 'repos/{owner}/{repo}/actions/runners/generate-jitconfig' \
  -f name="labseis-$(date +%s)" -F runner_group_id=1 -f 'labels[]=labseis' -f work_folder=_work \
  --jq .encoded_jit_config)
./run.sh --jitconfig "$cfg"
```

Peata püsiv runner (`sudo ./svc.sh stop`) ja kirjuta `scripts/runner-jit.sh`, mis tsüklis küsib API-st konfiguratsiooni ja käivitab sellega runner'i:

- tsükkel kordub lõputult, töökaust tühjendatakse enne iga käivitust ja skript läbib `shellcheck -S warning`
- püsiva runner'i registreering jääb terveks ja lõpus tuleb see `sudo ./svc.sh start`-iga `online`-olekusse
- konfiguratsiooni (selles on runner'i võti) ei ole protsessi käsureal
- kui runner'i protsess tapetakse keset job'i, eemaldab tsükkel järgmisel ringil GitHubist selle offline-registreeringu, aga ei puutu teiste runner'ite registreeringuid
- tsükkel töötab systemd teenusena ja taastub ise; label'id vastavad deploy job'i `runs-on`-väärtusele

**Kontroll:**

```bash
sha256sum ~/actions-runner/.runner                       # enne ja pärast sama
tr '\0' ' ' < "/proc/$(pgrep -f Runner.Listener | head -1)/cmdline"; echo
gh api "repos/{owner}/{repo}/actions/runs/<id>/jobs" --jq '.jobs[] | select(.name == "deploy") | .runner_name'
gh api 'repos/{owner}/{repo}/actions/runners' --jq '[.runners[] | select(.status == "offline")] | length'
```

**Valmis, kui:**

- kahe järjestikuse deploy job'i `runner_name` on erinev
- käsureal ei ole `jitconfig`-i
- pärast `sudo pkill -9 -f Runner.Listener` keset deploy'd on offline-runner'eid järgmise ringi järel `0`
- `.runner` räsi on muutumata ja püsiv runner on lõpus jälle `online`

??? tip "Lahenduse suund"
    **Põhiidee.** `generate-jitconfig` registreerib runner'i serveri poolel ja annab base64-konfiguratsiooni, mis sisaldab runner'i identiteeti ja RSA-võtit. Selle konfiguratsiooniga runner võtab ühe job'i ja GitHub eemaldab registreeringu. Tsükkel on sinu oma autoscaler, kus on üks töökoht.

    **Mehhanism ja tööriistad.** `gh api` (array-väli kujul `-f 'labels[]=…'`), runner'i tarball eraldi kaustas, `systemd` teenus `Restart=always`-iga, token `EnvironmentFile`-ist. Runner loeb käsurea valikuid ka keskkonnamuutujatest `ACTIONS_RUNNER_INPUT_<VALIK>`.

    **Kontroll.** Kahe deploy job'i `runner_name`, `/proc/<pid>/cmdline`, offline-runner'ite arv pärast `pkill -9`, `.runner` räsi.

    **Tüüpilised lõksud.** `run.sh --jitconfig` püsiva runner'i kaustas kirjutab üle selle `.runner` ja `.credentials` faili ning `svc.sh start` ei too seda runner'it enam tagasi. Käsurea argument on `ps`-is kõigile kohalikele kasutajatele näha. Tapetud runner jätab registreeringu `offline`-olekusse. Koristus peab piirduma oma nimeprefiksiga ja käima enne uue konfiguratsiooni küsimist, muidu kustutad runner'i, mis alles käivitub. `gh auth login` vaikimisi keyring ei tööta systemd teenuses: kasuta fine-grained PAT-i ainult selle repo peale (*Administration: read and write*). Selgita, miks see eraldus on laboris osaline: job töötab `docker` grupis.

### 16. Andmebaasi parooli rotatsioon ilma katkestuseta

**Tase:** raske · **Eeldus:** [Health check ja rollback](lab-6-tagasipoore.md) · **Esita:** `scripts/rotate-db.sh`

Rakenduse andmebaasiparool on päeva algusest environment'i secret'is `DB_PASSWORD` ja seda pole kunagi vahetatud. Rakendus ja andmebaas ei vaheta parooli samal hetkel: üks neist teab vahepeal vana väärtust.

Kirjuta `scripts/rotate-db.sh`, mis teeb rotatsiooni control node'il, ja muuda `compose.yaml`-i ning `ci.yml`-i nii palju, kui selleks vaja:

- rotatsiooni ajal ja pärast seda ei ole app01 logis ühtegi `Access denied` rida
- db01 konteinerit ei looda uuesti (`State.StartedAt` on enne ja pärast sama)
- kuni vana kasutaja pole eemaldatud, töötab see edasi ja tagasiminek on üks käsk; kui deploy ebaõnnestub, taastab skript eelmise versiooni
- uut parooli ei ole Gitis, workflow logis ega ühegi protsessi käsureal; GitHubis on see environment'i secret
- lõpus on vana kasutaja andmebaasist eemaldatud, uuel on täpselt samad õigused ja skripti teine käivitus teeb järgmise rotatsiooni

**Kontroll:**

```bash
db=$(docker ps -q -f label=com.docker.compose.service=db01); docker inspect -f '{{.State.StartedAt}}' "$db"
T0=$(date -Is); bash scripts/rotate-db.sh
docker logs --since "$T0" "$(docker ps -q -f label=com.docker.compose.service=app01)" 2>&1 | grep -c 'Access denied'
docker exec "$db" sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot -N -e "SELECT user FROM mysql.user"'
```

**Valmis, kui:**

- `Access denied` arv on `0` ja db01 `StartedAt` ei muutunud
- kasutajate seas on ainult uus rakenduse kasutaja
- `/version` võrdub `origin/main`-iga
- skripti katkestamine (Ctrl-C) keset tööd jätab rakenduse töötama

??? tip "Lahenduse suund"
    **Põhiidee.** Kaks kasutajat vaheldumisi (näiteks `labseis_a` ja `labseis_b`). Uus kasutaja luuakse vana õigustega enne, kui keegi seda kasutab. Rakendus vahetatakse tavalise deploy'ga. Vana kasutaja eemaldatakse alles siis, kui `information_schema.PROCESSLIST`-is pole ühtegi tema ühendust. Kuni selleni on mõlemad kasutajad kehtivad ja tagasiminek ei vaja andmebaasi muudatust.

    **Mehhanism.** Rakendus loeb `DB_USER` ja `DB_PASSWORD` (`spring.datasource.username=${DB_USER:labseis}`). db01 `MARIADB_USER`/`MARIADB_PASSWORD` mõjuvad ainult tühja volume'i initsialiseerimisel ja hiljem ei muuda midagi. Järjekord: kasutaja, secret, deploy, vana eemaldamine. Kui secret muutub enne kasutaja loomist, ebaõnnestub iga sel ajal käivituv deploy.

    **Tööriistad.** `CREATE OR REPLACE USER`, `SHOW GRANTS` (nimi asendada, `IDENTIFIED BY PASSWORD` eemaldada), `gh secret set --env` stdin'ist, `gh variable set --env`, `gh workflow run ci.yml -f deploy=deploy`, `gh run watch --exit-status`, `docker inspect` app01 keskkonna lugemiseks.

    **Kontroll.** Nõuete all olevad käsud ja skripti katkestus pärast secret'i muutmist: korduskäivitus peab lõpetama sama rotatsiooni.

    **Tüüpilised lõksud.** `compose.yaml`-is loevad db01 ja app01 sama `${DB_PASSWORD}`-i. Kui muudad seda, näeb `docker compose up app01` sõltuvuse db01 konfiguratsiooni muutust ja loob db01 uuesti: see on katkestus ja andmebaasis parool ei muutu. app01 vajab oma muutujaid, mille vaikeväärtus on vana. GitHubi secret'it tagasi lugeda ei saa, nii et tagasiminekuks vajalik vana väärtus tuleb võtta töötavast konteinerist enne vahetust. `mariadb -p<parool>` on `ps`-is näha: kasuta `MYSQL_PWD` keskkonnast. `ALTER USER` sama kasutaja peal katkestab kohe kõik uued ühendused vana parooliga.

### 17. Allkirjastatud image ja deploy, mis allkirja kontrollib

**Tase:** raske · **Eeldus:** [Health check ja rollback](lab-6-tagasipoore.md) · **Esita:** `.github/workflows/ci.yml`, `scripts/verify-image.sh`, `NOTES.md`

Deploy job võtab image'i ghcr.io-st tag'i järgi. Kes saab paketti kirjutada, saab tag'i alla panna teise image'i ja runner paigaldab selle.

Muuda `ci.yml`-i nii, et image'il on allkiri ja SBOM ning deploy paigaldab ainult selle repo main'i workflow allkirjastatud image'i. Kontroll on skriptis `scripts/verify-image.sh <image@sha256:…>`, mida kasutab deploy job ja saad käivitada ka control node'il:

- image'i job allkirjastab digest'i keyless [cosign](https://docs.sigstore.dev/cosign/signing/overview/)'iga ja lisab CycloneDX SBOM-i attestation'ina; PR-i käivitus ei allkirjasta ega lükka midagi
- `id-token: write` on ainult image'i job'il; cosign'i versioon on mõlemas job'is kinnitatud ja action'id on SHA-ga
- deploy kasutab digest'i (`repo@sha256:…`), mitte tag'i; skript kontrollib enne `docker compose pull`-i allkirja ja SBOM-i attestation'it sertifikaadi identiteedi järgi (repo, `ci.yml`, `refs/heads/main`)
- kui kontroll ebaõnnestub, ei puututa töötavat konteinerit ja job on punane
- `NOTES.md`: kas rollback kontrollib eelmise image'i allkirja ja mis juhtub esimesel deploy'l, kui töötav image on allkirjata

**Kontroll:**

```bash
cd k03-docker && ref=$(docker inspect -f '{{.Config.Image}}' "$(docker compose ps -q app01)"); echo "$ref"
REPO=<owner>/<repo> bash ../scripts/verify-image.sh "$ref"; echo $?
REPO=<owner>/<repo> bash ../scripts/verify-image.sh "ghcr.io/<owner>/<repo>@sha256:<k05-actions harul ehitatud digest>"; echo $?
printf 'FROM %s\nLABEL proov=allkirjata\n' "$ref" | docker build -t "ghcr.io/<owner>/<repo>:allkirjata" - && docker push "ghcr.io/<owner>/<repo>:allkirjata"
```

**Valmis, kui:**

- töötava app01 image on kujul `…@sha256:…`, skript annab sellele `0` ja SBOM-i komponentide arvu
- harul `k05-actions` ehitatud allkirjastatud image annab `1`
- käsitsi lükatud allkirjata image annab `1`
- pärast katseid näitab `/version` endiselt main'i commit'i

??? tip "Lahenduse suund"
    **Põhiidee.** Allkiri seob digest'i identiteediga: milline repo, workflow ja haru image'i tootis. Tag'i saab ümber suunata, digest'i mitte, nii et allkiri, attestation ja deploy kasutavad kõik sama `repo@sha256:…` viidet.

    **Mehhanism ja tööriistad.** `docker/build-push-action` väljund `digest` image'i job'i `outputs`-i. `sigstore/cosign-installer` kinnitatud `cosign-release`-iga. SBOM sama `trivy-action`-iga (`scan-type: image`, `format: cyclonedx`, privaatse paketi jaoks `TRIVY_USERNAME`/`TRIVY_PASSWORD`). `cosign sign --yes` ja `cosign attest --yes --type cyclonedx --predicate`. Skriptis `cosign verify` ja `cosign verify-attestation` sama `--certificate-identity` ja `--certificate-oidc-issuer https://token.actions.githubusercontent.com`-iga.

    **Kontroll.** Nõuete all olevad käsud. Käivituse kokkuvõttes on allkirjastatud digest ja deploy logis on kontrollisamm enne `Praegune image` sammu.

    **Tüüpilised lõksud.** `--certificate-identity-regexp` laia mustriga (`.*`) laseb läbi iga haru ja iga repo image'i. Kontroll pärast `pull`-i on hilja, kui sama samm teeb ka `up`-i. `id-token: write` workflow tasemel annab OIDC tokeni ka deploy job'ile. Kuna haru `k05-actions` push lükkab ja allkirjastab image'i, ei tõenda allkiri üksi midagi, kui identiteedis pole haru. Esimesel deploy'l on `prev` tag'iga viide ilma allkirjata: range rollback'i kontroll jätaks teenuse seisma.

    **Miks nii.** Cosign'i versioon on kinnitatud mõlemas job'is, sest allkirjastaja ja kontrollija peavad mõistma sama allkirja- ja attestation'i vormingut.

### Lisaprojekt: korduvkasutatav deploy-workflow

**Tase:** raske · **Eeldus:** [Health check ja rollback](lab-6-tagasipoore.md): deploy job'il on samm `prev`, action `verify-deploy` ja rollback ning main'i deploy õnnestub · **Esita:** `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`

Deploy job on `ci.yml`-i sees ja smoke test, teine repo või käsitsi taastamise workflow ei saa seda kasutada. Composite action jagab samme, korduvkasutatav workflow jagab tervet job'i koos runner'i, environment'i ja õigustega.

Tee töö harus `lisa-reusable` ([korduvkasutatavate workflow'de juhend](https://docs.github.com/actions/sharing-automations/reusing-workflows)). Kõik deploy job'i sammud lähevad faili `.github/workflows/deploy.yml`. `ci.yml`-i deploy job jääb alles, aga ainult kutsub uut workflow'd:

| Koht | Nõue |
|---|---|
| `deploy.yml` päis | `on: workflow_call` sisenditega `image-ref` ja `expected-sha` (`type: string`, `required: true`) |
| `deploy.yml` job | `runs-on: [self-hosted, linux, labseis]`, `environment: proxmox`, `concurrency`-grupp `deploy-proxmox`, `timeout-minutes`, `permissions` `contents: read` ja `packages: read` |
| `deploy.yml` sammud | kõik senised: login, `.env`, `prev`, deploy (`APP_IMAGE` sisendist), `verify-deploy` (`expected-sha` sisendist, `version-url`), rollback, koristus |
| `ci.yml` deploy job | sama `needs` ja `if`, `uses: ./.github/workflows/deploy.yml`, `with:` `image-ref: ${{ needs.image.outputs.ref }}` ja `expected-sha: ${{ github.sha }}`, `secrets: inherit`, `permissions` nagu enne |
| rollback | katkise HEALTHCHECK'iga versioon teeb kutsutud workflow's rollback'i nagu enne |
| õiguste ülempiir | kutsuja `permissions: {}` korral ebaõnnestub ghcr.io login, kuigi `deploy.yml` küsib `packages: read` |
| automaatne hindaja | `actionlint` ja `k05 deploy` annavad endiselt `OK` |

**Kontroll:**

```bash
actionlint; echo $?
bash autograde/check.sh k05 deploy
gh pr create --fill --base main && gh pr checks --watch && gh pr merge --merge
gh run watch
```

**Valmis, kui:**

- `actionlint` annab `0` ja `k05 deploy` annab `OK`
- main'i käivituse graafis on `deploy / deploy`, see on õnnestunud ja `/version` võrdub `origin/main`-iga
- katkise HEALTHCHECK'iga versioon tegi kutsutud workflow's rollback'i
- õiguste ülempiiri katse logis on login'i samm punane teatega `denied` või `unauthorized`

??? tip "Lahenduse suund"
    **Põhiidee.** Kutsuv job on ainult viide: `needs`, `if`, `uses`, `with`, `secrets` ja `permissions`. Kõik, mis puudutab masinat ja saladusi (`runs-on`, `environment`, `concurrency`, sammud), on kutsutud job'is.

    **Mehhanism.** Kutsutud workflow töötab kutsuja kontekstis: `github.sha`, `github.ref`, `github.actor` ja `vars` on samad. `environment: proxmox` kutsutud job'is laadib environment'i secret'id. `secrets: inherit` annab edasi ainult repo ja organisatsiooni omad. Kutsuja `permissions:` on ülempiir, kutsutud workflow saab õigusi ainult vähendada.

    **Kontroll.** Graafis on `deploy / deploy`, `k05 deploy` on `OK` (kontroll loeb kõiki workflow faile koos), rollback'i ja õiguste katse annavad oodatud punase sammu.

    **Tüüpilised lõksud.** `concurrency` kutsuja tasemel kaitseb ainult `ci.yml`-i, mitte teisi kutsujaid. `uses: ./.github/actions/verify-deploy` laheneb checkout'i järgi: ilma checkout'ita kutsutud job'is action'it ei leita. Sisendi nimi `with:` all ja `inputs:` all peab olema täpselt sama, actionlint kontrollib seda ka kohaliku kutsutud workflow puhul. `environment` kutsuva job'i juures on süntaksiviga.

    **Miks nii.** Kuigi kontekst on sama, tuleb sisendid anda selgesõnaliselt, sest teises repos kutsuva job'i väljundid ei ole kättesaadavad. Environment'i secret'eid ei saa kutsujast edasi anda, sest `workflow_call` ei tunne `environment`-võtit: kutsutud job loeb need ise. Kui kutsuv job määraks `permissions: {}`, ei saaks deploy registry'st image'it alla laadida, ja see ongi õiguste ülempiiri katse. Sama mudel kehtib teise repo workflow kohta (`uses: org/repo/.github/workflows/deploy.yml@<sha>`) ja siis kehtib SHA-ga kinnitamise reegel ka sinu enda workflow'dele.

    Graafis kuvatava nime `deploy / deploy` esimene osa on kutsuva job'i nimi ja teine osa kutsutud workflow job'i nimi. Järgmine loogiline samm oleks `workflow_dispatch`-workflow, mis kutsub sama faili vana image'iga: käsitsi rollback ilma uue koodita.

## Võrguinsenerile

Selle päeva töö ei vaja ruutereid: testid kasutavad võlts-ühendust ja GitHubi runner ei jõua sinu võrku.

### 18. vorgukogu testid ja CI

**Tase:** keskmine · **Eeldus:** [Esimene workflow](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-2-workflow/), 1. kohtumise lisaülesanne 21 ja [4. kohtumise lisaülesanne 17](https://hkhk-tk.github.io/is2-automatiseerimine/k04/lisa/#17-renderpy-soovitud-seis-templateist-diff-ja-apply) (`vorgukogu.py`, `render.py`, `intent/`, `templates/`) · **Esita:** `vorgukogu/`, `.github/workflows/vorgukogu.yml`

Kolleeg lisab maskeerimisse uue rea ja murrab kogemata olemasoleva, või template kaotab `key chain` ploki. Ruuter seda ei ütle ja viga märkab alles see, kes varukoopiat loeb.

- `vorgukogu/tests/`: [pytest](https://docs.pytest.org/)-testid ilma võrguta; `main(argv, env, connect)` saab ühenduse argumendina; võlts-ühenduse `send_command` tagastab FRR-i väljundi kujul teksti
- testid katavad: saladuse ridade mask (`key-string`, `password`, `neighbor … password`), muud read ei muutu; poolik või võõra ruuteri väljund lükatakse tagasi; kättesaamatu seade annab koodi 2, teised kogutakse; puuduv `VORK_USER` annab koodi 1; template renderdab mõlema ruuteri intent'i, vigane aadress on viga, diff ei sisalda saladust
- `vorgukogu/pyproject.toml` [ruff](https://docs.astral.sh/ruff/)-i reeglitega `E`, `W`, `F`, `I`, `B`, `UP`; `requirements-dev.txt` (`-r requirements.txt`, `pytest`, `ruff` kinnitatud versioonidega)
- `.github/workflows/vorgukogu.yml`: PR-il ja `main`-i push'il, kui muutub `vorgukogu/**`; `ubuntu-24.04`, `permissions: contents: read`, `timeout-minutes`; sammud `ruff check`, `ruff format --check`, `pytest` ja `render.py` ilma saladuseta; ükski samm ei kasuta secret'it ega ühendu ruuteriga

**Kontroll:**

```bash
cd ~/labori-seis/vorgukogu && . .venv/bin/activate
pip install -r requirements-dev.txt && ruff check . && ruff format --check . && pytest -q
actionlint ../.github/workflows/vorgukogu.yml
git switch -c vork-maski-viga
sed -i '/key-string/d' vorgukogu.py && git commit -qam "proov: key-string mask maha" && git push -u origin HEAD
gh pr create --fill && sleep 60 && gh pr checks
```

**Valmis, kui:**

- kohapeal läheb läbi vähemalt 10 testi ja `actionlint` on vaikne
- proov-PR-i kontroll on punane ja logis on ebaõnnestunud testi nimi (`test_mask_keeps_command_hides_value` või sinu vaste)
- parandatud PR on roheline
- `grep -c 'secrets\.' ../.github/workflows/vorgukogu.yml` annab `0`
- proov-PR on suletud ja haru kustutatud

??? success "Lahendus"
    `conftest.py` lisab testidele `vorgukogu/` kausta `sys.path`-i ja paneb asemele tühja `netmiko` mooduli ainult siis, kui Netmiko teeki pole: CI paigaldab Netmiko, kohalik kiire proov töötab ka ilma. Võlts-ühendus on tavaline klass: `__enter__`/`__exit__` `with`-i jaoks ja `send_command`, mis tagastab teksti host'i järgi; aadress `10.0.0.99` annab `TimeoutError`-i nagu maas olev ruuter. `test_diff_apply_flow` kontrollib 4. kohtumise tsükli: diff leiab erinevuse (kood 3), `--apply` muudab võlts-ruuteri olekut ja teine diff on tühi. `paths`-filtriga workflow ei käivitu PR-il, mis `vorgukogu/`-d ei puuduta: kui lisad `vorgukogu` kontrolli ruleset'is nõutud kontrollide hulka, jääb selline PR ootama.

    ```python
    """Testid ei vaja ruuterit ega võrku: ConnectHandler asendatakse võltsiga.

    Kui netmiko pole paigaldatud (nt kiire kohalik proov), paneb see fail asemele tühja mooduli,
    et `import vorgukogu` õnnestuks. CI-s on tegelik netmiko requirements.txt-ist.
    """

    import sys
    import types
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

    try:
        import netmiko  # noqa: F401
    except ImportError:
        stub = types.ModuleType("netmiko")

        def _no_network(**kwargs):
            raise RuntimeError("testis pole tegelikku ühendust")

        stub.ConnectHandler = _no_network
        sys.modules["netmiko"] = stub
    ```

    ```python
    import pytest

    import vorgukogu

    RUNNING = """Building configuration...

    Current configuration:
    !
    frr version 10.4.1
    frr defaults traditional
    hostname {host}
    log syslog informational
    service integrated-vtysh-config
    !
    ip route 10.255.255.2/32 10.10.7.22
    !
    interface lo
     ip address 10.255.255.1/32
    exit
    !
    key chain lab
     key 1
      key-string TegelikSaladus123
     exit
    exit
    !
    end
    """

    class FakeConnection:
        """Netmiko ühenduse võlts: send_command tagastab FRR-i väljundi kujul teksti."""

        calls = []

        def __init__(self, **params):
            self.params = params
            host = params["host"]
            if host == "10.0.0.99":
                raise TimeoutError("TCP connection to device failed")
            self.name = {"10.10.7.21": "rtr01", "10.10.7.22": "rtr02"}[host]

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def send_command(self, command, read_timeout=None):
            FakeConnection.calls.append(command)
            if "running-config" in command:
                return RUNNING.format(host=self.name)
            return f"{command} väljund {self.name}\n"

    INVENTORY = """
    defaults: {device_type: linux}
    commands: [show version, show interface brief, show running-config]
    devices:
      - {name: rtr01, host: 10.10.7.21}
      - {name: rtr02, host: 10.10.7.22}
    """

    ENV = {"VORK_USER": "kasutaja", "VORK_KEY_FILE": "/dev/null"}

    @pytest.fixture
    def workdir(tmp_path):
        (tmp_path / "inventory.yaml").write_text(INVENTORY)
        (tmp_path / "known_hosts").write_text("")
        return tmp_path

    def run(workdir, *extra, env=ENV):
        argv = ["--inventory", str(workdir / "inventory.yaml"), "--out", str(workdir / "out"), *extra]
        return vorgukogu.main(argv, env=env, connect=FakeConnection)

    def test_mask_keeps_command_hides_value():
        text = " key-string TegelikSaladus123\n password abc\n neighbor 10.0.0.1 password x y\n"
        masked = vorgukogu.mask_secrets(text)
        assert "TegelikSaladus123" not in masked
        assert " key-string ***" in masked
        assert " password ***" in masked
        assert " neighbor 10.0.0.1 password ***" in masked

    def test_mask_leaves_other_lines():
        text = "hostname rtr01\nip route 10.0.0.0/8 blackhole\n"
        assert vorgukogu.mask_secrets(text) == text

    def test_command_for_frr_and_cisco():
        assert vorgukogu.command_for("linux", "show version") == "vtysh -c 'show version'"
        assert vorgukogu.command_for("cisco_ios", "show version") == "show version"

    def test_filename_for():
        assert vorgukogu.filename_for("show running-config") == "show-running-config.txt"
        assert vorgukogu.filename_for("show interface brief") == "show-interface-brief.txt"

    def test_strip_header():
        out = vorgukogu.strip_header(RUNNING.format(host="rtr01"))
        assert out.startswith("frr version")
        assert "Building configuration" not in out

    @pytest.mark.parametrize(
        "text",
        ["", "frr version 10.4.1\nhostname rtr01\n", "frr version 10.4.1\nhostname rtr02\nend\n"],
    )
    def test_check_running_config_rejects_bad_output(text):
        with pytest.raises(ValueError):
            vorgukogu.check_running_config(text, "rtr01")

    def test_credentials_from_env_only():
        with pytest.raises(vorgukogu.ConfigError):
            vorgukogu.credentials({})
        creds = vorgukogu.credentials({"VORK_USER": "kasutaja", "VORK_PASSWORD": "x"})
        assert creds == {"username": "kasutaja", "password": "x"}

    def test_connect_params_strict_host_keys(tmp_path):
        p = vorgukogu.connect_params({"name": "r", "host": "h"}, {"username": "u"}, tmp_path / "kh")
        assert p["ssh_strict"] is True
        assert p["alt_key_file"].endswith("kh")

    def test_collects_all_devices(workdir):
        assert run(workdir) == 0
        files = sorted(p.relative_to(workdir / "out").as_posix() for p in (workdir / "out").rglob("*.txt"))
        assert files == [
            "rtr01/show-interface-brief.txt",
            "rtr01/show-running-config.txt",
            "rtr01/show-version.txt",
            "rtr02/show-interface-brief.txt",
            "rtr02/show-running-config.txt",
            "rtr02/show-version.txt",
        ]
        conf = (workdir / "out/rtr01/show-running-config.txt").read_text()
        assert "TegelikSaladus123" not in conf
        assert conf.startswith("frr version") and conf.rstrip().endswith("end")
        assert "vtysh -c 'show running-config'" in FakeConnection.calls

    def test_unreachable_device_exit_2_others_collected(workdir, capsys):
        inv = workdir / "inventory.yaml"
        inv.write_text(INVENTORY + "  - {name: rtr09, host: 10.0.0.99}\n")
        assert run(workdir) == 2
        assert (workdir / "out/rtr02/show-version.txt").is_file()
        assert not (workdir / "out/rtr09").exists()
        assert "FAIL rtr09" in capsys.readouterr().err

    def test_bad_output_keeps_old_file(workdir, monkeypatch):
        assert run(workdir) == 0
        old = (workdir / "out/rtr01/show-running-config.txt").read_text()
        monkeypatch.setattr(FakeConnection, "send_command", lambda self, c, read_timeout=None: "")
        assert run(workdir, "--only", "rtr01") == 2
        assert (workdir / "out/rtr01/show-running-config.txt").read_text() == old

    def test_config_error_exit_1(workdir):
        assert run(workdir, env={}) == 1
        (workdir / "known_hosts").unlink()
        assert run(workdir) == 1
    ```

    ```python
    from pathlib import Path

    import pytest

    import render
    import vorgukogu

    ROOT = Path(__file__).resolve().parent.parent
    RTR01 = render.load_intent(ROOT / "intent/rtr01.yaml")

    # Ruuteri jooksev konf, mis vastab intent/rtr01.yaml-ile (FRR-i järjekorras, päisega)
    RUNNING_SAME = """Building configuration...

    Current configuration:
    !
    frr version 10.4.1
    frr defaults traditional
    hostname rtr01
    log syslog informational
    service integrated-vtysh-config
    !
    ip route 10.255.99.0/24 blackhole
    ip route 10.255.255.2/32 10.10.7.22
    !
    interface eth0
     description haldus
    exit
    !
    interface lo
     ip address 10.255.255.1/32
    exit
    !
    key chain lab
     key 1
      key-string TegelikSaladus123
     exit
    exit
    !
    end
    """

    def test_render_contains_intent():
        conf = render.render(RTR01, "s3cret")
        assert "hostname rtr01\n" in conf
        assert "ip route 10.255.255.2/32 10.10.7.22\n" in conf
        assert "interface lo\n ip address 10.255.255.1/32\nexit\n" in conf
        assert "  key-string s3cret\n" in conf

    def test_render_both_routers_differ_only_where_intent_differs():
        a = render.render(RTR01, "x").splitlines()
        b = render.render(render.load_intent(ROOT / "intent/rtr02.yaml"), "x").splitlines()
        assert len(a) == len(b)
        assert sum(1 for x, y in zip(a, b, strict=True) if x != y) == 3  # hostname, marsruut, lo

    def test_render_missing_variable_is_error():
        with pytest.raises(Exception, match="hostname"):
            render.render({"interfaces": []}, "x")

    def test_bad_address_rejected(tmp_path):
        f = tmp_path / "r.yaml"
        f.write_text("hostname: r\ninterfaces:\n  - {name: lo, addresses: [10.0.0.300/32]}\n")
        with pytest.raises(ValueError):
            render.load_intent(f)
        f.write_text(
            "hostname: r\ninterfaces: []\nstatic_routes:\n  - {prefix: 10.0.0.1/24, nexthop: blackhole}\n"
        )
        with pytest.raises(ValueError):
            render.load_intent(f)

    def test_no_diff_when_router_matches_intent():
        assert render.config_diff(RUNNING_SAME, render.render(RTR01, "teine-saladus"), "rtr01") == []

    def test_diff_shows_only_new_route_and_no_secret():
        intent = {
            **RTR01,
            "static_routes": [*RTR01["static_routes"], {"prefix": "10.255.98.0/24", "nexthop": "blackhole"}],
        }
        diff = render.config_diff(RUNNING_SAME, render.render(intent, "TegelikSaladus123"), "rtr01")
        changes = [line for line in diff if line[:1] in "+-" and not line.startswith(("+++", "---"))]
        assert changes == ["+ip route 10.255.98.0/24 blackhole"]
        assert not any("TegelikSaladus123" in line for line in diff)

    def test_render_only_writes_masked_build(tmp_path, monkeypatch):
        monkeypatch.chdir(ROOT)
        out = tmp_path / "build"
        rc = render.main(["--build", str(out)], env={"VORK_KEYCHAIN_SECRET": "s3cret"})
        assert rc == 0
        text = (out / "rtr01/frr.conf").read_text()
        assert "s3cret" not in text and f"key-string {vorgukogu.MASK}" in text

    def test_apply_requires_diff_and_secret(monkeypatch):
        monkeypatch.chdir(ROOT)
        with pytest.raises(SystemExit):
            render.main(["--apply"], env={})
        assert render.main(["--diff", "--apply"], env={"VORK_USER": "u", "VORK_PASSWORD": "p"}) == 1

    class FakeRouter:
        """Võlts-ruuter: hoiab jooksvat konfi ja 'rakendab' faili, mis base64-tükkidena saadeti."""

        def __init__(self, **params):
            self.running = RUNNING_SAME
            self.b64 = ""
            self.sent = []

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def send_command(self, command, read_timeout=None, cmd_verify=True):
            import base64

            self.sent.append(command)
            if command.startswith("vtysh -c 'show running-config'"):
                return FakeRouter.state
            if command.startswith("printf %s "):
                self.b64 += command.split()[2]
            if "frr-reload.py --reload" in command:
                FakeRouter.state = base64.b64decode(self.b64).decode() + "end\n"
            return "VORK_42" if "VORK_" in command else ""

    def test_diff_apply_flow(monkeypatch, tmp_path):
        monkeypatch.chdir(ROOT)
        (tmp_path / "kh").write_text("")
        FakeRouter.state = RUNNING_SAME
        env = {"VORK_USER": "u", "VORK_PASSWORD": "p", "VORK_KNOWN_HOSTS": str(tmp_path / "kh")}
        intent_dir = tmp_path / "intent"
        intent_dir.mkdir()
        (intent_dir / "rtr01.yaml").write_text(
            (ROOT / "intent/rtr01.yaml").read_text() + "  - {prefix: 10.255.98.0/24, nexthop: blackhole}\n"
        )
        args = ["--only", "rtr01", "--intent", str(intent_dir), "--build", str(tmp_path / "b"), "--diff"]
        assert render.main(args, env=env, connect=FakeRouter) == 3  # erinevus leitud, midagi ei muudetud
        assert FakeRouter.state == RUNNING_SAME
        assert (
            render.main(
                [*args, "--apply"], env={**env, "VORK_KEYCHAIN_SECRET": "TegelikSaladus123"}, connect=FakeRouter
            )
            == 0
        )
        assert "ip route 10.255.98.0/24 blackhole" in FakeRouter.state
        assert render.main(args, env=env, connect=FakeRouter) == 0  # teine kord: erinevust pole
    ```

    ```toml
    # Ainult tööriistade seadistus: vorgukogu ei ole pakett, mida paigaldatakse.
    [tool.ruff]
    line-length = 110
    target-version = "py312"

    [tool.ruff.lint]
    # E/W stiil, F vead (kasutamata import, nimi puudu), I importide järjekord, B tüüpilised lõksud, UP vana süntaks
    select = ["E", "W", "F", "I", "B", "UP"]

    [tool.pytest.ini_options]
    testpaths = ["tests"]
    ```

    ```text
    -r requirements.txt
    pytest==9.1.*
    ruff==0.16.*
    ```

    ```yaml
    # vorgukogu kontroll igal PR-il: lint, testid ja malli renderdus. Ruutereid ega saladusi pole vaja.
    name: vorgukogu

    on:
      pull_request:
        paths: ["vorgukogu/**", ".github/workflows/vorgukogu.yml"]
      push:
        branches: [main]
        paths: ["vorgukogu/**", ".github/workflows/vorgukogu.yml"]

    permissions:
      contents: read

    concurrency:
      group: vorgukogu-${{ github.ref }}
      cancel-in-progress: true

    jobs:
      test:
        runs-on: ubuntu-24.04
        timeout-minutes: 10
        defaults:
          run:
            working-directory: vorgukogu
        steps:
          - uses: actions/checkout@v5
            with:
              persist-credentials: false
          - uses: actions/setup-python@v6
            with:
              python-version: "3.12"
              cache: pip
              cache-dependency-path: vorgukogu/requirements*.txt
          - name: Sõltuvused
            run: pip install -r requirements-dev.txt
          - name: Lint
            run: |
              ruff check --output-format=github .
              ruff format --check .
          - name: Testid
            run: pytest -q
          - name: Mallist frr.conf mõlemale ruuterile
            run: python render.py --build "$RUNNER_TEMP/build" && cat "$RUNNER_TEMP"/build/*/frr.conf
    ```

    Kontroll: nõuete all olevad käsud. Täislahendus: `labori-seis/deploy/lisa-lahendused/k05/vork-ci/`. Kontrollitud: 23 testi, `ruff check` ja `ruff format --check` (ruff 0.16, pytest 9.1, Python 3.13, ilma Netmikota), `actionlint` 1.7. Kontrollimata: workflow GitHubis ja Netmiko 4.7 paigaldusega.

    **Miks nii.** Ülesanne jätkab tööriistaga `vorgukogu` (1. kohtumise lisaülesanne 21, [4. kohtumise lisaülesanne 17](https://hkhk-tk.github.io/is2-automatiseerimine/k04/lisa/#17-renderpy-soovitud-seis-templateist-diff-ja-apply)). Testid ja CI püüavad katkise maski või kadunud `key chain` ploki kinni PR-is, enne kui kood ruuterini jõuab.

## Arutelu

Vasta `NOTES.md`-s. Hea vastus kirjeldab, mis juhtuks sinu pipeline'is, mitte üldiselt.

1. **Esimene workflow.** Esimene teadlikult tehtud viga ilmnes enne, kui ükski sinu käsk käivitus. Mida teeb GitHub sammus *Set up job*, et viga avastada, ja mida see tähendab action'i puhul, mis on kustutatud?
2. **Trivy, matrix ja õigused.** `security` job ei vaja `needs:`-võtit. Mis juhtuks kogukestusega, kui lisaksid `needs: build`? Kas `compat` peaks olema image job'i `needs`-loendis?
3. **Triggerid, saladused ja environment.** Leiad vana käivituse logist base64-kujul parooli. Mis järjekorras teed kolm asja: logi kustutamine, parooli vahetamine ja workflow parandamine? Miks just nii?
4. **Health check ja rollback.** Uus versioon lisab andmebaasi veeru ja vana versioon ei oska sellega töötada. Kas automaatne rollback on siis ohutu? Mida peaks deploy tegema enne käsku `docker compose up`?
5. **Katkine pipeline.** Neljast veast üks ei olnud failis. Sinu jälgimisskript leiab selle, kui skript käivitatakse. Kes või mis peaks skripti käivitama ja kuhu peaks tulemus jõudma?

## Kodutöö

AWS-i kodutöö viib sama pipeline'i pilve ajutiste võtmetega, monitooringu kodutöö kontrollib süsteemi ajastatud workflow'ga väljastpoolt. Mõlemad eeldavad, et selle kohtumise Proxmoxi praktikum on lõpuni tehtud.

| Issue | Mis | Juhend |
|---|---|---|
| `K5.K` | AWS: image ECR-i ja deploy kinnitusega | [kodutood/k05-aws.md](../kodutood/k05-aws.md) |
| `K5.M` | Monitooring: kontroll väljastpoolt `schedule`-workflow'ga | [kodutood/monitooring.md](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/monitooring/#5-kohtumine-kontroll-valjast-schedule-workflow) → 5. kohtumine |
