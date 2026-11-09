---
tags:
  - GitHub Actions
  - CI/CD
  - Loeng
---

# Loeng: GitHub Actions lähemalt

Loeng jätkab IS1 [pideva integratsiooni ja tarne loengut](https://hkhk-tk.github.io/is1-automatiseerimine/k05/loeng/): DORA näitajad, ebastabiilsed testid, webhook, korratav build, võõras kood workflow's, turvakontrollid ja allkiri, rünnakud build'i vastu, deploy strateegiad, muudatuste haldus ja runner'i turve.

## DORA ja ebastabiilsus

IS1 loengu osa „Pidev integratsioon ja DevOps automation“ seletas CI ja CD mõisteid. Tarne kiirust ja kvaliteeti mõõdetakse DORA näitajatega.

DORA mõõdab tarnimist viie näitajaga ([DORA metrics](https://dora.dev/guides/dora-metrics/)). Läbilaskevõimet näitavad aeg commit'ist tootmiseni, deploy'de sagedus ja taastumisaeg ebaõnnestunud deploy'st. Ebastabiilsust näitavad ebaõnnestunud muudatuste osakaal ja deploy'de ümbertöö osakaal: plaanimata deploy'd, mille tootmisintsident peale sundis. Küsitlusuuringud väidavad aastast aastasse, et sagedamini ja väiksemate muudatustega tarnivad meeskonnad ei maksa selle eest suurema rikete osakaaluga. See on korrelatsioon küsitlusandmetest, mitte tõestatud põhjuslik seos. Adminitöös on otsesem teine tagajärg: kui pipeline rakendab igal deploy'l koodis kirjeldatud soovitud oleku uuesti, kirjutab järgmine deploy käsitsi tehtud paranduse üle samamoodi nagu playbook.

## Ebastabiilsed testid

IS1 loengu osa „Pipeline kui graaf“ seletas job'e, `needs:` võtit ja quality gate'i. Quality gate on nii usaldusväärne kui selle kõige ebakindlam test.

Graafi usaldusväärsuse määrab selle kõige ebakindlam tipp. Google'i andmetel andis umbes 1,5% kõigist testikäivitustest ebastabiilse tulemuse ja ligi 16% testidest ebaõnnestus vahel ilma koodi muutuseta ([Flaky Tests at Google](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html)). Sadade testidega job'is ei tähenda punane tulemus siis enam viga ja meeskond hakkab vajutama „Re-run failed jobs“. Sellest hetkest on quality gate'i tulemus juhuslik. Ebastabiilne test pannakse karantiini ja määratakse omanikule, mitte ei korrata automaatselt, sest automaatne kordus peidab ka tegeliku race condition'i.

## Webhook: sündmus väljaspool GitHubi

Graafi käivitab sündmus: `push`, `pull_request`, ajakava või käsitsi nupp. Väljaspool GitHubi, näiteks AWX-is, Semaphore'is, Jenkinsis või ITSM-süsteemis, jõuab sama sündmus kohale **webhook**'ina. GitHub saadab HTTP POST-i JSON-sisuga ja allkirjastab selle HMAC-SHA256-ga päisesse `X-Hub-Signature-256`. Vastuvõtja peab allkirja kontrollima ja vastama 10 sekundi jooksul, muidu on saatmine ebaõnnestunud ([webhookide head tavad](https://docs.github.com/webhooks/using-webhooks/best-practices-for-using-webhooks)). Ebaõnnestunud saatmist GitHub ise ei korda, käsitsi saab seda teha kolme päeva jooksul. Seepärast kinnitab vastuvõtja ainult kättesaamise, pikk töö läheb järjekorda ja ajastatud käivitus asendab kadunud sündmuse.

## Korratav build

IS1 loengu osa „Build kui korratav artefakt“ seletas Maveni elutsüklit ja põhimõtet build once, deploy many. Korratavust murravad kaks Maveni omadust. Versioonikonflikti lahendab reegel „lähim võidab“: kui sama teek on puus kahel sügavusel, võetakse madalam, mitte uuem, ja uue otsese sõltuvuse lisamine võib transitiivse versiooni vaikselt alla viia. `-SNAPSHOT` on liikuv versioon, mis annab homme sama koordinaadi all teise faili, Maven Centrali release aga on muutumatu.

Build once on vajalik ka seepärast, et sama allikas ei anna vaikimisi baidi täpsusega sama tulemust. JAR on ZIP-arhiiv, kuhu satuvad failide ajatemplid ja järjestus, nii et kaks build'i samast commit'ist annavad erineva räsi. Maveni [korratava build'i juhend](https://maven.apache.org/guides/mini/guide-reproducible-builds.html) fikseerib ajatemplid omadusega `project.build.outputTimestamp`. Konteineri puhul on sama roll digest'il: tag on viide, `sha256:` digest on image'i manifesti räsi. Deploy, mis tõmbab image'i digest'iga, saab täpselt selle, mida testiti, ka siis, kui keegi tag'i hiljem ümber suunab. Korratav build ja build once lahendavad eri probleemi. Esimene laseb kolmandal osapoolel kontrollida, et binaar tuli sellest allikast. Teine hoiab ära, et seda peaks iga deploy'ga uuesti kontrollima.

## Võõras kood workflow's: `pull_request_target` ja avaldised

IS1 loengu osa „Tarneahela usaldus“ seletas, miks action kinnitatakse SHA-ga ja miks `GITHUB_TOKEN` saab ainult vajalikud õigused. Ohtlikuim muster on `pull_request_target`: see töötab sihtharu kontekstis koos secret'ite ja kirjutusõigusega tokeniga. Kui workflow teeb seal forgi koodi checkout'i ja ehitab selle, käivitub võõras kood sinu õigustega. Sama kehtib väärtuste kohta, mida kirjutab keegi teine: haru nimi, PR-i pealkiri, commit'i sõnum. Avaldis `${{ }}` asendatakse enne, kui shell skripti saab, nii et otse `run:` reale pandud haru nimi võib olla käsk. Väärtus peab shelli jõudma `env:` muutujana ([GitHubi turvajuhend](https://docs.github.com/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)).

## Turvakontrollid PR-is, SBOM ja allkiri

IS1 loengus oli Trivy job, mis skännib sõltuvusi igal push'il. Shift-left viib kontrolli sinna, kus parandus on odavaim: PR-is käivad enne merge'i saladuste otsing (näiteks [gitleaks](https://github.com/gitleaks/gitleaks)), sõltuvuste skänn ja IaC-failide kontroll (`trivy config`). Image'i job lisab kaks asja. SBOM-i, mida 3. kohtumisel käsitsi tegid, genereerib build ise ja see salvestatakse image'i kõrvale. Image allkirjastatakse [cosign](https://docs.sigstore.dev/cosign/signing/overview/)'iga ilma püsivõtmeta: job saab GitHubilt OIDC tokeni (`id-token: write`), Sigstore'i Fulcio annab selle järgi kümneminutilise sertifikaadi ja allkiri läheb avalikku transparency log'i Rekor. Sertifikaadis on kirjas, milline workflow ja milline haru image'i tootis. Allkiri on väärtus ainult siis, kui deploy seda enne `pull`-i kontrollib:

```bash
cosign verify "$IMAGE@$DIGEST" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity "https://github.com/$REPO/.github/workflows/ci.yml@refs/heads/main"
```

Kompromiss on müra ja sõltuvus. Skanner, mis annab igal PR-il kakskümmend HIGH leidu, õpetab meeskonna neid ignoreerima: lävi peab olema range uuele koodile ja erandid (`.trivyignore`) kirjas põhjuse ja aegumisega. Keyless allkiri sõltub Sigstore'i avalikust teenusest. Internetist eraldatud võrgus tähendab see oma Fulcio ja Rekori või võtmega allkirja koos võtme haldusega. [SLSA](https://slsa.dev/) kirjeldab sama mõtet tasemetena: kas sa saad tõendada, milline allikas, build-keskkond ja protsess artefakti tootis.

## Kui rünnatakse build'i ennast

Allkiri tõendab, kes artefakti tootis, aga mitte seda, et build oli puhas. SolarWindsi juhtumis 2020. aastal muutis ründaja ettevõtte build-serveris Orioni tarkvara build'i ajal ja pahavara SUNBURST jõudis klientideni ettevõtte enda allkirjaga ([CISA AA20-352A](https://www.cisa.gov/news-events/cybersecurity-advisories/aa20-352a)). Koodi ülevaatus ega allkirja kontroll seda ei näinud, sest muutus tekkis allika ja artefakti vahel. xz-utils'i tagauks 2024. aastal ([CVE-2024-3094](https://nvd.nist.gov/vuln/detail/CVE-2024-3094)) kasutas sama vahet teisest otsast: tagaukse aktiveeriv osa oli ainult väljalaske tarball'is, mitte Giti repos, mida inimesed lugesid. Mõlemast järeldub sama nõue. Build käib lühiajalises isoleeritud keskkonnas, sisend on Giti commit, mitte käsitsi üles laaditud arhiiv, ja provenance seob artefakti selle commit'i ja workflow'ga. Neid nõudeid kirjeldavad SLSA build-tasemed. Hallatud runner täidab neist esimese juba praegu, püsiv build-server mitte.

## Deploy risk: levitamine, canary ja blue-green

IS1 loengu osa „Deployment automation: risk ja rollback“ seletas, millal deploy on õnnestunud ja mida teeb rollback. Riski määravad muudatuse suurus ja see, kui paljusid masinaid muudatus korraga puudutab.

19. juulil 2024 saatis CrowdStrike kõigile Falcon-agentidele korraga sisu-uuenduse, mis pani Microsofti hinnangul umbes 8,5 miljonit Windowsi masinat sinisele ekraanile ([CrowdStrike PIR](https://www.crowdstrike.com/falcon-content-update-remediation-and-guidance-hub/)). Koodi väljalasked läksid välja etappide kaupa, sisu-uuendused mitte. PIR-i järeldus oli viia etappidesse ka need.

Seda, kui paljusid masinaid muudatus korraga puudutab, vähendavad etapiviisiline levitamine, canary ja ühe serveri puhul vähemalt see, et korraga töötab ainult üks deploy. [`concurrency`](https://docs.github.com/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)-grupis on korraga üks töötav ja üks ootav töö ning uus ootaja tühistab vana. Viimane soov võidab ja vahepealset versiooni ei paigaldata kunagi.

Mitme serveri puhul lisandub rike, mida concurrency ei kata: osaline deploy. 2012. aasta juuli lõpus paigaldas Knight Capital uue kauplemiskoodi käsitsi kaheksale serverile ja üks server jäi uuendamata. 1. augustil kasutas uus versioon uuesti vana lippu, mis sellel serveril käivitas aastaid kasutamata koodi. 45 minutiga tekkis üle 460 miljoni dollari kahju ([SEC-i otsus](https://www.sec.gov/litigation/admin/2013/34-70694.pdf)). SEC-i järgi ei nõudnud ükski protseduur, et teine inimene deploy'd üle vaataks. Pipeline lahendab sellest kaks osa: kõik sihtmasinad saavad sama artefakti sama sammuga ja health check küsib versiooni igalt masinalt, mitte ühelt. Kolmandat osa ei näe ükski deploy-kontroll: lipp, mille tähendus muutub, ja kood, mida ei kustutatud.

Rollback'il on üks oluline piir: andmed. Kui uus versioon muutis andmebaasi skeemi, ei pruugi vana versioon uute andmetega töötada. Tavaline lahendus on *expand/contract*: kõigepealt läheb välja skeem, mis sobib mõlemale versioonile, siis kood, mis uut skeemi kasutab, ja vana veerg eemaldatakse alles järgmises väljalaskes. "Kas saame tagasi minna?" on küsimus enne deploy'd, mitte pärast.

Suures skaalas sõltub strateegia valik sellest, mis on kallim: maht või aeg. Canary saab väikese osa liiklusest ja pipeline võrdleb selle veamäära ja latentsust vana versiooniga. Kui võrdlust teeb inimene graafikult, venib iga etapp tundideks. Blue-green paneb uue versiooni täies mahus kõrvale ja vahetab liikluse korraga. Rollback võtab siis sekundeid, aga vajab kahekordset mahtu ega aita skeemimuudatuse puhul. Feature flag eraldab deploy'i väljalaskest: kood on tootmises välja lülitatud ja lülitatakse sisse eraldi, nii et rollback on konfiguratsioonimuudatus. Hind on lippude elutsükkel, nagu Knighti juhtum näitas.

## Muudatuste haldus pipeline'is

Audiitor küsib ühe tootmismuudatuse kohta kolme asja: kes kinnitas, mis täpselt muutus ja kus on tõend. Käsitsi deploy puhul on vastus ITSM-i tiketis (ServiceNow, Jira Service Management, avatud lähtekoodiga [GLPI](https://glpi-project.org/) või iTop) ja CAB-i protokollis. Pipeline'iga deploy puhul peab vastus olema sama, aga see peab tekkima ilma käsitööta.

ITIL 4 eristab kolme muudatuse tüüpi: standardmuudatus on madala riskiga eelnevalt kinnitatud protseduur, tavaline muudatus vajab hindamist ja kinnitust ning erakorraline muudatus registreeritakse tagantjärele. Pipeline teeb rakenduse deploy'st standardmuudatuse. Protseduur kinnitatakse üks kord, kui muudatuste haldur vaatab üle workflow ja selle kontrollid, ja iga deploy on selle protseduuri käivitus. Workflow muutmine on aga tavaline muudatus, sest muutub protseduur ise. Seepärast on `.github/workflows/` kaustal CODEOWNERS-i reegel ja nõutud ülevaataja.

Tavalise muudatuse kinnitus on GitHubis **[environment](https://docs.github.com/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)**'i protection rule. Deploy job, mis nimetab environment'i `production`, ootab, kuni nõutud ülevaataja (kuni 6) kinnitab, ja GitHub salvestab, kes ja millal. Ooteaeg võib olla kuni 30 päeva. Ülevaatajad on Free ja Team plaanil saadaval ainult avalikus repos, privaatses repos tehakse käsitsi kinnitus workflow sees. [Custom deployment protection rule](https://docs.github.com/actions/how-tos/deploy/configure-and-manage-deployments/create-custom-protection-rules) laseb GitHub Appil, näiteks ITSM-i integratsioonil, deploy'd kinnitada või tagasi lükata. Privaatses repos vajab see Enterprise plaani.

Tikett tekib pipeline'ist. Enne deploy'd teeb job ITSM-i REST API-sse päringu, mis avab muudatuse kirje: teenus, image'i digest, commit, PR ja käivituse URL. Pärast health check'i suleb sama job kirje tulemusega, ebaõnnestunud deploy avab intsidendi koos rollback'i infoga. Kirje viitab Gitile ja Gitis on link kirjele. DORA ebaõnnestunud muudatuste ja ümbertöö osakaal tulevad samadest kirjetest: intsidendi tõttu tehtud erakorraline muudatus on ümbertöö.

Kompromiss tuleb otsustada enne, kui ITSM-i API esimest korda ei vasta. Kui deploy siis peatub (fail-closed), on ITSM kõigi tarne üksik rikkepunkt. Kui deploy jätkub (fail-open), tekib muudatus ilma kirjeta ja see tuleb hiljem järele teha. Tavaline valik on standardmuudatusel jätkata ja kirje hiljem luua, tavalisel muudatusel peatuda. Teine lõks on topeltkinnitus: kui PR-i review ja CAB kinnitavad sama asja, hakatakse ühte neist formaalselt tegema.

DORA uuringus ei olnud välise heakskiidu, näiteks CAB-i, nõue seotud väiksema ebaõnnestunud muudatuste osakaaluga, küll aga aeglasema tarne ja suuremate pakettidega ([Streamlining change approval](https://dora.dev/capabilities/streamlining-change-approval/)). Pangas või riigiasutuses ei kao CAB sellest kuhugi, kui regulatsioon nõuab tõendatud kontrolli. Muutub CAB-i töö sisu. Üksikute deploy'de kinnitamise asemel kinnitab ta protseduure, peab standardmuudatuste nimekirja ja analüüsib ebaõnnestunud muudatusi pipeline'i kirjete põhjal. PR-i review ja automaatne kontroll annavad audiitorile tõendi iga muudatuse kohta, mitte valimi kohta.

Iseseisvaks lugemiseks: [IT-teenuste haldus (ITSM)](https://hkhk-tk.github.io/is1-automatiseerimine/teemad/itsm/).

## Runner'i turve

IS1 loengu osa „Runner'i turve“ seletas self-hosted runner'i pull-mudelit ja kolme reeglit: ainult privaatne repo, ainult main'i või käsitsi käivitatud job'id ja oma label.

Teine risk on püsiv olek. Hallatud runner kustutatakse pärast job'i, self-hosted runner mitte. Töökaust, Dockeri image'id ja kodukausta failid jäävad järgmisele job'ile. Runner'i kasutaja on `docker` grupis ehk sisuliselt root. Ühekordne (`--ephemeral` või just-in-time) runner võtab ühe job'i ja kaob, kuid jagab endiselt hosti Dockerit. Täieliku eraldatuse annab iga job'i jaoks uus VM, nagu hallatud runner'id töötavad.

PyTorchi juhtumis olid mõlemad riskid koos. 2024. aasta jaanuaris näitasid turvauurijad, et PyTorchi avaliku repo self-hosted runner'id käivitasid forgist tulnud PR-i koodi, sest varasemate kaastöötajate workflow'd ei vajanud kinnitust. Uurijad paigaldasid runner'i masinasse oma runner'i püsivaks ligipääsuks ja leidsid sealt AWS-i võtmed ning GitHubi PAT-id, millega oleks saanud avaldada pahatahtliku väljalaske ([SecurityWeek](https://www.securityweek.com/new-class-of-ci-cd-attacks-could-have-led-to-pytorch-supply-chain-compromise/)). Suures skaalas hallatakse self-hosted runner'eid seepärast Kubernetesis [Actions Runner Controller](https://docs.github.com/en/actions/concepts/runners/actions-runner-controller)'iga: iga job saab uue pod'i, mis pärast job'i kustutatakse, ja runner'ite arv järgib ootel job'ide arvu. See lahendab püsiva oleku, aga lisab klastri, mida keegi peab haldama, ja image'i ehitamine pod'is vajab kas privilegeeritud konteinerit või rootless-ehitajat.

Logi maskeerimine on tekstiasendus: base64-kujul väärtust GitHub ära ei tunne ja selline secret on lekkinud. Kõige selle hind on lock-in: workflow süntaks, action'ite ökosüsteem ja tokeni mudel ei kandu GitLab CI-sse ega Jenkinsi, kantav on ainult see, mis on skriptides ja build-tööriistas.

## Kontrolli ennast

??? question "Image on allkirjastatud, aga deploy job allkirja ei kontrolli. Mida allkiri sel juhul kaitseb?"
    Deploy hetkel mitte midagi. Ründaja, kes saab registry's tag'i ümber suunata, paneb tootmisse allkirjata image'i. Kontroll peab olema deploy'l enne `pull`-i ja siduma image'i digest'i kaudu, mitte tag'i kaudu, õige repo, workflow ja haruga.

??? question "ITSM-i API ei vasta ja pipeline peaks avama muudatuse kirje. Kas deploy jätkub?"
    See on otsus, mis tehakse enne. Standardmuudatusel jätkatakse tavaliselt ja kirje luuakse hiljem (fail-open), sest muidu peatab ITSM-i rike kogu tarne. Tavalisel muudatusel, mis vajab kinnitust, deploy peatub (fail-closed). Mõlemal juhul jääb käivituse logisse märge, et kirje puudub.

