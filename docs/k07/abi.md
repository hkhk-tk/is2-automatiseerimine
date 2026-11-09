---
tags:
  - veaotsing
---

# Abi: veaotsing

Tabel on IS1 praktikumi [Labori seis Kubernetese klastris](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/), selle kursuse [süvenemise](syvenemine.md) ja lisapraktikumide kohta.

Otsi sümptomi järgi. Viimane veerg ütleb mehhanismi, selle järgi leiad ka vea, mida tabelis pole. Kinnita põhjus kontrollkäsuga enne parandust: sama sümptom võib tulla mitmest kohast.

| Sümptom | Kontrolli | Tõenäoline põhjus | Miks see juhtub |
|---|---|---|---|
| **Kubeconfig ja oma klaster (IS1 osa 1, süvenemise osa 1)** | | | |
| `kubectl get pods`: `connection refused` või `x509` | VPN, `kubectl config view --minify \| grep server` | VPN pole üleval või server pole `https://k3s.lab.hkhk.ee:6443` | kubectl ühendub failis kirjas olevale aadressile; ilma VPN-ita pole marsruuti, vale fail annab vale CA |
| server on `127.0.0.1` | `grep server ~/.kube/config` | said vale faili (k3s admin-fail, mitte koolitaja oma) | k3s kirjutab admin-faili node'i enda jaoks, mitte kaugkasutajale |
| `tofu apply` ebaõnnestub mälu või pool'i limiidi tõttu | Proxmoxi pool'i kasutus | web01 ja mc01 võtavad mälu: Shutdown, mooduli lõpus Start | Proxmoxi pool'il on mälulimiit ja 2 GB VM ei mahu kõrvuti töötavate VM-idega |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | `ssh-keygen -F <IS1_NET>.23` | IP on sama, VM uus: `ssh-keygen -R <IS1_NET>.23` | IP on sama, aga uue VM-i cloud-init genereeris uued host-võtmed |
| `connection refused 127.0.0.1:6443` | `grep server ~/.kube/k3s01.yaml` | k3s admin-fail osutab iseendale: asenda `127.0.0.1` node'i IP-ga | kubectl proovib ühenduda control node'i enda pordiga, kus API serverit pole |
| `x509: certificate is valid for … not …` | `openssl s_client -connect <IS1_NET>.23:6443 </dev/null 2>/dev/null \| openssl x509 -noout -ext subjectAltName` | failis on nimi, mida sertifikaadis pole: kasuta IP-d | sertifikaadi SAN-is on ainult nimed ja IP-d, mis k3s paigaldusel teadis |
| `i/o timeout` k3s01 poole | `ssh kasutaja@<IS1_NET>.23 sudo ufw status` | VM-i tulemüür: `sudo ufw allow 6443/tcp` | pakett jõuab VM-ini, aga tulemüür hülgab selle vaikselt |
| `get-contexts` näitab ühte `default`-i | `grep -c default ~/.kube/k3s01.yaml` | nimed jäid ümber nimetamata, failid põrkuvad: korda `sed`-i | `KUBECONFIG` liitmisel võidab sama nimega kirje esimesest failist |
| `can-i '*' '*'` klassis `yes` | `kubectl config current-context` | käsk läks oma klastrisse, mitte klassi omasse | `--context`-ita kasutab kubectl `current-context`-i |
| `iptables … KUBE-SERVICES` on tühi | `sudo nft list ruleset \| grep -c KUBE` | kube-proxy kasutab nftables'it | kube-proxy kirjutab reeglid sellesse tabelisse, mida tema režiim kasutab |
| `tere.txt` puudub | `kubectl --context k3s01 get pod kirjutaja` | pod pole veel `Running` või PVC on `Pending` | PVC seotakse alles siis, kui pod on planeeritud (WaitForFirstConsumer) |
| `systemctl stop k3s` järel kadusid ka pod'id | `ssh … ps -eo cmd \| grep -c '[n]ginx: master'` | kasutasid `k3s-killall.sh`-i või VM taaskäivitus | systemd `stop` tapab ainult k3s-i põhiprotsessi, `killall` kõik konteinerid |
| pärast k3s-i käivitust on RESTARTS > 0 | `kubectl --context k3s01 describe pod` → `Last State` | konteinerid peatati koos k3s-iga | containerd taaskäivitas konteinerid, mitte ei jätkanud vanu |
| **Namespace ja põhiobjektid (IS1 osa 1, süvenemise osa 2)** | | | |
| objekt läks valesse kohta või `Forbidden` | `kubectl config get-contexts` NAMESPACE veerg | context'i namespace on vale või manifestis on `namespace:` | manifestis pole namespace'i, seega otsustab context'i namespace, ja õigus kehtib ainult sinu omas |
| `auth can-i … ephemeralcontainers` → `no` | koolitajalt | vaikimisi `edit`-rollis seda pole; kasuta `kubectl debug --copy-to` | debug-konteiner lisatakse töötavale pod'ile ja läheb mööda loomise kontrollidest, seepärast on see eraldi õigus |
| pod jääb `Pending` | `kubectl describe pod` Events | sageli sinu kvoot, mitte klaster | pod on loodud, aga scheduler ei leia node'i, mis nõudele vastab |
| Endpoints on `<none>` | `kubectl get svc web -o yaml \| grep -A2 selector`, `kubectl get pods --show-labels` | Service'i `selector` ei vasta pod'i label'ile | Service leiab pod'id ainult label'i järgi, nime ega IP-d ta ei tea |
| `port-forward`: `address already in use` | `ss -tlnp \| grep 8080` | eelmine tunnel töötab: `kill %1` või teine port | eelmine `port-forward` taustal hoiab porti kinni |
| karantiinis pod on ikka Endpoints'is | `kubectl get pods -L app` | label jäi muutmata (`--overwrite` puudu) | olemasolevat label'it ei kirjutata üle ilma `--overwrite`-ita |
| `--dry-run=server`: `Forbidden` | `kubectl auth can-i create deployments` | sul pole õigust seda objekti luua | serveri dry-run teeb kõik admission-kontrollid, ka õiguste kontrolli |
| LoadBalancer: `exceeded quota … services.loadbalancers=0` | `kubectl describe resourcequota` | ootuspärane: klassis on kvoot 0 | kvoot keelab objekti enne, kui ükski kontroller seda näeb |
| `printenv LAB` näitab pärast `patch`-i vana väärtust | `kubectl exec test -- cat /etc/katse/app.conf` | ootuspärane: env loetakse käivitusel, volume uueneb | keskkonnamuutujad kirjutatakse protsessi keskkonda ainult käivitusel |
| `test` pod: `CreateContainerConfigError` | `kubectl describe pod test` | ConfigMap või Secret, millele `envFrom` viitab, puudub | kubelet ei saa konteinerit käivitada, kui viidatud objekti pole, ja ootab |
| **Ressursid ja rikkeotsing** | | | |
| Deployment `0/N`, pod'i pole üldse | `kubectl describe rs -l app=<nimi>` Events | ResourceQuota: `exceeded quota` (pods, requests.cpu, requests.memory) | kvoodi kontroll on admission'is: üle piiri minev pod jääb salvestamata |
| `exceeded quota` | `kubectl describe resourcequota` | namespace'i kvoot täis: vähenda `replicas` või requests, kustuta katsepodid | kvoot loeb kokku kõigi pod'ide requests'id, ka unustatud katsepodide omad |
| `must specify requests.cpu` / `limits.memory` | `kubectl describe limitrange` | LimitRange'i pole, kvoot nõuab väärtusi: kirjuta `resources` ise | kvoot vajab arvu, mida kokku lugeda; ilma LimitRange'ita pole kust vaikeväärtust võtta |
| `OOMKilled`, `Exit Code: 137` | `kubectl describe pod` → `Last State`, `Limits` | protsess ületas `limits.memory`; JVM-il vaata `MaxRAMPercentage` | kernel tapab cgroup'i `memory.max` ületava protsessi SIGKILL-iga (128 + 9) |
| `malu` jääb `Completed`, mitte OOMKilled | `kubectl get pod malu -o jsonpath='{.spec.containers[0].resources}'` | limiit puudub või on suurem kui `bs` | kernel tapab protsessi ainult siis, kui puhver ületab cgroup'i limiidi |
| pod `kuhu` läks `Running`-usse | `kubectl get pod kuhu -o yaml \| grep -A1 nodeSelector` | `--overrides` ei mõjunud (JSON-i jutumärgid) | ilma `nodeSelector`-ita sobib pod igale node'ile |
| `kubectl top`: `Forbidden` või `Metrics API not available` | `kubectl auth can-i list pods.metrics.k8s.io` | rollil pole metrics'i õigust: ütle koolitajale | metrics API on eraldi ressurss, mida `edit`-roll vaikimisi ei sisalda |
| `kubectl debug`: `pods "…" is forbidden … ephemeralcontainers` | `kubectl auth can-i patch pods --subresource=ephemeralcontainers` | ajutine konteiner pole lubatud: `kubectl debug <pod> --copy-to=… --share-processes` | sinu rollil pole `pods/ephemeralcontainers` alamressursi `patch`-õigust |
| `kubectl debug --target=nginx`: `container nginx not found` | `kubectl get pod <pod> -o jsonpath='{.spec.containers[*].name}'` | `--target` peab olema pod'i konteineri nimi | `--target` otsib konteinerit nime järgi, mitte image'i järgi |
| `ImagePullBackOff` | `kubectl describe pod` Events | tag'is kirjaviga (`not found`) või privaatne pakett (`unauthorized`) | kubelet ei saa image'it registry'st: nimi on vale või registry nõuab tunnust |
| `CrashLoopBackOff` | `kubectl logs <pod> --previous`, viimased read | rakenduse viga, vale `command`/`args` või puuduv muutuja | protsess lõpeb kohe pärast käivitust ja kubelet taaskäivitab teda üha pikema vahega |
| `kubectl edit pod` ei lase salvestada | veateade `spec: Forbidden` | pod'il on muudetav ainult `image`; käsk ja argumendid mitte: kustuta ja loo uuesti | pod'i spec on pärast loomist peaaegu muutumatu; muuta saab ainult üksikuid välju |
| `apply -f katki-1.yaml`: `resourceVersion` / `uid` viga | `grep -nE 'uid\|resourceVersion\|managedFields' katki-1.yaml` | serveri lisatud väljad on failis alles | API server võrdleb `resourceVersion`-it ja keeldub vananenud versiooni salvestamast |
| **Labori seis klastris (IS1 osa 2, süvenemise osa 3)** | | | |
| `.env`-i pole control node'is | `ls k03-docker/` | 3. kohtumisel tehti see `.env.example` põhjal: tee uued paroolid, peaasi et MariaDB ja app01 saavad sama | `.env` on `.gitignore`-is ja jäi teise masinasse või kustutati |
| hoiatus `would violate PodSecurity "restricted:latest"` | `kubectl get ns is-<github> --show-labels` | teadlik: namespace jõustab `baseline`-i, pod käivitub | Pod Security Admission jõustab ühte taset ja hoiatab karmima eest |
| db01 jääb `ContainerCreating`, `configmap "labori-seis-db" not found` | `kubectl get configmap` | `05-db-init.yaml`-ile jäi `kubectl apply` tegemata | pod viitab volume'iga ConfigMap'ile, mida pole, ja kubelet ootab selle tekkimist |
| `CreateContainerConfigError` | `secretKeyRef` nimi ja võti, `kubectl get secret` | Secret'i nimi või võti on vale või Secret loomata | `secretKeyRef` peab leidma täpse nime ja võtme, muidu konteinerit ei käivitata |
| tabelid puuduvad | `kubectl exec deploy/db01 -- ls /var/lib/mysql` | init käivitub ainult tühjal kettal: `kubectl delete -f k07-k8s/10-db.yaml` kustutab ka PVC ja kõik andmed, tee uuesti `kubectl apply` (laboris ohutu, sest init loob algandmed uuesti) | MariaDB käivitab init-skripte ainult tühjas andmekaustas |
| PVC jääb `Pending` | `kubectl describe pvc db01-data` | ootuspärane enne pod'i tekkimist (WaitForFirstConsumer) | local-path otsustab kausta asukoha alles siis, kui teab pod'i node'i |
| `lab-99` puudub pärast pod'i vahetust | `kubectl get deploy db01 -o yaml \| grep -A3 volumeMounts` | andmekaust pole PVC-l | MariaDB kirjutas konteineri kirjutatavasse kihti, mis kaob koos pod'iga |
| `INSERT`: `Cannot add or update a child row` | `$SQL 'SELECT id FROM course'` | `course_id` ei vasta olemasolevale kursusele | välisvõti nõuab, et viidatud rida oleks olemas |
| rmq01 ei saa kunagi Ready'ks | `kubectl describe pod -l app=rmq01` Events | probe `rabbitmq-diagnostics ping` ei mahu 1 s timeout'i: kasuta `tcpSocket` | `rabbitmq-diagnostics` käivitab Erlangi VM-i ja ületab probe'i 1 s ajapiiri |
| `ErrImagePull`, Events: `unauthorized` | `kubectl get sa default -o yaml` | pakett on privaatne ja `ghcr-pull` puudub: vt `k07-k8s/examples/secret.example.yaml` | privaatne GHCR pakett nõuab tõmbamiseks tunnust ServiceAccount'il |
| app01 kaua `0/1 Running`, `Startup probe failed` | `kubectl logs deploy/app01` | logis `Access denied for user 'labseis'`: Secret'is on teine parool kui see, millega db01 esimesel käivitusel loodi | andmebaasi kasutaja loodi esimesel käivitusel teise parooliga ja hiljem Secret'i muutmine seda ei muuda |
| app01 kaua `Init:0/1` | `kubectl logs <pod> -c wait-deps` | sõltuvus pole üleval või ConfigMap'is vale host | init-konteiner ootab TCP-porti ja ei lõpe enne, kui sõltuvus vastab |
| Ingress `404 page not found` | `kubectl get ingress` HOSTS, curl `-H 'Host: …'` | hostis kirjaviga, `ingressClassName` puudub või Host-päis jäi ära | Traefik valib reegli Host-päise ja klassi järgi; sobivat reeglit ei leitud |
| Ingress `503` / `no available server` | `kubectl get endpoints app01` | reegel on olemas, aga Service'il pole Ready pod'e | Traefik leiab reegli, aga Endpoints on tühi, sest ükski pod pole Ready |
| leht avaneb ilma stiilita | `kubectl get ingress -o yaml \| grep -A3 path` | reegel hõlmab ainult lehe teed, `/style.css` jääb välja | Ingress suunab ainult reeglis kirjeldatud teed, ülejäänud päringud saavad 404 |
| ajutine pod saab pärast NetworkPolicy't ikka `open` | `kubectl get networkpolicy db01 -o yaml` | klaster ei jõusta NetworkPolicy'd või `podSelector` ei vali db01 pod'i | NetworkPolicy on ainult objekt; jõustab seda CNI, ja selector peab pod'i valima |
| pärast NetworkPolicy't app01 `Init:0/1`, `ootan db01:3306` | `kubectl get pods -l app=app01 --show-labels`, policy `from` | `from.podSelector` ei vasta app01 label'ile | poliitika lubab ainult nimetatud label'eid, init-konteiner kasutab app01 pod'i label'it |
| `nc2` label'iga `app=app01` saab `open` | ootuspärane | poliitika valib pod'id label'i järgi | NetworkPolicy ei tea, kes pod'i lõi, ainult mis label tal on |
| `rollout history` CHANGE-CAUSE `<none>` | `kubectl get deploy app01 -o yaml \| grep -B2 change-cause` | annotatsioon on pod'i template'is, mitte Deployment'i `metadata.annotations`-is | `rollout history` loeb annotatsiooni ReplicaSet'ilt, mis kopeerib selle Deployment'i metadata'st |
| `kubectl diff` näitab pärast `undo`-d image'i rida | ootuspärane | `undo` muutis klastrit, faili mitte | `undo` kirjutab klastrisse vana template'i, fail jääb samaks |
| `check.sh k07 objects`: `resources puudub` või `readinessProbe puudub` | vastav Deployment | iga Deployment vajab mõlemat (kvoot ja automaatne hindaja) | kvoot nõuab requests'e ja automaatne hindaja kontrollib probe'e iga Deployment'i kohta |
| **Neli riket** | | | |
| rollout on pooleli, aga leht töötab | `kubectl get pods`, uus pod | vana pod teenindab edasi (`maxUnavailable: 0`): vaata uut pod'i, mitte vana | `maxUnavailable: 0` hoiab vana pod'i, kuni uus on Ready, ja uus ei saa kunagi Ready'ks |
| `apply` ei paranda | `kubectl get configmap labori-seis -o yaml` | vigane on ConfigMap, mida pod loeb käivitusel: `kubectl rollout restart deploy/app01` | `apply` uuendas ConfigMap'i, aga pod luges väärtused env-ina ainult käivitusel |
| vead kadusid ise mõne sekundiga | `kubectl get application` | Argo CD Application on juba olemas ja selfHeal parandas: ütle koolitajale | selfHeal võrdleb klastrit Gitiga ja keerab iga erinevuse tagasi |
| `kubectl diff` pole pärast `apply`-d tühi | diff'i read | mõni muudatus on ainult klastris (käsitsi `scale`, `set image`): kas see peab Giti minema? | `apply` muudab ainult välju, mis failis on; käsitsi lisatud väljad jäävad |
| `gh pr merge`: `not mergeable` | `gh pr view --json mergeStateStatus` | main'is on uuemad commit'id: `git pull origin main`, push, merge | GitHub ei merge'i, kui baasharu on liikunud ja konflikt on võimalik |
| ajajoonel on kõik ajad samad | `kubectl get events -o wide` | Events koondati (`count` > 1), aeg on viimase korduse oma | korduv sündmus uuendab sama kirjet, mitte ei loo uut |
| **Helm alused** | | | |
| `helm: command not found` | `ls /usr/local/bin/helm` | paigaldus jäi pooleli: korda `curl … \| tar xz` ja `install` | paigaldus katkes enne binaari kopeerimist `/usr/local/bin`-i |
| `helm show`: `401` / `denied` / `failed to do request` | `curl -sI https://ghcr.io/v2/` | võrk või proxy; avalik chart ei vaja `helm registry login`-i | OCI registry on HTTPS, mis peab läbima proxy |
| `INSTALLATION FAILED: cannot re-use a name that is still in use` | `helm list -a` | release on juba olemas: `helm upgrade` või `helm uninstall podinfo` | release'i nimi on namespace'is unikaalne ja Helm mäletab seda Secret'ist |
| `helm list` on tühi, aga pod'id on olemas | `kubectl config get-contexts` | Helm vaatab teist namespace'i või context'i | Helm loeb release'i Secret'e context'i namespace'ist |
| install: `exceeded quota` | `kubectl describe resourcequota` | `~/k07-katse` katsepod'id on alles | chart'i pod'id lähevad samasse kvooti kui kõik muu |
| `PODINFO_UI_MESSAGE` puudub renderdatud failis | `helm template … -f $V \| grep -i ui_` | values-failis on võti vales kohas (`ui.message`, mitte `message`) | Helm jätab tundmatu või vales kohas võtme vaikselt kasutamata |
| `rollback`: `release has no 1 version` | `helm history podinfo` | revisjoni number on vale või release paigaldati uuesti | `helm rollback` viitab revisjoni numbrile release'i ajaloos, mitte chart'i versioonile |
| `helm status` näitab `deployed`, kuigi klastri olek on teine | `helm get manifest podinfo \| kubectl diff -f -` | ootuspärane | Helm loeb release'i Secret'it ega jälgi klastrit |
| **GitOps Argo CD-ga (IS1 osa 3, süvenemise osa 4)** | | | |
| olek `Unknown`, `repository not accessible` | `grep repoURL k07-k8s/argocd/application.yaml` | repoURL-is kirjaviga või repo pole org'is `hkhk-tk` | repo-server ei saa repot kloonida, seega pole midagi võrrelda |
| `application destination … is not permitted in project` | `destination.namespace` | destination namespace ei ole sinu namespace | AppProject lubab ainult kindlaid destination'eid |
| OutOfSync, `resource :Secret is not permitted` | `grep -l 'kind: Secret' k07-k8s/*.yaml` | `k07-k8s/` ülemisel tasemel on Secret: tõsta see `examples/`-sse | AppProject lubab ainult teatud objektitüüpe ja Secret ei ole Gitis lubatud |
| OutOfSync, `NetworkPolicy is not permitted in project` | `argocd proj get is-<github>` | AppProject ei luba seda tüüpi: ütle koolitajale, kuni seda pole, tõsta fail `examples/`-sse | AppProject'i ressursside nimekiri on koolitaja otsus, mitte Argo vaikimisi piirang |
| `ComparisonError`, `app path does not exist` | `git ls-tree main k07-k8s/` | `path` ei vasta repo kaustale või fail jäi push'imata | repo-server otsib kausta just sellest commit'ist, mida `targetRevision` näitab |
| Argo kogu aeg `OutOfSync` | `kubectl get application labori-seis -o yaml` → `status.conditions` | Secret Gitis, vale path või push puudu | Argo võrdleb pidevalt ja iga erinevus Giti ja klastri vahel hoiab olekut OutOfSync |
| `argocd`: `permission denied` | rakenduse nimi | õigus on ainult oma projektile: `is-<github>/labori-seis`, mitte `labori-seis` | Argo RBAC on eraldi Kubernetese RBAC-ist ja kontrollib rakenduse täisnime |
| Argo konto puudub | `kubectl get application labori-seis -o yaml` | sama info on `status` all | Argo konto on eraldi kasutaja, Kubernetese õigused annavad ikka lugemise |
| uus commit jõuab klastrisse alles minuti pärast | `kubectl get application -o jsonpath='{.status.reconciledAt}'` | Argo küsib Giti iga 60 s: UI-s Refresh või `kubectl annotate application labori-seis argocd.argoproj.io/refresh=normal --overwrite` | Argo loeb Giti perioodiliselt, mitte iga push'i peale |
| `gitops` ei käivitu | `grep -A3 workflow_run .github/workflows/gitops.yml` | fail pole main'il või `workflows: [ci]` ei vasta `ci.yml` workflow'i `name:` reale | GitHub loeb `workflow_run` trigger'it ainult vaikeharu failist |
| `gitops` on `skipped` | `ci` jooks | `ci` ei olnud roheline või polnud push (PR, ajakava) | `if:` tingimus jättis job'i vahele, sest `ci` tulemus või sündmus ei sobinud |
| `gitops` push: `protected branch` / `GH013` | repo Settings → Rules | main nõuab PR-i ka botilt: ütle koolitajale | branch protection kehtib ka `GITHUB_TOKEN`-ile |
| pärast sync'i `ImagePullBackOff`, image'i nimes suurtähed | `kubectl get deploy app01 -o jsonpath='{..image}'` | image'i nimi peab olema väiketähtedega (`${GITHUB_REPOSITORY,,}`) | OCI image'i nimi peab olema väiketähtedega, GitHubi repo nimes võib olla suurtähti |
| `gitops` logis `image'i rida ei muutunud` | `grep image: k07-k8s/40-app.yaml` | `sed` muster ei leia rida (tühikud, jutumärgid, teine registry) | `sed` asendab ainult rida, mis mustrile täpselt vastab |
| `cibump`: `TODO-d täitmata` | `grep -n 'TODO\|if: false' .github/workflows/gitops.yml` | TODO kommentaarid või `if: false` on alles | automaatne hindaja kontrollib, et starteri kohatäited on asendatud |
| `kubectl scale` jääb alles | `kubectl get application -o jsonpath='{.spec.syncPolicy}'` | selfHeal on väljas: tee `k07-k8s/argocd/application.yaml`-ile uuesti `kubectl apply` | ilma selfHeal'ita märgib Argo drift'i, aga ei paranda |
| `rollout undo` keeratakse kohe tagasi | ootuspärane | selfHeal taastab Gitis kirjeldatud oleku: tagasi pöördumiseks kasuta `git revert`-i | Gitis on endiselt sama image ja selfHeal taastab selle |
| `proov` ConfigMap ei kao pärast `git rm`-i | `grep prune k07-k8s/argocd/application.yaml`, Refresh | `prune: true` puudub või Argo pole Giti veel uuesti lugenud | prune kustutab ainult siis, kui see on lubatud ja Argo on uut commit'i näinud |
| katkise YAML-iga olek `Unknown`, `ComparisonError` | `kubectl get application labori-seis -o jsonpath='{.status.conditions}'` | ootuspärane: repo-server ei suuda faili lugeda | Argo ei muuda klastrit, kui mõnda faili ei saa renderdada |
| pärast katkise faili eemaldamist ikka `Unknown` | Refresh-annotatsioon | Argo pole uut commit'i veel lugenud | Giti loetakse perioodiliselt või refresh-signaali peale |
| halva tag'iga on olek Synced, aga Degraded | ootuspärane | sync status = klaster vastab Gitile, health = rakendus töötab | sync status võrdleb Giti ja klastrit, health objektide tegelikku olekut |
| **Esitamine (IS1, süvenemise osa 5)** | | | |
| tag pole GitHubis | `git ls-remote --tags origin` | tavaline `git push` tag'e ei lükka: `git push origin k07` | tag läheb üles ainult nimega või `--tags`/`--follow-tags`-iga |
| `kubeconform`: `additional properties … not allowed` | veateate fail ja rida | taandeviga: väli on vales tasemel | `-strict` keelab välja, mida skeemis sellel tasemel pole |
| `hygiene`: `namespace: rida manifestis` | `grep -n 'namespace:' k07-k8s/*.yaml` | eemalda: namespace tuleb context'ist | namespace peab tulema context'ist või Argo destination'ist, mitte failist |
| `hygiene`: `replicas: 3`: jagatud klastris kuni 2 | `grep -n replicas k07-k8s/*.yaml` | rolling update'i katse jäi failis 2-st suuremaks | jagatud klastri kvoot ei kannata suuri koopiate arve |
| värskes kloonis ebaõnnestub test, kohapeal mitte | `git status --ignored` | fail on kohapeal, aga mitte Gitis | automaatne hindaja näeb ainult commit'itud faile |
| `cloud secrets`: kubeconfig Gitis | `git ls-files \| grep -i kube` | `git rm --cached <fail>` ja `.gitignore`-i | kubeconfig'is on tunnus, millega saab klastrisse |
| parandus pärast esitust | `git log --oneline -1 k07` | tag on vana commit'i peal: `git tag -f k07 && git push -f origin k07` | tag viitab endiselt commit'ile, mille juures ta loodi |
