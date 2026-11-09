---
tags:
  - GitHub Actions
  - deploy
  - rollback
---

# 6. Health check ja rollback

See osa jätkab IS1 praktikumi osa [5. Käsitsi käivitus ja saladused](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab-5-saladused/): deploy job kasutab environment'i `proxmox` secret'eid ja kontrollib `/version` vastust.

Praegu on punane deploy sinu probleem: pead serverisse minema ja käsitsi vana versiooni tagasi panema. Nüüd kolib health check composite action'isse, mis ootab õiget commit'i ja tervet `/health`-i. Deploy jätab enne muutust meelde, milline image töötas, ja teeb rollback'i, kui uus versioon ei käivitu. Inimene otsustab endiselt, mis edasi saab, aga leht ei ole otsustamise ajal maas.

Lõpus viid teadlikult katkise versiooni main'i ja vaatad, kuidas pipeline teeb ise rollback'i ja teatab, mis juhtus.

**Kui teed seda tööl iga päev:** `.github/actions/verify-deploy/action.yml` on repos ja main'i deploy, mille HEALTHCHECK ei jõua olekusse `healthy`, lõpeb punaselt nii, et `/version` näitab pärast seda eelmist commit'i. Kui see on sul juba korras, mine otse etappi „[Tühistatud deploy ja viimane terve image](#tuhistatud-deploy-ja-viimane-terve-image)“.

## Kontroll composite action'iks

Viid deploy job'i `/version` health check'i eraldi action'isse, mida saab kutsuda ühe reaga. Sama kontrolli on vaja deploy'l, smoke-testis ja hiljem teises repos. [Composite action](https://docs.github.com/actions/sharing-automations/creating-actions/creating-a-composite-action) töötab kutsuva job'i sees samal runner'il.

Kopeeritud kontroll läheb aja jooksul lahku: ühes kohas parandatakse viga, teises mitte. Siis on kaks deploy'd, mis "kontrollivad sama asja" erineva tulemusega.

1. Kirjuta `.github/actions/verify-deploy/action.yml`:
    - `runs.using: composite`, üks samm `shell: bash`, väärtused sammule `env:` kaudu
    - sisendid `expected-sha` ja `version-url` on kohustuslikud, `service` (vaikimisi `app01`), `workdir` (`k03-docker`) ja `timeout` (`"120"`) mitte
    - kordab iga 3 sekundi järel `docker compose exec -T <service> curl -fsS <version-url>`, kuni `commit` võrdub `expected-sha`-ga, ja ebaõnnestub `::error::`-iga, kui aeg saab täis
    - siis kontrollib, et `/health` annab 200, ja kirjutab `$GITHUB_STEP_SUMMARY`-sse rea commit'i ja tulemusega
2. Asenda deploy job'is senine `/version` samm sellega:

    ```yaml
          - name: Kontroll
            uses: ./.github/actions/verify-deploy
            with:
              expected-sha: ${{ github.sha }}
              version-url: http://localhost:8080/version
    ```

3. Käivita actionlint ja automaatse hindaja kontroll. actionlint loeb ka kohaliku action'i sisendid, automaatne hindaja otsib `/version`-it workflow failist.

    ```bash
    actionlint; echo $?
    bash autograde/check.sh k05 deploy
    ```

> Composite action ei näe `secrets`-konteksti. Kui action vajab saladust, annab kutsuv samm selle `with:` või `env:` kaudu.

Kordav kontroll on töökindlam kui ühekordne, sest konteiner võib olla `healthy`, aga Tomcat laadib rakendust veel. Timeout hoiab ära lõputu ootamise: kui commit ei klapi 120 sekundiga, on see deploy viga, mitte aeglane käivitus. Kokkuvõtte rida on tõend, mida näeb ka see, kes logi ei ava. Kui actionlint kaebab puuduva sisendi üle, on nimi `with:` all ja action'i `inputs:` all erinev.

**Edasi saad minna, kui** actionlint annab `0`, `k05 deploy` annab `OK`, deploy on main'il roheline ja käivituse kokkuvõttes on sinu action'i rida commit'iga.

## Jäta meelde, mis töötas

Lisad deploy'le sammu, mis enne muutust kirjutab üles, milline image praegu töötab.

Ilma selle teadmiseta peab rollback arvama: kas eelmine tag, kas `latest`, kas kõige uuem kohalik image.

1. Lisa deploy job'i samm `id: prev` pärast `.env` kirjutamist ja enne deploy'd:
    - leiab `docker compose ps -q app01` abil konteineri ja `docker inspect --format '{{.Config.Image}}'` abil selle image'i
    - kirjutab `$GITHUB_OUTPUT`-i rea `image=<tag>` (tühi, kui app01 ei tööta)
    - kirjutab sama `$GITHUB_STEP_SUMMARY`-sse
    - ei ebaõnnestu, kui konteinerit pole (esimene deploy tühjas masinas)
2. Vii see main'i ja vaata käivituse kokkuvõtet.

    ```bash
    docker inspect --format '{{.Config.Image}}' "$(cd k03-docker && docker compose ps -q app01)"
    ```

Kokkuvõtte rida ja `docker inspect` andsid sama tag'i, seega loeb samm õiget konteinerit. `Config.Image` on nimi, millega konteiner loodi, mitte image'i ID: see on just see, mida `APP_IMAGE` vajab. Tühi väärtus esimesel deploy'l on õige käitumine, sest siis pole kuhugi tagasi minna. Kui samm ebaõnnestuks tühjas masinas, ei saaks sa kunagi esimest deploy'd teha.

**Edasi saad minna, kui** kokkuvõttes on rida eelmise image'iga ja see võrdub sellega, mida `docker inspect` näitas enne deploy'd.

## Rollback

Lisad sammu `if: failure()`, mis paneb vana image'i tagasi, kui `--wait` või kontroll ebaõnnestub. Job jääb punaseks, sest viga on main'is alles.

Punane job pärast edukat rollback'i on teadlik valik. Kui job läheks roheliseks, ei märkaks keegi, et uus versioon ei jõudnud kunagi tootmisse.

1. Lisa kontrolli järele samm:
    - tingimus `if: failure() && steps.prev.outputs.image != ''`
    - `env: APP_IMAGE: ${{ steps.prev.outputs.image }}`
    - sama `docker compose up -d --no-build --wait` ja `restart web01`, mis deploy sammus
    - `::error::` rida ja kokkuvõttesse, millisele image'ile tagasi mindi
2. Kontrolli, et koristus (`rm -f .env`, `if: always()`) on endiselt viimane samm, ja vii see main'i.

    ```bash
    actionlint && grep -nE 'if: (failure|always)' .github/workflows/ci.yml
    ```

Järjekord failis on ka täitmise järjekord: rollback'i samm peab olema pärast health check'i ja enne koristust, sest ta vajab `.env`-i. Teine tingimus (`prev` pole tühi) hoiab ära katse käivitada tühja nimega image'it. Roheline deploy jättis rollback'i vahele, ja just nii see peab käituma. Kui rollback käivituks ka rohelise deploy järel, oleks tingimus `always()`, mitte `failure()`.

**Edasi saad minna, kui** `grep` näitab rollback'i ja koristuse tingimusi ning roheline deploy jättis rollback'i sammu vahele (*skipped*).

## Katkine versioon main'i

Teed versiooni, mille build ja testid õnnestuvad, aga mis ei käivitu, ja viid selle tavalise PR-iga main'i. CI roheline ei tähenda, et deploy töötab.

Just selline viga jõuab tootmisse: testid ei käivita konteinerit, ülevaataja näeb ühe rea muutust ja kõik kontrollid on rohelised. Rollback on viimane kaitse.

1. Tee värskest main'ist haru `katkine-tervis` ja muuda failis `k03-docker/app/Dockerfile` HEALTHCHECK'i aadress `/health` → `/healthz`.
2. Ava PR, oota rohelisi kontrolle ja merge'i.

    ```bash
    git commit -am "app: healthcheck uuele aadressile" && git push -u origin katkine-tervis
    gh pr create --fill --base main && gh pr checks --watch && gh pr merge --merge
    ```

3. **Ennusta:** mida näitab `/version` pärast deploy'd? Jälgi deploy'd ja kontrolli.

    ```bash
    gh run watch
    curl -s http://localhost:8080/version; echo
    docker inspect --format '{{.Config.Image}}' "$(cd k03-docker && docker compose ps -q app01)"
    ```

4. Võta vigane commit tagasi uue PR-iga ja oota rohelist deploy'd.

    ```bash
    git switch main && git pull && git switch -c revert-tervis
    git revert --no-edit -m 1 HEAD && git push -u origin revert-tervis
    gh pr create --fill --base main && gh pr checks --watch && gh pr merge --merge
    ```

5. Kustuta mõlemad harud ja jätka harul `k05-actions` (`git merge main`).

Deploy ebaõnnestus `--wait` juures, sest uus konteiner ei saanud kunagi `healthy` olekut, ja rollback pani eelmise image'i käima. `/version` näitas vahepeal eelmist commit'i, mis tähendab, et kasutaja nägi töötavat vana versiooni, mitte veateadet. Revert jätab ajalukku nii vea kui selle revert'i. Kui `/version` oleks pärast punast deploy'd tühi, ei käivitunud rollback ja sul tuleb vaadata `prev` sammu väljundit.

**Edasi saad minna, kui** katkise versiooni deploy oli punane ja logis on `::error::` rollback'ist, vahepeal näitas `/version` eelmist commit'i ja app01 image oli eelmine tag, ning pärast revert'i on deploy roheline ja `/version` võrdub `origin/main`-iga.

## Ajajoon: kui kaua leht maas oli

Paned katkise deploy sündmused Dockeri enda logist ajajoonele. GitHubi logi ütleb, mida pipeline tegi; Docker ütleb, mida konteinerid tegid.

Juhtkond küsib, kui kaua kasutajad viga nägid. Sellele vastab ainult ajajoon sekunditega.

1. Loe viimase tunni app01 konteinerite sündmused.

    ```bash
    docker events --since 1h --until "$(date +%s)" --filter type=container \
      --filter label=com.docker.compose.service=app01 \
      --format '{{.Time}} {{.Action}} {{.Actor.Attributes.image}}' \
      | grep -E 'start|die|health_status' | while read -r t a i; do echo "$(date -d "@$t" +%T) $a $i"; done
    ```

2. Leia katkise deploy käivitusest deploy ja rollback'i sammu algus- ja lõpuaeg (*Actions* → käivitus → deploy → sammu kellaaeg).
3. Pane sündmustest kokku ajajoon: vana konteineri `die`, uue `start`, rollback'i `start` ja `healthy`. Mitu sekundit ei töötanud ükski terve app01?

Ajajoonel näed, et vana konteiner peatati enne, kui uus oli terve, sest `compose up` asendab teenuse, mitte ei pane uut kõrvale. Aeg vana `die` ja rollback'i `healthy` vahel on sinu katkestus ja see on peaaegu kogu `--wait-timeout` pikkune. Siit järeldad, et lühem timeout lühendab katkestust, aga liiga lühike nurjab ka aeglaselt käivituva terve versiooni. Kui ajajoonel pole `die` sündmust, oli deploy ajal konteiner juba maas ja katkestus algas varem.

**Edasi saad minna, kui** tead katkestuse kestust sekundites ja oskad öelda, mis seda lühendaks.

## Tühistatud deploy ja viimane terve image

Rollback'i samm käivitub ainult siis, kui mõni samm ebaõnnestub. Kui keegi vajutab *Cancel* ajal, mil deploy ootab `--wait`-i juures, või job ületab `timeout-minutes`-i, on tulemus `cancelled`. Siis annab `failure()` väärtuse `false` ja tööle jääb image, mida keegi pole kontrollinud. Kui runner'i protsess sureb keset deploy'd, ei käivitu ükski järgmine samm. Järgmine deploy loeb `prev` sammus töötava konteineri image'i ja võtab rollback'i sihiks just selle kontrollimata image'i.

Lõpus teeb deploy rollback'i ka tühistamisel ja rollback'i siht tuleb viimasest kontrolli läbinud deploy'st, mitte sellest, mis parasjagu töötab.

1. Muuda deploy job'i:
    - rollback'i samm käivitub ka tühistamisel: tingimus `(failure() || cancelled()) && …`
    - pärast õnnestunud kontrolli kirjutab uus samm runner'i masinas faili `~/.local/state/labseis/last-good` image'i, mis just kontrolli läbis
    - `prev` võtab töötava konteineri image'i ainult siis, kui konteiner on `healthy` (`{{.State.Health.Status}}`), muidu faili `last-good` sisu; kokkuvõttesse läheb, kumba kasutati ja miks
    - koristus jääb viimaseks sammuks ja actionlint vaikib
2. Vii muudatus PR-iga main'i. Kui main'i käivituses jõuab deploy job sammu *Deploy* juurde, tühista käivitus.

    ```bash
    id=$(gh run list -w ci -b main -L 1 --json databaseId --jq '.[0].databaseId')
    until gh run view "$id" --json jobs --jq '.jobs[] | select(.name == "deploy") | .steps[] | select(.name == "Deploy") | .status'       | grep -q in_progress; do sleep 5; done; gh run cancel "$id"
    gh run watch "$id"; curl -s http://localhost:8080/version; echo
    ```

3. Käivita sama käivitus uuesti (`gh run rerun "$id"`) ja oota rohelist deploy'd.
4. Tee app01 ebaterveks ilma koodi muutmata ja käivita deploy nupuga. Deploy ise toob rmq01 sõltuvusena tagasi.

    ```bash
    docker stop "$(docker ps -q -f label=com.docker.compose.service=rmq01)"; sleep 60
    docker inspect -f '{{.State.Health.Status}}' "$(docker ps -q -f label=com.docker.compose.service=app01)"
    gh workflow run ci.yml --ref main -f deploy=deploy
    ```

5. Kontrolli tulemust.

    ```bash
    cat ~/.local/state/labseis/last-good
    docker ps -f label=com.docker.compose.service=app01 --format '{{.Image}} {{.Status}}'
    ```

Tühistatud käivituse logis on rollback'i samm roheline ja `/version` näitab eelmist commit'i: kasutaja ei jäänud kontrollimata versiooni peale. `docker compose up --wait` katkeb, aga juba loodud konteiner jääb tööle, seepärast on rollback'i samm vajalik. Ebaterve app01-ga käivituse kokkuvõttes on rollback'i sihiks `last-good`, mitte töötav image. See on oluline siis, kui eelmine deploy katkes nii, et ükski samm ei käivitunud. Kui kokkuvõttes on ikka töötava konteineri image, loeb `prev` health olekut valest kohast: `docker inspect` vajab konteineri ID-d, mitte image'i nime.

**Edasi saad minna, kui** tühistatud käivituses käivitus rollback'i samm ja `/version` näitas eelmist commit'i, korduskäivitus oli roheline, ebaterve app01-ga deploy kokkuvõttes on rollback'i siht võetud failist `last-good`, faili sisu võrdub töötava app01 image'iga ja actionlint vaikib.

## Miks see nii töötab

??? info "Ava selgitused"

    **Composite action.** Composite action'i sammud kuvatakse logis kutsuva sammu all. Need sammud kasutavad sama töökausta, sama keskkonda ja sama runner'it nagu kutsuv job.

    **Rollback ja image'i tag.** Rollback kasutab image'i tag'i, mis oli enne deploy'd konteineri väljal `Config.Image`. Kui see tag on registry'st kustutatud, kuid lokaalselt alles, rollback töötab, sest rollback'i samm ei käivita `pull`-i: piisab võtmest `--no-build` ja lokaalsest image'ist.

    **`/health` ja `/health/live`.** `/health` vastab 200 ainult siis, kui db01 ja rmq01 vastavad, seega sobib see deploy kontrolliks. `/health/live` vastab alati, kui protsess töötab. Seda kasutab 7. kohtumisel livenessProbe, sest andmebaasi katkestuse pärast ei tohi rakenduse konteinerit taaskäivitada.

    **HEALTHCHECK image'is.** HEALTHCHECK on image'i osa. Seetõttu toob vana image kaasa ka vana HEALTHCHECK'i, kui `compose.yaml` seda `healthcheck:`-plokiga üle ei kirjuta. Vaikeväärtused on `interval` 30 s, `timeout` 30 s, `retries` 3 ja `start-period` 0, nii et katkine konteiner jõuab olekusse `unhealthy` umbes 90 sekundiga. `--wait-timeout` peab olema sellest pikem, muidu ebaõnnestub deploy enne, kui Docker on otsustanud.

    **Rollback ja andmed.** Rollback on ohutu ainult siis, kui vana versioon oskab töötada andmetega, mille uus versioon on jätnud. Meie rakendus ei muuda selle päeva versioonides andmebaasi skeemi, seega saab vana image'it kasutada.

    **Skeemi muutus deploy'l.** Tootmissüsteemis tähendab skeemi muutus, et deploy tehakse kahes osas: kõigepealt skeem, mis sobib mõlemale versioonile, ja seejärel kood.

    **Katkestuse ajajoon.** `docker events` tagastab minevikust ainult viimased 1000 sündmust, nii et hõivatud hostil tuleb ajajoon koostada kohe pärast intsidenti.

    **Tühistamine ja `failure()`.** Tühistamisel märgib GitHub käivituse olekuks `cancelled` ja hindab ülejäänud sammude tingimused uuesti. Sammud tingimusega `always()` või `cancelled()` käivituvad, `failure()` annab `false`. Töötavale sammule saadab runner SIGINT-i, 7,5 sekundi pärast SIGTERM-i ja 2,5 sekundi pärast tapab protsessipuu ([Workflow cancellation](https://docs.github.com/actions/reference/workflows-and-actions/workflow-cancellation)). `timeout-minutes`-i ületamine lõpeb samuti tühistamisega. Kui runner'i protsess ise sureb, ei käivitu ükski samm ja ainus jälg, mis järgmisele deploy'le jääb, on see, mis on kettal: siin fail `last-good`.

    **Katkestuseta deploy.** Katkestuseta deploy vajaks kahte konteinerit ja koormusjaoturit, mis suunab liikluse uuele konteinerile alles siis, kui see on terve. Nii töötab Kubernetes (7. kohtumine).

    **Smoke test seestpoolt.** Smoke test käivitub runner'i masinast ja vaatab süsteemi seestpoolt. See ei näita, kas leht on kättesaadav väljastpoolt VPN-i. Seda osa kontrollib monitooringu kodutöö, mis kontrollib sama aadressi teisest kohast.

Kui jõudsid kiiremini: [Lisaülesanded → 7. Smoke test](lisa.md#7-smoke-test), kontrollid ajakava järgi `/health`-i läbi web01 ja vaatad, et kontroll läheb punaseks, kui teenus seisab.
