---
tags:
  - Kubernetes
  - k3s
  - Helm
  - Argo CD
---

# 7. kohtumine, lisaülesanded

Ülesanded jätkavad IS1 [Kubernetese praktikumi](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/) ja selle kursuse [süvenemise](syvenemine.md) osi. Eeldus on kirjas iga ülesande juures.

| Ülesanne | Tase | Tulemus |
|---|---|---|
| [1. Secret YAML-ina](#1-secret-yaml-ina) | lihtne | Secret failist, parool ilma reavahetuseta |
| [2. ReplicaSet ja label'id](#2-replicaset-ja-labelid) | lihtne | tead, kuidas selektor pod'i omaniku määrab |
| [3. command ja args](#3-command-ja-args) | lihtne | tead, millal ENTRYPOINT jääb kehtima |
| [4. Ingress'i path-reeglid](#4-ingressi-path-reeglid) | lihtne | `Prefix` ja `Exact` koodid on mõõdetud |
| [5. k9s või Lens](#5-k9s-voi-lens) | lihtne | kahe katkise pod'i põhjus leitud tööriistaga |
| [6. Oma klaster edasi](#6-oma-klaster-edasi) | lihtne | toleration'iga pod töötab taint'iga node'il |
| [7. HPA](#7-hpa) | keskmine | koormuse ajal tõstab HPA koopiad 2-le |
| [8. Liveness valesti: restarditsükkel meelega](#8-liveness-valesti-restarditsukkel-meelega) | keskmine | näed, kuidas vale liveness katkestust pikendab |
| [9. Smoke testi Job](#9-smoke-testi-job) | keskmine | CronJob saadab smoke testi tulemuse Labori seisu |
| [10. Järjekorra consumer eraldi Deploymentiks](#10-jarjekorra-consumer-eraldi-deploymentiks) | keskmine | järjekorda loeb ainult `worker` |
| [11. Oma klastri admini vaade](#11-oma-klastri-admini-vaade) | keskmine | NodePort, ServiceLB, cordon, debug ja PDB proovitud |
| [12. Kogu namespace'i võrk kinni](#12-kogu-namespacei-vork-kinni) | keskmine | sissetulev liiklus keelatud, `/health` ikka `UP` |
| [13. Helm: sama chart, kaks keskkonda](#13-helm-sama-chart-kaks-keskkonda) | keskmine | kaks values-faili, diff'id selgitatud |
| [14. Andmebaasi varukoopia ja taastamise proov](#14-andmebaasi-varukoopia-ja-taastamise-proov) | keskmine | tunnine dump, kustutatud rida taastatud |
| [15. Oma klaster: namespace nagu klassis](#15-oma-klaster-namespace-nagu-klassis) | keskmine | kvoot ja `edit` piiravad ServiceAccount'i |
| [16. Oma app01 klastri node'iks](#16-oma-app01-klastri-nodeiks) | keskmine | sinu pod töötab sinu app01 node'il |
| [17. SLO ja error budget Labori seisule](#17-slo-ja-error-budget-labori-seisule) | keskmine | mõõdetud SLI ja kulutatud error budget |
| [Lisaprojekt: klastri health check ühe käsuga](#lisaprojekt-klastri-health-check-uhe-kasuga) | keskmine | `tervis.sh`: kuus kontrolli, väljumiskood |
| [18. Andmebaasi parooli rotatsioon ilma katkestuseta](#18-andmebaasi-parooli-rotatsioon-ilma-katkestuseta) | raske | uus DB kasutaja, vana lukus, 0 katkestust |
| [19. Deploy heakskiiduga: CI teeb PR-i](#19-deploy-heakskiiduga-ci-teeb-pr-i) | raske | iga deploy läbib ühe boti PR-i |
| [20. Skeemimuudatus enne rollout'i: Argo CD hook ja sync wave](#20-skeemimuudatus-enne-rollouti-argo-cd-hook-ja-sync-wave) | raske | migratsioon enne app01-t, vigane peatab sync'i |
| [21. Saladus Gitis: Sealed Secrets ja võtme taaste](#21-saladus-gitis-sealed-secrets-ja-votme-taaste) | raske | sama SealedSecret töötab taastatud klastris |
| [Lisaprojekt: podinfo Gitist Argo CD kaudu](#lisaprojekt-podinfo-gitist-argo-cd-kaudu) | raske | podinfo Argo CD all, `helm list` tühi |
| [22. vorgukogu CronJob'ina](#22-vorgukogu-cronjobina) | keskmine | öine CronJob kogub mõlemalt ruuterilt |

Repo'sse lisatavad failid lähevad kausta `k07-k8s/` (katsefailid kausta `~/k07-katse/`), iga ülesanne on eraldi issue label'iga `edasijõudnu` ja issue's põhjendad oma lahendust.

## Lihtsad ülesanded

### 1. Secret YAML-ina

**Tase:** lihtne · **Eeldus:** [Namespace ja põhiobjektid](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-1-klaster-ja-esimene-deployment)

Laboris lõid Secret'i käsurealt. Failina kirjutatud Secret'iga tekib sage viga: parooli lõppu satub reavahetus ja "õige" parool ei tööta. Fail jääb kausta `~/k07-katse/`, mitte repo'sse.

1. Kodeeri `salajane2` base64-ks nii `echo`-ga kui ka `echo -n`-iga ja võrdle tulemusi.
2. Kirjuta `~/k07-katse/secret.yaml`: Secret `katse2`, `data.A` on `-n`-iga saadud väärtus, `stringData.B: salajane3`.
3. Tee sellele `kubectl apply` ja vaata, millisel kujul API objekti salvestas.
4. Näita, kas võtme A väärtuse lõpus on reavahetus, ja korista Secret ära.

**Kontroll:**

```bash
kubectl get secret katse2 -o yaml
kubectl get secret katse2 -o jsonpath='{.data.A}' | base64 -d | od -c | tail -2
kubectl get secret katse2 -o jsonpath='{.data.B}' | base64 -d; echo
```

**Valmis, kui:**

- `od -c` näitab `s a l a j a n e 2` ilma `\n`-ita
- võti B annab `salajane3`
- `kubectl get secret katse2 -o yaml` väljundis pole `stringData` rida
- issue's on mõlema `echo` variandi base64 väärtus ja põhjus, miks need erinevad

Vihje: `base64 -d` väljundis reavahetust ekraanil ei märka, `| od -c | tail -2` näitab seda kohe.

??? success "Lahendus"
    `data` ootab base64-i ilma reavahetuseta, `stringData` lihtteksti. API teisendab `stringData` `data` alla ja `stringData` võtit salvestatud objektis enam pole.

    ```bash
    cat > ~/k07-katse/secret.yaml <<'EOF'
    apiVersion: v1
    kind: Secret
    metadata:
      name: katse2
    type: Opaque
    data:
      A: c2FsYWphbmUy
    stringData:
      B: salajane3
    EOF
    kubectl apply -f ~/k07-katse/secret.yaml
    kubectl get secret katse2 -o jsonpath='{.data.A}' | base64 -d | od -c | tail -2
    kubectl get secret katse2 -o jsonpath='{.data.B}' | base64 -d; echo
    kubectl delete -f ~/k07-katse/secret.yaml
    ```

    Kontroll: `od -c` näitab `s a l a j a n e 2` ilma `\n`-ita, võti B annab `salajane3` ja `kubectl get secret katse2 -o yaml` väljundis pole `stringData` rida.

    **Miks nii.** Kaks base64 väärtust erinevad (`…bmUyCg==` ja `…bmUy`): ilma `-n`-ita lisab `echo` reavahetuse. Viga on raske märgata, sest parool näeb `base64 -d` väljundis õige välja.

### 2. ReplicaSet ja label'id

**Tase:** lihtne · **Eeldus:** [Namespace ja põhiobjektid](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-1-klaster-ja-esimene-deployment)

ReplicaSet valib pod'id label'i, mitte nime järgi. Seetõttu lisab Deployment oma ReplicaSet'idele label'i `pod-template-hash`, et kahe versiooni ReplicaSet'id teineteise pod'e üle ei võtaks. Vaatad, mis juhtub, kui olemasolev omanikuta pod vastab ReplicaSet'i selektorile.

1. Loo omanikuta pod `orb`: `kubectl run orb --image=nginx:1.30-alpine --labels=tier=katse`
2. Kirjuta `rs.yaml`: ReplicaSet `katse`, `replicas: 2`, selektor ja template'i label `tier: katse`, konteiner `web` image'iga `nginx:1.30-alpine`, `resources.requests` `cpu: 10m` ja `memory: 16Mi`.
3. Tee sellele `kubectl apply` ja leia, mitu uut pod'i tekkis ja milline objekt on pod'i `orb` omanik.
4. Eemalda pod'ilt `orb` label `tier` ja vaata, mis juhtub pod'ide arvu ja `orb`-iga.
5. Korista: `kubectl delete -f rs.yaml && kubectl delete pod orb`

**Kontroll:**

```bash
kubectl get pods -l tier=katse
kubectl get pod orb -o jsonpath='{.metadata.ownerReferences[0].name}'; echo
kubectl label pod orb tier-
kubectl get pods --show-labels | grep -E 'orb|katse'
```

**Valmis, kui:**

- `kubectl get rs katse` näitab `READY 2`
- issue's on mõlema sammu järel pod'ide nimekiri ja `orb`-i omanik
- issue's on selgitus, mitu pod'i ReplicaSet kummalgi korral lõi ja miks
- pärast koristust ei leia `kubectl get pods -l tier=katse` midagi

??? success "Lahendus"
    Selektor ja template'i label'id peavad klappima, muidu lükkab API ReplicaSet'i tagasi (`selector does not match template labels`).

    ```yaml
    apiVersion: apps/v1
    kind: ReplicaSet
    metadata:
      name: katse
    spec:
      replicas: 2
      selector:
        matchLabels: {tier: katse}
      template:
        metadata:
          labels: {tier: katse}
        spec:
          containers:
            - name: web
              image: nginx:1.30-alpine
              resources:
                requests: {cpu: 10m, memory: 16Mi}
    ```

    Kontroll: pärast `apply`-d annab `kubectl get pods -l tier=katse --no-headers | wc -l` tulemuseks 2 (üks neist `orb`), `ownerReferences` on `katse`. Pärast `label orb tier-` on `tier=katse` pod'e jälle 2 ja `orb` on kolmas, ilma omanikuta.

    **Miks nii.** Pärast `apply`-d lõi ReplicaSet ainult ühe uue pod'i, sest `orb` sobis selektoriga ja ReplicaSet võttis selle üle (`ownerReferences` = `katse`). Pärast label'i eemaldamist loob ReplicaSet uue pod'i ja `orb` jääb omanikuta alles.

    ReplicaSet'i jaoks määrab pod'i kuuluvuse selektor: ReplicaSet loendab sobiva label'iga pod'e, täidab puudujäägi ja märgib sobiva omanikuta pod'i enda omaks (`ownerReferences`). Kaks käsitsi kirjutatud sama selektoriga ReplicaSet'i konkureeriksid samade pod'ide pärast. Deployment väldib seda, lisades igale versioonile oma räsi.

### 3. command ja args

**Tase:** lihtne · **Eeldus:** [Namespace ja põhiobjektid](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-1-klaster-ja-esimene-deployment)

[`command` ja `args`](https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/) asendavad image'i ENTRYPOINT-i ja CMD-d. Vale valik nende vahel on sage `CrashLoopBackOff`-oleku põhjus: rakendus käivitatakse vale käsuga või jääb entrypoint vahele.

1. Kirjuta `cmd.yaml`: Pod `cmd`, image `busybox:1.37`, `restartPolicy: Never`, `resources.requests` (`cpu: 10m`, `memory: 16Mi`), `env` muutuja `LAB=lab-07`, `command: ["echo"]` ja `args: ["labor", "$(LAB)"]`.
2. Tee sellele `kubectl apply` ja käivita lisaks kaks pod'i:

    ```bash
    kubectl run args --image=nginx:1.30-alpine --restart=Never -- nginx -v
    kubectl run cmd2 --image=nginx:1.30-alpine --restart=Never --command -- nginx -v
    ```

3. Ennusta enne logide vaatamist, mida iga pod väljastab ja kumb väli (`command` või `args`) on pod'idel `args` ja `cmd2` täidetud. Kontrolli.
4. Korista: `kubectl delete pod args cmd2 && kubectl delete -f cmd.yaml`

**Kontroll:**

```bash
kubectl get pods cmd args cmd2
kubectl logs cmd; kubectl logs args; kubectl logs cmd2
kubectl get pod args -o jsonpath='{.spec.containers[0].args} {.spec.containers[0].command}'; echo
kubectl get pod cmd2 -o jsonpath='{.spec.containers[0].args} {.spec.containers[0].command}'; echo
```

**Valmis, kui:**

- kõik kolm pod'i on `Completed`
- `kubectl logs cmd` annab `labor lab-07`
- issue's on iga pod'i kohta, kumb väli on täidetud ja kas image'i ENTRYPOINT jäi kehtima
- issue's on vastus: mis jääks vahele, kui MariaDB image'il kasutada `command`-i

??? success "Lahendus"
    `$(LAB)` asendab kubelet enne konteineri käivitust, sest `LAB` on samas konteineris `env` all defineeritud. Shelli siin pole: `echo` saab kaks argumenti.

    ```yaml
    apiVersion: v1
    kind: Pod
    metadata:
      name: cmd
    spec:
      restartPolicy: Never
      containers:
        - name: cmd
          image: busybox:1.37
          env:
            - name: LAB
              value: lab-07
          command: ["echo"]
          args: ["labor", "$(LAB)"]
          resources:
            requests: {cpu: 10m, memory: 16Mi}
    ```

    Kontroll: `kubectl logs cmd` annab `labor lab-07`. Pod'i `args` jsonpath näitab `["nginx","-v"]` väljas `args` ja tühja `command`-i, pod'il `cmd2` on vastupidi.

    **Miks nii.** Kõik kolm on `Completed`. `cmd` logis on `labor lab-07`, kahes teises `nginx version: nginx/1.30.…`.

    `kubectl run … -- x` määrab `x` väärtuseks `args`, nii et image'i ENTRYPOINT jääb kehtima. Deploymentis viiks töö lõpetav protsess olekusse CrashLoopBackOff, sest seal on `restartPolicy: Always`. nginx'i puhul erinevust näha ei olnud, sest selle image'i entrypoint käivitab talle antud käsu. Image'il, mille entrypoint teeb enne käivitust ettevalmistust (nagu MariaDB oma), jääks `command`-iga see ettevalmistus vahele.

### 4. Ingress'i path-reeglid

**Tase:** lihtne · **Eeldus:** [Labori seis klastris](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-2-labori-seis-klastris)

Laboris oli Ingress'il üks reegel, mis kattis kogu saidi. Tootmises jagatakse ühe hosti teed sageli mitme teenuse vahel, näiteks `/api` ühele ja `/` teisele, ja `pathType` otsustab, milline päring millise reegli alla läheb.

1. Muuda ajutiselt Labori seisu Ingress'i reegli `path` väärtuseks `/health` (`pathType: Prefix`) ja mõõda tsükliga viie tee HTTP-koodid.
2. Korda sama `pathType: Exact`-iga.
3. Täida tabel ja taasta Ingress `k07-k8s/40-app.yaml` järgi.

| Tee | `Prefix /health` | `Exact /health` |
|---|---|---|
| `/` | ? | ? |
| `/health` | ? | ? |
| `/health/live` | ? | ? |
| `/version` | ? | ? |
| `/style.css` | ? | ? |

**Kontroll:**

```bash
for p in / /health /health/live /version /style.css; do
  printf '%-14s ' $p; curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: labori-seis-<github>.lab.hkhk.ee' http://k3s.lab.hkhk.ee$p
done
kubectl diff -f k07-k8s/40-app.yaml && echo "Ingress = Git"
```

**Valmis, kui:**

- issue's on tabel mõõdetud koodidega
- issue's on vastus: kas `/healthz` sobiks `Prefix /health` alla ja miks
- lõpus väljastab `kubectl diff` rea `Ingress = Git`

Vihje: kui Argo CD selfHeal on sees, tühistab see ajutise muudatuse kohe; tee katse Gitis või enne Application'i loomist.

??? success "Lahendus"
    `kubectl patch --type json` muudab ühe välja ilma faili puutumata. Lõpus taastab `apply` failis oleva reegli ja tühi `diff` tõestab seda.

    ```bash
    H='Host: labori-seis-<github>.lab.hkhk.ee'
    proov() { for p in / /health /health/live /version /style.css; do printf '%-14s ' $p; curl -s -o /dev/null -w '%{http_code}\n' -H "$H" http://k3s.lab.hkhk.ee$p; done; }
    kubectl patch ingress labori-seis --type json -p '[{"op":"replace","path":"/spec/rules/0/http/paths/0/path","value":"/health"}]'
    sleep 3; proov
    kubectl patch ingress labori-seis --type json -p '[{"op":"replace","path":"/spec/rules/0/http/paths/0/pathType","value":"Exact"}]'
    sleep 3; proov
    kubectl apply -f k07-k8s/40-app.yaml && kubectl diff -f k07-k8s/40-app.yaml && echo "Ingress = Git"
    ```

    | Tee | `Prefix /health` | `Exact /health` |
    |---|---|---|
    | `/`, `/version`, `/style.css` | 404 | 404 |
    | `/health` | 200 | 200 |
    | `/health/live` | 200 | 404 |

    Kontroll: tabelis olevad koodid ja lõpus rida `Ingress = Git`.

    **Miks nii.** Kui reegel hõlmab ainult lehe teed, ei ole ka `/style.css` kättesaadav ja leht avaneb ilma stiilita. [Prefix võrdleb tee osi kaldkriipsude vahel, mitte märke, Exact kogu teed](https://kubernetes.io/docs/concepts/services-networking/ingress/#path-types): `/healthz` ei sobiks `Prefix /health` alla.

### 5. k9s või Lens

**Tase:** lihtne · **Eeldus:** [Ressursid ja rikkeotsing](lab-3-ressursid.md), etapp [Kaks katkist pod'i](lab-3-ressursid.md#kaks-katkist-podi)

Intsidendi ajal on kümne käsu kirjutamine aeglane ja vigadele altis. k9s ja Lens näitavad sama infot ilma käske kirjutamata.

1. Käivita [k9s](https://k9scli.io/) terminalis (`k9s -n is-<github>`) või lisa Lensis töölauale sama kubeconfig.
2. Leia tööriistas sama info, mida andsid etapi "Kaks katkist pod'i" käsud: olek, Events, eelmise konteineri logi.
3. Kirjuta issue'sse mõlema pod'i kohta "vaade → põhjus".

**Kontroll:**

```bash
kubectl get pods | grep -E 'ImagePullBackOff|CrashLoopBackOff'
```

**Valmis, kui:**

- mõlemad katkised pod'id on namespace'is olemas
- issue's on ImagePullBackOff'i kohta Events'i rida, mille leidsid tööriistas
- issue's on CrashLoopBackOff'i kohta eelmise konteineri logi rida, mille leidsid tööriistas

??? success "Lahendus"
    Kui koristasid kaks katkist pod'i ressursside lehel ära, loo need sealsete käskudega uuesti. Käivita k9s `--readonly`-ga: intsidendi ajal ei tohi üks vale klahv (`ctrl-d`) pod'i kustutada.

    ```text
    k9s -n is-<github> --readonly
    :pods⏎             pod'ide nimekiri, veerg STATUS: ImagePullBackOff, CrashLoopBackOff
    <d>                describe valitud pod'il; ImagePullBackOff'i põhjus on Events'is
    <l>, siis <p>      logid; <p> lülitab eelmise konteineri logi, CrashLoopBackOff'i põhjus on seal
    :events⏎           kogu namespace'i Events
    ```

    Kontroll: issue's on mõlema pod'i kohta "vaade → põhjus", ImagePullBackOff'i puhul Events'i rida `Failed to pull image`, CrashLoopBackOff'i puhul eelmise konteineri logi rida.

    **Miks nii.** Tööriist ei anna uut infot: see kasutab sama API-t ja sinu kubeconfig'i õigusi. Kasu on kiiruses: Events, logid ja `describe` on ühe klahvivajutuse kaugusel.

### 6. Oma klaster edasi

**Tase:** lihtne · **Eeldus:** [Oma klaster](syvenemine.md#osa-1-oma-k3s-klaster), `k3s01` on alles

Logikoguja või monitooringuagent peab käivituma igal node'il, ka nendel, mis lisatakse hiljem. Proovid DaemonSet'i ja taint'i klastris, kus sul on admini õigused.

1. Loo `k3s01`-s DaemonSet, mis käivitab igal node'il `busybox`-i.
2. Lisa node'ile taint `katse=jah:NoSchedule` ja käivita uus tavaline pod.
3. Anna pod'ile toleration ja käivita see uuesti.
4. Kustuta taint'i ajal DaemonSet'i pod ja vaata `kubectl get ds`.
5. Eemalda taint, korista ja lõpus lülita k3s01 välja.

**Kontroll:**

```bash
kubectl --context k3s01 get ds,pods -o wide
kubectl --context k3s01 describe pod uus | grep -A2 Events
```

**Valmis, kui:**

- DaemonSet'il on igal node'il üks pod
- toleration'ita pod on `Pending` ja Events'is on taint'i rida
- toleration'iga pod on `Running` taint'iga node'il
- issue's on `get ds` väljund pärast DaemonSet'i pod'i kustutamist taint'i ajal ja selle selgitus

??? success "Lahendus"
    `NoSchedule` ei aja olemasolevat pod'i ära (see oleks `NoExecute`), see mõjub ainult uutele. Tavaline pod jääb `Pending`-uks, DaemonSet'i kontroller aga ei loo taint'iga node'ile pod'i üldse ja `DESIRED` langeb.

    ```bash
    K="kubectl --context k3s01"
    N=$($K get nodes -o jsonpath='{.items[0].metadata.name}')
    cat > ~/k07-katse/ds.yaml <<'EOF'
    apiVersion: apps/v1
    kind: DaemonSet
    metadata:
      name: igal-nodel
    spec:
      selector:
        matchLabels: {app: igal-nodel}
      template:
        metadata:
          labels: {app: igal-nodel}
        spec:
          containers:
            - name: busybox
              image: busybox:1.37
              command: ["sh", "-c", "while true; do date; sleep 60; done"]
              resources:
                requests: {cpu: 5m, memory: 8Mi}
    EOF
    $K apply -f ~/k07-katse/ds.yaml && $K get ds,pods -o wide
    $K taint node $N katse=jah:NoSchedule
    $K run uus --image=busybox:1.37 --restart=Never -- sleep 3600
    $K describe pod uus | grep -A2 Events | tail -1          # untolerated taint {katse: jah}
    $K delete pod uus
    $K run uus --image=busybox:1.37 --restart=Never \
      --overrides='{"spec":{"tolerations":[{"key":"katse","operator":"Equal","value":"jah","effect":"NoSchedule"}]}}' -- sleep 3600
    $K get pod uus -o wide
    $K taint node $N katse- && $K delete pod uus && $K delete -f ~/k07-katse/ds.yaml
    ```

    Kontroll: esimene `uus` on `Pending` ja Events'is on `untolerated taint {katse: jah}`, teine on `Running` samas node'is. Kui kustutad taint'i ajal DaemonSet'i pod'i, näitab `get ds` `DESIRED 0`, mitte `Pending` pod'i.

    **Miks nii.** DaemonSet'i pod'id saavad vaikimisi tolerations'id mõnele süsteemsele taint'ile (näiteks `not-ready`), aga mitte sinu lisatud `katse=jah`-le. Logikogujale annad tavaliselt toleration'i kõigile taint'idele, sest logi on vaja just probleemsetelt node'idelt.

## Keskmised ülesanded

### 7. HPA

**Tase:** keskmine · **Eeldus:** [Ressursid ja rikkeotsing](lab-3-ressursid.md)

Koormus muutub päeva jooksul ja käsitsi skaleerimine jääb sageli hiljaks. HorizontalPodAutoscaler muudab app01 koopiate arvu CPU kasutuse järgi.

1. Loo app01-le HPA: `kubectl autoscale deploy/app01 --cpu-percent=50 --min=1 --max=2`
2. Kontrolli, et HPA näeb mõõdikut: `TARGETS` ei ole `<unknown>`.
3. Tekita koormus ja jälgi teises terminalis `kubectl get hpa -w` ja `kubectl top pods`:

    ```bash
    kubectl run load --rm -it --image=busybox:1.37 -- sh -c 'while true; do wget -qO- http://app01:8080/ > /dev/null; done'
    ```

4. Pärast katset kustuta HPA ja taasta Application Gitist.

**Kontroll:**

```bash
kubectl get hpa app01
kubectl get hpa app01 -o jsonpath='{.status.currentReplicas}'; echo
kubectl get application labori-seis -o jsonpath='{.status.sync.status} {.status.health.status}'; echo
```

**Valmis, kui:**

- koormuse ajal annab `currentReplicas` 2
- issue's on kirjas, kui kaua pärast koormuse lõppu koopiaid oli 2 ja miks
- lõpus on `kubectl get hpa` tühi ja Application `Synced Healthy`

Vihje: Argo CD selfHeal ja HPA haldavad mõlemad välja `spec.replicas`.

??? success "Lahendus"
    HPA ja Argo CD tahavad mõlemad hallata välja `spec.replicas`. Kui Gitis on `replicas: 1` ja selfHeal on sees, keerab Argo HPA otsuse tagasi ja koopiate arv vilgub 1 ja 2 vahel. Tee katse selfHeal'ita või eemalda `replicas` failist, kui HPA jääb alles.

    ```bash
    kubectl patch application labori-seis --type merge -p '{"spec":{"syncPolicy":{"automated":{"selfHeal":false}}}}'
    kubectl autoscale deploy/app01 --cpu-percent=50 --min=1 --max=2
    kubectl get hpa app01                      # TARGETS cpu: <x>%/50%, mitte <unknown>
    kubectl run load --rm -it --image=busybox:1.37 --restart=Never -- sh -c 'while true; do wget -qO- http://app01:8080/ > /dev/null; done'
    # teises terminalis
    kubectl get hpa app01 -w
    # pärast katset
    kubectl delete hpa app01 && kubectl apply -f k07-k8s/argocd/application.yaml
    ```

    Kontroll: koormuse ajal on `kubectl get hpa app01 -o jsonpath='{.status.currentReplicas}'` 2. Pärast koormuse lõppu jääb see 2-ks umbes 5 minutiks (`scaleDown` stabilization window 300 s) ja langeb siis 1-le.

    **Miks nii.** HPA vajab metrics-server'it ja requests'e: protsent arvutatakse requests'i suhtes, mitte node'i mahu suhtes. Ilma requests'ita näitab HPA `<unknown>` ega skaleeri. Jagatud klastris on ülempiir teadlikult väike, sest iga lisakoopia võtab kvoodist 256 Mi.

### 8. Liveness valesti: restarditsükkel meelega

**Tase:** keskmine · **Eeldus:** [Neli riket](lab-5-neli-riket.md)

Valesti seadistatud liveness probe muudab andmebaasi lühikese katkestuse kogu rakenduse katkestuseks. Vahetad app01 koopial liveness'i ja readiness'i rollid, peatad db01 ja võrdled koopiat app01-ga.

1. Tee `40-app.yaml`-ist `~/k07-katse/app-vale.yaml`, kus on ainult Deployment: nimi `app01-vale`, `replicas: 1`, selektoris ja template'is label `app: app01-vale`, readiness'i tee `/health/live` ja liveness'i tee `/health`.
2. Lisa db01 NetworkPolicy'sse ajutiselt teine `from`-reegel label'ile `app: app01-vale` (`kubectl patch networkpolicy db01`).
3. Saada koopia klastrisse `kubectl apply -f`-iga (mitte Giti) ja oota, kuni pod on 1/1.
4. Peata db01 (`kubectl scale deploy/db01 --replicas=0`), jälgi mõlemat Deploymenti, siis too db01 tagasi.
5. Korista: `kubectl delete -f ~/k07-katse/app-vale.yaml && kubectl apply -f k07-k8s/15-db-netpol.yaml`

**Kontroll:**

```bash
kubectl get pods -l 'app in (app01,app01-vale)' -w
kubectl get pods -l 'app in (app01,app01-vale)' -o custom-columns=POD:.metadata.name,RESTARTS:.status.containerStatuses[0].restartCount
```

**Valmis, kui:**

- db01 peatatuna jääb `app01` `0/1` ja RESTARTS on 0
- `app01-vale` RESTARTS kasvab ja pod jõuab olekusse `CrashLoopBackOff`
- issue's on kirjas, kumb jõudis pärast db01 taastumist kiiremini olekusse Ready ja miks
- lõpus on `app01-vale` kustutatud ja `kubectl diff -f k07-k8s/15-db-netpol.yaml` tühi

Vihje: lülita enne katset Application'i selfHeal välja, muidu taastab Argo CD db01 koopiate arvu kohe.

??? success "Lahendus"
    Image võetakse töötavast app01-st, nii et koopia on sama versioon. Init-konteinerit pole vaja, sest Hikari `initialization-fail-timeout=-1` laseb rakendusel käivituda ka ilma andmebaasita.

    ```bash
    kubectl patch application labori-seis --type merge -p '{"spec":{"syncPolicy":{"automated":{"selfHeal":false}}}}'
    kubectl patch networkpolicy db01 --type json \
      -p '[{"op":"add","path":"/spec/ingress/0/from/-","value":{"podSelector":{"matchLabels":{"app":"app01-vale"}}}}]'
    IMG=$(kubectl get deploy app01 -o jsonpath='{.spec.template.spec.containers[0].image}')
    cat > ~/k07-katse/app-vale.yaml <<EOF
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: app01-vale
    spec:
      replicas: 1
      selector:
        matchLabels: {app: app01-vale}
      template:
        metadata:
          labels: {app: app01-vale}
        spec:
          containers:
            - name: labori-seis
              image: $IMG
              ports:
                - {name: http, containerPort: 8080}
              envFrom:
                - configMapRef: {name: labori-seis}
              env:
                - name: DB_PASSWORD
                  valueFrom: {secretKeyRef: {name: labori-seis, key: DB_PASSWORD}}
                - name: RABBITMQ_PASSWORD
                  valueFrom: {secretKeyRef: {name: labori-seis, key: RABBITMQ_PASSWORD}}
              startupProbe:
                httpGet: {path: /health/live, port: http}
                periodSeconds: 5
                failureThreshold: 36
              readinessProbe:
                httpGet: {path: /health/live, port: http}
                periodSeconds: 10
              livenessProbe:
                httpGet: {path: /health, port: http}
                periodSeconds: 20
                timeoutSeconds: 3
                failureThreshold: 3
              resources:
                requests: {cpu: 100m, memory: 256Mi}
                limits: {memory: 640Mi}
    EOF
    kubectl apply -f ~/k07-katse/app-vale.yaml && kubectl rollout status deploy/app01-vale --timeout=4m
    ```

    Kontroll: db01 peatatuna on `kubectl get pods -l app=app01 -o jsonpath='{..restartCount}'` 0 ja `app01-vale` oma kasvab iga umbes 60 s järel (3 × 20 s liveness'i viga), kuni olek on `CrashLoopBackOff`. Pärast db01 tagasitulekut on `app01` Ready järgmise readiness'i kontrolliga (kuni 10 s), `app01-vale` alles siis, kui CrashLoopBackOff'i ooteaeg (kuni 5 min) on läbi ja JVM on uuesti käivitunud. Lõpus pane selfHeal tagasi: `kubectl apply -f k07-k8s/argocd/application.yaml`.

    **Miks nii.** NetworkPolicy reegel on vajalik, sest db01 poliitika lubab ainult label'i `app: app01`: ilma selleta ei jõuaks koopia andmebaasini ja liveness ebaõnnestuks juba enne katset.

### 9. Smoke testi Job

**Tase:** keskmine · **Eeldus:** [Labori seis klastris](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-2-labori-seis-klastris) · **Esita:** `k07-k8s/60-smoke.yaml`

`Synced Healthy` ütleb, et pod'id on Ready, aga mitte seda, kas app01 `/health` annab `UP`. Klastris käivitatav test kontrollib seda ja saadab tulemuse Labori seisu.

1. Kirjuta Job: image `busybox:1.37`, `command: ["sh","-c"]`, `args` sees `wget -qO- http://app01:8080/health`; väljumiskood 0 tähendab `"status":"UP"`, 1 kõike muud.
2. Tee sellest CronJob `smoke`, mis käivitub iga 5 minuti järel.
3. Saada tulemus Labori seisu API-sse (`wget --post-data` või `curlimages/curl`).
4. Käsitsi jooks tehakse samast CronJob'ist, mitte eraldi failist.

**Kontroll:**

```bash
kubectl create job smoke-1 --from=cronjob/smoke
kubectl wait --for=condition=complete job/smoke-1 --timeout=90s; kubectl logs job/smoke-1
kubectl get cronjob smoke
```

**Valmis, kui:**

- `smoke-1` lõpeb töötava app01 korral koodiga 0 ja peatatud app01 korral koodiga 1
- `kubectl get cronjob smoke` näitab `LAST SCHEDULE` viimase 5 minuti seest
- CronJob'i tulemus on Labori seisu API vastuses näha (`"check":"smoke"`)

??? success "Lahendus"
    CronJob on Gitis (`k07-k8s/60-smoke.yaml`) ja käsitsi jooks tehakse sellest `kubectl create job --from`-iga, nii et käsitsi ja ajakava järgi käivitatud test on sama. Tulemus läheb sinu enda Labori seisu API-sse koolitaja tokeniga demokasutaja `demo-kati` nimel; token tuleb Secret'ist, mitte failist.

    ```yaml
    apiVersion: batch/v1
    kind: CronJob
    metadata:
      name: smoke
    spec:
      schedule: "*/5 * * * *"
      concurrencyPolicy: Forbid
      successfulJobsHistoryLimit: 3
      failedJobsHistoryLimit: 3
      jobTemplate:
        spec:
          backoffLimit: 0
          activeDeadlineSeconds: 60
          template:
            metadata:
              labels: {app: smoke}
            spec:
              restartPolicy: Never
              containers:
                - name: smoke
                  image: busybox:1.37
                  command: ["sh", "-c"]
                  args:
                    - |
                      if body=$(wget -qO- -T 5 http://app01:8080/health) && echo "$body" | grep -q '"status":"UP"'; then
                        st=OK; rc=0
                      else
                        st=FAIL; rc=1
                      fi
                      wget -qO- -T 5 --header 'Content-Type: application/json' \
                        --header "Authorization: Bearer $TEACHER_TOKEN" \
                        --post-data "{\"lab\":\"lab-07\",\"check\":\"smoke\",\"status\":\"$st\",\"student\":\"demo-kati\",\"host\":\"$(hostname)\"}" \
                        http://app01:8080/api/results || echo "tulemust ei saadetud"
                      echo "smoke $st"; exit $rc
                  env:
                    - name: TEACHER_TOKEN
                      valueFrom:
                        secretKeyRef: {name: labori-seis, key: TEACHER_TOKEN}
                  resources:
                    requests: {cpu: 10m, memory: 16Mi}
                    limits: {memory: 32Mi}
    ```

    ```bash
    kubectl create job smoke-1 --from=cronjob/smoke
    kubectl wait --for=condition=complete job/smoke-1 --timeout=90s; kubectl logs job/smoke-1
    curl -s -H 'Authorization: Bearer demo-kati-token' -H 'Host: labori-seis-<github>.lab.hkhk.ee' http://k3s.lab.hkhk.ee/api/results | grep -o '"check":"smoke"[^}]*'
    ```

    Kontroll: logis on `{"status":"accepted"}` ja `smoke OK`, `kubectl get cronjob smoke` näitab `LAST SCHEDULE` viimase 5 minuti seest ja API vastuses on rida `smoke`. Kui tegid lisaülesande 12, lisa `traefik-app01` kõrvale reegel, mis lubab pod'id `app: smoke` app01 pordile 8080; muidu annab test `FAIL` võrgu, mitte rakenduse pärast.

    **Miks nii.** Job erineb Deploymentist selle poolest, et töö lõpetamine on Job'i puhul oodatud tulemus, mitte rike. CronJob'i ajalugu (`successfulJobsHistoryLimit`, `failedJobsHistoryLimit`) jätab alles viimased jooksud, nii et näed, millal test viimati ebaõnnestus.

### 10. Järjekorra consumer eraldi Deploymentiks

**Tase:** keskmine · **Eeldus:** [Labori seis klastris](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-2-labori-seis-klastris) · **Esita:** `k07-k8s/45-worker.yaml`

Veebiliides ja taustatöö skaleeruvad eri põhjustel, aga praegu on need ühes pod'is: iga app01 koopia on ka järjekorra consumer. Pärast muudatust on järjekorra consumer ainult `worker`.

1. Tee `40-app.yaml`-ist koopia `45-worker.yaml`: Deployment `worker`, ilma Service'i ja Ingress'ita.
2. Pane worker'i readiness'iks `/health/live`.
3. Lisa app01-le `SPRING_RABBITMQ_LISTENER_SIMPLE_AUTOSTARTUP: "false"` ja worker'ile sama muutuja väärtusega `"true"`. Koodi pole vaja muuta: Spring Boot seob keskkonnamuutuja seadega `spring.rabbitmq.listener.simple.auto-startup` ([relaxed binding](https://docs.spring.io/spring-boot/reference/features/external-config.html)).
4. Worker töötab sama image'iga mis app01 ka pärast järgmist boti tag'i commit'i.

**Kontroll:**

```bash
kubectl exec deploy/rmq01 -- rabbitmqctl list_consumers
kubectl get deploy worker app01
bash autograde/check.sh k07 objects
```

**Valmis, kui:**

- `list_consumers` näitab ainult worker'i ühendust
- `worker` ja `app01` on Ready
- `bash autograde/check.sh k07 objects` annab `OK`
- Application on `Synced Healthy`

??? success "Lahendus"
    Kaks asja, mida koopia `40-app.yaml`-ist kaasa ei too: worker kirjutab tulemused andmebaasi, seega vajab ta db01 NetworkPolicy's oma `from`-reeglit (muidu jääb `wait-deps` igavesti `ootan db01:3306` peale), ja `gitops.yml` uuendab image'i tag'i ainult `40-app.yaml`-is, nii et worker jääks vanale versioonile.

    ```yaml
    # k07-k8s/45-worker.yaml
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: worker
      labels: {app: worker}
    spec:
      replicas: 1
      selector:
        matchLabels: {app: worker}
      template:
        metadata:
          labels: {app: worker}
        spec:
          initContainers:
            - name: wait-deps
              image: mariadb:11.4
              command: ["bash", "-c"]
              args:
                - |
                  for hp in "$DB_HOST:3306" "$RABBITMQ_HOST:5672"; do
                    until timeout 2 bash -c "</dev/tcp/${hp%:*}/${hp#*:}" 2>/dev/null; do echo "ootan $hp"; sleep 3; done
                  done
              envFrom:
                - configMapRef: {name: labori-seis}
              resources:
                requests: {cpu: 10m, memory: 16Mi}
                limits: {memory: 64Mi}
          containers:
            - name: labori-seis
              image: ghcr.io/hkhk-tk/<repo>:<sama tag mis 40-app.yaml-is>
              ports:
                - {name: http, containerPort: 8080}
              envFrom:
                - configMapRef: {name: labori-seis}
              env:
                - {name: SPRING_RABBITMQ_LISTENER_SIMPLE_AUTOSTARTUP, value: "true"}
                - name: DB_PASSWORD
                  valueFrom: {secretKeyRef: {name: labori-seis, key: DB_PASSWORD}}
                - name: RABBITMQ_PASSWORD
                  valueFrom: {secretKeyRef: {name: labori-seis, key: RABBITMQ_PASSWORD}}
              startupProbe:
                httpGet: {path: /health/live, port: http}
                periodSeconds: 5
                failureThreshold: 36
              readinessProbe:
                httpGet: {path: /health/live, port: http}
                periodSeconds: 10
              livenessProbe:
                httpGet: {path: /health/live, port: http}
                periodSeconds: 20
                timeoutSeconds: 3
              resources:
                requests: {cpu: 100m, memory: 256Mi}
                limits: {memory: 640Mi}
    ```

    Lisaks: `40-app.yaml`-is app01 `env` alla `{name: SPRING_RABBITMQ_LISTENER_SIMPLE_AUTOSTARTUP, value: "false"}`, `15-db-netpol.yaml`-is `from` alla `- podSelector: {matchLabels: {app: worker}}` ja `gitops.yml`-i sammu "Uus tag" teine `sed` sama asendusega failile `k07-k8s/45-worker.yaml`.

    ```bash
    kubectl exec deploy/rmq01 -- rabbitmqctl list_channels -q name consumer_count | awk '$NF > 0'
    kubectl get pods -l 'app in (app01,worker)' -o custom-columns=POD:.metadata.name,IP:.status.podIP
    ```

    Kontroll: `consumer_count` > 0 on ainult kanalil, mille nimes on worker'i pod'i IP; app01 IP-ga kanalid (sõnumite saatmine, `/health`) on `0`. `bash autograde/check.sh k07 objects` loeb nüüd viis Deployment'i ja on `OK`.

    **Miks nii.** Pärast jagamist saad app01 ja worker'i koopiate arvu muuta eraldi: veebiliides kasvab külastajate järgi, worker järjekorra pikkuse järgi. Worker'i readiness ei sõltu andmebaasist, sest worker'il ei ole Service'it, kuhu liiklust saata, ja readiness'i ainus mõju oleks rollout'i peatamine.

### 11. Oma klastri admini vaade

**Tase:** keskmine · **Eeldus:** [Oma klaster](syvenemine.md#osa-1-oma-k3s-klaster), `k3s01` töötab

Klassi klastris on need tegevused keelatud või kvoodiga suletud. Oma klastris näed, mida igaüks neist teeb ja miks see jagatud klastris kõiki õppijaid korraga mõjutaks.

1. Loo `k3s01`-s namespace `katse` ja sinna Deployment `web` (`nginx:1.30-alpine`).
2. Tee `web` kättesaadavaks pordil 8081 kõigepealt NodePort-, siis LoadBalancer-tüüpi Service'iga ja kontrolli mõlemat curl'iga VM-i aadressilt `<IS1_NET>.23`. Leia `kube-system`-ist objekt, mis LoadBalancer'it teenindab.
3. Märgi node `cordon`-iga unschedulable, skaleeri `web` kahele koopiale ja leia, miks uus pod ei käivitu ja mis taint node'il on. Taasta node ja kustuta namespace.
4. Kontrolli `kubectl debug node/…`-iga ilma SSH-ta, kas k3s teenus on node'il aktiivne, ja vaata ajutise konteineriga `default` namespace'i `web` pod'i protsesse.
5. Loo `default` namespace'i `web`-ile PodDisruptionBudget `--min-available=2`, proovi node'i `drain`-ida 30 s ajapiiriga, siis taasta node ja kustuta PDB.

**Kontroll:**

```bash
K="kubectl --context k3s01"
$K get ns katse 2>&1 | tail -1
$K get nodes -o jsonpath='{.items[0].spec.unschedulable}'; echo
$K get pdb -A
$K -n kube-system get pods -l k8s-app=kube-dns
```

**Valmis, kui:**

- issue's on NodePort'i number ja mõlema curl'i `HTTP/1.1 200 OK` rida
- issue's on 3. sammu `FailedScheduling` rida ja node'i taint
- issue's on 4. sammu `active` ja `ps` väljund nginx'i protsessidega
- issue's on 5. sammu `disruption budget` rida
- lõpus: `katse` on `NotFound`, `unschedulable` tühi, PDB-sid pole, kube-dns `Running`

??? success "Lahendus"
    Käsud on sammudes olemas. Kaks kohta, kus tulemus erineb oodatust: NodePort'i number on vahemikust 30000–32767 ja tuleb `get svc web` veerust `PORT(S)`; `drain` evict'ib PDB-ta pod'id kohe, ka CoreDNS'i ja Traefiku, ning ühe node'iga klastris jäävad need `Pending`-uks kuni `uncordon`-ini. Seni ei tööta klastris nimelahendus ega Ingress.

    ```bash
    K="kubectl --context k3s01"
    $K -n katse get svc web -o jsonpath='{.spec.ports[0].nodePort}'; echo     # 2. samm
    $K -n kube-system get pods -l k8s-app=kube-dns                             # 7. samm drain'i ajal: Pending
    # lõppseis
    $K get ns katse 2>&1 | tail -1                                             # NotFound
    $K get nodes -o jsonpath='{.items[0].spec.unschedulable}'; echo            # tühi
    $K get pdb -A                                                              # No resources found
    $K -n kube-system get pods -l k8s-app=kube-dns                             # Running
    ```

    Kontroll: issue's on 3. sammu `FailedScheduling` rida, 4. sammu `active` ja `ps` väljund nginx'i protsessidega ning 5. sammu `disruption budget` rida. Lõppseisu neli käsku annavad kommentaarides oleva tulemuse.

    Sammude käsud:

    ```bash
    K="kubectl --context k3s01"
    # 1
    $K create namespace katse
    $K -n katse create deployment web --image=nginx:1.30-alpine
    $K get deploy -A
    # 2
    $K -n katse expose deploy web --port=8081 --target-port=80 --type=NodePort
    $K -n katse get svc web
    curl -sI http://<IS1_NET>.23:<nodeport> | head -1
    $K -n katse patch svc web -p '{"spec":{"type":"LoadBalancer"}}'
    $K -n katse get svc web
    curl -sI http://<IS1_NET>.23:8081 | head -1
    $K -n kube-system get ds
    # 3
    N=$($K get nodes -o jsonpath='{.items[0].metadata.name}')
    $K cordon $N
    $K -n katse scale deploy web --replicas=2
    $K -n katse describe pod -l app=web | grep -A3 Events | tail -2
    $K describe node $N | grep -E 'Taints|Unschedulable'
    $K uncordon $N
    $K delete namespace katse
    # 4
    $K debug node/$N -it --image=busybox:1.37 -- chroot /host systemctl is-active k3s
    P=$($K get pod -l app=web -o jsonpath='{.items[0].metadata.name}')
    $K debug -it $P --image=busybox:1.37 --target=nginx -- ps
    # 5
    $K create pdb web --selector=app=web --min-available=2
    $K drain $N --ignore-daemonsets --delete-emptydir-data --timeout=30s
    $K get pdb web
    $K uncordon $N && $K delete pdb web
    ```

    **Miks nii.** `get deploy -A` näitab kahte `web`-i eri namespace'ides ja `kube-system`-i teenuseid. LoadBalancer'i korral on `EXTERNAL-IP` VM-i IP-aadress ja `kube-system`-is on DaemonSet `svclb-web-…` (ja `svclb-traefik-…`). [k3s-is teenindab LoadBalancer-tüüpi Service'it vaikimisi DaemonSet](https://docs.k3s.io/networking/networking-services) (ServiceLB), mis hõivab pordi igal node'il. Klassi klastris hõivaks see pordi kõigi õppijate jaoks, seetõttu on LoadBalancer'ite kvoot 0.

    `cordon`-i järel on uus pod `Pending`, Events: `0/1 nodes are available: 1 node(s) were unschedulable`. `cordon` on taint `node.kubernetes.io/unschedulable:NoSchedule`, mille Kubernetes scheduler'i jaoks ise lisab. Sama mehhanism hoiab lisaülesandes 16 teiste pod'id sinu node'ist eemal. `delete namespace` kustutab kogu namespace'i sisu, ka PVC-d ja Secret'id, seetõttu jagatud klastris seda õigust ei anta. Siin on namespace'is ainult katse-Deployment ja kustutamine on ohutu. Tootmisklastris vaata enne `kubectl get all,pvc,secret -n <namespace>`: kui StorageClass'i `reclaimPolicy` on `Delete` (local-path'i ja paljude pilveteenuste StorageClass'ide vaikeväärtus), kustutatakse koos PVC-ga ka andmed.

    `debug node/` käivitab node'il pod'i, mille `/host` all on node'i juurfailisüsteem. See on administraatori tööriist: kasutajal, kellel on selleks õigus, on sisuliselt node'i root-õigused. Ajutine konteiner võib klassi klastris olla keelatud.

    `drain` kordab teadet `Cannot evict pod as it would violate the pod's disruption budget` ja lõpeb ajapiiri ületamisel. PDB lubab katkestada ainult nii palju pod'e, et alles jääks vähemalt kaks. Ühe node'iga klastris pole uutel pod'idel kuhugi minna, seega ei saa drain selles klastris lõpule jõuda. Tootmisklastris tähendab sama teade, et hooldus ootab, kuni teisel node'il on asendus valmis.

    Kubernetes ei liigita käske ohtlikeks ja ohutuks: selle, mida kasutaja teha tohib, määravad RBAC ja kvoot.

### 12. Kogu namespace'i võrk kinni

**Tase:** keskmine · **Eeldus:** [Labori seis klastris](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-2-labori-seis-klastris) · **Esita:** `k07-k8s/16-netpol-vaikimisi.yaml`

Labori seisus kaitsesid ainult db01, kõik teised teenused on ikka kõigile avatud. Tootmises alustatakse sageli vastupidi: kõik sissetulev liiklus on keelatud ja iga lubatud ühendus kirjutatakse eraldi.

1. Kirjuta `k07-k8s/16-netpol-vaikimisi.yaml`, kus on kolm NetworkPolicy't:
    - `vaikimisi-kinni`: `podSelector: {}`, `policyTypes: [Ingress]`, reegleid pole
    - `traefik-app01`: app01 port 8080 lubatud namespace'ist `kube-system` pod'idele `app.kubernetes.io/name: traefik`
    - `app01-taustale`: mc01 11211 ja rmq01 5672 lubatud ainult app01-le
2. Tee `kubectl apply` ja proovi Ingress'i kaudu `/health` ning ajutisest pod'ist `nc -zv -w 3` mc01, rmq01 ja app01 pordile.
3. Push'i ja vaata, et Argo CD on `Synced Healthy`.

**Kontroll:**

```bash
curl -s -H 'Host: labori-seis-<github>.lab.hkhk.ee' http://k3s.lab.hkhk.ee/health; echo
kubectl run nc --rm -i --image=busybox:1.37 --restart=Never -- \
  sh -c 'for t in mc01:11211 rmq01:5672 app01:8080; do nc -zv -w 3 ${t%:*} ${t#*:} 2>&1 | tail -1; done'
```

**Valmis, kui:**

- `/health` annab Ingress'i kaudu `"status":"UP"` ja kõik komponendid on `UP`
- ajutine pod ei saa ühendust ühegi kolmest teenusest (ajapiiri viga)
- Application on `Synced Healthy`

Vihje: kui `/health` läheb `DOWN`-iks, puudub reegel just selle teenuse jaoks, mille nimi on vastuses.

??? success "Lahendus"
    `traefik-app01`-s on `namespaceSelector` ja `podSelector` sama loendielemendi sees, seega kehtivad need koos (AND). Kaks eraldi elementi (`- namespaceSelector` ja `- podSelector`) lubaksid kogu `kube-system`-i ja lisaks kõik sinu namespace'i Traefiku label'iga pod'id. Kubelet'i probe'id tulevad node'i aadressilt ja k3s-i NetworkPolicy kontroller neid ei blokeeri.

    ```yaml
    apiVersion: networking.k8s.io/v1
    kind: NetworkPolicy
    metadata:
      name: vaikimisi-kinni
    spec:
      podSelector: {}
      policyTypes: [Ingress]
    ---
    apiVersion: networking.k8s.io/v1
    kind: NetworkPolicy
    metadata:
      name: traefik-app01
    spec:
      podSelector:
        matchLabels: {app: app01}
      policyTypes: [Ingress]
      ingress:
        - from:
            - namespaceSelector:
                matchLabels: {kubernetes.io/metadata.name: kube-system}
              podSelector:
                matchLabels: {app.kubernetes.io/name: traefik}
          ports:
            - {protocol: TCP, port: 8080}
    ---
    apiVersion: networking.k8s.io/v1
    kind: NetworkPolicy
    metadata:
      name: app01-taustale
    spec:
      podSelector:
        matchExpressions:
          - {key: app, operator: In, values: [mc01, rmq01]}
      policyTypes: [Ingress]
      ingress:
        - from:
            - podSelector:
                matchLabels: {app: app01}
          ports:
            - {protocol: TCP, port: 11211}
            - {protocol: TCP, port: 5672}
    ```

    ```bash
    kubectl apply -f k07-k8s/16-netpol-vaikimisi.yaml
    curl -s -H 'Host: labori-seis-<github>.lab.hkhk.ee' http://k3s.lab.hkhk.ee/health; echo
    kubectl run nc --rm -i --image=busybox:1.37 --restart=Never -- \
      sh -c 'for t in mc01:11211 rmq01:5672 app01:8080; do nc -zv -w 3 ${t%:*} ${t#*:} 2>&1 | tail -1; done'
    ```

    Kontroll: `/health` annab `{"status":"UP","db":"UP","queue":"UP","cache":"UP"}` ja kolm `nc` rida lõpevad ajapiiri veaga. Pordid kehtivad `app01-taustale`-s mõlemale valitud pod'ile, nii et app01 pääseks ka mc01 pordile 5672; seal keegi ei kuula. Täpsem variant on kaks poliitikat, üks teenuse kohta. Worker (lisaülesanne 10), smoke test (lisaülesanne 9) ja varukoopia (lisaülesanne 14) vajavad nüüd igaüks oma reeglit.

    **Miks nii.** Vaikimisi kõike keelavat poliitikat on lihtne kirjutada, kuid raske olemasolevale süsteemile hiljem lisada, sest iga unustatud ühendus lakkab töötamast. Seetõttu on kontrollpunkt see, mida laboris nägid: `/health` peab jääma `UP`-iks pärast iga uut poliitikat.

### 13. Helm: sama chart, kaks keskkonda

**Tase:** keskmine · **Eeldus:** [Helm alused](lab-6-helm.md) · **Esita:** `k07-k8s/helm/values-podinfo-test.yaml`

Sama rakendus peab töötama testis ja toodangus eri seadetega ning keegi peab enne uuendust nägema, mida see muudab. Helmi osas oli üks values-fail, siin teed teise ja võrdled renderdatud tulemust.

1. Tee `k07-k8s/helm/values-podinfo-test.yaml`: `replicaCount: 1`, teine `ui.message` ja väiksemad `resources`.
2. Renderda mõlemad values-failid samast chart'ist (`$C`, `--version 6.15.0`, nagu Helmi osas) ja võrdle.
3. Võrdle sama values-faili renderdust versiooniga 6.15.0 ja chart'i järgmise versiooniga (`helm show chart`).
4. Commit'i mõlemad values-failid main'i.

**Kontroll:**

```bash
diff <(helm template podinfo $C --version 6.15.0 -f $V) <(helm template podinfo $C --version 6.15.0 -f k07-k8s/helm/values-podinfo-test.yaml)
```

**Valmis, kui:**

- issue's on kummagi diff'i kohta, mis muutus ainult keskkonna tõttu ja mis ainult chart'i versiooni tõttu
- mõlemad values-failid on main'il
- `helm template` renderdab test-failiga ilma veata

??? success "Lahendus"
    Test-failis on ainult see, mis erineb. Mida failis pole (siin `ui.color`), tuleb chart'i vaikeväärtusest, seega näitab esimene diff ka värvi. OCI-registry'st `helm search repo` ei otsi; uusima versiooni annab `helm show chart` ilma `--version`-ita.

    ```yaml
    # k07-k8s/helm/values-podinfo-test.yaml
    replicaCount: 1
    ui:
      message: "Labori seis: test"
    resources:
      requests:
        cpu: 5m
        memory: 16Mi
      limits:
        memory: 32Mi
    ```

    ```bash
    C=oci://ghcr.io/stefanprodan/charts/podinfo; V=k07-k8s/helm/values-podinfo.yaml; T=k07-k8s/helm/values-podinfo-test.yaml
    diff <(helm template podinfo $C --version 6.15.0 -f $V) <(helm template podinfo $C --version 6.15.0 -f $T)
    UUS=$(helm show chart $C | awk '/^version:/{print $2}'); echo "$UUS"
    diff <(helm template podinfo $C --version 6.15.0 -f $V) <(helm template podinfo $C --version "$UUS" -f $V)
    ```

    Kontroll: esimeses diff'is on ainult `PODINFO_UI_MESSAGE`, `PODINFO_UI_COLOR` ja `resources` read. Teises on `helm.sh/chart: podinfo-…` label'id, image'i tag ja chart'i enda muudatused, sinu väärtused samad. Kui `$UUS` on `6.15.0`, on teine diff tühi: võrdle siis eelmise versiooniga. Kontrollimata: millised read muutuvad konkreetses uuemas chart'i versioonis.

    **Miks nii.** Chart'i versiooni uuendamine on eraldi otsus just seetõttu, et diff näitab selle mõju enne paigaldust. Kui keskkondade erinevus on ainult väikeses values-failis, on see ka lihtne üle vaadata.

### 14. Andmebaasi varukoopia ja taastamise proov

**Tase:** keskmine · **Eeldus:** [Labori seis klastris](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-2-labori-seis-klastris) · **Esita:** `k07-k8s/50-backup.yaml`

PVC hoiab andmeid üle pod'i vahetuse, aga mitte üle vale `DELETE`-i ega kustutatud PVC. Teed CronJob'i, mis teeb db01-st dump'i, ja kontrollid, et sellest saab andmed tagasi.

1. Kirjuta `k07-k8s/50-backup.yaml`: PVC `db01-backup` (100Mi) ja CronJob `db01-backup`, ajakava iga tund.
2. Töö: image `mariadb:11.4`, `mariadb-dump` baasist `labseis` kasutajana `labseis` faili `/backup/labseis-$(date +%H).sql`; parool Secret'ist `labori-seis`, `resources` ja `concurrencyPolicy: Forbid`.
3. Lisa db01 NetworkPolicy'sse teine `from`-reegel label'ile `app: db01-backup` ja pane see label CronJob'i template'ile.
4. Käivita töö kohe: `kubectl create job --from=cronjob/db01-backup proov-1`
5. Kustuta tabelist `lab` rida `lab-07`, taasta see dump'ist ajutise pod'iga, mis mount'ib sama PVC, ja kontrolli `SELECT`-iga.

**Kontroll:**

```bash
kubectl wait --for=condition=complete job/proov-1 --timeout=2m
kubectl logs job/proov-1
kubectl get cronjob db01-backup
```

**Valmis, kui:**

- CronJob on Gitis ja Application on `Synced`
- `proov-1` on `Complete` ja logi viimane rida on `-- Dump completed on …`
- pärast taastamist annab `SELECT code FROM lab WHERE code='lab-07'` rea `lab-07`
- issue's on vastus: miks varukoopia samal node'il samas klastris ei kaitse node'i kadumise eest

??? success "Lahendus"
    Parool läheb `MYSQL_PWD` keskkonnamuutujasse, mitte `-p`-ga käsureale, kus `ps` seda näeks. Dump kirjutatakse ajutisse faili ja nimetatakse ümber alles õnnestumisel: pooleli jäänud töö ei kirjuta eelmist head koopiat üle. `--single-transaction` annab InnoDB tabelitest järjekindla hetktõmmise ilma lukkudeta. PVC on `WaitForFirstConsumer`, nii et Argo näitab Application'it `Progressing`, kuni esimene töö PVC kasutusele võtab.

    ```yaml
    apiVersion: v1
    kind: PersistentVolumeClaim
    metadata:
      name: db01-backup
    spec:
      accessModes: [ReadWriteOnce]
      resources:
        requests:
          storage: 100Mi
    ---
    apiVersion: batch/v1
    kind: CronJob
    metadata:
      name: db01-backup
    spec:
      schedule: "17 * * * *"
      concurrencyPolicy: Forbid
      successfulJobsHistoryLimit: 2
      failedJobsHistoryLimit: 2
      jobTemplate:
        spec:
          backoffLimit: 1
          activeDeadlineSeconds: 600
          template:
            metadata:
              labels: {app: db01-backup}
            spec:
              restartPolicy: Never
              containers:
                - name: dump
                  image: mariadb:11.4
                  command: ["bash", "-c"]
                  args:
                    - |
                      set -euo pipefail
                      f=/backup/labseis-$(date +%H).sql
                      mariadb-dump -h db01 -ulabseis --single-transaction labseis > "$f.tmp"
                      mv "$f.tmp" "$f"
                      ls -l "$f"; tail -1 "$f"
                  env:
                    - name: MYSQL_PWD
                      valueFrom:
                        secretKeyRef: {name: labori-seis, key: DB_PASSWORD}
                  resources:
                    requests: {cpu: 20m, memory: 64Mi}
                    limits: {memory: 256Mi}
                  volumeMounts:
                    - {name: backup, mountPath: /backup}
              volumes:
                - name: backup
                  persistentVolumeClaim: {claimName: db01-backup}
    ```

    `15-db-netpol.yaml`-is `from` alla `- podSelector: {matchLabels: {app: db01-backup}}`. Taastamine ajutise pod'iga, millel on sama label ja sama PVC:

    ```bash
    sql() { kubectl exec -i deploy/db01 -- sh -c 'MYSQL_PWD="$MARIADB_PASSWORD" mariadb -ulabseis -N labseis'; }
    sql <<< "DELETE FROM lab WHERE code='lab-07';"
    kubectl run restore --rm -i --restart=Never --image=mariadb:11.4 --labels=app=db01-backup --overrides='
    {"spec":{"volumes":[{"name":"b","persistentVolumeClaim":{"claimName":"db01-backup"}}],
     "containers":[{"name":"restore","image":"mariadb:11.4","command":["bash","-c","f=$(ls -t /backup/*.sql | head -1); echo $f; mariadb -h db01 -ulabseis labseis < $f"],
      "env":[{"name":"MYSQL_PWD","valueFrom":{"secretKeyRef":{"name":"labori-seis","key":"DB_PASSWORD"}}}],
      "volumeMounts":[{"name":"b","mountPath":"/backup"}],
      "resources":{"requests":{"cpu":"20m","memory":"64Mi"},"limits":{"memory":"256Mi"}}}]}}'
    sql <<< "SELECT code FROM lab WHERE code='lab-07';"
    ```

    Kontroll: `kubectl logs job/proov-1` viimane rida on `-- Dump completed on …`, `DELETE` järel annab `SELECT` tühja tulemuse ja pärast taastamist `lab-07`. Täielik dump taastab kogu baasi dump'i tegemise hetke olekusse: tulemused, mis tulid pärast dump'i, kaovad. Seepärast tehakse taastamise proov tootmises koopia peal.

    **Miks nii.** Rida kustutada on siin ohutu, sest Labori seisu andmed on taastatavad algandmed.

### 15. Oma klaster: namespace nagu klassis

**Tase:** keskmine · **Eeldus:** [Namespace ja põhiobjektid](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-1-klaster-ja-esimene-deployment), `k3s01` ([Oma klaster](syvenemine.md#osa-1-oma-k3s-klaster))

Uus meeskond vajab klastris oma ala, kus nad saavad vabalt töötada, aga ei saa teisi segada. Teed oma klastris sama, mida koolitaja tegi sinu jaoks: namespace, kvoot, vaikeväärtused ja piiratud õigustega kasutaja.

1. Loo `k3s01`-s namespace `opilane`, ResourceQuota (requests 500m CPU / 1 Gi, 5 pod'i, 0 LoadBalancer'it) ja LimitRange vaikeväärtustega.
2. Loo ServiceAccount `opilane` ja RoleBinding ClusterRole'ile `edit` ainult selles namespace'is.
3. Küsi tema nimel kolme õigust (käsud allpool).
4. Loo `--as=$SA`-ga kuue koopiaga Deployment ja vaata ReplicaSet'i Events'it.
5. Kustuta lõpus namespace.

**Kontroll:**

```bash
SA=system:serviceaccount:opilane:opilane
kubectl --context k3s01 auth can-i create deployments -n opilane --as=$SA
kubectl --context k3s01 auth can-i create namespaces --as=$SA
kubectl --context k3s01 auth can-i create rolebindings -n opilane --as=$SA
```

**Valmis, kui:**

- `can-i` vastab `yes`, `no`, `no`
- kuues pod jääb tegemata ja Events'is on `exceeded quota`
- issue's on selgitus, miks `edit` ei luba RoleBinding'uid

??? success "Lahendus"
    LimitRange'i vaikeväärtused on valitud nii, et kuus pod'i mahuvad CPU ja mälu kvooti (6 × 50m, 6 × 64Mi) ja piiriks saab pod'ide arv: Events näitab siis üheselt `pods=5`. ClusterRole `edit` ei sisalda `roles` ja `rolebindings` kirjutamist, sest nendega saaks kasutaja oma õigusi laiendada; `admin` sisaldab.

    ```yaml
    apiVersion: v1
    kind: Namespace
    metadata:
      name: opilane
    ---
    apiVersion: v1
    kind: ResourceQuota
    metadata:
      name: opilane
      namespace: opilane
    spec:
      hard:
        requests.cpu: 500m
        requests.memory: 1Gi
        pods: "5"
        services.loadbalancers: "0"
    ---
    apiVersion: v1
    kind: LimitRange
    metadata:
      name: opilane
      namespace: opilane
    spec:
      limits:
        - type: Container
          defaultRequest: {cpu: 50m, memory: 64Mi}
          default: {memory: 128Mi}
    ---
    apiVersion: v1
    kind: ServiceAccount
    metadata:
      name: opilane
      namespace: opilane
    ---
    apiVersion: rbac.authorization.k8s.io/v1
    kind: RoleBinding
    metadata:
      name: opilane-edit
      namespace: opilane
    subjects:
      - kind: ServiceAccount
        name: opilane
        namespace: opilane
    roleRef:
      apiGroup: rbac.authorization.k8s.io
      kind: ClusterRole
      name: edit
    ```

    ```bash
    kubectl --context k3s01 apply -f ~/k07-katse/opilane.yaml
    kubectl --context k3s01 -n opilane --as=$SA create deployment kuus --image=nginx:1.30-alpine --replicas=6
    kubectl --context k3s01 -n opilane get deploy kuus                      # READY 5/6
    kubectl --context k3s01 -n opilane describe rs -l app=kuus | grep 'exceeded quota' | tail -1
    kubectl --context k3s01 delete namespace opilane
    ```

    Kontroll: `can-i` annab `yes`, `no`, `no`, Deployment jääb `5/6` ja Events'is on `exceeded quota: opilane, requested: pods=1, used: pods=5, limited: pods=5`.

    **Miks nii.** `--as` võimaldab administraatoril esitada API serverile päringu teise kasutaja nimel, ilma selle kasutaja tunnuseid teadmata. Nii testitakse õigusi enne, kui uus kasutaja neid vajab. Kui `can-i create rolebindings` vastaks `yes`, saaks kasutaja endale anda `admin`-rolli ja kogu eraldatus oleks näiline.

### 16. Oma app01 klastri node'iks

**Tase:** keskmine · **Eeldus:** app01 tulemüür lubab TCP 10250 ja UDP 8472, agendi token koolitajalt

Jagatud klastris soovib meeskond hoida oma workload'e eraldi node'il, et naabri koormus seda ei segaks. Liidad oma app01 klassi klastriga ja suunad sinna pod'i taint'i ja `nodeSelector`-iga.

1. Käivita app01-l k3s agent. Kõigi õppijate VM-id on nimega `app01` ja klaster lükkab sama nimega teise node'i tagasi, seepärast on node'i nimes sinu GitHubi nimi:

    ```bash
    curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.35.9+k3s1 K3S_URL=https://k3s.lab.hkhk.ee:6443 \
      K3S_TOKEN=<agent-token> sh -s - agent --node-name app01-<github> \
      --node-label owner=<github> --node-taint owner=<github>:NoSchedule
    ```

2. Loo pod `minu-node`, mis paigutatakse ainult sinu node'ile.
3. Lõpus käivita `sudo /usr/local/bin/k3s-agent-uninstall.sh` ja teata koolitajale, et node tuleb klastrist kustutada.

**Kontroll:**

```bash
kubectl get nodes --show-labels | grep owner=<github>
kubectl get pod minu-node -o wide
```

**Valmis, kui:**

- `kubectl get nodes -l owner=<github>` näitab `app01-<github>` olekus `Ready`
- `kubectl get pod minu-node -o wide` veerus `NODE` on `app01-<github>`
- issue's on kirjas, miks pod ilma toleration'ita sinna ei läheks ja miks teiste pod'id sinna ei lähe
- lõpus on agent eemaldatud ja koolitaja teavitatud

??? success "Lahendus"
    `nodeSelector` ilma toleration'ita jätab pod'i `Pending`-uks (`untolerated taint`), toleration ilma `nodeSelector`-ita lubab pod'i sinu node'ile, aga ei sunni sinna. Mõlemat on vaja.

    ```yaml
    apiVersion: v1
    kind: Pod
    metadata:
      name: minu-node
    spec:
      nodeSelector: {owner: <github>}
      tolerations:
        - {key: owner, operator: Equal, value: <github>, effect: NoSchedule}
      containers:
        - name: web
          image: nginx:1.30-alpine
          resources:
            requests: {cpu: 10m, memory: 16Mi}
    ```

    ```bash
    kubectl get nodes -l owner=<github>                                  # app01-<github> Ready
    kubectl describe node app01-<github> | grep Taints                   # owner=<github>:NoSchedule
    kubectl apply -f ~/k07-katse/minu-node.yaml && kubectl get pod minu-node -o wide
    kubectl delete pod minu-node
    ```

    Kontroll: `NODE` veerus on `app01-<github>`. Kui node jääb `NotReady`, vaata app01-l `journalctl -u k3s-agent -n 50`: `Node password rejected` tähendab, et sama nimega node on klastris olemas, ajapiiri vead pordil 6443 või 10250 tähendavad tulemüüri.

    **Miks nii.** Node'i liitumiseks on vaja ainult API serveri aadressi ja tokenit, seetõttu on agendi token sama tundlik kui admin-fail: kellel on agendi token, saab lisada klastrisse oma node'i ja suunata sinna pod'e.

### 17. SLO ja error budget Labori seisule

**Tase:** keskmine · **Eeldus:** [Labori seis klastris](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-2-labori-seis-klastris) · **Esita:** `NOTES.md`

"Rolling update on ilma katkestuseta" ja "andmebaasi restart on lühike" on seni tunne. Mõõdad Labori seisule SLI: `/health` päringute osakaal, mis said control node'ilt Ingress'i kaudu koodi 200 alla 0,5 s. SLO on 99,9% 30 päeva aknas.

1. Kirjuta `~/k07-katse/sli.sh`: iga 2 s järel päring `-H 'Host: labori-seis-<github>.lab.hkhk.ee' http://k3s.lab.hkhk.ee/health`, rida `<epoch> <HTTP kood> <aeg sekundites>`, ajapiir 2 s, ebaõnnestunud päring on ka rida.
2. Käivita see taustal 450 päringuks (umbes 16 min) faili `~/k07-katse/sli.log`.
3. Umbes 3. minutil tee `kubectl rollout restart deploy/app01` ja oota `rollout status`; umbes 8. minutil `kubectl delete pod -l app=db01`.
4. Kirjuta `~/k07-katse/slo.sh`, mis väljastab: päringuid kokku, häid ja halbu, SLI protsentides, halva aja sekundites, 30 päeva eelarve sekundites ja kulutatud osa, burn rate mõõdetud aknas.
5. Kirjuta `NOTES.md`-sse 3–4 lauset: mis eelarvet kulutas ja mitu protsenti kuu eelarvest, kas burn rate oleks tunni- ja viieminutilise aknaga alerdi käivitanud ja kas sama sündmus kaks korda nädalas mahub 99,9% SLO sisse.

**Kontroll:**

```bash
wc -l < ~/k07-katse/sli.log
bash ~/k07-katse/slo.sh ~/k07-katse/sli.log
awk '$2 != 200' ~/k07-katse/sli.log
```

**Valmis, kui:**

- logis on vähemalt 440 rida
- `slo.sh` väljastab SLI alla 100%
- halvad read on ainult db01 kustutamise ümber
- `NOTES.md`-s on vastused 5. sammu küsimustele

??? success "Lahendus"
    Halva aja arvutamiseks ei piisa halbade ridade arvust, sest päring koos `sleep`-iga võtab üle 2 s. Samm tuleb logi esimese ja viimase aja vahest. Eelarve on 30 × 24 × 3600 × 0,1% = 2592 s ja burn rate on (100 − SLI) / (100 − SLO).

    ```bash
    #!/usr/bin/env bash
    # sli.sh: GITHUB_USER=<github> bash sli.sh 450 > ~/k07-katse/sli.log &
    set -euo pipefail
    host="labori-seis-${GITHUB_USER:?pane GITHUB_USER}.lab.hkhk.ee"
    n="${1:-450}"
    for ((i = 0; i < n; i++)); do
      r=$(curl -s -o /dev/null -m 2 -w '%{http_code} %{time_total}' -H "Host: $host" http://k3s.lab.hkhk.ee/health || true)
      echo "$(date +%s) ${r:-000 2.000}"
      sleep 2
    done
    ```

    ```bash
    #!/usr/bin/env bash
    # slo.sh: bash slo.sh <logi> [SLO, vaikimisi 99.9]
    set -euo pipefail
    log="${1:?logifail puudu}"
    slo="${2:-99.9}"
    awk -v slo="$slo" '
      NR == 1 { first = $1 }
      { last = $1; n++; if ($2 == 200 && $3 < 0.5) ok++ }
      END {
        if (n < 2) { print "liiga vähe ridu" > "/dev/stderr"; exit 1 }
        step = (last - first) / (n - 1); bad = n - ok
        sli = 100 * ok / n; budget = 30 * 24 * 3600 * (100 - slo) / 100
        printf "päringuid %d, häid %d, halbu %d\n", n, ok, bad
        printf "SLI %.2f%%\n", sli
        printf "halb aeg umbes %.0f s (samm %.1f s)\n", bad * step, step
        printf "30 päeva eelarve SLO %s%% juures %.0f s, sellest kulus %.1f%%\n", slo, budget, 100 * bad * step / budget
        printf "burn rate mõõdetud aknas %.1f\n", (100 - sli) / (100 - slo)
      }' "$log"
    ```

    Kontroll: `bash ~/k07-katse/slo.sh ~/k07-katse/sli.log` väljastab viis rida. Tüüpiliselt annab db01 kadu 15–40 s 503-sid, mis on 1–2% kuu eelarvest, aga 16 minuti aknas on burn rate 20–50: lühike aken üksi oleks valvaja üles ajanud, tunniaken mitte. Kui rolling update'i ajal tuli 502, saatis Traefik päringu lõpetavale pod'ile. Parandus on `preStop` `sleep 5` ja sellest pikem `terminationGracePeriodSeconds`.

    **Miks nii.** Argo CD `rollout restart`-i tagasi ei keera, sest annotatsiooni `restartedAt` Giti manifestis pole.

### Lisaprojekt: klastri health check ühe käsuga

**Tase:** keskmine · **Eeldus:** [Esitamine](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#too-esitamine), Application `Synced Healthy`, `shellcheck` control node'is · **Esita:** `k07-k8s/tervis.sh`

Labori seisu kontrollisid seni käsitsi: Deployment'id, Endpoints, curl Ingress'i kaudu, Argo olek ja `kubectl diff`. Kirjutad sellest skripti, mis teeb kõik kuus kontrolli korraga ja annab väljumiskoodiga teada, mitu neist ebaõnnestus.

1. `k07-k8s/tervis.sh <github>` teeb tabeli L7.5 kontrollid tabeli järjekorras.
2. Skript ainult loeb ega väljasta ühtegi Secret'i väärtust.
3. Kontrolli väljund on `jsonpath`-ist, mitte `grep`-ist.
4. Väljumiskood on mitteläbinud kontrollide arv; `kubectl diff` kood 1 ja kood >1 annavad eri sõnumi.
5. Käivita skript, kui kõik töötab, seejärel tekita rike (näiteks `kubectl scale deploy/mc01 --replicas=0`, selfHeal väljas) ja käivita uuesti.
6. Taasta olek Gitist ja commit'i skript.

| Kontroll | OK, kui | FAIL-i sõnum ütleb |
|---|---|---|
| context'i namespace | on `is-<github>` | milline namespace on |
| db01, mc01, rmq01, app01 | `readyReplicas` = `replicas` | mitu on valmis ja mis käsuga edasi vaadata |
| app01 Endpoints | vähemalt üks IP | et app01 pole Ready |
| `/health` Ingress'i kaudu | HTTP 200 ja `"status":"UP"` | HTTP koodi ja mida 404/503 tähendab |
| Application `labori-seis` | `Synced Healthy` | tegelikku olekut |
| `kubectl diff -f k07-k8s/` | kood 0 | kas klaster erineb (1) või käsk ebaõnnestus (>1) |

*Tabel L7.5. Health check'i nõuded.*

**Kontroll:**

```bash
shellcheck -S warning k07-k8s/tervis.sh
bash k07-k8s/tervis.sh <github>; echo "kood $?"
for t in files kubeconform objects hygiene; do bash autograde/check.sh k07 $t; done
```

**Valmis, kui:**

- `shellcheck` ei leia vigu
- kui kõik töötab, on väljundis kuus `OK`-d ja `kood 0`
- rikke ajal on vähemalt üks `FAIL` õige põhjusega ja kood võrdub `FAIL`-ide arvuga
- automaatse hindaja neli testi annavad endiselt `OK`

??? success "Lahendus"
    `set -e` on teadlikult väljas: skript peab pärast esimest FAIL-i edasi kontrollima ja lõpus kõik kokku lugema. Iga `kubectl` käsu viga püütakse kinni ja muudetakse FAIL-iks, mitte skripti katkestuseks. `read … < <(… || echo "- -")` annab puuduva Deployment'i korral loetava väärtuse.

    ```bash
    #!/usr/bin/env bash
    # Labori seisu seis ühe käsuga. Ainult loeb (get, diff, curl), Secret'i väärtusi ei väljasta.
    # Kasutus: bash k07-k8s/tervis.sh <github>     Väljumiskood = mitteläbinud kontrollide arv.
    set -uo pipefail

    gh_user="${1:?kasutus: tervis.sh <github>}"
    here=$(cd "$(dirname "$0")" && pwd)
    host="labori-seis-${gh_user}.lab.hkhk.ee"
    ingress="${K07_INGRESS:-http://k3s.lab.hkhk.ee}"
    fails=0

    ok()   { printf 'OK    %s\n' "$1"; }
    fail() { printf 'FAIL  %s: %s\n' "$1" "$2"; fails=$((fails + 1)); }

    ns=$(kubectl config view --minify -o jsonpath='{.contexts[0].context.namespace}' 2>/dev/null)
    if [[ "$ns" == "is-${gh_user}" ]]; then ok "context namespace $ns"
    else fail "context namespace" "'${ns:-puudub}', oodatud is-${gh_user}"; fi

    for d in db01 mc01 rmq01 app01; do
        read -r want ready < <(kubectl get deploy "$d" -o jsonpath='{.spec.replicas} {.status.readyReplicas}' 2>/dev/null || echo "- -")
        if [[ "$want" != "-" && "${ready:-0}" == "$want" ]]; then ok "deploy/$d ${ready}/${want}"
        else fail "deploy/$d" "valmis ${ready:-0}/${want} (kubectl describe deploy $d)"; fi
    done

    eps=$(kubectl get endpoints app01 -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null)
    if [[ -n "$eps" ]]; then ok "endpoints app01: $eps"
    else fail "endpoints app01" "tühi: app01 pole Ready"; fi

    body=$(curl -s -m 10 -w '\n%{http_code}' -H "Host: $host" "$ingress/health" 2>/dev/null)
    code=${body##*$'\n'}
    if [[ "$code" == "200" && "$body" == *'"status":"UP"'* ]]; then ok "Ingress $host /health 200 UP"
    else fail "Ingress $host /health" "HTTP ${code:-000} (404 = Ingress, 503 = endpoints)"; fi

    st=$(kubectl get application labori-seis -o jsonpath='{.status.sync.status} {.status.health.status}' 2>/dev/null)
    if [[ "$st" == "Synced Healthy" ]]; then ok "Argo CD labori-seis $st"
    else fail "Argo CD labori-seis" "'${st:-Application puudub}'"; fi

    kubectl diff -f "$here/" > /dev/null 2>&1
    rc=$?
    case $rc in
        0) ok "kubectl diff tühi" ;;
        1) fail "kubectl diff" "klaster erineb failidest (kubectl diff -f $here/)" ;;
        *) fail "kubectl diff" "käsk ebaõnnestus, kood $rc" ;;
    esac

    echo "---"
    echo "mitteläbinud: $fails"
    exit "$fails"
    ```

    Kontroll: kui kõik töötab, on väljundis kuus `OK` rida ja `kood 0`. `kubectl scale deploy/mc01 --replicas=0` (selfHeal väljas) muudab ka `spec.replicas`-it, nii et Deployment'i kontroll jääb `OK`-ks ja rikke tabavad Argo olek (`OutOfSync`) ja `kubectl diff` (kood 1): kokku `kood 2`. `/health` jääb `UP`-iks, sest vahemälu puudumisel ei muutu üldolek. Just sellepärast on skriptis drift'i kontroll: Deployment'i olekust üksi ei selgu, et keegi muutis soovitud olekut ennast.

    **Miks nii.** Tabeli järjekord on sama, mida kasutasid nelja rikke otsimisel: kõigepealt kas oled õiges kohas, siis kas pod'id on valmis, siis kas kasutaja jõuab nendeni, ja lõpuks kas klaster vastab Gitile.

    `kubectl diff` tagastab 0, kui erinevust pole, 1, kui on, ja suurema koodi, kui käsk ise ebaõnnestus. Kui skript kontrolliks ainult, kas kood on 0, ei eristaks skript drift'i ühenduse veast. Skript asub kaustas `k07-k8s/`, kuid automaatse hindaja kontrollid seda ei arvesta, sest need vaatavad ainult `*.yaml`-faile; Argo CD jätab skripti samal põhjusel vahele. Sama ülesehitusega on koolitaja skript `k07-verify.sh`, mis käivitab need kontrollid kõigis namespace'ides korraga. Tootmises kuulub selline kontroll monitooringusse: sama loogika Prometheuse reeglina saadab häire enne, kui kasutajad probleemi märkavad.

## Rasked ülesanded

### 18. Andmebaasi parooli rotatsioon ilma katkestuseta

**Tase:** raske · **Eeldus:** [Labori seis klastris](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-2-labori-seis-klastris), [GitOps Argo CD-ga](syvenemine.md#osa-4-gitops-lahemalt)

app01 andmebaasi parool on lekkinud ja see tuleb vahetada tööajal nii, et kasutaja katkestust ei näe. `ALTER USER` koos Secret'i muutmisega tekitab akna, kus osa pod'e kasutab vana ja osa uut parooli. MariaDB 11.4 ei toeta MySQL 8 kahte kehtivat parooli (`RETAIN CURRENT PASSWORD`), app01 loeb Secret'i keskkonnamuutujana ainult käivitusel, db01 `MARIADB_USER`/`MARIADB_PASSWORD` mõjuvad ainult tühja andmekausta korral ja rakendus loeb kasutajanime muutujast `DB_USER` (vaikimisi `labseis`).

- `/health` Ingress'i kaudu vastab kogu töö ajal 200; logi seda iga 2 s järel faili `~/k07-katse/rotatsioon.log`
- db01 pod'i ei taaskäivitata
- uus parool ei satu Giti, shelli ajalukku ega käsurea argumentidesse
- kuni vana kasutaja pole lukus, on rollback üks `git revert`; pärast lukustamist üks SQL-lause
- enne tegelikku vahetust näitad, et vale parool uues seadistuses ei tekita katkestust: uus pod jääb 0/1 ja vana teenindab edasi

**Kontroll:**

```bash
grep -vc ' 200$' ~/k07-katse/rotatsioon.log
kubectl exec deploy/app01 -- printenv DB_USER
kubectl exec deploy/db01 -- sh -c 'MYSQL_PWD="$MARIADB_PASSWORD" mariadb -h127.0.0.1 -ulabseis -e "SELECT 1"'
kubectl get pod -l app=db01 -o custom-columns=NIMI:.metadata.name,RESTARTS:.status.containerStatuses[0].restartCount
git log -p | grep -cFf <(kubectl get secret <uus-secret> -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)
```

**Valmis, kui:**

- `grep -vc` annab `0`
- app01 `DB_USER` on uus kasutaja ja vana kasutaja annab `ERROR 4151: account is locked`
- db01 pod'i nimi ja RESTARTS on samad mis alguses
- `git log -p` ei sisalda uut parooli (`0`)
- issue's on kirjas, kes veel logib sisse vana kasutajaga (näiteks ülesande 14 varukoopia) ja mis juhtub pärast db01 PVC kadu

??? tip "Lahenduse suund"
    Ära vaheta ühe kasutaja parooli, vaid tee teine kasutaja ja teine, muutumatu Secret (näiteks `labori-seis-db-v2` võtmetega `DB_USER` ja `DB_PASSWORD`). Siis muuda Gitis app01 `env`-is `DB_USER` ja `DB_PASSWORD` viitama uuele Secret'ile. Pod template'i muutus on tavaline rolling update: uus pod saab Ready alles siis, kui `/health` näeb andmebaasi uue kasutajaga, ja `maxUnavailable: 0` hoiab vana pod'i seni teenindamas. Vana Secret ja vana kasutaja on alles, seega rollback on `git revert`.

    Tööriistad: SQL `kubectl exec -i deploy/db01` stdin'i kaudu, root'i parool konteineri enda `$MARIADB_ROOT_PASSWORD`-ist; `CREATE USER IF NOT EXISTS` + `ALTER USER … IDENTIFIED BY`, et teine käivitus annaks sama tulemuse; õigused `SELECT, INSERT, UPDATE, DELETE ON labseis.*` (rakendus DDL-i ei tee); parool `openssl rand -hex 24` ja Secret `kubectl create secret generic … --from-env-file=<(printf …)`-ga, nii et väärtus ei ole argv-s. Vale parooli proov: eraldi Secret vale parooliga, commit, `kubectl rollout status --timeout=2m` aegub, logis ainult 200, `git revert`.

    Lõpus kontrolli enne lukustamist, et ükski app01 pod ei viita enam vanale Secret'ile (`kubectl get pods -l app=app01 -o jsonpath` `secretKeyRef.name` peale) ja et vanal kasutajal pole avatud ühendusi (`information_schema.PROCESSLIST`). Siis `ALTER USER 'labseis'@'%' ACCOUNT LOCK`: lukk on `ACCOUNT UNLOCK`-iga tagasi võetav, `DROP USER` mitte, seega kustuta alles järgmisel päeval.

    Tüüpilised lõksud: `kubectl edit secret labori-seis` ei muuda töötavaid pod'e, aga iga vahepealne restart (liveness, node'i hooldus) võtab uue parooli vana kasutajanimega ja jääb 0/1. db01 init loob pärast PVC kadu jälle vana kasutaja; db01 template'i muutmine on `Recreate` ehk andmebaasi katkestus, nii et see läheb hooldusaknasse või runbook'i ("pärast PVC taastamist käivita rotatsiooniskript uuesti", sellepärast peab skript olema idempotentne). Lukk ei katkesta avatud ühendusi: Hikari hoiab neid kuni `maxLifetime`-ni (vaikimisi 30 min).

### 19. Deploy heakskiiduga: CI teeb PR-i

**Tase:** raske · **Eeldus:** [GitOps Argo CD-ga](syvenemine.md#osa-4-gitops-lahemalt), org'is on lubatud "Allow GitHub Actions to create and approve pull requests" · **Esita:** `.github/workflows/gitops.yml`

Tootmises ei tohi iga roheline build kohe klastrisse minna: keegi peab selle heaks kiitma ja Argo CD ei muuda klastrit enne, kui sina boti PR-i merge'id. Tööl tuleb mitu push'i järjest ja `ci` jooksud lõpevad suvalises järjekorras. Siis on avatud mitu boti PR-i ja vanema merge pärast uuemat viib klastrisse vanema image'i.

- `gitops.yml` push'ib haru `gitops/${SHA::7}` ja loob sellest PR-i (`gh pr create`); sammul `GH_TOKEN: ${{ github.token }}`, job'il `pull-requests: write`
- workflow ei kirjuta main'i kunagi ise
- avatud on kõige rohkem üks boti PR: uus PR sulgeb vanemad kommentaariga, mis viitab uuele
- vanema `ci` jooksu hiline lõpp ei ava PR-i, kui main'il või avatud boti PR-is on juba uuem commit (`gitops` logis on põhjus)
- sama SHA uus jooks (Re-run) ei tee teist PR-i
- `actionlint` ja `bash autograde/check.sh k07 cibump` jäävad roheliseks

**Kontroll:**

```bash
gh pr list --state open --json headRefName --jq '[.[] | select(.headRefName | startswith("gitops/"))] | length'
gh pr list --state closed --json headRefName,comments --jq '.[] | select(.headRefName | startswith("gitops/"))'
git log --first-parent origin/main --format='%an' | sort -u
curl -s -H 'Host: labori-seis-<github>.lab.hkhk.ee' http://k3s.lab.hkhk.ee/version; echo
```

**Valmis, kui:**

- kahe eraldi minuti jooksul push'itud koodimuudatuse järel on avatud boti PR-e 1
- vanem PR on suletud kommentaariga, mis viitab uuele
- pärast merge'i näitab `/version` uuema PR-i SHA-d
- `--first-parent` autorite seas pole `github-actions[bot]`-i
- `actionlint` ja `bash autograde/check.sh k07 cibump` on rohelised

??? tip "Lahenduse suund"
    Haru nimi tuleb SHA-st, nii et sama SHA teine jooks kirjutab sama haru üle (`git push --force`, haru kuulub botile) ja leiab olemasoleva PR-i (`gh pr list --head <haru>` enne `gh pr create`-i). Vanemate sulgemine käib pärast oma PR-i loomist: `gh pr list --json number,headRefName --jq` valib avatud `gitops/*` PR-id peale enda ja `gh pr close --delete-branch --comment` sulgeb need. Järjekorra kaitseks laienda olemasolevat `git merge-base --is-ancestor` kontrolli: võrdle oma SHA-d nii main'i manifesti kui ka iga avatud boti PR-i haru nimest võetud SHA-ga. `concurrency: gitops-bump` jääb, see hoiab jooksud üksteise järel, aga järjekorda ei taga.

    Õigused: job'il `contents: write` ja `pull-requests: write`, `GH_TOKEN` keskkonnas ja `workflow_run.html_url` keskkonnamuutujana, mitte `${{ }}` otse `run:`-i sees.

    Lõksud: `GITHUB_TOKEN`-iga loodud PR ei käivita `pull_request`-workflow'sid, nii et kui main'i branch protection nõuab status check'e, ei saa boti PR-i kunagi merge'ida. Lahendus on ruleset ilma nõutud check'ideta `gitops/*` harudele või PR GitHub App'i tokeniga. Tühi commit ei sobi proovimiseks: `gitops` loeb seda "ainult `k07-k8s/` muutus" juhtumiks. Squash merge viib `[skip ci]` main'i commit'i sõnumisse ja `ci` jääb käivitamata.

    **Miks nii.** PR-i mudelis jääb Argo CD samaks, muutub ainult see, kes või mis lisab main'i commit'e. Heakskiit on nüüd GitHubi ülevaatus ja seda saab siduda branch protection'iga: näiteks nõue, et iga boti PR vajab ühe inimese kinnitust. Hind on aeglus: iga deploy ootab inimest.

### 20. Skeemimuudatus enne rollout'i: Argo CD hook ja sync wave

**Tase:** raske · **Eeldus:** [GitOps Argo CD-ga](syvenemine.md#osa-4-gitops-lahemalt)

Järgmine app01 versioon kirjutab tabelisse `result` veergu `duration_ms`. Kui uus pod käivitub enne skeemimuudatust, ebaõnnestuvad tema päringud; kui skeemimuudatus ebaõnnestub, ei tohi uus versioon klastrisse minna. Käsitsi runbook'is on see samm "enne deploy'd käivita migratsioon", GitOps'is sync'ib Argo CD commit'i ise ja seda sammu ei tee keegi.

- migratsioon on `k07-k8s/` all Gitis ja käivitub iga sync'iga, ka boti tag'i commit'i järel; teine käivitus ei muuda skeemi ega ebaõnnestu
- muudatus on tagasiühilduv: töötav vana app01 versioon töötab uue skeemiga edasi
- töötab ka tühjas namespace'is, kus db01-te veel pole
- ebaõnnestunud migratsioon peatab sync'i enne app01 Deployment'i: Deployment ei muutu ja `/health` jääb 200-ks
- migratsiooni pod ei satu app01 Service'i Endpoints'i ja NetworkPolicy lubab talle ainult db01 pordi 3306
- rikke proov: commit, kus SQL viitab olematule tabelile ja app01 Deployment'i `kubernetes.io/change-cause` muutub samas commit'is; seejärel `git revert`

**Kontroll:**

```bash
kubectl get application labori-seis -o jsonpath='{range .status.operationState.syncResult.resources[?(@.kind=="Job")]}{.name} {.hookPhase}{"\n"}{end}'
kubectl exec deploy/db01 -- sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot -N labseis -e "SHOW COLUMNS FROM result LIKE \"duration_ms\""'
kubectl get endpoints app01 -o jsonpath='{.subsets[*].addresses[*].targetRef.name}'; echo
kubectl get application labori-seis -o jsonpath='{.status.operationState.phase}'; echo
```

**Valmis, kui:**

- Job'i `hookPhase` on `Succeeded` ja `SHOW COLUMNS` annab ühe rea
- Endpoints'is on ainult `app01-…` pod'id
- rikke proovi järel on `operationState.phase` `Failed`, `change-cause` klastris vana ja kasutaja vaade kogu aja 200
- `git revert` järel on sync jälle `Succeeded`
- `kubeconform`, `objects` ja `hygiene` on rohelised

Vihje: järjekorra annavad [hook](https://argo-cd.readthedocs.io/en/stable/user-guide/resource_hooks/) ja [sync wave](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/) annotatsioonid.

??? tip "Lahenduse suund"
    Job on `Sync`-hook lainel 1, app01 Deployment saab annotatsiooni `argocd.argoproj.io/sync-wave: "2"` ja kõik muu jääb lainele 0. Argo sync'ib laine 0 (sh db01), ootab, kuni db01 Deployment on Healthy, käivitab Job'i, ootab selle lõppu ja alles siis sync'ib app01. Ebaõnnestunud Job peatab sync'i ja laine 2 jääb sync'imata. `hook-delete-policy: BeforeHookCreation` jätab viimase Job'i logide jaoks alles ja kustutab selle järgmise sync'i alguses; `HookSucceeded` kustutaks selle kohe.

    Job'i sees: `mariadb:11.4` image (on node'idel olemas), `mariadb-admin ping`-iga ootamise tsükkel, SQL `ALTER TABLE … ADD COLUMN IF NOT EXISTS … NULL` (MariaDB laiendus, teeb muudatuse idempotentseks), `backoffLimit` ja `activeDeadlineSeconds` väikesed. Pod'il oma label (`app: db-migrate`) ja db01 NetworkPolicy's teine `from`-element. Laboris on DDL-i jaoks root'i parool Secret'ist; tootmises on selleks eraldi kasutaja.

    Lõksud: `PreSync` käib enne kõiki Sync-faasi objekte, tühjas namespace'is pole siis db01-te ja Job ootab ajapiirini. Label `app: app01` Job'il paneks pod'i Service'i Endpoints'i: Job'il pole readiness probe'i, Running tähendab Ready ja Traefik saadaks päringu pod'ile, mis 8080-l ei kuula. SQL ConfigMap'is jõuab PreSync'i ajal kohale eelmise commit'i versioon. `kubectl apply -f k07-k8s/` käsitsi loob Job'i tavalise objektina ja teine apply muudetud SQL-iga annab `field is immutable`. Automaatne sync ei korda ebaõnnestunud revisjoni: pärast parandust on vaja uut commit'i. Veeru kustutamine (contract) ei käi kunagi samas väljalaskes kui lisamine.

    **Miks nii.** Hook (`argocd.argoproj.io/hook`) on ressurss, mille Argo CD loob sync'i kindlas faasis (`PreSync`, `Sync`, `PostSync`) ja mille lõppemist ta ootab, enne kui jätkab. Sync wave (`argocd.argoproj.io/sync-wave`) on täisarv, mille järgi Argo CD sync'ib sama faasi ressursse kasvavas järjekorras ja ootab iga laine Healthy olekut.

### 21. Saladus Gitis: Sealed Secrets ja võtme taaste

**Tase:** raske · **Eeldus:** [Oma klaster](syvenemine.md#osa-1-oma-k3s-klaster) `k3s01` töötab · **Esita:** `k07-k8s/sealed/labori-seis.yaml`

Secret `labori-seis` lõid käsitsi ja Gitis seda pole: Gitist uuesti üles tulnud klastris jääb app01 `CreateContainerConfigError`-isse. [Sealed Secrets](https://github.com/bitnami/sealed-secrets) laseb Gitis hoida krüpteeritud `SealedSecret`-i, millest ainult klastris olev kontroller teeb Secret'i; klassi klastrisse kontrollerit paigaldada ei saa, seepärast teed selle k3s01-l.

- kontroller töötab namespace'is `kube-system` nimega `sealed-secrets-controller` ja chart'i versioon on kirjas ning kinnitatud (`--version`)
- Labori seisu neli võtit (`DB_PASSWORD`, `RABBITMQ_PASSWORD`, `TEACHER_TOKEN`, `MARIADB_ROOT_PASSWORD`) on failis `k07-k8s/sealed/labori-seis.yaml` kujul `SealedSecret`; kausta `sealed/` Argo CD ja automaatne hindaja ei loe
- parool ei satu Giti, faili ega argv-sse; `k03-docker/.env` on ainus allikas
- strict scope: sama `SealedSecret` teise namespace'i viiduna ei anna Secret'it ja põhjus on näha
- privaatvõti on varundatud control node'ile väljaspool Giti (`~/.config/is1/`, õigused `600`)
- taasteproov: k3s eemaldatud (`sudo /usr/local/bin/k3s-uninstall.sh`) ja uuesti paigaldatud, võtme taastamine, ja **sama** fail Gitist annab jälle Secret'i ilma uuesti krüpteerimata

**Kontroll** (uues klastris pärast taastet):

```bash
K="kubectl --context k3s01"
$K get sealedsecret labori-seis -o jsonpath='{.status.conditions[0].type}={.status.conditions[0].status}'; echo
$K get secret labori-seis -o jsonpath='{.data}' | tr ',' '\n' | cut -d: -f1
git log --format=%h -- k07-k8s/sealed/labori-seis.yaml | wc -l
git log -p | grep -cF "$(grep '^DB_PASSWORD=' k03-docker/.env | cut -d= -f2-)"
stat -c '%a' ~/.config/is1/sealed-secrets-keys.yaml
```

**Valmis, kui:**

- `SealedSecret` on `Synced=True` ja Secret'is on neli võtit
- faili ajaloos on üks commit (faili ei krüpteeritud uuesti)
- `git log -p` ei sisalda parooli (`0`) ja võtmefaili õigused on `600`
- issue's on kirjas, kus sinu organisatsioonis privaatvõti elaks (Vault, HSM, seif), kes tohib seda taastada ja mis juhtub Gitis olevate saladustega võtme lekke korral

??? tip "Lahenduse suund"
    Paigaldus Helmiga repo'st `https://bitnami.github.io/sealed-secrets`, chart `sealed-secrets/sealed-secrets` ja `fullnameOverride=sealed-secrets-controller`. Chart'i vaikenimi on `sealed-secrets` ja siis vajab iga `kubeseal` lippu `--controller-name`. `kubeseal --fetch-cert` toob avaliku võtme; selle saab Giti panna ja krüpteerida ka ilma klastrita (`kubeseal --cert`).

    Krüpteerimine ühe pipe'iga: `kubectl create secret generic labori-seis --dry-run=client -o yaml --from-env-file=<(printf …)` → `kubeseal --format yaml`. `printf` on shelli sisseehitatud käsk ja `<(…)` on process substitution, nii et väärtused ei ole üheski argv-s ega failis. `--from-literal="$(…)"` paneks parooli `kubectl` protsessi argumentidesse. Namespace tuleb context'ist ja strict scope seob selle koos nimega krüpteeritud andmetesse: teise namespace'i viidud objekt annab Events'is `ErrUnsealFailed` ja `no key could decrypt secret`.

    Varundus: privaatvõtmed on `kube-system`-is Secret'id label'iga `sealedsecrets.bitnami.com/sealed-secrets-key`. Kontroller teeb [vaikimisi iga 30 päeva järel uue võtme](https://github.com/bitnami/sealed-secrets#secret-rotation) ja vanad jäävad alles, seega varunda label'i järgi kõik, mitte ühte nime, ja korda varundust pärast iga uut võtit. Taaste: `kubectl apply` varundatud võtmed uude klastrisse ja kontrolleri pod uuesti käivitada (võtmed loetakse käivitusel). Kui kontroller jõudis enne taastet käivituda, tegi ta oma uue võtme; see ei sega, sest dekrüpteerimisel proovitakse kõiki võtmeid.

    Lõksud: `k3s-uninstall.sh` enne varundust kaotab võtme jäädavalt ja kõik `SealedSecret`-id tuleb uuesti krüpteerida. Uue võtme tegemine ei ole saladuse rotatsioon: lekkinud võtmega saab vanu commit'e Gitist ikka lahti teha, seega lekke korral vaheta paroolid ise (vt [lisaülesanne 18](#18-andmebaasi-parooli-rotatsioon-ilma-katkestuseta)). `kubeseal --re-encrypt` krüpteerib olemasoleva faili uusima võtmega, aga vana commit jääb Gitis vana võtmega. Argo CD sync'ib `SealedSecret`-i nagu iga teise objekti. Secret'i loob kontroller ja annab sellele `ownerReferences`-i `SealedSecret`-ile, nii et Argo CD näitab Secret'it ressursipuus, aga ei võrdle selle sisu Gitiga, ja `SealedSecret`-i prune kustutab garbage collector'i kaudu ka Secret'i. Alternatiiv on SOPS koos age-võtmega: krüpteeritud on ainult väärtused, võtit hoiab Argo CD repo-server ja klastris pole eraldi kontrollerit; võtme varunduse küsimus jääb samaks.

    **Miks nii.** Sealed Secrets kasutab asümmeetrilist krüptot: `kubeseal` krüpteerib Secret'i kontrolleri avaliku võtmega objektiks `SealedSecret`, mis võib Gitis olla, ja ainult klastris olev kontroller teeb sellest privaatvõtmega tavalise Secret'i. Selle hind on uus üksik rikkekoht: privaatvõti on ainult klastris ja klastriga koos kaob ligipääs kõigile Gitis olevatele saladustele.

### Lisaprojekt: podinfo Gitist Argo CD kaudu

**Tase:** raske · **Eeldus:** [GitOps Argo CD-ga](syvenemine.md#osa-4-gitops-lahemalt): `k07-k8s/helm/values-podinfo.yaml` on main'il, `labori-seis` on `Synced Healthy`, `helm list` on tühi, kvoodis on ruumi ühele pod'ile · **Esita:** `k07-k8s/argocd/podinfo.yaml`

Käsurealt paigaldatud podinfo ei ole Gitis ja Argo CD seda ei halda, Labori seisu haldab aga juba Argo CD. Ühendad need: chart ja values-fail on Gitis ning podinfo paigaldab ja hoiab Argo CD, mitte `helm install`.

1. Tõmba chart repo'sse:

    ```bash
    helm pull oci://ghcr.io/stefanprodan/charts/podinfo --version 6.15.0 --untar --untardir k07-k8s/helm
    ```

2. Kirjuta `k07-k8s/argocd/podinfo.yaml`: teine Application, mis paigaldab chart'i sinu values-failiga ja vastab tabelile L7.4.
3. Commit'i, push'i ja saada Application klastrisse `kubectl apply -f`-iga.
4. Muuda values-failis `ui.message`, commit'i ja vaata, kuidas uus teade klastrisse jõuab.

| Nõue | Kuidas näed |
|---|---|
| Application `podinfo`, project `is-<github>`, destination sinu namespace | `kubectl get application podinfo` |
| `source.path: k07-k8s/helm/podinfo` ja `helm.valueFiles: [../values-podinfo.yaml]` | `argocd app get is-<github>/podinfo` → parameetrid |
| `automated` koos `prune` ja `selfHeal`-iga | `kubectl scale deploy podinfo --replicas=2` tühistatakse |
| fail on `argocd/` all, mitte `k07-k8s/` ülemisel tasemel | `bash autograde/check.sh k07 kubeconform` jääb roheliseks |
| values'i muudatus jõuab klastrisse ilma `helm upgrade`-ita | curl näitab uut teadet |

*Tabel L7.4. Lisaprojekti nõuded.*

**Kontroll:**

```bash
kubectl get application podinfo -o jsonpath='{.status.sync.status} {.status.health.status}'; echo
helm list
kubectl get deploy podinfo -o jsonpath='{.metadata.labels.app\.kubernetes\.io/managed-by}'; echo
kubectl port-forward svc/podinfo 9898:9898 & sleep 2; curl -s localhost:9898 | grep message; kill %1
for t in files kubeconform hygiene gitops; do bash autograde/check.sh k07 $t; done
```

**Valmis, kui:**

- Application on `Synced Healthy`
- `helm list` on tühi
- curl näitab viimati commit'itud teadet
- neli automaatse hindaja testi annavad `OK`

Vihje: kui `helm list` näitab veel podinfot, tee enne `helm uninstall podinfo`.

??? tip "Lahenduse suund"
    Application on sama kujuga kui `labori-seis`: `project`, `destination` ja `syncPolicy` samad, `source.path` osutab chart'i kaustale ja `source.helm` all on `releaseName: podinfo` ning `valueFiles`. Fail on `argocd/` alamkaustas, nii et ei `kubectl apply -f k07-k8s/` ega `labori-seis` Application seda klastrisse ei vii: teed sellele ühe korra käsitsi `kubectl apply`, edasi muudad ainult Giti.

    Lõksud: `valueFiles` tee on `source.path`-i suhtes, mitte repo juure suhtes, ja fail peab olema samas repos. Kui `helm install`-iga tehtud release on alles, haldavad samu objekte kaks tööriista ja järgmine `helm upgrade` kirjutab Argo rakendatud oleku üle. Kui sync annab `exceeded quota`, on namespace'is mõni katse-pod alles.

    **Miks nii.** Argo CD repo-server käivitab `helm template` ja sync'ib tulemuse nagu tavalised manifestid. Helmi release'i Secret'it ei teki, seetõttu ei näe `helm list` ega `helm history` midagi ja rollback tehakse käsuga `git revert` nagu Labori seisu puhul. Label `app.kubernetes.io/managed-by: Helm` on siiski olemas, sest selle kirjutab chart'i template, mitte Helmi programm.

    Chart on repo sees, sest koolitaja AppProject lubab allikana ainult sinu repot; tootmises viidatakse tavaliselt chart'i registry'le ja hoitakse Gitis ainult values-faile (Argo CD multi-source). Repo sisse kopeeritud chart'il on üks eelis: chart'i uuendus on samuti commit ja diff, mida saad enne merge'i läbi vaadata.

## Võrguinsenerile

### 22. vorgukogu CronJob'ina

**Tase:** keskmine · **Eeldus:** 1. kohtumise lisaülesanne 21, image `vorgukogu:1` ([3. kohtumise lisaülesanne 15](https://hkhk-tk.github.io/is2-automatiseerimine/k03/lisa/)), `rtr01` ja `rtr02`, `k3s01` enne `tofu destroy`-d · **Esita:** `vorgukogu/k8s/vorgukogu.yaml`

Öine kogumine Jenkinsis sõltub agendist: kui control node on maas, jääb kogumine vahele. Klastris käivitab sama image'i CronJob ja Kubernetes hoolitseb, et samal ajal töötab üks jooks ja ebaõnnestunud jooks on näha. Töö käib k3s01-l namespace'is `vorgukogu`, sest koolitaja klaster sinu võrku ei näe.

- image tuleb k3s01-le ilma registry'ta: `docker save` → `k3s ctr images import`, pod'is `imagePullPolicy: Never`
- SSH võti on Secret `vorgukogu-ssh`, mitte manifestis ega image'is; volume'ina ainult loetav
- väljund läheb PVC-le `vorgukogu-out` (local-path), mitte pod'i ajutisse kausta
- CronJob: kord öösel ajavööndis `Europe/Tallinn`, `concurrencyPolicy: Forbid`, ajalugu 3 õnnestunud ja 3 ebaõnnestunud Job'i, Job'il `backoffLimit: 0` ja ajapiir
- pod töötab kasutajana 10001, ilma privileegide tõusuta, kõik võimed ära ja kirjutuskaitstud juurfailisüsteemiga (`/tmp` on `emptyDir`)
- Job ilma ootamata (`kubectl create job --from=cronjob/…`) annab mõlemale ruuterile `OK`

**Kontroll:**

```bash
K="kubectl --context k3s01"
docker save vorgukogu:1 | ssh kasutaja@<IS1_NET>.23 sudo k3s ctr images import -
$K apply -f ~/labori-seis/vorgukogu/k8s/vorgukogu.yaml
$K -n vorgukogu create secret generic vorgukogu-ssh --from-file=rtr_key=$HOME/.ssh/id_ed25519_labseis
$K -n vorgukogu create job --from=cronjob/vorgukogu proov-1
$K -n vorgukogu wait --for=condition=complete job/proov-1 --timeout=120s && $K -n vorgukogu logs job/proov-1
ssh kasutaja@<IS1_NET>.23 'sudo find /var/lib/rancher/k3s/storage -path "*vorgukogu-out*" -type f' | sort
$K -n vorgukogu get cronjob vorgukogu -o jsonpath='{.spec.schedule} {.spec.timeZone}{"\n"}'
```

**Valmis, kui:**

- Job `proov-1` on `Complete` ja logis on `OK` mõlemale ruuterile
- PVC kaustas on 6 faili
- `get cronjob` näitab ajakava ja ajavööndit
- peatatud rtr02 korral on `proov-2` `Failed`, logis `FAIL rtr02` ja PVC-s on rtr01 failid uuemad; pane rtr02 tagasi käima

Vihje: kõik katse objektid eemaldab `kubectl --context k3s01 delete namespace vorgukogu`.

??? success "Lahendus"
    k3s kasutab containerd'i, mitte Dockerit: `k3s ctr images import` paneb image'i node'i containerd'i ja `imagePullPolicy: Never` keelab registry'st tõmbamise, nii et vale nimega image annab kohe `ErrImageNeverPull`, mitte vaikse tõmbamiskatse. Secret'i volume'i fail on `0440` ja grupp on `fsGroup` 10001, seepärast saab mitte-root protsess võtit lugeda. `backoffLimit: 0`: kood 2 tähendab, et osa ruutereid kogutigi; kordus kogub need uuesti ja peidab rikke. `concurrencyPolicy: Forbid` jätab uue jooksu vahele, kui eelmine veel käib. local-path PVC on node'i kaust: andmed kaovad koos k3s01-ga, nagu Oma klastri lehel nägid. Tootmises viiks väljundi Giti (6. kohtumise `varunda.sh` sama image'i teise konteinerina) või objektisalvestusse.

    ```yaml
    # vorgukogu Kubernetese CronJob'ina oma klastris k3s01 (sinu võrgus, jõuab ruuteriteni).
    # SSH võti Secret'ina: kubectl -n vorgukogu create secret generic vorgukogu-ssh \
    #   --from-file=rtr_key=$HOME/.ssh/id_ed25519_labseis
    apiVersion: v1
    kind: Namespace
    metadata:
      name: vorgukogu
    ---
    apiVersion: v1
    kind: PersistentVolumeClaim
    metadata:
      name: vorgukogu-out
      namespace: vorgukogu
    spec:
      accessModes: [ReadWriteOnce]
      storageClassName: local-path
      resources:
        requests:
          storage: 100Mi
    ---
    apiVersion: batch/v1
    kind: CronJob
    metadata:
      name: vorgukogu
      namespace: vorgukogu
    spec:
      schedule: "17 2 * * *"
      timeZone: Europe/Tallinn
      concurrencyPolicy: Forbid          # eelmine jooks käib veel: uut ei alustata
      startingDeadlineSeconds: 3600      # node oli maas: hiljem kui tund pärast ajakava ei käivitu
      successfulJobsHistoryLimit: 3
      failedJobsHistoryLimit: 3
      jobTemplate:
        spec:
          backoffLimit: 0                # kood 2 (üks ruuter maas) jääb nähtavaks, mitte ei korrata
          activeDeadlineSeconds: 300
          template:
            spec:
              restartPolicy: Never
              securityContext:
                runAsNonRoot: true
                runAsUser: 10001
                runAsGroup: 10001
                fsGroup: 10001
                seccompProfile: {type: RuntimeDefault}
              containers:
                - name: vorgukogu
                  image: vorgukogu:1
                  imagePullPolicy: Never  # image on node'ile imporditud (k3s ctr images import)
                  env:
                    - {name: VORK_USER, value: kasutaja}
                    - {name: VORK_KEY_FILE, value: /run/secrets/rtr/rtr_key}
                  resources:
                    requests: {cpu: 50m, memory: 64Mi}
                    limits: {memory: 128Mi}
                  securityContext:
                    allowPrivilegeEscalation: false
                    readOnlyRootFilesystem: true
                    capabilities: {drop: [ALL]}
                  volumeMounts:
                    - {name: out, mountPath: /app/out}
                    - {name: ssh, mountPath: /run/secrets/rtr, readOnly: true}
                    - {name: tmp, mountPath: /tmp}
              volumes:
                - name: out
                  persistentVolumeClaim: {claimName: vorgukogu-out}
                - name: ssh
                  secret: {secretName: vorgukogu-ssh, defaultMode: 0440}
                - name: tmp
                  emptyDir: {sizeLimit: 16Mi}
    ```

    Kontroll: nõuete all olevad käsud; `$K -n vorgukogu get jobs` näitab `proov-1` `1/1`. Kui pod jääb `CreateContainerConfigError`-isse, puudub Secret; `ErrImageNeverPull` tähendab, et import läks teise nimega (`ssh kasutaja@<IS1_NET>.23 sudo k3s ctr images ls | grep vorgukogu`). Täislahendus: `labori-seis/deploy/lisa-lahendused/k07/vork-cronjob/`. Kontrollitud: `kubeconform -strict` Kubernetes 1.35 skeemidega. Kontrollimata: käivitus k3s01-l.

## Arutelu

Vastused lähevad `NOTES.md`-sse. Enamikku saad kontrollida ühe katsega oma klastris või namespace'is.

1. **Namespace ja põhiobjektid.** `kubectl scale --replicas=3` teeb sama ühe käsuga. Miks on parem muuta faili? Mida teeks sellega Argo CD selfHeal?
2. **Ressursid.** app01-l on `limits.memory: 640Mi` ja `MaxRAMPercentage=60`. Mis juhtub, kui paned limiidiks 256Mi: kas näed `OOMKilled`-i või Java `OutOfMemoryError`-it, ja miks on vahe oluline?
3. **Helm.** `helm rollback` ja `git revert` võtavad mõlemad muudatuse tagasi. Kumba usaldad tootmises ja miks ei tohiks Argo CD hallatud release'il kasutada `helm upgrade`-i?
4. **GitOps.** Paljudes näidetes on Application'il `finalizers: [resources-finalizer.argocd.argoproj.io]` ja `CreateNamespace=true`, meil kumbagi pole. Mis juhtuks `kubectl delete application labori-seis` järel kummalgi juhul ja mis juhtuks lisaülesande 14 varukoopiaga?
5. **GitOps.** Katkise YAML-i korral ei muutnud Argo CD klastris midagi. Kas eelistaksid tööriista, mis sync'ib kõik korrektsed failid ja jätab vigase vahele? Mis võiks siis valesti minna?

## Kodutöö

Kodutöö viib sama Labori seisu AWS-i EC2-le: kui samad manifestid töötavad seal, on sinu failid keskkonnast sõltumatud. Kumbki rida on oma issue ja AWS-i töö lõpus kustutad EC2 ja kõik sellega seotud ressursid.

| Issue | Mis | Juhend |
|---|---|---|
| `K7.K` | AWS: k3s EC2-l, samad manifestid, rolling update ja koristus | [`kodutood/k07-aws.md`](../kodutood/k07-aws.md) |
| `K7.M` | Monitooring: probe'id, restartid ja `kubectl top` | [`kodutood/monitooring.md`](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/monitooring/#7-kohtumine-kubernetes-valvab-ise) → 7. kohtumine |
