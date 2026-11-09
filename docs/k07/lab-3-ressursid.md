---
tags:
  - Kubernetes
  - ressursid
  - veaotsing
---

# 3. Ressursid ja rikkeotsing

Tee see osa pärast IS1 praktikumi [1. osa](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-1-klaster-ja-esimene-deployment). Praktikumi sammu 1.4 lõpus kustutasid Deployment'i `web`, loo see uuesti käsuga `kubectl apply -f ~/k07-katse/web.yaml`.

Jagatud klastris on sinu namespace'il eelarve ja see tuleb vastu mitmes kohas: kvoot keeldub pod'i loomast, LimitRange täidab tühjad väljad, scheduler ei leia node'i ja kernel tapab konteineri, mis ületab mälulimiidi. Igal piiril on oma sümptom: kvoodi puhul pod'i pole üldse, scheduler'i puhul on pod `Pending`, mälulimiidi puhul ebaõnnestub konteiner koodiga 137 ja vale konfiguratsiooniga ebaõnnestub pod ja taaskäivitub. Kui oskad sümptomi järgi öelda, milline piir keeldus, ei pea sa kõike järjest läbi proovima. Lõpuks leiad kahe katkise pod'i põhjuse järjekorras `get` → `describe` → `logs` → `events` ja vaatad pod'i sisse `kubectl debug`-iga.

Töötad edasi kaustas `~/k07-katse`, kus Deployment `web` on alles.

**Kui teed seda tööl iga päev:** eristad `exceeded quota`, `FailedScheduling` ja `OOMKilled`-i ühe `kubectl describe` järgi. Kui see on sul juba korras, tee esimeste etappide tõendi käsud ära ja mine otse etappi „[Kaks katkist pod'i](#kaks-katkist-podi)“.

## Kvoot keelab pod'i loomise

Küsid meelega rohkem pod'e, kui kvoot lubab. ResourceQuota kontrollib iga pod'i juba loomisel, enne scheduler'it. Kui pod ei mahu, ei teki seda üldse: `kubectl get pods` ei näita midagi ja põhjus on ReplicaSet'i Events'is.

Jagatud klastris kaitseb kvoot teisi sinu vigade eest. Ilma selleta võtaks üks vale `replicas: 200` kogu klastri mälu ja kõigi teiste rakendused jääksid uute pod'ideta.

1. Vaata, kui palju kvoodist on kasutusel:

    ```bash
    kubectl describe resourcequota | grep -E 'pods|requests'
    ```

2. **Ennusta:** kas üleliigsed pod'id jäävad olekusse `Pending` või neid ei teki üldse? Küsi rohkem pod'e, kui kvoot lubab, ja vaata, kus viga näha on:

    ```bash
    kubectl scale deploy web --replicas=20
    kubectl get deploy web
    kubectl describe rs -l app=web | grep -m2 'exceeded quota'
    kubectl get events --field-selector reason=FailedCreate | tail -3
    ```

3. Pane tagasi kaks koopiat: `kubectl scale deploy web --replicas=2`

> Sama viga tuleb, kui üks pod küsib rohkem mälu, kui kvoodist alles on. Siis jääb rolling update pooleli ja vana pod teenindab edasi.

Deployment näitas READY näiteks `14/20`, aga ükski pod polnud `Pending`. Puuduvaid pod'e ei olnud lihtsalt olemas. Seepärast ei aita siin `describe pod`: viga on ReplicaSet'i juures, sest just tema püüdis pod'e luua ja sai API serverilt keeldumise.

**Edasi saad minna, kui** `get deploy web` näitas READY alla 20, ReplicaSet'i Events'is oli `exceeded quota: is-quota … pods` ja nüüd on jälle 2/2.

## LimitRange täidab tühjad väljad

Lood pod'i ilma `resources`-ita ja vaatad, mis tema spec'i kirjutati. Kui kvoot loeb requests'e, peab igal konteineril need olema. Konteiner, millel `resources` puudub, saab väärtused LimitRange'ist.

See on mugav, aga ohtlik. Vaikeväärtus sobib väikesele nginx'ile, aga JVM-ile jääb see väikeseks ja ta ebaõnnestub OOMKilled'iga. Kui sa ei tea, et väärtused tulid LimitRange'ist, otsid viga rakendusest.

1. Loo pod ilma `resources`-ita ja vaata, mis sinna kirjutati:

    ```bash
    kubectl run vaike --image=busybox:1.37 --restart=Never -- sleep 600
    kubectl get pod vaike -o jsonpath='{.spec.containers[0].resources}'; echo
    kubectl describe limitrange | grep -E 'Container|Default'
    kubectl delete pod vaike
    ```

> Kui LimitRange'i pole ja kvoot nõuab requests'e, saad vea `must specify requests.cpu`. Siis pead väärtused alati ise kirjutama.

Pod'i spec'is on väärtused, mida sa ei kirjutanud. Need lisas admission-kontroller enne salvestamist, nii et etcd-s on pod juba täidetud väljadega. Kui hiljem `kubectl get pod -o yaml` väljundist faili teed, lähevad need väärtused faili kaasa ja näevad välja nagu sinu omad.

**Edasi saad minna, kui** pod'i spec'is on requests ja limits, mida sina ei kirjutanud, ja need on samad mis LimitRange'i `Default` veergudes.

## Pending: pod ei leia node'i

Pod mahub kvooti, seega ta luuakse. Aga scheduler ei leia node'i, mis tema nõudele vastab, ja pod jääb `Pending`-uks. Kasutad selleks `nodeSelector`-it, mille label'it ükski node ei kanna.

Tootmisklastris jääb pod `Pending`-uks, kui ta küsib rohkem mälu, kui ühelgi node'il vaba on, kui PVC on seotud teise node'iga või kui node on hoolduseks suletud. Sümptom on alati sama, põhjuse ütleb `FailedScheduling` sõnum.

1. Loo pod, mis nõuab olematut label'it:

    ```bash
    kubectl run kuhu --image=busybox:1.37 --restart=Never \
      --overrides='{"spec":{"nodeSelector":{"disk":"olematu"}}}' -- sleep 600
    kubectl get pod kuhu -o wide
    kubectl describe pod kuhu | sed -n '/Events/,$p'
    ```

2. Vaata, millised label'id node'idel on, ja kustuta pod:

    ```bash
    kubectl get nodes --show-labels | tr ',' '\n' | grep -E '^kubernetes.io/(hostname|os)' | sort -u
    kubectl delete pod kuhu
    ```

Pod on olemas, NODE veerus on `<none>` ja Events'is on `FailedScheduling` koos lausega `0/N nodes are available: … didn't match Pod's node affinity/selector`. Võrdle eelmise etapiga: kvoodi korral polnud pod'i üldse, siin on pod olemas ja ootab.

**Edasi saad minna, kui** pod `kuhu` oli `Pending`, Events'is oli `FailedScheduling` koos põhjusega ja oskad öelda, mille poolest see erineb `exceeded quota` veast.

## OOMKilled

Lased konteineril meelega mälulimiidi ületada. `limits.memory` on cgroup'i lagi. Kui protsess ületab selle, tapab kernel ta ja kood on 137 (128 + SIGKILL 9).

OOMKilled ei jäta rakenduse logisse sageli midagi, sest protsess tapetakse ilma hoiatuseta. Kui sa otsid ainult logist, näed lihtsalt, et rakendus kadus. Põhjus on pod'i olekus ja koodis 137.

1. Kirjuta `malu.yaml` ise:
    - Pod `malu`, image `busybox:1.37`, `restartPolicy: Never`
    - `resources`: requests `memory: 16Mi`, limits `memory: 64Mi`
    - käsk `dd if=/dev/zero of=/dev/null bs=128M count=1` (dd hoiab 128 MB puhvrit mälus)
2. **Ennusta:** mis olekus ja mis koodiga konteiner lõpeb? Tee `kubectl apply` ja vaata:

    ```bash
    kubectl apply -f malu.yaml && sleep 10
    kubectl get pod malu
    kubectl get pod malu -o jsonpath='{.status.containerStatuses[0].state.terminated}'; echo
    kubectl describe pod malu | grep -A5 'State:'
    ```

3. Muuda `bs=32M`, loo pod uuesti (`kubectl delete -f malu.yaml && kubectl apply -f malu.yaml`) ja vaata olekut.
4. Vaata, kui palju mälu sinu pod'id kasutavad: `kubectl top pods`

> Kui `kubectl top` annab vea `Forbidden`, ei ole sinu rollil `metrics.k8s.io` lugemise õigust. Teata koolitajale ja jätka.

Esimene katse lõppes `reason: OOMKilled` ja `exitCode: 137`, teine `Completed` ja koodiga 0. Ainus vahe oli puhvri suurus limiidi suhtes. `kubectl top` näitab tegelikku kasutust ja seda saad võrrelda requests'iga: kui kasutus on kogu aeg palju väiksem, küsib pod liiga palju ja raiskab node'i mahtu.

**Edasi saad minna, kui** esimesel korral on `reason` `OOMKilled` ja `exitCode` 137, teisel korral on pod `Completed`.

## Events ja describe

Loed sama riket kolmest kohast. Events näitab, mida Kubernetes tegi: planeeris, tõmbas, käivitas, tappis. Mida protsess ise tegi, on logides. `describe` paneb pod'i oleku ja tema Events'i ühele lehele.

Events kaovad umbes tunniga. Kui rike oli öösel ja vaatad hommikul, on Events'i juba tühi ja jääb ainult `Last State`. Seepärast salvestab intsidendi ajal esimene inimene Events'i kohe faili.

1. Vaata namespace'i sündmusi aja järgi ja ainult hoiatusi:

    ```bash
    kubectl get events --sort-by=.lastTimestamp | tail -8
    kubectl get events --field-selector type=Warning
    kubectl events --for pod/malu
    ```

2. Leia `describe pod malu` väljundist kolm kohta: `Last State` / `State`, `Limits` ja `Events`. Kirjuta issue'sse, mida igaüks näitab.
3. Salvesta intsidendi hetkeseis faili, nagu teeksid tootmises:

    ```bash
    kubectl get events --sort-by=.lastTimestamp -o wide > events-$(date +%H%M).txt
    wc -l events-*.txt
    ```

Hoiatuste filter peitis tavalised sündmused (`Scheduled`, `Pulled`, `Started`) ja jättis alles need, mis vajavad tähelepanu. `kubectl events --for` näitab ühe objekti ajalugu õiges järjekorras. Salvestatud fail jääb alles ka siis, kui klaster sündmused kustutab.

**Edasi saad minna, kui** oskad öelda, milline kolmest käsust näitas OOMKilled'i põhjust kõige lühemalt, ja Events'i fail on salvestatud.

## Pod'i sisse kubectl debug'iga

Vaatad töötava pod'i sisse ilma image'it muutmata. [`kubectl debug`](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/) toob tööriistad eraldi konteineris.

Distroless-image'is pole shelli ja `kubectl exec` ei aita. `kubectl debug` lisab tööriistad ainult sellesse pod'i ja ainult vajaduse korral, aga ajutist konteinerit ei saa eemaldada: see jääb pod'i spec'i, kuni pod kustub.

1. Vaata, kas ajutine konteiner on sulle lubatud: `kubectl auth can-i patch pods --subresource=ephemeralcontainers`
2. Kui vastus on `yes`, lisa töötavale pod'ile ajutine konteiner, mis näeb nginx'i protsesse:

    ```bash
    P=$(kubectl get pod -l app=web -o jsonpath='{.items[0].metadata.name}')
    kubectl debug -it "$P" --image=busybox:1.37 --target=nginx -- sh
    ps; wget -qO- localhost | head -3; exit
    kubectl get pod "$P" -o jsonpath='{.spec.ephemeralContainers[*].name}'; echo
    ```

3. Kui vastus on `no`, tee pod'ist koopia, millel on lisakonteiner ja ühine PID namespace:

    ```bash
    kubectl debug "$P" -it --copy-to=web-dbg --image=busybox:1.37 --share-processes -- sh
    ps; wget -qO- localhost | head -3; exit
    kubectl get pod web-dbg --show-labels
    kubectl delete pod web-dbg
    ```

> Koopial pole `app=web` label'it, seega Service sinna liiklust ei saada.

Debug-konteineri `ps` näitas nginx'i master- ja worker-protsesse, kuigi need töötavad teises konteineris. Põhjus on ühine PID namespace. `wget localhost` jõudis nginx'ini, sest pod'i konteinerid jagavad ka network namespace'i: sama `pause`, mida nägid oma klastri node'il `crictl`-iga.

**Edasi saad minna, kui** debug-konteineris näitas `ps` nginx'i protsesse ja `wget localhost` nginx'i lehte.

## Kaks katkist pod'i

Koolitaja on loonud sinu namespace'i kaks pod'i, `katki-1` ja `katki-2`. Ära kustuta neid kohe, leia kõigepealt põhjus ([Debug Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/)). Kasutad sama järjekorda nagu eelmistes etappides ja parandad vea failis, mitte klastris käsitsi.

Siin loeb järjekord. Üks rike paistab Events'is ja logi on tühi. Teine paistab ainult logis ja Events ütleb vaid, et konteiner ebaõnnestus. Kes vaatab alati ainult üht kohta, jääb pooltel juhtudel hätta.

1. Vaata olekut, Events'it ja logisid:

    ```bash
    kubectl get pods katki-1 katki-2
    kubectl describe pod katki-1 | sed -n '/Events/,$p'
    kubectl logs katki-2
    kubectl logs katki-2 --previous
    ```

2. Salvesta pod failiks: `kubectl get pod katki-1 -o yaml > katki-1.yaml`
3. Eemalda failist `status` ja serveri lisatud väljad (`uid`, `resourceVersion`, `creationTimestamp`, `managedFields`).
4. Paranda viga ja loo pod uuesti: `kubectl delete pod katki-1 && kubectl apply -f katki-1.yaml`
5. Tee `katki-2`-ga sama.

> `kubectl edit pod` ei lase salvestada? Pod'il on `image` muudetav, käsk ja argumendid mitte. Tootmises parandad Deployment'i ja see loob uue pod'i.

Kirjuta iga pod'i kohta, mis käsk põhjuse näitas. Kui `--previous` andis rohkem kui tavaline `logs`, tähendab see, et konteiner oli juba uuesti käivitatud ja vana logi oli ainult eelmise käivituse oma. Parandatud pod, mis jõuab `Running`-usse ja jääb sinna, tõestab, et leidsid põhjuse, mitte ainult sümptomi.

**Edasi saad minna, kui** üks pod oli `ImagePullBackOff`, teine `CrashLoopBackOff`, ühe põhjus leidus Events'is ja teise oma ainult logides, ja mõlemad parandatud pod'id töötavad.

## Koristus

Kustutad kõik katsed. Labori seis vajab kvoodist peaaegu kõike: neli teenust, millest app01 küsib üksi 256 Mi mälu.

Unustatud katsepod ei tee midagi, aga hoiab kvooti kinni. Labori seisu ehitades näed siis `exceeded quota`-t ja otsid viga oma manifestidest, kuigi põhjus on eilne `test`-pod.

1. Kustuta katsed ja vaata, et namespace on tühi:

    ```bash
    kubectl delete -f ~/k07-katse/ --ignore-not-found
    kubectl delete configmap katse katse-fail; kubectl delete secret katse
    kubectl delete pod katki-1 katki-2 --ignore-not-found
    kubectl get all
    ```

`get all` ei näita ConfigMap'e ega Secret'eid, ainult workload'e ja Service'eid. `describe resourcequota` on parem mõõdik: kui requests on nulli lähedal, on ruum vaba.

**Edasi saad minna, kui** `kubectl get all` näitab ainult koolitaja objekte ja `describe resourcequota` näitab kasutust nulli lähedal.

**Selle osa tõend:** issue `K7.3` kommentaaris `exceeded quota` rida, LimitRange'i lisatud `resources`, `FailedScheduling` rida, `OOMKilled` / 137, debug-konteineri `ps` väljund ja kummagi katkise pod'i kohta "olek → käsk → põhjus → parandus".

## Miks see nii töötab

**LimitRange ja admission'i järjekord.** LimitRange täidab puuduvad `resources`-väljad ja võib keelata liiga suured väärtused. Kõigepealt töötavad mutating admission-kontrollerid (LimitRange lisab väärtused), seejärel validating (kvoot liidab väärtused kokku). Pärast seda salvestatakse objekt ja alles siis otsib scheduler pod'ile node'i.

**Mälulimiit.** cgroup v2 hostil (Ubuntu 24.04 vaikimisi) on mälulimiit failis `memory.max`, cgroup v1 hostil failis `memory.limit_in_bytes`.

**CPU limiit.** CPU limiit ei lõpeta protsessi, vaid CFS-i kvoot piirab selle protsessoriaega 100 ms perioodide kaupa (throttling): `cpu: 500m` tähendab 50 ms iga 100 ms kohta. Seetõttu on meie manifestides CPU jaoks määratud ainult requests.

**JVM ja cgroup.** JVM loeb sama cgroup'i faili, seetõttu kasutab app01 võtit `-XX:MaxRAMPercentage=60`, mitte fikseeritud `-Xmx`-väärtust. Ülejäänud 40% on vaja lõimede stack'idele, Metaspace'ile ja natiivsele mälule. Kui heap kasutaks kogu limiidi, võib kernel JVM-i lõpetada enne, kui JVM jõuab anda vea `OutOfMemoryError`.

**Events ja `kubectl debug`.** Events'e hoiab API server `--event-ttl` järgi. `kubectl debug --copy-to` loob uue pod'i, mitte ei muuda olemasolevat. Rike, mis sõltub just konkreetsest protsessist (lekkiv mälu, kinni jäänud lõim), koopias ei kordu.

**`nodeSelector` ja `affinity`.** `nodeSelector` on lihtsaim viis siduda pod kindlate node'idega. Keerulisemad reeglid (eelistus, mitte nõue) kirjutatakse `affinity`-ploki alla.

**`FailedScheduling`.** `FailedScheduling`-sõnum loetleb kõik tagasilükkamise põhjused korraga. Ühest lausest on näha, mitu node'i oli täis, mitu oli taint'iga ja mitu ei vastanud label'i tingimusele.

Kui jõudsid kiiremini: [Lisaülesanded → 7. HPA](lisa.md#7-hpa), paned Deploymenti koopiate arvu koormuse järgi kasvama ja näed, miks HPA vajab `requests`-e.
