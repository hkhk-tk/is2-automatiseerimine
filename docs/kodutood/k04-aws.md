---
tags:
  - AWS
  - OpenTofu
  - Ansible
---

# 4. kohtumise kodutöö · sama struktuur, `aws` provider

**Eeldus:** IS1 4. kohtumise [praktikum](https://hkhk-tk.github.io/is1-automatiseerimine/k04/lab/) (`k04-tofu/`: provider, `for_each` üle `vms` map'i, `inventory.tftpl`) ja IS2 leht [Moodul, moved ja state](../k04/lab-3-moodul-state.md), [2. kohtumise kodutöö](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/k02-aws/) osa 3 (`private_ip` rollis `common`) · **Esita:** `cloud/k04-aws/`

Praktikumis kasutab OpenTofu kood olemasolevat võrku ja määrab virtuaalmasinatele IP-aadressid ise. AWS-is lood võrgu ja turvagrupid koodiga,
aadressid määrab AWS ja avalik moodul võib vaikimisi luua tasulisi ressursse. `vms` map'i struktuur ning ahel OpenTofu →
Ansible jäävad samaks.

**Enne alustamist:**

- Käsk `aws configure get region` väljastab `eu-north-1`. Viis EC2 masinat ja viis avalikku IPv4-aadressi maksavad umbes $0.15 tunnis. NAT gateway'd ei looda.
- Eelarvehäired (zero spend, $10) on alles.
- `aws sts get-caller-identity` väljundis lõpeb Arn kujul `:user/…`, mitte `:root`.
- Lõpus käivitad `tofu destroy` ja `bash cloud/aws-leftovers.sh`.
- Reeglid ja ühine veaotsing: [AWS-i reeglid](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/aws-reeglid/).

## Õpiväljundid

1. Kirjutab OpenTofu konfiguratsiooni teisele providerile sama struktuuriga ja leiab avaliku mooduli muutujatest valiku, mis tekitab kulu.
2. Kirjutab turvagrupi reeglid, mis viitavad teistele turvagruppidele, ja genereerib Ansible'i inventory OpenTofu väljundist.
3. Tuvastab triivi (drift) käsuga `plan` ja selgitab, millist triivi `plan` ei näe.

---

## Osa 1 · Provider ja tühi plaan

Loo `cloud/k04-aws/versions.tf`: providerid [`hashicorp/aws`](https://search.opentofu.org/provider/hashicorp/aws/latest)
(`~> 6.0`) ja `hashicorp/local`. Plokis `provider "aws"` võta regioon muutujast ja lisa `default_tags`
(`Project = "labseis"`, `Owner = var.owner`).

```bash
cd cloud/k04-aws
tofu init
tofu plan
```

**Oodatav tulemus:** `No changes`. Provider loeb volitused `AWS_PROFILE=labseis` kaudu (1. kohtumise kodutöö).
**Miks `default_tags`:** iga ressurss saab sildid, ilma et peaksid neid igale poole kirjutama. Koristusskript ja kuluaruanne
leiavad sildi järgi kõik ressursid.
**Kui näed** `No valid credential sources found`: kontrolli samas shellis käskudega `echo $AWS_PROFILE` ja `aws sts get-caller-identity`.

## Osa 2 · Võrk mooduliga

Lisa `main.tf`-i moodul [`terraform-aws-modules/vpc/aws`](https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws/latest)
(`~> 6.7`): kaks käideldavustsooni (AZ), **ainult** `public_subnets` ja `map_public_ip_on_launch = true`.

Enne `apply`'d ava mooduli dokumentatsioonis muutuja `enable_nat_gateway`. Mis on vaikeväärtus? Mis juhtuks, kui
lisaksid `private_subnets`?

```bash
tofu plan | grep -E 'will be created|nat'
tofu apply
```

**Oodatav tulemus:** plaanis on VPC, kaks alamvõrku, internet gateway ja marsruutimistabel. **Plaanis ei ole** `aws_nat_gateway` ega `aws_eip`.
**Miks:** NAT gateway (~$1.1 päevas + andmed) on kõige tavalisem põhjus, miks kodutöö maksab oodatust rohkem.
**Tõend:** `tofu state list` väljund.

<!-- EKRAANIPILT: AWS konsool, VPC → Your VPCs → moodulist loodud VPC → vahekaart "Resource map", kohe pärast osa 2 `tofu apply`'d. Näha: VPC, kaks public subnet'i kahes AZ-s, üks route table, Internet gateway; NAT gateway veerg tühi.
<figure markdown="span">
  ![VPC Resource map: kaks avalikku alamvõrku, üks route table ja internet gateway, NAT gateway puudub](assets/kKT_k04-vpc-resource-map.png)
  <figcaption>Joonis 1. Moodulist loodud VPC ilma NAT gateway'ta.</figcaption>
</figure>
-->

**Mõtle:** Proxmoxis oli võrk (bridge, gateway) olemas ja kood ainult kasutas seda. AWS-is lood võrgu ise.
Kumb lahendus on mitme keskkonna (dev, staging, prod) puhul mugavam ja miks?

## Osa 3 · Turvagrupid rollide järgi

Lisa turvagrupid:

| SG | Sisse | Allikas |
|---|---|---|
| `ssh` (kõigil) | 22 | `var.my_ip` (`/32`) |
| `web` | 80 | `0.0.0.0/0` |
| `app` | 8080 | SG `web` |
| `db` / `cache` / `queue` | 3306 / 11211 / 5672 | SG `app` |

*Tabel 1. Security group'id ja nende sissetulevad reeglid.*

Kasuta ressurssi [`aws_vpc_security_group_ingress_rule`](https://search.opentofu.org/provider/hashicorp/aws/latest/docs/resources/vpc_security_group_ingress_rule)
(iga reegel on eraldi ressurss), mitte turvagrupi sees olevaid `ingress {}` plokke. Taustateenuste kolm reeglit loo **ühe** `for_each`-iga
map'i `{ db = 3306, cache = 11211, queue = 5672 }` põhjal.

Lisa muutujale `my_ip` `validation`, mis keelab kõik peale `/32`.

**Oodatav tulemus:** `tofu plan` näitab kolme taustateenuse reeglit, mis tulevad ühest ressursiplokist. Väärtusega `my_ip = "0.0.0.0/0"` plaan ebaõnnestub sinu kirjutatud veateatega.
**Miks viidata turvagruppidele:** IP-aadressid muutuvad iga uue masinaga, rollid mitte. Reegel "db01 lubab ainult app01" jääb õigeks ka siis, kui app01 on homme teine masin.

**Kui `apply` annab** `InvalidPermission.Duplicate`: samas SG-s on ka vana `ingress {}` plokk või käsitsi lisatud reegel. Kasuta ainult üht viisi.

## Osa 4 · Masinad sama map'iga

Proxmoxis oli `vms` map: `ip`, `distro`, `cores`, `memory`, `group`. AWS-is jäävad alles `distro` ja `group`. `ip`
asemel annab aadressi AWS ja `cores`/`memory` asemel on `instance_type`.

1. `variable "vms"`: samad võtmed (`db01` … `web01`), väärtustes `distro`, `group`, `instance_type`. Lisa `validation`, mis lubab ainult `t3.micro` ja `t3.small`.
2. AMI distro järgi: Ubuntu SSM parameetrist (`data "aws_ssm_parameter"`, vt 1. kohtumise kodutöö), Rocky `data "aws_ami"`-ga (vt 2. kohtumise kodutöö).
3. `aws_key_pair` control node'i avalikust võtmest.
4. `aws_instance` `for_each = var.vms`: AMI ja SG grupi järgi, `root_block_device` gp3 10 GB, sildid `Name`, `Group`, `Distro`.

```bash
tofu apply
tofu output
```

**Oodatav tulemus:** loodud on viis masinat ja `tofu output` näitab iga masina nime ja avalikku IP-aadressi.
**Tõend:** `tofu output` ja `aws ec2 describe-instances --filters Name=tag:Project,Values=labseis --query 'Reservations[].Instances[].Tags'`.

**Mõtle:** Proxmoxi koodis oli `user_account { username = "kasutaja" }`. AWS-is on kasutaja AMI-s (`ubuntu`, `rocky`).
Kus peab see erinevus nüüd koodis kirjas olema?

## Osa 5 · Väljund → Ansible

Loo `inventory-aws.tftpl` 4. kohtumise praktikumi faili `inventory.tftpl` põhjal, aga anna igale hostile `ansible_host` (avalik IP),
`ansible_user` (distro järgi) ja `private_ip`. `local_file` kirjutab selle faili `cloud/k04-aws/inventory-aws.ini`.
Lisa `inventory-aws.ini` `.gitignore`-i (selles on ajutised IP-aadressid).

```bash
tofu apply
cd ../../k02-ansible
ansible-playbook -i ../cloud/k04-aws/inventory-aws.ini site.yml --ask-vault-pass
curl -s "$(tofu -chdir=../cloud/k04-aws output -raw url)health"
```

**Oodatav tulemus:** `/health` vastab `UP` ja teise `ansible-playbook` käivituse kokkuvõttes on `changed=0`.
**Miks:** ahel on sama mis praktikumis: OpenTofu loob masinad ja väljastab nende aadressid, Ansible seadistab need.

## Osa 6 · Triiv (drift)

**6.1 Muudetud ressurss.** Muuda konsoolis web01 silti `Name` (nt `web01-kasitsi`).

```bash
tofu plan -detailed-exitcode; echo "exit=$?"
```

**Oodatav tulemus:** plaan muudaks sildi tagasi (`~ update in-place`) ja väljundis on `exit=2`.

**6.2 Lisatud ressurss.** Lisa konsoolis SG-sse `web` uus reegel (443 kõigile) ja käivita sama käsk.

**Oodatav tulemus:** plaan näitab `No changes` ja `exit=0`. Käsitsi lisatud reegel jääb alles.
**Tõend:** mõlema `plan`-i viimane rida ja üks lause järeldusega issue's.

??? info "Miks nii"
    OpenTofu võrdleb ainult ressursse, mis on tema state'is. Iga `aws_vpc_security_group_ingress_rule` on eraldi
    ressurss ja võõrast reeglit state'is pole. Turvagrupi sees olev `ingress {}` plokk haldaks kogu reeglite loendit ja
    märkaks lisatud reeglit.

**Mõtle:** kumba käitumist tahad tootmises: tööriista, mis kustutab kõik võõra, või tööriista, mis võõrast ei näe?
Kuidas leiaksid 6.2 tüüpi triivi? Vihje: võrdle käskude `aws ec2 describe-security-group-rules` ja `tofu state list` väljundit.

---

## State S3-s

Loo käsitsi bucket `labseis-tfstate-<sinu-github>` (versioonimine sisse lülitatud, avalik ligipääs blokeeritud), lisa
[`backend "s3"`](https://opentofu.org/docs/language/settings/backends/s3/) plokk ja käivita `tofu init -migrate-state`.

## Koristus

```bash
tofu destroy
bash ../aws-leftovers.sh
```

**Oodatav tulemus:** `Destroy complete! Resources: N destroyed.` `aws-leftovers.sh` väljastab `TULEMUS: tasulisi jääke pole`.
State'i bucket (kui selle lõid) võib alles jääda.

## Valmis, kui

- pärast `apply`'d näitab `tofu plan` `No changes` ja `tofu state list | grep nat_gateway` on tühi
- väärtusega `my_ip = "0.0.0.0/0"` ebaõnnestub `tofu plan` sinu validatsiooni veateatega; taustateenuste reeglid tulevad ühest `for_each` ressursist
- pärast ühte `tofu apply` ja ühte `ansible-playbook` käivitust vastab `/health` `UP`
- `tofu fmt -check` ei leia midagi ja `git ls-files | grep -E 'tfvars$|tfstate'` on tühi
- `tofu destroy` on tehtud, `aws-leftovers.sh`: `TULEMUS: tasulisi jääke pole`

## Lisaülesanne

Tee Proxmoxi ja AWS-i koodist üks moodul `modules/labseis-hosts` sisendiga `vms` ja väljundiga `hosts`
(`name → { public, private, user }`). Kaks juurkausta (`k04-tofu`, `cloud/k04-aws`) kasutavad sama inventory malli.
Kus on piir: mis on mooduli sees, mis on provideri-spetsiifiline?

## Veaotsing

Ühised vead (`UnauthorizedOperation`, aegunud `aws login`): [AWS-i reeglid](https://hkhk-tk.github.io/is1-automatiseerimine/kodutood/aws-reeglid/#veaotsing).

| Probleem | Põhjus | Lahendus |
|---|---|---|
| `tofu init` ei leia `hashicorp/aws` | klassi provider-mirror (`TF_CLI_CONFIG_FILE`) on sees | kodus `unset TF_CLI_CONFIG_FILE` |
| Rocky AMI `describe-images` tühi | konto ID või nimemuster muutunud | vt 2. kohtumise kodutöö osa 1 |
| `ansible` ei saa kohe pärast `apply`'d ühendust | masin alles käivitub | `ansible all -m wait_for_connection` |
| `destroy` jääb SG kustutamisel ootama | käsitsi lisatud ENI või masin teises SG-s | vaata konsoolist, kes SG-d kasutab |
