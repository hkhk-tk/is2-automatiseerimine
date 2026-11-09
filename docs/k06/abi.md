---
tags:
  - veaotsing
---

# Abi: veaotsing

Tabel sisaldab ka IS1 praktikumi ridu, sest süvenemine jätkab sama pipeline'i. Read on IS1 moodulite ja IS2 lehtede kaupa: osad 1–4 ja 8 vastavad [süvenemise](syvenemine.md) osadele 1–5, osad 5–7 lehtedele [Jenkins koodina](lab-5-jenkins-koodina.md), [Õigused, varundus ja taaste](lab-6-haldus.md) ja [Neli punast buildi](lab-7-neli-punast.md). Neljas veerg on mehhanism, mille järgi tunned vea ära ka teistsuguse teate korral.

| Sümptom | Kontrolli | Tõenäoline põhjus | Miks see juhtub |
|---|---|---|---|
| **1. Agent ja esimene pipeline** | | | |
| `curl -sI …/login` ei anna `200` | `ip a`, VPN klient | VPN-ühendus puudub | `jenkins.lab.hkhk.ee` laheneb ja on marsruuditav ainult VPN-i kaudu |
| `docker ps` näitab Labori seisu konteinereid ka pärast `stop`-i | `docker ps --format '{{.Names}} {{.Label "com.docker.compose.project"}}'` | GitHub Actionsi deploy käivitas stacki teise projektinimega: peata see nimega | Compose leiab oma konteinerid projekti nime järgi; teise nimega stack on tema jaoks võõras |
| agent: `Failed to connect` või 403 | Nodes → `<gh>` saladus, `sudo cat /opt/jenkins/secret` | saladus vale või node'i nimi ei kattu (`<gh>` väiketähtedega) | controller arvutab saladuse node'i nimest; teine nimi või teine saladus on tema jaoks võõras agent |
| agent: `Connection refused` | `curl -sI http://jenkins.lab.hkhk.ee:8080/login` | VPN-ühendus puudub | TCP ühendus ei jõua serverini, Jenkinsi tasemele ei jõuta üldse |
| build "Waiting for next available executor on '<gh>'" | `systemctl status jenkins-agent`, Build Executor Status | agent offline või executorid hõivatud | label lubab ainult sinu agenti; kui see on maas, pole buildil kuhugi minna |
| freestyle: `sudo: a terminal is required` / `sudo apt update` ebaõnnestub | `id` buildi konsoolis | ootuspärane: kasutajal `jenkins` pole sudo-t | build töötab tavakasutajana; sudo puudumine on turvapiir, mitte viga |
| agent jäi pärast `pkill -9` punaseks | `systemctl cat jenkins-agent \| grep Restart`, `journalctl -u jenkins-agent -n 20` | `Restart=on-failure` puudub, `RestartSec` ei ole veel möödas või unit on olekus `failed` | pärast `StartLimitBurst` taaskäivitust `StartLimitIntervalSec` jooksul (vaikimisi 5 korda 10 s jooksul) jätab systemd unit'i olekusse `failed` ja vajab `systemctl reset-failed`-i |
| `ps` väljundis on saladus näha | `ps -o args -u jenkins` | agent käivitati käsitsi `-secret <väärtus>` kujul | `-secret @/opt/jenkins/secret` laseb Remotingul lugeda väärtuse failist, nii et `/proc/<pid>/cmdline`-is on ainult tee |
| `Couldn't find any revision to build` | GitHubis haru `k06-jenkins`, folderi credential `github` | haru puudub GitHubis või token vale: `git push -u origin k06-jenkins`, token *Contents: Read* | Jenkins loeb GitHubist, mitte sinu kohalikust repositooriumist; push'imata haru tema jaoks ei eksisteeri |
| `Could not find credentials entry with ID …` või 401, kuigi parool pole muutunud | folderi Credentials, `credentialsId` Jenkinsfile'is | credential'i ID Jenkinsfile'is ei klapi folderis olevaga | Jenkins otsib credential'it ID järgi job'i folderist ja ülemistest tasemetest; teise nimega credential'it ta ei leia |
| `Tool type "maven" does not have an install of "MAVEN3.9"` | `tools` plokk | vale tööriista nimi: `maven3`, `jdk21` | `tools` otsib administraatori antud nime, mitte versiooni |
| `Scripts not permitted to use method …` | buildi konsool, Jenkinsfile'i Groovy osa | meetod pole Groovy sandboxis lubatud: kasuta sammu `sh` või lubatud sammu | Jenkinsfile'i Groovy osa töötab controlleris piiratud režiimis; see on turvapiir, mitte viga sinu koodis |
| `k06 agent` FAIL: `tools { maven / jdk } puudub` | `grep -nE '^\s*(maven\|jdk)' k06-jenkins/Jenkinsfile` | `maven` ja `jdk` peavad olema eraldi ridadel | automaatne hindaja loeb faili ridade kaupa, ühele reale kokku pandud plokki ta ei tunne |
| jobi lehel testiraportit pole | `ls target/surefire-reports` buildi ajal | `junit` puudub või muster vale | Jenkins ei loe teste ise; ta näitab ainult seda, mille `junit` samm talle XML-ist annab |
| **2. Triggerid, options ja post** | | | |
| pollSCM või cron ei käivita | buildi ajalugu | `triggers` jõustub pärast esimest käsitsi buildi: Build Now üks kord | `triggers` on Jenkinsfile'is; Jenkins teab sellest alles pärast faili lugemist buildis |
| Git Polling Log: "No changes" | `git log origin/k06-jenkins -1` | commit pole push'itud või läks teisele harule | pollimine võrdleb GitHubi haru otsa viimati ehitatuga; kohalik commit seda ei muuda |
| `trigger-jenkins.sh`: 403 | sinu nimi → Security → API Token | parool tokeni asemel või token kustutatud | Jenkins tunneb kasutaja ära, aga see kasutaja ei saa sellel viisil buildi käivitada |
| `trigger-jenkins.sh`: 404 | jobi tee | `<gh>/labori-seis` vale | URL-is on iga folder kujul `job/<nimi>`; üks vale osa ja jobi pole |
| `trigger-jenkins.sh`: 401 | `echo ${#JENKINS_TOKEN}` | `JENKINS_USER` või token vale | autentimine ebaõnnestus enne õiguste kontrolli; tühi muutuja annab sama tulemuse |
| põhjuse päring: `jq` näitab tühja `causes` | URL-is `tree=…actions[causes[…]]` | `tree` filtris on sulg puudu või vale tase | põhjused on `actions` massiivi sees; ilma õige filtrita tagastab API tühjad objektid |
| teine build ei oota, töötab kõrvuti | `grep -n disableConcurrentBuilds k06-jenkins/Jenkinsfile` | `options` puudub või build pole veel uut Jenkinsfile'i lugenud | piirang jõustub alles buildist, mis on uue faili läbi lugenud |
| `ERROR: No artifacts found that match the file pattern` | `post` plokk | `cleanWs()` on plokis `always`, mis käivitub enne `success`-i: vii `cleanup`-i | `post` tingimustel on kindel järjekord ja `always` on esimene |
| workspace ei tühjene | `sudo du -sh /opt/jenkins/workspace/*` | `cleanWs()` puudub või build ebaõnnestus enne `post`-i (vt konsooli lõppu) | süntaksiviga Jenkinsfile'is peatab kõik, ka `post` ploki |
| ketas täis agendil | `df -h /opt/jenkins`, `docker system df` | workspace'id, `tools/`, image'id: `cleanWs()`, image'ite koristus, `buildDiscarder` | iga build jätab midagi maha; ilma koristuseta kasvab ketas iga commit'iga |
| **3. Quality gate ja Nexus** | | | |
| Sonar 502 Bad Gateway | `curl -s http://sonar.lab.hkhk.ee:9000/api/system/status` | Sonar alles käivitub (`STARTING`) | Sonari ees olev proksi vastab juba siis, kui Sonar ise alles käivitub |
| `withSonarQubeEnv`: `No SonarQube installation` | `installationName` | nimi peab olema `sonar` | nimi tuleb administraatori seadistusest (`klass-jenkins.yaml`), mitte serveri aadressist |
| Sonar: `Not authorized` / 401 | folderi credential `sonar` | token on teise projekti oma või aegunud | projektitoken kehtib ainult ühe projekti võtmega |
| katvus 0 % | `sh 'ls target/site/jacoco'` | Sonar käivitus enne `verify`-d või workspace tühjendati vahepeal | Sonar ei käivita teste, ta loeb ainult olemasolevat JaCoCo XML-i |
| Quality Gate ootab timeout'ini | koolitaja: Sonar → Webhooks → Recent deliveries | webhook ei jõua Jenkinsini | Jenkins ei küsi tulemust, vaid ootab, et Sonar selle saadaks |
| `k06 quality` FAIL: projectKey | `grep -n projectKey k06-jenkins/Jenkinsfile` | võti on `labori-seis`, peab olema `labori-seis-<gh>` | ühise võtmega kirjutaksid kõik õppijad sama projekti üle |
| Maven ei kasuta Nexust | logis pole `kooli-nexus` | `-s k06-jenkins/settings.xml` puudub mõnest `mvn` käsust | iga `mvn` käsk loeb settings-faili eraldi; üks käsk ilma `-s`-ta läheb otse Centralisse |
| Nexus 400 Bad Request | buildi nimi, Nexus Browse | versioon juba olemas: versioonis peavad olema `BUILD_NUMBER` ja commit | hosted repositoorium ei luba sama versiooni üle kirjutada (*Disable redeploy*) |
| redeploy katse annab `201` | Nexuse repositooriumi seadistus | repositoorium lubab redeploy'd: ütle koolitajale | ilma selle piiranguta saab vana versiooni vaikselt asendada |
| `curl --upload-file` annab `401`, kuigi parool on õige | `printf` rida, `echo ${#NEXUS_PASS}` | `read -rs` jäi vahele või muutuja on teises shellis | `curl -K-` loeb kasutaja ja parooli standardsisendist; tühi parool on vale parool |
| Nexus 403 | Nexuse tee konsoolis | groupId pole `ee.hkhk.<gh>` või credential vale | Nexuse õigused on seotud teega; võõras groupId on võõras kaust |
| Nexus 401 | folderi credential `nexus` | parool vale | Nexus ei tundnud kasutajat ära |
| `sha1sum` ei klapi | buildi number ja versioon | võrdled eri buildi WAR-e | iga build teeb uue WAR-i, mille räsi erineb ka siis, kui kood on sama |
| **4. Image, paralleel ja deploy** | | | |
| `permission denied ... /var/run/docker.sock` | `id jenkins`, `ls -l /var/run/docker.sock` | `jenkins` pole `docker` grupis või agenti pole taaskäivitatud: `sudo systemctl restart jenkins-agent` | grupid loetakse protsessi käivitamisel; töötav protsess uut gruppi ei näe |
| `docker build`: `COPY failed: file not found` | build context | kontekst peab olema `target`, mitte `.` | `COPY` otsib faili konteksti suhtes; repositooriumi juurkaustas pole `labori-seis.war` |
| `k06 docker` FAIL: build once | `grep -n '^COPY' k06-jenkins/Dockerfile` | Dockerfile ei kopeeri valmis WAR-i | automaatne hindaja otsib `COPY … .war` rida; mitmeastmeline fail kompileerib uuesti |
| image'eid koguneb üle 3 | `docker image ls labori-seis` | koristus puudub plokist `cleanup` või `tail -n +4` vale | `tail -n +4` alustab neljandast reast; `+3` jätaks alles kaks |
| `ART_VERSION` on Docker etapis tühi | etapp Build | versioon arvutatakse Nexuse etapis, mis töötab paralleelselt: vii etappi Build | paralleelsed harud ei näe teineteise muutujaid enne, kui need on seatud |
| `Avaldamine` jäi `k06-jenkins` harul vahele | `echo $GIT_BRANCH` konsoolis | regulaaravaldis ei klapi kujuga `origin/k06-jenkins` | Pipeline jobis lisab Git'i plugin nime ette `origin/` |
| `when { branch 'main' }` ei käivitu kunagi | jobi tüüp | `branch` töötab ainult multibranch-jobis: kasuta `expression` + `GIT_BRANCH` | `branch` loeb `BRANCH_NAME`-i, mida tavaline Pipeline job ei sea |
| `Deploy` küsib kinnitust ka pollSCM-i buildis | `when` plokk | `triggeredBy 'UserIdCause'` puudub või `beforeInput true` puudub | ilma `beforeInput`-ita küsitakse kinnitust enne, kui tingimust üldse vaadatakse |
| järgmised buildid ootavad lõputult | jobi leht, "Paused for Input" | kinnitamata `input` ja `disableConcurrentBuilds`: Paigalda või Abort, `timeout` `options`-isse | ootav build on endiselt käimas ja hoiab jobi lukus |
| `/version` ei vasta | `docker logs --tail 30 labseis-ci` | Tomcat alles käivitub või port 8085 on hõivatud | Tomcat paigaldab WAR-i käivitusel ja see võtab kümneid sekundeid |
| konteineri ja Nexuse räsi erinevad | `docker inspect --format '{{.Config.Image}}' labseis-ci` | konteiner töötab vanema image'iga või võrdled eri versioone | `docker run` käsitsi vana tag'iga jätab konteinerisse teise WAR-i |
| `.State.Health` puudub või `<no value>` | `docker inspect labori-seis:<tag> \| grep -i health` | Dockerfile'is pole `HEALTHCHECK`-i | Docker teeb healthcheck'i ainult siis, kui image ütleb, kuidas seda kontrollida |
| healthcheck annab `unhealthy` | `docker inspect --format '{{json .State.Health.Log}}' labseis-ci` | `curl` puudub image'is või `/health` vastab veaga | HEALTHCHECK käivitub konteineri sees; `curl`-ita ei saa ta midagi küsida |
| **5. Jenkins koodina** | | | |
| sandbox-Jenkins ei käivitu, `docker logs` näitab `OutOfMemoryError` | `free -m` | Maven või Sonar võtab RAM-i: peata teised konteinerid | `--memory 1536m` on ülempiir, mitte reserveering; JVM võtab heap'iks 25 % piirist ja kui masinal pole vaba mälu, ebaõnnestub juba käivitus |
| `Cannot run program "mvn"` | Maven Version jobis | (Default) = PATH, image'is pole Mavenit: vali `maven3` | (Default) ei paigalda midagi, vaid otsib `mvn`-i node'i `PATH`-ist |
| `UnknownHostException: nexus.lab.hkhk.ee` | `docker exec jenkins-liivakast getent hosts nexus.lab.hkhk.ee` | konteiner ei kasuta VPN-i DNS-i: eemalda `-s deploy/ci/settings.xml` | konteiner kasutab Dockeri DNS-i, mis ei tea VPN-i sisenimesid |
| `Git client`-i ei saa keelata | hiir lüliti peal | ootuspärane: teised pluginad sõltuvad sellest | Jenkins kaitseb sõltuvusi, et teised pluginad laadimisel ei ebaõnnestuks |
| `curl` pluginManager API: 401 või 403 | API token, kasutajanimi | token on teise kasutaja oma või kasutaja pole admin | pluginate nimekiri on administraatori info |
| `jq: command not found` | `command -v jq` | `sudo apt-get install jq` | `jq` pole Ubuntu serveri baaspaigalduses |
| `jenkins-plugin-cli`: `Unable to find Jenkins war` | `docker exec jenkins-liivakast ls /usr/share/jenkins/jenkins.war` | käsk töötas control node'il, mitte konteineris | tööriist loeb Jenkinsi versiooni WAR-ist, mis on ainult image'is |
| uus plugin ei ilmu | `docker exec jenkins-liivakast ls /var/jenkins_home/plugins` | `-d` puudus (plugin läks `ref/` alla) või restart jäi tegemata | `ref/` kopeeritakse `JENKINS_HOME`-i üldjuhul ainult siis, kui pluginat seal veel pole või image'is on uuem versioon |
| JCasC reload: `unknown attribute` / `No configurator for` | View Configuration | võti valel tasemel või vastav plugin puudub | iga YAML-võti vastab mõne plugina seadistusele; ilma pluginata pole võtmel tähendust |
| JCasC fail ei mõju | `docker exec jenkins-liivakast ls -l /var/jenkins_home/jenkins.yaml` | fail vales kohas või reload tegemata | JCasC loeb faili ainult käivitusel ja reload'il |
| pärast vigast JCasC faili ei avane avaleht | `docker logs --since 5m jenkins-liivakast 2>&1 \| grep -i casc` | vigane `jenkins.yaml` jäi konteinerisse | käivitusel pole vana seadistust, millele toetuda; pane õige fail tagasi `docker cp`-ga ja taaskäivita |
| **6. Õigused, varundus ja taaste** | | | |
| naabri folder avaneb | rolli regex | ütle koolitajale: roll on liiga lai | regulaaravaldis `mari.*` kataks ka `mari-tamm2`; muster peab lõppema `(/.*)?`-ga |
| võõra labeliga build töötab | jobi Graph View, node | job-restrictions puudub agendil: ütle koolitajale | label ainult valib node'i; keelamine on eraldi plugina töö |
| lukustasid end sandboxist välja | `docker exec jenkins-liivakast grep useSecurity /var/jenkins_home/config.xml` | admin jäi maatriksist välja: `sed … <useSecurity>false` ja restart | maatriks asendab kõik õigused korraga; kes pole tabelis, sel pole midagi |
| `vaatleja` näeb kõike | Authorization valik | "Logged-in users can do anything" on veel sees | see strateegia ei vaata tabelit üldse |
| `tar`: `file changed as we read it` | `docker ps` | Jenkins töötas varundamise ajal: peata enne | töötav Jenkins kirjutab logisid ja olekut pidevalt |
| `sudo chown` järel `chmod: Operation not permitted` | `ls -l ~/jenkins-liivakast.tgz` | `chown` ei õnnestunud (vale kasutajanimi) | arhiivi lõi konteineris `root` |
| taastatud Jenkins: credential'id ei dekrüpteeru | `tar tzf … \| grep secrets/` | `secrets/` jäi arhiivist välja | credential'id on krüpteeritud võtmega, mis on ainult `secrets/` all |
| võtmeta taastes on `credential loetav` ikka olemas | `docker volume inspect jenkins-ilmavotmeta`, `--exclude` muster | `--exclude` ei klappinud või käivitasid vale konteineri | `tar` võrdleb mustrit liikme nimega `./secrets/master.key`; ilma `./`-ta ei klapi |
| taastatud Jenkins ei käivitu, port hõivatud | `ss -tlnp \| grep 809` | vana konteiner töötab samal pordil | `docker run -p` ebaõnnestub `bind: address already in use` ja konteiner jääb olekusse `Created` |
| pärast pluginauuendust job ebaõnnestub | *Release notes*, `docker logs` | ühildumatu uuendus: Plugins lehel *Downgrade* (eelmine versioon on failis `plugins/<nimi>.bak`), `jenkins-plugin-cli -p <nimi>:<versioon>` või taaste varukoopiast | uus versioon muutis sammu, nõuab uuemat sõltuvust või kirjutas seadistuse XML-i uude kujusse, mida downgrade tagasi ei pööra |
| `docker volume rm`: `volume is in use` | `docker ps -a` | konteiner on kustutamata | ka peatatud konteiner hoiab oma volume'it |
| **7. Neli punast buildi** | | | |
| `intsident.sh`: `töökaust pole puhas` | `git status --short` | commit'i või stash'i enne | skript teeb commit'i ja ei taha sinu pooleliolevat tööd sellega segada |
| `intsident.sh`: `credentialsId 'nexus' puudub` | `grep -n credentialsId k06-jenkins/Jenkinsfile` | Sonari ja Nexuse osa tegemata või ID teine | skript eeldab, et Jenkinsfile'is on Nexuse etapp credential'iga `nexus` |
| parandus tehtud, aga build ikka sama veaga | buildi commit Graph View's | build ehitas vana commit'i: oota järgmist pollimist | pollimine leiab uue commit'i alles järgmisel intervallil |
| agent on roheline, aga pärast restart'i jälle punane | `journalctl -u jenkins-agent -n 30` | parandus oli ajutine, mitte teenuse püsivas seadistuses | teenus loeb käivitusel ainult seda, mis on unit'is ja selle failides |
| roheline, aga järgmine build punane | Nexuse haru konsool | üks roheline build ei tõesta versioonimist: vaata [Neli punast buildi](lab-7-neli-punast.md) veaotsingu tabelist 400 rida | mõni viga tuleb välja alles teisel korral, kui esimene tulemus on juba olemas |
| **8. Esitamine** | | | |
| automaatne hindaja FAIL, kohalikult OK | `diff <(git ls-files k06-jenkins \| sort) <(find k06-jenkins -type f \| sort)` | fail on kettal, aga commit'imata | automaatne hindaja näeb ainult Gitis olevaid faile |
| Releases all tulemust pole | `git ls-remote --tags origin` | tag on ainult kohalikus repositooriumis | vaja on `git push origin k06` |
| tulemus vastab vanale versioonile | `git log --oneline -1 k06` ja `git log --oneline -1 main` | tag pandi enne merge'i | tag jäi haru commit'ile, mida `main`-is pole |
