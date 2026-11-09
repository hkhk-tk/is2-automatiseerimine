---
tags:
  - Docker
  - Podman
  - Lisaülesanded
---

# Lisaülesanded: Docker ja Podman

Ülesanded jätkavad IS1 praktikumi [Labori seis konteinerites](https://hkhk-tk.github.io/is1-automatiseerimine/k03/lab/) stacki ja eeldavad selle osi, mis on ülesande juures kirjas.

Kõik ülesanded on samas projektis ja iga ülesanne lõpeb kontrolliga. Failid lähevad kausta `k03-docker/` (ülesanne 15 kausta `vorgukogu/`). Docker Hubi image'id kirjuta kujul `$HUB/<image>` (näiteks `$HUB/nginx:1.30-alpine`), mitteametlikud kujul `harbor.lab.hkhk.lan/dockerhub/<omanik>/<image>` (näiteks `louislam/uptime-kuma:2`).

??? example "1 · Swarm ühel node'il"

??? example "1 · Swarm ühel node'il"

    Compose haldab üht hosti: ta ei hoia mitut koopiat ega uuenda teenust ilma 502-ta. Swarm on Dockeri sisseehitatud orkestraator, ja ühe masina peal näed, mida orkestraator sinu eest teeb. Katse ajaks on control Swarmi manager ja põhistack töötab samal ajal edasi.

    - control on üheliikmeline Swarm ja teenus `websw` töötab kolme koopiana `nginx:1.30-alpine` peal pordil 8085;
    - kustuta üks koopia käsitsi (`docker rm -f`) ja vaata, mida Swarm teeb;
    - uuenda image `nginx:1.29-alpine` peale ükshaaval (`--update-parallelism 1 --update-delay 5s`) ja võta uuendus `docker service rollback`-iga tagasi;
    - lõpuks on teenus eemaldatud, host on Swarmist lahkunud ja `docker_gwbridge` võrku pole.

    **Kontroll:**

    ```bash
    docker service ps websw --format '{{.Name}} {{.Image}} {{.CurrentState}} {{.Error}}'
    curl -sI localhost:8085 | head -1
    docker service inspect -f '{{.UpdateStatus.State}}' websw
    docker info -f '{{.Swarm.LocalNodeState}}'; docker network ls    # pärast koristust
    ```

    **Valmis, kui:**

    - kustutatud koopia asemele tekkis automaatselt uus ja `docker service ls --filter name=websw` näitab `3/3`;
    - uuendus vahetas koopiad ükshaaval;
    - pärast `rollback`-i on kõik koopiad `nginx:1.30-alpine` peal ja `UpdateStatus.State` on `rollback_completed`;
    - pärast koristust annab `LocalNodeState` vastuse `inactive`.

    ??? success "Lahendus"
        ```bash
        docker swarm init --advertise-addr <control IP>
        docker service create --name websw --replicas 3 -p 8085:80 nginx:1.30-alpine
        docker service ps websw --format '{{.Name}} {{.CurrentState}}'
        curl -sI localhost:8085 | head -1

        docker rm -f "$(docker ps -q --filter name=websw | head -1)"
        sleep 10; docker service ps websw --format '{{.Name}} {{.CurrentState}} {{.Error}}'

        docker service update --image nginx:1.29-alpine --update-parallelism 1 --update-delay 5s websw
        docker service ps websw --format '{{.Name}} {{.Image}} {{.CurrentState}}' | head -6
        docker service rollback websw
        ```

        ```bash
        # enne koristust: kustutatud task, praegune ja eelmine spec
        docker service ps websw --filter desired-state=shutdown --format '{{.Name}} {{.CurrentState}} {{.Error}}'
        docker service inspect -f '{{.Spec.TaskTemplate.ContainerSpec.Image}}' websw
        docker service inspect -f '{{.PreviousSpec.TaskTemplate.ContainerSpec.Image}}' websw
        docker service inspect -f '{{.UpdateStatus.State}}' websw

        # koristus
        docker service rm websw && docker swarm leave --force
        docker network rm docker_gwbridge 2>/dev/null; docker network ls
        ```

        Kontroll: `docker service ls --filter name=websw` näitab `3/3`, praegune image on `nginx:1.30-alpine@sha256:…`, `UpdateStatus.State` on `rollback_completed`. Pärast koristust annab `docker info -f '{{.Swarm.LocalNodeState}}'` vastuse `inactive`.

        **Miks nii.** Manager hoiab soovitud olekut (`--replicas 3`) Rafti logis ja võrdleb seda task'ide tegeliku olekuga. Kustutatud konteineri task märgitakse `Failed` olekusse ja orkestraator loob uue task'i uue konteineriga. `service create` lahendab tag'i digestiks (`--no-resolve-image` lülitab selle välja), ja `rollback` läheb tagasi teenuse `PreviousSpec`-ile, registry ajalugu selleks vaja pole. Swarmi teenused ja Compose'i konteinerid töötavad samas daemonis kõrvuti, seepärast jääb põhistack tööle ja pärast koristust on host endises olekus. Mida see näitas ja miks kursus läheb edasi Kubernetesesse, on lehe Kogu stack Compose'iga lõpus.

??? example "2 · BuildKit cache mount"

    **Esita:** `k03-docker/app/Dockerfile`

    Praegu laaditakse iga `pom.xml`-i muudatuse järel kõik Maveni sõltuvused uuesti alla, sest kiht tühistatakse tervikuna. Cache mount hoiab Maveni hoidla build'ide vahel alles ja laeb alla ainult muutunud osa.

    - build-astme mõlemal Maveni `RUN`-il on `--mount=type=cache,target=/root/.m2`;
    - kustuta `pom.xml`-ist ajutiselt üks sõltuvus, ehita, pane tagasi ja ehita uuesti;
    - mõõda, mitu MB teisel korral alla laeti;

    **Kontroll:**

    ```bash
    docker build --progress=plain -f k03-docker/app/Dockerfile -t labseis-app:cm . 2>&1 | grep -c 'Downloaded from'
    docker buildx du --verbose | grep -B2 -A4 cachemount
    ```

    **Valmis, kui:**

    - `docker buildx du --verbose` näitab cache mount'i kirjet;
    - build pärast sõltuvuse tagasipanekut laeb alla paar MB, mitte kogu hoidla;

    Vihje: Maven näitab allalaadimisi ainult siis, kui `go-offline` real pole `-q`-d.

    ??? success "Lahendus"
        ```dockerfile
        COPY pom.xml ./
        RUN --mount=type=cache,target=/root/.m2 mvn -B dependency:go-offline
        COPY src ./src
        RUN --mount=type=cache,target=/root/.m2 mvn -B -q package -DskipTests
        ```

        ```bash
        docker build --progress=plain -f k03-docker/app/Dockerfile -t labseis-app:cm . 2>&1 \
          | grep -oE 'Downloaded from [^(]*\([0-9.]+ (B|kB|MB)' | sed -E 's/.*\(([0-9.]+) (B|kB|MB)$/\1 \2/' \
          | awk '{s += ($2 == "MB") ? $1 * 1024 : ($2 == "kB") ? $1 : $1 / 1024} END {printf "%.1f MB, %d faili\n", s / 1024, NR}'
        ```

        Kontroll: esimene build pärast sõltuvuse tagasipanekut laeb alla ainult selle sõltuvuse ja selle transitiivsed sõltuvused (paar MB), ilma cache mount'ita kogu hoidla (sadu MB). `docker buildx du --verbose | grep -B2 -A4 cachemount` näitab cache'i suurust. CI vastus: GitHubi runner on iga job'i jaoks uus VM ja cache mount on olemas ainult kohaliku builder'i olekus. `cache-to type=gha` ekspordib kihid, mitte cache mount'e. Kihtide cache aitab seni, kuni `pom.xml` ei muutu. NB: `prune.sh`-i `docker builder prune` kustutab ka cache mount'id.

        **Miks nii.** Cache mount on BuildKit'i hallatav kaust, mis ühendatakse `RUN`-i ajaks ja mis ei jõua image'i kihti. Kiht `dependency:go-offline` tühistatakse ikka iga `pom.xml`-i muudatusega, aga Maven leiab `/root/.m2/repository`-st juba olemasolevad artefaktid ja laeb alla ainult puuduva. Mõõtmiseks eemalda `go-offline` realt ajutiselt `-q`, et Maven näitaks allalaadimisi.

??? example "3 · Monitooring"

    Docker väljastab olekumuutuse sündmusena `health_status`, aga ei saada sellest teadet kuhugi. Kui app01 olek muutub `unhealthy`-ks, märkab seda praegu alles kasutaja. Uptime Kuma küsib `/health`-i väljast ja saadab teate; detailid on monitooringu kodutöös.

    - teenus `kuma` töötab profiiliga `monitoring` (`docker compose --profile monitoring up -d`);
    - Uptime Kumas on HTTP-monitor `http://web01/health` ja teavituskanal;
    - peata rmq01, oota teadet ja käivita rmq01 uuesti;
    - pane kirja, mitu sekundit kulus peatamisest teateni ja millistest Kuma seadetest see sõltub.

    **Kontroll:**

    ```bash
    docker compose --profile monitoring ps kuma
    docker compose stop rmq01
    curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/health
    docker compose start rmq01
    ```

    **Valmis, kui:**

    - kui rmq01 on peatatud, annab `curl` koodi 503;
    - Kuma näitab monitori `DOWN` olekut ja sündmuste ajaloos on üleminek;
    - teavituskanalisse tuli üks teade peatamisel ja teine pärast `start`-i;
    - tead, millal Kuma teate saadab.

    ??? success "Lahendus"
        ```bash
        docker compose --profile monitoring ps kuma
        docker compose stop rmq01
        curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/health    # 503
        docker compose start rmq01
        ```

        Kontroll: Kuma näitab monitori `DOWN` olekut ja sündmuste ajaloos on üleminek, teavituskanalisse tuli üks teade ja pärast `start`-i teine (`UP`). Lõks: prod-failiga (`compose.prod.yaml`) on web01 ainult võrkudes `front` ja `back`, `kuma` aga vaikevõrgus, ja nimi `web01` ei lahendu. Siis vajab `kuma` prod-failis `networks: [front]`.

        **Miks nii.** rmq01 peatamisel vastab app01 `/health` 503-ga (`"queue":"DOWN"`), web01 annab selle edasi ja Kuma HTTP-monitor loeb 2xx-st erinevat koodi rikkeks. Teade läheb teele olekumuutusel UP → DOWN, mitte iga ebaõnnestunud päringu peale. Seega jõuab see sinuni kõige rohkem `Heartbeat Interval × (Retries + 1)` pärast, korduskatsete vahe on `Heartbeat Retry Interval`.

??? example "4 · Trivy nurjab build'i"

    **Esita:** `k03-docker/scan.sh`

    Praegu vaatad Trivy väljundit silmaga ja haavatav image võib jõuda tootmisse. Skannimine, mis lõpetab veakoodiga, peatab pipeline'i enne seda; sama skript läheb 5. kohtumisel pipeline'i.

    - `scan.sh` skannib kõik kolm image'it (`app`, `db`, `web`, nimed `.env`-ist) võtmetega `--exit-code 1 --severity CRITICAL --ignore-unfixed`;
    - skripti väljumiskood on 0, kui kõik image'id on puhtad, ja 1, kui mõni ebaõnnestus;
    - ehita web-image ka `nginx:1.27-alpine` peal (tag `labseis-web:127`) ja skanni seda.

    **Kontroll:**

    ```bash
    ./scan.sh; echo "kood $?"
    trivy image --exit-code 1 --severity CRITICAL --ignore-unfixed labseis-web:127; echo "kood $?"
    shellcheck scan.sh
    ```

    **Valmis, kui:**

    - `./scan.sh` annab sinu puhaste image'ite peal koodi 0;
    - `1.27-alpine` peal ehitatud web-image ebaõnnestub või annab rohkem leide kui `1.30-alpine`;
    - `shellcheck scan.sh` ei väljasta midagi.

    ??? success "Lahendus"
        ```bash
        #!/usr/bin/env bash
        set -euo pipefail
        cd "$(dirname "$(readlink -f "$0")")"
        set -a
        # shellcheck source=/dev/null
        . ./.env
        set +a
        rc=0
        for n in app db web; do
            img="$REGISTRY/$OWNER/labori-seis-$n:${TAG:-dev}"
            echo "== $img"
            trivy image --quiet --exit-code 1 --severity CRITICAL --ignore-unfixed "$img" || rc=1
        done
        exit "$rc"
        ```

        ```bash
        sed 's/nginx:1.30-alpine/nginx:1.27-alpine/' web/Dockerfile | docker build -q -t labseis-web:127 -f - web
        for i in labseis-web:127 "$REGISTRY/$OWNER/labori-seis-web:$TAG"; do
            trivy image -q --severity CRITICAL,HIGH --ignore-unfixed -f json "$i" \
              | jq -r --arg i "$i" '[.Results[].Vulnerabilities // [] | length] | add | "\($i) \(.)"'
        done
        ```

        Kontroll: `./scan.sh; echo $?` annab 0, kui sinu image'id on puhtad, ja `trivy image --exit-code 1 --severity CRITICAL --ignore-unfixed labseis-web:127; echo $?` annab 1 või leidude arv on suurem kui 1.30 puhul. `shellcheck scan.sh` ei väljasta midagi.

        **Miks nii.** Skript ei lõpeta esimese leiu juures: pipeline'i logis on siis korraga näha kõigi kolme image'i olek. Koondkood on 1, kui mõni image ebaõnnestus. `--ignore-unfixed` jätab välja leiud, millele pole parandust, sest neid ei saa image'i uuesti ehitamisega lahendada.

??? example "5 · Skeemi muudatus olemasolevas baasis"

    **Esita:** `k03-docker/db/migr/001-result-note.sql`

    db-image'i juures nägid, et init-skript ei käivitu olemasoleva volume'iga. Tootmisbaasis muudetakse skeemi migratsiooniga, mis on korduvalt käivitatav ja jõuab ka baasi, mis on juba ammu kasutusel.

    - `001-result-note.sql` lisab tabelisse `result` veeru `note VARCHAR(200) NULL` nii, et teine käivitus ei anna viga;
    - käivita see põhistacki db01-s kaks korda;
    - rakendus töötab edasi: `/health` on `UP` ja POST tulemus jõuab baasi;

    **Kontroll:**

    ```bash
    for _ in 1 2; do
        docker compose exec -T db01 sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" labseis' < db/migr/001-result-note.sql
        echo "kood $?"
    done
    docker compose exec db01 sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" labseis -e "DESCRIBE result"' | grep note
    curl -s localhost:8080/health; echo
    ```

    **Valmis, kui:**

    - mõlemad käivitused lõpevad koodiga 0;
    - `DESCRIBE` näitab rida `note varchar(200) YES`;
    - `/health` on `UP` ja POST jõuab `GET /api/results` vastusesse;

    Vihje: `ADD COLUMN IF NOT EXISTS`.

    ??? success "Lahendus"
        ```sql
        -- 001: tulemuse vabatekstiline märkus. Korduvalt käivitatav, vana kood ignoreerib veergu.
        ALTER TABLE result ADD COLUMN IF NOT EXISTS note VARCHAR(200) NULL;
        ```

        ```bash
        for _ in 1 2; do
            docker compose exec -T db01 sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" labseis' < db/migr/001-result-note.sql
        done
        docker compose exec db01 sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" labseis -e "DESCRIBE result"' | grep note
        curl -s localhost:8080/health; echo
        ```

        Kontroll: mõlemad käivitused lõpevad koodiga 0, `DESCRIBE` näitab rida `note varchar(200) YES`, `/health` on `UP` ja lehe Kogu stack Compose'iga POST jõuab `GET /api/results` vastusesse. initdb vastus: entrypoint käivitab failid failinimede järjekorras ja `001-…` on enne `01-schema.sql`-i, nii et tabelit `result` veel pole. Lisaks käivituvad need failid ainult tühja andmekataloogi korral, seega töötavasse baasi nad nagunii ei jõua.

        **Miks nii.** `ADD COLUMN IF NOT EXISTS` on MariaDB laiendus (MySQL-is seda pole), nii et teine käivitus annab ainult märkuse. Vana image talub veergu, sest `ResultRepository` kirjutab `INSERT`-is veergude nimed välja ja uus veerg lubab väärtust `NULL`: see on expand/contract'i esimene pool.

??? example "6 · Healthcheck'i ajastus"
    app01 healthcheck'i väärtused on praegu Dockerfile'ist võetud, mitte mõõdetud. Vale ajastusega healthcheck teeb deploy aeglaseks või annab valehäireid. Mõõda, kui kaua app01 tegelikult käivitub, ja vali väärtused selle järgi.

    - jälgi teises terminalis olekumuutusi `docker events`-iga (käsk on plokis Kontroll);
    - mõõda aeg app01 uuesti loomisest (`docker compose up -d --force-recreate --no-deps app01`) kuni `healthy`-ni;
    - proovi kolme seadistust: Dockerfile'i vaikeväärtused, `start_period: 5s` koos `retries: 1`-ga ja `interval: 60s`; iga kord märgi aeg `healthy`-ni ja `unhealthy` sündmuste arv;
    - `compose.yaml` jääb lõpuks muutmata.

    **Kontroll:**

    ```bash
    docker events --filter event=health_status --format '{{.Time}} {{.Actor.Attributes.name}} {{.Status}}'
    docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q app01)"
    git diff --stat compose.yaml
    ```

    **Valmis, kui:**

    - `git diff --stat compose.yaml` on tühi ja app01 on `healthy`.

    ??? success "Lahendus"
        ```yaml
        # hc-b.yaml: valehäire
        services:
          app01:
            healthcheck: {start_period: 5s, retries: 1}
        ---
        # hc-c.yaml: aeglane
        services:
          app01:
            healthcheck: {interval: 60s}
        ---
        # hc-d.yaml: tootmine
        services:
          app01:
            healthcheck: {interval: 15s, retries: 3, start_period: 120s, start_interval: 2s}
        ```

        ```bash
        for o in "" hc-b.yaml hc-c.yaml hc-d.yaml; do
            f=(-f compose.yaml); [ -n "$o" ] && f+=(-f "$o")
            t0=$(date +%s); docker compose "${f[@]}" up -d --force-recreate --no-deps app01
            id=$(docker compose ps -q app01)
            until [ "$(docker inspect -f '{{.State.Health.Status}}' "$id")" = healthy ]; do sleep 1; done
            echo "${o:-vaikimisi}: $(( $(date +%s) - t0 )) s, unhealthy: $(docker events --since "$t0" --until "$(date +%s)" \
                --filter container="$id" --filter event=health_status --format '{{.Status}}' | grep -c unhealthy)"
        done
        docker compose up -d --force-recreate --no-deps app01
        ```

        Kontroll: `hc-b` annab vähemalt ühe `unhealthy`, sest java ei vasta 5 s pärast. `hc-c` jõuab `healthy`-ni alles umbes 60 s pärast, ka siis, kui rakendus oli valmis 30 s pärast. `hc-d` jõuab umbes 2 s jooksul pärast valmisolekut ja `unhealthy` on 0. Viimane rida taastab `compose.yaml`-i algse sisu.

        **Miks nii.** Pikk intervall teeb aeglase deploy: teenus on ammu valmis, aga keegi ei tea. Liiga lühike `start_period` teeb valehäire: teenus märgitakse `unhealthy`-ks enne, kui see jõudis käivituda. Koopia asemel on lihtsam override-fail: Compose'i `healthcheck` ilma `test`-ita võtab käsu image'ist ja muudab ainult ajastust. `start_period` ajal ebaõnnestunud kontrolle ei arvestata, aga esimene õnnestumine teeb konteineri kohe `healthy`-ks. Seega `healthy`-ni kulub käivitusaeg pluss kuni üks `interval`. `start_interval` (Engine 25+) laseb käivitusajal kontrollida tihedamalt ilma tavaintervalli lühendamata.

??? example "7 · Väiksem image ilma Tomcatita"

    **Esita:** `k03-docker/app/Dockerfile.jre`

    Tomcati image kannab kaasas terve rakendusserveri, kuigi WAR on käivitatav ja Tomcat on selle sees. Väiksem image tähendab kiiremat tõmbamist ja vähem Trivy leide.

    - `Dockerfile.jre` käitusaste on `eclipse-temurin:21-jre-alpine`, oma kasutaja UID-ga 10001 ja `USER`;
    - `ENTRYPOINT` on exec-vormis: `java -XX:MaxRAMPercentage=75 -jar …`, healthcheck `wget`-iga;
    - võrdle suurust ja HIGH/CRITICAL Trivy leidude arvu Tomcati variandiga;

    **Kontroll:**

    ```bash
    docker image ls labori-seis-app --format '{{.Tag}} {{.Size}}'
    docker exec <konteiner> id
    docker inspect -f '{{.State.Health.Status}}' <konteiner>
    ```

    **Valmis, kui:**

    - `docker exec … id` näitab UID 10001;
    - konteiner on `healthy`;

    ??? success "Lahendus"
        ```dockerfile
        # build-aste sama mis app/Dockerfile-is
        FROM eclipse-temurin:21-jre-alpine
        RUN addgroup -S app && adduser -S -G app -u 10001 app
        WORKDIR /app
        COPY --from=build --chown=app:app /src/target/labori-seis.war /app/app.war
        USER 10001
        EXPOSE 8080
        HEALTHCHECK --interval=15s --timeout=3s --start-period=60s --retries=3 \
            CMD wget -qO- http://127.0.0.1:8080/health > /dev/null || exit 1
        ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.war"]
        ```

        ```bash
        docker build -f k03-docker/app/Dockerfile.jre -t labori-seis-app:jre .
        docker image ls labori-seis-app --format '{{.Tag}} {{.Size}}'
        for t in jre "$TAG"; do trivy image -q --severity HIGH,CRITICAL labori-seis-app:"$t" 2>/dev/null | grep -E '^Total'; done
        docker run -d --name jre --network labori-seis_default --env-file .env labori-seis-app:jre && sleep 75
        docker exec jre id; docker inspect -f '{{.State.Health.Status}}' jre; docker rm -f jre
        ```

        Kontroll: `id` annab `uid=10001(app)`, olek on `healthy`, image on umbes poole väiksem ja OS-pakettide leide on vähem. Erinevused app01 Tomcatiga: `server.xml`-i connector'i seaded, `catalina.out` ja Tomcati access log'id kaovad. Sisseehitatud Tomcati seadistatakse `server.*` omadustega ja logi läheb stdout'i. Prod-faili `CATALINA_OPTS` ei mõju selle image'iga.

        **Miks nii.** Spring Boot'i WAR on käivitatav, sest `spring-boot-maven-plugin` paneb sisseehitatud Tomcati `WEB-INF/lib-provided` kausta ja käivitusklassi manifesti. Alpine'is pole curl'i, healthcheck kasutab busybox'i `wget`-i. `MaxRAMPercentage` läheb `ENTRYPOINT`-i, sest `CATALINA_OPTS`-i siin keegi ei loe.

??? example "8 · Linuxi capability'd maha"

    **Esita:** `k03-docker/compose.prod.yaml`

    Konteineri root'il on vaikimisi kümmekond Linuxi capability't, mida enamik teenuseid ei vaja. Iga ülearune capability on ründajale tööriist, kui ta konteinerisse pääseb.

    - `compose.prod.yaml`-is on mc01-l `cap_drop: [ALL]` ja `security_opt: ["no-new-privileges:true"]` ning ta jääb `healthy`;
    - web01-l on sama ning `cap_add`-is ainult need capability'd, ilma milleta nginx ei käivitu;
    - võrdle capability'sid `docker inspect`-i ja `/proc/1/status`-i järgi enne ja pärast.

    **Kontroll:**

    ```bash
    P=(docker compose -f compose.yaml -f compose.prod.yaml)
    "${P[@]}" up -d --wait mc01 web01
    docker inspect -f '{{.HostConfig.CapDrop}} {{.HostConfig.CapAdd}}' "$("${P[@]}" ps -q web01)"
    "${P[@]}" exec web01 grep Cap /proc/1/status
    ```

    **Valmis, kui:**

    - mc01 ja web01 on `healthy`;
    - web01 `cap_add` nimekirjast ei saa ühtegi capability't eemaldada, ilma et nginx ebaõnnestuks;

    Vihje: alusta logist, `docker compose logs web01`.

    ??? success "Lahendus"
        ```yaml
          mc01:
            cap_drop: [ALL]
            security_opt: ["no-new-privileges:true"]
          web01:
            cap_drop: [ALL]
            cap_add: [CHOWN, SETGID, SETUID]
            security_opt: ["no-new-privileges:true"]
        ```

        ```bash
        P=(docker compose -f compose.yaml -f compose.prod.yaml)
        "${P[@]}" up -d --wait mc01 web01
        "${P[@]}" exec web01 grep -E 'CapEff|CapBnd' /proc/1/status
        "${P[@]}" exec mc01 grep CapBnd /proc/1/status
        "${P[@]}" exec web01 cat /proc/sys/net/ipv4/ip_unprivileged_port_start
        ```

        Kontroll: mõlemad on `healthy`, web01 `CapEff` ja `CapBnd` on `00000000000000c1` (bitid 0, 6 ja 7), mc01 `CapBnd` on `0000000000000000`, sysctl annab `0`. Ilma `CHOWN`-ita on logis `chown("/var/cache/nginx/client_temp", 101) failed (1: Operation not permitted)`. Täpne minimaalne nimekiri sõltub Nginx'i image'i versioonist, otsusta oma logi järgi.

        **Miks nii.** memcached töötab image'is kasutajana `memcache` ja ei vaja ühtegi capability't. nginx'i master on root: `CHOWN` vajab ta selleks, et anda `/var/cache/nginx/*_temp` kaustad worker'i kasutajale, ning `SETGID` ja `SETUID` selleks, et worker'id kasutajale `nginx` üle viia. `NET_BIND_SERVICE` pole vaja, sest Docker seab konteineris `net.ipv4.ip_unprivileged_port_start=0`. `no-new-privileges` takistab ainult setuid-bitiga failide käivitamist, `setuid()` süsteemikutset mitte.

??? example "9 · Mikroteenused: tulemuste consumer eraldi konteineriks"

    **Esita:** `k03-docker/compose.micro.yaml`

    API ja järjekorra consumer on praegu üks protsess: neid ei saa eraldi skaleerida ega uuendada, ja consumer'i rike peatab ka API. Jaga need kaheks teenuseks koodi muutmata; kõik peab mahtuma 4 GB VM-i.

    - `compose.micro.yaml`-is on sama image kahe teenusena: `api` (POST `/api/results` ja koondtabel) ja `worker` (järjekorrast MariaDB-sse);
    - `api` teenusel on consumer välja lülitatud (`SPRING_RABBITMQ_LISTENER_SIMPLE_AUTOSTARTUP=false`), `worker` jääb vaikeseadega;
    - mõlemal on healthcheck ja `depends_on` koos `condition: service_healthy`-ga; andmebaasi ja RabbitMQ porte pole hostis avaldatud;
    - käivita `docker compose -f compose.micro.yaml up -d --scale worker=3`, peata kõik workerid minutiks ja saada vahepeal tulemusi.

    **Kontroll:**

    ```bash
    M=(docker compose -f compose.micro.yaml)
    "${M[@]}" exec rmq01 rabbitmqctl list_queues name messages consumers
    curl -s localhost:8080/api/results; echo
    ```

    **Valmis, kui:**

    - kolme workeriga näitab `list_queues` järjekorral `results` kolme consumer'it;
    - põhistack on lõpus jälle üleval.

    ??? success "Lahendus"
        ```yaml
        name: labori-seis-micro
        x-app: &app
          image: ${APP_IMAGE:-${REGISTRY:?}/${OWNER:?}/labori-seis-app:${TAG:-dev}}
          restart: unless-stopped
          depends_on:
            db01: {condition: service_healthy}
            rmq01: {condition: service_healthy}
            mc01: {condition: service_healthy}
        services:
          # db01, mc01, rmq01 nagu compose.yaml-is, ilma ports:-ita
          api:
            <<: *app
            environment:
              DB_PASSWORD: ${DB_PASSWORD:?}
              RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD:?}
              TEACHER_TOKEN: ${TEACHER_TOKEN:?}
              SPRING_RABBITMQ_LISTENER_SIMPLE_AUTOSTARTUP: "false"
          worker:
            <<: *app
            environment:
              DB_PASSWORD: ${DB_PASSWORD:?}
              RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD:?}
              TEACHER_TOKEN: ${TEACHER_TOKEN:?}
          web01:
            image: ${REGISTRY:?}/${OWNER:?}/labori-seis-web:${TAG:-dev}
            environment: {APP_UPSTREAM: "api:8080"}
            ports: ["${WEB_PORT:-8080}:80"]
            depends_on: {api: {condition: service_healthy}}
        volumes: {dbdata: {}, rmqdata: {}}
        ```

        ```bash
        docker compose down && M=(docker compose -f compose.micro.yaml) && "${M[@]}" up -d --scale worker=3 --wait
        "${M[@]}" exec rmq01 rabbitmqctl list_queues name messages consumers     # results 0 3
        "${M[@]}" stop worker
        for i in 1 2 3 4 5; do curl -s -X POST localhost:8080/api/results -H 'Authorization: Bearer demo-kati-token' \
            -H 'Content-Type: application/json' -d '{"lab":"lab-03","check":"micro-'"$i"'","status":"OK"}'; echo; done
        "${M[@]}" exec rmq01 rabbitmqctl list_queues name messages consumers     # results 5 0
        "${M[@]}" start worker && sleep 15 && "${M[@]}" exec rmq01 rabbitmqctl list_queues name messages consumers
        ```

        Kontroll: kui workerid olid peatatud, vastas `api` `{"status":"accepted"}` ja järjekorras oli 5 sõnumit 0 consumer'iga, pärast `start`-i on 0 sõnumit ja 3 consumer'it ning `GET /api/results` näitab `micro-1` kuni `micro-5`. Ükski saadetud tulemus ei läinud kaotsi. Lõks: workeri healthcheck kontrollib baasi ja järjekorra ühendust, mitte listener'it, seega katkine consumer on ikkagi `healthy`. Lõpus `"${M[@]}" down -v && docker compose up -d --wait`. Täisfail on õpetajal.

        **Miks nii.** Eraldi projekti nimi hoiab volume'id põhistackist lahus. web01 suunab liikluse `api`-le template'i muutujaga `APP_UPSTREAM`, `worker`-il pole porti ega liiklust. Järjekord `results` on durable ja Spring saadab sõnumid vaikimisi persistent'ina, seega workeriteta jäävad sõnumid järjekorda ja säilivad ka pärast rmq01 taaskäivitust.

??? example "10 · Docker socket'i audit"

    **Esita:** `k03-docker/audit.sh`

    Konteiner, millele on mount'itud `/var/run/docker.sock`, saab käivitada uue konteineri hosti `/`-ga ja on seega sisuliselt root hostis. Monitooringu- ja CI-tööriistad küsivad socket'it sageli, ja serveris tuleb need üles leida.

    - vaata testkonteineriga, mida socket'iga konteiner näeb: `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock docker:29-cli docker ps`;
    - `audit.sh` käib läbi kõik töötavad konteinerid ja märgib need, millel on socket'i mount, `--privileged`, `network_mode: host` või `pid: host`;
    - käivita skript nii, et Labori seis töötab ja taustal töötab üks socket'iga testkonteiner, ning siis ilma testkonteinerita.

    **Kontroll:**

    ```bash
    docker run -d --name sockproov -v /var/run/docker.sock:/var/run/docker.sock docker:29-cli sleep 600
    ./audit.sh; docker rm -f sockproov; ./audit.sh
    shellcheck audit.sh
    ```

    **Valmis, kui:**

    - esimene käivitus märgib ainult `sockproov`-i;
    - teine käivitus ei märgi midagi;
    - `shellcheck audit.sh` vaikib;

    Vihje: alusta käsust `docker inspect -f '{{.Name}} {{.HostConfig.Privileged}} {{.HostConfig.NetworkMode}} {{range .Mounts}}{{.Source}} {{end}}'`.

    ??? success "Lahendus"
        ```bash
        #!/usr/bin/env bash
        set -euo pipefail
        found=0
        while IFS= read -r id; do
            IFS='|' read -r name priv net pid mounts < <(docker inspect -f \
                '{{.Name}}|{{.HostConfig.Privileged}}|{{.HostConfig.NetworkMode}}|{{.HostConfig.PidMode}}|{{range .Mounts}}{{.Source}} {{end}}' "$id")
            why=()
            [[ " $mounts" == *"docker.sock "* ]] && why+=("docker.sock")
            [[ "$priv" == true ]] && why+=("privileged")
            [[ "$net" == host ]] && why+=("network=host")
            [[ "$pid" == host ]] && why+=("pid=host")
            if [[ ${#why[@]} -gt 0 ]]; then echo "${name#/} ${why[*]}"; found=1; fi
        done < <(docker ps -q)
        exit "$found"
        ```

        ```bash
        docker run -d --name sockproov -v /var/run/docker.sock:/var/run/docker.sock docker:29-cli sleep 600
        ./audit.sh; echo "kood $?"
        docker rm -f sockproov; ./audit.sh; echo "kood $?"
        ```

        Kontroll: esimene käivitus väljastab ainult `sockproov docker.sock` ja koodi 1, teine ei väljasta midagi ja annab koodi 0. Socket'i `:ro` mount ei aita, sest see piirab faili, mitte API-kutseid. Ilma socket'ita saab monitooring info cgroup'idest (cAdvisor, node_exporter) või socket proxy kaudu, mis lubab ainult `GET /containers` ja `GET /events` (nt `tecnativa/docker-socket-proxy`).

        **Miks nii.** Iga konteineri kohta on üks `docker inspect` kõigi väljadega ja leitud põhjused lähevad massiivi. Väljumiskood 1, kui midagi leiti, teeb skriptist cron'i või monitooringu kontrolli.

??? example "11 · Varundus timeriga ja taastamise test"

    **Esita:** `k03-docker/backup.sh`

    Volume'i varundamise samm on praegu käsitsi tehtav ja taastamist varukoopiast pole proovitud. Tee sellest systemd timer'iga korduv töö, mis taastab koopia ajutisse konteinerisse ja kontrollib selle sisu.

    - `backup.sh` teeb `mariadb-dump --single-transaction` koopia (vt Tootmiskeskkonda sobiv stack, lõik "Varukoopia ilma katkestuseta") kuupäevaga faili `backup/` alla, alles jääb seitse viimast varukoopiat, kood on ≠ 0, kui dump ebaõnnestus;
    - võti `--verify` taastab viimase koopia ajutisse MariaDB konteinerisse, kontrollib, et tabelis `result` on ridu, ja koristab konteineri;
    - `systemctl --user` timer käivitab selle kord ööpäevas (`Persistent=true`), tulemus läheb `logger -t labseis-backup` kaudu journal'isse.

    **Kontroll:**

    ```bash
    systemctl --user list-timers labseis-backup.timer
    ./backup.sh --verify; echo "kood $?"
    for _ in $(seq 1 8); do ./backup.sh > /dev/null; sleep 1; done; ls backup/ | wc -l
    journalctl -t labseis-backup -n 5 --no-pager
    ```

    **Valmis, kui:**

    - `systemctl --user list-timers` näitab järgmise käivituse aega;
    - `./backup.sh --verify` annab koodi 0;
    - kaheksas käivitus kustutab vanima faili ja `backup/`-is on 7 faili;
    - journal'is on iga käivituse tulemus.

    ??? success "Lahendus"
        ```bash
        # backup.sh põhiosa (set -euo pipefail, cd skripti kausta, log() = echo + logger -t labseis-backup)
        out="backup/labseis-$(date +%Y%m%d-%H%M%S).sql.gz"; tmp="$out.part"; mkdir -p backup
        docker compose exec -T db01 sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb-dump -uroot \
            --single-transaction --routines --triggers --databases labseis' | gzip > "$tmp" || die "dump ebaõnnestus"
        gzip -dc "$tmp" | tail -n 1 | grep -q '^-- Dump completed' || die "dump on poolik"
        mv "$tmp" "$out"
        mapfile -t files < <(find backup -maxdepth 1 -name 'labseis-*.sql.gz' -printf '%f\n' | sort -r)
        for f in "${files[@]:7}"; do rm -f -- "backup/$f"; done

        # --verify
        last=$(find backup -maxdepth 1 -name 'labseis-*.sql.gz' | sort -r | head -n 1)
        c="labseis-verify-$$"; trap 'docker rm -f "$c" >/dev/null 2>&1 || true' EXIT
        docker run -d --name "$c" --network none -e MARIADB_ROOT_PASSWORD="$(od -An -tx1 -N12 /dev/urandom | tr -d ' \n')" mariadb:11.4
        until docker exec "$c" healthcheck.sh --connect --innodb_initialized 2>/dev/null; do sleep 2; done   # tootmisskriptis ajapiiriga
        gzip -dc "$last" | docker exec -i "$c" sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot'
        n=$(docker exec "$c" sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot -N -e "SELECT COUNT(*) FROM labseis.result"')
        [[ "$n" -gt 0 ]] || die "taastatud baasis result=$n"
        ```

        ```ini
        # ~/.config/systemd/user/labseis-backup.service
        [Service]
        Type=oneshot
        ExecStart=%h/<repo>/k03-docker/backup.sh
        ExecStart=%h/<repo>/k03-docker/backup.sh --verify

        # ~/.config/systemd/user/labseis-backup.timer
        [Timer]
        OnCalendar=*-*-* 02:30:00
        RandomizedDelaySec=15min
        Persistent=true
        [Install]
        WantedBy=timers.target
        ```

        ```bash
        systemctl --user daemon-reload && systemctl --user enable --now labseis-backup.timer
        loginctl enable-linger "$USER"
        systemctl --user list-timers labseis-backup.timer; ./backup.sh --verify; echo "kood $?"
        for _ in $(seq 1 8); do ./backup.sh > /dev/null; sleep 1; done; ls backup/ | wc -l
        ```

        Kontroll: `list-timers` näitab `NEXT` aega, `--verify` annab koodi 0 ja journal'is on `VERIFY OK … result=N`, pärast kaheksat käivitust on `backup/`-is 7 faili. Lõks: ilma `enable-linger`-ita ei käivitu kasutaja timer, kui keegi pole sisse loginud. Prod-failis pole `MARIADB_ROOT_PASSWORD`-i keskkonnas, siis loe parool failist `/run/secrets/DB_ROOT_PASSWORD`. Täisskript on õpetajal.

        **Miks nii.** Kolm kohta, kus lihtne skript eksib: `docker compose exec … | gzip` annab ilma `pipefail`-ita koodi 0 ka siis, kui dump ebaõnnestus; poolik fail ei tohi saada lõplikku nime (kirjuta `.part` ja `mv`); `mariadb-dump` kirjutab viimaseks reaks `-- Dump completed`, ja see on odav terviklikkuse kontroll. Ajutine MariaDB tuleb `--network none`-ga ja valmisolekut kontrollib `healthcheck.sh --connect`, mis init-faasi ajutise serveri ajal (`--skip-networking`) ei läbi.

??? example "12 · Oma baas-image ja selle elutsükkel"

    **Esita:** `k03-docker/base/Dockerfile`, `base-build.sh`, `base-stale.sh`, `app/Dockerfile.base`

    app01 image'i käitusaste loob ise kasutaja 10001 ja seab Tomcati kaustade omanikud. Kui sama teeb kümme meeskonda, on kümme veidi erinevat baasi ja pärast üht turvaparandust pole selge, millised image'id on veel vana Tomcati peal.

    - `base/Dockerfile` ja `base-build.sh`: upstream'i image `tomcat:10.1-jre21-temurin` lahendatakse build'i ajal digest'iks ja kirjutatakse label'isse `org.opencontainers.image.base.digest`; baasis on app01 käitusastme `RUN` (curl, kasutaja 10001, õigused), `tzdata` ja `TZ=Europe/Tallinn`;
    - `base-build.sh` skannib baasi (CRITICAL nurjab) ja lükkab registry'sse tag'id `labseis-base-tomcat:<YYYYMMDD>` ja liikuva `labseis-base-tomcat:10.1-jre21`;
    - `app/Dockerfile.base`: build-aste sama mis `app/Dockerfile`-is, käitusaste `FROM ${BASE}` ilma oma `apt-get`-ita; põhilabori `app/Dockerfile` jääb muutmata;
    - `base-stale.sh <baas> <image>...` väljastab iga image'i kohta `OK` või `VANA` ja lõpetab koodiga 1, kui mõni image on ehitatud baasi varasema versiooni peale; ära usalda image'i nime ega label'it, kontrolli sisu;

    **Kontroll:**

    ```bash
    B="$REGISTRY/$OWNER/labseis-base-tomcat:10.1-jre21"; A="$REGISTRY/$OWNER/labori-seis-app:base-$TAG"
    ./base-stale.sh "$B" "$A"; echo "kood $?"
    ./base-build.sh && PULL=0 ./base-stale.sh "$B" "$A"; echo "kood $?"
    # pärast app01 uut build'i Dockerfile.base-iga: ./base-stale.sh "$B" "$A"
    docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.base.digest"}}' "$B"
    ```

    **Valmis, kui:**

    - esimene kontroll annab `OK` ja koodi 0;
    - pärast baasi uut build'i annab sama image `VANA` ja koodi 1, pärast app01 uut build'i jälle `OK`;
    - label'is on `sha256:…`;
    - ShellCheck ei anna hoiatusi.

    ??? success "Lahendus"
        ```dockerfile
        # base/Dockerfile
        ARG UPSTREAM=tomcat:10.1-jre21-temurin
        FROM ${UPSTREAM}
        ARG UPSTREAM
        ARG UPSTREAM_DIGEST=unknown
        RUN apt-get update -qq \
            && apt-get install -y -qq --no-install-recommends curl ca-certificates tzdata \
            && rm -rf /var/lib/apt/lists/* /usr/local/tomcat/webapps/* \
            && ln -sf /usr/share/zoneinfo/Europe/Tallinn /etc/localtime \
            && useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin labseis \
            && mkdir -p /usr/local/tomcat/conf/Catalina/localhost \
            && chown -R 10001:10001 /usr/local/tomcat/logs /usr/local/tomcat/temp /usr/local/tomcat/work \
                /usr/local/tomcat/webapps /usr/local/tomcat/conf/Catalina
        ENV TZ=Europe/Tallinn
        LABEL org.opencontainers.image.base.name="${UPSTREAM}" \
              org.opencontainers.image.base.digest="${UPSTREAM_DIGEST}"
        ```

        ```bash
        # base-build.sh põhiosa (set -euo pipefail, cd skripti kausta, .env loetud nagu scan.sh-is)
        up=tomcat:10.1-jre21-temurin; docker pull -q "$up" > /dev/null
        ref=$(docker image inspect -f '{{index .RepoDigests 0}}' "$up")      # docker.io/library/tomcat@sha256:…
        img="$REGISTRY/$OWNER/labseis-base-tomcat"; day=$(date +%Y%m%d)
        docker build --no-cache --build-arg UPSTREAM="$ref" --build-arg UPSTREAM_DIGEST="${ref#*@}" \
            -t "$img:$day" -t "$img:10.1-jre21" base
        trivy image --quiet --exit-code 1 --severity CRITICAL --ignore-unfixed "$img:$day"
        docker push -q "$img:$day" && docker push -q "$img:10.1-jre21"
        ```

        ```bash
        #!/usr/bin/env bash
        # base-stale.sh <baas> <image>...   PULL=0 jätab tõmbamise vahele
        set -euo pipefail
        base=${1:?baas-image puudub}; shift
        [[ $# -gt 0 ]] || { echo "image'id puuduvad" >&2; exit 2; }
        pull() { [[ ${PULL:-1} == 1 ]] && docker pull -q "$1" > /dev/null; return 0; }
        layers() { docker image inspect -f '{{json .RootFS.Layers}}' "$1"; }
        pull "$base"; top=$(layers "$base" | jq -r '.[-1]'); rc=0
        for img in "$@"; do
            pull "$img"
            if layers "$img" | jq -e --arg t "$top" 'any(.[]; . == $t)' > /dev/null; then
                echo "OK     $img"
            else
                echo "VANA   $img"; rc=1
            fi
        done
        exit "$rc"
        ```

        `app/Dockerfile.base` algab `ARG BASE=…` reaga enne esimest `FROM`-i (globaalne ARG), käitusaste on `FROM ${BASE}`, selle järel `COPY --from=build`, `HEALTHCHECK`, `GIT_SHA` label ja `USER 10001` nagu `app/Dockerfile`-is. Ehita `--build-arg BASE="$B" -t "$A"`.

        Kontroll: nagu ülesande juures, kolm käivitust annavad `OK`/0, `VANA`/1 ja pärast `docker build -f app/Dockerfile.base …` jälle `OK`/0. Lõks: baasi label'id päritakse, nii et app01 image'is näitab `org.opencontainers.image.base.digest` Tomcati upstream'i, mitte sinu baasi. Kirjuta see rakenduse Dockerfile'is üle või ära tee selle põhjal otsuseid. Täisfailid on õpetajal.

        **Miks nii.** `FROM` kopeerib baasi kihid rakenduse image'isse. Kui baasi viimane kiht (`RootFS.Layers` viimane element) on rakenduse kihtide seas, on rakendus ehitatud just selle baasi peale. Kuupäevaga tag ja label võivad valetada, kihi räsi mitte. `--no-cache` baasi build'il on vajalik, muidu jätab cache vana `apt-get` kihi alles ja paik ei jõua baasi.

??? example "13 · Saladuse rotatsioon töötavas stackis"

    **Esita:** `k03-docker/rotate-db-password.sh`

    Prod-failis on andmebaasi parool failis `secrets/DB_PASSWORD`. Auditi järel tuleb kasutaja `labseis` parool vahetada töötavas stackis: andmed ei kao, katkestus on ainult app01 uuesti loomise aeg ja ebaõnnestumisel taastatakse eelmine olek. MariaDB-l pole topeltparooli (MySQL 8 `RETAIN CURRENT PASSWORD`), nii et vana ja uus parool ei kehti korraga.

    - enne esimest käivitust salvesta algseis: `ps`, tabeli `result` ridade arv ja `sha256sum secrets/DB_PASSWORD`;
    - `rotate-db-password.sh` kontrollib enne muudatust, et failis olev parool töötab baasis ja `/health` on `UP`; kui ei, ei muuda midagi;
    - uus parool genereeritakse skriptis ega ole üheski käsurea argumendis (hosti `ps`, shelli ajalugu);
    - pärast käivitust on uus parool baasis, `secrets/DB_PASSWORD`-is ja `.env`-is, ja uuesti luuakse ainult app01;
    - kui mõni samm pärast baasi muutmist ebaõnnestub, taastab skript baasi parooli ja failid ning lõpetab koodiga ≠ 0;
    - proovi ebaõnnestumist `APP_IMAGE=<lisaprojekti katki image> ./rotate-db-password.sh`-iga, loo siis app01 tavalise image'iga uuesti.

    **Kontroll:**

    ```bash
    D=(docker compose -f compose.yaml -f compose.prod.yaml); OLD=$(< secrets/DB_PASSWORD)
    ./rotate-db-password.sh; echo "kood $?"; curl -s localhost:8080/health; echo
    printf '%s\n' "$OLD" | "${D[@]}" exec -T db01 sh -c 'read -r p; MYSQL_PWD="$p" mariadb -ulabseis -e "SELECT 1" labseis'
    grep -c "$OLD" .env secrets/DB_PASSWORD; "${D[@]}" ps --format '{{.Service}} {{.RunningFor}}'
    ```

    **Valmis, kui:**

    - skript lõpetas koodiga 0 ja `/health` näitab `"db":"UP"`;
    - vana parool annab `ERROR 1045` ja `grep -c` annab mõlemale failile 0;
    - ainult app01 on uus ja ridade arv `result`-is ei vähenenud;
    - ebaõnnestumise katse lõppes koodiga ≠ 0 ja vana parool töötas pärast seda.

    ??? tip "Lahenduse suund"
        Parool muutub baasis ainult `ALTER USER 'labseis'@'%' IDENTIFIED BY …` käsuga. `MARIADB_PASSWORD_FILE` loeb entrypoint ainult tühja andmekataloogi korral. Faili muutmine ja db01 uuesti loomine ei tee olemasoleva volume'iga midagi, ja see on ülesande peamine lõks. Järjekord: eelkontroll → failide varukoopia kausta `secrets/` → `ALTER USER` root'ina → uus väärtus faili ja `.env`-i → `up -d --no-deps --force-recreate --wait app01` → kontroll. `ALTER USER` ei katkesta olemasolevaid sessioone, nii et HikariCP pool'i ühendused töötavad app01 uuesti loomiseni edasi. SQL ja paroolid saada konteinerisse `docker compose exec -T` stdin'i kaudu, konteineris kasuta `MYSQL_PWD`-d, mitte `-p<parool>`-i. Faili kirjuta `printf '%s' > fail`-iga: sama inode jääb alles ja töötav db01 näeb bind mount'i kaudu kohe uut sisu, `mv` või redaktor teeks uue inode'i. Tüüpilised lõksud: `.env` jääb vanaks ja järgmine `docker compose up -d` ilma prod-failita annab `"db":"DOWN"`; `.env.bak` repo juures ei ole `.gitignore`-is; `set -e` lõpetab skripti enne rollback'i, kui samm 4 või 5 ei ole `|| rollback` kaitse all. Ilma katkestuseta variant kasutab sammu 5 asemel ülesande 14 mustrit või kahte vahelduvat kasutajat (`DB_USER`).

??? example "14 · Uuendus ilma katkestuseta"

    **Esita:** `k03-docker/rollout.sh`

    Compose peatab `up -d` ajal vana app01 enne uue käivitamist, ja see vahe annab web01 kaudu 502. Lisaprojekti `uuenda.sh` teeb sama. Kasutaja ei tohi näha ühtegi vastust peale 200 ja vigase image'iga konteinerisse ei tohi kunagi liiklust suunata; Compose ise kahte versiooni korraga ei halda, seega lahendus on skriptis.

    - tee vigane image `katki`, mis käivitub, aga ei saa kunagi `healthy` (sama mis lisaprojekti eeltingimustes):

        ```bash
        printf 'FROM %s\nHEALTHCHECK --interval=5s --retries=2 CMD false\n' "$R/labori-seis-app:$TAG" \
            | docker build -t "$R/labori-seis-app:katki" - && docker push "$R/labori-seis-app:katki"
        ```

    - `rollout.sh <tag>` kontrollib enne muudatust, et image on registry's; kui ei ole, stack jääb puutumata;
    - uus app01 koopia töötab vana kõrval ja liiklus jõuab uuele alles siis, kui see on `healthy`; vana peatatakse alles siis, kui web01 teab uue koopia aadressi;
    - kui uus koopia ei jõua `healthy` olekusse, eemaldatakse ainult see ja vana konteiner teenindab edasi;
    - pärast õnnestunud uuendust ei vii `docker compose up -d` app01-te vanale image'ile tagasi; ShellCheck ei anna hoiatusi;
    - käivita teises terminalis mõõtmine ja tee kaks uuendust: uus tag ja `katki`.

    **Kontroll:**

    ```bash
    ( for _ in $(seq 1 900); do curl -s -o /dev/null -m 10 -w '%{http_code}\n' localhost:8080/health; sleep 0.2; done ) > codes.txt &
    ./rollout.sh "<uus tag>"; echo "kood $?"; ./rollout.sh katki; echo "kood $?"
    wait; sort codes.txt | uniq -c
    curl -s localhost:8080/version; echo; docker compose ps app01 --format '{{.Name}} {{.Image}}'
    docker compose up -d 2>&1 | grep app01
    ```

    **Valmis, kui:**

    - `codes.txt`-is on ainult `200`;
    - `/version` näitab uut tag'i ja `katki` lõppes koodiga 1;
    - app01 konteinereid on täpselt üks, uue tag'iga;
    - viimane `up -d` ütleb app01 kohta `Running`, mitte `Recreated`.

    ??? tip "Lahenduse suund"
        Muster on sama mis tööriistal [docker-rollout](https://github.com/wowu/docker-rollout): `APP_IMAGE=<uus> docker compose up -d --no-deps --no-build --no-recreate --scale app01=2 app01`. `--no-recreate` jätab vana konteineri alles, kuigi tema konfiguratsioon enam ei klapi, ja uus koopia saab uue image'i. app01-l pole `ports:` ega `container_name:`, nii et kaks koopiat ei põrka kokku. Uue koopia ID leiad `docker compose ps -q app01` võrdlusest enne ja pärast. Oota `docker inspect -f '{{.State.Health.Status}}'` kuni `healthy`, siis veel üle 10 s, sest nginx lahendab nime `app01` uuesti `resolver valid=10s` järgi ja peab nägema mõlemat IP-d. Seejärel `docker stop` ja `docker rm` vanale. Kuni 10 s jooksul võib nginx proovida kadunud IP-d, aga `proxy_next_upstream error timeout` (vaikeväärtus) proovib järgmist aadressi, nii et GET saab 200. Lõpuks kirjuta `APP_IMAGE=<uus>` `.env`-i, muidu loob järgmine `up -d` app01 uuesti `.env`-i `TAG`-iga. Tüüpilised lõksud: vana peatamine kohe pärast `healthy` olekut annab 502 akna; skriptid, mis kasutavad nime `labori-seis-app01-1`, ei leia enam konteinerit, sest uus on `-2`; kaks JVM-i korraga vajavad mälu, prod-failis 2 × 768 MB.

??? example "Lisaprojekt · uuendus ja rollback"

    **Esita:** `k03-docker/uuenda.sh`

    Praegu uuendad app01-te käsitsi ja kui uus image ei käivitu, otsid eelmise tag'i ise üles. Skript `uuenda.sh` viib app01 uuele image'i tag'ile, kontrollib tulemust ja läheb vea korral ise eelmisele tagasi. Nõuded on ülevalt alla ka skripti töö järjekord: ükski samm ei muuda stacki enne, kui eelmine on õnnestunud.

    - põhistack töötab ilma prod-failita (`COMPOSE_FILE` seadmata) ja Harboris on vähemalt kaks app-image'i tag'i (muuda `VersionController.java`-s üht rida, commit'i, `docker compose build app01 && docker compose push app01` uue `TAG`-iga);
    - vigane image `katki` käivitub, aga ei saa kunagi `healthy`:

        ```bash
        printf 'FROM %s\nHEALTHCHECK --interval=5s --retries=2 CMD false\n' "$R/labori-seis-app:$TAG" \
            | docker build -t "$R/labori-seis-app:katki" - && docker push "$R/labori-seis-app:katki"
        ```

    - `uuenda.sh <tag>` annab ilma argumendita kasutusjuhendi ja koodi 2; `set -euo pipefail`, ShellCheck ei anna hoiatusi; image'i täisnimi tuleb `.env`-i `REGISTRY` ja `OWNER` väärtustest;
    - enne muudatust kontrollib, et image on registry's (`docker pull`); kui ei ole, stack jääb puutumata;
    - salvestab praeguse image'i ja uuendab ainult app01-te: `APP_IMAGE=… docker compose up -d --no-deps --no-build --wait app01`;
    - pärast uuendust küsib `/health`-i web01 kaudu;
    - ebaõnnestumisel paneb tagasi eelmise image'i ja lõpetab koodiga 1;
    - iga käivituse tulemus läheb `logger -t labseis-deploy` kaudu journal'isse.

    **Kontroll:**

    ```bash
    ./uuenda.sh; echo "kood $?"
    ./uuenda.sh olematu; echo "kood $?"; docker inspect -f '{{.Config.Image}}' labori-seis-app01-1
    ./uuenda.sh katki; echo "kood $?"; docker inspect -f '{{.Config.Image}}' labori-seis-app01-1
    ./uuenda.sh "<uus tag>" && curl -s localhost:8080/version; echo
    sudo journalctl -t labseis-deploy -n 4 --no-pager
    ```

    **Valmis, kui:**

    - kolm esimest käivitust lõppesid koodiga ≠ 0, app01 jäi vanale image'ile ja on `healthy`;
    - neljas käivitus viis `/version`-i uuele tag'ile ja teiste teenuste `RunningFor` ei muutunud;
    - journal'is on neli rida.

    Vihje: praeguse image'i nime annab `docker inspect -f '{{.Config.Image}}' labori-seis-app01-1`.

    ??? tip "Lahenduse suund"
        Skriptil on kolm osa: kontroll, muudatus ja tulemuse kontroll. Iga osa lõpeb kas `exit`-iga või läheb järgmisse. Logi ka kasutusviga, enne `exit 2`-te. Image'i täisnime saad, kui loed `.env`-i (`set -a; . ./.env; set +a`) ja paned kokku `$REGISTRY/$OWNER/labori-seis-app:$1`. Olemasolu kontrolliks sobib `docker pull -q`: see kontrollib korraga registry't, autentimist, CA-d ja tag'i. Eelmine image tuleb töötavalt konteinerilt (`docker inspect -f '{{.Config.Image}}' "$(docker compose ps -q app01)"`), mitte `.env`-ist, sest `.env` ütleb, mis peaks töötama, konteiner aga, mis töötab. Uuendus ja rollback on sama funktsioon erineva image'iga: `APP_IMAGE="$1" docker compose up -d --no-deps --no-build --wait --wait-timeout 180 app01`. `--wait` lõpeb veaga, kui konteiner läheb `unhealthy`. Pärast seda küsi `/health`-i web01 kaudu korduskatsega umbes 30 s, sest nginx lahendab uue konteineri IP alles `resolver valid=10s` järel. Kasuta eraldi väljumiskoode: uuendus ebaõnnestus ja rollback õnnestus ning ka rollback ebaõnnestus. Konveier peab neid eristama. Tüüpilised lõksud: konteineri nimi koodis (`labori-seis-app01-1`) läheb katki, kui keegi on teenust skaleerinud; `set -e` lõpetab skripti enne rollback'i, kui `deploy` ei ole `if`-i tingimuses. Täislahendus on õpetajal.

        **Miks nii.** Skript on käsitsi käivitatav versioon sellest, mida GitHub Actionsi pipeline deploy-sammus teeb. `up -d` loob app01 uuesti: vana konteiner peatatakse, uus käivitatakse. Selle vahe jooksul vastab web01 502-ga, sest teist app01 koopiat pole. Compose ei tee rolling update'i ega hoia eelmist versiooni meeles; mõlemad on skripti või orkestraatori töö. Kubernetes teeb sama Deployment'iga: uus pod käivitatakse enne vana peatamist ja liiklus läheb sinna alles siis, kui readiness-kontroll õnnestub.

        Rollback sõltub sellest, kas vana image on veel olemas. Lokaalne cache pole selleks usaldusväärne koht, sest `prune.sh` kustutab vanad image'id. Registry on õige koht, ja seepärast on mõistlik registry's hoida vähemalt mõnda eelmist versiooni. Kui tahad garanteerida, et rollback toob täpselt sama sisu, salvesta tag'i asemel digest.

        Skript võtab tagasi ainult image'i, volume jääb uude olekusse. Kui uus versioon muutis skeemi, peab skeem ühilduma ka eelmise image'iga (expand/contract: kõigepealt lisatakse veerg, mida vana kood ignoreerib, ja eemaldatakse alles järgmises versioonis). Muidu saab rollback'i teha ainult varukoopiast ja sellega kaasneb andmekadu.

??? example "Lisaprojekt · oma registry control'is"

    **Esita:** `k03-docker/registry/compose.yaml`, `k03-docker/.gitignore`

    Harbor on valmis teenus ja selle sisemust sa ei näe. Paned control'is käima oma `registry:2` TLS-i ja parooliga ning lükkad sinna Labori seisu web-image'i.

    - kaust `k03-docker/registry/` alamkaustadega `certs/` ja `auth/`, mõlemad `.gitignore`-is; self-signed sertifikaat SAN-iga control'i IP ja bcrypt'iga paroolifail:

        ```bash
        sudo ss -tlnp | grep ':5000 '; command -v openssl jq    # port vaba, tööriistad olemas
        cd k03-docker/registry && IP=<control IP VPN-is>    # see on registry nimi
        openssl req -x509 -newkey rsa:4096 -nodes -days 30 -subj "/CN=$IP" \
            -addext "subjectAltName=IP:$IP" -keyout certs/registry.key -out certs/registry.crt
        read -rsp 'registry parool: ' P; echo
        docker run --rm --entrypoint htpasswd httpd:2.4 -Bbn labseis "$P" > auth/htpasswd; unset P
        ```

    - `registry/compose.yaml`: `registry:2`, port 5000, nimega volume `/var/lib/registry`, `restart: unless-stopped`, `/certs` ja `/auth` kirjutuskaitstud mount'iga ning muutujad:

        ```text
        REGISTRY_HTTP_TLS_CERTIFICATE=/certs/registry.crt
        REGISTRY_HTTP_TLS_KEY=/certs/registry.key
        REGISTRY_AUTH=htpasswd
        REGISTRY_AUTH_HTPASSWD_REALM=labseis        # vabalt valitud nimi
        REGISTRY_AUTH_HTPASSWD_PATH=/auth/htpasswd
        REGISTRY_STORAGE_DELETE_ENABLED=true
        ```

    - Docker usaldab CA-d `certs.d` kaudu, `insecure-registries` jääb tühjaks; logi sisse enne ja pärast CA paigaldust ja lükka web-image sinna:

        ```bash
        docker login "$IP:5000" -u labseis
        sudo install -D -m 644 certs/registry.crt "/etc/docker/certs.d/$IP:5000/ca.crt"
        docker login "$IP:5000" -u labseis
        # $W ja $TAG on samad mis Harbori push'il
        docker tag "$W:$TAG" "$IP:5000/labseis/labori-seis-web:$TAG" && docker push "$IP:5000/labseis/labori-seis-web:$TAG"
        ```

    - teine tag `vana` (teine nginx'i versioon) kustutatakse API kaudu (`DELETE /v2/<repo>/manifests/<digest>`) koos lapsmanifestidega; enne kontrolli, et ükski teine tag ei viita samale digestile:

        ```bash
        sed 's/nginx:1.30-alpine/nginx:1.29-alpine/' ../web/Dockerfile \
            | docker build -t "$IP:5000/labseis/labori-seis-web:vana" -f - ../web
        docker push "$IP:5000/labseis/labori-seis-web:vana"
        docker compose exec registry du -sm /var/lib/registry
        ```

    - garbage collection'i ajal on registry read-only režiimis (`REGISTRY_STORAGE_MAINTENANCE_READONLY`), pärast tavarežiimis;

    **Kontroll:**

    ```bash
    openssl s_client -connect "$IP:5000" </dev/null 2>/dev/null | openssl x509 -noout -ext subjectAltName
    curl -s -o /dev/null -w '%{http_code}\n' --cacert certs/registry.crt "https://$IP:5000/v2/"
    docker info -f '{{json .RegistryConfig.InsecureRegistryCIDRs}}'
    git check-ignore registry/certs/registry.key registry/auth/htpasswd
    curl -s --cacert certs/registry.crt -u labseis "https://$IP:5000/v2/_catalog"; echo
    curl -s --cacert certs/registry.crt -u labseis "https://$IP:5000/v2/labseis/labori-seis-web/tags/list"; echo
    docker image rm "$IP:5000/labseis/labori-seis-web:$TAG" && docker pull "$IP:5000/labseis/labori-seis-web:$TAG"
    docker compose exec registry registry garbage-collect --dry-run /etc/docker/registry/config.yml | tail -2
    docker compose exec registry du -sm /var/lib/registry; docker pull "$IP:5000/labseis/labori-seis-web:vana"
    ```

    **Valmis, kui:**

    - esimene `login` andis `x509` vea, teine õnnestus; SAN-is on sinu IP, `/v2/` annab 401, `InsecureRegistryCIDRs` on ainult loopback;
    - `git check-ignore` leiab mõlemad failid, `garbage-collect --dry-run` töötab vigadeta;
    - kataloogis on ainult `$TAG`, see tõmmatakse sinu registry'st, `vana` annab `manifest unknown`;
    - read-only režiimis õnnestus pull, aga push andis vea;
    - `du -sm /var/lib/registry` on väiksem kui pärast `vana` push'i.

    ??? tip "Lahenduse suund"
        API kustutab manifesti ainult digesti järgi. Digesti saad `HEAD /v2/<repo>/manifests/<tag>` vastuse päisest `Docker-Content-Digest`, kui `Accept` päistes on kõik neli manifestitüüpi (OCI index ja manifest, Docker manifest list ja v2). Ilma nendeta võib registry anda vea või teise digesti. Docker 29 BuildKit lükkab OCI index'i, milles on image'i manifest ja attestation'i manifest. Index'i kustutamisel jäävad lapsmanifestid repositooriumisse alles ja nende kihid jäävad garbage collection'il alles, seega loe index'ist `.manifests[].digest` ja kustuta need enne. Digesti järgi kustutamine eemaldab kõik tag'id, mis sellele digestile viitavad: võrdle enne kõigi `tags/list` tag'ide digeste. Read-only režiim on konfiguratsiooni võti `storage.maintenance.readonly`. Keskkonnamuutuja väärtus parsitakse YAML-ina (`'{"enabled": true}'`) ja seda on mugav lisada eraldi override-failiga (`compose.maint.yaml`). Režiimi vahetus loob konteineri uuesti, seega on paar sekundit katkestust, aga mitte kogu GC aja. Siis käivita `registry garbage-collect /etc/docker/registry/config.yml` ja mine tagasi tavarežiimi. Tüüpiline lõks: `--delete-untagged` võib `registry:2` puhul kustutada ka teiste index'ite lapsmanifestid, sest need ei ole otse tag'itud, ja pärast seda ei saa ka `$TAG`-i tõmmata. Paroolile sobib `curl --netrc-file`, mitte `-u kasutaja:parool` argv-s. Täislahendus on õpetajal.

        **Miks nii.** Iga nõue on üks omadus, mis eristab tööks sobivat registry't demost: püsivad andmed, krüpteeritud ühendus, autentimine, kustutamise võimalus, usaldus ilma kontrolli välja lülitamata ja hooldus, mis pull'e ei katkesta.

        Registry on HTTP API. `docker push` küsib iga kihi kohta digesti järgi, kas see on olemas, saadab ainult puuduvad ja lõpuks manifesti, mis seob tag'i kihtidega. Seepärast nägid Harbori push'il `Layer already exists`. Kettal on volume'is `docker/registry/v2/blobs` kaust, kus iga kiht on üks fail oma räsi nime all, ja `repositories` kaust, kus tag'id viitavad manifestidele. Tag'i kustutamine eemaldab ainult viite. Ruumi vabastab `garbage-collect`, ja seda käivitatakse siis, kui keegi parasjagu image'eid ei lükka, sest samaaegne push võib jääda poolikuks.

        `insecure-registries` lülitab selle registry jaoks välja sertifikaadi kontrolli ja lubab ka tavalise HTTP. `docker login` saadab parooli Basic-autentimisega ja Docker hoiab seda `~/.docker/config.json`-is või credential helper'is. Ilma kontrollita saab vahel olev masin parooli kätte ja võib sama tag'i all anda teise image'i, ning tag'iga tõmbav masin seda ei märka. Seade kehtib kogu daemonile ja kõigile selle hosti kasutajatele. Loopback (`127.0.0.0/8`) on vaikimisi ebaturvaliste registry'te nimekirjas, seepärast töötab `localhost:5000` ka ilma TLS-ita ja seepärast testid siin IP-aadressiga. Õige lahendus on alati CA fail `certs.d` all: kontroll jääb sisse ja usaldus kehtib ainult sellele registry'le.

        Harbori projekt `dockerhub` teeb sama, mida `registry:2` teeb teises režiimis: `REGISTRY_PROXY_REMOTEURL` teeb registry'st pull-through cache'i, mis tõmbab puuduva image'i Docker Hubist ja hoiab seda alles. Uuem põhiversioon on `registry:3`, mille seadistus on suures osas sama. Tootmises on lihtsal registry'l üks puudus: ühe parooliga saab igaüks push'ida igasse repositooriumi. Harbor, Gitea ja pilveregistrid lisavad kasutajad, õigused repositooriumi kaupa, säilituspoliitika ja skannimise, ja seepärast kasutab kursus Harborit.

??? example "Lisaprojekt · rootless Docker"
    Turvanõue „konteinerid ilma root-daemonita“ ei tähenda alati Podmani: osa tiime vajab Compose'i ja Dockeri socket'it muutmata. Käivitad control'is sama db-image'i tavalise ja rootless Dockeriga kõrvuti ning võrdled tulemust sellega, mida Podman mc01-s ja db01-s näitas. `labori-seis-db` image on Harboris, control'is on paketid `uidmap` ja `docker-ce-rootless-extras` ([rootless Docker](https://docs.docker.com/engine/security/rootless/)) ja `grep "$USER" /etc/subuid` annab rea.

    - rootless Docker on control'is teine kontekst `rootless`, rootful Docker töötab edasi:

        ```bash
        dockerd-rootless-setuptool.sh install
        docker context ls
        docker --context rootless info --format '{{.SecurityOptions}}'
        ```

    - sama image töötab kaks korda, `docker run` (rootful) ja `docker --context rootless run`, mõlemal nimega volume'iga;
    - rootless daemon ja selle konteiner käivituvad pärast control'i taaskäivitust ilma sisselogimiseta.

    **Kontroll:**

    ```bash
    docker context ls; docker ps --format '{{.Names}} {{.Status}}'
    docker --context rootless ps --format '{{.Names}} {{.Status}}'
    ps -o user,pid,cmd -C mariadbd
    cat /proc/"$(pgrep -u "$USER" -n mariadbd)"/uid_map
    systemctl --user is-enabled docker; loginctl show-user "$USER" -p Linger
    ```

    **Valmis, kui:**

    - `docker context ls` näitab mõlemat konteksti ja mõlema variandi `SHOW TABLES` annab neli tabelit;
    - rootless `mariadbd` protsess hostis ei ole root ega UID 999;
    - pärast reboot'i enne sisselogimist vastab rootless konteineri port ja `Linger` on `yes`.

    ??? tip "Lahenduse suund"
        Rootless daemon on kasutaja teenus (`systemctl --user status docker`) oma socket'iga `/run/user/<UID>/docker.sock`, ja tal on eraldi image'id ning volume'id kaustas `~/.local/share/docker`. Seepärast tõmbab ta db-image'i uuesti, ja kursuse CA peab olema ka kasutaja kaustas `~/.config/docker/certs.d/<registry>/`. UID-de vastavuse näed `/proc/<pid>/uid_map`-ist: konteineri 0 on sinu UID, 1… on `/etc/subuid` vahemiku algus. Port 80 ebaõnnestub `net.ipv4.ip_unprivileged_port_start` tõttu, vali kõrgem port, mitte kogu hosti sysctl'i muudatus. `--memory` vajab, et systemd oleks kasutaja sessioonile `memory` kontrolleri delegeerinud (`cgroup.controllers` kasutaja `user@<UID>.service` all), muidu ignoreerib daemon piirangut hoiatusega. Et teenus pärast taaskäivitust ise käivituks, vajad kaht asja: linger ja `systemctl --user enable docker`; konteineri enda käivitab uuesti `restart: unless-stopped`. Tüüpiline lõks: `docker` ilma `--context`-ita räägib endiselt rootful daemoniga, nii et "töötav" konteiner võib olla vales daemonis. Täislahendus on õpetajal.

        **Miks nii.** Rootless Docker kasutab sama user namespace'i mudelit mis Podman: konteineri root on hostis sinu kasutaja ja konteinerist välja pääsenud ründaja saab ainult sinu õigused. Pordipiir ja kasutajaruumi võrk (`slirp4netns` või `pasta`) on samad. Vahe on elutsüklis: Dockeril on endiselt daemon, nüüd kasutaja kohta, ja selle restart peatab tema konteinerid. Compose, Dockeri socket ja kõik tööriistad töötavad muutmata, mis on rootless Dockeri peamine põhjus Podmani asemel. Serveris, kus töötab üks teenus ja standard on AlmaLinux/RHEL, on Quadlet lihtsam; arendusmasinas ja CI agendil, kus tööriistad eeldavad Dockeri API-t, on rootless Docker väiksem muudatus.

??? example "15 · vorgukogu konteineris"

    Võrguinseneri osa jätkab tööriistaga `vorgukogu` (1. kohtumise lisaülesanne 21). Seni töötas see sinu venv'is: Pythoni versioon, Netmiko ja Paramiko on just selles kaustas ja teises masinas teised. Image paneb Pythoni ja paketid ühte tervikusse, mida 6. kohtumisel Jenkins ja 7. kohtumisel Kubernetes käivitavad muutmata. Õpetaja on loonud `rtr01` ja `rtr02` (Ubuntu 24.04 + FRR 10.x, kasutaja `kasutaja` sinu võtmega), `vorgukogu/` kaustas on 1. kohtumise failid.

    **Esita:** `vorgukogu/Dockerfile`, `vorgukogu/.dockerignore`

    Öine kogumine peab töötama ühtemoodi igas masinas, kus see käivitub, ja võti ei tohi image'isse jõuda: image läheb registry'sse ja seda näevad kõik, kel on lugemisõigus. Tee `vorgukogu/Dockerfile`, mille konteiner kogub sama väljundi kui 1. kohtumise venv'is töötav skript. Docker töötab control'is nagu põhilaboris; kustutada võib ainult image'id `vorgukogu:*` (`docker image rm vorgukogu:1`).

    - baas `python:3.12-slim`, sõltuvused `requirements.txt`-ist enne koodi kopeerimist (koodi muutus ei ehita pip-kihti uuesti);
    - image'is on `vorgukogu.py`, `inventory.yaml` ja `known_hosts`, mitte `.venv/`, `out/`, `*.env` ega võti (`.dockerignore`);
    - konteiner töötab mitte-root kasutajana; `ENTRYPOINT` on skript, `CMD` vaikeargumendid (`--inventory /app/inventory.yaml --out /app/out`);
    - `VORK_USER` ja `VORK_KEY_FILE` tulevad `--env-file vorgukogu.env`-ist (`.gitignore`-is), võti ja `out/` mount'iga;
    - konteineri väljumiskood on sama mis skriptil (0 / 2 / 1).

    **Kontroll:**

    ```bash
    cd ~/labori-seis/vorgukogu && docker build -t vorgukogu:1 .
    mkdir -p out && docker run --rm --user "$(id -u):$(id -g)" --env-file vorgukogu.env \
      -v ~/.ssh/id_ed25519_labseis:/run/secrets/rtr_key:ro -v "$PWD/out:/app/out" vorgukogu:1; echo "kood $?"
    stat -c '%U %n' out/rtr01/*
    docker run --rm --entrypoint id vorgukogu:1
    docker run --rm --entrypoint sh vorgukogu:1 -c 'ls -a /app; ls /run/secrets 2>&1'
    # proov.yaml: 1. kohtumise kontrolli fail, lisatud rtr09 aadressil 192.0.2.1
    docker run --rm --user "$(id -u):$(id -g)" --env-file vorgukogu.env \
      -v ~/.ssh/id_ed25519_labseis:/run/secrets/rtr_key:ro -v "$PWD/out:/app/out" \
      -v "$PWD/proov.yaml:/app/proov.yaml:ro" vorgukogu:1 --inventory /app/proov.yaml --out /app/out; echo "kood $?"
    ```

    **Valmis, kui:**

    - esimene `docker run` annab `OK` mõlemale ruuterile ja koodi `0`, `out/` failide omanik on sinu kasutaja;
    - `id` näitab `uid=10001`;
    - `/app`-is on ainult kolm faili ja `requirements.txt`, `/run/secrets` puudub ilma mount'ita;
    - `proov.yaml`-iga on kood `2`.

    ??? success "Lahendus"
        ```dockerfile
        # syntax=docker/dockerfile:1
        # vorgukogu konteineris: sama Python ja samad paketid igal käivitajal (control, Jenkins, Kubernetes).
        FROM python:3.12-slim

        ENV PYTHONDONTWRITEBYTECODE=1 \
            PYTHONUNBUFFERED=1 \
            PIP_NO_CACHE_DIR=1 \
            PIP_DISABLE_PIP_VERSION_CHECK=1 \
            HOME=/tmp

        WORKDIR /app
        # sõltuvused enne koodi: koodi muutus ei ehita pip-kihti uuesti
        COPY requirements.txt .
        RUN pip install -r requirements.txt

        COPY vorgukogu.py inventory.yaml known_hosts ./
        RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin vorgu
        USER 10001

        ENTRYPOINT ["python", "/app/vorgukogu.py"]
        CMD ["--inventory", "/app/inventory.yaml", "--out", "/app/out"]
        ```

        ```text
        .venv/
        out/
        out-ansible/
        build/
        tests/
        ansible/
        *.env
        __pycache__/
        .git
        ```

        ```bash
        # Kopeeri: cp vorgukogu.env.example vorgukogu.env (vorgukogu.env on .gitignore's)
        VORK_USER=kasutaja
        # võti tuleb konteinerisse mount'iga, mitte image'isse
        VORK_KEY_FILE=/run/secrets/rtr_key
        ```

        Kontroll: ülesande Kontrolli käsud. Kui konteiner annab `FAIL … not found in known_hosts`, ehitati image enne `known_hosts` faili tegemist: ehita uuesti.

        **Miks nii.** `--user "$(id -u):$(id -g)"` käivitab konteineri sinu UID-iga: mount'itud võti on `0600` ja loetav ainult sinule ning `out/` failid jäävad sinu omaks. Image'i oma kasutaja 10001 on vaikimisi kasutaja juhuks, kui keegi käivitab ilma `--user`-ita: siis on protsess ikkagi mitte-root. `HOME=/tmp`, sest suvalise UID-iga protsessil pole kodukausta. Võti on mount, mitte `COPY` ega `ENV`: image'i kihid ja `docker inspect` näitavad kõike, mis ehituse ajal sisse läks. Kui annad konteinerile argumente, asendavad need kogu `CMD`-i, seepärast on proovis ka `--out /app/out`.

??? question "Arutelu"

    1. `docker exec veeb id` ütleb `uid=0`. Kas see on sama root mis hostis? Mida see tähendab, kui konteineris on turvaauk?
    2. Mälupiiri katses võttis `tail /dev/zero` 64 MB mälu ja tuum lõpetas protsessi. Mis oleks juhtunud ilma `--memory-swap`-ita ja kumb on tootmises hullem: OOM-kill või teenus, mis swap'i tõttu vaevu vastab?
    3. Saladus on failis `/run/secrets/DB_PASSWORD`. Kes control'is saab seda ikkagi lugeda ja kas see on parem kui `.env`?
    4. Trivy ütles täna "0 CRITICAL". Kas see image on kuu aja pärast ka puhas, kui sa midagi ei muuda, ja kuidas SBOM sellele küsimusele vastata aitab?
    5. Registry lehel viitasid image'ile digestiga. Mis juhtub sinu stackiga, kui keegi lükkab registry's tag'i `k03` alla teise image'i, ja kumb viis seda märkab: tag või digest?
