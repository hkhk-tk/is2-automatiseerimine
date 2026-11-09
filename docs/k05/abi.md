---
tags:
  - veaotsing
---

# Abi: veaotsing

Tabel katab IS1 praktikumi [Maven ja GitHub Actions](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab/) ja selle kursuse 5. kohtumise süvenemise sammud.

| Sümptom | Kontrolli | Tõenäoline põhjus | Miks see juhtub |
|---|---|---|---|
| **1. Maven** | | | |
| `docker compose ps` ei näita nelja teenust või `curl /health` ei vasta | `cd k03-docker && docker compose logs --tail 30` | stack on maas: `docker compose up -d` | VM-i taaskäivituse järel käivituvad uuesti ainult teenused, millel on `restart:` poliitika; käsitsi peatatud stack jääb maha |
| `gh repo view` näitab `viewerPermission` `WRITE` või `READ` | repo *Settings* puudub | sul pole admin-õigust: koolitaja annab | runner'i ja environment'i loomine on repo seadete muutmine, mida GitHub lubab ainult adminile |
| `mvn: command not found` või Java 17 | `mvn -v`, `java -version` | `sudo apt-get install -y openjdk-21-jdk-headless maven` | Ubuntu vaikimisi JDK võib olla vanem kui pom'i nõue ja Maven ei tule JDK-ga kaasa |
| `Unknown lifecycle phase` | käsu kirjapilt | faasi nimes on trükiviga, kood 1 | Maven tunneb ainult elutsükli faase ja `plugin:goal` kuju; muu sõna on tema jaoks tundmatu |
| `Unsupported class file major version 65` | `-Djacoco.version` käsureal, `jacoco.version` pom'is | JaCoCo on Java 21 jaoks liiga vana | JaCoCo loeb klassifaile baithaaval ja vanem versioon ei tunne uuema Java failivormingut |
| `You have 1 Checkstyle violation` | `target/checkstyle-result.xml` | kasutamata import või stiiliviga; `verify` ebaõnnestub, `package` mitte | checkstyle on pom'is seotud `verify` faasiga, seega `package` ei jõua temani |
| `java.lang.OutOfMemoryError: Java heap space` | `echo $MAVEN_OPTS`, `free -m` | JVM-i heap liiga väike: `MAVEN_OPTS=-Xmx512m` | `-Xmx` paneb JVM-ile lae olenemata sellest, kui palju masinas vaba mälu on |
| `release version 21 not supported` | `mvn -v` rida `Java home:`, `echo $JAVA_HOME` | `JAVA_HOME` osutab JDK 17-le | Maven eelistab `JAVA_HOME`-i PATH-ile ja vanem kompilaator ei oska uuemat versiooni toota |
| värske kloon ebaõnnestub, oma kaust mitte | `git status --ignored`, `git ls-files` | vajalik fail pole Gitis (ignoreeritud või commit'imata) | kloon saab ainult commit'itud faile, täpselt nagu CI runner |
| `-o` build: `Cannot access central in offline mode` | `ls ~/.m2/repository` | mõni plugin või teek pole veel kohalikus hoidlas | offline-režiim keelab allalaadimise ja nõuab, et `verify` oleks enne vähemalt korra võrguga käivitunud |
| **2. Esimene workflow** | | | |
| käivitust pole üldse | faili tee ja laiend, `branches:` | fail pole `.github/workflows/*.yml` või haru nimi ei klapi | GitHub otsib workflow'sid ainult sellest kaustast ja käivitab need ainult `on:` tingimustele vastavatel sündmustel |
| punane käivitus ilma job'ideta, `Invalid workflow file` | `actionlint` | YAML-i viga: taane või koolon | GitHub ei saa vigasest failist job'e luua, seega pole ühtegi sammu, mille logi näidata |
| `Unable to resolve action …@vX` | action'i *Releases* leht | olematu versioon või lühike SHA | *Set up job* laadib action'id alla enne ühtki sammu ja peatab job'i, kui viidet pole |
| `command not found`, `exit code 127` | sammu `run:` rida | käsk on valesti kirjutatud või runner'il puudub | runner'i image'il on oma PATH ja tööriistad; sinu masina alias'ed ja paketid sinna ei kandu |
| `release version 21 not supported` CI-s | setup-java samm | setup-java puudub või `java-version` pole `"21"` | runner'i image'il on vaikimisi oma Java ja ilma setup-java'ta kasutab Maven seda |
| `actionlint: command not found` | `ls ~/.local/bin`, `echo $PATH` | `~/.local/bin` pole PATH-is | Ubuntu lisab `~/.local/bin` PATH-i ainult siis, kui kaust oli sisselogimisel olemas |
| PR-il pole kontrolli | `on:` plokk | `pull_request:` puudub või `branches:` pole `main` | `branches:` all on PR-i sihtharu, mitte sinu haru nimi |
| `No files were found with the provided path` | build'i logi, `ls target` | WAR-i tee vale või build ebaõnnestus enne; `if-no-files-found: error` teeb selle punaseks | upload-artifact otsib faili runner'i töökaustast ja Maveni ebaõnnestumisel `target/` WAR-i pole |
| `fromdate` viga `gh run view --json jobs` jq-s | käivituse olek | valitud käivitus on pooleli või mõni samm jäi alustamata | pooleliolevatel ja vahele jäänud sammudel pole korrektset lõpuaega |
| **3. Trivy, matrix ja õigused** | | | |
| Trivy samm: `Unable to resolve action` | SHA pikkus | SHA pole 40 märki või võeti tag-objekti SHA, mitte `^{}` rida | annotated tag'il on oma SHA, mis pole commit; `uses:` vajab commit'i |
| kokkuvõttes pole Trivy tabelit | sammu tingimus | kokkuvõtte samm pole `if: always()` või `output:` fail on teise nimega | vaikimisi tingimus `success()` jätab sammu vahele, kui Trivy samm ebaõnnestus |
| `dependency:tree -Dincludes` ei näita midagi | leiu teegi nimi, `trivy.txt` veerg *Library* | vale `groupId:artifactId` või leid pole Maveni sõltuvus | Trivy skännib ka teisi faile peale pom'i ja `-Dincludes` vajab täpset nime |
| `compat (25)` ebaõnnestub | sammu logi | ootuspärane info: mõni plugin või sõltuvus pole Java 25 jaoks valmis; märgi üles | pluginad, mis loevad klassifaile, peavad uut Java versiooni eraldi toetama |
| ainult üks matrix'i käivitus, teine *Cancelled* | `strategy` plokk | `fail-fast: false` puudub | vaikimisi tühistab GitHub ülejäänud kombinatsioonid esimese ebaõnnestumise järel |
| `k05 build`: Java 21 pole valitud | build job'i setup-java | build job'is on `${{ matrix.java }}`: matrix käib `compat` job'i, build jääb `"21"` | automaatne hindaja otsib failist sõnasõnalist `java-version: "21"` rida |
| `Cache not found for input keys` igal käivitusel | `gh cache list` | `cache: maven` puudub või pom muutub igas commit'is | vahemälu võti sisaldab pom'i räsi, nii et iga pom'i muutus annab uue võtme |
| checkout: `Repository not found` või `403` | *Set up job* → *GITHUB_TOKEN Permissions* | job'il pole `contents: read`: job'i plokk asendab workflow oma | privaatset repot saab kloonida ainult lugemisõigusega token ja `{}` ei anna midagi |
| `k05 hygiene`: Node 20 action'id | `grep -n 'uses:' .github/workflows/*.yml` | `@v4` või vanem major | vanad major'id töötavad Node 20 peal, mida GitHubi runner enam ei toeta |
| `k05 hygiene`: trivy-action täis-SHA | Trivy `uses:` rida | tag'iga või lühikese SHA-ga | tag'i saab ümber suunata ja just seda tehti trivy-action'i intsidendis |
| Dependabot ei ava PR-e | *Insights → Dependency graph → Dependabot* | fail pole veel main'is, YAML-i viga või org on Dependaboti keelanud | Dependabot loeb seadistust ainult vaikeharult ja vigast faili vaikselt ignoreerib |
| **4. Image ja deploy** | | | |
| `printenv GIT_SHA` annab `unknown` või tühja | `grep -n GIT_SHA k03-docker/app/Dockerfile` | runtime stage'is puudub `ARG GIT_SHA` + `ENV GIT_SHA=${GIT_SHA}` | multi-stage Dockerfile'is kehtib `ARG` ainult selles stage'is, kus see on öeldud |
| `denied: installation not allowed to Create organization package` | org'i *Packages* seaded | org keelab pakette luua: koolitaja | org'i seade on tugevam kui job'i `packages: write` |
| `denied` / `unauthorized` ghcr.io | job'i `permissions:`, login samm | `packages: write` (image) või `packages: read` (deploy) puudub, login puudub | ghcr.io kontrollib tokeni õigust iga push'i ja pull'i juures eraldi |
| `cache-to`: `This feature requires the docker-container driver` või gha cache viga | samm enne build-push'i | `docker/setup-buildx-action` puudub | vaikimisi Docker draiver ei oska vahemälu väljaspool masinat hoida |
| `repository name must be lowercase` | `meta` samm | nimi pole väiketähtedega: `${IMAGE,,}` | `github.repository` hoiab omaniku nime suurtähti, aga registry nõuab väiketähti |
| `actionlint`: `label "labseis" is unknown` | `.github/actionlint.yaml` | label on kirjutamata või vale võtme all | actionlint tunneb ainult GitHubi runner'ite label'eid, sinu omad pead ise ütlema |
| `permission denied … docker.sock` | `groups` runner'i kasutajana | `sudo usermod -aG docker $USER`, siis `sudo ./svc.sh stop && sudo ./svc.sh start` | grupiliikmesus loetakse protsessi käivitamisel, seega töötav teenus uut gruppi ei näe |
| deploy `Waiting for a runner` | `systemctl status 'actions.runner.*'`, `gh api …/actions/runners` | runner maas või `runs-on` label'id ei klapi | GitHub annab job'i ainult runner'ile, millel on kõik `runs-on` label'id ja mis on `online` |
| `unauthorized` pull'il deploy job'is | login samm, `packages: read` | login puudub või õigus puudub | privaatse paketi pull vajab sama palju autentimist kui push |
| app01 `unhealthy` | `docker compose logs app01 \| tail -50` | `.env` paroolid erinevad sellest, millega db01 volume 3. kohtumisel loodi: pane `.env`-i tagasi õiged paroolid. Volume'i kustutamine aitab ainult tühja või taastatavate laboriandmete korral; tootmises tee enne varukoopia ja kontrolli taastamist | MariaDB loeb parooli ainult esimesel käivitusel tühja volume'iga, hiljem muudetud `.env` seda ei muuda |
| `/version` näitab vana commit'i | `docker inspect` image, sammu `env:` | `--no-build` puudub või `APP_IMAGE` pole sammu `env:`-is | ilma `APP_IMAGE`-ita kasutab compose vaikimisi image'it ja `build:` plokk ehitab vana koodi |
| leht annab 502 pärast deploy'd | `docker compose logs web01` | `restart web01` puudub: nginx lahendas vana IP | nginx lahendab nime ainult käivitudes ja uuel konteineril on teine IP |
| PR-il käivitus deploy | deploy `if:` | tingimus ei piira `push` + `main`: self-hosted job PR-il on turvaoht | ilma tingimuseta käivituvad kõik job'id igal `on:` sündmusel, ka PR-il |
| `find` ei leia runner'i töökaustast midagi | `ls ~/actions-runner/_work` | töökaust on teises kohas või deploy pole veel käivitunud | töökausta asukoha valid `config.sh` ajal ja see tekib alles esimese job'iga |
| `~/.docker/config.json`-is on ghcr.io kirje | `docker logout ghcr.io` | käsitsi tehtud `docker login` | login-action logib ainult oma sisselogimise välja; sinu käsitsi login jääb kettale |
| **5. Triggerid, saladused ja environment** | | | |
| nuppu *Run workflow* pole | `on:` main'i harus | `workflow_dispatch` on ainult harul, mitte main'is | GitHub näitab nuppu vaikeharu workflow faili järgi |
| ajastatud käivitust pole | cron, vaikeharu | cron on UTC-s ja käivitub ainult vaikeharul | ajakava loetakse ainult vaikeharu failist ja GitHub võib täistunni käivitused edasi lükata |
| `secret … puudub` või väärtus tühi | job'i `environment:`, `gh secret list --env proxmox` | secret on environment'is, aga job ei ütle `environment: proxmox`, või vastupidi | environment'i secret antakse ainult job'ile, mis selle environment'i nimetab; puuduv secret on tühi string, mitte viga |
| `required variable REGISTRY is missing a value` | `.env` samm | samm ei saa `vars.REGISTRY` / `vars.OWNER` | Compose interpoleerib kogu faili enne teenuse valimist ja `:?` nõuab väärtust |
| `Branch … is not allowed to deploy to proxmox` | environment'i haru piirang | käivitasid deploy muult harult kui `main` | GitHub kontrollib piirangut enne, kui job runner'ile antakse; haru piirangu katses on see oodatud tulemus |
| haru piirangu katses deploy käivitus | environment'i *Deployment branches*, job'i `environment:` | piirang pole seatud või job ei nimeta environment'i | ilma `environment:` reata ei kehti job'ile ükski environment'i reegel |
| deploy käivitub, kuigi `DEPLOY_ENABLED=false` | deploy `if:` | `vars.DEPLOY_ENABLED == 'true'` puudub push-tingimusest | muutuja on ainult väärtus; seda loeb ainult tingimus, mis seda nimetab |
| kaks deploy'd töötasid korraga | deploy job'i `concurrency` | grupp puudub või grupi nimi sõltub `run_id`-st | grupp piirab ainult sama nimega töid ja `run_id` on igal käivitusel erinev |
| main'i käivitused tühistavad üksteist | workflow taseme `concurrency` | grupp on `github.ref` ja `cancel-in-progress: true` ka main'il | kõik main'i käivitused on siis samas grupis ja uus katkestab vana, ka poolelioleva deploy |
| **6. Health check ja rollback** | | | |
| `actionlint`: `missing input "version-url"` | `with:` plokk | kohustuslik sisend puudub või on teise nimega | actionlint loeb kohaliku action'i `inputs:` ploki ja võrdleb seda `with:`-iga |
| `Can't find 'action.yml'` | tee ja checkout | action'i kaust on vale või checkout puudub enne `uses: ./…` | `./` tee on runner'i töökaustas ja seal on fail alles pärast checkout'i |
| `Required property is missing: shell` | action'i `run:` samm | composite action'i igal `run:` sammul peab olema `shell: bash` | composite action ei päri workflow vaikimisi shelli |
| `k05 deploy`: ei kontrolli `/version` | `grep -n /version .github/workflows/ci.yml` | aadress on ainult action'is: anna see `version-url` sisendina | automaatne hindaja loeb ainult workflow faile, mitte `.github/actions/` kausta |
| rollback ei käivitu | `prev` sammu väljund, tingimus | `id: prev` puudub, väljund tühi või tingimus pole `failure() && …` | ilma `failure()`-ta on sammu tingimus `success()` ja ebaõnnestunud job'is see vahele jääb |
| rollback käivitus, aga leht on ikka maas | `docker compose ps`, kokkuvõtte rida | `prev` võeti pärast deploy'd (uus image) või web01 jäi restart'imata | pärast deploy'd näitab `Config.Image` juba uut image'it ja rollback paneb sama katkise tagasi |
| katkine HEALTHCHECK ei nurjanud deploy'd | deploy sammu käsk | `--wait` puudub | ilma `--wait`-ita lõpeb `compose up` kohe, kui konteiner käivitub, healthcheck'i tulemust (`healthy`) ootamata |
| `docker events` ei näita midagi | `--since` aeg, filtri label | katkine deploy oli varem kui `--since` või label on vale | Docker tagastab minevikust ainult viimased 1000 sündmust ja filter peab vastama compose'i label'ile täpselt |
| tühistatud deploy järel töötab kontrollimata image, rollback on *skipped* | sammude olekud käivituse lehel | rollback'i tingimus on ainult `failure()` | tühistamisel ja `timeout-minutes`-i ületamisel on tulemus `cancelled` ja `failure()` annab `false`; tingimusse on vaja ka `cancelled()` |
| `prev` võtab rollback'i sihiks katkise image'i | `docker inspect -f '{{.State.Health.Status}}'` app01 konteinerile, `~/.local/state/labseis/last-good` | eelmine deploy katkes enne rollback'i ja jättis ebaterve konteineri | `Config.Image` ütleb, mis töötab, mitte kas see on terve; siht peab tulema viimasest kontrolli läbinud deploy'st |
| **7. Katkine pipeline** | | | |
| `scripts/k05-rike.sh` puudub | `ls scripts/` | vanem starter: `git fetch kursus && git checkout kursus/lahendus/k05 -- scripts/k05-rike.sh` | skript lisati starterisse hiljem kui sinu repo loodi |
| skript: `git status pole puhas` | `git status --short` | tee commit või `git stash` enne | skript teeb uue haru ja commit'i ning ei taha sinu pooleliolevat tööd sinna segada |
| skript: `sudo: a password is required` | `sudo -v` | `sudo -v` ja käivita uuesti | runner'i teenuse peatamine vajab root'i ja skript ei küsi parooli interaktiivselt |
| PR-i ei saa merge'ida | PR-i kontrollid, ruleset | ruleset nõuab rohelisi kontrolle: see on õige, paranda enne | ruleset on just selleks, et punane PR main'i ei jõuaks |
| `runner-valve.sh` annab peatatud teenusega `0` | skripti `systemctl` osa | kontrollib ainult GitHubi olekut | GitHub ootab enne `offline` märkimist ühenduse taastumist, seega lokaalne kontroll on kiirem |
| `runner-valve.sh`: `gh api` annab `404` | `gh repo view`, käivituskaust | skript pole repo kaustas | `{owner}/{repo}` täidetakse käivituskausta Git remote'i järgi |
| **8. Esitamine** | | | |
| tag pole GitHubis | `git ls-remote --tags origin` | tavaline `git push` tag'e ei lükka: `git push origin k05` | Git lükkab vaikimisi ainult harud, tag tuleb nimetada eraldi |
| parandus pärast esitust | `git log --oneline -1 k05` | tag on vana commit'i peal: `git tag -f k05 && git push -f origin k05` | tag on fikseeritud viide ega liigu uue commit'iga kaasa |
| `gh pr create`: `No commits between main and k05-actions` | `git log main..k05-actions` | kõik on juba main'is: jäta PR vahele | haru muudatused on varasemate PR-idega juba main'i jõudnud |
| `k05 files`: `k03-docker/.env on Gitis` | `git ls-files k03-docker` | `git rm --cached k03-docker/.env` ja parool vahetada | fail lisati enne, kui `.gitignore` seda välja jättis, ja ajaloos on parool alles |
| Dependaboti PR-il on deploy *skipped* | deploy `if:` | ootuspärane | deploy käivitub ainult push'il main'i; PR-il, ka Dependaboti omal, see vahele jääb |
| Dependaboti PR-il ebaõnnestuvad secret'eid vajavad sammud | sammu `env:`, *Settings → Secrets → Dependabot* | Dependabot ei saa tavalisi Actionsi secret'eid | Dependaboti PR-id töötavad piiratud tokeniga ja eraldi secret'ite komplektiga, et uuendus ei saaks saladusi lugeda |
