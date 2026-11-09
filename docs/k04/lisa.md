---
tags:
  - OpenTofu
  - Proxmox
  - IaC
---

# Lisaülesanded: OpenTofu

Ülesanded jätkavad IS1 praktikumi [OpenTofu (Terraform) Proxmoxis](https://hkhk-tk.github.io/is1-automatiseerimine/k04/lab/) ja selle kursuse süvenemise koodi. Iga ülesande eeldus on selle juures kirjas.

| Ülesanne | Tase | Tulemus |
|---|---|---|
| [1. Validate'i ja plaani piirid](#1-validatei-ja-plaani-piirid) | lihtne | tead, millise vea leiab `validate`, `plan`, `apply` |
| [2. State lähemalt](#2-state-lahemalt) | lihtne | state'i `serial`, `lineage` ja backup üle vaadatud |
| [3. Kust muutuja väärtuse saab](#3-kust-muutuja-vaartuse-saab) | lihtne | muutuja allikate järjekord on `NOTES.md`-s |
| [4. Teine kaust, sama state](#4-teine-kaust-sama-state) | lihtne | teine kaust näeb bucketist sama state'i |
| [5. Ketas kasvab lõpuni](#5-ketas-kasvab-lopuni) | keskmine | app01 ja db01 ketas kasvanud ilma restardita |
| [6. Provisioner võrdluseks](#6-provisioner-vordluseks) | keskmine | tead, miks provisioner skripti muutust ei märka |
| [7. Sama kood Terraformiga](#7-sama-kood-terraformiga) | keskmine | Tofu ja Terraformi plaan koopias võrreldud |
| [8. user-data templatefile'iga](#8-user-data-templatefileiga) | keskmine | VM-id saavad user-data oma template'ist |
| [9. tofu test Proxmoxi vastu](#9-tofu-test-proxmoxi-vastu) | keskmine | integratsioonitest loob ja kustutab VM-i |
| [10. Plaani kokkuvõte pipeline'i jaoks](#10-plaani-kokkuvote-pipelinei-jaoks) | keskmine | `plan-summary.sh` annab db01 kustutusel koodi 3 |
| [11. db01 teine ketas](#11-db01-teine-ketas) | keskmine | db01 andmed eraldi 5 GB kettal |
| [12. Poliitika plaanile Conftestiga](#12-poliitika-plaanile-conftestiga) | keskmine | Conftest keelab plaanis db VM-i kustutamise |
| [13. Golden image AlmaLinuxile ja ühe hosti kaupa](#13-golden-image-almalinuxile-ja-uhe-hosti-kaupa) | raske | AlmaLinuxi mall mc01-l, db01 puutumata |
| [14. mc01 ja rmq01 LXC-na](#14-mc01-ja-rmq01-lxc-na) | raske | mc01 ja rmq01 töötavad LXC-konteineris |
| [15. Ühe hosti taastamine](#15-uhe-hosti-taastamine) | raske | `rebuild.sh` asendab ühe hosti ohutult |
| [Lisaprojekt: tulemüür koodis](#lisaprojekt-tulemuur-koodis) | keskmine | web01 SSH ainult control node'ilt |
| [Lisaprojekt: Docker ja Kubernetes OpenTofuga](#lisaprojekt-docker-ja-kubernetes-opentofuga) | keskmine | memcached ja Helm release OpenTofu state'is |
| [Lisaprojekt: krüpteeritud state](#lisaprojekt-krupteeritud-state) | raske | state krüpteeritud, parool vahetatud |
| [17. render.py: soovitud olek template'ist, diff ja apply](#17-renderpy-soovitud-seis-templateist-diff-ja-apply) | keskmine | `render.py` näitab ruuteri diff'i ja viib muudatuse ruuterisse |

Kui ülesande juures pole teisiti, läheb tulemus kausta `k04-tofu/` ja otsused ning mõõtmised `NOTES.md`-sse; GitHubis on igal ülesandel issue label'iga `edasijõudnu`.

## Lihtsad ülesanded

### 1. Validate'i ja plaani piirid

**Tase:** lihtne · **Eeldus:** [Üks VM koodist](https://hkhk-tk.github.io/is1-automatiseerimine/k04/lab-1-uks-vm/)

Tofu kontrollib koodi kolmes etapis: `validate`, `plan` ja `apply`. Igaüks näeb erinevat osa tegelikkusest, ja kui sa ei tea, milline etapp millise vea leiab, otsid tõrget valest kohast.

- Tee kaustas `01-alused` kaks viga ükshaaval ja käivita iga kord ainult `tofu validate`: `tags = "test"` (string listi asemel) ja `clone` plokis viide `data.proxmox_virtual_environment_vms.debian` (sellist data source'i pole). Paranda mõlemad.
- Muuda `node_name` olematuks (`pve99`), käivita `tofu plan` ja `tofu apply`.
- Enne kui õige node'i tagasi paned, vaata UI-st ja `tofu state list`-iga, mis olekus `test01` on.
- Pane õige node tagasi ja korda `apply`-d, kuni plaan on tühi.

**Kontroll:**

```bash
tofu validate
tofu plan | grep -E 'forces replacement|Plan:'
tofu state list
tofu plan -detailed-exitcode > /dev/null; echo "kood $?"
```

**Valmis, kui:**

- `NOTES.md`-s on iga vea juures etapp, kus see välja tuli, ja veateade;
- `NOTES.md`-s on `test01` olek UI-s ja state'is pärast ebaõnnestunud `apply`-d;
- lõpus annab `tofu plan -detailed-exitcode` koodi `0`.

??? success "Lahendus"
    `validate` kontrollib tüüpe ja viiteid ilma API-ta. `pve99` on korrektne string, nii et `validate` ja `plan` lasevad selle läbi. `node_name` muutus on `forces replacement` ja vaikimisi järjekord on kõigepealt kustutus, siis loomine: `apply` kustutab vana `test01` ja ebaõnnestub alles uue kloonimisel.

    ```bash
    tofu validate                    # 1: Incorrect attribute value type; 2: Reference to undeclared resource
    # node_name = "pve99"
    tofu plan | grep -E 'forces replacement|Plan:'   # 1 to add, 0 to change, 1 to destroy
    tofu apply                       # destroy õnnestub, create ebaõnnestub API veaga
    tofu state list                  # ainult data.proxmox_virtual_environment_vms.ubuntu
    # node_name tagasi õigeks
    tofu apply && tofu plan -detailed-exitcode > /dev/null; echo "kood $?"
    ```

    Kontroll: pärast ebaõnnestunud `apply`-d pole `test01`-te UI-s ega state'is; lõpus annab plaan koodi `0` ja `test01` on uus VM uue host key'ga (`ssh-keygen -R` enne SSH-d). Kontrollimata: Proxmoxi veateate täpne tekst sõltub versioonist.

    **Miks nii.** Kaks esimest viga leiab `validate`: string listi asemel annab `Incorrect attribute value type`, olematu data source `Reference to undeclared resource`. `pve99`-ga plaan õnnestub (asendus) ja alles `apply` ebaõnnestub API veaga, sest node'i olemasolu teab ainult Proxmox.

### 2. State lähemalt

**Tase:** lihtne · **Eeldus:** [Üks VM koodist](https://hkhk-tk.github.io/is1-automatiseerimine/k04/lab-1-uks-vm/)

State on JSON-fail, mida tavaliselt keegi ei vaata. Enne kui see bucketisse läheb, pead teadma, mida Tofu iga objekti kohta mäletab ja mis sinna peale sinu koodi veel satub.

- Vaata state'i kolmel viisil: `tofu state list`, `tofu state show` ja `jq` otse failist.
- Tee üks väike muudatus (`memory.dedicated = 1024`) ja `apply`.
- Võrdle `serial`-i enne ja pärast ning `terraform.tfstate.backup`-is.
- Otsi state'ist oma avalikku võtit.

**Kontroll:**

```bash
ls -l terraform.tfstate*
tofu state list
tofu state show proxmox_virtual_environment_vm.test01 | head -30
jq '{serial, lineage, ressursid: [.resources[] | "\(.mode) \(.type).\(.name)"]}' terraform.tfstate
```

**Valmis, kui:**

- oskad näidata üht `data` ja üht `managed` objekti ning öelda, mis neil vahet on;
- `serial` kasvas `apply` järel ühe võrra;
- `terraform.tfstate.backup` sisaldab eelmise versiooni `serial`-i;
- `grep -c ssh-ed25519 terraform.tfstate` annab vähemalt `1` ja `NOTES.md`-s on kirjas, miks võti seal on.

??? success "Lahendus"
    `data` on lugemise tulemus, mida Tofu ei halda; `managed` on objekt, mille ta lõi ja mida ta muudab või kustutab. Iga state'i kirjutus suurendab `serial`-i, `lineage` jääb samaks kogu state'i elu. Avalik võti on state'is, sest see on `initialization` argument: sama juhtub iga parooli või tokeniga, mis on mõne ressursi argument.

    ```bash
    jq -r '.resources[] | "\(.mode) \(.type).\(.name)"' terraform.tfstate
    s1=$(jq .serial terraform.tfstate)
    # main.tf: memory { dedicated = 1024 }
    tofu apply
    echo "enne $s1, nüüd $(jq .serial terraform.tfstate), backup $(jq .serial terraform.tfstate.backup)"
    grep -c ssh-ed25519 terraform.tfstate
    ```

    Kontroll: esimene käsk väljastab `data proxmox_virtual_environment_vms.ubuntu` ja `managed proxmox_virtual_environment_vm.test01`, `echo` näitab `enne N, nüüd N+1, backup N` ja `grep -c` annab vähemalt `1`.

### 3. Kust muutuja väärtuse saab

**Tase:** lihtne · **Eeldus:** [Viis VM-i muutujatega](https://hkhk-tk.github.io/is1-automatiseerimine/k04/lab-2-viis-vmi/)

Sama muutuja väärtus võib tulla viiest kohast ja plaan näitab ainult lõplikku väärtust. `dns_servers` on `variables.tf`-is vaikeväärtusega ja lisaks `terraform.tfvars`-is; kui plaan näitab ootamatut DNS-serverit, pead teadma, kust otsida.

- Kirjuta `NOTES.md`-sse iga allpool oleva rea kohta ennustus, enne kui selle käivitad ([muutujate väärtuste järjekord](https://opentofu.org/docs/language/values/variables/)).
- Käivita read ükshaaval ja kirjuta tegelik väärtus ennustuse kõrvale.
- Pane kirja järjekord, milles allikat otsid.

**Kontroll:**

```bash
echo 'var.dns_servers' | tofu console
echo 'var.dns_servers' | TF_VAR_dns_servers='["1.1.1.1"]' tofu console
echo 'var.dns_servers' | tofu console -var 'dns_servers=["9.9.9.9"]'
printf 'dns_servers = ["8.8.8.8"]\n' > proov.auto.tfvars
echo 'var.dns_servers' | tofu console
rm proov.auto.tfvars
```

**Valmis, kui:**

- `NOTES.md`-s on iga rea ennustus ja tegelik väärtus;
- oskad nimetada allikad nõrgemast tugevamani;
- pärast `rm`-i annab esimene käsk jälle `terraform.tfvars`-i väärtuse.

Vihje: järjekord ja joonis on lehe [Viis VM-i muutujatega](syvenemine.md#28-miks-see-nii-tootab) lõpus.

??? success "Lahendus"
    Järjekord nõrgemast tugevamani: `default`, `TF_VAR_*`, `terraform.tfvars`, `*.auto.tfvars` (failinime tähestiku järjekorras), `-var` ja `-var-file` (käsurea järjekorras, viimane võidab). Üllatus on teine rida: keskkonnamuutuja kaotab `terraform.tfvars`-ile.

    ```bash
    echo 'var.dns_servers' | tofu console                                   # terraform.tfvars väärtus
    echo 'var.dns_servers' | TF_VAR_dns_servers='["1.1.1.1"]' tofu console  # ikka terraform.tfvars väärtus
    echo 'var.dns_servers' | tofu console -var 'dns_servers=["9.9.9.9"]'    # ["9.9.9.9"]
    printf 'dns_servers = ["8.8.8.8"]\n' > proov.auto.tfvars
    echo 'var.dns_servers' | tofu console                                   # ["8.8.8.8"]
    rm proov.auto.tfvars
    ```

    Kontroll: pärast `rm`-i annab esimene käsk jälle `terraform.tfvars`-i väärtuse ja `git status --short` ei näita `proov.auto.tfvars`-i. Pipeline'is tähendab see, et `TF_VAR_*` ei kirjuta üle väärtust, mis on repos `*.tfvars` failis.

### 4. Teine kaust, sama state

**Tase:** lihtne · **Eeldus:** [Moodul, moved ja state](lab-3-moodul-state.md)

State on nüüd bucketis. Paariline või pipeline töötab teises kaustas, kus pole ühtegi state-faili, ja peab nägema sama taristut ning sama lukku.

- Tee koodist koopia `/tmp/k04-teine` ilma state-failideta ja `init` sama backendiga.
- Kontrolli, et koopias pole state-faili, aga `state list` näitab samu aadresse.
- Ava samal ajal mõlemas kaustas `tofu console` ja vaata, kumb saab luku.
- Kustuta koopia.

**Kontroll:**

```bash
rm -rf /tmp/k04-teine && mkdir /tmp/k04-teine
cp *.tf backend.hcl /tmp/k04-teine/ && cp -r modules /tmp/k04-teine/
cd /tmp/k04-teine && tofu init -backend-config=backend.hcl
tofu state list
cd - && rm -rf /tmp/k04-teine
```

**Valmis, kui:**

- teises kaustas pole ühtegi state-faili;
- `tofu state list` näitab samu viit `module.vm[...]` aadressi;
- `NOTES.md`-s on kirjas, kumb `console` luku sai ja mida teine väljastas.

??? success "Lahendus"
    Teises kaustas pole state'i, on ainult viide: `init` kirjutab `.terraform/terraform.tfstate`-i backendi tüübi ja võtme ning iga käsk loeb objekti bucketist. `tofu console` vajab muutujaid, nii et kopeeri lukuproovi jaoks ka `terraform.tfvars`. Lukk on sama võtme kõrval, nii et teine `console` ebaõnnestub luku veaga.

    ```bash
    rm -rf /tmp/k04-teine && mkdir /tmp/k04-teine
    cp *.tf backend.hcl terraform.tfvars /tmp/k04-teine/ && cp -r modules /tmp/k04-teine/
    cd /tmp/k04-teine && tofu init -backend-config=backend.hcl > /dev/null
    find . -name '*.tfstate*' -not -path './.terraform/*' | wc -l    # 0
    jq -r '.backend.type, .backend.config.key' .terraform/terraform.tfstate
    tofu state list | grep -c '^module.vm'                            # 5
    tofu console      # samal ajal on esimeses kaustas tofu console lahti
    ```

    Kontroll: `find` annab `0`, `jq` annab `s3` ja sinu võtme, `grep -c` annab `5` ja teine `console` annab `Error acquiring the state lock` esimese luku ID-ga. Kui tegid lisaprojekti "Krüpteeritud state", vajab teine kaust ka `TF_VAR_state_passphrase`-i. Lõpus `cd - && rm -rf /tmp/k04-teine`.

## Keskmised ülesanded

### 5. Ketas kasvab lõpuni

**Tase:** keskmine · **Eeldus:** [Import, drift ja keskkonnad](lab-6-import-drift.md)

Monitooring teatab, et app01 `/` on 90 % täis. Keegi suurendas öösel web01 ketast UI-s, aga `df` näitab ikka vana suurust ja järgmine `tofu plan` tahab ketast tagasi väiksemaks.

- **Drift.** UI-s: web01 → **Hardware → Hard Disk → Disk Action → Resize**, lisa 2 GB. Vaata `tofu plan -refresh-only`-t ja tavalist plaani, proovi `tofu apply`-d ja loe, mida provider ütleb. Vii otsus ellu ainult koodiga.
- **Koodist lõpuni.** Kasvata app01 (Ubuntu, ext4) ja db01 (AlmaLinux, xfs) ketas koodist 14 GB peale ja failisüsteem töötaval masinal.
- Plaanis on ainult `~ update in-place`, ükski VM ei asendu ega taaskäivitu; `/health` on kogu aja UP, db01 andmebaas töötab edasi.
- Üks skript või Ansible'i task teeb mõlemal distrol sama töö ja teisel käivitusel ei muuda midagi.
- Sama skript töötab ka LVM-iga serveris (`pvresize` + `lvextend -r`).

**Kontroll:**

```bash
tofu plan | grep -E 'update in-place|must be replaced|Plan:'          # 2 to change, 0 to destroy
ssh kasutaja@<app01 IP> 'df -hT / | tail -1; cut -d. -f1 /proc/uptime'  # ~14G, uptime ei alanud nullist
ssh kasutaja@<db01 IP> 'df -hT / | tail -1'
tofu plan -detailed-exitcode > /dev/null; echo "kood $?"              # 0
```

**Valmis, kui:**

- web01 drift on koodis;
- app01 ja db01 `/` on umbes 14 GB ja uptime ei alanud nullist;
- teine skripti käivitus ei muutnud midagi;
- plaani kood on `0`;
- `NOTES.md`-s on kirjas, miks "tagasi koodis kirjeldatud olekusse" ketta puhul ei tööta.

??? success "Lahendus"
    Drift: `-refresh-only` näitab `size` 10 → 12, tavaline plaan tahab 10 peale tagasi ja provider keeldub kahandamast; koodis kirjeldatud oleku saaks taastada ainult VM-i asendusega. Õige otsus on web01 reale `disk = 12`. Koodist kasvatamisel teeb Proxmox ketta suuremaks töötava VM-i all, aga partitsioon ja failisüsteem jäävad samaks, kuni keegi need kasvatab: `growpart` → `resize2fs` (ext4) või `xfs_growfs <ühenduspunkt>` (xfs kasvab ainult ühendatuna), LVM-iga vahepeal `pvresize` ja `lvextend -r`. Skript loeb seadme ja partitsiooni numbri `findmnt`-ist ja `/sys`-ist, sest AlmaLinux ja Ubuntu pilvemallis on juurpartitsioon eri numbriga.

    ```bash
    # terraform.tfvars: web01 = { ..., disk = 12 }, app01 ja db01 = { ..., disk = 14 }
    tofu plan | grep -E 'size|Plan:' && tofu apply
    for h in <app01 IP> <db01 IP>; do ssh kasutaja@$h 'sudo bash -s' < grow-root.sh; done
    ```

    `grow-root.sh`:

    ```bash
    #!/usr/bin/env bash
    # Kasvatab juurfailisüsteemi ketta lõpuni ilma reboot'ita: partitsioon → (LVM PV → LV) → failisüsteem.
    # Kasutus control node'ilt: ssh kasutaja@<host> 'sudo bash -s' < grow-root.sh
    # Muu ühenduspunkt (nt teine ketas):     ssh kasutaja@<host> 'sudo bash -s -- /var/lib/mysql' < grow-root.sh
    # Idempotentne: kui midagi kasvatada pole, ei muuda midagi ja lõpeb koodiga 0.
    set -euo pipefail

    mnt=${1:-/}
    src=$(findmnt -no SOURCE "$mnt")         # /dev/sda1, /dev/sda4 või /dev/mapper/vg-root
    fstype=$(findmnt -no FSTYPE "$mnt")     # ext4 või xfs
    before=$(df -B1 --output=size "$mnt" | tail -1 | tr -d ' ')

    # grow_part <partitsioon>: ketta uus suurus kernelisse, siis partitsioon lõpuni
    grow_part() {
        local part=$1 disk num
        disk=$(lsblk -no PKNAME "$part")
        num=$(cat "/sys/class/block/$(basename "$(readlink -f "$part")")/partition")
        # virtio-scsi: Proxmoxi resize jõuab tavaliselt ise, rescan on ohutu ka siis, kui jõudis
        if [[ -w /sys/class/block/$disk/device/rescan ]]; then
            echo 1 > "/sys/class/block/$disk/device/rescan"
        fi
        # growpart: 0 = kasvatas, 1 + NOCHANGE = juba lõpuni, muu = viga
        local out rc=0
        out=$(growpart "/dev/$disk" "$num" 2>&1) || rc=$?
        if [[ $rc -ne 0 && $out != *NOCHANGE* ]]; then
            echo "growpart /dev/$disk $num: $out" >&2
            exit 1
        fi
        echo "partitsioon: ${out%%$'\n'*}"
    }

    if [[ $(lsblk -no TYPE "$src") == lvm ]]; then
        # LVM: kasvata PV-de partitsioonid, siis PV, siis LV koos failisüsteemiga (-r)
        vg=$(lvs --noheadings -o vg_name "$src" | tr -d ' ')
        while read -r pv; do
            grow_part "$pv"
            pvresize "$pv"
        done < <(pvs --noheadings -o pv_name -S "vg_name=$vg" | tr -d ' ')
        if [[ $(vgs --noheadings --units b -o vg_free "$vg" | tr -dc '0-9') -gt 0 ]]; then
            lvextend -r -l +100%FREE "$src"
        fi
    else
        grow_part "$src"
        case $fstype in
            ext4) resize2fs "$src" ;;
            xfs) xfs_growfs "$mnt" ;;   # xfs kasvab ainult ühendatuna, argument on ühenduspunkt
            *) echo "tundmatu failisüsteem: $fstype" >&2; exit 1 ;;
        esac
    fi

    after=$(df -B1 --output=size "$mnt" | tail -1 | tr -d ' ')
    echo "$mnt ($fstype): $((before / 1024 / 1024)) MiB -> $((after / 1024 / 1024)) MiB"
    ```

    Kontroll: `df -hT /` näitab mõlemal umbes 14G, teine käivitus väljastab `NOCHANGE` ja sama suuruse, `/proc/uptime` jätkab ja plaani kood on `0`. Kontrollimata: kas provider'i versioon muudab `size`-i VM-i taaskäivitamata ja LVM-i osa (laboris LVM-i pole).

    **Miks nii.** Ketta kasvatamisel on kaks poolt, Proxmox ja OS, ja drift'i otsus on teistsugune kui RAM-iga, sest Proxmoxis saab ketast suurendada, aga mitte vähendada. LVM-i osa on skriptis, sest LVM on tööl tavalisem kui laboris.

### 6. Provisioner võrdluseks

**Tase:** keskmine · **Eeldus:** [Üks VM koodist](https://hkhk-tk.github.io/is1-automatiseerimine/k04/lab-1-uks-vm/)

Vanemates juhendites ja päritud repodes seadistatakse masin Tofu seest provisioner'iga. Teed seda korra, et näha, miks laboris kasutatakse selle asemel cloud-init'i ja Ansible'it.

- Kirjuta `01-alused/motd.sh`, mis kirjutab `/etc/motd`-i rea `test01: seadistas Tofu provisioner <kuupäev>`.
- Lisa `test01` ressursi sisse ajutiselt ([provisioner'ite süntaks](https://opentofu.org/docs/language/resources/provisioners/syntax/)) `connection` plokk (`type = "ssh"`, `user = "kasutaja"`, `agent = true`, `host = "<IS1_NET>.19"`) ja kolm provisioner'it: `file` (`motd.sh` → `/tmp/motd.sh`), `remote-exec` (`inline`: `chmod +x` ja `sudo /tmp/motd.sh`) ja `local-exec`, mis kirjutab control node'il faili `loodud.txt` rea `${self.name} ${self.vm_id}`.
- Võti peab olema agendis (`ssh-add -l`). Vaata `tofu plan`-i ja tee `tofu apply -replace=proxmox_virtual_environment_vm.test01`.
- Muuda `motd.sh`-is teksti ja käivita `tofu plan`.
- Eemalda lõpus kõik kolm provisioner'it ja `connection` plokk, kustuta `motd.sh` ja `loodud.txt`.

**Kontroll:**

```bash
ssh kasutaja@<IS1_NET>.19 cat /etc/motd
cat loodud.txt
tofu plan -detailed-exitcode > /dev/null; echo "kood $?"
```

**Valmis, kui:**

- pärast `-replace`-i on motd paigas;
- `loodud.txt`-is on rida `test01 <vm_id>`;
- `NOTES.md`-s on kirjas, mida `plan` ütles pärast skripti muutmist ja miks;
- koodis pole ühtegi provisioner'it.

??? success "Lahendus"
    Provisioner käivitub ainult ressursi loomisel ja tema sisend pole ressursi atribuut, nii et skripti muutus plaani ei jõua. Kui `remote-exec` ebaõnnestub, märgib Tofu VM-i `tainted` ja järgmine plaan asendab selle. Mõlemad on põhjused, miks seadistus kuulub malli, cloud-init'i või Ansible'isse.

    ```bash
    cat > motd.sh <<'EOF'
    #!/usr/bin/env bash
    set -euo pipefail
    echo "test01: seadistas Tofu provisioner $(date +%F)" > /etc/motd
    EOF
    ```

    ```hcl
      # test01 ressursi sees, ajutiselt
      connection {
        type  = "ssh"
        user  = "kasutaja"
        agent = true
        host  = "<IS1_NET>.19"
      }

      provisioner "file" {
        source      = "${path.module}/motd.sh"
        destination = "/tmp/motd.sh"
      }

      provisioner "remote-exec" {
        inline = ["chmod +x /tmp/motd.sh", "sudo /tmp/motd.sh"]
      }

      provisioner "local-exec" {
        command = "echo '${self.name} ${self.vm_id}' >> ${path.module}/loodud.txt"
      }
    ```

    Kontroll: `ssh kasutaja@<IS1_NET>.19 cat /etc/motd` näitab rida tänase kuupäevaga, `cat loodud.txt` näitab `test01 <vm_id>`, pärast `motd.sh` muutmist annab `tofu plan -detailed-exitcode` koodi `0`.

    **Miks nii.** Pärast `motd.sh` muutmist ütleb `plan` "No changes": skripti sisu ei ole ühegi ressursi atribuut ja provisioner käivitub ainult loomisel. Töötavale VM-ile jõuab muudatus ainult `-replace`-iga.

### 7. Sama kood Terraformiga

**Tase:** keskmine · **Eeldus:** [Üks VM koodist](https://hkhk-tk.github.io/is1-automatiseerimine/k04/lab-1-uks-vm/); mida rohkem koodi sul on, seda rohkem võrdlus näitab

Töökohas on kood tõenäoliselt kirjutatud Terraformile. Käivitad oma OpenTofu koodi `terraform`-iga ja võrdled kahe tööriista plaane, et teaksid, millised kohad üle ei kandu.

1. Paigalda Terraform HashiCorpi apt-repost ([juhend](https://developer.hashicorp.com/terraform/install)); kui Packer on paigaldatud, jäta kaks esimest rida vahele.

    ```bash
    wget -qO- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp.gpg
    echo "deb [signed-by=/usr/share/keyrings/hashicorp.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
    sudo apt-get update && sudo apt-get install -y terraform
    terraform version
    ```

2. Kaks koopiat ilma state'i, backendi ja `.terraform/`-ita; `SRC` on sinu viimane töötav kood.

    SRC=~/kursus/k04-tofu/01-alused
    rm -rf /tmp/k04-tf && mkdir -p /tmp/k04-tf/tofu /tmp/k04-tf/terraform
    for d in tofu terraform; do rsync -a --exclude .terraform/ --exclude '*.tfstate*' \
      --exclude 'backend.*' --exclude build/ "$SRC"/ /tmp/k04-tf/$d/; done
    ls /tmp/k04-tf/terraform

3. Mõlemas `init` ja salvestatud plaan (token keskkonnast), siis plaanide võrdlus tegevuste kaupa.

    cd /tmp/k04-tf/tofu && tofu init -input=false && tofu plan -out=p.tfplan
    cd /tmp/k04-tf/terraform && terraform init -input=false && terraform plan -out=p.tfplan
    grep '^provider' /tmp/k04-tf/*/.terraform.lock.hcl
    ```

    F='.resource_changes[] | "\(.change.actions | join(",")) \(.address)"'
    (cd /tmp/k04-tf/tofu && tofu show -json p.tfplan | jq -r "$F" | sort) > /tmp/k04-tf/tofu.txt
    (cd /tmp/k04-tf/terraform && terraform show -json p.tfplan | jq -r "$F" | sort) > /tmp/k04-tf/tf.txt
    diff /tmp/k04-tf/tofu.txt /tmp/k04-tf/tf.txt && echo sama
    ```

4. Kui sul on testid, käivita koopias `terraform test`; kui tegid krüpteeritud state'i lisaprojekti, vaata, mida `terraform init` ütleb `encryption.tf` kohta.
5. Koopias `apply`-d ei tee. Lõpus `rm -rf /tmp/k04-tf`: plaanifailis on muutujate väärtused, ka token.

**Kontroll:**

```bash
diff /tmp/k04-tf/tofu.txt /tmp/k04-tf/tf.txt && echo sama
grep -h -A1 '^provider' /tmp/k04-tf/*/.terraform.lock.hcl
ls /tmp/k04-tf 2>/dev/null || echo koristatud
```

**Valmis, kui:**

- `diff` ütleb `sama`;
- `NOTES.md`-s on mõlema lukufaili provider'i aadress ja põhjus, miks need erinevad;
- `NOTES.md`-s on `terraform test`-i ja (kui see sul on) `encryption.tf`-i tulemus;
- `/tmp/k04-tf` on kustutatud.

??? success "Lahendus"
    Plaan on sama, sest mõlemad loevad sama HCL-i ja käivitavad sama provider'i binaari. Erinev on registry aadress lukufailis, seepärast ei sobi OpenTofu lukufail Terraformile ega vastupidi. `terraform test` toetab `mock_provider`-it alates 1.7. `encryption` plokk on ainult OpenTofus, nii et `terraform init` ebaõnnestub selle failiga koopias.

    ```bash
    grep -h -A1 '^provider' /tmp/k04-tf/*/.terraform.lock.hcl
    (cd /tmp/k04-tf/terraform && terraform test 2>&1 | tail -1)
    (cd /tmp/k04-tf/terraform && cp ~/kursus/k04-tofu/encryption.tf . && terraform init 2>&1 | grep -iE -m2 'error|encryption')
    rm -rf /tmp/k04-tf
    ```

    Kontroll: `diff` väljastab `sama`, lukufailides on sama `version` kahe eri registry aadressiga, `terraform test` lõpeb `Success!`-iga ja `encryption.tf`-iga koopias annab `terraform init` vea `encryption` ploki kohta. Kontrollimata: Terraformi veateate täpne tekst (Terraformi selles kontrollis polnud).

    **Miks nii.** Kõik toimub koopias, kus on oma tühi kohalik state; Labori seisu state'i Terraform ei puuduta. Kahe tööriistaga ühe state'i peal võib kumbki state'i omal moel üle kirjutada ja hoida lukku, mida teine ei oota, ja krüpteeritud state'i Terraform üldse ei loe. Koopia state on tühi ja plaan tahab kõik ressursid luua `+`-na, sest see state ei tea, et need VM-id on juba olemas. `apply` prooviks teha teise VM-i sama `vm_id`-ga: Proxmox keelduks, aga pooleli jäänud töö tuleks ikkagi käsitsi koristada.

### 8. user-data templatefile'iga

**Tase:** keskmine · **Eeldus:** [Viis VM-i muutujatega](https://hkhk-tk.github.io/is1-automatiseerimine/k04/lab-2-viis-vmi/)

Proxmoxi cloud-init vahekaart annab ainult kasutaja, võtme ja võrgu. Kõik muu, mis esimesel käivitusel vaja, peab tulema oma user-data failist.

- Renderda `extras/user-data.yaml.tftpl` `templatefile`-iga iga VM-i jaoks ja vaata tulemust `tofu console`-is (`local.user_data["web01"]`).
- Anna renderdatud fail koolitajale: snippet'i üleslaadimine vajab node'ile SSH-ligipääsu ja sinu tokenil seda õigust pole.
- Viita snippet'ile mooduli `initialization.user_data_file_id`-ga ja eemalda `user_account` plokk.
- Loe plaan enne `apply`-d.

**Kontroll:**

```bash
echo 'local.user_data["web01"]' | tofu console
tofu validate
grep -c user_account modules/vm/main.tf
tofu plan
```

**Valmis, kui:**

- `tofu console` näitab web01 renderdatud user-data't;
- `initialization` viitab `user_data_file_id`-le ja `grep -c user_account` annab `0`;
- `tofu validate` on OK ja plaan näitab igal VM-il `user_data_file_id` muutust.

??? success "Lahendus"
    `templatefile` renderdab faili plaani ajal, nii et viga template'is tuleb välja `console`-is enne, kui midagi üles laaditakse. Snippet asendab Proxmoxi genereeritud user-data tervikuna: kasutaja ja võti tulevad nüüd template'ist, mitte `user_account` plokist.

    ```bash
    cp extras/user-data.tf.example user-data.tf
    echo 'local.user_data["web01"]' | tofu console
    ls build/*-user.yaml          # pärast apply'd; anna koolitajale
    ```

    ```hcl
    # modules/vm/variables.tf
    variable "user_data_file_id" {
      description = "cloud-init user-data snippet, nt local:snippets/is1-<github>-web01-user.yaml"
      type        = string
    }

    # modules/vm/main.tf, initialization plokis user_account ploki asemel
        user_data_file_id = var.user_data_file_id

    # main.tf, module "vm" sees
      user_data_file_id = "local:snippets/is1-<github>-${each.key}-user.yaml"
    ```

    Kontroll: `tofu validate` on OK, `grep -c user_account modules/vm/main.tf` annab `0` ja `tofu plan` näitab igal VM-il `user_data_file_id` muutust. Mooduli muutujad `username` ja `ssh_public_key` jäävad kasutuseta; eemalda need või jäta teadlikult. Kontrollimata: kas `user_data_file_id` muutus on provider'is in-place või asendus. Loe plaan enne `apply`-d, ja `apply` ebaõnnestub, kui koolitaja pole snippet'it üles laadinud.

    **Miks nii.** `user_account` ja `user_data_file_id` on omavahel konfliktis: Proxmox kasutab kas enda genereeritud või sinu user-data't, mitte mõlemat.

### 9. tofu test Proxmoxi vastu

**Tase:** keskmine · **Eeldus:** [Viis VM-i muutujatega](https://hkhk-tk.github.io/is1-automatiseerimine/k04/lab-2-viis-vmi/) · **Esita:** `k04-tofu/tests/integration/it01.tftest.hcl`

Mock-testid ei leia viga, mis tuleb välja alles Proxmoxis: vale mall, puuduv õigus, agent, mis ei vasta. Vaja on test, mis loob Proxmoxis VM-i, kontrollib seda ja koristab enda järel.

- Testifail ilma `mock_provider`-ita: üks `run` `command = apply`-ga.
- `variables` annab ühe VM-i: `vm_id` = `IS1_VMID_BASE` + 9, IP `.19`, `inventory_path = "build/inventory-it.ini"`.
- `assert`: `module.vm["it01"].agent_ipv4` sisaldab sinu IP-d.
- Tavaline `tofu test` seda testi ei käivita.

**Kontroll:**

```bash
time tofu test -test-directory=tests/integration
tofu test | tail -1
```

**Valmis, kui:**

- integratsioonitest on `pass`;
- tavaline `tofu test` käivitab ainult `tests/` kausta mock-teste;
- UI-s pole pärast testi `it01`-te;
- `NOTES.md`-s on testi kestus.

??? success "Lahendus"
    `tofu test` hoiab state'i mälus ja kustutab lõpus kõik, mis `run` lõi; backend'i ja Labori seisu state'i see ei puuduta. Ülejäänud muutujad tulevad `terraform.tfvars`-ist, token keskkonnast.

    ```hcl
    # tests/integration/it01.tftest.hcl: loob tegeliku VM-i
    # Käivita: tofu test -test-directory=tests/integration
    variables {
      inventory_path = "build/inventory-it.ini"
      vms = {
        it01 = { vm_id = 1109, ip = "10.10.1.19/16", distro = "ubuntu", cores = 1, memory = 512, group = "web" }
      }
    }

    run "it01_agent" {
      command = apply

      assert {
        condition     = contains(module.vm["it01"].agent_ipv4, "10.10.1.19")
        error_message = "agent ei teatanud IP-d 10.10.1.19: kontrolli malli qemu-guest-agent'i ja cloud-init'i"
      }
    }
    ```

    ```bash
    time tofu test -test-directory=tests/integration
    tofu test | tail -1          # ainult mock-testid, VM-i ei loo
    ```

    Kontroll: esimene käsk näitab `run "it01_agent"... pass` ja `Success! 1 passed`, teine ainult `tests/` kausta teste ja UI pool'is pole `it01`-te. Kui katkestad testi Ctrl+C-ga enne koristust, jääb `it01` alles ja see tuleb UI-s kustutada. `vm_id` ja IP on näites `IS1_VMID_BASE` 1100 ja võrk `10.10.1.0`.

    **Miks nii.** Fail on alamkaustas, sest tavaline `tofu test` (ka [Esitamise](https://hkhk-tk.github.io/is1-automatiseerimine/k04/lab-9-esitamine/) värskes kloonis) loeb ainult `tests/` kausta faile ega tohi VM-i luua. `-test-directory=tests/integration`-iga loob Tofu VM-i, ootab agenti, kontrollib ja kustutab lõpus.

### 10. Plaani kokkuvõte pipeline'i jaoks

**Tase:** keskmine · **Eeldus:** [Elutsükkel ja kaitsed](lab-5-elutsukkel.md) · **Esita:** `k04-tofu/plan-summary.sh`

Pikk plaan PR-i kommentaaris jääb lugemata. Ülevaataja vajab ühte vaadet, mis ütleb, mida kustutatakse.

- Skript teeb `tofu plan -out` ja loeb `tofu show -json`-ist `resource_changes`.
- Iga muudetava ressursi kohta rida `<tegevus> <aadress>`, lõpus loendid `create`, `update`, `delete`, `replace`.
- Väljumiskood: 0, kui muudatusi pole, 2, kui on, ja 3, kui mõni kustutatav aadress on db01.
- Lisalipud lähevad `tofu plan`-ile; plaanifail ei jää kettale.

**Kontroll:**

```bash
shellcheck plan-summary.sh
./plan-summary.sh; echo "kood $?"
./plan-summary.sh -replace='module.vm["web01"].proxmox_virtual_environment_vm.this'; echo "kood $?"
./plan-summary.sh -destroy; echo "kood $?"
```

**Valmis, kui:**

- ShellCheck ei anna hoiatusi;
- puhta plaaniga on neli nulliga loendit ja kood `0`;
- db01 kaitsete juures tehtud `create_before_destroy` prooviga annab `-replace` rea `replace module.vm["web01"]…` ja koodi `2`;
- `-destroy` annab koodi `3`.

??? success "Lahendus"
    `actions` on asenduse korral kaks elementi: `["delete","create"]` või `create_before_destroy`-ga `["create","delete"]`. Sorteeritud kujul on need üks juhtum. `no-op` ja `read` pole muudatused. Plaanifailis on muutujate väärtused, ka token, nii et `trap` kustutab selle.

    ```bash
    #!/usr/bin/env bash
    # Plaani kokkuvõte: rida iga muudetava ressursi kohta ja loendid.
    # Väljumiskood: 0 = muudatusi pole, 2 = on muudatusi, 3 = db01 kustutatakse või asendatakse, 1 = viga
    set -euo pipefail
    cd "$(dirname "$0")"

    plan=summary.tfplan
    trap 'rm -f "$plan"' EXIT
    # "$@": lisalipud tofu plan-ile, nt -destroy või -replace=<aadress>
    tofu plan -input=false -lock-timeout=60s -out="$plan" "$@" > /dev/null

    summary=$(tofu show -json "$plan" | jq -c '[.resource_changes[]?
        | (.change.actions | sort) as $a
        | select($a != ["no-op"] and $a != ["read"])
        | {address, action: (if $a == ["create", "delete"] then "replace" else $a[0] end)}]')

    jq -r '.[] | "\(.action) \(.address)"' <<< "$summary"
    for a in create update delete replace; do
        printf '%s: %s\n' "$a" "$(jq --arg a "$a" '[.[] | select(.action == $a)] | length' <<< "$summary")"
    done

    if jq -e '[.[] | select(.action == "delete" or .action == "replace")
               | select(.address | contains("[\"db01\"]"))] | length > 0' <<< "$summary" > /dev/null; then
        echo "plan-summary: db01 kustutatakse või asendatakse" >&2
        exit 3
    fi
    [[ "$(jq length <<< "$summary")" -eq 0 ]] && exit 0
    exit 2
    ```

    Kontroll: `shellcheck plan-summary.sh` vaikib. Puhta plaaniga annab `./plan-summary.sh; echo $?` neli nulliga loendit ja `0`. Ajutise `create_before_destroy`-ga moodulis annab `./plan-summary.sh -replace='module.vm["web01"].proxmox_virtual_environment_vm.this'` rea `replace module.vm["web01"].proxmox_virtual_environment_vm.this` ja koodi `2`. `./plan-summary.sh -destroy` annab `delete` rea db01 kohta ja koodi `3`: Proxmoxi `protection` plaani ei peata.

### 11. db01 teine ketas

**Tase:** keskmine · **Eeldus:** [Elutsükkel ja kaitsed](lab-5-elutsukkel.md)

db01 andmed on süsteemikettal, nii et iga malli uuendus ja `-replace` viib ka andmed kaasa. Andmekaust peab olema eraldi kettal.

- Lisa moodulisse teine `disk` (`scsi1`, 5 GB) `dynamic` plokiga, vaikimisi väljas, ja lülita see sisse ainult db01-le.
- Ansible'iga: `community.general.filesystem` uuele kettale ja `ansible.posix.mount` → `/var/lib/mysql`.
- Mount peidab kõik, mis kaustas enne oli, ja MariaDB alustab tühja kataloogiga. Laboris on baas tühi või Ansible'iga taastatav; tootmises tee enne dump, kopeeri andmed uuele kettale ja kontrolli taastamist.
- Teine Ansible'i käivitus ei muuda midagi.

**Kontroll:**

```bash
tofu plan | grep -E 'update in-place|must be replaced|Plan:'
cd ../k02-ansible && ansible-playbook site.yml --limit db01 && cd -
ssh kasutaja@<db01 IP> 'df -h /var/lib/mysql; ls -Zd /var/lib/mysql'
curl -s http://<web01 IP>/health; echo
```

**Valmis, kui:**

- db01-l näitab `df -h /var/lib/mysql` umbes 5 GB ketast;
- plaanis muutus ainult db01 ja ükski VM ei asendunud;
- teine Ansible'i käivitus annab db01-l `changed=0`;
- MariaDB töötab ja `/health` on UP.

??? success "Lahendus"
    Ketas tuleb Tofust, failisüsteem ja mount Ansible'ist, sest ainult Ansible näeb VM-i sisse. Play käib enne rolli `mariadb`, et ka uus db01 saaks andmekausta kohe õigele kettale. db01 on AlmaLinux: uue failisüsteemi juurel pole `mysqld_db_t` silti ja ilma `restorecon`-ita keelab SELinux MariaDB-l sinna kirjutamise. XFS, sest ext4 `lost+found` paistaks MariaDB-s andmebaasina.

    ```hcl
    # modules/vm/main.tf, pärast esimest disk plokki
      dynamic "disk" {
        for_each = var.data_disk > 0 ? [var.data_disk] : []
        content {
          datastore_id = var.datastore
          interface    = "scsi1"
          size         = disk.value
          discard      = "on"
          ssd          = true
        }
      }
    # modules/vm/variables.tf: variable "data_disk" { type = number, default = 0 }
    # variables.tf vms objektis: data_disk = optional(number, 0); main.tf: data_disk = each.value.data_disk
    # terraform.tfvars db01 real: data_disk = 5
    ```

    ```yaml
    # k02-ansible/db-disk.yml; site.yml-is enne play'd "Andmebaas": - import_playbook: db-disk.yml
    - name: Andmeketas db hostidele
      hosts: db
      gather_facts: true
      vars:
        db_data_dev: /dev/disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi1
        db_data_mounted: "{{ ansible_facts['mounts'] | selectattr('mount', 'equalto', '/var/lib/mysql') | list | length > 0 }}"
      tasks:
        - name: MariaDB pakett (kasutaja mysql ja teenus)
          ansible.builtin.dnf:
            name: mariadb-server
            lock_timeout: 120
        - name: MariaDB seisma, kuni andmekaust kolib
          ansible.builtin.service:
            name: mariadb
            state: stopped
          when: not db_data_mounted
        - name: Failisüsteem uuele kettale (olemasolevat ei vorminda)
          community.general.filesystem:
            dev: "{{ db_data_dev }}"
            fstype: xfs
        - name: Mount ja fstab
          ansible.posix.mount:
            path: /var/lib/mysql
            src: "{{ db_data_dev }}"
            fstype: xfs
            opts: defaults,nofail
            state: mounted
        - name: Andmekausta omanik
          ansible.builtin.file:
            path: /var/lib/mysql
            state: directory
            owner: mysql
            group: mysql
            mode: "0755"
        - name: SELinuxi silt
          ansible.builtin.command:
            cmd: restorecon -RFv /var/lib/mysql
          register: db_restorecon
          changed_when: db_restorecon.stdout | length > 0
    ```

    Kontroll: `tofu plan` näitab ainult db01 `~ update in-place` uue `disk` plokiga; pärast `ansible-playbook site.yml --limit db01` näitab `ssh kasutaja@<db01 IP> 'df -h /var/lib/mysql; ls -Zd /var/lib/mysql'` umbes 5 GB ketast ja `mysqld_db_t` silti, teine Ansible'i käivitus annab db01-l `changed=0` ja `/health` on UP. Kontrollimata: kas ketta lisamine töötavale VM-ile vajab provider'i versioonis restarti, ja seadme tee `/dev/disk/by-id/…-scsi1` (vaata `ls /dev/disk/by-id/`).

### 12. Poliitika plaanile Conftestiga

**Tase:** keskmine · **Eeldus:** [Elutsükkel ja kaitsed](lab-5-elutsukkel.md), [Conftest](https://www.conftest.dev/install/) control node'il (testitud 0.62) · **Esita:** `k04-tofu/policy/`, `k04-tofu/policy-check.sh`

`precondition` ja `check` on mooduli autori reeglid ja neid saab muuta igaüks, kes moodulit muudab. Organisatsiooni reeglid hoitakse eraldi ja neid hinnatakse plaani JSON-i peal.

- `policy-check.sh` teeb plaani, teisendab selle `tofu show -json`-iga ja käivitab `conftest test`; plaanifail ja JSON ei jää kettale.
- Keeld: VM, mille `tags` sisaldab `db`, kustutatakse või asendatakse (ka `create_before_destroy`-ga).
- Keeld: loodaval või muudetaval `db` VM-il pole `protection = true`.
- Keeld: VM-i `tags` pole plaani ajal teada (`after_unknown`).
- Hoiatus, mitte keeld: plaan kustutab või asendab üle ühe VM-i.
- Igal reeglil on `conftest verify` test.

**Kontroll:**

```bash
conftest verify --policy policy
./policy-check.sh; echo "kood $?"
./policy-check.sh -destroy; echo "kood $?"
./policy-check.sh -replace='module.vm["web01"].proxmox_virtual_environment_vm.this' \
  -replace='module.vm["app01"].proxmox_virtual_environment_vm.this'; echo "kood $?"
```

**Valmis, kui:**

- `conftest verify` läbib kõik testid;
- Labori seisu plaan annab `0 failures` ja koodi `0`;
- `-destroy` annab db01 keelu ja koodi `1`;
- kahe `-replace`-iga plaan annab hoiatuse ja koodi `0`.

??? success "Lahendus"
    Kustutamist loeb `"delete" in actions`, sest asendus on `["delete","create"]` või `["create","delete"]`. Kustutamisel on `after` tühi, nii et db tag'i otsitakse `before`-st. Teadmata tag'id annavad keelu, muidu läheks teise ressursi väljundist tag'i saav VM reeglitest vaikselt mööda. Mitme asenduse kohta on `warn`, sest malli vahetus asendab teadlikult mitu VM-i; `--fail-on-warn` teeks sellest keelu. Testid (`policy/plan_test.rego`, 10 juhtu) on lahenduste kaustas.

    ```rego
    # Organisatsiooni reeglid OpenTofu plaanile (tofu show -json).
    # Käivitus: conftest test --policy policy plan.json
    package main

    import rego.v1

    vms := [rc |
    	some rc in input.resource_changes
    	rc.type == "proxmox_virtual_environment_vm"
    ]

    # -/+ on ["delete","create"] või create_before_destroy-ga ["create","delete"]
    removes(rc) if "delete" in rc.change.actions

    writes(rc) if {
    	some a in rc.change.actions
    	a in {"create", "update"}
    }

    # 1. Andmebaasi VM-i ei kustuta ega asenda ükski plaan.
    deny contains msg if {
    	some rc in vms
    	removes(rc)
    	"db" in rc.change.before.tags
    	msg := sprintf("%s: db VM-i plaan ei kustuta ega asenda (actions %v)", [rc.address, rc.change.actions])
    }

    # 2. Iga loodav või muudetav db VM on Proxmoxis kustutamise eest kaitstud.
    deny contains msg if {
    	some rc in vms
    	writes(rc)
    	"db" in rc.change.after.tags
    	not rc.change.after.protection == true
    	msg := sprintf("%s: db VM-il peab olema protection = true", [rc.address])
    }

    # Terve list teadmata (true) või mõni element teadmata ([false, true])
    unknown_tags(rc) if rc.change.after_unknown.tags == true

    unknown_tags(rc) if true in rc.change.after_unknown.tags

    # 3. Fail-closed: kui tag'id selguvad alles apply's, ei saa reegleid 1-2 hinnata.
    deny contains msg if {
    	some rc in vms
    	writes(rc)
    	unknown_tags(rc)
    	msg := sprintf("%s: tags pole plaani ajal teada, poliitikat ei saa hinnata", [rc.address])
    }

    # 4. Hoiatus: üle ühe asenduse plaanis on suur kahjuraadius, aga võib olla teadlik (malli vahetus).
    warn contains msg if {
    	n := count([rc | some rc in vms; removes(rc)])
    	n > 1
    	msg := sprintf("plaan kustutab või asendab %d VM-i, kaalu -target'ita lainet: üks host, siis ülejäänud", [n])
    }
    ```

    ```bash
    #!/usr/bin/env bash
    # Plaan → JSON → Conftest. Väljumiskood: 0 = reeglid lubavad, 1 = keeld või viga.
    # Lisalipud lähevad tofu plan-ile, nt ./policy-check.sh -destroy
    set -euo pipefail
    cd "$(dirname "$0")"

    plan=policy.tfplan
    json=policy-plan.json
    # Plaanifailis ja JSON-is on muutujate väärtused, ka token
    trap 'rm -f "$plan" "$json"' EXIT

    conftest verify --policy policy
    tofu plan -input=false -lock-timeout=60s -out="$plan" "$@" > /dev/null
    tofu show -json "$plan" > "$json"
    conftest test --policy policy --no-color "$json"
    ```

    Kontroll: `conftest verify --policy policy` annab `10 tests, 10 passed` (sinu testide arv võib erineda). `./policy-check.sh; echo $?` annab `0 failures` ja `0`. `./policy-check.sh -destroy; echo $?` annab `FAIL` rea `module.vm["db01"]…: db VM-i plaan ei kustuta ega asenda` ja `1`. Kahe `-replace=`-iga (web01 ja app01) on tulemus `1 warning` ja `0`. Proxmoxi `protection` jääb ikka vajalikuks: poliitika näeb ainult plaani, UI-st kustutamist mitte.

    **Miks nii.** Teadmata tag'idega VM-i kohta ei saa kahte esimest reeglit hinnata, nii et reegel peab keelduma, mitte vaikima.

## Rasked ülesanded

### 13. Golden image AlmaLinuxile ja ühe hosti kaupa

**Tase:** raske · **Eeldus:** [Golden image Packeriga](lab-7-kuldne-mall.md)

Laboris viisid Ubuntu malli esmalt rmq01-le `-target`-iga. See jättis koodi ja tegelikkuse vahele akna, mille ajal tavaline plaan tahtis rmq01 tagasi viia. Nüüd peab uus AlmaLinuxi mall jõudma esmalt ühele masinale ilma `-target`-ita ja rollback olema üks rida.

- Packeri kausta teine `source` (`clone_vm = "tpl-alma-9"`, `ssh_username = "almalinux"`, `tags = "labseis-base;alma"`) ja teine `build`: `shell` samm `dnf -y upgrade`, `ansible` samm `groups = ["alma"]` ja `labseis_firewalld=true`. Ehita ainult AlmaLinuxi mall: `packer build -only='proxmox-clone.labseis_alma' .`; Ubuntu mall jääb samaks.
- `vms` objektile väli `template = optional(string)`; mooduli `template_id` eelistab hosti välja ja kasutab muidu distro malli.
- Data source loeb ka hostide malle, mitte ainult distrode omi.
- Plaanis on täpselt üks asendus (mc01), db01 jääb pilvemallile.
- Vale distro mall hostil (Ubuntu mall mc01-l) peatab plaani enne `apply`-d.
- Rollback on `terraform.tfvars`-is üks rida ja asendab ainult mc01.

**Kontroll:**

```bash
tofu test                                                       # sh sinu hostipõhise malli run
tofu plan -no-color | grep -E '# .* must be replaced|Plan:'     # ainult module.vm["mc01"]…, 1 to add, 1 to destroy
ssh kasutaja@<IS1_NET>.14 'getenforce; systemctl is-active firewalld; cat /etc/motd'
tofu plan -detailed-exitcode > /dev/null; echo "kood $?"        # 0
```

**Valmis, kui:**

- `packer build` tegi AlmaLinuxi malli;
- mc01-l annab `getenforce` `Enforcing` ja `firewalld` on `active`;
- db01 jäi pilvemallile ja plaani kood on `0`;
- rollback'i plaan (`template` mc01 realt ära) asendab ainult mc01;
- `NOTES.md`-s on järjekord, milles viiksid tootmises uue malli db01-le, ja mida enne seda varundad.

??? tip "Lahenduse suund"
    - **Packer.** Teine `source "proxmox-clone"` ja teine `build` eraldi failis samas kaustas. Paralleelne ehitus vajab AlmaLinuxile oma `vm_id`-d ja ehitus-IP-d (nt `IS1_VMID_BASE` + 8 ja `.18`); Packer nõuab kõiki muutujaid ka `-only`-ga. Malli nimesse pane distro (`labseis-base-alma-<kuupäev>`): sama kuupäevaga Ubuntu mall annaks nime järgi otsingus kaks vastet. Koristussammus on `/home/alma/.ssh/authorized_keys`, mitte `ubuntu` oma; manifest eraldi faili ja `.gitignore`-i.
    - **Data source.** Teine `data "proxmox_virtual_environment_vms"`, mille `for_each` on hostid, kellel on `template` (võti host, mitte malli nimi). Siis saab `tags = ["labseis-base", each.value.distro]` koos nime `filter`-iga ja `postcondition` `length(self.vms) == 1` peatada vale distro malli.
    - **Valik.** `locals`-is map host → mall: `v.template != null ? data…host_template[name].vms[0] : local.templates[v.distro]`. `coalesce`-iga map'i otsing ebaõnnestub, kui hosti malli data source'i pole.
    - **Test.** `override_data` hosti malli data source'ile (sihtmärk on ressurss, mitte instants: ilma `["mc01"]`-ta) ja `assert`, et mc01 `template_id` on uue malli ID ja db01 oma pilvemalli ID.
    - **Lõks.** `template_names = { alma = … }` tundub lihtsam, aga asendaks db01 ja `apply` jääks pooleli: mc01 on asendatud, db01 juures Proxmox keeldub.

    **Miks nii.** AlmaLinuxi mall erineb Ubuntu omast kolmes kohas: pilvemalli vaikekasutaja on `almalinux`, pakette haldab `dnf` ja rollis `common` on AlmaLinuxil tulemüür `firewalld` sees ning SELinux peab olema `Enforcing`. Ühe kausta kaks allikat ehitab Packer paralleelselt, `-only` ehitab ühe. AlmaLinuxi mallis on db01, millel on `protection`: kui paned `template_names`-isse `alma`, tahab plaan asendada ka db01 ja Proxmox keeldub poole `apply` pealt. Seepärast valitakse mall hosti, mitte distro kaupa.

### 14. mc01 ja rmq01 LXC-na

**Tase:** raske · **Eeldus:** [Intsident](lab-8-intsident.md)

Täis-VM kahe väikese teenuse jaoks raiskab RAM-i kerneli ja süsteemiteenuste peale, mida konteiner jagaks hostiga. Näidis `extras/lxc.tf.example` ei ole valmis lahendus: see paneb mõlemale `type = "centos"`, kuigi rmq01 on Ubuntu, ja inventory ei tea konteineritest midagi.

- Vii mc01 ja rmq01 ressursile `proxmox_virtual_environment_container`; konteinerid on `unprivileged`.
- mc01 ja rmq01 hoiavad oma IP-d, nii et app01 seadeid ei muudeta.
- VM ja konteiner jagavad Proxmoxis ID-ruumi ja sama IP-d: plaan, mis kustutab VM-i ja loob konteineri, ei tohi neid paralleelselt teha.
- Rolli `common` SELinuxi kontroll ja `firewalld` ei tööta konteineris nagu VM-is, aga VM-ide kontroll peab jääma.
- Inventory tuleb ikka Tofust: konteineri real on `ansible_user=root`, sest näidise mallis on võti root'il ja kasutajat `kasutaja` pole.
- VM-i asendamine konteineriga kustutab VM-i koos kettaga. Laboris on mc01 ja rmq01 andmed ajutised; tootmises tühjenda järjekord ja kontrolli taastamist enne vahetust.

**Kontroll:**

```bash
tofu state list | grep -c proxmox_virtual_environment_container   # 2
ssh root@<IS1_NET>.14 systemd-detect-virt                          # lxc
cd ../k02-ansible && ansible all -m ansible.builtin.ping -o && cd -
curl -s http://<web01 IP>/health; echo
tofu plan -detailed-exitcode > /dev/null; echo "kood $?"           # 0
```

**Valmis, kui:**

- `tofu state list`-is on kaks konteinerit ja `systemd-detect-virt` annab `lxc`;
- `ansible all -m ansible.builtin.ping` vastab kõigilt hostidelt ja `/health` on UP;
- db01 SELinuxi kontroll käib endiselt;
- plaani kood on `0`;
- `NOTES.md`-s on RAM-i võrdlus VM-iga ja põhjendus, kuidas lahendasid SELinuxi ja tulemüüri konteineris.

??? tip "Lahenduse suund"
    - **Kaks `apply`-d.** Tofu ei tea, et VM ja konteiner jagavad `vm_id`-d ja IP-d, sest nende vahel pole sõltuvust. Esimene samm: eemalda mc01 ja rmq01 `vms`-ist ja tee `tofu apply` (mitte `up.sh`: inventory's pole siis `cache`/`queue` gruppi ja `site.yml` ebaõnnestuks). Teine samm: lisa `containers` ja `./up.sh`. Vahepeal on teenused maas: see on hooldusaken.
    - **Muutuja.** `containers` objektis on `distro`, millest tuleb `operating_system.type` (`centos` AlmaLinuxile, `ubuntu` Ubuntule) ja inventory distro grupp. `validation`, et konteineri ja VM-i nimed ega `vm_id`-d ei kattu.
    - **Inventory.** `locals`-is üks map kõigist hostidest (VM-id mooduli väljunditest, konteinerid ressursi `initialization` IP-st) koos hostipõhiste muutujatega; template kirjutab need rea lõppu. `labseis_firewalld=false` hostimuutujana, sest grupimuutujas võidaks sama sügavusega `alma` grupp tähestiku järgi.
    - **Roll `common`.** SELinuxi kontrolli tingimusele `ansible_facts['virtualization_type'] != "lxc"`. Konteinerit piirab hosti AppArmor ja võrku Proxmoxi tulemüür (lisaprojekt "Tulemüür koodis", `network_interface { firewall = true }`).
    - **Kontroll ja lõks.** `tofu test` mock'iga: konteiner on õiges grupis õigete muutujatega. Unustatud `ssh-keygen -R` annab Ansible'is host key vea ainult siis, kui `host_key_checking` on sees; käsitsi `ssh` annab selle kindlasti.

### 15. Ühe hosti taastamine

**Tase:** raske · **Eeldus:** [Intsident](lab-8-intsident.md) · **Esita:** `k04-tofu/rebuild.sh`

`up.sh` loob kogu stacki, aga intsidendis on tavaliselt katki üks masin ja kõiki teisi ei taha sa puutuda. Näidis `extras/rebuild.sh` teeb `tofu apply -replace` ühe hosti peal, käivitab `ansible-playbook site.yml --limit <host>` ja kontrollib `/health`, aga tootmises ei pea see vastu kolmele olukorrale.

- `rebuild.sh <host>` keeldub, kui plaanis on peale selle hosti asenduse midagi muud.
- Korraga töötab üks `rebuild.sh`, ka Ansible'i sammu ajal.
- Kui töö katkeb pärast asendust (Ansible ebaõnnestub, Ctrl+C), ei asenda korduskäivitus VM-i uuesti, vaid jätkab Ansible'ist.
- Kaitstud host (`protection = true` state'is) ja tundmatu host keeldutakse enne plaani; workspace on `default`.
- `apply` ei küsi kinnitust, aga kasutab ainult kontrollitud plaani.

**Kontroll:**

```bash
shellcheck rebuild.sh
./rebuild.sh db01; echo "kood $?"                                   # 1, kaitstud
./rebuild.sh web01 & sleep 2; ./rebuild.sh web01; echo "kood $?"    # teine: 1, töötab juba
ssh kasutaja@<web01 IP> 'cut -d. -f1 /proc/uptime'                    # pärast katkestust ja korduskäivitust
```

**Valmis, kui:**

- ShellCheck vaikib ja `rebuild.sh db01` keeldub;
- ajutise RAM-i muudatusega app01 `terraform.tfvars`-is keeldub `rebuild.sh web01` ja nimetab app01 aadressi;
- teine samaaegne käivitus lõpeb kohe koodiga 1;
- Ctrl+C Ansible'i ajal ja korduskäivitus lõpevad `/health` UP-iga ilma uue asenduseta (web01 uptime on pikem kui korduskäivituse kestus);
- `NOTES.md`-s on aja võrdlus esimese `time ./up.sh`-iga.

??? tip "Lahenduse suund"
    - **Plaani kontroll.** `tofu plan -replace=<aadress> -out=<fail>`, siis `tofu show -json <fail>`. `jq`-ga vali `resource_changes`, mille `actions` pole `no-op` ega `read`; peale hosti enda aadressi (`["delete","create"]`) ei tohi midagi jääda. Siis `tofu apply <fail>`: salvestatud plaan ei küsi kinnitust ega arvuta plaani ümber. `trap` kustutab plaanifaili, sest selles on token.
    - **Lukk.** `flock -n` failikirjeldajal (`exec 9> build/rebuild.lock`). Kernel vabastab luku ka `kill -9` korral, PID-fail ei vabastaks.
    - **Jätkamine.** Marker (`build/rebuild-<host>.pending`) kirjutatakse kohe pärast edukat `apply`-d ja kustutatakse pärast `/health` UP-i. Kui marker on olemas, jäetakse plaan ja `apply` vahele.
    - **Kontroll.** Keeldumised saad proovida ilma Proxmoxita: pane `PATH`-i ette võlts-`tofu`, mis väljastab sinu valitud JSON-i.
    - **Lõks.** `if tofu state show … | grep` ei peata skripti, kui `state show` ebaõnnestub (`set -e` ei kehti tingimuses): loe väljund enne muutujasse. Ja `-target` ei ole lahendus esimesele piirangule: see peidab ootel muudatused, mitte ei näita neid.

    **Miks nii.** `tofu apply -replace=X` viib käiku kogu plaani, mitte ainult X-i: kui plaanis on mõne teise hosti ootel muudatus, läheb see kaasa ilma, et keegi seda nägi. State'i lukk kaitseb ainult Tofu sammu, nii et kaks samaaegset `rebuild.sh`-i võivad Ansible'i ajal teineteist segada.

### Lisaprojekt: tulemüür koodis

**Tase:** keskmine · **Eeldus:** [Elutsükkel ja kaitsed](lab-5-elutsukkel.md), `tofu plan` ütleb "No changes"

web01 võrgureeglid peavad olema koodis ja muutuma ilma VM-i uuesti tegemata. Proxmoxi tulemüür töötab hüperviisori tasemel, enne kui pakett VM-i jõuab.

- Moodulis `vm` muutuja `firewall_rules` (list objektidest, vaikimisi tühi); tulemüür lülitub sisse ainult siis, kui reegleid on.
- `proxmox_virtual_environment_firewall_options`: `enabled = true`, `input_policy = "DROP"`.
- `proxmox_virtual_environment_firewall_rules` reeglitest `dynamic` plokiga.
- `network_device` plokis `firewall = true` tulemüüriga VM-il.
- web01: TCP 80 `0.0.0.0/0`, TCP 22 ainult control node'ilt (`10.10.<nr>.10/32`).

**Kontroll:**

```bash
curl -sI http://<web01 IP> | head -1
ssh web01 true && echo ssh-ok
ssh app01 'timeout 3 bash -c "</dev/tcp/<web01 IP>/22"' || echo blokeeritud
tofu plan
```

**Valmis, kui:**

- `curl` ja `ssh` control node'ilt töötavad;
- app01-st on web01 port 22 blokeeritud;
- ühe reegli muutmise plaan on `~ update in-place` ja VM jääb alles.

Vihje: `DROP` blokeerib ka sinu SSH-i, kui port 22 reegel puudub; hoia teine sessioon lahti, kuni oled kontrollinud.

??? tip "Lahenduse suund"
    - **Moodul.** `local.firewall = length(var.firewall_rules) > 0`; mõlemad tulemüüri ressursid `count = local.firewall ? 1 : 0`, `vm_id` ja `node_name` VM-i ressursist. `network_device { firewall = local.firewall }`, mitte `true`: muidu muutuvad ilma kasuta kõigi viie VM-i võrgukaardid.
    - **Järjekord.** Valikute ressursil `depends_on` reeglitele. Vastupidi kehtiks `DROP` hetkeks ilma port 22 reeglita ja Ansible'i ühendus katkeks.
    - **Sisend.** `vms` objektis `firewall_rules = optional(list(object({…})), [])` ja `validation`: `proto` on tcp või udp, `source` parsib `cidrhost`-iga. Vigane CIDR peatub plaanis, mitte Proxmoxi API-s.
    - **Kontroll.** Mock-test: tulemüür on sees ainult web01-l (mooduli output), vale `source` ebaõnnestub `expect_failures = [var.vms]`-ga.
    - **Lõks.** Kui datacenter'i tasemel tulemüür on väljas (Datacenter → Firewall → Options), ei jõusta Proxmox VM-i reegleid ja app01-st jõuab port 22 ikka kohale. Plaan ja `apply` seda ei näita.

    **Miks nii.** `input_policy = "DROP"` tähendab, et kõik, mida reeglid ei luba, blokeeritakse, ka Ansible'i SSH-ühendus, kui unustad pordi 22. Seepärast lisa reeglid enne, kui valikud sisse lülitad, ja kontrolli kohe teisest hostist. Reeglid on VM-ist eraldi ressursid, nii et nende muutmine ei puuduta VM-i ega cloud-init'i. Võrdle hiljem AWS-i turvagrupiga kodutöös: mõte on sama, tase on teine.

    Tulemüür hüperviisori tasemel kehtib ka siis, kui keegi VM-i sees `ufw`-d või `firewalld`-d muudab. See on kaitse, mida VM-i sees töötav administraator ei saa kogemata välja lülitada.

### Lisaprojekt: Docker ja Kubernetes OpenTofuga

**Tase:** keskmine · **Eeldus:** 3. ja 7. kohtumise praktikumid: `docker ps` vastab ilma `sudo`-ta, `kubectl --kubeconfig ~/<github>.kubeconfig get pods -n is-<github>` vastab · **Esita:** `k04-tofu/lisa-docker/`, `k04-tofu/lisa-k8s/`

Sama OpenTofu tsükkel töötab ka konteinerite ja klastriga, ainult provider on teine. Haldad control node'i Dockerit ja oma Kubernetese namespace'i OpenTofuga ning võrdled tulemust Compose'i ja Argo CD-ga.

- Kaks eraldi juurmoodulit, kumbki oma kohaliku state'iga; Labori seisu state'i need ei puuduta.
- Docker: [`kreuzwerker/docker`](https://search.opentofu.org/provider/kreuzwerker/docker/latest) `~> 3.6`, `host = "unix:///var/run/docker.sock"`.
- `docker_network`, `docker_image` (`memcached:1.6-alpine`) ja `docker_container` `for_each`-iga: `mc-a` port 11311, `mc-b` port 11312, ühises võrgus.
- Kubernetes: `hashicorp/kubernetes` ja `hashicorp/helm` (Helm `~> 3.0`), `config_path = pathexpand("~/<github>.kubeconfig")`.
- `kubernetes_config_map_v1` namespace'is `is-<github>` ja `helm_release` sama chart'iga, mida kasutasid 7. kohtumisel: fikseeritud versioon, eraldi release'i nimi.
- Drift'i katse mõlemas: `docker stop mc-a` ja `kubectl edit configmap`, siis `tofu plan -refresh-only`.

**Kontroll:**

```bash
cd ~/kursus/k04-tofu/lisa-docker && tofu apply && docker ps --format '{{.Names}} {{.Ports}}'
printf 'stats\r\nquit\r\n' | nc -q1 127.0.0.1 11311 | head -2
docker stop mc-a && tofu plan -refresh-only | tail -3
cd ../lisa-k8s && tofu apply && helm list -n is-<github> --kubeconfig ~/<github>.kubeconfig
tofu destroy && cd ../lisa-docker && tofu destroy
```

**Valmis, kui:**

- kaks konteinerit vastavad oma pordil;
- peatatud konteiner ja muudetud ConfigMap on `-refresh-only` plaanis näha;
- Helm release on `helm list`-is;
- mõlemad kaustad on lõpuks `destroy`-ga koristatud;
- `NOTES.md`-s on kirjas, kumb tööriist sama asja sinu töökohas haldaks: Tofu, Compose või Argo CD.

Vihje: Helm provider'i 3. versioonis on `kubernetes = { config_path = … }` atribuut, mitte plokk.

??? tip "Lahenduse suund"
    - **Docker.** `locals`-is map nimi → port ja `docker_container` `for_each`-iga; `image = docker_image.memcached.image_id`, `networks_advanced` ühisele võrgule. Pordid ainult `127.0.0.1`-l: memcached'il pole autentimist. `docker_image`-il `keep_locally = true`, et `destroy` ei kustutaks image'it, mida Compose'i stack kasutab.
    - **Kubernetes.** Üks `locals.kubeconfig` mõlemale provider'ile; Helm 3.x-is `kubernetes = { config_path = … }` ja `set = [ { name, value }, … ]` list. `helm_release`: chart `oci://ghcr.io/stefanprodan/charts`-ist, `version` fikseeritud, release'i nimi teine kui 7. kohtumisel.
    - **Drift.** Peatatud konteiner: `must_run = true` (vaikimisi) tõttu näeb refresh seda muutununa ja tavaline plaan tahab selle uuesti teha. ConfigMap'i käsitsi muudatus on `-refresh-only`-s `data` muutus.
    - **Kontroll.** `tofu validate` mõlemas kaustas enne `apply`-d; `kubernetes_config_map` ilma `_v1`-ta annab aegumise hoiatuse.
    - **Lõks.** Kumbki kaust on oma juurmoodul oma state'iga. Kui paned need Labori seisu kausta `*.tf` failide kõrvale, satub Docker Labori seisu state'i ja `up.sh` hakkab neid haldama.

    **Miks nii.** Vanemad Helm provider'i näited kasutavad `kubernetes` plokki ja ebaõnnestuvad `validate`-is. Internetist leitud näidet tasub võrrelda lukufailis oleva provider'i versiooniga: major-versioon võib süntaksit muuta, kuigi provider'i nimi jääb samaks.

    Docker provider teeb sama, mida `docker run`, aga hoiab tulemust state'is. Seepärast näeb Tofu peatatud konteinerit drift'ina, Compose aga ainult siis, kui keegi käivitab `docker compose up`. Ühe masina stacki jaoks on Compose lihtsam ja loetavam. Tofu Docker provider on kasulik siis, kui konteiner on osa suuremast taristust, näiteks registry või monitooringu agent, mis peab tekkima koos VM-iga.

    Kubernetese puhul on piir teravam. Kui sama objekti haldavad Tofu ja Argo CD, kirjutavad nad seda kordamööda üle ja kumbki näitab teise muudatust drift'ina. Tavaline jaotus on, et Tofu teeb klastri ja selle ümbruse (namespace'id, õigused, Argo CD ise) ning Argo CD haldab rakendusi Gitist. Seepärast on selle lisaprojekti release'il oma nimi ja see ei puutu 7. kohtumise Argo CD rakendust.

### Lisaprojekt: krüpteeritud state

**Tase:** raske · **Eeldus:** [Moodul, moved ja state](lab-3-moodul-state.md); state on bucketis ja plaan tühi · **Esita:** `k04-tofu/encryption.tf`

Koolitaja näeb bucketit ja seega kogu state'i: IP-d, võtmed, cloud-init'i väärtused ja ressursside argumentides olevad paroolid. State ja plaanid peavad olema ilma paroolita loetamatud ja parool vahetatav nagu lekkinud saladus.

- Enne: `tofu state pull > ~/k04-state-varu.json` ja ≥ 16-märgiline parool faili `~/.config/is1/state.pass`, mõlemad õigustega 600.
- Muutuja `state_passphrase`: `sensitive`, vaikeväärtuseta, `validation` ≥ 16 märki, väärtus `TF_VAR_state_passphrase`-ist.
- `key_provider "pbkdf2"` → `method "aes_gcm"` → `state` ja `plan` plokk, lõppolekus `enforced = true`.
- Üleminek: esimesel `apply`-l `method "unencrypted"` `fallback`-ina, pärast eemaldad selle.
- Vahetus: uus võti ja meetod kirjutavad, vana loeb `fallback`-ina; pärast `apply`-d jääb ainult uus.
- Ebaõnnestunud vahetuse järel loeb vana parool state'i edasi; enne vahetust on plaan tühi.
- Vana parool ei loe uut state'i ja jääb alles ainult bucketi vanemate versioonide jaoks, väljaspool repot, kuupäevaga.

**Kontroll:**

```bash
export TF_VAR_state_passphrase="$(cat ~/.config/is1/state.pass)"
tofu apply && tofu state list | wc -l
TF_VAR_state_passphrase=vale-parool-1234567 tofu plan 2>&1 | grep -i decrypt
rm -rf /tmp/k04-kr && mkdir /tmp/k04-kr && cp -r *.tf backend.hcl modules /tmp/k04-kr/
cd /tmp/k04-kr && rm encryption.tf && tofu init -backend-config=backend.hcl > /dev/null
tofu state list; cd - && rm -rf /tmp/k04-kr
```

Pärast vahetust:

```bash
export TF_VAR_state_passphrase="$(cat ~/.config/is1/state.pass)"            # uus
tofu plan -detailed-exitcode > /dev/null; echo "kood $?"                     # 0
TF_VAR_state_passphrase="$(cat ~/.config/is1/state.pass.<kuupäev>)" tofu plan 2>&1 | grep -m1 'decryption failed'
tofu test | tail -1
```

**Valmis, kui:**

- üleminekul ütles `apply` "No changes", õige parooliga on kõik ressursid näha, vale parooliga plaan ebaõnnestub;
- kaust ilma `encryption.tf`-ita ei saa state'i lugeda ja pärast `fallback`-i eemaldamist on plaan "No changes";
- pärast vahetust on uue parooliga plaani kood `0`, vana annab `decryption failed` ja `tofu test` on `Success!`;
- `~/k04-state-varu.json` on kustutatud või krüpteeritud.

Vihje: [state'i krüpteerimise dokumentatsioon](https://opentofu.org/docs/language/state/encryption/), näidis `extras/encryption.tf.example`.

??? tip "Lahenduse suund"
    - **Üleminek.** `unencrypted` meetod `fallback`-ina loeb vana state'i, `apply` kirjutab selle krüpteeritult ka siis, kui ressursse ei muutu (`serial` kasvab). Siis `fallback` ja `unencrypted` meetod välja, `enforced = true` sisse.
    - **Vahetus.** Kaks `key_provider "pbkdf2"` ja kaks `method "aes_gcm"` plokki korraga: uus kirjutab (`state.method`), vana loeb (`fallback`). Vana parool tuleb teisest muutujast (`TF_VAR_state_passphrase_old`). Pärast `apply`-d jääb ainult uus. Skriptis: enne `tofu plan -detailed-exitcode` (peab olema `0`), `serial` enne ja pärast `tofu state pull | jq .serial`-iga, ebaõnnestunud `apply` korral vana `encryption.tf` tagasi.
    - **Kontroll.** Uue parooliga plaan `0`, vanaga `decryption failed for all provided methods`, `serial` kasvas.
    - **Lõks 1.** Võtme allika nimi on state'i metaandmetes (`key_provider.pbkdf2.<nimi>`). Kui vahetuse ajal nimetad vana allika ümber, ütleb `fallback` `no decryption key available`. Uus põlvkond saab uue nime, vana kannab täpselt vana nime.
    - **Lõks 2.** `tofu state pull` väljastab lihtteksti: varukoopia `~/k04-state-varu.json` on krüpteerimata. Pärast edukat üleminekut kustuta see (`shred -u`) või krüpteeri eraldi. Enne vahetust salvestatud plaanifailidest ei saa pärast vahetust `apply`-d teha.

    **Miks nii.** Bucket kasutab HTTPS-i ja salvestus võib kettal olla krüpteeritud, aga mõlemal juhul näeb bucketi administraator faili sisu. Sisu krüpteerimise korral on objekt ilma paroolita loetamatu. Kui bucketis on versioonid sees, on alles ka varasemate state'ide paroolid, ja enne üleminekut kirjutatud versioonid on lihttekstis.

    Parool on nüüd sama tähtis kui state ise. Kui parool kaob, ei saa state'i enam lugeda. See võrdub state'i kaotusega ja Tofu ei tea enam, et viis VM-i on tema omad. Seepärast on varukoopia enne üleminekut vajalik ja tootmises hoitakse võtit võtmehalduses, mitte inimese mälus. Ka `tofu test` vajab nüüd parooli: krüpteerimine on osa konfiguratsioonist.

## Võrguinsenerile

Tööriist `vorgukogu` (1. kohtumise lisaülesanne 21) seni ainult luges ruuterite olekut. Siin muudad ruuterit samas tsüklis, mida OpenTofu tegi VM-idega: kood → plaan (diff jooksva konfiguratsiooniga) → apply → kontroll, et diff on tühi.

### 17. render.py: soovitud olek template'ist, diff ja apply { #17-renderpy-soovitud-seis-templateist-diff-ja-apply }

**Tase:** keskmine · **Eeldus:** [Import, drift ja keskkonnad](lab-6-import-drift.md), 1. kohtumise lisaülesanne 21 tehtud, koolitaja `rtr01`, `rtr02` ja `key chain lab` saladus · **Esita:** `vorgukogu/render.py`, `intent/`, `templates/frr.conf.j2`

Ruuteri konfiguratsiooni muudetakse `vtysh`-is käsitsi ja keegi ei tea, kas kahe ruuteri konfiguratsioon on sama loogikaga. Proovimuudatus on rtr01 marsruut `10.255.98.0/24 blackhole`.

- `requirements.txt`: `jinja2==3.1.*`.
- `intent/<ruuter>.yaml`: `hostname`, `interfaces` (nimi, `description`, `addresses`), `static_routes` (`prefix`, `nexthop`); alguses täpselt ruuteri praegune olek. `eth0`-l on ainult kirjeldus.
- `templates/frr.conf.j2` on kogu fail, ka koolitaja `key chain lab` saladusega `VORK_KEYCHAIN_SECRET`-ist.
- Ilma lippudeta: `build/<ruuter>/frr.conf` (saladus maskeeritud), ruuterisse ühendumata; vigane aadress või puuduv väli annab koodi 1.
- `--diff`: Netmikoga jooksva konfiguratsiooni unified diff, saladused maskeeritud; erinevusega kood 3, ilma 0. Ebaõnnestunud ruuter: kood 2, teine tehakse ikka.
- `--apply` ainult `--diff`-i ja saladusega: `vtysh -C -f`, `frr-reload.py --reload`, `write memory`, siis tühi diff.

**Kontroll:**

```bash
cd ~/kursus/vorgukogu && . .venv/bin/activate
export VORK_USER=kasutaja VORK_KEY_FILE=~/.ssh/id_ed25519_labseis
read -rsp 'key chain lab saladus: ' VORK_KEYCHAIN_SECRET && export VORK_KEYCHAIN_SECRET
python render.py && grep -c 'key-string \*\*\*' build/*/frr.conf
python render.py --diff; echo "kood $?"
# intent/rtr01.yaml static_routes alla: - {prefix: 10.255.98.0/24, nexthop: blackhole}
python render.py --diff; echo "kood $?"
python render.py --diff --apply --only rtr01; echo "kood $?"
ssh kasutaja@<IS1_NET>.21 "vtysh -c 'show ip route 10.255.98.0/24'" | head -3
ssh kasutaja@<IS1_NET>.21 "sudo grep -c '10.255.98.0/24' /etc/frr/frr.conf"
python render.py --diff; echo "kood $?"
# rida intent/rtr01.yaml-ist maha, siis uuesti --diff --apply --only rtr01
```

**Valmis, kui:**

- `build/` failides on mask (iga faili kohta `1`) ja esimene `--diff` annab koodi `0`;
- marsruudi lisamise järel näitab diff ainult rida `+ip route 10.255.98.0/24 blackhole` ja kood on `3`;
- `--apply` annab `OK rtr01: rakendatud ja salvestatud` ja koodi `0`, marsruut on ruuteris ja `frr.conf`-is üks kord;
- järgmine `--diff` annab `0`;
- pärast tagasivõtmist näitab `python vorgukogu.py` sama `show-running-config.txt`-i mis alguses.

Vihje: koolitaja baasi taastamine: `sudo cp -p /etc/frr/frr.conf.baas /etc/frr/frr.conf && sudo /usr/lib/frr/frr-reload.py --reload /etc/frr/frr.conf`.

??? success "Lahendus"
    See on IaC võrgu jaoks: YAML on soovitud olek, template on seadme süntaks ja `--diff` on plaan. `frr-reload.py --reload` võrdleb faili jooksva konfiguratsiooniga ja saadab `vtysh`-ile ainult lisatavad ja kustutatavad read: daemonid ei käivitu uuesti ja muutmata marsruudid jäävad paigale. Kuna fail on terviklik, võtab reload maha kõik, mida template'is pole, seepärast on template'is ka koolitaja `key chain lab`; ilma saladuseta `--apply` keeldub. `normalize` järjestab plokid (rida ilma taandeta koos oma taandega ridadega), et FRR-i oma väljundi järjekord ei annaks erinevust. Fail läheb ruuterisse base64-na lühikeste tükkidena, sest pikk käsurida murdub terminalis ja Netmiko ei tunne kaja ära; `unset HISTFILE` hoiab saladuse bash'i ajaloost väljas.

    ```yaml
    # rtr01 soovitud seis. Haldus-IP-d: rtr01 <IS1_NET>.21, rtr02 <IS1_NET>.22 (näites 10.10.7).
    hostname: rtr01
    interfaces:
      - name: eth0
        description: haldus          # ainult kirjeldus: aadressi annab cloud-init, mitte FRR
      - name: lo
        addresses: [10.255.255.1/32]
    static_routes:
      - {prefix: 10.255.255.2/32, nexthop: 10.10.7.22}   # rtr02 loopback haldusvõrgu kaudu
      - {prefix: 10.255.99.0/24, nexthop: blackhole}
    ```

    ```jinja
    {# Kogu /etc/frr/frr.conf: frr-reload.py --reload võtab maha kõik, mida siin pole. #}
    frr defaults traditional
    hostname {{ hostname }}
    log syslog informational
    service integrated-vtysh-config
    !
    {% for route in static_routes | default([]) %}
    ip route {{ route.prefix }} {{ route.nexthop }}
    {% endfor %}
    !
    {% for iface in interfaces %}
    interface {{ iface.name }}
    {% if iface.description is defined %}
     description {{ iface.description }}
    {% endif %}
    {% for address in iface.addresses | default([]) %}
     ip address {{ address }}
    {% endfor %}
    exit
    !
    {% endfor %}
    {# koolitaja baas: ilma selle plokita kustutaks reload key chain'i #}
    key chain lab
     key 1
      key-string {{ keychain_secret }}
     exit
    exit
    !
    ```

    ```python
    #!/usr/bin/env python3
    """render: soovitud seis (intent/<ruuter>.yaml) + mall -> frr.conf; diff jooksva konfiga; rakendus.

    Kasutus (kaustast vorgukogu/, venv aktiivne, VORK_* nagu vorgukogu.py-l):
        python render.py                    # kirjutab build/<ruuter>/frr.conf, ruuterisse ei ühendu
        python render.py --diff             # + diff ruuteri jooksva konfiga, midagi ei muuda
        python render.py --diff --apply     # + rakendab erinevuse frr-reload.py-ga ja salvestab

    Väljumiskood: 0 korras (--diff: erinevust pole), 3 --diff leidis erinevuse,
    2 mõne ruuteriga ebaõnnestus, 1 seadistuse viga.
    """

    from __future__ import annotations

    import argparse
    import base64
    import difflib
    import ipaddress
    import os
    import sys
    from pathlib import Path

    import yaml
    from jinja2 import Environment, FileSystemLoader, StrictUndefined

    import vorgukogu

    HERE = Path(__file__).resolve().parent
    REMOTE_FILE = "/tmp/vorgukogu-frr.conf"
    FRR_RELOAD = "/usr/lib/frr/frr-reload.py"
    CHUNK = 200
    # Read, mida FRR lisab ise ja mis ei ole soovitud seisu osa
    IGNORED = ("frr version", "Building configuration", "Current configuration")


    def load_intent(path: Path) -> dict:
        """Loeb ühe ruuteri soovitud seisu ja kontrollib aadresside kuju enne malli."""
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        for key in ("hostname", "interfaces"):
            if key not in data:
                raise vorgukogu.ConfigError(f"{path}: puudub {key}")
        for iface in data["interfaces"]:
            for addr in iface.get("addresses", []):
                ipaddress.ip_interface(addr)  # ValueError, kui pole kujul 10.0.0.1/30
        for route in data.get("static_routes", []):
            ipaddress.ip_network(route["prefix"])  # ValueError, kui hostibitid on sees
        return data


    def render(intent: dict, secret: str, templates: Path = HERE / "templates") -> str:
        """Täidab malli. StrictUndefined: puuduv muutuja on viga, mitte tühi rida."""
        env = Environment(
            loader=FileSystemLoader(templates),
            undefined=StrictUndefined,
            trim_blocks=True,
            lstrip_blocks=True,
            keep_trailing_newline=True,
        )
        return env.get_template("frr.conf.j2").render(**intent, keychain_secret=secret)


    def normalize(config: str) -> list[str]:
        """Võrdluseks: ilma FRR-i päise, tühjade ja '!' ridadeta, saladused maskeeritud.

        Plokid (rida ilma taandeta + selle taandega read) järjestatakse, et FRR-i oma
        väljundi järjekord ei annaks erinevust, mida tegelikult pole.
        """
        blocks: list[list[str]] = []
        for line in vorgukogu.mask_secrets(config).splitlines():
            line = line.rstrip()
            if not line.strip() or line.strip() == "!" or line.startswith(IGNORED) or line == "end":
                continue
            if line.startswith(" ") or line == "exit":
                if blocks:
                    blocks[-1].append(line)
                continue
            blocks.append([line])
        return [line for block in sorted(blocks) for line in block]


    def config_diff(running: str, wanted: str, host: str) -> list[str]:
        """unified diff: '-' on ruuteris, aga mitte koodis; '+' on koodis, aga mitte ruuteris."""
        return list(
            difflib.unified_diff(
                normalize(running),
                normalize(wanted),
                fromfile=f"{host} (jooksev)",
                tofile=f"{host} (intent)",
                lineterm="",
            )
        )


    def apply_config(conn, wanted: str) -> str:
        """Fail ruuterisse, süntaksikontroll, erinevuse rakendus ja salvestus."""
        # bash'i ajalukku ei lähe midagi: failis on key chain'i saladus
        conn.send_command("unset HISTFILE; umask 077; : > " + REMOTE_FILE + ".b64")
        payload = base64.b64encode(wanted.encode()).decode()
        # lühikesed tükid: pikk käsurida murdub terminalis ja Netmiko ei tunne kaja ära
        for i in range(0, len(payload), CHUNK):
            conn.send_command(f"printf %s {payload[i : i + CHUNK]} >> {REMOTE_FILE}.b64", cmd_verify=False)
        steps = [
            f"base64 -d {REMOTE_FILE}.b64 > {REMOTE_FILE}",
            # vtysh -C: FRR-i kuivkäivitus, parsib iga rea ja ei rakenda midagi
            f"sudo -n vtysh -C -f {REMOTE_FILE}",
            # rakendab ainult erinevuse jooksva konfiga; daemonid ei käivitu uuesti
            f"sudo -n {FRR_RELOAD} --reload {REMOTE_FILE}",
            "sudo -n vtysh -c 'write memory'",
        ]
        log = []
        try:
            for step in steps:
                # kaja on "VORK_$((40+2))", väljund "VORK_42": kaja ei lähe õnnestumiseks
                out = conn.send_command(f"{step} && echo VORK_$((40+2))", read_timeout=60)
                log.append(out)
                if "VORK_42" not in out:
                    raise RuntimeError(f"samm ebaõnnestus: {step}\n{out.strip()}")
        finally:
            conn.send_command(f"rm -f {REMOTE_FILE} {REMOTE_FILE}.b64")
        return "\n".join(log)


    def main(argv: list[str] | None = None, env: dict | None = None, connect=vorgukogu.ConnectHandler) -> int:
        parser = argparse.ArgumentParser(description="Soovitud seis -> frr.conf, diff ja rakendus.")
        parser.add_argument("--inventory", type=Path, default=Path("inventory.yaml"))
        parser.add_argument("--intent", type=Path, default=Path("intent"))
        parser.add_argument("--build", type=Path, default=Path("build"))
        parser.add_argument("--only", action="append", help="ainult see ruuter (võib korrata)")
        parser.add_argument("--diff", action="store_true", help="võrdle ruuteri jooksva konfiga")
        parser.add_argument("--apply", action="store_true", help="rakenda erinevus (vajab --diff)")
        args = parser.parse_args(argv)
        env = dict(os.environ) if env is None else env
        if args.apply and not args.diff:
            parser.error("--apply ainult koos --diff-iga: muudatust ei tehta ilma plaanita")

        secret = env.get("VORK_KEYCHAIN_SECRET")
        if args.apply and not secret:
            print("VIGA: --apply vajab VORK_KEYCHAIN_SECRET-i (muidu kustuks key chain)", file=sys.stderr)
            return 1
        try:
            devices, _ = vorgukogu.load_inventory(args.inventory)
            creds = vorgukogu.credentials(env) if args.diff else {}
        except vorgukogu.ConfigError as e:
            print(f"VIGA: {e}", file=sys.stderr)
            return 1
        if args.only:
            devices = [d for d in devices if d["name"] in args.only]
        known_hosts = Path(env.get("VORK_KNOWN_HOSTS", args.inventory.parent / "known_hosts"))

        rc = 0
        for device in devices:
            name = device["name"]
            try:
                intent = load_intent(args.intent / f"{name}.yaml")
                if intent["hostname"] != name:
                    raise vorgukogu.ConfigError(f"intent/{name}.yaml: hostname on {intent['hostname']}")
                # ilma saladuseta renderdus (CI, --diff) paneb maski: võrdlus maskeerib nagunii
                wanted = render(intent, secret or vorgukogu.MASK)
            except (OSError, ValueError, KeyError, vorgukogu.ConfigError) as e:
                print(f"VIGA {name}: {e}", file=sys.stderr)
                return 1
            vorgukogu.write_atomic(args.build / name / "frr.conf", vorgukogu.mask_secrets(wanted))
            if not args.diff:
                print(f"OK   {name}: {args.build / name / 'frr.conf'}")
                continue
            try:
                params = vorgukogu.connect_params(device, creds, known_hosts)
                with connect(**params) as conn:
                    running = conn.send_command("vtysh -c 'show running-config'", read_timeout=30)
                    vorgukogu.check_running_config(vorgukogu.strip_header(running), name)
                    diff = config_diff(running, wanted, name)
                    if not diff:
                        print(f"OK   {name}: erinevust pole")
                        continue
                    print("\n".join(diff))
                    if not args.apply:
                        rc = max(rc, 3)
                        continue
                    apply_config(conn, wanted)
                    after = conn.send_command("vtysh -c 'show running-config'", read_timeout=30)
                    left = config_diff(after, wanted, name)
                    if left:
                        print("\n".join(left))
                        raise RuntimeError("pärast rakendust on erinevus alles")
                    print(f"OK   {name}: rakendatud ja salvestatud")
            except Exception as e:  # üks ruuter ei peata teisi
                reason = str(e).splitlines()[0] if str(e) else ""
                print(f"FAIL {name}: {type(e).__name__}: {reason}", file=sys.stderr)
                rc = 2
        return rc


    if __name__ == "__main__":
        sys.exit(main())
    ```

    Kontroll: ülesande kontrollkäsud. Kui esimene `--diff` näitab sama rida `-` ja `+` poolel, erineb ainult tühik või kirjapilt (FRR kirjutab `ip route` ilma kauguseta, kui see on vaikimisi); kirjuta intent ruuteri kujule. Täislahendus: `labori-seis/deploy/lisa-lahendused/k04/vork-render/`. Kontrollimata: koolitaja FRR-ruuteri ja Netmikoga; kontrollitud võlts-ruuteriga testides (template, aadressi kontroll, diff ilma saladuseta, `--apply` ja teine `--diff` tühi). Koolitaja ruuteril vaata enne esimest `--apply`-d, kas `frr-reload.py --test /etc/frr/frr.conf` on tühi: muidu on salvestatud ja ruuteris kehtiv konf juba erinevad.

    **Miks nii.** [Jinja2](https://jinja.palletsprojects.com/) on sama template engine, mida kasutab Ansible'i `template`. Intent'i alguseks on `out/<ruuter>/show-running-config.txt`. `eth0` aadressi annab cloud-init, mitte FRR, nii et template ei tohi seda liidest aadressiga kirjeldada. `--apply` vajab saladust, sest muidu kustutaks reload `key chain lab` ploki. Koolitaja ruuterid on Ubuntu 24.04 + FRR 10.x, `kasutaja` on grupis `frrvty` ja paroolita `sudo`-ga; 1. kohtumise lisaülesande 21 järel annab `python vorgukogu.py` `OK`. Päis on `frr defaults traditional`, `hostname`, `log syslog informational` ja `service integrated-vtysh-config`, nagu ruuteris praegu. Vigase aadressi näited on `10.0.0.300/32` ja `10.0.0.1/24` marsruudi prefiksina (hostibitid sees). Apply käib ainult eraldi lipuga ja ainult pärast plaani.

## Arutelu

Need on kohad, kus laboriülesanded jätsid otsuse sinu teha. Vasta `NOTES.md`-s.

1. **Üks VM.** Tootmises on `-/+` andmebaasi masinal õnnetus. Mis peaks su töökohas olemas olema, et keegi seda rida enne `apply`-d näeks?
2. **Moodul ja state.** Pipeline'i käivitus katkes keset `apply`-d ja lukk jäi maha. Kuidas tead, et `force-unlock` on ohutu?
3. **Import ja drift.** Kolleeg muudab tootmises VM-i RAM-i käsitsi ja järgmine `apply` võtab selle tagasi. Kas viga on kolleegis või protsessis?
4. **Golden image.** Mall ehitati kuu aega tagasi ja vahepeal tuli kolm turvauuendust. Kas ehitad malli uuesti ja asendad masinad või lased Ansible'il uuendused peale panna? Mis otsustab?
5. **Esitamine.** Automaatse hindaja tulemus on roheline, aga `/health` on DOWN. Milline kontroll peaks pipeline'is olema, et see vahe välja tuleks?

## Kodutöö

Kodutöö viib sama mudeli AWS-i: provider ja ressursid on teised, kood, state ja plaan töötavad samamoodi. Drift'i kontroll on intsidendiülesande viimase kontrolli automaatne versioon: kui see käivitub iga tund, on intsidendi avastus ajajoonel minutid, mitte hommik.

| Issue | Mis | Juhend |
|---|---|---|
| `K4.K` | AWS: VPC, turvagrupid, võtmepaar, EC2, väljund → Ansible | [4. kohtumise kodutöö](../kodutood/k04-aws.md) |
| `K4.M` | Monitooring: drift'i kontroll `plan -refresh-only -detailed-exitcode`-iga | `kodutood/monitooring.md` → 4. kohtumine |
