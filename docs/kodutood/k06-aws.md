---
tags:
  - AWS
  - Jenkins
  - ECR
---

# 6. kohtumise kodutöö · Jenkins: image ECR-i ja deploy EC2-le

**Eeldus:** IS1 [6. kohtumise praktikum](https://hkhk-tk.github.io/is1-automatiseerimine/k06/lab/) (`k06-jenkins/Jenkinsfile` etapiga Docker image, sinu control node on Jenkinsi agent label'iga = GitHubi kasutajanimi) ja [süvenemise osa 4](../k06/syvenemine.md#osa-4-image-paralleel-ja-deploy) (`input`, `when`), [3.](https://hkhk-tk.github.io/is2-automatiseerimine/kodutood/k03-aws/) ja [5. kohtumise kodutöö](https://hkhk-tk.github.io/is2-automatiseerimine/kodutood/k05-aws/) (ECR repo, push-only IAM kasutaja, EC2 Compose'iga) · **Esita:** `k06-jenkins/Jenkinsfile` (uued etapid), `cloud/k06-aws/`

5\. kohtumise kodutöös laadis GitHub Actions image'i registrisse ja tegi deploy. Nüüd teeb sama töö koolitaja jagatud Jenkins, mille kettale ei tohi sinu
AWS-i võti sattuda.

**Enne alustamist:**

- Käsk `aws configure get region` väljastab `eu-north-1`. Üks t3.small masin ja avalik IPv4-aadress maksavad umbes $0.10 tunnis, Fargate'i osa koos ühe task'iga umbes $0.025 tunnis.
- Eelarvehäired (zero spend, $10) on alles.
- `aws sts get-caller-identity` väljundis lõpeb Arn kujul `:user/…`, mitte `:root`. Pikaajaline võti on ainult kasutajal `gha-labseis` ja see lubab ainult ECR-i laadimist.
- Lõpus kustutad võtme ja ressursid ning käivitad `bash cloud/aws-leftovers.sh`.
- Reeglid ja ühine veaotsing: [AWS-i reeglid](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/aws-reeglid/).

## Õpiväljundid

1. Lisab Jenkinsfile'i etapid, mis laadivad image'i ECR-i build'i numbri ja commit'i sildiga, ning hoiab AWS-i võtit agendi masinas, mitte jagatud Jenkinsis.
2. Deploy'b image'i EC2-le kinnitusega ja kontrollib tulemust pipeline'is.
3. Võrdleb Jenkinsi ja GitHub Actionsi lahendust samale ülesandele.

---

## Osa 1 · Kus võti asub

Koolitaja Jenkins on jagatud. Kui paned AWS-i võtme Jenkinsi credential'iks, on see Jenkinsi kettal ja administraatoril
on sellele ligipääs. Pipeline töötab aga **sinu control node'is** (agent), seega saab võtme hoida seal.

Käivita control node'is agendi kasutajana:

```bash
aws configure --profile labseis-ecr     # gha-labseis kasutaja UUS võti (K5 oma kustutasid)
aws --profile labseis-ecr ecr describe-repositories   # AccessDenied on õige: policy lubab ainult push'i
```

**Oodatav tulemus:** `~/.aws/credentials`-is on profiil `labseis-ecr`, Jenkinsis pole AWS-i credential'it.
**Miks:** kui jagatud Jenkins kompromiteeritakse, ei saa ründaja sinu AWS-i võtit. Selle hind on, et pipeline töötab ainult sinu agendis.

**Mõtle:** levinud lahendus kasutab `docker.withRegistry(…, 'ecr:region:credId')` ja Jenkinsi pluginat. Millal
on see parem kui agendi profiil? (Vihje: mitu agenti, autoskaleeruvad agendid.)

## Osa 2 · Etapp "Push ECR"

Lisa Jenkinsfile'i pärast olemasolevat Docker image'i etappi uus `stage('Push ECR')`:

- `environment` plokis `AWS_PROFILE = 'labseis-ecr'`, `ECR = '<repositoryUri>'`;
- `sh` sammus: logi ECR-i sisse ([`aws ecr get-login-password`](https://docs.aws.amazon.com/cli/latest/reference/ecr/get-login-password.html)
  → `docker login`), loo Docker etapi image'ist `labori-seis:$ART_VERSION` käsuga `docker tag` kaks ECR-i tag'i (`$ART_VERSION` ja
  `${GIT_COMMIT:0:7}`) ja laadi mõlemad käsuga `docker push`;
- `post { always { … } }`: eemalda kohalikud sildid käsuga `docker rmi`, et agendi ketas ei täituks (muidu tuleb viga "no space left on device").

Vihje: `${GIT_COMMIT:0:7}` on Bashi süntaks. Jenkinsi `sh '...'` töötab `/bin/sh`-iga. Lisa `sh` sammu algusesse
`#!/bin/bash` või kasuta `sh(script: …, label: …)` koos `bash -c`-ga.

**Oodatav tulemus:** ECR-is on kaks uut tag'i: build'i number ja SHA. Jenkinsfile'is pole konto ID-d mujal kui muutujas `ECR`.
**Tõend:** Jenkinsi stage view kuvatõmmis ja käsu `aws ecr list-images --repository-name labori-seis` väljund.

## Osa 3 · Etapp "Deploy AWS"

1. [`input`](https://www.jenkins.io/doc/book/pipeline/syntax/) samm: "Deploy EC2-le?" (sama mõte mis 5. kohtumise `environment`), `timeout` 10 min.
2. Käivita EC2-s `sshagent`-i või agendi enda SSH-võtmega `docker compose pull app01 && docker compose up -d --no-build app01`,
   kus `APP_IMAGE` on SHA tag.
3. Kontrolli tsüklis, kuni `/version` sisaldab commit'i. Kui see ei õnnestu, lõpeta `error()`-iga.

Deploy etapp käivitub ainult `main` harul (`when { branch 'main' }`).

**Oodatav tulemus:** build peatub `input` juures. Pärast "Proceed" vastab `/version` uue versiooniga.
**Tõend:** konsoolilogi viimased read.

**Mõtle:** sama töö on nüüd tehtud kahes kohas (5. kohtumisel Actions, 6. kohtumisel Jenkins). Kirjuta issue'sse kolm lauset: mida tegi
paremini Jenkins, mida GitHub Actions ning kumma valiksid oma töökohas ja miks.

---

## Edasijõudnutele · ECS Fargate ilma ALB-ta

1. Loo ECS-is klaster `labseis` (Fargate, ilma EC2-ta).
2. Task definition: 0.5 vCPU / 1 GB, image ECR-ist SHA sildiga, keskkonnamuutujad nagu README-s (`DB_HOST` = 3. kohtumise EC2
   privaatne IP; db, mq ja cache jäävad EC2-le), port 8080.
3. Service: desired 1, avalik IP sisse lülitatud, **Load balancing: None**.
4. Jenkinsi deploy: uus task definition'i revisjon uue image'iga (`aws ecs register-task-definition`) ja
   [`aws ecs update-service`](https://docs.aws.amazon.com/cli/latest/reference/ecs/update-service.html) `--task-definition <uus>`.
   Võti vajab selleks lisaõigusi (eraldi policy, `ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `iam:PassRole` task rollile).

**Miks uus revisjon, mitte `--force-new-deployment` `latest` sildiga:** revisjoni järgi näed, mis image töötab, ja saad
minna tagasi eelmisele revisjonile.

**ECS-i konsooli viisard pakub vaikimisi ALB-d** (~$0.024/h + LCU). Vali "None". Kui ALB siiski loodi, kustuta ALB **ja** target group.

<!-- EKRAANIPILT: AWS konsool, ECS → Clusters → labseis → Services → Create, jaotis "Load balancing" lahti, valitud "None" (noolega märgitud); ülal näha Compute "Fargate" ja Desired tasks 1.
<figure markdown="span">
  ![ECS teenuse loomise vorm: Fargate, desired tasks 1, Load balancing valikuks None](assets/kKT_k06-ecs-no-alb.png)
  <figcaption>Joonis 1. ECS teenus ilma load balancerita.</figcaption>
</figure>
-->

**Koristus:** määra service'i desired väärtuseks 0, kustuta service ja seejärel klaster. Task definition'i revisjonid võivad alles jääda (need on tasuta).

## Koristus

1. Lõpeta EC2 masin (terminate) ja kustuta turvagrupp.
2. Eemalda control node'is võti `labseis-ecr` (kustuta profiil failist `~/.aws/credentials`) ja kustuta võti ka IAM-is.
3. `bash cloud/aws-leftovers.sh` (ECS teenust, ALB-d ega target group'i ei tohi olla).

## Valmis, kui

- Jenkinsi credential'ite seas pole AWS-i võtit ja `grep -nE 'AKIA|aws_secret' k06-jenkins/Jenkinsfile` on tühi
- `aws ecr list-images --repository-name labori-seis` näitab build'i numbri ja SHA tag'i
- deploy käivitus pärast `input` kinnitust ja `/version` sisaldab sama SHA-d
- agendis annab `docker images | wc -l` pärast build'i sama tulemuse kui enne
- `aws iam list-access-keys --user-name gha-labseis` on tühi, `aws-leftovers.sh`: `TULEMUS: tasulisi jääke pole`

## Veaotsing

| Probleem | Põhjus | Lahendus |
|---|---|---|
| `Unable to locate credentials` pipeline'is | agent töötab teise kasutajana kui see, kellel on `~/.aws` | `sh 'id; echo $HOME'` |
| `Bad substitution` | `/bin/sh`, mitte bash | vt osa 2 vihje |
| `permission denied … docker.sock` agendil | agendi kasutaja pole `docker` grupis | lisa gruppi, taaskäivita agent |
| ECS-i task läheb kohe olekusse `STOPPED` | tavaliselt vale `DB_HOST` või turvagrupi reegel | CloudWatchi logid; EC2 SG peab lubama 3306/5672/11211 task'i SG-st |

Ühised vead: [AWS-i reeglid](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/aws-reeglid/#veaotsing).
