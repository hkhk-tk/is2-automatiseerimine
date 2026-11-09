---
tags:
  - OpenTofu
  - Proxmox
---

# Praktikum: elutsükkel ja kaitsed

Tee see leht pärast lehte [Moodul, moved ja state](lab-3-moodul-state.md) ja süvenemise [osa 3](syvenemine.md#osa-3-uks-kask-inventory-ansible-ja-upsh), sest kaitsed kasutavad moodulit, `tofu test`-i ja `up.sh`-i.

Praegu kustutab üks vale `apply` db01 koos andmetega sama kergelt kui iga teise VM-i. Paned db01-le kaitse Proxmoxis ja Tofus, proovid `lifecycle`-i kolme argumenti ja lisad koodile kaks tingimust: üks hoiatab, teine peatab. Proxmoxi kaitse kehtib kõigile, kes API-t kasutavad, Tofu oma ainult sinu koodi käivitamise ajal. Lõpuks on db01 kaitstud, tead, milline kaitse millise vea vastu aitab, ja plaan on jälle "No changes".

**Kui teed seda tööl iga päev:** db01-l on `protection = true`, plaan on "No changes" ja sa oskad öelda, milline kaitse (Proxmoxi `protection`, `prevent_destroy`, `up.sh` keeld) peatab `tofu destroy`, `-replace` ja koodist kustutatud ressursiploki. Kui see on sul juba korras, mine otse etappi „[Lisa hoiatus ja keeld](#lisa-hoiatus-ja-keeld)“.

## Kaitse db01 Proxmoxi lipuga

Esimene kaitse on hüperviisori enda lipp. Proxmoxi `protection` keelab VM-i ja ketaste kustutamise UI-st, API-st ja Tofust. See on VM-i atribuut, nii et selle saab anda ühele hostile ja hoida koodis nagu iga teist väärtust.

Kõik muud masinad saab `up.sh` minutitega uuesti luua, db01 sisu mitte.

Nõuded:

- `vms` objektis uus väli `protection = optional(bool, false)`
- moodulis muutuja `protection` (vaikimisi `false`) ja ressursil `protection = var.protection`
- juurmoodul annab selle edasi, `terraform.tfvars`-is on `protection = true` ainult db01 real

1. Loe plaanist, mitu VM-i muutub ja kuidas, siis `apply`.

    ```bash
    tofu plan | grep -E '~|Plan:'
    tofu apply
    tofu state show 'module.vm["db01"].proxmox_virtual_environment_vm.this' | grep protection
    ```

2. Vaata UI-s db01 → **Options → Protection**.

Plaan muutis ainult db01, sest `optional(bool, false)` andis teistele vaikeväärtuse, mis vastas niigi Proxmoxi tegelikule olekule. Uus väli objektis ei sunni sind igale reale midagi kirjutama.

**Edasi saad minna, kui** plaan oli `1 to change` (in-place), UI näitab db01-l `Protection: Yes` ja teistel `No`.

## Proovi, kes kaitset näeb

Kaitse olemasolu ei tähenda, et iga tööriist sellest teab. Siin vaatad, mida Tofu plaan ja Proxmoxi UI kaitstud VM-i kohta ütlevad. Midagi ei kustu.

Kui plaan ütleb "5 to destroy" ja sa usud, et kaitse peatab, aga kaitse oli ainult ühel masinal, kaotad neli. Seepärast pead teadma, kumb pool keeldub ja millal.

1. Vaata plaani, mis kustutaks kõik, ilma `apply`-ta.

    ```bash
    tofu plan -destroy | grep -E 'db01|Plan:'
    ```

2. UI-s: db01 → **More → Remove**. Sisesta VM ID ja proovi kustutada.

Tofu plaan lubab db01 kustutamist, sest Tofu ei küsi plaani ajal Proxmoxilt, kas kustutamine õnnestuks. Proxmoxi lipp töötab alles API kutsel, nii et `apply` alustaks kustutamist ja ebaõnnestuks db01 juures. UI keeldus kohe ja ütles põhjuseks kaitse.

**Edasi saad minna, kui** `plan -destroy` näitas db01 kustutamist, UI keeldus kaitse tõttu ja oskad öelda, kumb pool kaitse jõustab.

## Proovi prevent_destroy ja selle piire

Teine kaitse on Tofu enda oma. [`prevent_destroy`](https://opentofu.org/docs/language/meta-arguments/lifecycle/) peatab plaani, mis kustutaks ressursi. Proovi, mida see moodulis teeb ja miks see ei sobi sinu juhtumile.

`prevent_destroy` on hea seal, kus kogu ressurss on alati kaitsmist väärt, näiteks state'i bucket. Moodulis, mida kasutavad kõik viis VM-i, kaitseb see ka neid, mida sa tahad vabalt asendada.

1. Lisa mooduli ressursile `lifecycle { prevent_destroy = true }` ja proovi kahte plaani.

    ```bash
    tofu plan -destroy 2>&1 | grep -A3 'cannot be destroyed'
    tofu plan -replace='module.vm["web01"].proxmox_virtual_environment_vm.this' 2>&1 | tail -5
    ```

2. Proovi teha `prevent_destroy = var.protection`: mida ütleb `tofu validate`?
3. Eemalda `prevent_destroy`. **Mõtle:** miks see moodulis kaitseb liiga palju ja millal see ei kaitse üldse (ressursiplokk kustutatakse koodist)?

Erinevalt Proxmoxi lipust peatab `prevent_destroy` juba plaani, enne kui ükski API kutse läheb. Hind on see, et seda ei saa hostiti valida, sest meta-argument peab olema literaal. Kui keegi kustutab koodist kogu ressursiploki, kaob ka kaitse ja järgmine plaan kustutab vaikides.

> Pärast `prevent_destroy`-d tuleb kogu stacki `destroy` jaoks koodi muuta. Proxmoxi `protection` tuleb samamoodi enne kursuse lõpu koristust maha võtta.

**Edasi saad minna, kui** mõlemad plaanid ebaõnnestusid `Instance cannot be destroyed`-iga, `validate` keeldus muutujast, `prevent_destroy` on koodist läinud ja plaan on "No changes".

## Ära kirjuta opsi märkmeid üle

Kood ei pea omama kõike, mis VM-il on. Siin annad VM-ile koodist märkuse, lased kellelgi UI-s sinna kirjutada ja määrad, et Tofu seda välja pärast loomist ei halda.

Kui iga `apply` kustutab opsi märkme, lõpetab ops märkmete kirjutamise. Siis kaob info, mis ei sobinud koodi, ja järgmine valvesolija ei tea, miks masinat eile taaskäivitati.

1. Lisa moodulisse muutuja `description` vaikeväärtusega, mis ütleb, et VM on koodis hallatud, ja ressursile `description = var.description`. Tee `tofu apply`.
2. UI-s web01 → **Summary → Notes**: lisa rida "kontrollitud, ops" ja salvesta. Käivita `tofu plan`.
3. Lisa mooduli ressursile `lifecycle { ignore_changes = [description] }` ja käivita `tofu plan`.

**Mõtle:** miks ei sobi `ignore_changes`-i `memory` ega `started`?

`ignore_changes` tähendab, et Tofu ei halda seda välja pärast loomist. Algväärtus tuleb ikka koodist, hilisemad muudatused jäävad sinna, kus need tehti. Sama kehtib vastupidi: kui muudad koodis `description`-i, ei jõua see enam olemasolevale VM-ile.

**Edasi saad minna, kui** sammu 2 plaan tahtis `description`-i tagasi panna ja pärast `ignore_changes`-i on plaan "No changes", kuigi UI-s on sinu märkus alles.

## Vaata, mida teeb create_before_destroy

Kolmas `lifecycle` argument muudab asenduse järjekorda. `create_before_destroy` loob uue objekti enne, kui vana kustutatakse. Siin ainult loed plaani, `apply`-d ei tee, sest tulemus oleks konflikt.

Pilves on see viis teha asendus ilma katkestuseta: uus masin tuleb üles, siis kaob vana. Proxmoxis fikseeritud ID ja IP-ga ei ole see võimalik, ja kes seda ei tea, saab poole asenduse pealt ebaõnnestunud `apply`.

1. Lisa mooduli `lifecycle`-isse ajutiselt `create_before_destroy = true`.
2. Vaata web01 asenduse plaani ja võrdle sümbolit `test01` AlmaLinuxi proovi plaaniga.

    ```bash
    tofu plan -replace='module.vm["web01"].proxmox_virtual_environment_vm.this' | grep -E 'web01|Plan:'
    ```

3. Eemalda `create_before_destroy`. **Mõtle:** miks `apply` ebaõnnestuks? Mis on uuel ja vanal VM-il sama?

Sümbol `+/-` tähendab, et Tofu teeks uue VM-i enne vana kustutamist. Plaan ei kontrolli, kas see on võimalik. Proxmox keelduks, sest `vm_id` on juba kasutusel, ja isegi teise ID-ga oleks kahel masinal sama IP. Plaani sümbol ütleb järjekorra, mitte seda, et järjekord töötab.

**Edasi saad minna, kui** plaanis oli `+/- create replacement and then destroy`, oskad selgitada, et sama `vm_id`, nimi ja IP ei lase uut enne vana kustutamist luua, ja plaan on jälle "No changes".

## Lisa hoiatus ja keeld

Lisad koodile reeglid, mis kontrollivad tervikut, mitte üht muutujat. [`check`](https://opentofu.org/docs/language/checks/) hoiatab igas plaanis, [`precondition`](https://opentofu.org/docs/language/expressions/custom-conditions/) peatab. Mõlemal on koht: hoiatus sobib asjale, mida võib teadlikult ületada, keeld asjale, mis on alati viga.

`check` hinnatakse iga plaani ja `apply` lõpus ka siis, kui ükski ressurss ei muutu, nii et see sobib ka püsivaks hoiatuseks. `precondition` hinnatakse enne ressursi muutmist ja selle ebaõnnestumine peatab käivituse.

Nõuded:

- `checks.tf`: muutuja `ram_quota_mb` (vaikimisi 6144) ja `check "ram_quota"`, mille `assert` võrdleb `vms` RAM-i summat kvoodiga
- samas failis `check "same_network"`: iga IP on lüüsiga samas võrgus (`cidrhost`)
- mooduli ressursi `lifecycle`-is sama võrgutingimus `precondition`-ina, `error_message` nimetab VM-i ja IP
- `tests/vms.tftest.hcl`-is `run "ram_ule_kvoodi"`: `ram_quota_mb = 1024` ja `expect_failures = [check.ram_quota]`

1. Proovi mõlemat tingimust ilma `terraform.tfvars`-i muutmata.

    ```bash
    tofu plan -var ram_quota_mb=2048 | grep -A2 -i warning
    tofu plan -var gateway=192.168.99.1 2>&1 | grep -A2 Error
    tofu test
    ```

**Ennusta:** kumb tingimus lubaks `apply`-l edasi minna ja kumb mitte?

Esimene plaan lõppes plaaniga ja hoiatusega, nii et `apply` oleks lubatud. Teine plaan peatus sinu teatega ja nimetas VM-i, mitte ainult reeglit. `-var` käsureal võitis `terraform.tfvars`-i, nii et said proovida ilma faili muutmata (muutujate järjekord on lehe [Viis VM-i muutujatega](syvenemine.md#28-miks-see-nii-tootab) lõpus).

**Edasi saad minna, kui** esimene plaan andis hoiatuse, aga lõppes plaaniga, teine ebaõnnestus sinu `precondition`-i teatega ja `tofu test` on `Success!`.

## Commit

Enne commit'i kontrollid, et kõik ajutised proovid on koodist läinud. Plaani väljumiskood 0 tõestab seda masinale arusaadaval kujul.

Unustatud `create_before_destroy` või `prevent_destroy` moodulis on viga, mis tuleb välja alles järgmisel asendusel või koristusel, nädalaid hiljem.

```bash
tofu fmt -recursive && tofu validate && tofu plan -detailed-exitcode > /dev/null; echo "kood $?"
cd ~/kursus
git add k04-tofu
git commit -m "k04: db01 protection, ignore_changes, check ja precondition"
git push
```

Kood `0` tähendab, et kood, state ja Proxmox on kooskõlas ja koodis on ainult püsivad muudatused. Kood `2` tähendaks, et mõni proov jäi pooleli või UI märkus läks `ignore_changes`-ist mööda.

**Edasi saad minna, kui** `plan -detailed-exitcode` annab `0` ja commit on GitHubis.


## Miks see nii töötab

**Meta-argumendid.** `prevent_destroy` on meta-argument (Tofu enda argument, mitte provider'i oma) ja see hinnatakse enne muutujaid, seepärast peab väärtus olema literaal.

**`create_before_destroy` levik.** `create_before_destroy` kandub üle sõltuvustele. Kui A sõltub B-st ja A-l on see seade sees, kehtib sama käitumine ka B-le.

**Tofu kaitsed.** Kaitseid on kahte liiki. Tofu kaitsed (`prevent_destroy`, `precondition`) peatavad plaani enne ühtki API kutset, aga toimivad ainult siis, kui muudatus tehakse sinu koodi kaudu.

**Proxmoxi kaitse.** Proxmoxi kaitse (`protection`) kehtib igale kustutamiskatsele, ka UI-st ja teistest tööriistadest, kuni keegi lipu maha võtab. See jõustub aga alles API kutse ajal, mitte plaanis. Andmebaasi jaoks tasub kasutada mõlemat ja lisaks varukoopiat, sest kumbki kaitse ei hoia andmeid VM-i sees.

Kui jõudsid kiiremini: [Lisaülesanded → Lisaprojekt: tulemüür koodis](lisa.md#lisaprojekt-tulemuur-koodis), paned web01 Proxmoxi tulemüüri reeglid koodi nii, et VM jääb alles.
