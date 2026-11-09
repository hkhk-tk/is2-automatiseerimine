---
tags:
  - AWS
  - Kubernetes
  - k3s
---

# 7. kohtumise kodutöö · k3s EC2-l, samad manifestid

**Eeldus:** IS1 [7. kohtumise praktikum](https://hkhk-tk.github.io/is1-automatiseerimine/k07/lab/) (`k07-k8s/` manifestid ilma namespace'ita, Secret luuakse käsuga, Ingress Traefikuga), [süvenemise osa 3](../k07/syvenemine.md#osa-3-labori-seis-lahemalt) (rolling update ja rollback), [1. kohtumise kodutöö](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/k01-aws/) · **Esita:** `cloud/k07-aws/user-data.sh`

Praktikumis paigaldasid `k07-k8s/` koolitaja klastrisse oma namespace'i, kus sul olid kitsad õigused. Kodutöös on klaster sinu oma,
see töötab ühes EC2 masinas ja sina oled cluster-admin. Manifestid jäävad samaks, muutuvad ainult keskkonnast sõltuvad osad.

**Enne alustamist:**

- Käsk `aws configure get region` väljastab `eu-north-1`. Üks t3.small masin ja avalik IPv4-aadress maksavad umbes $0.10 tunnis. EKS-i ei looda.
- Eelarvehäired (zero spend, $10) on alles.
- `aws sts get-caller-identity` väljundis lõpeb Arn kujul `:user/…`, mitte `:root`.
- Lõpus kustutad ressursid ja PAT-i ning käivitad `bash cloud/aws-leftovers.sh`.
- Reeglid ja ühine veaotsing: [AWS-i reeglid](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/aws-reeglid/).

## Õpiväljundid

1. Paigaldab ühe node'iga k3s-klastri EC2-le ja haldab seda control node'ist.
2. Paigaldab samad manifestid muutmata ja eristab keskkonnast sõltuvad osad (namespace, Secret, pull secret, Ingressi host).
3. Teeb rolling update'i ja rollback'i teises klastris.

---

## Osa 1 · Klaster

Loo EC2 masin nagu 1. kohtumise kodutöös: Ubuntu 24.04, **t3.small** (2 GB), silt `Name=k3s-k07`. Luba turvagrupis pordid 22 ja 6443 oma IP-aadressilt ning port 80 kõigile.

User-data (`cloud/k07-aws/user-data.sh`) paigaldab k3s-i [ametliku paigaldusskriptiga](https://docs.k3s.io/quick-start). Lisa
`INSTALL_K3S_EXEC` valik [`--tls-san <avalik IP>`](https://docs.k3s.io/cli/server), muidu ei klapi API sertifikaat,
kui control node'ist ühendud. Avaliku IP-aadressi saad user-data skriptis metaandmete teenusest
([IMDSv2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html): kõigepealt
token `PUT /latest/api/token`, siis `GET /latest/meta-data/public-ipv4`).

**Oodatav tulemus:** `ssh ubuntu@<ip> sudo k3s kubectl get nodes` näitab olekut `Ready`.
**Kui node jääb olekusse `NotReady` või pod'id mälu tõttu olekusse `Pending`:** t3.micro (1 GB) on liiga väike. Kontrolli `free -m`.

??? info "Miks nii"
    k3s, mitte EKS: EKS-i control plane maksab $0.10/h ehk ~$73 kuus ka ilma ühegi node'ita, lisaks node'id ja
    tavaliselt NAT ning load balancer. Kodutöö õpiväljund (samad manifestid teises klastris) ei vaja hallatud control
    plane'i.

### 1.1 kubeconfig control node'ile

Kopeeri `/etc/rancher/k3s/k3s.yaml` control node'i faili `~/.kube/k3s-aws.yaml` ja asenda selles `127.0.0.1` avaliku IP-aadressiga.

```bash
export KUBECONFIG=~/.kube/k3s-aws.yaml
kubectl get nodes
```

**Miks eraldi fail:** klassi kubeconfig (koolitaja klaster, sinu namespace) jääb puutumata. `KUBECONFIG` määrab, millist
klastrit käsud kasutavad. Selles failis on **admin**-õigustega võti: määra failile õigused `chmod 600` ja ära lisa seda Giti (`.gitignore`: `k3s.yaml`, `kubeconfig*`).

**Mõtle:** klassis andis koolitaja sulle namespace'i ja kitsad õigused. Siin oled cluster-admin. Mida see muudab
selles, kuidas sa järgmise sammu teed?

## Osa 2 · Sama kood, uus keskkond

Praktikumi klastris oli namespace määratud kubeconfig'is. Siin lood selle ise ja määrad kontekstile vaikimisi namespace'iks:

```bash
kubectl create namespace labseis
kubectl config set-context --current --namespace labseis
```

Keskkonnast sõltuvad osad, mida manifestides **ei ole**:

| Mis | Praktikumis | Kodutöös |
|---|---|---|
| namespace | kubeconfig'is | `set-context --namespace` |
| Secret (paroolid) | `kubectl create secret` | sama käsk |
| image pull | klassi register või avalik image | ghcr pakett on privaatne, vaja on pull secret'it |
| Ingressi host | `labori-seis-<github>.lab.hkhk.ee` | `labori-seis.<avalik-ip>.sslip.io` ([sslip.io](https://sslip.io/)) |

*Tabel 1. Erinevused praktikumi klastri ja EC2 k3s-i vahel.*

[Pull secret ServiceAccount'ile](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/#add-imagepullsecrets-to-a-service-account),
ilma manifeste muutmata:

```bash
kubectl create secret docker-registry ghcr --docker-server=ghcr.io \
    --docker-username=<github> --docker-password=<PAT, õigus read:packages>
kubectl patch serviceaccount default -p '{"imagePullSecrets":[{"name":"ghcr"}]}'
```

Seejärel käivita `kubectl apply -f k07-k8s/` ja muuda Ingressi hosti käsuga `kubectl patch ingress …` (või kustomize overlay'ga kaustas `cloud/k07-aws/`, kui tahad muudatust Gitis hoida).

**Oodatav tulemus:** `kubectl get pods` näitab kõiki pod'e olekus `Running` ja brauseris avaneb aadressil `http://labori-seis.<ip>.sslip.io/` Labori seis.
**Tõend:** `kubectl get all` väljund ja brauseri kuvatõmmis.

**Kui pod on olekus `ImagePullBackOff`:** kui `kubectl describe pod` näitab `401 Unauthorized`, puudub pull secret või PAT-il pole õigust `read:packages`.
**Kui Traefik annab vea 404:** Ingressi host ei klapi brauseris kasutatud aadressiga. Käsk `kubectl get ingress` näitab hosti.

**Mõtle:** tabelis on neli asja, mis praktikumis ja pilves erinevad. IS2 kursusel lisandub kolmas keskkond. Kuhu paneksid need neli
väärtust, et `k07-k8s/` jääks ühiseks? (Vihje: kustomize overlay, Helm values.)

## Osa 3 · Rolling update ja rollback

1. Muuda image'it: `kubectl set image deployment/app01 labori-seis=<uus tag>` (näiteks 5. kohtumise kodutöö SHA tag või uus tag).
2. Jälgi uuendust käsuga `kubectl rollout status deployment/app01` ja vaata brauseris `/version`.
3. Määra meelega vigane tag (`:olematu`). Vaata `kubectl get pods` ja `rollout status` väljundit.
4. Võta muudatus tagasi käsuga `kubectl rollout undo deployment/app01` ja vaata ajalugu käsuga `kubectl rollout history deployment/app01`.

**Oodatav tulemus:** vigase sildi ajal teenindab päringuid edasi vana pod (readinessProbe) ja pärast `undo` on kõik pod'id olekus `Running`.
**Miks:** kui replicas on 1, hoiab rolling update vana pod'i alles seni, kuni uus on olekus Ready. Vigase image'iga pod ei jõua kunagi olekusse Ready.
**Tõend:** `rollout history` väljund.

---

## Koristus

```bash
unset KUBECONFIG
aws ec2 terminate-instances --instance-ids <id>
rm ~/.kube/k3s-aws.yaml
bash cloud/aws-leftovers.sh
```

Kustuta GitHubis PAT, mida pull secret kasutas (Settings → Developer settings → Tokens).

## Valmis, kui

- `git diff --stat k07-k8s/` on tühi, keskkonna erinevused on käskudes või kaustas `cloud/k07-aws/`
- `curl -s -o /dev/null -w '%{http_code}' http://labori-seis.<ip>.sslip.io/` andis `200`
- vigase tag'i ajal vastas `/version` edasi ja `kubectl rollout history deployment/app01` näitab `undo` järel uut revisjoni
- `git ls-files | grep -E 'kubeconfig|k3s.yaml'` on tühi ja PAT on GitHubis kustutatud
- `aws-leftovers.sh`: `TULEMUS: tasulisi jääke pole`

## Lisaülesanne

Paigalda Argo CD samasse k3s-klastrisse (`kubectl create namespace argocd` ja ametlik paigaldusmanifest) ning seadista see sünkroniseerima
kausta `k07-k8s/` sinu repositooriumist. t3.small masina mälu jääb kitsaks, seega jälgi `kubectl top nodes` väljundit. Mis juhtub, kui muudad
replicas'e käsitsi `kubectl scale`-iga?

## Veaotsing

Ühised vead (SG port sinu IP-le, sessioon): [AWS-i reeglid](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/aws-reeglid/#veaotsing).

| Probleem | Põhjus | Lahendus |
|---|---|---|
| `x509: certificate is valid for 127.0.0.1, … not <ip>` | `--tls-san` puudus | `/etc/rancher/k3s/config.yaml`-i `tls-san: [<ip>]`, `systemctl restart k3s` |
| `connection refused :6443` | SG-s pole 6443 sinu IP-le | lisa reegel |
| pod'id `Pending`, `Insufficient memory` | t3.small piir | vähenda `resources.requests` overlay'ga või kasuta t3.small asemel kaht masinat (agent join) |
| pärast EC2 taaskäivitamist ei tööta kubeconfig | avalik IP-aadress muutus | uuenda kubeconfig'i (Elastic IP maksab ka siis, kui masin seisab) |
