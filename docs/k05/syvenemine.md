---
tags:
  - GitHub Actions
  - CI/CD
  - Praktikum
---

# Süvenemine: GitHub Actions

Need osad jätkavad IS1 praktikumi [Maven ja GitHub Actions](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab/) workflow'd `.github/workflows/ci.yml`. Iga osa alguses on kirjas, millise IS1 osa järel seda teha. Käsud käivitad control node'il repositooriumi juurkaustas harus `k05-actions`, kui sammu juures pole kirjas teisiti. Health check, rollback ja rikete otsimine on eraldi lehtedel [6. Health check ja rollback](lab-6-tagasipoore.md) ja [7. Katkine pipeline](lab-7-katkine-pipeline.md).

??? info "Testitud versioonid ja dokumentatsioon"

    Spring Boot 3.5.16, Java 21 (Temurin) ja compat-matrix'is 25, Maven 3.9 (apt; lisaülesandes 3.9.11), JaCoCo 0.8.15, `actions/checkout@v5`, `actions/setup-java@v5`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `docker/setup-buildx-action@v4`, `docker/login-action@v4`, `docker/build-push-action@v7`, `aquasecurity/trivy-action` v0.36.0, Trivy CLI kursuse VM-i versioon, actionlint 1.7.3, runner ≥ 2.327.1. Osa 3 järel on kõik action'id workflow'des SHA-ga kinnitatud, siin on nende tag.

    Dokumentatsioon: [GitHub Actions](https://docs.github.com/en/actions) · [Maven](https://maven.apache.org/guides/) · [Trivy](https://trivy.dev/docs/latest/) · [actionlint](https://github.com/rhysd/actionlint)

## Osa 1 · Maven lähemalt

Need sammud jätkavad IS1 praktikumi osa [1. Maven](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-1-maven/): tee neid pärast seda, kui `mvn -B verify` on control node'il roheline. Käsud käivitad repositooriumi juurkaustas harus `k05-actions`.

### Loe pom.xml

`pom.xml` on projekti kirjeldus: mis see on, millest sõltub ja kuidas ehitatakse. Siin otsid sealt üles need kohad, mida turvaskänn ja versioonivead hiljem puudutavad.

1. Ava `pom.xml` ([POM-i ülesehitus](https://maven.apache.org/guides/introduction/introduction-to-the-pom.html)) ja leia `groupId`, `artifactId`, `version`, `packaging` ja `<parent>`.
2. Leia `<properties>`-plokist `jacoco.version` ja koht, kus seda kasutatakse (`${jacoco.version}`).
3. Vaata sõltuvusi ja projekti versiooni.

    ```bash
    grep -c '<dependency>' pom.xml
    mvn -B -q dependency:tree -Dincludes=org.springframework:spring-core
    mvn -B -q help:evaluate -Dexpression=project.version -DforceStdout; echo
    ```

4. Leia puust `spring-core` versioon ja pom'ist üks sõltuvus, mille versioon on otse kirjas.

Enamik sõltuvusi on ilma versioonita, sest `spring-boot-starter-parent` määrab need ühe komplektina. See on hea: teegid on omavahel testitud. Aga see tähendab ka, et pom'i lugedes sa versiooni ei näe ja pead küsima Mavenilt (`dependency:tree`, `help:evaluate`). Kui `help:evaluate` annaks muu versiooni kui pom'i `<version>` rida, oleks see kusagilt üle kirjutatud.

**Edasi saad minna, kui** näed, et enamikul `<dependency>` plokkidel pole `<version>`-it, puu näitab `spring-core` versiooni `spring-boot-starter-parent` 3.5.16 kaudu ja `help:evaluate` trükib `1.1.0`.

### WAR ja selle sisu

Build'i tulemus on üks fail. Vaatad selle sisse, et teaksid, mida pipeline hakkab edasi andma. See fail on artefakt ja sinu esimene workflow salvestab sama faili GitHubis.

Kui WAR-i sisu on teada, saad CI vea korral öelda, kas viga on koodis, sõltuvuses või pakkimises.

1. Vaata WAR-i sisu ja suurust.

    ```bash
    unzip -l target/labori-seis.war | head -20
    unzip -l target/labori-seis.war | grep -c 'WEB-INF/lib/'
    ls -lh target/labori-seis.war
    ```

2. Leia pom'ist rida, mis annab failile nime.

> `WEB-INF/lib-provided` on Tomcati teegid, mida app01 Tomcat ise pakub. Need teevad WAR-i ka iseseisvalt käivitatavaks.

WAR on ZIP-fail kindla kaustastruktuuriga. Kümned teegid `WEB-INF/lib` all selgitavad, miks fail on mitukümmend megabaiti, kuigi meie oma kood on väike. Fikseeritud nimi on oluline, sest workflow ja Dockerfile otsivad faili nime järgi. Kui nimi sisaldaks versiooni, peaks iga versiooni tõstmise järel muutma ka pipeline'i.

**Edasi saad minna, kui** tead, et nimi tuleb reast `<finalName>`, `WEB-INF/classes` on meie kood ja `WEB-INF/lib` sõltuvused ning tead WAR-i suurust.

### Ennusta ja proovi: plugin ja checkstyle

Nüüd tekitad kaks viga, mis tulevad CI-s ette: plugina versioon, mis ei sobi JDK-ga, ja stiiliviga, mis ei ole testiviga. Enne iga käivitust ennusta tulemust.

Plugina viga tuleb tavaliselt siis, kui keegi uuendab runner'i JDK-d ja pom'i ei kohandata. Ennustus enne käivitust on harjutus: kui see läheb mööda, on sinu pilt sellest, mida Maven teeb, vale.

**Ennusta:** kas vana JaCoCo ebaõnnestub testide ajal või hiljem? Ja kas kasutamata import peatab testid?

1. Anna `jacoco.version` käsurealt, faili muutmata.

    ```bash
    mvn -B verify -Djacoco.version=0.8.8
    ```

2. Lisa `src/test/java/ee/hkhk/laboriseis/TokenServiceTest.java` algusesse kasutamata import `import java.util.List;` ja käivita `mvn -B verify`.
3. Taasta ja kontrolli.

    ```bash
    git restore src/
    git status --short
    ```

4. Leia logist vea rida, mis nimetab major version'it.

Major version 65 on Java 21 klassifaili number. JaCoCo 0.8.8 loeb klassifaile, et katvust mõõta, ega tunne seda numbrit. Seega ebaõnnestub ta aruande koostamisel, mitte testide ajal. Checkstyle'i puhul läksid testid läbi ja build ebaõnnestus ikka. Punane CI ei tähenda alati katkist koodi: loe logist, mis plugin ebaõnnestus, enne kui hakkad koodi parandama.

**Edasi saad minna, kui** JaCoCo 0.8.8 nurjas `jacoco:report`-i põhjusega `Unsupported class file major version 65`, checkstyle nurjas build'i teatega `Unused import - java.util.List` (testid läksid läbi) ja `git status` on puhas.

### Mälu otsas ja AI kui abiline

Simuleerid väikese mäluga masinat ja küsid AI-lt abi nii, nagu teeksid seda tööl. Tööl tekib see viga 1 GB mäluga VM-il või konteineris. AI vastus on täpselt nii hea kui kontekst, mille talle annad.

Mäluviga tuleb tihti siis, kui runner või build-konteiner on liiga väike või kui mitu build'i töötab korraga. JVM arvestab vaikimisi heap'i laeks veerandi mälust, mida ta näeb, konteineris cgroup'i limiidist.

1. Simuleeri väikese mäluga masinat.

    ```bash
    MAVEN_OPTS=-Xmx24m mvn -B package -DskipTests
    ```

2. Kopeeri AI-le vea rida koos `mvn -v` väljundi ja käsuga, mille käivitasid, ning küsi põhjust. `.env`-i, tokeneid ega `~/k03.env` sisu AI-le ei anta.
3. Kontrolli vastust ise.

    ```bash
    MAVEN_OPTS=-Xmx512m mvn -B -q package -DskipTests; echo $?
    ```

4. Võrdle AI soovitust tulemusega: kas see oli õige?

`Java heap space` tähendab, et JVM-ile antud mälu sai otsa, mitte masina mälu. `free -m` võib näidata palju vaba mälu ja viga tuleb ikka, sest `-Xmx` paneb lae. Kui AI soovitas "lisa masinale mälu", vastas ta valele küsimusele. Õige parandus on JVM-i lagi ja seda saad kontrollida ühe käsuga.

**Edasi saad minna, kui** 24 MB-ga ebaõnnestus build `java.lang.OutOfMemoryError: Java heap space` ja 512 MB-ga andis `0`.

### Teine JDK kõrvale

Paigaldad teise JDK ja vaatad, kumba Maven valib. Kui `JAVA_HOME` on seatud, võtab Maven JDK sealt. Mitme JDK-ga masinas tekib segadus kõige sagedamini just siin. Sama küsimust küsib hiljem pipeline'i matrix igal push'il.

Tootmises juhtub see siis, kui keegi paigaldab serverisse teise rakenduse jaoks vanema Java ja ühine `JAVA_HOME` hakkab osutama sellele. Järgmine build ebaõnnestub, kuigi keegi koodi ei muutnud.

1. Paigalda JDK 17 ja vaata, millised Java'd on masinas.

    ```bash
    sudo apt-get install -y openjdk-17-jdk-headless
    update-alternatives --list java
    ```

2. **Ennusta:** kas build JDK 17-ga õnnestub ja mida näitab pärast seda `java -version`? Siis käivita.

    ```bash
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 mvn -B -q compile
    java -version
    ```

3. `sudo update-alternatives --config java` muudaks vaikimisi JDK-d kogu masinas, seda täna ei tee.

JDK 17 kompilaator ei oska toota Java 21 klassifaile, seepärast ebaõnnestub juba `compile`. `java -version` näitab samal ajal 21, sest muutuja kehtis ainult sellele ühele käsule. Sama mehhanismi kasutab setup-java CI-s: ta seab `JAVA_HOME`-i, mitte süsteemi vaikimisi Java't. Kui build oleks JDK 17-ga läbi läinud, oleks pom'i Java versiooni seade vale.

**Edasi saad minna, kui** kompileerimine ebaõnnestus `release version 21 not supported`, `java -version` näitab endiselt 21 ning `mvn -B verify; echo $?` annab `0`.

### Värske kloon ja build ilma võrguta

Lõpuks kontrollid kahte asja, mida CI runner sinu eest kunagi ei tee: kas build sõltub ainult Gitis olevatest failidest ja kas kõik vajalik on juba kohalikus hoidlas. Runner saab ainult commit'itud faile. Kui build vajab midagi, mis on ainult sinu töökaustas, ebaõnnestub see GitHubis ja sinu masinas mitte.

Selline viga on tüütu, sest näeb välja nagu CI probleem. Tegelikult on fail lihtsalt `.gitignore`-is või commit'imata.

1. Klooni repo ajutisse kausta ja ehita seal.

    ```bash
    git clone -q . /tmp/k05-puhas
    (cd /tmp/k05-puhas && mvn -B -q verify; echo "kloon $?")
    rm -rf /tmp/k05-puhas
    ```

2. Ehita oma kaustas ilma võrguta (`-o`, offline): Maven ei tohi midagi alla laadida.

    ```bash
    mvn -B -o -q verify; echo "offline $?"
    ```

Kui kloon on roheline, on build korratav: kõik vajalik on Gitis. Kui kloon ebaõnnestuks ja sinu kaust mitte, oleks vahe täpselt see fail, mis on sinu kaustas, aga mitte Gitis (`git status --ignored` näitaks seda). Roheline offline-build tõestab, et kõik pluginad ja teegid on `~/.m2` all. Just selle kausta salvestab workflow'i `cache: maven` runner'i jaoks.

**Edasi saad minna, kui** mõlemad käsud andsid `0` ja `/tmp/k05-puhas` on kustutatud.

### Miks see nii töötab

??? info "Ava selgitused"

    **Parent ja versioonid.** Sõltuvuste versioonid määrab enamasti parent-pom (`spring-boot-starter-parent`). Kui Trivy leiab teegist CVE, näitab `dependency:tree`, kas versioon tuleb meie pom'ist või parent'ist. Selle järgi selgub, kas parandus on üks rida `<properties>`-plokis või parent'i uuendus. Versioonikonflikti lahendab Maven reegliga „lähim võidab“: kui sama teek on puus kahel sügavusel, võetakse madalam, mitte uuem. Uue otsese sõltuvuse lisamine võib seega transitiivse versiooni vaikselt alla viia. `maven-enforcer-plugin`-i reegel `dependencyConvergence` teeb sellise lahknevuse build'i veaks. [Spring Boot 3.5.16](https://spring.io/blog/2026/06/25/spring-boot-3-5-16-available-now/) on 3.x viimane OSS-väljalase ja Boot 4 vajab Tomcat 11-t, seega Trivy leide tuleb juurde ka siis, kui koodi keegi ei muuda.

    **Kohalik hoidla.** Kohalik hoidla `~/.m2/repository` on Maveni vahemälu. Release-versioon laaditakse sinna üks kord, sest Maven Centralis on see muutumatu. `-SNAPSHOT` sõltuvust kontrollib Maven vaikimisi kord päevas uuesti (`updatePolicy daily`), seega võib sama pom anda eri päevadel eri build'i.

    **Värske kloon ja võrguühenduseta build.** Kui mõlemad õnnestuvad, sõltub build runner'il ainult kahest asjast: Gitist ja võrguühendusest Maven Centralisse.

    **Mitu Maveni versiooni.** Maven on Java programm kaustas ja kaks versiooni ei sega teineteist. Mõlemad kasutavad sama hoidlat `~/.m2`, seega teisel korral midagi uuesti alla ei laadita. Kui build õnnestuks ühe versiooniga ja ebaõnnestuks teisega, oleks pom'is plugin, mis sõltub Maveni versioonist. Just sellisel juhul on vaja Maven Wrapper'it, mis paneb versiooni repo sisse.

    **Vahemälu CI-s.** GitHubi hallatud runner on iga job'i alguses tühi masin ja ilma `cache: maven`-ita laaditakse igal käivitusel kogu hoidla uuesti Maven Centralist. Tühja ja täis hoidlaga build'i ajavahe korda push'ide arv päevas näitab, miks vahemälu on aeglase pipeline'i puhul esimene asi, mida kontrollida. Sama kehtib Maven Centrali koormuse kohta: tuhanded tühja hoidlaga build'id päevas on üks põhjus, miks suuremad organisatsioonid kasutavad vahendajana oma hoidlat (Nexus, 6. kohtumine).

## Osa 2 · Workflow lähemalt

Need sammud jätkavad IS1 praktikumi osa [2. Esimene workflow](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-2-workflow/): tee neid pärast seda, kui job `build` on PR-il roheline ja WAR on artefaktina salvestatud. Kaks esimest etappi on IS1 sammude pikem variant: IS1-s tehti neist ainult esimene viga ja actionlint'i paigaldus.

### Tee see teadlikult katki: kaks viga

Teed kaks viga, mis nurjavad käivituse eri kohas. AI või vana blogipostitus soovitab versiooni, mida pole, ja käsk, mis sinu masinas on aliasega olemas, puudub runner'il. Kui tunned vea koha järgi ära, ei loe sa logi otsast lõpuni.

**Ennusta:** kumb viga peatab käivituse enne, kui ükski sinu käsk käivitub?

1. Muuda `actions/checkout@v5` → `actions/checkout@v99`, tee push ja oota punast käivitust.
2. Paranda tagasi. Muuda Maveni sammus `mvn` → `maven`, tee push ja oota punast käivitust.
3. Paranda tagasi ja tee push.
4. Leia mõlema punase käivituse esimene punane samm.

Esimene viga tuli enne, kui ükski sinu käsk käivitus. GitHub laadib *Set up job* sammus kõik action'id alla ja olematu versioon katkestab job'i kohe. Teine viga tuli sinu sammus koodiga 127: Maven ei käivitunud üldse. Kood 1 oleks tähendanud, et Maven käivitus ja ebaõnnestus ise.

**Edasi saad minna, kui** esimene käivitus ebaõnnestus juba *Set up job* sammus (`Unable to resolve action actions/checkout@v99`), teine Maveni sammus (`maven: command not found`, `exit code 127`) ja viimane käivitus on jälle roheline.

### YAML-viga: actionlint ja GitHub

Nüüd teed vea, mida GitHub ei oska üldse käivitada: katkise YAML-i. GitHubi käivituses pole sel juhul logi ega sammu, ainult üks rida. [actionlint](https://github.com/rhysd/actionlint) leiab sama vea enne push'i ja automaatne hindaja käivitab sama tööriista.

Linter enne push'i hoiab kokku ühe ringi: push, ootamine, punane, parandus. Meeskonnas tähendab katkine workflow main'is, et kellegi PR ei saa enam ühtegi kontrolli.

1. Paigalda actionlint ja käivita see repo juurkaustas.

    ```bash
    curl -fsSL https://github.com/rhysd/actionlint/releases/download/v1.7.3/actionlint_1.7.3_linux_amd64.tar.gz \
      | tar -xz -C ~/.local/bin actionlint
    actionlint; echo $?
    ```

2. Lükka üks rida `steps:` all kahe tühiku võrra valesse kohta ja käivita `actionlint` uuesti.
3. Push'i see katkine fail üks kord ja vaata *Actions* vahekaarti.
4. Taasta fail, tee push ja kontrolli.

    ```bash
    actionlint; echo $?
    bash autograde/check.sh k05 actionlint
    ```

actionlint andis rea ja veeru, GitHub ainult teate, et fail on vigane. Sellest järeldad: YAML-vea korral ei aita GitHubi logi, aitab ainult lokaalne kontroll. actionlint kontrollib ka seda, mida YAML-i parser ei näe, näiteks olematuid sisendeid ja vigaseid `${{ }}` avaldisi. Kui actionlint annab `0`, aga GitHub ütleb ikka `Invalid workflow file`, on actionlint'i versioon vanem kui süntaks, mida kasutad.

**Edasi saad minna, kui** taandeveaga failil näitas actionlint rea ja veeru, GitHubis oli punane käivitus ilma job'ita teatega `Invalid workflow file` ja nüüd annab `check.sh k05 actionlint` `OK`.

### Teavitus, kui midagi ebaõnnestub

Lisad sammu, mis käivitub ainult siis, kui eelmine ebaõnnestus. `success()` on iga sammu vaikimisi tingimus, `failure()` ja `always()` muudavad seda. Job summary töötab ilma välise teenuseta.

Punane rist ilma selgituseta tähendab, et iga kord peab keegi logi avama. Lühike teade kokkuvõttes ütleb kohe, kust otsida, ja sama mustrit kasutad hiljem rollback'i teates.

1. Lisa build job'i lõppu samm `if: failure()`, mis kirjutab `$GITHUB_STEP_SUMMARY`-sse rea `### Build kukkus` ja väljastab `echo "::error::..."`.
2. Tee üks test katki (nt `ResultControllerTest`-is `isAccepted()` → `isOk()`) ja tee push.
3. Vaata käivituse lehte ja kokkuvõtet, siis võta katkine commit tagasi.

    ```bash
    gh run view --log-failed | tail -20
    git revert --no-edit HEAD && git push
    ```

Teavitus käivitus, kuigi Maveni samm ebaõnnestus, sest `failure()` tühistas vaikimisi tingimuse. Upload-samm jäi vahele, sest selle tingimus on endiselt `success()`. `::error::` rida tõusis käivituse lehe ülaossa annotatsiooniks: nii näeb viga ka see, kes logi ei ava. `--log-failed` näitab ainult ebaõnnestunud sammu logi, mis on pika käivituse puhul kiireim tee põhjuseni.

**Edasi saad minna, kui** punase käivituse kokkuvõttes on sinu teade, käivituse lehe ülaosas on annotatsioon ja pärast taastamist on käivitus jälle roheline.

### Käivitus numbritena: kus aeg kulub

Lõpuks loed käivituse API-st nagu monitooringu andmeid: iga sammu kestuse sekundites. Nii näed, kas aeg läheb Maveni peale, allalaadimiste peale või GitHubi enda sammude peale.

Kui pipeline muutub aeglaseks, peab otsus "mida kiirendada" tuginema numbritele, mitte tundele. Runner'i minutid maksavad ja arendaja ootab iga minuti. Samad numbrid annavad ka job'i ajapiiri: vaikimisi on `timeout-minutes` 360 ja rippuv test (näiteks ühendus, mis ootab vastust lõputult) hoiab PR-i kontrolli kuus tundi kollasena, kulutab runner'i minuteid ja keegi ei saa merge'ida.

1. Loe viimase rohelise käivituse sammude kestus.

    ```bash
    run=$(gh run list -w ci -s success -L 1 --json databaseId --jq '.[0].databaseId')
    gh run view "$run" --json jobs \
      --jq '.jobs[].steps[] | [((.completedAt|fromdate)-(.startedAt|fromdate)), .name] | @tsv'
    ```

2. Võrdle Maveni sammu aega control node'iga: `time mvn -B -q verify`
3. Leia kolm kõige aeglasemat sammu ja võrdle nende kestust control node'i ajaga.
4. Pane build job'ile ajapiir mõõtmise, mitte arvamise järgi:
    - loe samamoodi kuni kümne viimase rohelise käivituse build job'i kogukestus (`gh run list -L 10`, siis `gh run view --json jobs`, job'i `startedAt` ja `completedAt`)
    - `timeout-minutes` on umbes kolm korda pikim kestus, täisminutiteks üles ümardatud, aga vähemalt 5
5. Proovi, et piir töötab: pane ajutiselt `timeout-minutes: 1` ja build job'i lõppu samm `run: sleep 120`, tee push ja vaata, kuidas job lõpeb. Siis taasta oma arvutatud väärtus ja eemalda samm.

    ```bash
    gh run watch; gh run view --log | grep -m1 'maximum execution time'
    ```

Tavaliselt on Maveni samm kõige pikem ja setup-java teine, sest see taastab vahemälu. Kui Maveni samm on runner'il palju aeglasem kui sinu masinas, laadib Maven tõenäoliselt teeke alla: vahemälu ei tööta, ja seda kontrollid, kui lisad matrix'i. Kui *Set up job* võtab kaua, ootad GitHubi runner'it, ja seda sina parandada ei saa. Ajapiiri ületanud job katkestatakse samamoodi nagu käsitsi tühistamine: töötavale sammule saadetakse signaal ja tulemus on `cancelled`, mitte `failure`. Seepärast ei käivitu pärast seda ka `if: failure()` samm, ja see on oluline, kui hiljem kirjutad rollback'i. Kolmekordne varu arvestab Maven Centrali aeglast päeva ja tühja vahemälu, aga rippuv test ei hoia runner'it kauem kui mõni minut.

**Edasi saad minna, kui** `timeout-minutes` põhineb mõõdetud kestusel, proovikäivituse logis on rida `maximum execution time` ja viimane käivitus on jälle roheline arvutatud piiriga.

### Miks see nii töötab

??? info "Ava selgitused"

    **`run:` ja `bash -e`.** Ilma `shell:` võtmeta käivitab runner `run:` ploki kujul `bash -e {0}`. Esimene ebaõnnestunud käsk lõpetab sammu, aga `pipefail` pole sees: `mvn -B verify | tee build.log` on roheline ka siis, kui Maven ebaõnnestub. Selgesõnaline `shell: bash` annab `bash --noprofile --norc -eo pipefail {0}`.

    **Workflow harus.** Seetõttu saab harus workflow'd muuta ilma main'i puudutamata. Samal põhjusel on see ka turvaküsimus: `push`- ja `pull_request`-sündmuse korral loeb GitHub faili haru enda commit'ist, nii et inimene, kes saab haru luua, saab muuta ka seda, mida runner käivitab. `pull_request_target` loeb faili sihtharust ja käitub selles mõttes teisiti.

    **Sammude kestus.** Sammude kestus, mille esimese workflow juures API-st lugesid, on samasugune näitaja, mida monitooringus vaataksid teenuse kohta. Kui keskmine kestus hakkab kasvama, viitab see sageli vahemälu- või sõltuvusprobleemile juba enne, kui keegi aeglust märkab.

    **Annotated tag ja SHA.** Annotated tag on Gitis eraldi objekt, millel on oma SHA. Rida `^{}` näitab commit'i, millele tag viitab, ja `uses:` vajab just commit'i SHA-d.

    **Madal kloon.** `actions/checkout` laadib vaikimisi (`fetch-depth: 1`) ainult ühe commit'i, sest suure repo kogu ajalugu võib olla sadu megabaite. Kui mõni tööriist (versiooni arvutamine tag'idest, muudatuste logi, muudetud failide kontroll) annab CI-s teise tulemuse kui sinu masinas, kontrolli kõigepealt, kas põhjus on madalas kloonis. Sama põhimõte kehtib iga action'i kohta: enne kui kopeerid kellegi `with:`-ploki, loe README-st, mis on vaikeväärtus ja miks.

    **Nõutud kontrolli nimi.** Ruleset'i nõutud kontrolli nimi peab täpselt vastama job'i nimele. Kui nimetad job'i hiljem ümber, jääb PR ootama kontrolli, mida enam ei tule, kuni ruleset'i parandad.

## Osa 3 · Turvaskänn ja sõltuvused lähemalt

Need sammud jätkavad IS1 praktikumi osa [3. Trivy ja õigused](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-3-trivy-matrix/): tee neid pärast seda, kui job `security` töötab ja igal job'il on oma `permissions:`. Kaks esimest etappi on IS1 sammude pikem variant koos SHA otsimise ja `compat` job'i õiguste katsega.

### Turvaskänn eraldi job'ina: SHA ise

Lisad job'i `security`, mis töötab build'iga kõrvuti ja kirjutab Trivy tulemuse käivituse kokkuvõttesse. `aquasecurity/trivy-action` vanad tag'id suunati pahatahtlikele commit'idele ([GHSA-69fq-xp46-6x23](https://github.com/aquasecurity/trivy-action/security/advisories)). Seepärast kasutad täis-SHA-d.

See intsident on hea näide, miks tag'i usaldamine on risk: sama nimi, mis eile osutas korralikule koodile, osutas järgmisel päeval koodile, mis luges runner'ilt saladusi. Kõik, kes kasutasid tag'i, käivitasid seda koodi ilma ühtki faili muutmata.

1. Leia v0.36.0 commit'i SHA. Kui väljundis on rida `^{}` lõpuga, võta selle SHA: see on commit, mitte tag-objekt.

    ```bash
    git ls-remote https://github.com/aquasecurity/trivy-action 'refs/tags/v0.36.0*'
    ```

2. Lisa job `security` (`runs-on: ubuntu-latest`, checkout ja Trivy), ilma `needs`-ita:
    - `uses:` rida kujul `aquasecurity/trivy-action@<40 märki>  # v0.36.0`
    - sisendid `scan-type: fs`, `scan-ref: .`, `scanners: vuln`, `severity: CRITICAL,HIGH`
    - `format: table`, `output: trivy.txt`, `exit-code: "0"`
    - kaks sammu `if: always()`: üks kirjutab `trivy.txt` sisu `$GITHUB_STEP_SUMMARY`-sse, teine laadib selle artefaktina üles
3. Tee push ja ava käivituse *Summary*.
4. Leia HIGH ja CRITICAL leidude arv, enim leide andnud teek ja kas see on otse pom'is või tuleb parent'ist (`mvn dependency:tree`).

<!-- EKRAANIPILT: Actions → käivitus → Summary leht, kerida security job'i kokkuvõtteni; näha Trivy tabel (Library, Vulnerability, Severity veerud) ja allosas Artifacts plokk. Pärast security job'i esimest käivitust.
<figure markdown="span">
  ![Käivituse kokkuvõte Trivy leidude tabeliga](assets/k05_trivy_kokkuvote.png)
  <figcaption>Joonis L5.3. Trivy tabel käivituse kokkuvõttes.</figcaption>
</figure>
-->

<!-- EKRAANIPILT: Actions → käivitus pärast security job'i lisamist → Summary ülaosa graaf; näha build ja security kõrvuti (paralleelselt), mõlemad rohelised, all Artifacts: labori-seis-war ja Trivy raport.
<figure markdown="span">
  ![Käivituse graaf, kus build ja security töötavad kõrvuti](assets/k05_actions_graaf.png)
  <figcaption>Joonis L5.4. Build ja security töötavad paralleelselt.</figcaption>
</figure>
-->

> `Unable to resolve action` tähendab tavaliselt vale SHA-d: see peab olema täpselt 40 kuueteistkümnendmärki, lühike SHA ei tööta.

Kõrvuti töötavad job'id tähendavad, et skänn ei lisa käivitusele aega, kui ta pole build'ist aeglasem. `exit-code: "0"` jätab job'i roheliseks ka leidude korral: täna sa kogud infot, otsus "kas leid peatab pipeline'i" on lisaülesandes [10. Trivy poliitika](lisa.md#10-trivy-poliitika). `if: always()` on vajalik, sest muidu kaoks raport just siis, kui Trivy ise ebaõnnestub. Kui leide on null, kontrolli, kas `scan-ref` osutab repo juurele, kus on `pom.xml`.

**Edasi saad minna, kui** graafis on `build` ja `security` kõrvuti, kokkuvõttes on Trivy tabel ja *Artifacts* all on WAR ja Trivy raport.

### Iga job oma õigustega: katse ilma job'i plokita

Võtad kõik tokeni õigused workflow tasemel ära ja annad iga job'ile tagasi ainult lugemisõiguse. `GITHUB_TOKEN` antakse igale sammule, ka kolmanda osapoole action'ile.

Trivy intsidendi pahatahtlik kood kasutas just seda tokenit. Kui tokenil on kirjutusõigus, võib kompromiteeritud action muuta sinu koodi, release'e või pakette. Lugemisõigusega token saab ainult lugeda seda, mida runner niikuinii näeb.

1. Ava viimase käivituse build job'i *Set up job* ja vaata plokki *GITHUB_TOKEN Permissions*.
2. Lisa faili ülaossa (mitte job'i alla) `permissions: {}` ja igale kolmele job'ile `permissions:` plokk `contents: read`.
3. Proovi, mis juhtub ilma job'i plokita: eemalda see ajutiselt `compat` job'ilt, tee push ja vaata checkout'i viga. Siis pane tagasi.
4. Tee push ja kontrolli.

    ```bash
    bash autograde/check.sh k05 hygiene
    bash autograde/check.sh k05 actionlint
    ```

<!-- EKRAANIPILT: Actions → käivitus pärast permissions muudatust → job build → Set up job laiendatud; näha plokk "GITHUB_TOKEN Permissions" ridadega Contents: read ja Metadata: read.
<figure markdown="span">
  ![Set up job sammu plokk GITHUB_TOKEN Permissions](assets/k05_token_oigused.png)
  <figcaption>Joonis L5.5. Pärast job'i plokki <code>contents: read</code> on tokenil ainult lugemisõigus.</figcaption>
</figure>
-->

Plokita `compat` sai workflow tasemelt `{}` ehk mitte midagi ja privaatse repo checkout ebaõnnestus. See tõestab, et piirang kehtib. `Metadata: read` on alati olemas ja seda ei saa ära võtta. Kui pärast muudatust näed plokis endiselt `Contents: write`, on `permissions:` vales taandes ja GitHub ei loe seda job'i omaks.

**Edasi saad minna, kui** enne muudatust oli plokis mitu õigust ja pärast ainult `Contents: read` ja `Metadata: read`, plokita `compat` ebaõnnestus checkout'is ning mõlemad kontrollid annavad `OK`.

### Ühe leiu jälg: kust see teek tuleb

Trivy tabel ütleb, mis teegis on auk, aga mitte seda, kes selle teegi projekti tõi. Võtad ühe leiu ja jälitad selle Maveni sõltuvuspuust oma pom'ini. Nii jõuad otsuseni, kes ja kuidas seda parandab.

Ilma selle sammuta näeb turvaraport välja nagu nimekiri, mida keegi ei oska käsitleda. Tööl küsib turvameeskond sinult just seda: kas parandus on meie käes ja kui kiiresti.

1. Laadi Trivy raport alla ja vali üks HIGH või CRITICAL rida, millel on täidetud *Fixed Version*.

    ```bash
    gh run download --name trivy-raport --dir /tmp/trivy
    grep -E 'HIGH|CRITICAL' /tmp/trivy/trivy.txt | head -5
    ```

2. Leia selle teegi tee pom'ini (asenda `groupId:artifactId` leiu omaga).

    ```bash
    mvn -B -q dependency:tree -Dincludes=groupId:artifactId
    ```

3. Leia ühe leiu kohta: teek, praegune ja parandatud versioon, otsene või transitiivne sõltuvus ning kes selle versiooni määrab (sinu pom, `spring-boot-starter-parent` või mõni muu teek).

Kui teek on puus otse sinu projekti all, on parandus sinu pom'is. Kui see tuleb parent'i kaudu, saad versiooni üle kirjutada `<properties>`-is, aga siis võtad vastutuse, et uus versioon sobib ülejäänud komplektiga. Sageli on parem oodata parent'i patch-versiooni, mida Dependabot pakub. Kui `dependency:tree` ei näita teeki üldse, tuleb leid failist, mis pole Maveni sõltuvus, näiteks `k03-docker/` all olevast konfiguratsioonifailist.

**Edasi saad minna, kui** tead ühe leiu kohta neid nelja asja ja `dependency:tree` väljund näitab teed sinu projektini.

### Compat-matrix: kas build töötab Java 25-ga

Lisad job'i, mis käivitab sama build'i kahe JDK-ga. Control node'il ebaõnnestus build nii Java 17 kui ka JaCoCo 0.8.8-ga. Matrix küsib sama küsimust igal push'il: kas järgmine JDK töötab, enne kui keegi runner'i JDK-d uuendab.

JDK uuendus tuleb tavaliselt väljastpoolt: runner'i image vahetub, baas-image saab uue Java või turvauuendus nõuab uuemat versiooni. Kui sa ei tea ette, mis katki läheb, avastad selle tootmisrikke ajal.

1. Lisa job `compat`, mis kordab build'i Maveni sammu ja mille järel ükski job ei oota:
    - `strategy.matrix.java: ["21", "25"]` ja `fail-fast: false`
    - setup-java `java-version: ${{ matrix.java }}` ja `cache: maven`
    - job `build` jääb muutmata: see teeb WAR-i ja selle `java-version` on `"21"`
2. **Ennusta:** kas Java 25-ga läheb `mvn -B verify` läbi?
3. Tee push ja vaata graafi.

    ```bash
    git commit -am "ci: compat matrix" && git push
    gh run watch
    gh run view "$(gh run list -w ci -L 1 --json databaseId --jq '.[0].databaseId')" --json jobs --jq '.jobs[] | [.name, .conclusion] | @tsv'
    ```

> Ilma `fail-fast: false`-ta tühistab ühe kombinatsiooni ebaõnnestumine teised ja sa ei tea, kas viga on ühes või kõigis.

`compat` on teadlikult eraldi job: tema tulemus on info, mitte quality gate. Kui `compat (25)` ebaõnnestub, ei peatu image ega deploy, aga sa tead, mis tuleb parandada enne JDK tõstmist. Kui mõlemad on rohelised, on sinu ennustus kas õige või oli sinu pilt pluginatest liiga pessimistlik. Kui ebaõnnestub ka `compat (21)`, ei ole viga JDK-s, vaid samas kohas mis `build`-is.

**Edasi saad minna, kui** graafis on `compat (21)` ja `compat (25)` eraldi job'idena, oled tulemust oma ennustusega võrrelnud ja `bash autograde/check.sh k05 build` annab endiselt `OK`.

### Vahemälu tööle

Kontrollid, kas `cache: maven` midagi taastab.

Vahemälu, mis ei tööta, ei anna veateadet. Build on lihtsalt aeglasem ja Maven Central saab iga push'iga sadu päringuid. Ainus viis seda teada on logist vaadata.

1. Leia viimase käivituse build job'i logist read, mis algavad `Cache restored` või `Cache saved`.

    ```bash
    run=$(gh run list -w ci -L 1 --json databaseId --jq '.[0].databaseId')
    gh run view "$run" --log | grep -iE 'cache (restored|saved|not found)'
    ```

2. Võrdle repo vahemälu kirjeid ja nende suurust.

    ```bash
    gh cache list
    ```

3. Vaata, mitu vahemälu kirjet on. Miks võivad `compat (25)` ja `build` kasutada sama kirjet?

`Cache restored from key` ütleb, et runner sai `~/.m2` kätte ega pidanud kõike alla laadima. Võtmes on pom'i räsi, seega iga pom'i muutus teeb uue kirje ja vana jääb aeguma. Kui logis on igal käivitusel `Cache not found`, muutub pom igas commit'is või on `cache:` rida puudu. Võrdle sammude kestusi nendega, mille esimese workflow juures üles kirjutasid: vahemäluga peaks Maveni samm olema märgatavalt lühem.

**Edasi saad minna, kui** teises käivituses on build'i logis `Cache restored from key`, `gh cache list` näitab vähemalt ühte `setup-java-…-maven-…` kirjet.

### Action'id täis-SHA-ga

Kinnitad ka GitHubi ja Dockeri action'id commit'i SHA-ga, nagu Trivy. Tag on muudetav viide.

Ametlike action'ite kompromiteerimine on harvem, aga mõju oleks suurem, sest neid kasutavad kõik. SHA-ga fikseerimine teeb muutuse nähtavaks: uus versioon tuleb ainult PR-iga, mida keegi vaatab.

1. Leia iga kasutatud action'i ja versiooni SHA samamoodi nagu Trivy puhul, näiteks:

    ```bash
    git ls-remote --tags https://github.com/actions/checkout 'v5*' | sort -k2 -V | tail -3
    ```

2. Muuda iga `uses:` rida nii:
    - `@` järel 40-märgiline SHA, mitte tag
    - rea lõpus kommentaar täpse versiooniga, nt `# v5.1.0`
    - kohalikud action'id (`./…`) jäävad nagu on
3. Kontrolli, et ükski rida pole jäänud tag'iga.

    ```bash
    grep -n 'uses:' .github/workflows/*.yml | grep -vE '@[0-9a-f]{40}  # v[0-9]|uses: \./'
    actionlint && bash autograde/check.sh k05 hygiene
    ```

Tühi `grep` tähendab, et iga väline action on kinnitatud ja kommentaar ütleb inimesele, mis versioon see on. Kommentaar ei ole ainult inimesele: Dependabot loeb sealt versiooni ja uuendab SHA-d ja kommentaari koos. Kui kommentaar ja SHA lähevad lahku, usu SHA-d, sest just see töötab.

**Edasi saad minna, kui** `grep` on tühi, actionlint vaikib ja `hygiene` annab `OK`.

### Dependabot hoiab need värsked

Paned Dependaboti jälgima action'eid, Maveni sõltuvusi ja Dockerfile'i baas-image'it. SHA ei uuene ise. Dependabot avab PR-i, mis vahetab SHA ja kommentaari koos ([Dependaboti seadistus](https://docs.github.com/code-security/dependabot/working-with-dependabot/dependabot-options-reference)).

Kinnitatud versioon, mida keegi ei uuenda, muutub ise turvaauguks. Dependabot teeb uuenduse väikeseks ja korrapäraseks: üks PR nädalas, mille CI kontrollib enne, kui sina seda vaatad.

1. Kirjuta `.github/dependabot.yml`:
    - `version: 2`
    - ökosüsteem `github-actions`, `directory: /`, kord nädalas, kõik uuendused ühes grupis (`groups`)
    - ökosüsteem `maven`, `directory: /`, kord nädalas, kuni 5 avatud PR-i
    - ökosüsteem `docker`, `directory: /k03-docker/app` (Dockerfile'i `FROM` read)
2. Kontrolli süntaksit ja tee commit.

    ```bash
    python3 -c 'import yaml,sys; d=yaml.safe_load(open(".github/dependabot.yml")); print([u["package-ecosystem"] for u in d["updates"]])'
    git add .github/dependabot.yml && git commit -m "ci: dependabot" && git push
    ```

> Dependabot loeb faili ainult vaikeharult. Esimesed PR-id tulevad pärast seda, kui `k05-actions` jõuab main'i (image'i ja deploy juures); seni on fail lihtsalt repos.

Kolm ökosüsteemi jälgivad kolme kohta, kust vana kood sinu pipeline'i jõuab: action'id, Java teegid ja konteineri baas. Grupp action'itele hoiab PR-ide arvu väiksena, sest neid uuendatakse sageli koos. Kui `python3` trükib vähem kui kolm nime, on mõni plokk vale taandega ja Dependabot ignoreerib seda vaikselt.

**Edasi saad minna, kui** `python3` trükib `['github-actions', 'maven', 'docker']` ja fail on push'itud.

### Baas-image'id ja Compose'i teenused

Dependabot vaatab praegu ainult rakenduse Dockerfile'i. db01 ja web01 baas-image'id ning `compose.yaml`-is olevad `memcached` ja `rabbitmq` vananevad vaikselt: Trivy `fs`-skänn loeb pom'i, mitte image'eid, ja ükski PR ei ütle, et `rabbitmq:4.1-management-alpine` all on uus Alpine'i parandus. Samal ajal ei tohi andmebaasi uus seeria tulla nädala PR-iga. MariaDB 11.4 → 11.8 on uus major-seeria: see uuendab andmekataloogi ja allapoole MariaDB ametlikult ei toeta, seega rollback'i pärast seda ei ole.

Teine probleem on liikuv tag. `FROM mariadb:11.4` annab iga build'i ajal selle, mis registry's parasjagu on: kui upstream ehitab tag'i turvaparandusega uuesti, muutub sinu db01 image järgmisel build'il ilma ühegi commit'ita. Digest teeb sama muutuse nähtavaks: Dependabot avab PR-i, mis vahetab digest'i, ja CI kontrollib seda enne sind.

Nõuded failile `.github/dependabot.yml` ja db01 Dockerfile'ile:

- ökosüsteem `docker` jälgib kõiki kolme Dockerfile'i (`directories` glob'iga `/k03-docker/*`)
- uus ökosüsteem `docker-compose` jälgib faili `k03-docker/compose.yaml`, kord nädalas
- `mariadb` uut minor- ega major-versiooni Dependabot ei paku (`ignore` + `update-types`)
- db01 baas-image on kinnitatud digest'iga kujul `FROM mariadb:11.4@sha256:<digest>`; digest on sama, mida registry praegu tag'ile `11.4` annab
- 3. kohtumise automaatse hindaja `tags` kontroll on endiselt `OK` (tag jääb digest'i kõrvale alles, `latest`-i pole)

```bash
python3 -c 'import yaml; d=yaml.safe_load(open(".github/dependabot.yml")); print([u["package-ecosystem"] for u in d["updates"]])'
grep -n '^FROM' k03-docker/db/Dockerfile
docker buildx imagetools inspect mariadb:11.4 | awk '/^Digest:/{print $2}'
bash autograde/check.sh k03 tags
```

Dependaboti viide ([`ignore`](https://docs.github.com/code-security/dependabot/working-with-dependabot/dependabot-options-reference#ignore--), [`docker-compose`](https://docs.github.com/code-security/dependabot/working-with-dependabot/dependabot-options-reference#package-ecosystem-)) ütleb võtmete täpse kuju. Kui `python3` ei näita `docker-compose`-i, on plokk vale taandega ja Dependabot jätab selle vaikselt vahele. `compose.yaml`-i read, kus `image:` sisaldab muutujat (`${REGISTRY}`), on sinu oma image'id ja need uuendab pipeline, mitte Dependabot. Digest'iga rida tähendab, et db01 image muutub ainult PR-iga, mille diff näitab vana ja uut digest'i. Kui `ignore` puudub, tuleb esimene MariaDB PR uue seeriaga ja roheline CI ei ütle midagi andmekataloogi uuenduse kohta, sest testid ei käivita andmebaasi.

**Edasi saad minna, kui** `python3` trükib `['github-actions', 'maven', 'docker', 'docker-compose']`, `FROM` real on `mariadb:11.4@sha256:` ja sama digest, mida näitab `imagetools`, `k03 tags` annab `OK` ning commit on push'itud. Pärast main'i jõudmist näitab *Insights → Dependency graph → Dependabot* ka faili `k03-docker/compose.yaml`.

### Miks see nii töötab

??? info "Ava selgitused"

    **Matrix'i job'i nimi.** Matrix'i job'i nimele lisatakse sulgudesse kombinatsioon (`compat (25)`). Seetõttu saab ruleset'is nõuda ka ainult osa kombinatsioonidest. Üks matrix genereerib käivituses kuni 256 job'i ja `max-parallel` piirab, mitu neist töötab korraga.

    **`setup-java` vahemälu.** `actions/setup-java` v5 vahemälu võti sisaldab platvormi ja pom'i räsi, kuid mitte Java versiooni. Seetõttu võivad matrix'i harud kasutada sama vahemälukirjet. Üldine põhimõte: kõik, mida vahemälu võti ei sisalda, on käivituste vahel jagatud. Võtme koostis tasub kasutatava versiooni README-st järele vaadata, mitte eeldada. GitHub hoiab repo kohta kuni 10 GB vahemälu ja kustutab kirjed, mida 7 päeva ei loeta. Käivitus loeb ainult oma haru ja vaikeharu kirjeid, nii et PR-i haru ei saa main'i vahemälu üle kirjutada.

    **Avaldis ja shell.** Avaldis `${{ }}` asendatakse enne, kui shell skripti saab. Shell saab valmis teksti ega tea, et osa sellest tuli kasutajalt, nii et haru nimi `x$(curl …)` otse `run:`-ploki sees oleks käsk. `env:` kaudu jõuab väärtus shelli muutujana ja jutumärkides muutuja sisu shell käsuna ei käivita, kui sa ise seda `eval`-i ega `sh -c` kaudu ei käivita. Põhimõte: kõik, mida saab kirjutada keegi peale sinu (haru nimi, PR-i pealkiri, commit'i sõnum), antakse edasi `env:` kaudu.

## Osa 4 · Image ja runner lähemalt

Need sammud jätkavad IS1 praktikumi osa [4. Image ja deploy](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-4-deploy/): tee neid pärast seda, kui main'i deploy on roheline ja `/version` näitab sama commit'i. Teine etapp on IS1 image'i sammu pikem variant koos kihtide vahemäluga.

### Image kõigepealt control node'il

Ehitad image'i käsitsi täpselt nii, nagu CI seda hakkab tegema. Kui build ebaõnnestub lokaalselt, ebaõnnestub see ka CI-s, aga seal ootad viga minuteid. Build context on repo juur (`.`), sest Dockerfile vajab `pom.xml`-i ja `src/`-i.

Commit'i SHA image'i sees on ainus usaldusväärne viis hiljem öelda, mis kood konteineris töötab. Tag'i saab ümber panna, SHA keskkonnamuutujas jääb image'iga kaasa.

1. Ehita repo juurest sama image, mida CI hakkab ehitama, ja võrdle SHA-sid.

    ```bash
    docker build -f k03-docker/app/Dockerfile --build-arg GIT_SHA="$(git rev-parse HEAD)" -t labseis-app:k05test .
    docker run --rm labseis-app:k05test printenv GIT_SHA
    git rev-parse HEAD
    ```

> Kui `printenv` annab `unknown` või tühja, puudub 3. kohtumisel kirjutatud Dockerfile'i runtime stage'is `ARG GIT_SHA` ja `ENV GIT_SHA=${GIT_SHA}`. Lisa need viimaste ridade hulka, et muutuv väärtus ei tühistaks eelmisi kihte.

Sama SHA mõlemas väljundis tõestab, et build-arg jõuab runtime stage'i ja rakendus saab selle `/version` vastusesse panna. Multi-stage Dockerfile'is ei kandu `ARG` ühest stage'ist teise, seepärast tuleb see viimases stage'is uuesti öelda. Kui paned `ARG`-i faili algusesse, muutub see iga commit'iga ja Docker ehitab kõik järgmised kihid uuesti.

**Edasi saad minna, kui** build õnnestub ja `printenv` annab sama 40-märgilise SHA mis `git rev-parse HEAD`.

### Image ghcr.io-sse kihtide vahemäluga

Lisad job'i `image`, mis ehitab sama image'i GitHubi runner'il ja lükkab selle registry'sse. [ghcr.io](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry) võtab image'i vastu sama `GITHUB_TOKEN`-iga. PR-il image ehitatakse, aga ei lükata.

Registry on piir CI ja CD vahel: kõik, mis on registry's, on testitud ja deploy'ks valmis. Kui PR saaks image'i lükata, võiks registry'sse jõuda kood, mida keegi pole üle vaadanud.

1. Lisa workflow tasemele `env: IMAGE: ghcr.io/${{ github.repository }}` ja uus job `image`:
    - `needs: [build, security]`, õigused `contents: read` ja `packages: write`
    - samm `id: meta` kirjutab `$GITHUB_OUTPUT`-i `tags=` (`:${GITHUB_SHA::7}` alati, `:latest` ainult main'il) ja `ref=` (ainult sha7 tag); nimi väiketähtedega `repo="${IMAGE,,}"`
    - job'i `outputs: ref: ${{ steps.meta.outputs.ref }}` (deploy vajab seda)
2. Lisa sammud, iga action SHA-ga kinnitatud nagu `build` ja `security` job'is:
    - `docker/setup-buildx-action@v4`
    - `docker/login-action@v4` registry'sse `ghcr.io` ainult siis, kui see pole PR: `username: ${{ github.actor }}`, `password: ${{ secrets.GITHUB_TOKEN }}`
    - `docker/build-push-action@v7`: `context: .`, `file: k03-docker/app/Dockerfile`, `push: ${{ github.event_name != 'pull_request' }}`, `tags: ${{ steps.meta.outputs.tags }}`, `build-args: GIT_SHA=${{ github.sha }}`
    - samas sammus [kihtide vahemälu](https://docs.docker.com/build/cache/backends/gha/): `cache-from: type=gha`, `cache-to: type=gha,mode=max`
3. Tee push kaks korda (teine kord näiteks tühja commit'iga) ja võrdle image job'i logi.

    ```bash
    git commit --allow-empty -m "ci: cache test" && git push
    gh run watch
    gh run view "$(gh run list -w ci -L 1 --json databaseId --jq '.[0].databaseId')" --log | grep -E 'go-offline|CACHED' | head
    git rev-parse --short=7 HEAD
    ```

<!-- EKRAANIPILT: GitHub profiil/org → Packages → pakett repo nimega; näha tag'id sha7 ja latest ning sama digest. Pärast esimest main'i push'i.
<figure markdown="span">
  ![ghcr.io pakett tag'idega sha7 ja latest](assets/k05_ghcr_pakett.png)
  <figcaption>Joonis L5.6. Image ghcr.io-s: tag commit'i SHA järgi ja main'il <code>latest</code>.</figcaption>
</figure>
-->

`needs: [build, security]` tähendab, et image tehakse alles siis, kui testid ja skänn on läbi. `CACHED` teises käivituses tõestab, et sõltuvuste allalaadimise kiht tuli vahemälust: tühi commit ei muutnud pom'i, seega polnud põhjust seda uuesti teha. Tag sha7 on see, mida deploy kasutab, `latest` on ainult inimesele mugavuseks. Kui deploy kasutaks `latest`-i, ei saaks sa kunagi kindel olla, mis versioon parasjagu töötab.

**Edasi saad minna, kui** *Packages* all on pakett sinu repo nimega ja tag'iga, mis võrdub `git rev-parse --short=7 HEAD`-iga (main'il on `latest` sama digest'iga), teises käivituses on `dependency:go-offline` kiht `CACHED` ja `bash autograde/check.sh k05 structure` annab `OK`.

### Mis jääb runner'isse maha

Vaatad, mida deploy job sinu control node'ile maha jättis. Runner ei ole tühi VM nagu GitHubi oma: kõik failid, image'id ja sisselogimised jäävad järgmise job'ini alles.

Päeva alguses tegid `.env`-ist koopia `~/k03.env` ja deploy kopeeris selle runner'i töökausta. Kui see seal püsib, on paroolid kettal kohas, mida keegi ei jälgi, kuni järgmise job'i checkout kausta tühjendab.

1. Leia runner'i töökaustast `.env` ja vaata selle õigusi.

    ```bash
    find ~/actions-runner/_work -name .env -path '*k03-docker*' -exec ls -l {} \;
    ```

2. Vaata, mitu rakenduse image'it on masinas ja kas ghcr.io sisselogimine jäi alles.

    ```bash
    docker image ls --filter 'reference=ghcr.io/*/*'
    grep -c 'ghcr.io' ~/.docker/config.json 2>/dev/null || echo 0
    ```

3. Vasta: kas `.env` on töökaustas, mis õigustega, mitu image'it on masinas ja kas ghcr.io kirje on alles?

`.env` on töökaustas pärast job'i lõppu ja just selle parandab koristussamm, mille lisad koos environment'i secret'itega. Iga deploy jätab masinasse ühe image'i juurde, nii et mõne kuu pärast täidab see ketta: koristus on lisaülesanne [12. Vanad image'id registry's ja runner'is](lisa.md#12-vanad-imageid-registrys-ja-runneris). Ära kustuta neid praegu käsitsi, sest rollback vajab eelmist image'it. ghcr.io kirjet ei tohiks pärast job'i olla, sest login-action logib *Post* sammus välja. Kui see on alles, logisid sa kunagi käsitsi sisse ja see token on nüüd kettal.

**Edasi saad minna, kui** tead neljale küsimusele vastust ja oskad öelda, milline neist on turvaprobleem.

### Muudatus haru kaudu tootmisse

Teed nähtava muudatuse eraldi harus, nagu tööl, ja viid selle PR-i kaudu tööle, ilma et käivitaksid control node'il ühtki deploy-käsku. Sinu ainus tegevus on Git ja PR, kõik muu teeb pipeline.

Kui pärast seda pead ikka serverisse logima, et midagi käsitsi teha, ei ole deploy automatiseeritud.

- haru `fix-pealkiri` tehakse värskest main'ist ja muudab ainult pealkirja failis `src/main/resources/templates/index.html`
- merge alles siis, kui PR-i kontrollid on rohelised
- pärast merge'i on haru kustutatud nii GitHubis kui lokaalselt
- lõpus jätkad harus `k05-actions`, mis sisaldab main'i viimaseid muudatusi (`git merge main`)

```bash
curl -s http://localhost:8080/ | grep -o '<title>[^<]*'
curl -s http://localhost:8080/version; echo
git fetch --prune && git branch -a | grep fix-pealkiri
```

Uus pealkiri brauseris ja õige `/version` tõestavad, et muudatus jõudis tootmisse ilma käsitsi sammuta. PR-il töötas image ilma push'ita: Dockerfile'i build kontrolliti enne merge'i, aga registry'sse ei jõudnud midagi ülevaatamata. Kui `grep fix-pealkiri` näitab veel midagi, on haru alles kas GitHubis või lokaalselt ja `--prune` või `git branch -d` jäi tegemata.

**Edasi saad minna, kui** PR-il töötasid build, security, compat ja image (ilma push'ita), leht näitab uut pealkirja, `/version` võrdub `origin/main`-iga ja viimane `grep` on tühi.

### Miks see nii töötab

??? info "Ava selgitused"

    **Registry ilma pikaajalise võtmeta.** Paljudes õpetustes lükatakse image Amazon ECR-i IAM-kasutaja juurdepääsuvõtmetega (access key), mis salvestatakse GitHubi secret'iteks ja millel on sageli vajalikust laiemad õigused. Meie workflow lükkab image'i registry'sse ghcr.io job'i enda `GITHUB_TOKEN`-iga, mis kehtib ainult käivituse ajal, nii et pikaajalist võtit ei ole vaja. ECR-i kasutad kodutöös.

    **`type=gha` vahemälu.** Vaikimisi `docker`-draiver klassikalise image store'iga (kursuse VM-i Docker 29 seadistus) ei toeta vahemälu tüüpi `type=gha`. Seetõttu loob `docker/setup-buildx-action` BuildKiti `docker-container`-draiveriga builderi ja vahemälu kasutatakse ainult selle builderi kaudu.

    **Kiirus ja koristus.** Alles jäänud image'i kihid teevad deploy kiireks, kuid iga job pärib ka eelmise job'i jäägid. Seetõttu on deploy job'il koristussamm ja lisaülesanne [15. Ühekordne runner](lisa.md#15-uhekordne-runner) näitab, kuidas iga job saab puhta keskkonna.

    **Ühekordse runner'i piir.** Just-in-time runner registreeritakse ühe job'i jaoks ja lahendab töökausta jääkide probleemi, kuid mitte kõike: Dockeri image'id ja kodukausta failid on endiselt jagatud, sest runner töötab samas masinas sama kasutajana. Täielik eraldatus tähendaks iga job'i jaoks uut VM-i või konteinerit. Nii töötavad GitHubi hallatud runner'id. Self-hosted runner on kompromiss: ligipääs VPN-i taha ühe masina hinnaga.

## Osa 5 · Deploy haldus

Need sammud jätkavad IS1 praktikumi osa [5. Käsitsi käivitus ja saladused](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-5-saladused/): tee neid pärast seda, kui deploy kasutab environment'i `proxmox` secret'eid ja `~/k03.env` on kustutatud.

### Ajakava

Lisad ajastatud käivituse, mis kontrollib koodi ka siis, kui keegi ei push'i. Uus CVE tuleb sõltuvusse ka ilma commit'ita. Cron on UTC-s ja käivitub ainult vaikeharul.

Repo, mida keegi kuu aega ei puuduta, on kuu aega skännimata. Ajastatud käivitus muudab Trivy andmebaasi uuendused nähtavaks, ilma et peaksid ise meeles pidama.

1. Lisa `schedule:` cron'iga tööpäevadeks varahommikul, minut mitte `0` (nt `"17 4 * * 1-5"`).
2. Lisa `image` job'ile `if: github.event_name != 'schedule'`. Deploy jääb siis ise vahele, sest ta vajab image'it.
3. Kontrolli lokaalselt: `actionlint; echo $?`

Minut, mis pole `0`, on viisakus: täistunnil käivituvad tuhandete repositooriumide workflow'd ja GitHub võib neid edasi lükata. Image'i ja deploy'd ajastatud käivitus ei vaja, sest kood pole muutunud; uus image samast koodist oleks ainult uus tag ilma uue sisuta. Kui ajastatud käivitust järgmisel päeval pole, vaata kõigepealt, kas `schedule:` on main'is, sest teistel harudel GitHub seda ei loe.

**Edasi saad minna, kui** `actionlint` annab `0`. Esimest ajastatud käivitust, kus töötavad ainult build, compat ja security, näed järgmisel tööpäeval.

### Proovi environment'i piiri

Kontrollid, kas haru piirang kehtib. Käivitad deploy harult `k05-actions`, kuigi environment lubab ainult main'i. Ootus on, et GitHub keeldub enne, kui ükski samm runner'il algab.

Kui piirang ei kehti, saab iga haru autor oma koodi koos tootmise paroolidega sinu serveris käivitada.

1. Käivita deploy oma harult.

    ```bash
    gh workflow run ci --ref k05-actions -f deploy=deploy
    gh run watch
    ```

2. Ava käivituse deploy job ja leia teade, miks see ei käivitunud.
3. Kontrolli, et runner'i töökaustas pole `.env`-i: `find ~/actions-runner/_work -name .env -path '*k03-docker*'`

Deploy ebaõnnestus teatega `Branch "k05-actions" is not allowed to deploy to proxmox` ja runner ei saanud tööd üldse. See tähendab, et secret'id ei lahkunud GitHubist: kontroll toimub enne, kui job runner'ile antakse. Tühi `find` kinnitab, et ka eelmise deploy fail on koristatud. Kui deploy oleks käivitunud, puudub environment'il haru piirang või on job'il `environment:` rida puudu.

**Edasi saad minna, kui** deploy job on punane haru piirangu teatega, runner'i logis pole selle käivituse job'i ja `find` on tühi.

### Käsitsi kinnitus: sinu repo järgi

Valid, kuidas deploy enne käivitumist inimese otsust ootab. *Required reviewers* töötab GitHubi Free ja Team plaanil ainult avalikus repos. Self-hosted runner sobib aga ainult privaatsesse reposse.

Need kaks nõuet on vastuolus ja tööl lahendatakse see tavaliselt Enterprise plaaniga. Laboris kasutame nuppu: tulemus on sama, inimene otsustab enne deploy'd, aga kontroll on kirjas workflow's, mitte environment'i seadetes.

| Repo | Kinnitus |
|---|---|
| privaatne (Classroom 50 vaikimisi) | `workflow_dispatch` sisend `deploy` + `DEPLOY_ENABLED=false`, kui tahad ainult käsitsi |
| avalik või Enterprise | environment `proxmox` → *Required reviewers* → sina ise |

*Tabel L5.1. Kinnituse viis repo nähtavuse järgi.*

1. Vaata oma repo nähtavust: `gh repo view --json visibility --jq .visibility`
2. Vali tabelist oma variant ja proovi see läbi: privaatses repos `gh variable set DEPLOY_ENABLED --body false`, siis tühi commit main'i, siis nupp sõnaga `deploy`.
3. Pane `DEPLOY_ENABLED` tagasi `true`-ks.

Muutujaga `DEPLOY_ENABLED=false` jäi push'i deploy vahele, aga nupp töötas: automaatne tee on kinni, käsitsi tee lahti. Nii käitub ka külmutusperiood tööl, kui enne puhkust või suurt üritust ei taheta automaatseid muudatusi. Muutuja on repo seadetes, seega muudad käitumist ilma commit'ita ja muutus on GitHubi auditilogis näha.

**Edasi saad minna, kui** ühes käivituses jäi deploy vahele või ootas ja teises käivitus see pärast sinu otsust.

### Üks deploy korraga

Paned deploy järjekorda, et kaks käivitust ei teeks sama stack'iga korraga midagi. Kaks paralleelset `docker compose up`-i samas kaustas jätavad stack'i ettearvamatusse olekusse. [`concurrency`](https://docs.github.com/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) grupis on korraga üks töötav ja üks ootav töö.

Kaks kiiret merge'i järjest on tavaline olukord. Ilma järjekorrata võib vanem deploy lõppeda hiljem ja tootmisse jääb eelmine versioon, kuigi mõlemad käivitused on rohelised.

1. Nõuded workflow'le:
    - deploy job'il on concurrency-grupp `deploy-proxmox`, mis ei katkesta poolikut deploy'd
    - igal job'il on `timeout-minutes`
    - workflow tasemel grupp katkestab sama PR-i vana käivituse, aga main'i push'i ja nupu käivitused ei oota ega katkesta üksteist (grupi nimi peab sõltuma sündmusest; avaldiste süntaks: [`${{ }}` operaatorid](https://docs.github.com/actions/reference/workflows-and-actions/expressions))
2. Kontrolli `actionlint`-iga ja vii muudatus main'i. **Ennusta:** mis juhtub kolme kiiresti järjest käivitatud deploy'ga? Siis käivita need.

    ```bash
    for i in 1 2 3; do gh workflow run ci --ref main -f deploy=deploy; sleep 5; done
    gh run list -w ci -L 3 --json databaseId,status,conclusion
    ```

3. Vaata kolme käivituse deploy job'i olekut ning algus- ja lõpuaega (*Actions* → käivitus → deploy).
4. PR-il: tee kaks push'i kiiresti järjest harule `k05-actions` ja vaata, mis juhtub esimese PR-i käivitusega.

Kui ootav on juba olemas, asendab uus selle ja vana ootaja tühistatakse. See on deploy puhul õige, sest viimane soov on ainus, millel on tähtsust. `cancel-in-progress: false` tähendab, et poolik deploy lõpetatakse alati, sest katkestatud `compose up` jätab stack'i kõige halvemasse olekusse. PR-il tühistati vana käivitus, sest selle tulemus polnud enam kellelegi vajalik.

**Edasi saad minna, kui** teine deploy oli *Pending*, kuni esimene lõppes, või tühistati kolmanda tõttu, ükski kahest deploy'st ei käivitunud samal ajal, PR-i esimene käivitus on *Cancelled* ja `bash autograde/check.sh k05 deploy` annab `OK`.

### Miks see nii töötab

??? info "Ava selgitused"

    **Concurrency-grupp.** Workflow tasemel grupp, mille nimes on `github.run_id`, on igal PR-ivälisel käivitusel unikaalne. Seega main'i käivitused ei oota üksteist ja järjekorda hoiab ainult deploy job'i grupp.

    **Ajakava avalikus repos.** Avalikus repos lülitab GitHub `schedule:` sündmuse välja, kui repos pole 60 päeva jooksul tegevust olnud. Kui öine käivitus on vaikselt kadunud, vaata Actions lehelt, kas workflow on *disabled*.

    **Logi maskeerimine.** GitHub asendab logis secret'i väärtuse tärnidega ainult siis, kui väärtus ilmub täpselt sellisena, nagu see salvestati. Maskeerimine on tekstiasendus, mitte kaitse: iga teisendus, lõikamine või kodeerimine (näiteks base64) annab väärtuse, mida GitHub ei tunne. Sellest tuleneb kaks reeglit. Ära väljasta secret'it logisse, ka mitte kontrolli eesmärgil. Kui secret on mõnes logis teisendatud kujul nähtav, loe see lekkinuks ja vaheta see välja, sest logi võivad lugeda ka teised. `gh run delete` eemaldab logi, kuid ei muuda olematuks seda, et keegi võis logi juba näha.

## Osa 6 · Dependaboti PR

See etapp eeldab IS2 etappi [Dependabot hoiab need värsked](#dependabot-hoiab-need-varsked) ja tehakse enne IS1 praktikumi osa [6. Esitamine](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-8-esitamine/) etappi „PR, merge ja tag“.

### Esimene Dependaboti PR

Vaatad läbi ühe Dependaboti PR-i nii, nagu teeksid seda tööl iga nädal: mida see muudab, mida CI selle kohta ütles ja kas julged selle merge'ida. Dependaboti PR-i käivitus saab ainult lugemisõigusega tokeni ega näe Actionsi secret'eid: Dependabotil on oma secret'id.

Automaatne uuendus, mida keegi ei vaata, on sama risk kui uuendus, mida ei tehta: üks muudab tootmist ilma otsuseta, teine jätab augud lahti. Sinu töö on otsustada, CI töö on anda otsuseks andmed.

1. Leia avatud Dependaboti PR. Kui ühtegi pole, käivita kontroll käsitsi: *Insights → Dependency graph → Dependabot* → ökosüsteemi rida → *Check for updates*.

    ```bash
    gh pr list --author 'app/dependabot' --state open
    ```

2. Vaata ühe PR-i muudatust ja kontrolle (asenda `<nr>`).

    ```bash
    gh pr diff <nr> | grep -E '^[-+][^-+]'
    gh pr checks <nr>
    ```

3. Vaata, mis versioon mis versiooniks muutus, kas see on patch, minor või major ja kas kõik kontrollid on rohelised. Kirjuta oma otsus (merge või mitte) ühe lausega PR-i kommentaariks.
4. Kui otsustasid merge'ida, tee seda ja kontrolli deploy'd: `/version` peab võrduma uue `origin/main`-iga.

Action'i PR-is muutub SHA ja kommentaar koos, Maveni PR-is versiooninumber pom'is. Deploy PR-il ei käivitunud, sest `if:` lubab ainult push'i main'i, seega ei saanud Dependaboti kood sinu serverisse ilma sinu merge'ita. Major-versiooni hüpe on koht, kus loed muudatuste logi, isegi kui CI on roheline, sest testid ei kata kogu käitumist. Kui ükski PR ei tulnud ka pärast käsitsi kontrolli, on kõik juba uusimad või on `dependabot.yml` vigane: sama lehe viga ütleb, kumb.

**Edasi saad minna, kui** ühel Dependaboti PR-il on sinu kommentaar otsusega või Dependabot kontrollis ja uuendusi polnud.

