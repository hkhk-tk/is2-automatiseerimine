---
tags:
  - Kubernetes
  - Labori seis
  - veaotsing
---

# 5. Neli riket

Tee see osa pärast IS1 praktikumi [2. osa](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-2-labori-seis-klastris) ja enne [3. osa](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-3-argo-cd-hoiab-soovitud-olekut), sest Argo CD Application keeraks rikked kohe tagasi.

Koolitaja teeb sinu töötavas Labori seisus neli viga: Gitis on kõik õige, klastris mitte, ja nagu intsidendis ei mäleta keegi, mida käsitsi muudeti. Leia iga rikke sümptom, käsk, mis põhjuse näitas, ja põhjus ise, sest ilma selleta ei tea sa, kas sama viga tuleb homme tagasi. Alles siis paranda kõik ühe käsuga Gitist. Lõpuks on `kubectl diff` tühi ja haru `k07-k8s` PR-iga main'is.

Ütle koolitajale, kui Labori seis klastris töötab. Argo CD Application'it sul veel olla ei tohi, muidu keeraks see vead kohe tagasi.

**Kui teed seda tööl iga päev:** leiad Kubernetese intsidentide põhjuse `kubectl get events` ja `describe` järgi ilma juhendita. Kui see on sul juba korras, ära loe veaotsingu tabelit, pane endale piiriks 20 minutit kõigi nelja põhjuseni ja mine otse etappi „[Väljast sisse: Ingress → Service → pod](#valjast-sisse-ingress-service-pod)“.

Üks rike võib anda mitu sümptomit ja üks sümptom võib varjata teist, seega ära lõpeta esimese leiu juures.

| Sümptom | Vaata esimesena | Tõenäoline koht |
|---|---|---|
| `curl` hostiga annab `404 page not found` | `kubectl get ingress`: HOSTS ja CLASS | Ingress: host või klass |
| `503` või `no available server` | `kubectl get endpoints app01`, `kubectl get pods` | app01 pole Ready, põhjus tema sõltuvuses |
| pod on `Pending` | `kubectl describe pod`: Events, `FailedScheduling` | PVC nimi, node'i valik, ressursid |
| pod'i pole üldse, Deployment `0/1` | `kubectl describe rs -l app=<x>`: Events | ResourceQuota, `exceeded quota` |
| `ImagePullBackOff` / `ErrImagePull` | `kubectl describe pod`: Events | image'i nimi või tag, pull secret |
| `CrashLoopBackOff` | `kubectl logs <pod> --previous` | `args`, `env`, ConfigMap või Secret |
| rollout ei lõpe, leht töötab | `kubectl rollout status`, uue pod'i olek | uus ReplicaSet, vana teenindab edasi |

*Tabel L7.3. Veaotsingu tabel.*

> `kubectl diff -f k07-k8s/` näitaks vastuse kohe. Kasuta seda alles siis, kui kõik neli põhjust on kirjas.

## Väljast sisse: Ingress → Service → pod

Alusta sealt, kust kasutaja tuleb, ja liigu samm-sammult sissepoole. Iga viga võib varjata järgmist: 404 ei lase näha, kas taga oleks 503. Kui leiad ühe vea, ära seda veel paranda, vaid mine sellest mööda ja vaata, mis on edasi.

Iga komponent vastab oma koodiga: Traefik annab reegli puudumisel 404 ja tühja Endpoints'i korral 503, rakendus ise 500. Vastuse kood ütleb, millise komponendini päring jõudis.

1. Vaata, mida kasutaja näeb:

    ```bash
    H='Host: labori-seis-<github>.lab.hkhk.ee'
    curl -s -o /dev/null -w '%{http_code}\n' -H "$H" http://k3s.lab.hkhk.ee/health
    ```

2. Liigu veaotsingu tabeli järgi samm-sammult sissepoole: Ingress, Service'i Endpoints, pod'id.
3. Kui Ingress'i taha ei pääse, küsi rakenduselt otse: `kubectl port-forward svc/app01 8080:8080 &`, siis `curl -s localhost:8080/health`.
4. Kirjuta iga leitud rikke kohta issue'sse rida "sümptom → käsk → põhjus".

Port-forward läheb Ingress'ist mööda. Kui see annab teise vastuse kui curl hostiga, on vähemalt üks viga Ingress'is ja vähemalt üks võib olla sügavamal. Kui mõlemad annavad sama vea, on probleem Service'is või pod'is. Selline võrdlus jagab otsinguruumi pooleks ühe käsuga.

**Edasi saad minna, kui** tead, miks kasutaja ei näe lehte, ja kaks rida on kirjas.

## Pod'id, mis ei jõua Running'usse

Vaatad kogu namespace'i, mitte ainult kasutaja teed. Kõik rikked ei ole kasutajale nähtavad. Rollout, mis jäi pooleli, jätab vana pod'i teenindama ja järgmine deploy ebaõnnestub samasse auku.

`progressDeadlineSeconds` (vaikimisi 600) järel märgib Deployment'i kontroller rollout'i `ProgressDeadlineExceeded`, aga midagi tagasi ei keera: vana ReplicaSet teenindab edasi ja ükski häire ei käivitu, kui seda tingimust keegi ei jälgi.

1. Vaata kõigi Deployment'ide ja pod'ide olekut:

    ```bash
    kubectl get deploy,rs,pods
    for d in db01 mc01 rmq01 app01; do kubectl rollout status deploy/$d --timeout=5s; done
    kubectl get events --field-selector type=Warning --sort-by=.lastTimestamp | tail
    ```

2. Iga pod'i kohta, mis pole `Running 1/1`, vali veaotsingu tabelist õige käsk ja leia põhjus.
3. Kirjuta ülejäänud read issue'sse.

`get deploy,rs` näitab sageli rohkem kui `get pods`. Kaks ReplicaSet'i sama Deployment'i all, millest mõlemal on pod'e, tähendab pooleli jäänud rolloutit. Deployment, mille all pole ühtegi pod'i, tähendab, et ReplicaSet ei saanud pod'i luua. Iga põhjus peab olema nimetatud objekti ja välja täpsusega, näiteks "Deployment X, väli Y, väärtus Z", mitte "midagi oli valesti".

**Edasi saad minna, kui** issue'sse on kirjas neli rida "sümptom → käsk → põhjus" ja iga põhjus on nimetatud objekti ja välja täpsusega.

## Ajajoon ja järeldused

Enne parandamist paned kirja, millal mis juhtus. Kubernetes jätab jälgi: Events'i ajad, ReplicaSet'ide vanused, revisjonide ajalugu. Nendest paned kokku rikke ajajoone, nagu teeksid intsidendi järel.

Ilma ajajooneta jääb järeldus "koolitaja muutis midagi". Ajajoon näitab, millises järjekorras asjad katki läksid ja kumb rike oli põhjus, kumb tagajärg.

1. Vaata objektide vanust ja revisjone:

    ```bash
    kubectl get rs -l 'app in (db01,mc01,rmq01,app01)' -o custom-columns=RS:.metadata.name,AGE:.metadata.creationTimestamp,READY:.status.readyReplicas
    for d in db01 mc01 rmq01 app01; do kubectl rollout history deploy/$d | tail -2; done
    kubectl get events --sort-by=.lastTimestamp -o custom-columns=AEG:.lastTimestamp,OBJ:.involvedObject.name,PÕHJUS:.reason | tail -15
    ```

2. Kirjuta issue'sse ajajoon: 4–6 rida kujul "aeg → objekt → mis muutus → mis sellest järgnes".
3. Kirjuta iga rikke juurde üks lause: milline kontroll oleks selle kohe tabanud (probe, automaatse hindaja test, `kubectl diff`, Argo CD).

Kui kaks riket on samas ajas, aga eri objektides, on need tõenäoliselt sõltumatud. Kui üks Events'i rida tuleb kohe pärast teist ja samas ahelas, võib teine olla esimese tagajärg. Viimane küsimus "mis oleks tabanud" on see, millest tekib ennetus: Argo CD juures näed, et osa neist riketest ta lihtsalt ei lubaks.

**Edasi saad minna, kui** issue's on ajajoon vähemalt nelja reaga ja iga rikke juures üks lause kontrolli kohta, mis selle oleks tabanud.

## Parandus Gitist

Gitis on kirjas õige soovitud olek. Kõik neli parandad ühe `apply`-ga ja kontrollid, et klaster ja Git on jälle samad.

Käsitsi parandus klastris oleks kiire, aga see jätaks klastri ja Giti lahku samamoodi nagu rike. Kui parandus tuleb Gitist, on järgmine inimene kindel, et failis olev ongi see, mis töötab.

1. Võrdle nüüd oma nelja põhjust erinevusega Gitist, siis tee `kubectl apply`:

    ```bash
    kubectl diff -f k07-k8s/
    kubectl apply -f k07-k8s/
    ```

2. Oota rollout'id ära ja vaata kasutaja vaadet:

    ```bash
    for d in db01 mc01 rmq01 app01; do kubectl rollout status deploy/$d --timeout=3m; done
    curl -s -H "$H" http://k3s.lab.hkhk.ee/health; echo
    kubectl diff -f k07-k8s/ && echo "klaster = Git"
    ```

> Kui `apply` viga ei paranda, võib vigane olla ConfigMap, mida pod loeb ainult käivitusel, nagu nägid ConfigMap'i katses. Sel juhul käivita `kubectl rollout restart deploy/app01`.

Esimene `diff` oli sinu vastuste kontroll. Kui seal oli rida, mida sinu neljas põhjuses polnud, jäi midagi märkamata: lisa see issue'sse. Tühi `diff` lõpus tõestab, et klastris pole enam ühtegi käsitsi muudatust. Kui `diff` jääb mittetühjaks ka pärast `apply`-d, on mõni väli selline, mida `apply` ei muuda, ja see vajab eraldi tegevust.

**Edasi saad minna, kui** kõik neli Deployment'i on 1/1, `/health` annab `UP` ja `kubectl diff` on tühi.

## Main'i

Viid haru main'i. Helm ja Argo CD töötavad main'il, sest Argo CD loeb haru `main`.

```bash
for t in objects hygiene; do bash autograde/check.sh k07 $t; done
gh pr create --fill --base main && gh pr merge --merge
git switch main && git pull
```

`objects` ja `hygiene` kontrollivad, et parandamise käigus ei tulnud faili midagi, mida seal olla ei tohi. Merge commit main'il on punkt, kust Argo CD alustab.

**Edasi saad minna, kui** `objects` ja `hygiene` on `OK` ja haru `k07-k8s` on PR-iga main'is.

**Selle osa tõend:** issue `K7.5` kommentaaris neli rida "sümptom → käsk → põhjus → parandus", ajajoon, iga rikke juures kontroll, mis selle oleks tabanud, tühi `kubectl diff` ja merge'itud PR.

## Miks see nii töötab

**`kubectl diff`.** `kubectl diff -f k07-k8s/` näitab drift'i Gitis kirjeldatud ja klastri tegeliku oleku vahel. Argo CD teeb seda võrdlust pidevalt.

**Ajajoon.** Ajajoon on intsidendi ülevaatuse alus. Kubernetes ei pea vaikimisi eraldi muudatuste logi (auditilogi lülitab sisse API serveri `--audit-policy-file`), kuid muudatustest jääb jälg kolme kohta: objekti `creationTimestamp`, ReplicaSet'ide revisjonid ja Events. Kaks esimest säilivad, Events kustutatakse vaikeseadega tunni pärast.

**Auditilogi.** Tootmises kogutakse seetõttu Events ja API serveri auditilogi eraldi süsteemi, et ka nädal hiljem saaks öelda, kes mida muutis. Klassis täidab seda ülesannet Git, kui klastrit muudab ainult Argo CD.

**Mis oleks rikke varem avastanud.** Iga rike kuulub ühte kolmest rühmast. Esimese rühma rikked oleks peatanud kontroll enne klastrit: kubeconform, automaatse hindaja test või serveripoolne dry-run. Teise rühma rikked oleks avastanud klastri enda mehhanism: probe, mis hoiab vigase pod'i liiklusest eemal, või `maxUnavailable: 0`, mis jätab vana pod'i tööle. Kolmanda rühma rikked tekivad ainult siis, kui keegi muudab klastrit Gitist mööda, ja neid avastab ainult drift'i jälgimine.

Kui jõudsid kiiremini: [Lisaülesanded → 8. Liveness valesti: restarditsükkel meelega](lisa.md#8-liveness-valesti-restarditsukkel-meelega), vahetad liveness'i ja readiness'i rollid meelega ning vaatad restarditsüklit.
