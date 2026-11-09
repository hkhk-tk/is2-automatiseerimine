---
tags:
  - veaotsing
---

# Abi: veaotsing

Siin on süvenemise ja lisaülesannete vead. IS1 praktikumi põhiraja vead (token, `vms = []`, tag'id, `validate`, host key) on IS1 lehel [Abi](https://hkhk-tk.github.io/is1-automatiseerimine/k04/abi/). Read on osade kaupa. Viimane veerg on mehhanism: selle järgi tunned vea ära ka siis, kui teade on teine.

| Sümptom | Kontrolli | Tõenäoline põhjus | Miks see juhtub |
|---|---|---|---|
| **Osa 1 · Üks VM lähemalt** | | | |
| Task History User veerus on ainult sinu kasutaja | UI → VM → Task History | VM tehti UI-s, mitte Tofuga | tokeni kaudu tehtud tööl on User veerus ka tokeni nimi; ilma selleta oli tegija inimene |
| **Osa 2 · Viis VM-i lähemalt** | | | |
| `tofu test`: `No value for required variable` | testifaili `variables` plokk | kohustuslik muutuja puudub või `TF_VAR_proxmox_api_token` pole keskkonnas | test laeb juurmooduli nagu `plan`; kõik vaikeväärtuseta muutujad peavad kuskilt tulema |
| `tofu test`: `Invalid expect_failures reference` | `expect_failures` rida | mooduli sisemist ressurssi ei saa oodata: kasuta `var.…`, `output.…` või `check.…` | `expect_failures` näeb ainult juurmooduli objekte; mooduli sisemus on testi jaoks must kast |
| `tofu validate` ebaõnnestub ainult testifaili pärast | `tofu validate` väljundis failinimi | `validate` kontrollib ka `tests/*.tftest.hcl`-i; automaatse hindaja `validate` ebaõnnestub samuti | testifail on osa konfiguratsioonist ja selle süntaks kontrollitakse koos ülejäänuga |
| `tofu test` puudutab Proxmoxi | testifaili algus | `mock_provider "proxmox"` puudub või `command = apply` | ilma mock'ita kasutab test provider'it ja sinu tokenit |
| ümbernimetamise järel `1 to add, 1 to destroy` | `tofu plan \| grep '#'` | `for_each` võti muutus | võti on objekti aadress state'is; uus aadress on Tofu jaoks uus objekt |
| `count`-iga tahab plaan asendada objekte, mida sa ei muutnud | `tofu plan \| grep '#'` | listi keskelt eemaldati element ja indeksid nihkusid | `count` aadress on järjekorranumber; nihkunud indeks on Tofu jaoks teine objekt teise sisuga |
| `tofu console`: `Invalid index` või `Unsupported attribute` | avaldis ilma `try`-ta | võtit või atribuuti pole: `try(…, vaikeväärtus)` või `lookup` | otsene indeks ebaõnnestub puuduva võtme peale; `try` püüab vea kinni ja annab vaikeväärtuse |
| **Moodul, moved ja state** | | | |
| refaktoreerimise järel `5 to destroy` | `tofu state list` | `moved` plokid puuduvad või `from` vale (`lab["web01"]` vs `lab.web01`) | state seob objektid aadressiga; ilma `moved`-ita on vanal aadressil ressurss, mida koodis enam pole |
| lapsmoodul otsib `hashicorp/proxmox` | `modules/vm/versions.tf` | moodulis puudub `required_providers` `bpg/proxmox` | iga moodul lahendab provider'i nime ise; ilma allikata eeldab Tofu namespace'i `hashicorp` |
| `Module not installed` | `ls .terraform/modules` | pärast `module` ploki lisamist tegemata `tofu init` | `init` registreerib moodulid kausta `.terraform/modules`; ilma selleta ei tea Tofu, kust moodulit lugeda |
| `init`: `InvalidAccessKeyId`, `NoSuchBucket`, `AccessDenied` | `env \| grep -c '^AWS_'`, `backend.hcl` `key` | `s3.env` laadimata, vale prefiks või `use_path_style` puudu | võti näeb ainult prefiksit `<github>/`; Garage vajab tee-stiilis aadressi, mitte bucketi nime hostis |
| `init`: `connection refused` S3 poole | VPN, `curl -sI <endpoint>` | Garage või VPN maas: koolitajale, jätka kohaliku state'iga | backend on võrguteenus; kui see ei vasta, ei saa Tofu state'i lugeda ega kirjutada |
| `Backend configuration changed` | `jq .backend .terraform/terraform.tfstate` | `backend.hcl` muutus: `tofu init -backend-config=backend.hcl -reconfigure` | `.terraform/terraform.tfstate` mäletab viimast backendi seadistust ja keeldub vaikides teisega töötamast |
| `Error acquiring the state lock` | veateate `ID`, `Who`, `Created` | teine käivitus või mahajäänud lukk: oota või `tofu force-unlock <ID>`, kui oled kindel, et keegi ei kirjuta; tootmises enne `tofu state pull > varu.json` | iga kirjutav käsk loob `.tflock` objekti; kui see on olemas, keeldub teine käivitus |
| lukk jääb alles, kuigi ükski `tofu` ei tööta | `pgrep -a tofu` | protsess tapeti või ühendus katkes: `tofu force-unlock <ID>`; kui see oli `apply`, tee enne `tofu state pull > varu.json` | lukk vabastatakse ainult siis, kui protsess lõpetab korrektselt; `kill -9` ei lase koristada |
| teine terminal läheb lukust läbi | `backend.hcl` `use_lockfile` | `use_lockfile` puudub või salvestus ei toeta tingimuslikku kirjutust | lukk põhineb päisel `If-None-Match: *`; salvestus, mis seda eirab, kirjutab luku lihtsalt üle |
| **Osa 3 · Üks käsk** | | | |
| `ansible all -m ping`: `Host key verification failed` | `grep host_key ../k02-ansible/ansible.cfg` | uued VM-id, uued võtmed: `host_key_checking = False` | igal uuel VM-il on uus host key ja Ansible ei saa küsida, kas seda usaldada |
| Ansible: `Could not get lock /var/lib/dpkg/lock-frontend` | `ssh <host> cloud-init status` | cloud-init töötab veel: roll `common` ootab `cloud-init status --wait` | SSH vastab enne, kui cloud-init on lõpetanud, ja cloud-init hoiab apt-i lukku |
| Ansible küsib Vault'i parooli | `grep vault_password_file ../k02-ansible/ansible.cfg` | rida puudub või `~/.vault_pass` puudub | Ansible avab Vault'i käivituse alguses; kui paroolifaili pole, küsib ta terminalist |
| `local.groups` on tühi või vale | `echo 'local.groups' \| tofu console` | gruppide arvutus `var.vms`-ist, mitte mooduli väljundist, või vale võti | grupid peavad sõltuma VM-idest, et inventory tekiks pärast neid ja muutuks koos nendega |
| plaan tahab `local_file.inventory` uuesti luua | `head -1 ../k02-ansible/inventory.ini`, `git diff` | keegi muutis faili käsitsi: `tofu apply` kirjutab selle tagasi | provider võrdleb faili kontrollsummat state'iga; erinev fail on tema jaoks kadunud |
| `up.sh`: `plaanis on N Proxmoxi objekti kustutamist` | `tofu plan \| grep -E 'forces replacement\|destroy'` | ootamatu asendus (mall, `vm_id`): loe plaan, siis `ALLOW_DESTROY=1` ainult teadlikult; asendus kustutab VM-i ketta, nii et andmetega VM-il (db01) tee tootmises enne varukoopia ja kontrolli taastamist | asendus on plaanis `delete` + `create`; skript loeb `delete`-e plaanifailist enne `apply`-d |
| `up.sh` keeldub iga inventory muutuse peale | `jq` filter skriptis | loendis on ka `local_file`: filtreeri `type`-i järgi (`proxmox_…`) | sisu muutus asendab `local_file`-i, nii et selle `delete` on igas plaanis, kus IP-d muutuvad |
| `up.sh` lõpeb kohe koodiga 1 | `tofu plan; echo $?` | `-detailed-exitcode` 2 tähendab muudatusi: püüa kood kinni (`\|\| rc=$?`), muidu peatab `set -e` | `set -e` peab iga nullist erinevat koodi veaks, ka koodi 2, mis tähendab "muudatused olemas" |
| `/health` ei vasta pärast `up.sh`-i | `ansible-playbook site.yml` väljund | play ebaõnnestus või web01 IP output'is vale | `/health` on viimane samm; kui Ansible ei lõpetanud või IP on vale, pole kellelgi vastata |
| **Elutsükkel ja kaitsed** | | | |
| `prevent_destroy = var.protection`: `Variables not allowed` | `tofu validate` | `prevent_destroy` peab olema literaal | meta-argumente hinnatakse enne muutujaid, sest need mõjutavad graafi ehitamist |
| kogu stacki `destroy` ebaõnnestub `Instance cannot be destroyed` | `grep -rn prevent_destroy .` | `prevent_destroy` jäi moodulisse | moodulis kehtib argument igale eksemplarile, mitte ainult db01-le |
| `destroy` ebaõnnestub Proxmoxi veaga `protected` | UI → VM → Options → Protection | db01 `protection = true`: pane `false`, `apply`, siis `destroy`. Laboris on baas tühi ja taastatav; tootmises tee enne varukoopia ja kontrolli taastamist | lipp on Proxmoxis; Tofu plaan ei tea sellest ja ebaõnnestub alles API kutsel |
| `plan -destroy` lubab db01 kustutamist | UI → db01 → Options | ootuspärane: plaan ei küsi Proxmoxilt kaitset | Proxmoxi lipp jõustatakse kustutamise kutsel, mitte plaanis |
| plaan tahab UI märkuse tagasi võtta | `tofu plan \| grep description` | `ignore_changes = [description]` puudub või vales ressursis | ilma `ignore_changes`-ita on koodis olev väärtus tõde ja UI muudatus on drift |
| `create_before_destroy` apply: `VM … already exists` | plaanis `+/-` | sama `vm_id`/nimi/IP: VM-il ei saa enne vana kustutamist uut luua | plaan näitab järjekorda, aga ei kontrolli, kas kaks objekti saavad korraga eksisteerida |
| `check` hoiatus, aga apply läheb edasi | plaani `Warning:` | ootuspärane: `check` ei peata, `precondition` peatab | `check` on mõeldud jälgimiseks; see käivitub igas plaanis, aga ei blokeeri |
| `precondition` ebaõnnestub kõigil VM-idel | `var.gateway`, IP mask | lüüs ja IP-d on eri võrgus või mask vale | tingimus arvutab võrgu aadressi maskiga; vale mask annab teise võrgu |
| **Import, drift ja keskkonnad** | | | |
| `import`: `Cannot import non-existent remote object` | UI VM ID, node | vale ID kuju: `<node>/<vm_id>` | provider otsib VM-i node'i ja ID järgi; ainult ID-ga ei tea ta, kust otsida |
| `-generate-config-out`: `target already exists` | `ls ops01.tf` | fail on juba olemas: kustuta ja käivita uuesti | Tofu ei kirjuta olemasolevat faili üle, et mitte kustutada sinu käsitööd |
| genereeritud fail ei läbi `validate`-i | vea rida | mustandis on omavahel vastuolus argumente: eemalda vaikeväärtused ja ühe ploki duplikaadid | provider kirjutab kõik loetud atribuudid, ka need, mida ei tohi koos anda |
| pärast importi tahab plaan VM-i asendada | `# forces replacement` rida | imporditud VM-i panid moodulisse (`clone`) või muutsid asendust nõudvat argumenti | `clone` on loomise argument; imporditud VM-il pole seda state'is ja koodis olev `clone` nõuab asendust |
| iga plaan ebaõnnestub pärast VM-i kustutamist | `ls import.tf` | `import` plokk jäi alles | import plokk ütleb, et objekt peab olemas olema; kui seda pole, ei saa Tofu importi teha |
| `-refresh-only` ei näita paketti | - | ootuspärane: masina sisu on Ansible'i ala (`changed` korduval käivitusel) | Tofu näeb ainult seda, mida Proxmoxi API VM-i kohta ütleb |
| `workspace new dev`: `AccessDenied` | `backend.hcl` | `workspace_key_prefix` puudub, state läheb `env:/` alla | vaikimisi prefiks on `env:`, mis on väljaspool sinu võtme lubatud prefiksit |
| dev-plaan tahab luua viis VM-i | `tofu workspace show`, käsurida | `-var-file=env/dev.tfvars` puudub; precondition peaks peatama | uus workspace on tühi state; ilma dev-failita on `vms` sama mis Labori seisus |
| `k02-ansible/inventory-dev.ini` on `git status`-es | `.gitignore` | rida puudub | dev-i inventory on genereeritud ja ajutine; see ei kuulu Labori seisu |
| kahel workspace'il on sama `lineage` | `tofu workspace show` mõlemas | oled mõlemal korral samas workspace'is | iga workspace'i state saab loomisel oma `lineage`-i |
| **Golden image Packeriga** | | | |
| `packer: command not found` pärast paigaldust | `apt-cache policy packer` | HashiCorpi paketihoidla puudub või `apt-get update` tegemata | Ubuntu enda paketihoidlas Packerit pole; pakett tuleb HashiCorpi paketihoidlast, mille võti peab olema `signed-by` failis |
| `validate`: `Unset variable "node"` | `ls *.auto.pkrvars.hcl` | `labseis.auto.pkrvars.hcl` puudub või on vale nimega | Packer laeb automaatselt ainult `*.auto.pkrvars.hcl` faile; ilma vaikeväärtuseta muutuja vajab väärtust |
| `401` või `authentication failure` ehituse alguses | `echo "$PROXMOX_USERNAME"` | muutujad tegemata selles shellis või token on ühe stringina | Packer tahab tokeni ID-d ja saladust eraldi; `kasutaja@pve!nimi=uuid` ühes muutujas ei sobi |
| `Waiting for SSH to become available` kuni timeout'ini | UI → ehitus-VM → Console, Cloud-Init vahekaart | vale `ssh_username`, vale `build_ip` või võrk | Packer paneb ajutise võtme cloud-init'iga malli vaikekasutajale; kui kasutaja või IP ei klapi, ei pääse ta sisse |
| ehitus ebaõnnestub `vm_id … already exists` | UI pool | eelmine mall samal ID-l on alles | valmis mall saab ehitus-VM-i ID; teine ehitus vajab teist ID-d (`+ 6` või `+ 7`) |
| Ansible'i samm: `the role 'common' was not found` | `ansible_roles_path` muutuja | tee on vale `path.root`-i suhtes | Packer käivitab Ansible'i kaustast, kus on `.pkr.hcl`; suhteline tee arvutatakse sealt |
| Tofu plaan ebaõnnestub `peab olema täpselt üks mall` | UI mallide tag'id | golden image'il on ka tag `template` | data source otsib tag'idega `template` + distro ja nõuab ühte tulemust; kaks sama tag'iga malli rikuvad selle |
| `template_names` antud, plaan ikka `No changes` | `tofu output template_source` | nimi on vales failis (nt `env/dev.tfvars`) või vale distro võti | malli vahetus on `clone` muutus; kui muutuja ei jõua data source'ini, jääb vana mall |
| dev01 ja web01 machine-id on sama | `ssh … cat /etc/machine-id` | koristussamm jäi vahele või ebaõnnestus | machine-id kopeeritakse malliga; `cloud-init clean --machine-id` paneb selle tühjaks, et iga kloon teeks oma |
| `up.sh` keeldub pärast `template_names` muutmist | `tofu plan \| grep 'forces replacement'` | ootuspärane: malli vahetus asendab Ubuntu VM-id | uus mall jõuab VM-ile ainult kloonimisel; luba teadlikult `ALLOW_DESTROY=1`-ga |
| **Intsident: state ja tegelikkus** | | | |
| plaan tahab luua VM-i, mida keegi ei kustutanud | `tofu plan -refresh-only` | VM on Proxmoxist läinud; refresh eemaldas selle state'ist | refresh loeb iga objekti API-st; objekt, mida pole, eemaldatakse state'ist ja kood tahab selle uuesti teha |
| UI-s on VM, mida plaan ei näita | `tofu state list` vs UI pool | VM tehti koodist mööda, Tofu ei tea sellest | Tofu küsib API-lt ainult objekte, mis on state'is |
| pärast VM-i taastamist teenus `DOWN` | `ansible <host> -m ansible.builtin.ping` | uus VM on tühi: Ansible käivitamata või host key vana | Tofu teeb masina, mitte selle sisu; teenuse paigaldab Ansible |
| plaan pärast taastamist ikka `~` | `tofu plan -refresh-only` | käsitsi muudetud atribuudi otsus tegemata | taastamine parandas ühe lahknevuse; teised jäävad, kuni need eraldi otsustad |
| `-refresh-only -detailed-exitcode` annab `2` | `tofu plan -refresh-only` | mõni lahknevus on lahendamata või UI märkus jäi `ignore_changes`-ist välja | kood `2` tähendab, et API näitab midagi teisiti kui state |
| **Osa 4 · Värske kloon** | | | |
| värskes kloonis `tofu test` ei leia faili | testi `ssh_public_key` | test viitab failile, mida Gitis pole (nt `~/.ssh/...`) | kloonis on ainult commit'itud failid; sinu kodukausta faile seal pole |
| **Lisaülesanne 7. Sama kood Terraformiga** | | | |
| `terraform init` küsib S3 seadeid või võtmeid | `ls /tmp/k04-tf/terraform/backend.*` | backendi fail tuli koopiasse kaasa: kustuta see koopiast ja tee `init` uuesti | koopia peab kasutama oma tühja kohalikku state'i; `backend.tf`-iga läheks Terraform jagatud state'i juurde |
| `terraform init`: `Unsupported block type` faili `encryption.tf` kohta | `grep -l encryption /tmp/k04-tf/terraform/*.tf` | `encryption` plokk on ainult OpenTofus: kirjuta tulemus üles ja eemalda fail koopiast | Terraform ei tunne seda plokki ja keeldub kogu konfiguratsiooni lugemast |
| `terraform plan` tahab kõik ressursid luua | `ls /tmp/k04-tf/terraform/*.tfstate` | koopias on tühi state, nii on õige: `apply`-d ära tee | plaan võrdleb koodi state'iga; tühi state ei tea olemasolevatest VM-idest midagi |
