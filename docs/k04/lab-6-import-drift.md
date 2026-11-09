---
tags:
  - OpenTofu
  - Proxmox
  - drift
---

# Praktikum: import, drift ja keskkonnad

Tee see leht pärast lehte [Elutsükkel ja kaitsed](lab-5-elutsukkel.md).

Tootmises on alati VM-e, mis tehti enne koodi, ja muudatusi, mis tehti koodist mööda. Teed need ise: kloonid UI-s VM-i ja teed kolm käsitsi muudatust, siis tood VM-i koodi alla, leiad drift'i `-refresh-only`-ga ja otsustad iga muudatuse kohta, kas see läheb tagasi või koodi. Iga otsus läheb `NOTES.md`-sse koos põhjusega, sest intsidendiülesandes teed sama ilma juhendita. Lõpuks on ops01 koodis, plaan on tühi ja samast koodist on eraldi dev-keskkond, mis Labori seisu ei puuduta.

**Kui teed seda tööl iga päev:** oled `import` plokiga olemasoleva VM-i koodi alla toonud ja `tofu plan -refresh-only -detailed-exitcode` on sinu drift'i kontroll. Kui see on sul juba korras, tee etappide „Too ops01 koodi alla“ ja „Leia drift ja otsusta“ sammud ilma selgitusi lugemata ja mine otse etappi „[Tee dev-keskkond workspace'iga](#tee-dev-keskkond-workspaceiga)“.

## Loo üks VM käsitsi

Teed seda, mida enne IaC-d tehti aastaid: kloonid UI-s VM-i.

1. Proxmoxi UI-s: mall `tpl-ubuntu-2404` → **More → Clone**. VM ID = `IS1_VMID_BASE` + 8, nimi `ops01`, **Mode: Full Clone**, pool `is1-<github>`.
2. ops01 → **Hardware → Memory**: 512 MB. Käivita ops01.
3. Vaata, mida Tofu sellest teab.

    ```bash
    cd ~/kursus/k04-tofu
    tofu plan | tail -1
    tofu state list | grep -c ops01
    ```

"No changes" kõrval pool'is oleva uue VM-iga on oluline tulemus. Tofu võrdleb ainult seda, mis on state'is või koodis. Kõik muu on tema jaoks olematu, isegi kui see on samas pool'is ja kasutab sinu kvooti.

**Edasi saad minna, kui** ops01 töötab UI-s, plaan ütleb "No changes" ja `grep -c` annab `0`: Tofu ei tea VM-ist midagi.

## Too ops01 koodi alla

Nüüd seod olemasoleva VM-i koodi aadressiga ilma seda uuesti tegemata. [`import` plokk](https://opentofu.org/docs/language/import/) ütleb, et olemasolev objekt kuulub koodi aadressile. ID kuju on `<node>/<vm_id>`.

Import on ainus viis viia koodi alla masin, mida ei saa kustutada ja uuesti teha. `import` plokk läbib plaani ja on Gitis näha; vana käsk `tofu import` kirjutab state'i kohe, ilma plaanita ja jäljeta koodis.

1. Tee fail `import.tf`:

    ```hcl
    import {
      to = proxmox_virtual_environment_vm.ops01
      id = "<IS1_NODE>/<IS1_VMID_BASE + 8>"
    }
    ```

2. Lase Toful kirjutada ressursi mustand ([config'i genereerimine](https://opentofu.org/docs/language/import/generating-configuration/)).

    ```bash
    tofu plan -generate-config-out=ops01.tf
    less ops01.tf
    ```

3. Puhasta `ops01.tf`: jäta alles see, mida tahad hallata (nimi, node, pool, CPU, mälu, ketas, võrk, tag'id sorteeritult), kuni `tofu validate` on OK ja plaan näitab importi ilma asenduseta.
4. Impordi, siis eemalda `import` plokk.

    ```bash
    tofu apply
    rm import.tf && tofu plan | tail -1
    ```

Genereeritud mustand on pikk, sest provider kirjutas kõik, mida ta luges, ka vaikeväärtused. Puhastamine on otsus: iga rida, mille jätad, on lubadus seda välja hallata. Plaan "1 to import, 0 to change" tähendab, et sinu kirjeldus klapib täpselt masinaga ja import ei muuda Proxmoxis midagi.

> Mustandis pole `clone` plokki, sest seda ei saa olemasolevast VM-ist lugeda. Seepärast ei sobi imporditud VM otse mooduli `vm` alla, mis eeldab kloonimist.

**Edasi saad minna, kui** `apply` ütles `1 imported`, `tofu state list` näitab `proxmox_virtual_environment_vm.ops01` ja pärast `import.tf` eemaldamist on plaan "No changes" või ainult `~` read, mille põhjus on `NOTES.md`-s.

## Otsusta, kas ops01 jääb

ops01 ei kuulu Labori seisu. Nüüd, kui see on koodis, kustutad selle koodiga, mitte UI-s. `apply` kustutab VM-i koos kettaga. Laboris on ops01 tühi katsemasin.

UI-s kustutatud masinast jääb järele ainult task-logi rida. Koodiga kustutatud masinast jääb commit, mille sõnum ütleb, miks.

1. Kustuta `ops01.tf` ja vaata plaani: täpselt üks kustutamine.

    ```bash
    rm ops01.tf
    tofu plan | grep -E 'destroyed|Plan:'
    tofu apply
    ```

2. **Mõtle:** miks tuli import-plokk eemaldada enne, kui VM kadus?

Plaan näitas ainult ops01 kustutamist, sest teised viis on endiselt koodis. Ressursiploki kustutamine koodist on Tofu jaoks sama mis "seda objekti pole enam vaja". Seepärast kaob ka iga kaitse, mis oli ploki sees: `prevent_destroy` ei aita, kui plokki enam pole.

**Edasi saad minna, kui** plaan oli `0 to add, 0 to change, 1 to destroy`, ops01 on UI-st läinud ja plaan on "No changes".

## Leia drift ja otsusta

Teed kolm käsitsi muudatust: kaks Proxmoxis ja ühe VM-i sees. Siis vaatad, millised neist Tofu leiab ja millised mitte. Enne iga plaani ennusta, mida see näitab.

Drift on muudatus, mille kohta pole otsust. Kui seda ei leia, võtab järgmine `apply` selle vaikides tagasi. Kui leiad, aga ei otsusta, võtab see muudatuse tagasi ikka.

1. UI-s: peata mc01 (**Shutdown**). UI-s: web01 **Hardware → Memory** 1024 MB.
2. VM-i sees: `ssh web01 'sudo apt-get install -y -o DPkg::Lock::Timeout=120 htop'`
3. Vaata ainult väljaspool tehtud muudatusi, siis tavalist plaani.

    ```bash
    tofu plan -refresh-only
    tofu plan
    ```

4. Otsusta iga muudatuse kohta ja kirjuta otsus koos põhjusega `NOTES.md`-sse:
    - mc01 peatatud: tagasi koodis kirjeldatud olekusse (`tofu apply`)
    - web01 RAM: vali ise, kas tagasi (`tofu apply`) või koodi (`terraform.tfvars`-is `memory = 1024`)
    - `htop`: kelle ala see on ja millise Ansible'i käsuga selle leiaksid?

`-refresh-only` vastab küsimusele "mis muutus väljaspool koodi". Tavaline plaan vastab küsimusele "mida kood selle peale teeks".

<!-- EKRAANIPILT: Proxmoxi UI, web01 → Hardware → Memory → Edit dialoog, Memory (MiB) = 1024, enne OK vajutamist. Vasakul puus näha, et mc01 on peatatud (hall ikoon). Drift'i sammud 1 ja 2.
<figure markdown="span">
  ![Proxmoxi UI, web01 Memory muutmise dialoog, mc01 peatatud](assets/k04_ui_drift_memory.png)
  <figcaption>Joonis L4.10. Käsitsi muudatus UI-s: web01 RAM 1024 MB, mc01 peatatud. Järgmine <code>tofu plan</code> näitab mõlemat.</figcaption>
</figure>
-->

`-refresh-only` näitas kahte muudatust, `htop`-i mitte. Tofu näeb ainult seda, mida Proxmoxi API VM-i kohta ütleb, mitte seda, mis on masina failisüsteemis. Selle ala drift'i leiab Ansible: korduv `site.yml` käivitus, mis annab `changed`, ütleb sama, mida `-refresh-only` ütleb Proxmoxi kohta.

> `tofu apply -refresh-only` kirjutaks tegelikkuse state'i, Proxmoxis midagi muutmata. See värskendab ainult state'i: kood nõuab järgmisel plaanil ikka koodis kirjeldatud olekut.

**Edasi saad minna, kui** `-refresh-only` näitas `started` ja `memory` muutust, aga mitte `htop`-i, `NOTES.md`-s on kolm otsust ja `tofu plan` ütleb "No changes".

## Tee dev-keskkond workspace'iga

Sama koodiga teed teise, väikese keskkonna, mis ei puuduta Labori seisu. [Workspace](https://opentofu.org/docs/language/state/workspaces/) on sama koodi teine state. Dev saab ühe väikese VM-i ja oma inventory faili.

Kõige kallim viga dev-keskkonnaga on see, et dev-i väärtused jõuavad tootmisse. Siin on see konkreetne: dev-i IP-d jõuaksid Labori seisu inventory'sse ja Ansible seadistaks vale masina.

Nõuded:

- `env/dev.tfvars`: `vms` ainult `dev01`-ga (`vm_id` = `IS1_VMID_BASE` + 9, IP `.19`, Ubuntu, 512 MB, grupp `web`) ja `inventory_path = "../k02-ansible/inventory-dev.ini"`
- `local_file.inventory` `lifecycle`-is `precondition`: põhi-inventory't (`inventory.ini`) tohib kirjutada ainult workspace `default`
- repositooriumi juurkausta `.gitignore`-is `k02-ansible/inventory-dev.ini`
- `backend.hcl`-is on `workspace_key_prefix = "<github>/env"` (lisasid selle state'i bucketisse viies)

1. Tee workspace ja proovi plaani kõigepealt ilma dev-failita.

    ```bash
    tofu workspace new dev
    tofu plan 2>&1 | grep -A2 Error
    tofu plan -var-file=env/dev.tfvars | tail -1
    ```

2. Loo dev01 ja võrdle dev-i state'i Labori seisu omaga.

    ```bash
    tofu apply -var-file=env/dev.tfvars
    tofu state list && tofu state pull | jq -r .lineage
    tofu workspace select default && tofu state pull | jq -r .lineage
    ```

3. Kustuta dev01 ja jää `default`-i.

    ```bash
    tofu workspace select dev && tofu destroy -var-file=env/dev.tfvars
    tofu workspace select default && tofu workspace show
    ```

Precondition peatas plaani ilma `-var-file`-ita. Unustatud lipp on täpselt see viga, mille vastu kaitse tehti. Kahel workspace'il on erinev `lineage`: need on kaks eraldi state'i, mis lihtsalt jagavad koodi ja bucketit. Dev-i `destroy` ei näe Labori seisu masinaid, sest neid pole dev-i state'is.

> `AccessDenied` workspace'i loomisel: `workspace_key_prefix` puudub ja state läheb prefiksi `env:/` alla, mida sinu võti ei näe. Pärast `backend.hcl` muutmist: `tofu init -backend-config=backend.hcl -reconfigure`.

**Edasi saad minna, kui** plaan ilma `-var-file`-ita ebaõnnestus sinu `precondition`-i teatega, dev-plaan oli `2 to add` (dev01 ja tema inventory), kahe workspace'i `lineage` on erinev, dev01 on kustutatud, `workspace show` annab `default` ja seal on plaan "No changes".

## Commit

Commit'i läheb dev-i väärtuste fail ja inventory kaitse. Ajutised failid (`import.tf`, `ops01.tf`) ei lähe, sest nende töö on tehtud.

Giti jäänud `import` plokk nurjab iga järgmise plaani, kui objekti enam pole. Kolleeg näeb siis viga, mille põhjust ta ei tea.

```bash
cd ~/kursus
git add .gitignore k04-tofu
git commit -m "k04: import ja drift'i otsused, dev workspace"
git push
```

`git ls-files` on lõplik vastus küsimusele, mis on koodis. `env/dev.tfvars` on seal, sest see kirjeldab teist keskkonda ja ei sisalda saladusi. Import-failid puuduvad, sest ops01 lugu on lõppenud ja jälg sellest on commit'i ajaloos.

**Edasi saad minna, kui** `git ls-files k04-tofu` näitab `env/dev.tfvars`, aga mitte `import.tf`-i ega `ops01.tf`-i.


## Miks see nii töötab

**Import.** Import plaanis ei muuda Proxmoxis midagi, ainult state'i. `-generate-config-out` kirjutab faili kõik atribuudid, mille provider luges, ka vaikeväärtused, mida sa ise ei kirjutaks.

**Workspace.** Workspace on sama koodi eraldi state samas backendis. See sobib, kui keskkonnad erinevad ainult väärtuste poolest ja neil on sama omanik.

**Workspace'i piir.** Kui dev- ja tootmiskeskkond vajavad eri õigusi, eri bucketit või eri provider'it, ei piisa workspace'ist. Siis on vaja eraldi kausta või kontot, sest workspace ei eralda ligipääsuõigusi.

Kui jõudsid kiiremini: [Lisaülesanded → 5. Ketas kasvab lõpuni](lisa.md#5-ketas-kasvab-lopuni), otsustad drift'i üle, mida ei saa koodis kirjeldatud olekusse tagasi viia, ja kasvatad failisüsteemi töötaval masinal.
