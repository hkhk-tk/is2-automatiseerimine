---
tags:
  - Packer
  - OpenTofu
  - Proxmox
  - Ansible
---

# Praktikum: golden image Packeriga

Tee see leht pärast lehte [Import, drift ja keskkonnad](lab-6-import-drift.md), sest uut malli proovid dev-workspace'is. Packeri paigaldad control node'ile HashiCorpi apt-paketihoidlast, pluginad on `hashicorp/proxmox` ja `hashicorp/ansible`.

Iga VM luuakse pilvemallist, mille sees on ainult Ubuntu ja agent, nii et Ansible teeb igal uuel masinal uuesti paketid, kasutajad, motd ja tulemüüri seadistuse. Käsitsi klõpsitud mallist ei tea keegi poole aasta pärast, mis seal sees on. Packeriga ehitad koodist golden image'i `labseis-base-<kuupäev>`. Selles on roll `common` juba sees ja OpenTofu jaoks on see lihtsalt teine `clone` allikas, mida valid muutujaga. Lõpuks on mall dev01 peal proovitud ja Labori seisu Ubuntu masinad tulevad sellest.

Enne alustamist peab `tofu workspace show` andma `default` ja `tofu plan` ütlema "No changes".

**Kui teed seda tööl iga päev:** ehitad VM-i malle Packeriga, sinu `k04-tofu/packer/` kaustast tuli `packer build .`-iga mall `labseis-base-<kuupäev>` ja `tofu test` näitab `kuldne_mall… pass`. Kui see on sul juba korras, mine otse etappi „[Vii uus mall esmalt ühele hostile](#vii-uus-mall-esmalt-uhele-hostile)“.

## Paigalda Packer ja anna talle token

Packer kasutab sama tokenit mis OpenTofu ja loeb ühenduse keskkonnast nagu Tofu, aga tahab tokenit kahes osas: tokeni ID (`kasutaja@pve!nimi`) ja saladus (uuid). Need tulevad samast `proxmox.env` failist shelli asendustega, nii et ükski uus fail saladust ei hoia.

1. Paigalda Packer [ametlikust apt-paketihoidlast](https://developer.hashicorp.com/packer/install) ja kontrolli versiooni.

    ```bash
    wget -qO- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp.gpg
    echo "deb [signed-by=/usr/share/keyrings/hashicorp.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
    sudo apt-get update && sudo apt-get install -y packer
    packer version
    ```

2. Tee tokenist Packeri muutujad samas shellis.

    ```bash
    source ~/.config/is1/proxmox.env
    export PROXMOX_URL="${PROXMOX_VE_ENDPOINT%/}/api2/json"
    export PROXMOX_USERNAME="${PROXMOX_VE_API_TOKEN%%=*}"
    export PROXMOX_TOKEN="${PROXMOX_VE_API_TOKEN#*=}"
    echo "$PROXMOX_USERNAME"
    ```

`%%=*` lõikab ära kõik alates esimesest võrdusmärgist, `#*=` kõik kuni selleni. `echo` näitab ainult tokeni ID-d, mitte saladust. Kui see ID on sama, mida nägid `test01` loomisel Task History User veerus, on Packeri tegevus Proxmoxi logis sama tokeni nime all kui Tofu oma.

> Packer on HashiCorpi tööriist sama BSL litsentsiga, mille muutus tõi kaasa OpenTofu tekke. Oma taristu mallide ehitamiseks see ei loe. Kui sinu firmas on litsentside kohta reegel, kontrolli see enne üle.

**Edasi saad minna, kui** `packer version` vastab, `echo "$PROXMOX_USERNAME"` näitab tokeni ID-d `…@pve!…` ja `env | grep -c '^PROXMOX_'` annab vähemalt 3.

## Kirjuta mall koodina

Nüüd kirjutad kausta `k04-tofu/packer/` Packeri faili, mis kirjeldab ühe ehituse algusest lõpuni. Allikas on `proxmox-clone`: see kloonib olemasoleva malli, käivitab VM-i, ühendub SSH-ga, käivitab provisioner'id ja teeb VM-ist uue malli. Packeri keel on sama HCL, mida tunned Tofust, aga plokid on teised: `source` ütleb, kust alustada, `build` ütleb, mida teha.

Ilma koodita on mall must kast. Kui keegi küsib "kas uues mallis on turvauuendused", on ainus usaldusväärne vastus ehitusfail ja selle logi.

Nõuded ([`proxmox-clone` argumendid](https://developer.hashicorp.com/packer/integrations/hashicorp/proxmox/latest/components/builder/clone)):

- `variables.pkr.hcl`: ühendus `env("PROXMOX_URL")`, `env("PROXMOX_USERNAME")`, `env("PROXMOX_TOKEN")` vaikeväärtustest, saladusel `sensitive = true`; klassi väärtused (`node`, `pool`, `vm_id` = `IS1_VMID_BASE` + 7, `build_ip` = `<IS1_NET>.17/<IS1_MASK>`, `gateway`) failis `labseis.auto.pkrvars.hcl`, mis Giti ei lähe
- `labseis-base.pkr.hcl`: pluginad `github.com/hashicorp/proxmox` ja `github.com/hashicorp/ansible`; `locals`-is malli nimi `labseis-base-${local.date}`, kus kuupäev tuleb muutujast `build_date` või tühja korral `formatdate("YYYYMMDD", timestamp())`
- `source "proxmox-clone"`: `clone_vm = "tpl-ubuntu-2404"`, `cpu_type = "x86-64-v2-AES"`, `qemu_agent = true`, `ipconfig` ehitus-IP-ga, `cloud_init = true`, `tags = "labseis-base;ubuntu"` (ilma tag'ita `template`)
- `build`-is kolm sammu: `shell` (oota `cloud-init status --wait`, uuenda paketid), `ansible` (playbook `golden.yml`, mis käivitab rolli `common` kaustast `../../k02-ansible/roles`), `shell` koristus (machine-id, host key'd, `cloud-init clean`, ajutine võti `authorized_keys`-ist)
- `.gitignore`: `*.auto.pkrvars.hcl`, `manifest.json`, `packer_cache/`

1. Laadi pluginad ja kontrolli faile.

    ```bash
    cd ~/kursus/k04-tofu/packer
    packer init .
    packer fmt -check . && packer validate .
    git status --short .
    ```

Järjekord on sama mis Tofus: `init` laeb pluginad, `fmt` vormindab, `validate` kontrollib viiteid ja tüüpe ilma Proxmoxi poole pöördumata. Tag'i `template` puudumine on meelega. Tofu data source otsib pilvemalli tag'idega `template` ja `ubuntu` ning `postcondition` nõuab täpselt üht tulemust. Kui golden image'il oleks samad tag'id, ebaõnnestuks iga Tofu plaan enne, kui sa malli valinud oled.

> `validate` ütleb `Unset variable`: `labseis.auto.pkrvars.hcl` puudub või muutuja nimi ei klapi. `Failed to initialize plugin`: `packer init .` tegemata.

**Edasi saad minna, kui** `packer validate .` ütleb `The configuration is valid.`, `packer fmt -check .` vaikib ja `git status` ei näita `labseis.auto.pkrvars.hcl`-i.

## Ehita golden image

Nüüd lased Packeril malli ehitada. Ehitus kestab mitu minutit: kloon, boot, paketiuuendused, Ansible, koristus ja malliks muutmine. Vaata samal ajal UI-s, mis su pool'is toimub, sest nii näed, et Packer teeb sama, mida sina teeksid käsitsi, lihtsalt alati samas järjekorras.

Ilma koristussammuta jäävad machine-id ja SSH host key'd malli ning igal kloonil on sama identiteet. systemd-networkd tuletab machine-id-st DHCP DUID-i, nii et DHCP-ga kloonid võivad saada sama aadressi; journald ja monitooringu agendid näevad mitut masinat ühena.

1. Käivita ehitus ja mõõda aega.

    ```bash
    time packer build .
    jq -r '.builds[-1].custom_data.template_name' manifest.json
    ```

2. UI-s: vaata Task History'st, mis ülesanded Packer tegi ja millise kasutaja all. Ava uus mall ja vaata **Hardware**, **Cloud-Init** ja **Options**.
3. Leia väljundist ehituse kestus, malli nimi ja `vm_id`.

Packer kustutab ebaõnnestunud ehituse VM-i ise, nii et pooleli jäänud mall ei jää pool'i. Õnnestunud ehituse lõpus on pool'is uus mall, aga mitte ühtegi uut töötavat VM-i. Cloud-Init vahekaardil on mallil tühi draiv: IP ja võtme kirjutab sinna OpenTofu iga klooni jaoks eraldi, täpselt nagu pilvemalli puhul.

> Packer ootab `Waiting for SSH to become available` kuni timeout'ini: vaata UI-s ehitus-VM-i konsooli. Kui pilvemalli Cloud-Init vahekaardil on kasutaja, mis pole `ubuntu`, pane see `ssh_username`-iks.

**Edasi saad minna, kui** `packer build` lõpeb reaga `Build 'proxmox-clone.labseis_base' finished`, UI-s on mall `labseis-base-<kuupäev>` tag'idega `labseis-base` ja `ubuntu`.

## Vali mall muutujaga

Õpetad OpenTofule, et Ubuntu VM-id võivad tulla ka golden image'ist. Lisad muutuja, mis seob distro malli nimega, ja muudad data source'i nii, et see otsib nime järgi siis, kui nimi on antud, ja tag'ide järgi muidu. Labori seis jääb veel pilvemallile.

Malli nimi koodis tähendab, et iga malli vahetus on commit ja PR. Kui keegi küsib, millal web01 uuele mallile läks, vastab `git log`.

Nõuded:

- `variables.tf`: `template_names`, tüüp `map(string)`, vaikimisi `{}`; `validation`, et võti on `ubuntu` või `alma` ja nimi algab `labseis-base-`
- `data.tf`: `tags` on tingimusavaldis `? :`: kui `lookup(var.template_names, each.key, null)` on `null`, siis `[var.template_tag, each.key]`, muidu ainult `[each.key]`
- samas data source'is `dynamic "filter"` (`name = "name"`, `values = [<malli nimi>]`), mis tekib ainult siis, kui distrol on golden image
- `outputs.tf`: `template_source`, mis annab iga distro kohta `try(var.template_names[d], "pilvemall (tagid)")`
- `tests/vms.tftest.hcl`: `run "kuldne_mall"`, mis annab ubuntule golden image'i nime ja kontrollib `output.template_source`-i mõlemat distrot

1. Proovi avaldisi enne koodi kirjutamist konsoolis.

    ```bash
    cd ~/kursus/k04-tofu
    echo 'lookup({ ubuntu = "labseis-base-1" }, "alma", null) == null ? "tagid" : "nimi"' | tofu console
    echo 'try({ ubuntu = "x" }["alma"], "pilvemall")' | tofu console
    ```

2. Kirjuta muudatused, siis kontrolli.

    ```bash
    tofu validate && tofu test
    tofu plan | tail -1
    tofu output template_source
    ```

Plaan peab olema "No changes", sest `template_names` on tühi ja data source otsib endiselt tag'ide järgi. See tõestab, et uus kood ei muuda olemasolevat taristut enne, kui keegi seda teadlikult palub. `lookup` vaikeväärtusega ja `try` teevad sama tööd eri moel: esimene küsib mapist võtit ja annab puudumisel vaikeväärtuse, teine püüab kinni iga vea avaldises.

**Edasi saad minna, kui** `tofu test` näitab `kuldne_mall… pass`, `tofu plan` ütleb "No changes" ja `tofu output template_source` näitab mõlemale distrole `pilvemall (tagid)`.

## Proovi malli dev-is

Uus mall läheb kõigepealt masinale, mille rike kedagi ei mõjuta. Dev-workspace on just selleks: sama kood, teine state, üks väike VM. Seal kontrollid, et kloon saab oma identiteedi ja et `common` on juba sees.

Vigane mall, mis läheb otse Labori seisu, teeb vigaseks kõik masinad, mis sellest järgmisena tehakse. Dev-is maksab sama viga ühe VM-i.

1. Loo dev01 golden image'ist (`<nimi>` on `manifest.json`-ist).

    ```bash
    tofu workspace select dev
    tofu apply -var-file=env/dev.tfvars -var 'template_names={ubuntu="<nimi>"}'
    ssh-keygen -R <IS1_NET>.19
    ```

2. Kontrolli VM-i sees, et see on uus masin, mille alus on juba olemas.

    ```bash
    ssh kasutaja@<IS1_NET>.19 'cat /etc/motd; getent group labops; cloud-init status'
    ssh kasutaja@<IS1_NET>.19 'cat /etc/machine-id' ; ssh kasutaja@<IS1_NET>.11 'cat /etc/machine-id'
    ssh kasutaja@<IS1_NET>.19 'grep -c labori-seis /etc/hosts; ls /etc/ssh/ssh_host_ed25519_key'
    ```

3. Kustuta dev01 ja mine tagasi `default`-i.

    ```bash
    tofu destroy -var-file=env/dev.tfvars -var 'template_names={ubuntu="<nimi>"}'
    tofu workspace select default
    ```

motd ja grupp `labops` tõestavad, et roll `common` käivitus ehituse ajal ja tulemus jäi malli. Erinev machine-id dev01-l ja web01-l tõestab, et koristus töötas. `/etc/hosts`-is pole Labori seisu plokki, sest ehitus-VM-i aadress ei kuulu ühtegi teise masinasse. Selle ploki paneb `site.yml` õigete hostidega igal käivitusel. Kui machine-id oleks sama, peaksid malli uuesti ehitama, enne kui sellest ühtki VM-i teed.

**Edasi saad minna, kui** dev01 vastas `kasutaja`-na, motd ja `labops` olid olemas, machine-id erines web01 omast, dev01 on kustutatud ja `tofu workspace show` annab `default`.

## Vii uus mall esmalt ühele hostile

dev01 tõestas, et mall käivitub ja identiteet on puhas. See ei tõesta, et teenus töötab uue malli peal koos ülejäänud Labori seisuga. Tootmises läheb uus mall esmalt ühele hostile, mille rike on piiratud, ja ülejäänud tulevad alles siis, kui see host on teenuses. Siin on see host rmq01.

Piirang: korraga on asendamisel üks host, teised töötavad edasi ja enne järgmist sammu on `/health` UP. Ilma selleta läheb vigane mall kolmele hostile korraga ja rollback on kolm asendust.

`-target` piirab plaani ühe aadressi ja selle sõltuvustega. Hind on see, et pärast `apply`-d ei vasta tegelikkus enam koodile: `terraform.tfvars`-is pole veel `template_names`-i. See aken peab olema lühike ja selle sulgeb järgmine etapp.

1. Vaata ainult rmq01 plaani.

    ```bash
    T='module.vm["rmq01"]'
    M='template_names={ubuntu="<nimi>"}'
    tofu plan -target="$T" -var "$M" | grep -E 'forces replacement|Plan:'
    ```

2. Asenda rmq01 ja paigalda teenus ainult sellele hostile. Nõuded: `apply` puudutab ainult sama aadressi, mille plaani lugesid; vana host key on control node'i `known_hosts`-ist läinud nii nime kui IP järgi; Ansible käib ainult rmq01 peal; teised hostid ei saa ühtki muudatust. Kontroll:

    ```bash
    ssh -o StrictHostKeyChecking=accept-new kasutaja@<IS1_NET>.13 true; echo "kood $?"   # 0, vana võtit pole
    curl -s http://<web01 IP>/health; echo                    # kõik sõltuvused UP
    ```

3. Vaata, mida kood nüüd arvab, ja proovi `up.sh`-i.

    ```bash
    tofu plan | grep -E 'forces replacement|Plan:'
    ./up.sh; echo "kood $?"
    ```

4. **Mõtle:** mida tavaline plaan rmq01-ga teha tahab, miks `up.sh` keeldus ja mis juhtuks, kui keegi käivitaks selles aknas `ALLOW_DESTROY=1 ./up.sh`?

`-target`-iga plaan näitas ühte asendust ja jättis web01, app01 ja inventory puutumata. Tavaline plaan tahab rmq01 pilvemallile tagasi viia, sest kood ütleb endiselt pilvemall. `up.sh` keeldus, sest plaanis on kustutamine: kaitse töötab ka siin, aga ainult seni, kuni keegi seda teadlikult üle ei kirjuta. Seepärast on `-target` canary tööriist, mitte lõppseis. Hostipõhine malli valik koodis on lisaülesandes 13.

**Edasi saad minna, kui** `-target`-iga plaan oli `1 to add, 0 to change, 1 to destroy` ainult rmq01-ga, pärast rmq01 asendust oli `/health` UP, tavaline plaan tahtis rmq01 asendada ja `up.sh` keeldus koodiga 1.

## Vii Labori seis golden image'ile

Nüüd viid ülejäänud Ubuntu masinad uuele mallile ja paned malli nime koodi. Mall on `clone` ploki osa, nii et `test01` katsetest tead juba, mida plaan selle peale näitab. Siin näed, kuidas `up.sh` kaitse ja golden image koos töötavad: kaitse peatab, inimene loeb plaani ja lubab teadlikult.

Golden image'i vahetus on alati masinate asendus. Kui see läheb käiku ilma, et keegi plaani loeks, kaovad ka andmed, mis olid VM-i kettal. Meil on andmed ainult db01-l, mis on AlmaLinux ja jääb pilvemallile.

1. Pane `terraform.tfvars`-i `template_names = { ubuntu = "<nimi>" }` ja proovi.

    ```bash
    ./up.sh; echo "kood $?"
    tofu plan | grep -E 'forces replacement|Plan:'
    ```

2. **Ennusta:** millised masinad asendatakse ja miks db01, mc01 ja rmq01 mitte?
3. Luba asendus ja mõõda aega.

    ```bash
    time ALLOW_DESTROY=1 ./up.sh
    curl -s http://<web01 IP>/health; echo
    ```

4. Võrdle seda aega esimese `time ./up.sh` tulemusega ja Ansible'i `PLAY RECAP`-i `changed` arvu Ubuntu hostidel.

Plaan asendas kaks Ubuntu masinat ja jättis rmq01 ning kaks AlmaLinuxi masinat rahule: rmq01 on juba uuel mallil ja `template_names`-is on ainult `ubuntu`. Pärast seda `apply`-d vastab kood jälle tegelikkusele ja canary aken on suletud. Ansible'i esimene play andis Ubuntu hostidel vähem `changed`-e kui esimesel `up.sh` käivitusel, sest kasutajad, motd ja paketid olid juba olemas. `/etc/hosts` plokk ja hosti roll tulevad endiselt Ansible'ist, sest need sõltuvad sellest, millised masinad Labori seisus on.

> Rollback käib sama teed teistpidi: eemalda `template_names` või pane eelmise malli nimi ja `ALLOW_DESTROY=1 ./up.sh`. Seepärast ära kustuta eelmist malli enne, kui uus on vähemalt korra Labori seisus töötanud.

**Edasi saad minna, kui** `up.sh` keeldus esimesel korral, teisel korral lõppes koodiga 0, `/health` on UP, `tofu output template_source` näitab ubuntule sinu malli nime.

## Kaalu golden image'i ja cloud-init'i

Paned kirja otsuse, mis tööl tuleb teha iga paketi ja seade kohta: kas see läheb malli, cloud-init'i esimesse käivitusse või Ansible'i.

Kui see otsus jääb tegemata, kasvab mall vaikides ja keegi ei tea enam, milline seade tuleb kust. Siis parandatakse sama viga kahes kohas ja üks parandus jääb järgmisel ehitusel kaotsi.

Kirjuta `NOTES.md`-sse tabel kolme veeruga (Mall, cloud-init esimesel käivitusel, Ansible) ja pane igasse veergu vähemalt kaks oma Labori seisu asja. Tabeli alla kirjuta kolm lauset:

- mis juhtub golden image'iga kuu aja pärast, kui keegi seda uuesti ei ehita;
- miks IP, võti ja hostinimi ei saa malli minna;
- kui sageli peaks Labori seisu mall uuesti ehituma ja mis selle käivitaks.

Hea tabel näitab, et mall sisaldab ainult asju, mis on igas masinas samad ja muutuvad harva. Masinapõhine (IP, võti, nimi) on cloud-init'i töö ja kõik, mis sõltub teistest masinatest (`/etc/hosts`, teenuste seaded), on Ansible'i töö. Kui mõni rida on kahes veerus, on see koht, kus source of truth on segane.

**Edasi saad minna, kui** `NOTES.md`-s on kolme veeruga tabel ja kolm lauset ning iga tabeli rida on ainult ühes veerus.

## Commit

Commit'i läheb Packeri kood, Tofu muutuja ja test. Sinu klassi väärtused, manifest ja pluginate vahemälu jäävad control node'ile.

Packeri ehitus kirjutab manifesti ja vahemälu samasse kausta, kus kood on. Kui `.gitignore` neid ei kata, jõuab GitHubi ka sinu IP ja `vm_id`, ja järgmine kloon näeb faili, mis ei vasta tema keskkonnale.

```bash
cd ~/kursus
git status --short k04-tofu/packer
git add k04-tofu
git commit -m "k04: golden image Packeriga, template_names"
git push
```

`git status` peab näitama ainult `.pkr.hcl` faile, `golden.yml`-i, `.gitignore`-i ja näidisfaili. `terraform.tfvars` koos malli nimega jääb samuti Gitist välja; Gitis on `terraform.tfvars.example`, kuhu võid lisada kommentaarina näite. Automaatse hindaja `secrets` kontroll vaatab ka `packer/` kausta, sest see on `k04-tofu/` all.

**Edasi saad minna, kui** `bash autograde/check.sh k04 secrets` ja `bash autograde/check.sh k04 fmt` annavad `OK` ja `git ls-files k04-tofu/packer` ei näita `*.auto.pkrvars.hcl`-i ega `manifest.json`-it.


## Miks see nii töötab

**Packeri ehitus.** `proxmox-clone` alustab pilvemallist ja lisab sellele oma muudatused. Packer käivitab ajutise VM-i ja ühendub sellega SSH kaudu. Kui `ssh_private_key_file` pole antud, nagu kursuse failis, genereerib Packer ajutise võtme ja lisab selle VM-ile cloud-init'iga. Lõpus teeb Packer sellest VM-ist malli.

**Koristussamm.** Ehituse ajal on see VM tavaline masin: kõik, mida provisioner'id teevad, jääb kettale. Seepärast on koristussamm kohustuslik.

**Mida koristus teeb.** `cloud-init clean --machine-id` viib masina olekusse „pole veel käivitatud". Kustutatud host key'd luuakse iga klooni esimesel käivitusel uuesti ja tühi `authorized_keys` tähendab, et Packeri ajutist võtit pole üheski VM-is.

**Golden image ja cloud-init.** Mall annab kiire ja ühesuguse käivituse ning taastamisel ei sõltu sa välisest paketihoidlast, aga iga paketiuuendus tähendab uut ehitust ja VM-ide asendamist. cloud-init ja Ansible paigaldavad käivitusel värsked paketid, aga iga uus masin vajab selleks aega ja paigaldus ebaõnnestub, kui paketihoidla pole kättesaadav.

**Muutumatu taristu.** Pilves nimetatakse seda lähenemist muutumatuks taristuks (immutable infrastructure): masin asendatakse uuest mallist loodud masinaga, kohapeal seda ei parandata. Kursuse koodis, kus igal VM-il on fikseeritud ID ja IP, on see aeglasem. `create_before_destroy` siin ei tööta, sest uus VM vajaks sama ID-d ja IP-d, ja asendus tähendab lühikest katkestust.

**Üks host enne kõiki.** See on canary release'i lihtsaim kuju. Kui see host töötab päeva uue malliga ilma probleemideta, tulevad järgmised. Kui mitte, on rollback üks rida `terraform.tfvars`-is ja üks asendus.

Kui jõudsid kiiremini: [Lisaülesanded → 13. Golden image AlmaLinuxile ja ühe hosti kaupa](lisa.md#13-golden-image-almalinuxile-ja-uhe-hosti-kaupa), ehitad AlmaLinuxi malli ja viid selle ühele hostile, enne kui teised järgnevad.
