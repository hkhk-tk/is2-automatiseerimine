---
tags:
  - AWS
  - GitHub Actions
  - ECR
---

# 5. kohtumise kodutöö · GitHub Actions: ECR push ja deploy kinnitusega

**Eeldus:** IS1 [5. kohtumise praktikum](https://hkhk-tk.github.io/is1-automatiseerimine/k05/lab/) (`ci.yml`: jobid, `needs`, secrets, `environment`), [3. kohtumise kodutöö](https://hkhk-tk.github.io/is2-automatiseerimine/kodutood/k03-aws/) (ECR repo `labori-seis`, IAM roll `labseis-ec2-ecr`, Compose EC2-l) · **Esita:** `.github/workflows/deploy-aws.yml`, `cloud/k05-aws/ecr-push.json`

3\. kohtumise kodutöös laadisid image'i ECR-i käsitsi ja käivitasid Compose'i EC2-s ise. Nüüd teeb sama töö pipeline, mis vajab AWS-i
pääsuvõtit väljaspool sinu masinat. Võtme õigused peavad olema nii kitsad, et selle lekkimine ei tekitaks kahju, ja deploy peab ootama sinu
kinnitust.

**Enne alustamist:**

- Käsk `aws configure get region` väljastab `eu-north-1`. Üks t3.small masin ja avalik IPv4-aadress maksavad umbes $0.10 tunnis, lisaks kuluvad GitHub Actionsi minutid.
- Eelarvehäired (zero spend, $10) on alles.
- `aws sts get-caller-identity` väljundis lõpeb Arn kujul `:user/…`, mitte `:root`. Pikaajaline võti tekib ainult CI kasutajale `gha-labseis`.
- Lõpus kustutad võtme ja ressursid ning käivitad `bash cloud/aws-leftovers.sh`.
- Reeglid ja ühine veaotsing: [AWS-i reeglid](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/aws-reeglid/).

## Õpiväljundid

1. Loob IAM kasutaja, kelle võti lubab ainult image'i laadimist ühte repositooriumisse.
2. Kirjutab workflow, mis laadib image'i ECR-i commit'i sildiga ja deploy'b selle alles pärast käsitsi kinnitust (`environment`).
3. Kontrollib deploy tulemust masinast (`/version` = commit).

---

## Osa 1 · Kitsaste õigustega võti

Paljud juhendid annavad CI kasutajale `AmazonEC2ContainerRegistryFullAccess`. Sellise võtmega saab kustutada kõik repositooriumid. Siin anname ainult vajalikud õigused.

1. Loo IAM-is (IAM → Users) kasutaja `gha-labseis` **ilma** konsooli ligipääsuta.
2. Lisa inline-poliitika `cloud/k05-aws/ecr-push.json` ([ECR policy näited](https://docs.aws.amazon.com/AmazonECR/latest/userguide/security_iam_id-based-policy-examples.html)):
   `ecr:GetAuthorizationToken` ressursil `*`, push'i tegevused
   (`BatchCheckLayerAvailability`, `InitiateLayerUpload`, `UploadLayerPart`, `CompleteLayerUpload`, `PutImage`)
   ainult sinu repositooriumi ARN-il.
3. Loo access key ja kopeeri see otse GitHubi (Settings → Secrets and variables → Actions):
   secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; variables `AWS_REGION`, `ECR_REPOSITORY` (repositoryUri).

**Oodatav tulemus:** `aws iam simulate-principal-policy` (või IAM → Policy simulator) näitab, et `ecr:DeleteRepository` on `denied`.
**Miks `GetAuthorizationToken` on `*`:** see tegevus ei toeta ressursi piirangut, token kehtib kogu registrile, mitte ühele repositooriumile.
**Tõend:** policy JSON Gitis (konto ID asemel võib olla kohatäide), simulaatori kuvatõmmis.

<!-- EKRAANIPILT: AWS konsool, IAM → Policy simulator (https://policysim.aws.amazon.com/), vasakul valitud kasutaja gha-labseis ja tema inline policy, teenus Amazon ECR, valitud tegevused PutImage, InitiateLayerUpload ja DeleteRepository, pärast "Run Simulation". Tulemuste tabelis PutImage/InitiateLayerUpload "allowed" ja DeleteRepository "denied". Konto ID hägustada.
<figure markdown="span">
  ![IAM Policy simulator: gha-labseis kasutajale PutImage lubatud, DeleteRepository keelatud](assets/kKT_k05-policy-simulator.png)
  <figcaption>Joonis 1. Policy simulaator: push lubatud, repo kustutamine keelatud.</figcaption>
</figure>
-->

**Ära laadi** faili `gha-labseis_accessKeys.csv` repositooriumi kausta. Kui laadisid, kustuta see ja kontrolli `git status`.

## Osa 2 · Image ECR-i

Loo `.github/workflows/deploy-aws.yml`: käivitajad `workflow_dispatch` ja tag'id `v*`, `permissions: contents: read`.

Job `image`:

1. `actions/checkout@v5`
2. [`aws-actions/configure-aws-credentials@v6`](https://github.com/aws-actions/configure-aws-credentials) secrets'ide ja `vars.AWS_REGION`-iga
3. `aws ecr get-login-password` → `docker login` (sama mis 3. kohtumisel käsitsi)
4. `docker build` ja `docker push` sildiga `${GITHUB_SHA::7}`
5. image'i nimi job'i `outputs`-i, et deploy job teaks, millist image'it tõmmata

```bash
actionlint .github/workflows/deploy-aws.yml
gh workflow run deploy-aws.yml
```

**Oodatav tulemus:** ECR-is on uus tag, mis on commit'i lühike SHA. Job summary's on image nimi.
**Kui näed** `AccessDeniedException … ecr:InitiateLayerUpload`: repositooriumi ARN-is on vale regioon või konto ID.

**Mõtle:** see võti on GitHubis seni, kuni sa selle kustutad. Mis on selles osas OIDC eelis (IS2 kursusel)?

## Osa 3 · Deploy kinnitusega

1. Settings → [Environments](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment)
   → `aws`, **Required reviewers**: sina ise. Variable `EC2_HOST`, secret `EC2_SSH_KEY`
   (eraldi deploy-võti, mitte sinu isiklik: `ssh-keygen -t ed25519 -f ~/.ssh/gha-deploy -N ''`, avalik pool EC2 `authorized_keys`-i).
2. Job `deploy`: `needs: image`, `environment: aws`. Sammud: kirjuta SSH-võti faili (`chmod 600`), lisa `ssh-keyscan` väljund faili `known_hosts` ja käivita
   `ssh ubuntu@$EC2_HOST "cd … && APP_IMAGE=… docker compose pull app01 && docker compose up -d --no-build app01"`.
3. Viimane samm: oota tsüklis, kuni `ssh … curl -s http://localhost:8080/version` sisaldab `${GITHUB_SHA::7}`, muidu `exit 1`.

EC2 turvagrupis peab port 22 olema GitHubi runner'ile kättesaadav. Kodutöö jaoks on lihtsaim avada port 22 kõigile (`0.0.0.0/0`), kuid **ainult deploy-võtmega**
ja ainult kodutöö ajaks. Seejärel piira see tagasi `/32`-le. Parem lahendus on lisaülesandes.

**Oodatav tulemus:** workflow peatub kollase "Waiting for review" juures. Pärast "Approve" uueneb app01, `/version` näitab uut commit'i.
**Miks:** `environment` lisab kinnitussammu, mille taga on ka selle keskkonna saladused. Ilma kinnituseta ei näe job `EC2_SSH_KEY`-d.
**Tõend:** Actionsi käivituse kuvatõmmis (image ✓, deploy ootab → ✓) ja `/version` vastus.

**Kui `ssh` annab** `Host key verification failed`: `ssh-keyscan` küsis võtit valelt hostilt või IP-aadress muutus (EC2 taaskäivitamisel muutub avalik IP-aadress).

---

## Koristus

1. Ava IAM → `gha-labseis` → Access key, vali **Deactivate** ja seejärel **Delete**. Sama saab teha käsuga `aws iam delete-access-key --user-name gha-labseis --access-key-id …`.
2. Eemalda GitHubist secrets `AWS_*` ja `EC2_SSH_KEY`.
3. Lõpeta EC2 masin (terminate), piira turvagrupp tagasi `/32`-le või kustuta see ja käivita `bash cloud/aws-leftovers.sh` (INFO: ECR repo).

## Valmis, kui

- poliitikasimulaatoris on `PutImage` lubatud ja `ecr:DeleteRepository` `denied`
- `aws ecr list-images --repository-name labori-seis` näitab tag'e, mis on commit'i lühikesed SHA-d
- deploy job käivitus alles pärast "Approve" ja `curl -s http://<EC2>:8080/version` sisaldab sama SHA-d
- `grep -nE 'AKIA|[0-9]{12}' .github/workflows/deploy-aws.yml` on tühi (ainult `secrets.*` ja `vars.*`)
- `aws iam list-access-keys --user-name gha-labseis` on tühi, `aws-leftovers.sh`: `TULEMUS: tasulisi jääke pole`

## Lisaülesanne

Asenda SSH deploy **self-hosted runner'iga EC2-l** (label `aws`): `deploy` job töötab masinas endas ja GitHub ei vaja
ligipääsu pordile 22. Runner'i registreerimise token aegub tunni pärast, kuid registreeritud runner jääb tööle. Mis muutub turvamudelis: kes saab nüüd
sinu EC2-l käske käivitada?

## Veaotsing

| Probleem | Põhjus | Lahendus |
|---|---|---|
| `Credentials could not be loaded` | secretite nimed ei klapi workflow'iga | paranda nimed |
| deploy ei oota kinnitust | environment'i nimi workflow'is ≠ nimi Settings → Environments all | pane nimed samaks |
| `pull access denied` EC2-l | 3. kohtumise credential helper või instance profile puudub | vt 3. kohtumise kodutöö osa 2 |
| `/version` näitab vana SHA-d | `up` ei loonud konteinerit uuesti: `APP_IMAGE` väärtus ei jõudnud `ssh` käsuni | kontrolli jutumärke |

Ühised vead: [AWS-i reeglid](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/aws-reeglid/#veaotsing).
