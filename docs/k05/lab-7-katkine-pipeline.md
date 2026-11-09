---
tags:
  - GitHub Actions
  - veaotsing
---

# 7. Katkine pipeline

See osa eeldab, et IS1 praktikum [Maven ja GitHub Actions](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab/) ja selle kursuse osa [6. Health check ja rollback](lab-6-tagasipoore.md) on tehtud.

Selles osas otsid vigu nagu intsidendis. Skript `scripts/k05-rike.sh` teeb haru `k05-rike` neli riket eri kohtades, avab PR-i pealkirjaga „deploy kiiremaks“ ja peatab ühe asja sinu control node'il. Keegi ei ütle, mis on katki, ja nagu intsidendis on sümptom ühes kohas, põhjus teises ning esimene oletus sageli vale. Lõpus on PR main'is, deploy roheline ja iga paranduse põhjus commit'i sõnumis.

Kontrolli järjest faili, runner'it, tokeni õigusi ja väärtusi ning paranda iga viga seal, kus see on. Ära paranda midagi, mida sa pole enne näinud katki olevat.

**Kui teed seda tööl iga päev:** pärast etappi „Rike paika“ parandad neli riket ilma veaotsingu tabelita ja alla 45 minutiga (`gh run list -b main -L 1` näitab rohelist deploy'd). Kui see on sul juba korras, mine otse etappi „[Valve, mis oleks rikke varem leidnud](#valve-mis-oleks-rikke-varem-leidnud)“.

Veaotsingu tabel ei ütle, milline rida sinu PR-is kehtib: mõni rida ei kehti üldse ja mõni sümptom tuleb välja alles pärast eelmise vea parandamist.

| Sümptom | Vaata esimesena | Tõenäoline koht |
|---|---|---|
| käivitusel pole ühtegi job'i, `Invalid workflow file` | `actionlint`, käivituse lehe ülaosa | `ci.yml` struktuur |
| job on kollane, *Waiting for a runner to pick up this job* | *Settings → Actions → Runners*, `journalctl -u 'actions.runner.*'` | control node või `runs-on` |
| samm ebaõnnestub `denied`, `403` või `unauthorized` peale | *Set up job* → *GITHUB_TOKEN Permissions* | job'i `permissions:` |
| samm ütleb, et muutuja on tühi või puudub | sammu `env:` read, `gh secret list --env proxmox` | secret'i nimi või `environment:` |
| deploy ebaõnnestub, rollback käivitus | app01 logi, `docker compose ps` | uus image või konfiguratsioonifail |

*Tabel L5.2. Veaotsingu tabel.*

> Kui jääd täiesti kinni enne merge'i: `bash scripts/k05-rike.sh --taasta` sulgeb PR-i, kustutab haru ja käivitab peatatu. Pärast merge'i parandad edasi, tagasi ei keri.

## Rike paika

Alustad teadaolevalt töötavast olekust ja lased skriptil rikked paika panna. Pärast rollback'i katset on main'i deploy roheline.

Kui algseis pole roheline, ei tea sa hiljem, kas viga tuli kolleegi PR-ist või oli juba enne olemas.

1. Kontrolli algolekut.

    ```bash
    git switch main && git pull && git status --short
    gh run list -w ci -b main -L 1
    curl -s http://localhost:8080/version; echo
    ```

2. Käivita skript ja ava PR. Ära loe skripti enne, kui kõik neli on leitud.

    ```bash
    bash scripts/k05-rike.sh
    gh pr view k05-rike --web
    ```

Jäta meelde algoleku `/version` commit ja main'i viimane käivitus: need on võrdluspunkt kogu osa jooksul. Kui skript katkes enne PR-i avamist, vaata selle viimast väljundirida: see ütleb, mis eeldus jäi täitmata.

**Edasi saad minna, kui** PR "Kolleegi muudatus: deploy kiiremaks" on avatud ja selle esimene käivitus on *Actions* vahekaardil.

## PR roheliseks

Esimene eesmärk on saada PR-i kontrollid roheliseks. PR-il ja haru push'il käivituvad build, security, compat ja image. Deploy siin ei käivitu.

Viga, mille PR-i kontroll leiab, ei jõua tootmisse.

1. Vaata haru `k05-rike` viimast push'i käivitust ja PR-i kontrolli. Leia veaotsingu tabelist rida, mis sümptomiga sobib.

    ```bash
    gh run list -b k05-rike -L 3
    actionlint; echo $?
    ```

2. Paranda viga failis harul `k05-rike`, commit sõnumiga `fix(ci): <põhjus>` ja push.
3. Korda, kuni haru push'i käivitus ja PR-i kontroll on mõlemad rohelised. Järgmine viga võib ilmuda alles siis, kui eelmine on parandatud.
4. Pane iga leitud vea juures tähele sümptomit, põhjust ja käsku, millega selle leidsid. Neid vajad järelanalüüsis.

Võrdle iga paranduse järel PR-i kontrolli ja haru push'i käivitust. Need ei pruugi olla samad, sest push'i käivitus lükkab image'i registrisse ja PR-i käivitus mitte, seega mõni samm käivitub ainult ühes neist. Kui parandus tegi ühe roheliseks ja teine jäi punaseks, on sul vähemalt veel üks viga, mis puudutab ainult seda sündmust.

**Edasi saad minna, kui** haru `k05-rike` push'i käivituses on image job roheline ja lükkas uue sha7 tag'i ning PR-i kontrollid on rohelised.

## Deploy roheliseks

Merge'id PR-i ja jälgid main'i käivitust, kus nüüd käivitub ka deploy. Kaks viga on veel alles.

Tavaline olukord: kõik PR-i kontrollid olid rohelised ja viga tuli välja alles tootmises.

1. Merge'i PR ja jälgi main'i käivitust.

    ```bash
    gh pr merge k05-rike --merge
    gh run watch
    ```

2. Leia veaotsingu tabelist rida, mis sümptomiga sobib, ja paranda viga seal, kus see on. Failis tehtud parandus läheb commit'ina `fix(ci): …` uue PR-iga. Masinas tehtud paranduse käsu kirjuta selle PR-i kirjeldusse.
3. Kui deploy on punane, aga rollback käivitus, kontrolli, mis töötab.

    ```bash
    curl -s http://localhost:8080/version; echo
    git fetch && git rev-parse origin/main
    ```

4. Korda, kuni main'i deploy on roheline.

Kui `/version` näitab algoleku commit'i, töötas rollback ja kasutajad ei näinud viga. See annab sulle aega rahulikult põhjust otsida. Kui `/version` ei vasta üldse, on stack maas ja esimene töö on see püsti saada, alles siis põhjus. Masinas tehtud parandus ei ole Gitis näha, seepärast on PR-i kirjelduses olev käsk ainus jälg, mis sellest jääb.

**Edasi saad minna, kui** main'i viimane käivitus on roheline koos deploy'ga, `/version` võrdub `origin/main`-iga ja runner on `online`.

## Järelanalüüs

Järelanalüüs vastab iga rikke kohta küsimusele: milline automaatne kontroll oleks selle leidnud enne merge'i? Iga rike oli eri kohas.

Kui iga rea viimane veerg on "olla tähelepanelikum", pole sa veel kontrolli leidnud.

1. Kirjuta parandus-PR-i kirjeldusse iga vea kohta sümptom, asukoht, põhjus, parandus ja kontroll, mis oleks selle enne merge'i leidnud (näiteks actionlint, PR-i image job, nõutud kontroll ruleset'is, runner'i monitooring).
2. Kustuta haru `k05-rike` ja vaata, et kõik kontrollid on endiselt korras. `-D` on siin lubatud, sest parandused on juba main'is.

    ```bash
    git push origin --delete k05-rike; git branch -D k05-rike
    for c in actionlint build structure deploy hygiene; do bash autograde/check.sh k05 $c; done
    ```

Loe kokku, mitu viga oleks PR-i kontroll leidnud ja mitu tuli välja alles main'il. See suhe näitab, kui palju sinu pipeline'i kontrollidest käivitub enne merge'i. Viis `OK`-d tähendab, et parandused ei rikkunud ühtki varasemat nõuet.

**Edasi saad minna, kui** PR-i kirjelduses on neli viga koos kontrolliga, mis oleks need leidnud, ja kõik viis kontrolli annavad `OK`.

## Valve, mis oleks rikke varem leidnud

Kirjutad väikese skripti, mis vastab ühele küsimusele: kas sinu deploy runner on praegu valmis tööd võtma. Pipeline ise seda ei küsi: job jääb lihtsalt ootama ja keegi ei saa teada, et midagi on valesti.

Kollane job, mis ootab tunde, on vaikne rike, ja 24 tunni pärast ebaõnnestub see ilma ühegi sammuta. Valve, mida saab käivitada cron'ist, monitooringust või käsitsi, muudab selle nähtavaks enne, kui keegi deploy'd vajab.

Kirjuta `scripts/runner-valve.sh`:

- loeb `gh api 'repos/{owner}/{repo}/actions/runners'` vastusest runner'id, millel on label `labseis`, ja trükib iga kohta rea nime ja olekuga
- kontrollib, et control node'il on teenus `actions.runner.*` aktiivne (`systemctl is-active`)
- lõpetab koodiga `0`, kui vähemalt üks `labseis` runner on `online` ja teenus aktiivne; muidu kirjutab põhjuse stderr'i ja lõpetab koodiga `1`
- läbib `shellcheck -S warning`

```bash
shellcheck -S warning scripts/runner-valve.sh
bash scripts/runner-valve.sh; echo "valve $?"
u=$(systemctl list-units --plain --no-legend 'actions.runner.*' | awk '{print $1}')
sudo systemctl stop "$u"; bash scripts/runner-valve.sh; echo "valve $?"; sudo systemctl start "$u"
```

Teenuse kontroll annab vastuse kohe, GitHubi olek muutub `offline`-iks alles mõne aja pärast, sest GitHub ootab enne otsustamist ühenduse taastumist. Seepärast on mõlemad kontrollid vajalikud: lokaalne näeb kohe, GitHubi oma näeb ka võrgu- ja registreerimisvigu. Kui skript annab peatatud teenusega `0`, kontrollib see ainult GitHubi olekut ja jääb hiljaks.

**Edasi saad minna, kui** shellcheck vaikib, töötava runner'iga annab skript `0`, peatatud teenusega `1` koos põhjusega ja lõpus on runner jälle `online`.

## Miks see nii töötab

??? info "Ava selgitused"

    **Vigade otsimise järjekord.** Vigu on otstarbekas otsida samas järjekorras, nagu GitHub workflow'd töötleb: kõigepealt fail, siis runner, siis tokeni õigused ja lõpuks väärtused. Sama järjekord sobib 6. kohtumisel ka Jenkinsile.

    **Sümptom ja asukoht.** Iga koht annab oma sümptomi. Vigane fail ei tekita ühtegi job'i, runner'i viga tekitab job'i, mis jääb ootama, ja õiguste viga annab sammu, mis lõpeb koodiga `403`. Vale väärtus annab sammu, mis töötab, kuid teeb valet asja. Kui tunned sümptomi järgi koha ära, on otsitav ala kohe väiksem.

Kui jõudsid kiiremini: [Lisaülesanded → 15. Ühekordne runner](lisa.md#15-uhekordne-runner), asendad püsiva runner'i ühekordsega, mis iga job'i järel kaob.
