---
tags:
  - Kubernetes
  - Helm
---

# 6. Helm alused

Tee see osa pärast IS1 praktikumi [2. osa](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/#osa-2-labori-seis-klastris). Labori seis peab sinu namespace'is töötama.

Kui chart paigaldati kellegi käsurealt `--set` väärtustega, ei saa keegi seda paigaldust korrata ega öelda, mis klastris on. Valmis tarkvara (Ingress-kontroller, cert-manager, Prometheus, andmebaasid) tuleb tavaliselt Helmi chart'ina: template'id ja vaikeväärtused, millest Helm teeb sinu `values`-faili järgi manifestid. Adminina paigaldad chart'e sagedamini, kui kirjutad neid, ja vastutad selle eest, mis väärtustega need paigaldati. Paigaldad oma namespace'i väikese rakenduse [podinfo](https://github.com/stefanprodan/podinfo), uuendad seda, võtad uuenduse tagasi ja lased ebaõnnestunud uuendusel end ise tagasi võtta, ning lõpuks on values-fail Gitis ja podinfo eemaldatud.

Töötad main'il. Values-fail läheb kausta `k07-k8s/helm/`, mida Argo CD ja automaatne hindaja ei loe: nad vaatavad ainult `k07-k8s/` ülemist taset.

**Kui teed seda tööl iga päev:** paigaldad chart'e values-failiga ja `helm history`/`helm rollback` on sulle tavalised. Kui see on sul juba korras, tee install ja values-fail valmis ning mine otse etappi „[Ebaõnnestunud upgrade ilma katkestuseta](#ebaonnestunud-upgrade-ilma-katkestuseta)“.

## Helm ja chart'i sisu

Paigaldad Helmi ja vaatad chart'i sisse enne, kui midagi klastrisse saadad. Helm on control node'i programm, klastris temal agenti pole. Chart on OCI-registry's samamoodi nagu image.

Võõrast chart'i ei paigaldata pimesi. Vaikeväärtustes võib olla avalik LoadBalancer, root'ina töötav konteiner või ressursipiiride puudumine. `helm show values` on chart'i dokumentatsioon ja turvaülevaade ühes.

1. Paigalda Helm, kui seda pole ([paigaldusjuhend](https://helm.sh/docs/intro/install/)):

    ```bash
    command -v helm || { curl -fsSL https://get.helm.sh/helm-v4.2.4-linux-amd64.tar.gz | tar xz && sudo install linux-amd64/helm /usr/local/bin/; }
    helm version
    ```

2. Vaata chart'i kirjeldust ja vaikeväärtusi:

    ```bash
    C=oci://ghcr.io/stefanprodan/charts/podinfo
    helm show chart $C --version 6.15.0
    helm show values $C --version 6.15.0 | grep -nE '^(replicaCount|ui|resources|service|ingress):'
    ```

`show chart` näitab chart'i ja rakenduse versiooni eraldi: `version` on template'ide versioon, `appVersion` image'i versioon. Need võivad muutuda eri ajal. Viis võtit `show values` väljundis on need, mida sa selles moodulis muudad või kontrollid.

**Edasi saad minna, kui** `helm version` näitab `v4.2` ja `show values` leiab viis võtit.

## Mida chart teeks: helm template

Renderdad chart'i kohapeal ja vaatad, milliseid objekte see looks. `helm template` ei puuduta klastrit. See on Helmi `--dry-run=client -o yaml`.

Chart võib luua objekte, mida sa ei oodanud: ServiceAccount, HPA, Ingress, mõnikord isegi ClusterRole. Jagatud klastris ebaõnnestuks paigaldus siis õiguste tõttu poolel teel. Kui vaatad enne renderdatud tulemust, tead, mis tuleb.

1. Renderda vaikeväärtustega ja vaata, mis objektid tulevad:

    ```bash
    helm template podinfo $C --version 6.15.0 > /tmp/podinfo.yaml
    grep '^kind:' /tmp/podinfo.yaml
    grep -A4 'resources:' /tmp/podinfo.yaml
    ```

2. Muuda üht väärtust käsurealt ja leia muutus:

    ```bash
    helm template podinfo $C --version 6.15.0 --set replicaCount=2 | grep 'replicas:'
    ```

3. Kontrolli renderdatud faili serveri vastu, ilma midagi loomata:

    ```bash
    kubectl apply -f /tmp/podinfo.yaml --dry-run=server
    ```

Vaikeväärtustega tuleb Deployment ja Service. `--set` muutis ainult ühte rida ja kõik ülejäänu jäi samaks. Serveri dry-run näitas, kas sinu õigused ja kvoot need objektid lubaksid. Kui siin oleks tulnud `Forbidden`, ebaõnnestuks ka `helm install`.

**Edasi saad minna, kui** oskad nimetada objektid, mille chart loob, `--set replicaCount=2` muutis `replicas:` rida ja serveri dry-run vastas iga objekti kohta `(server dry run)`.

## Oma values-fail

Käsurea `--set` ununeb. Väärtused, millega paigaldad, lähevad faili ja Giti. Kirjutad faili ise ja kontrollid renderdamisega, et chart luges su väärtused õigesti.

`helm upgrade` ilma `-f`-i ja `--reuse-values`'ita paneb väärtused tagasi chart'i vaikeväärtustele. Kui eelmine paigaldus tehti `--set`-iga ja keegi seda ei mäleta, kaob seadistus järgmise upgrade'iga vaikselt.

1. Kirjuta `k07-k8s/helm/values-podinfo.yaml` ise:
    - `replicaCount: 1`
    - `ui.message` on `Labori seis: <github>` ja `ui.color` mõni oma värv
    - `resources.requests`: `cpu: 10m`, `memory: 32Mi`
    - `resources.limits.memory: 64Mi`
2. Renderda failiga ja vaata, kas su väärtused jõudsid manifesti:

    ```bash
    V=k07-k8s/helm/values-podinfo.yaml
    helm template podinfo $C --version 6.15.0 -f $V | grep -E 'replicas:|PODINFO_UI_MESSAGE' -A1
    helm template podinfo $C --version 6.15.0 -f $V | grep -A5 'resources:'
    ```

Kui väärtus on values-failis vales kohas, ei anna Helm viga: ta lihtsalt ei kasuta seda. Seepärast kontrollid renderdatud tulemust, mitte faili. Kui `PODINFO_UI_MESSAGE` puudub, on võti vales tasemel.

**Edasi saad minna, kui** renderdatud Deployment'is on `replicas: 1`, sinu teade ja sinu `requests` ning `limits`.

## Paigaldus oma namespace'i

`helm install` saadab renderdatud manifestid API serverile ja salvestab release'i Secret'ina samasse namespace'i. Namespace tuleb kubeconfig'i context'ist nagu kubectl'il.

Release'i Secret'is on kõik väärtused ja renderdatud manifestid, mistõttu rollback'iks pole vaja välist andmebaasi. Secret'i maht on piiratud 1 MiB-ga, seepärast on sisu gzip'itud. Samas tähendab see, et values-faili saladused satuksid samasse Secret'isse ja oleksid nähtavad kõigile, kes tohivad Secret'eid lugeda.

1. Paigalda ja vaata, mis tekkis:

    ```bash
    helm install podinfo $C --version 6.15.0 -f $V
    helm list
    kubectl get deploy,svc,pods -l app.kubernetes.io/instance=podinfo
    kubectl get secret -l owner=helm
    ```

2. Proovi rakendust:

    ```bash
    kubectl rollout status deploy/podinfo
    kubectl port-forward svc/podinfo 9898:9898 &
    curl -s localhost:9898 | grep -E 'hostname|message'
    kill %1
    ```

> Kui näed viga `exceeded quota`, on mõni `~/k07-katse` katsepod alles. Kontrolli seda käskudega `kubectl get pods` ja `kubectl describe resourcequota`.

`helm list` näitab release'i olekut ja revisjoni. Objektidel on label `app.kubernetes.io/instance=podinfo`, millega Helm nad hiljem üles leiab. Curl'i vastuses on `hostname` pod'i nimi ja `message` sinu tekst: rakendus luges väärtuse keskkonnamuutujast, mille chart sinu failist tegi.

**Edasi saad minna, kui** `helm list` näitab `podinfo` olekus `deployed`, revision 1, ja curl näitab sinu teadet.

## Upgrade, history ja rollback

Muudad teadet, uuendad ja võtad uuenduse tagasi. Iga `upgrade` on uus revisjon. `rollback` ei kustuta ajalugu, vaid teeb vanast revisjonist uue, täpselt nagu `kubectl rollout undo`.

Helmi rollback on kiire, aga ta ei tea Gitist midagi. Kui values-fail on Gitis ja keegi teeb `helm rollback`, on klaster ja Git jälle lahus, samamoodi nagu Labori seisus pärast `rollout undo`-d.

1. Muuda teadet ja uuenda:

    ```bash
    helm upgrade podinfo $C --version 6.15.0 -f $V --set ui.message="teine versioon"
    helm history podinfo
    helm get values podinfo
    ```

2. Võta uuendus tagasi ja vaata ajalugu:

    ```bash
    helm rollback podinfo 1
    helm history podinfo
    kubectl get secret -l owner=helm,name=podinfo
    ```

> `helm get values` näitab ainult väärtusi, mis sina andsid. `helm get manifest podinfo` näitab kogu renderdatud tulemust, mis klastrisse läks.

`history` näitab kolme rida ja igaühel on oma Secret. Revisjon 3 on sisult sama mis 1, aga tal on uus number ja kirjeldus `Rollback to 1`. `get values` näitas pärast upgrade'i ka `--set` väärtust: Helm mäletab, kuidas iga revisjon tehti, isegi kui sina ei mäleta.

**Edasi saad minna, kui** `history` näitab kolme revisjoni (install, upgrade, rollback) ja kolmas kirjeldus on `Rollback to 1`.

## Käsitsi muudatus Helmi all

Muudad Helmi paigaldatud objekti kubectl'iga ja vaatad, kas Helm seda märkab. Helm ei jälgi klastrit pidevalt. Ta võrdleb ainult siis, kui sa käsu annad.

See on vahe Helmi ja Argo CD vahel. Helmiga võib klaster nädalaid erineda sellest, mis release'is kirjas, ja keegi ei tea, kuni järgmine upgrade muudatuse kas üle kirjutab või alles jätab. Argo CD märkab sama asja sekunditega.

**Ennusta:** kas Helm märkab käsitsi tehtud muudatust ja taastab selle ise?

1. Muuda koopiate arvu käsitsi ja võrdle release'iga:

    ```bash
    kubectl scale deploy/podinfo --replicas=2
    helm status podinfo | head -6
    helm get manifest podinfo | kubectl diff -f - | grep -E '^[-+] +replicas'
    ```

2. Taasta olek release'i järgi: `helm get manifest podinfo | kubectl apply -f -`, siis `kubectl get deploy podinfo`.

`helm status` ütles ikka `deployed`, kuigi klastris oli kaks koopiat. Helmi jaoks on release korras, sest ta vaatab oma Secret'it, mitte klastrit. `kubectl diff` release'i manifestiga näitas erinevust kohe. Sama mõte, release'i manifest kui tõe allikas, on Argo CD aluseks.

**Edasi saad minna, kui** `helm status` näitas `deployed`, `diff` näitas `- replicas: 2` ja `+ replicas: 1` ning pärast `apply`-d on jälle üks koopia.

## Ebaõnnestunud upgrade ilma katkestuseta

Öise hooldusakna upgrade jääb pooleli: uus pod ei saa Ready'ks ja keegi ei ole ärkvel, et `helm rollback` käivitada. Helm 4 lipp `--rollback-on-failure` (Helm 3-s `--atomic`) ootab, kuni release'i ressursid on valmis, ja ajapiiri ületamisel võtab release'i ise tagasi.

Nõuded:

- upgrade kasutab olematut image'i tag'i (`image.tag`) ja ajapiiri 90 s
- kasutaja vaade on kogu aja `200`: `port-forward` `svc/podinfo`-le ja `curl` iga sekundi järel faili `~/k07-katse/helm-upgrade.log`
- pärast ebaõnnestumist on release jälle `deployed` ja töötab sama image'iga mis enne
- sa ei käivita `helm rollback`-i ega muuda klastrit kubectl'iga

Kontroll:

```bash
helm history podinfo | tail -3                               # failed, siis "Rollback to …" deployed
grep -vc ' 200$' ~/k07-katse/helm-upgrade.log                # 0
kubectl get deploy podinfo -o jsonpath='{.spec.template.spec.containers[0].image}'; echo   # sama tag mis enne
kubectl get rs -l app.kubernetes.io/name=podinfo             # uus ReplicaSet 0 koopiaga
```

> Kui uut pod'i ei teki üldse ja `describe rs` näitab `exceeded quota`, katkestab ajapiir upgrade'i kvoodi, mitte image'i pärast: kustuta katsepod'id ja korda. Helm 4-s ei ole `--atomic`-ut, Helm 3-s puudub `--rollback-on-failure`: `helm version` ütleb, kumb sul on.

Vana pod teenindas kogu aja, sest uus ei saanud kunagi Ready'ks ja Deployment'i rolling update ei kustuta vana enne. Helm seda ei arvesta: see ootab ainult ajapiirini ja märgib siis revisjoni `failed`-iks. Ilma `--rollback-on-failure`-ita jääks release olekusse `failed`, Deployment poolikusse rollout'i ja järgmine `helm upgrade` alustaks sellest olekust. Argo CD all sama lippu ei ole: seal hoiab vana versiooni alles Deployment ise ja rollback on `git revert`.

**Edasi saad minna, kui** `helm history` näitab `failed` revisjoni ja selle järel automaatset `Rollback to …` olekuga `deployed`, logis pole ühtegi muud koodi kui `200` ja image on sama mis enne upgrade'i.

## Koristus ja commit

Eemaldad podinfo ja lükkad values-faili main'i. `helm uninstall` kustutab kõik release'i objektid ja ajaloo. podinfo'l pole andmeid. Andmetega chart'i puhul kehtib: StatefulSet'i `volumeClaimTemplates`-ist loodud PVC-sid `helm uninstall` ei kustuta, chart'i enda PVC kustutatakse, kui sellel pole annotatsiooni `helm.sh/resource-policy: keep`. Values-fail jääb Giti: sellest saab sama paigalduse uuesti teha.

Lisaprojektis paigaldad podinfo uuesti, seekord Argo CD kaudu. Kui `helm uninstall` jääks tegemata, oleks klastris kaks omanikku samale Deployment'ile.

1. Eemalda podinfo ja vaata, et kvoot vabanes:

    ```bash
    helm uninstall podinfo
    kubectl get all -l app.kubernetes.io/instance=podinfo
    kubectl describe resourcequota | grep pods
    ```

2. Lükka values-fail main'i:

    ```bash
    git add k07-k8s/helm/values-podinfo.yaml && git commit -m "K7.6 podinfo values (closes #<nr>)" && git push
    bash autograde/check.sh k07 hygiene
    ```

`get all` ei leidnud midagi ja kvoodi `pods` kasutus vähenes ühe võrra. `hygiene` on ikka `OK`, sest test ei loe alamkausta `helm/`, ja see on õige: values-fail ei ole manifest.

**Edasi saad minna, kui** `get all` ei leia podinfo objekte, values-fail on main'il ja `hygiene` annab endiselt `OK`.

**Selle osa tõend:** issue `K7.6` kommentaaris `grep '^kind:'` väljund `helm template`-ist, `helm list`, `helm history` kolme revisjoniga, `diff` käsitsi muudatusest, ebaõnnestunud upgrade'i `helm history | tail -3` koos `grep -vc` tulemusega 0 ja link values-failile.

## Miks see nii töötab

**Release'i ajalugu.** Helm 4-s salvestatakse release'i ajalugu vaikimisi samas namespace'is olevatesse Secret'itesse nimega `sh.helm.release.v1.<nimi>.v<N>`.

**Väärtuste järjekord.** Väärtused loetakse selles järjekorras: chart'i vaikeväärtused, seejärel `-f`-failid vasakult paremale ja lõpuks `--set`.

**Helm Argo CD all.** Argo CD kasutab chart'i teisiti: Argo CD renderdab selle käsuga `helm template` ja teeb tulemusele ise `apply`. Seetõttu ei näita `helm list` midagi ja rollback tehakse jälle Gitis.

**Saladused values-failis.** Paljudes näidetes on paroolid Helmi failis `values.yaml` lihttekstina ja sama repo on Argo CD allikas. GitOps'i puhul ei tohi nii teha: values-faili kirjutatakse ainult väärtused, mis ei ole saladused. Saladused jõuavad klastrisse muul viisil: käsitsi loodud Secret, External Secrets Operator või krüpteeritud Secret (Sealed Secrets, SOPS).

**Chart'i versioon.** Chart'i versioon on sama oluline kui image'i tag. Ilma võtmeta `--version` kasutab Helm uusimat stabiilset versiooni ja järgmine paigaldus samast values-failist võib anda teistsuguse tulemuse, sest template'id on muutunud. Seetõttu on laboris igal käsul `--version 6.15.0`.

**Chart'i uuendamine.** Chart'i uuendamine on eraldi otsus. `helm template` vana ja uue versiooniga ning nende tulemuste võrdlemine `diff`-iga näitab enne uuendust, mida see klastris muudaks.

Kui jõudsid kiiremini: [Lisaülesanded → 13. Helm: sama chart, kaks keskkonda](lisa.md#13-helm-sama-chart-kaks-keskkonda), teed teise values-faili ja võrdled renderdatud tulemust `diff`-iga.
