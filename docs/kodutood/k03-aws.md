---
tags:
  - AWS
  - ECR
  - Docker
---

# 3. kohtumise kodutöö · image ECR-i, Compose EC2-l

**Eeldus:** 3. kohtumise labor (`k03-docker/`: app/db/web Dockerfile'id, `compose.yaml`, Trivy lokaalselt), [1. kohtumise kodutöö](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/k01-aws/) · **Esita:** `cloud/k03-aws/user-data.sh`

Praktikumis ehitab `docker compose up` kõik image'id samas masinas, kus need töötavad. Teises masinas tähendaks see uut
Maveni ehitust ja võib-olla ka erinevat sisu. Kodutöös ehitad app image'i ühe korra, laadid selle registrisse ja EC2 tõmbab selle
sealt ilma pääsuvõtmeta.

**Enne alustamist:**

- Käsk `aws configure get region` väljastab `eu-north-1`. Üks t3.small masin ja avalik IPv4-aadress maksavad umbes $0.10 tunnis, ECR-i salvestus mõne sendi kuus.
- Eelarvehäired (zero spend, $10) on alles.
- `aws sts get-caller-identity` väljundis lõpeb Arn kujul `:user/…`, mitte `:root`.
- Lõpus kustutad ressursid ja käivitad `bash cloud/aws-leftovers.sh`.
- Reeglid ja ühine veaotsing: [AWS-i reeglid](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/aws-reeglid/).

## Õpiväljundid

1. Loob ECR-i repositooriumi, laadib sinna image'i commit'i sildiga ning võrdleb ECR-i skannimise ja kohaliku Trivy tulemust.
2. Annab EC2-le registry lugemisõiguse IAM rolliga, mitte võtmega.
3. Käivitab sama `compose.yaml` teises masinas, kus app image tuleb registry'st ja seda ei ehitata.

---

## Osa 1 · Registry

```bash
aws ecr create-repository --repository-name labori-seis \
    --image-scanning-configuration scanOnPush=true
```

Lisa lifecycle policy, mis hoiab alles 10 viimast image'it (`aws ecr put-lifecycle-policy`, reegli JSON on
[ECR juhendis](https://docs.aws.amazon.com/AmazonECR/latest/userguide/lifecycle_policy_examples.html)).

**Oodatav tulemus:** `repositoryUri` kujul `<konto>.dkr.ecr.eu-north-1.amazonaws.com/labori-seis`.
**Miks lifecycle:** iga push lisab ~300 MB. Ilma reeglita kasvab salvestusmaht 5. ja 6. kohtumise pipeline'ide tõttu iga commit'iga.

### 1.1 Image'i laadimine käsitsi

Control node'il ([ECR-i push juhend](https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-push-ecr-image.html)):

1. Logi Dockeriga ECR-i sisse: suuna `aws ecr get-login-password` väljund käsule `docker login --username AWS --password-stdin <registri host>`.
2. Ehita app image samamoodi nagu praktikumis ja anna sellele tag `<repositoryUri>:$(git rev-parse --short HEAD)`.
3. Laadi image käsuga `docker push` registrisse.

**Oodatav tulemus:** konsoolis ECR → labori-seis on sildiga image ja mõne minuti pärast ka skannimise tulemus.
**Tõend:** ECR-i skannimise kokkuvõte ja kohaliku `trivy image` tulemus. Kas CRITICAL ja HIGH arvud klapivad? Kui ei, siis miks?

<!-- EKRAANIPILT: AWS konsool, Amazon ECR → Private repositories → labori-seis → image, mille tag on commit'i lühike SHA, vahekaart/vaade "Vulnerabilities" (scan on push lõpetanud). Näha tag, Pushed at ja CRITICAL/HIGH/MEDIUM arvud. Konto ID hägustada.
<figure markdown="span">
  ![ECR repo labori-seis image commit'i sildiga ja skänni haavatavuste kokkuvõte](assets/kKT_k03-ecr-scan.png)
  <figcaption>Joonis 1. Image ECR-is ja selle skänni tulemus.</figcaption>
</figure>
-->

**Kui `docker push` annab vea** `no basic auth credentials`: sisselogimisel ja image'i nimes kasutatud registri host ei klapi
(regioon või konto ID). Host on `repositoryUri` osa enne esimest `/`-i.

**Mõtle:** `get-login-password` token kehtib 12 tundi. Mis juhtub masinaga, mis tõmbab image'i homme hommikul?

---

## Osa 2 · Ligipääs registrile ilma pääsuvõtmeta

### 2.1 IAM roll EC2 jaoks

IAM → Roles → Create role → AWS service → EC2 → policy **AmazonEC2ContainerRegistryReadOnly** → nimi `labseis-ec2-ecr`.
Konsool loob samanimelise [*instance profile*'i](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html).

<!-- EKRAANIPILT: AWS konsool, IAM → Roles → labseis-ec2-ecr, rolli kokkuvõtte leht. Näha vahekaart "Permissions" policyga AmazonEC2ContainerRegistryReadOnly ja (teise pildiosana või vahekaardil "Trust relationships") usaldatud teenus ec2.amazonaws.com; paremal "Instance profile ARN".
<figure markdown="span">
  ![IAM roll labseis-ec2-ecr: policy AmazonEC2ContainerRegistryReadOnly ja instance profile ARN](assets/kKT_k03-iam-role.png)
  <figcaption>Joonis 2. EC2 roll registry lugemiseks.</figcaption>
</figure>
-->

**Miks:** EC2 küsib ajutised võtmed metaandmete teenusest (`169.254.169.254`).

### 2.2 EC2 t3.small

Loo masin nagu 1. kohtumise kodutöös, kuid tüübiga `t3.small`, sildiga `Name=docker-k03` ja võtmega `--iam-instance-profile Name=labseis-ec2-ecr`. Luba turvagrupis pordid 22
ja 8080 oma IP-aadressilt (Compose avaldab web01 pordil 8080).

User-data on lühike Bashi skript `cloud/k03-aws/user-data.sh`, mis paigaldab Docker Engine'i ja Compose'i
Dockeri ametlikust apt-repositooriumist ning lisab kasutaja `ubuntu` gruppi `docker`. Kirjuta see ise
[Dockeri juhendi](https://docs.docker.com/engine/install/ubuntu/) järgi.

**Oodatav tulemus:** `ssh ubuntu@<ip> docker compose version` töötab ilma `sudo`-ta.
**Kui** näed `permission denied … docker.sock`: grupikuuluvus hakkab kehtima järgmisel sisselogimisel, seega logi välja ja uuesti sisse.

### 2.3 Registrisse sisselogimine ilma tokenita

EC2-l:

```bash
sudo apt-get install -y amazon-ecr-credential-helper
```

Seadista `~/.docker/config.json`-is `credHelpers` nii, et sinu registry host kasutab `ecr-login`-i
([amazon-ecr-credential-helper](https://github.com/awslabs/amazon-ecr-credential-helper)).

**Oodatav tulemus:** `docker pull <repositoryUri>:<tag>` töötab ilma `docker login`-ita, ka homme.
**Miks:** helper küsib tokeni iga kord instance profile'i kaudu, seega tokeni 12-tunnine kehtivusaeg ei sega.

---

## Osa 3 · Sama Compose, image registrist

Klooni oma repositoorium EC2-le või kopeeri `scp`-ga ainult kaust `k03-docker/`. Loo fail `.env` EC2-s, Giti seda ei lisata.

Sinu `compose.yaml`-is on app teenusel nii `build:` kui `image: ${APP_IMAGE:-…}`. Kasuta seda:

```bash
export APP_IMAGE=<repositoryUri>:<tag>
docker compose pull app01
docker compose up -d
```

**Oodatav tulemus:** `docker compose ps` näitab kõiki teenuseid olekus `healthy`. `docker compose images` näitab, et app01 image on ECR-ist,
db01 ja web01 ehitati kohapeal. Oma arvutist annab `curl http://<ip>:8080/health` vastuse `UP`.
**Tõend:** `docker compose ps` väljund ja `/version` vastus (commit vastab image'i sildile).

**Kui `up` hakkab app01-te ehitama:** `APP_IMAGE` pole samas shellis eksporditud või `pull` ebaõnnestus. `docker images` näitab, mis on kohalikult olemas.

??? info "Miks nii"
    Maveni ehitus t3.small-masinas (2 GB) on aeglane ja mälu võib otsa saada.

**Mõtle:** db01 ja web01 ehitati EC2-l uuesti. Mis riski see toob (kaks masinat, "sama" image, erinev sisu)?
Kuidas 5. kohtumise pipeline selle lahendaks?

---

## Koristus

Lõpeta EC2 masin (terminate), kustuta turvagrupp ja käivita `bash cloud/aws-leftovers.sh`. **ECR repo ja IAM roll jäävad** (5., 6. ja 7. kohtumise kodutööd vajavad neid).

## Valmis, kui

- `aws ecr describe-images --repository-name labori-seis` näitab commit'i sildiga image'it ja skänni tulemust
- `aws ecr get-lifecycle-policy --repository-name labori-seis` tagastab reegli
- EC2-l pole `~/.aws/credentials` faili ja `docker pull <repositoryUri>:<tag>` töötab ilma `docker login`-ita
- EC2-s näitab `docker compose ps` kõiki teenuseid olekus `healthy` ja `docker compose images` app01 image'it ECR-ist
- `aws-leftovers.sh`: `TULEMUS: tasulisi jääke pole` (INFO: ECR repo)

## Lisaülesanne

Laadi ka db ja web image ECR-i (kaks uut repot või sildid `labori-seis:db-<sha>`) ja käivita EC2-l
`docker compose up -d --no-build`. Mida tuleb `compose.yaml`-is muuta, et Proxmoxi labor ehitaks edasi kohapeal?

## Veaotsing

Ühised vead (sessioon, SG port sinu IP-le): [AWS-i reeglid](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/aws-reeglid/#veaotsing).

| Probleem | Põhjus | Lahendus |
|---|---|---|
| `denied: … not authorized to perform: ecr:BatchGetImage` | instance profile puudub või vale roll | `curl -s http://169.254.169.254/latest/meta-data/iam/info` (IMDSv2: vaja tokenit) |
| `no basic auth credentials` | `credHelpers` võti ei ole täpselt registry host | paranda võti registry hostiks |
| app01 käivitub korduvalt uuesti | `.env` paroolid erinevad db01 omast | `docker compose logs app01` |
| `/health` timeout väljast | SG-s pole 8080 sinu IP-le | lisa reegel |
