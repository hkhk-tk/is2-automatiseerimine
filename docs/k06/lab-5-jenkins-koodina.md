---
tags:
  - Jenkins
  - JCasC
  - Docker
---

# 5. Jenkins koodina

Tee see leht pärast IS1 praktikumi moodulit [Agent ja esimene pipeline](https://hkhk-tk.github.io/is1-automatiseerimine/k06/lab-1-agent/): sandbox-Jenkins töötab control node'il klassi Jenkinsi agendi kõrval. Klassi Jenkinsi seadistuse loetav koopia on failis `k06-jenkins/klass-jenkins.yaml`. Kui see puudub, võta see avalikust rakenduse repositooriumist:

```bash
curl -fsSL -o k06-jenkins/klass-jenkins.yaml https://raw.githubusercontent.com/hkhk-tk/labori-seis/main/deploy/ci/casc/klass-jenkins.yaml
```

Veebiliideses käsitsi seadistatud Jenkinsit ei saa pärast riket samaks taastada: keegi ei tea, millised pluginad ja versioonid seal olid ning kes mida System lehel muutis. Klassi Jenkinsis on administraatori pool (Plugins, Tools, Security, System) sulle kinni, kuigi just seal otsustatakse, kust tulevad tööriistad, millised pluginad on paigaldatud ja kus seadistus kirjas on. Seepärast paned control node'ile oma Jenkinsi [konteinerina](https://www.jenkins.io/doc/book/installing/docker/): see on sinu sandbox, kus võid vigu teha ja neid vaadata. Lõpuks on pluginad `jenkins-plugin-cli`-ga paigaldatud, nende nimekiri failis `k06-jenkins/casc/plugins.txt` ja üks süsteemi seade tuleb JCasC failist.

**Kui teed seda tööl iga päev:** sinu tootmis-Jenkinsi pluginad tulevad `plugins.txt`-ist ja seadistus JCasC failist. Kui see on sul juba korras, mine otse etappi [„Muuda sandboxi seadet koodiga“](#muuda-sandboxi-seadet-koodiga).

## Paigalda sandbox-Jenkins

Jenkinsi kogu olek on kaustas `JENKINS_HOME`, mis läheb volume'isse. JVM loeb `--memory` piiri cgroup'ist ja võtab ilma `-Xmx`-ita heap'iks sellest 25 %, ehk 1536 MB piiri juures umbes 384 MB. Ülejäänu läheb metaspace'ile, lõimedele ja pluginate klassidele. Kui konteiner ületab piiri, tapab OOM killer konteineri, mitte sinu agenti või Mavenit.

1. Käivita konteiner ja võta algparool. `JENKINS_HOME` on siin volume `/var/jenkins_home` ja algparool on selle failis.

    ```bash
    docker volume create jenkins-liivakast
    docker run -d --name jenkins-liivakast --memory 1536m -p 8090:8080 \
        -v jenkins-liivakast:/var/jenkins_home jenkins/jenkins:lts-jdk21
    docker logs -f jenkins-liivakast   # oota rida "Jenkins is fully up and running", siis Ctrl+C
    docker exec jenkins-liivakast cat /var/jenkins_home/secrets/initialAdminPassword
    ```

2. Ava `http://<control node'i IP>:8090`, kleebi parool ja vali **Install suggested plugins**.
3. Loo admin-kasutaja. Jenkinsi URL-iks jäta pakutu.
4. Vaata, mis on `JENKINS_HOME`-is: `docker exec jenkins-liivakast ls /var/jenkins_home`

`ls` väljund on Jenkinsi andmemudel failidena: `config.xml` on süsteemi seadistus, `jobs/` jobid koos ajalooga, `plugins/` pluginad, `users/` kasutajad ja `secrets/` krüptovõtmed. Varukoopia teed hiljem just sellest kaustast. Kõik on XML-failid, mida Jenkins loeb käivitusel mällu: failide käsitsi muutmine töötava Jenkinsi all jõustub alles pärast *Reload Configuration from Disk*'i või taaskäivitust.

**Edasi saad minna, kui** näed Jenkinsi avalehte ja vasakul **Manage Jenkins** kõigi jaotistega ning `ls` väljund on PR-i kirjelduses.

## Leia, kust tööriist tuleb

Klassi Jenkinsi buildi logis nägid rida, kus Jenkins paigaldas Maveni. Nüüd seadistad sama administraatori poolelt. Seadistad jobi kõigepealt meelega valesti, et näha, mis juhtub, kui tööriista nimi pole määratud.

Ilma nimelise tööriistata sõltub build sellest, mis juhtub olema node'i `PATH`-is. Ühel agendil on Maven 3.6, teisel 3.9, ja sama commit annab eri tulemuse.

1. **Manage Jenkins → Tools → Maven installations → Add Maven**: nimi `maven3`, *Install automatically*, versioon 3.9.x. Salvesta.
2. **New Item → `ehitus` → Freestyle project**:
    - *Source Code Management → Git*: `https://github.com/hkhk-tk/labori-seis.git`, branch `*/main`
    - *Build Steps → Invoke top-level Maven targets*: Maven Version **(Default)**
    - Goals: `-B -s deploy/ci/settings.xml -DskipTests package`
3. **Build Now** ja vaata konsooli. (Default) tähendab `mvn`-i masina PATH-ist, aga Jenkinsi image'is Mavenit pole.
4. Muuda Maven Version → `maven3` ja vajuta uuesti **Build Now**. Automaatne paigaldus laeb tööriista node'ile esimesel kasutusel, täpselt nagu klassis sinu agendile.

> Kui logis on `UnknownHostException: nexus.lab.hkhk.ee`, ei kasuta konteiner VPN-i DNS-i. Siis eemalda Goals'ist `-s deploy/ci/settings.xml`, sõltuvused tulevad siis internetist.

Esimene build ebaõnnestus enne, kui ükski rida koodi kompileeriti: viga oli keskkonnas, mitte koodis. Teise buildi logi näitab tööriista teed `tools/hudson.tasks.Maven_MavenInstallation/maven3`, mis on node'i kohalik cache. Klassi agendil on sama kaust `/opt/jenkins/tools` all.

**Edasi saad minna, kui** esimene build oli FAILURE logireaga `Cannot run program "mvn"` ja teine SUCCESS, logis on `Unpacking ... to /var/jenkins_home/tools/hudson.tasks.Maven_MavenInstallation/maven3` ja `Downloading from kooli-nexus`.

## Vaata pluginate sõltuvusi

Peaaegu kõik Jenkinsis on plugin, ka Git ja Pipeline. Pluginad sõltuvad üksteisest ja üks "väike" plugin võib tuua kaasa kümme teist.

Sõltuvuste tõttu ei saa pluginat ohutult eemaldada ega uuendada üksi. Kui uuendad ühe plugina, mis nõuab uuemat sõltuvust, uuendatakse ka see ja muutus puudutab jobe, millele sa ei mõelnud.

1. **Manage Jenkins → Plugins → Available**: paigalda `Build Timestamp`.
2. **Installed** → proovi keelata `Git client`. Vii hiir lüliti peale ja vaata, kes sellest sõltub.

Lüliti on hall, sest `Git` ja mitu Pipeline'i pluginat vajavad `Git client`-i. Jenkins ei lase sul sõltuvust eemaldada ja see kaitseb jobe, mis muidu laadimisel ebaõnnestuksid. Sama sõltuvuste puu on põhjus, miks pluginat uuendatakse alles pärast varukoopiat.

**Edasi saad minna, kui** Build Timestamp on paigaldatud, `Git client`-i ei saa välja lülitada ja sõltuvuste teate ekraanipilt on PR-i kirjelduses.

## Kirjuta pluginad faili

Veebiliideses paigaldatud pluginate valikut ei saa täpselt korrata. `plugins.txt` (`nimi:versioon` rea kohta) on nimekiri koodina ja [`jenkins-plugin-cli`](https://github.com/jenkinsci/plugin-installation-manager-tool) on ametlikus image'is olemas. Võtad nimekirja töötavast Jenkinsist API kaudu, nii et failis on täpselt see, mis paigaldatud on.

Ilma versioonideta nimekirjast paigaldab `jenkins-plugin-cli` iga plugina uusima versiooni, mis selle Jenkinsiga ühildub, ja kaks päeva vahega ehitatud image'it erinevad.

1. Sandboxis sinu admin-nimi (paremal üleval) → **Security → API Token → Add new Token**. Hoia token ainult muutujas.
2. Kirjuta paigaldatud pluginad koos versioonidega faili. Token läheb `curl`-ile standardsisendist, mitte käsureale.

    ```bash
    mkdir -p k06-jenkins/casc && read -rs LK_TOKEN
    printf 'user = "%s:%s"\n' <admin> "$LK_TOKEN" | curl -gfsS -K- \
        'http://localhost:8090/pluginManager/api/json?depth=1&tree=plugins[shortName,version]' \
        | jq -r '.plugins[] | "\(.shortName):\(.version)"' | sort > k06-jenkins/casc/plugins.txt
    wc -l k06-jenkins/casc/plugins.txt
    ```

3. Küsi, mis on uuendatav ja millel on teadaolevaid turvateateid. `--no-download` ei muuda midagi.

    ```bash
    docker cp k06-jenkins/casc/plugins.txt jenkins-liivakast:/tmp/plugins.txt
    docker exec jenkins-liivakast jenkins-plugin-cli -f /tmp/plugins.txt --no-download \
        --available-updates --view-security-warnings --output txt
    ```

4. Paigalda JCasC plugin käsurealt otse `JENKINS_HOME`-i ja taaskäivita.

    ```bash
    docker exec jenkins-liivakast jenkins-plugin-cli -d /var/jenkins_home/plugins --plugins configuration-as-code
    docker restart jenkins-liivakast
    ```

5. Kui Jenkins on üleval, kirjuta `plugins.txt` sama käsuga uuesti ja vaata `git diff --stat`: lisandusid `configuration-as-code` ja selle sõltuvused.

`wc -l` näitab mitukümmend rida, kuigi valisid viisardis "soovitatud" ja ühe lisa. See on pluginate tegelik arv koos sõltuvustega. `--available-updates` nimekiri on sinu järgmise hoolduse töönimekiri ja turvateated ütlevad, mis tuleb uuendada esimesena.

**Edasi saad minna, kui** `plugins.txt`-is on kõik pluginad versioonidega, **Manage Jenkins** all on **Configuration as Code** ja PR-i kirjelduses on uuendatavate pluginate nimekiri.

## Loe klassi Jenkinsi seadistust

Enne oma JCasC faili kirjutamist loed klassi Jenkinsi oma. Klassi Jenkins ei näita viisardit: seadistus tuleb failist, mille tee annab keskkonnamuutuja `CASC_JENKINS_CONFIG`. Loetav koopia on sinu repositooriumis `k06-jenkins/klass-jenkins.yaml`.

Konfiguratsioonifail on ka turvadokument: sellest näed, kes mida tohib, ja õiguste muudatus on diff, mida saab auditis näidata.

1. Loe fail läbi ja leia read, mis vastavad nendele küsimustele.

    ```bash
    grep -nE 'numExecutors|name: "(maven3|jdk21|sonar)"|pattern:|allowsSignup|SONAR_WEBHOOK' k06-jenkins/klass-jenkins.yaml
    ```

2. Kirjuta PR-i kirjeldusse viis vastust:
    - kus on kirjas, et controller ei ehita, ja mis rida ütleb sama Jenkinsfile'is
    - millised kolm nime sinu Jenkinsfile'is tulevad sellest failist
    - mis õigused on sinu folderi rollil ja mida sellest puudu on võrreldes rolliga `admin`
    - kust tuleb Sonari webhooki saladus ja miks see pole failis
    - mida see fail ei loo (vt faili algust)

Sinu Jenkinsfile kasutab nimesid, mille administraator on failis kokku leppinud. Saladus on failis ainult viitena `${...}`, nii et faili võib Gitis hoida. Asjad, mida fail ei loo, tulevad skriptist: JCasC kirjeldab süsteemi, mitte iga jobi.

**Edasi saad minna, kui** PR-i kirjelduses on viis vastust, igaühe juures faili rea number.

## Muuda sandboxi seadet koodiga

Nüüd kirjutad oma JCasC faili. JCasC plugin loeb ilma `CASC_JENKINS_CONFIG`-ita faili `$JENKINS_HOME/jenkins.yaml`. **Manage Jenkins → Configuration as Code → View Configuration** näitab praegust seadistust YAML-ina: vaata sealt õiged võtmed.

JCasC seab need võtmed, mis failis on. Enamikku seadeid, mida failis pole, see ei lähtesta, nii et käsitsi muudetud ja failist puuduv seade jääb triiviks ka pärast reload'i.

Kirjuta `k06-jenkins/casc/jenkins.yaml`. Nõuded:

- `jenkins.systemMessage` sisaldab sinu `<gh>`-d ja ütleb, et seadistus tuleb failist
- `jenkins.numExecutors: 1`
- Maveni tööriist `maven3` versiooniga 3.9.16, sama kuju mis `klass-jenkins.yaml`-is
- saladusi, kasutajaid ega `securityRealm`-i failis pole: admin jääb viisardi omaks

1. Kontrolli süntaksit ja vii fail konteinerisse.

    ```bash
    python3 -c 'import yaml; yaml.safe_load(open("k06-jenkins/casc/jenkins.yaml")); print("ok")'
    docker cp k06-jenkins/casc/jenkins.yaml jenkins-liivakast:/var/jenkins_home/jenkins.yaml
    ```

2. **Manage Jenkins → Configuration as Code → Reload existing configuration**.
3. Vaata, mis jõudis `config.xml`-i: `docker exec jenkins-liivakast grep -E 'systemMessage|numExecutors' /var/jenkins_home/config.xml`
4. **Ennusta:** mis saab käsitsi muudetud süsteemiteatest pärast JCasC reload'i? Muuda **Manage Jenkins → System** all *System Message* käsitsi ja salvesta. Tee uuesti **Reload existing configuration** ja vaata avalehte.

> Kui reload annab vea `unknown attribute` või `No configurator for`, on võti valel tasemel või vastav plugin puudub. Võrdle View Configuration väljundiga.

YAML-ist sai `config.xml`: JCasC kirjutab Jenkinsi oma failidesse. Käsitsi muudetud teade kadus reload'iga, sest fail on tõe allikas (source of truth) ja veebiliides ainult vaade. Tootmises tähendab see, et parandus "kiiresti veebis" kaob järgmisel taaskäivitusel, kui keegi seda faili ei kanna.

**Edasi saad minna, kui** avalehel on sinu süsteemiteade, `config.xml` näitab `numExecutors` väärtust 1, käsitsi muudetud teade kadus pärast reload'i ja PR-i kirjelduses on lause selle kohta, mis juhtub käsitsi muudatusega koodist seadistatud Jenkinsis.

## Tekita vigane seadistus ja leia see logist

Seadistus koodina tähendab ka seda, et üks trükiviga failis võib Jenkinsi käivitamise peatada. Teed selle meelega ja vaatad, kuidas viga välja paistab reload'il ja taaskäivitusel. Nii tunned selle ära, kui see juhtub tootmises pärast kellegi teise commit'i.

Kõige ohtlikum hetk on taaskäivitus öösel pärast uuendust: Jenkins ei tõuse ja veebiliidest, kust viga otsida, pole. Siis on ainus info konteineri või teenuse logis.

1. Tee failist vigane koopia (üks täht puudu) ja proovi seda reload'iga.

    ```bash
    sed 's/numExecutors/numExecutor/' k06-jenkins/casc/jenkins.yaml > /tmp/vigane.yaml
    docker cp /tmp/vigane.yaml jenkins-liivakast:/var/jenkins_home/jenkins.yaml
    ```

2. **Manage Jenkins → Configuration as Code → Reload existing configuration** ja loe veateadet.
3. Taaskäivita konteiner sama vigase failiga ja otsi viga logist. Proovi siis avalehte.

    ```bash
    docker restart jenkins-liivakast && sleep 40
    docker logs --since 2m jenkins-liivakast 2>&1 | grep -iE 'numExecutor|casc|SEVERE' | head -8
    ```

4. Pane õige fail tagasi, taaskäivita ja veendu, et avaleht ja süsteemiteade on tagasi.

    ```bash
    docker cp k06-jenkins/casc/jenkins.yaml jenkins-liivakast:/var/jenkins_home/jenkins.yaml
    docker restart jenkins-liivakast
    ```

5. Commit ja peata sandbox, et RAM jääks Mavenile.

    ```bash
    git add k06-jenkins/casc/ && git commit -m "k06: liivakast koodina (plugins.txt, jenkins.yaml)" && git push
    docker stop jenkins-liivakast
    ```

Reload keeldus vigast faili laadimast ja töötav seadistus jäi alles: see on turvaline rike. Taaskäivitusel pole vana seadistust, millele toetuda, ja Jenkins ei käivitu lõpuni või näitab vealehte. Logi nimetab vale võtme ja loetleb lubatud võtmed: see on kiireim tee parandusele. Järeldus adminile: JCasC faili muudatus vajab enne taaskäivitust reload-proovi või CI kontrolli.

**Edasi saad minna, kui** PR-i kirjelduses on reload'i veateade ja logirida, mis nimetab `numExecutor`, pärast õige faili tagasipanekut on avaleht ja süsteemiteade jälle olemas ning sandbox on peatatud.

**Selle mooduli tõend:** commit `k06: liivakast koodina …` failidega `k06-jenkins/casc/plugins.txt` ja `k06-jenkins/casc/jenkins.yaml`; PR-i kirjelduses `ls /var/jenkins_home`, `Cannot run program "mvn"` ja kaks Maveni logirida, `Git client` sõltuvuste ekraanipilt, uuendatavate pluginate nimekiri, viis vastust `klass-jenkins.yaml` kohta, `grep config.xml` väljund, lause triivi kohta, vigase faili reload'i viga ja logirida.

## Miks see nii töötab

**JCasC faili asukoht.** Kui keskkonnamuutuja `CASC_JENKINS_CONFIG` ja Java system property `casc.jenkins.config` puuduvad, loeb JCasC seadistuse failist `$JENKINS_HOME/jenkins.yaml`.

**Pluginad ametlikus image'is.** Ametlikus image'is `jenkins/jenkins:lts-jdk21` kirjutab `jenkins-plugin-cli` vaikimisi kausta `/usr/share/jenkins/ref/plugins`. Sealt kopeerib käivitusskript pluginad kausta `JENKINS_HOME` üldjuhul ainult siis, kui neid seal veel ei ole või kui image'is on uuem versioon. Töötavas konteineris olemasoleva volume'iga on seetõttu vaja võtit `-d /var/jenkins_home/plugins`. Image'i ehitamisel määratud vaikeväärtus ei ole veel töötava teenuse olek: kui olek on volume'is, otsustab image'i käivitusskript, mida volume'isse üle kirjutatakse ja mida mitte.

**Vigane JCasC fail.** Selles praktikumis kasutatavas Jenkinsi versioonis on vigane JCasC fail käivitusel viga, mitte hoiatus. Jenkins jätab käivitumise pooleli, kui seadistust ei saa laadida, sest pooleldi seadistatud Jenkinsil võivad olla liiga laiad õigused.

**Controlleri image.** Tootmises ehitatakse controlleri image tavaliselt read `FROM jenkins/jenkins:lts-jdk21`, `COPY plugins.txt` ja `RUN jenkins-plugin-cli -f plugins.txt` abil ning JCasC fail lisatakse samamoodi. Siis hallatakse Jenkinsit nagu iga teist image'it: versioon on tag'is ja rollback tähendab eelmise tag'i kasutamist, kui `JENKINS_HOME`-i andmed uuema versiooni poolt juba ümber kirjutatud ei ole.

**`JENKINS_HOME` volume.** Kui pluginad tulevad image'ist ja seadistus JCasC-st, jäävad `JENKINS_HOME` volume'isse peamiselt job'id, buildide ajalugu ja saladused, ehk see, mida koodist taastada ei saa.

Lisaülesanne [11. Sandboxis rollipõhised õigused](lisa.md#11-sandboxis-rollipohised-oigused): kirjutad rollipõhised õigused JCasC faili ja teed reload'i.
