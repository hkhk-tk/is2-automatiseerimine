---
tags:
  - OpenTofu
  - Proxmox
  - veaotsing
---

# Praktikum: intsident, state ja tegelikkus

Tee see leht pärast süvenemise [osa 3](syvenemine.md#osa-3-uks-kask-inventory-ansible-ja-upsh), sest taastamine käib `up.sh`-iga. Intsidendi muudatused teeb koolitaja sinu pool'is, nii et anna talle enne märku. Proxmoxi token kehtib 5. kohtumise eelõhtuni.

Öösel tegi keegi sinu pool'is Proxmoxi UI kaudu kolm muudatust ja hommikul on Labori seis katki, aga keegi ei ütle, mis muutus. Pead ise eristama, mida näeb kasutaja, mida Tofu ja mida Proxmox, ning milline neist vaadetest valetab. Ära paranda UI-s: kõik parandused käivad koodi või Tofu käskude kaudu ja iga otsus on `NOTES.md`-s koos põhjusega. Lõpuks on plaan tühi, `/health` UP ja iga muudatuse põhjus kirjas, nii et keegi ei pea arvama.

**Kui teed seda tööl iga päev:** `tofu plan -refresh-only` ja pool'i võrdlus state'iga on sinu tavaline kontroll. Kui see on sul juba korras, käivita intsident, lahenda kolm lahknevust ilma vahepealsete juhisteta ja mine otse etappi „[Kood, masinad, Ansible ja rakendus](#kood-masinad-ansible-ja-rakendus)“: selle kontrollid ütlevad, kas jäi midagi lahtiseks.

Mitu rida võib viidata samale lahknevusele.

| Sümptom | Vaata esimesena | Tõenäoline koht |
|---|---|---|
| `/health` → mõni sõltuvus `DOWN` | `curl -s http://web01/health`, UI pool | taustateenuse VM |
| `tofu plan` tahab luua VM-i, mis peaks olemas olema | `tofu plan -refresh-only`, `tofu state list` | VM on Proxmoxist läinud, refresh eemaldas selle state'ist |
| plaanis on `~` rida, mida sina ei kirjutanud | `tofu plan -refresh-only` | käsitsi muudetud atribuut |
| UI pool'is on rohkem VM-e, kui `tofu state list` teab | UI pool vs `tofu state list` | VM tehti koodist mööda |
| pärast taastamist `ssh` või Ansible ei saa hostiga ühendust | `ssh-keygen -F <host>`, `ansible <host> -m ansible.builtin.ping` | uus VM, uus host key; teenused paigaldamata |
| `./up.sh` keeldub jätkamast | plaani `destroy` read | plaanis on kustutamine, mida sa ei oodanud |

*Tabel L4.3. Veaotsingu tabel.*

> ⚠️ Kui stack on täiesti segamini: `./up.sh` taastab kõik, mis on koodis. Koodist mööda tehtud VM-e see ei puuduta ja käsitsi muudetud väärtused võtab tagasi ilma küsimata, nii et tee enne otsused.

## Käivita intsident

Enne kui midagi katki läheb, paned kirja, milline on terve süsteemi olek. Ilma selleta ei tea sa hiljem, kas mõni sümptom oli olemas juba enne intsidenti.

1. Kontrolli, et algseis on korras.

    ```bash
    cd ~/kursus/k04-tofu
    tofu workspace show
    tofu plan -detailed-exitcode > /dev/null; echo "kood $?"
    curl -s http://web01/health; echo
    ```

2. Kirjuta `NOTES.md`-sse kellaaeg, plaani kood ja `/health` vastus.
3. Anna koolitajale märku. Ta muudab sinu pool'is kolm asja. Ära vaata UI-d enne, kui koolitaja ütleb "valmis".

Kood `0` ja `/health` UP on sinu nullpunkt. Kõik, mis pärast "valmis" on teisiti, on intsidendi osa.

**Edasi saad minna, kui** enne intsidenti oli plaani kood `0`, `/health` oli UP, nullpunkt on `NOTES.md`-s ja koolitaja ütles "valmis".

## Kirjelda sümptomid enne parandamist

Ühtegi `apply`-d ei tee. Kogud kokku, mida iga vaatenurk näitab, ja paned kirja, milline käsk mida näitas ja mida mitte.

Kui teed kohe `./up.sh`, kaob osa lahknevusi vaikides ja sa ei saa kunagi teada, mis juhtus.

1. Kogu kokku, mida näevad kasutaja, Tofu ja Proxmox.

    ```bash
    curl -s http://web01/health; echo
    tofu plan -refresh-only -no-color | grep -E '^\s+[#~+-]|Plan:'
    tofu plan -no-color | grep -E '^\s+#|Plan:'
    tofu state list
    ```

2. Võrdle UI pool'i VM-ide nimekirja `tofu state list`-iga.
3. Kirjuta `NOTES.md`-sse tabel: iga lahknevuse kohta sümptom, kus sa selle nägid (kasutaja, `-refresh-only`, tavaline plaan, UI) ja mis tüüpi lahknevus see on.

Kui mõni lahknevus on näha ainult ühes vaates, on see kõige tähtsam rida tabelis. See ütleb, milline kontroll sul tootmises puudub.

**Edasi saad minna, kui** `NOTES.md`-s on kolm lahknevust ja iga juures on kirjas, milline käsk selle näitas ja milline mitte.

## Lahenda puuduv VM

Esimene lahknevus mõjutab kasutajat, nii et see tuleb esimesena. Enne parandamist selgitad, miks Tofu käitub nii, nagu ta käitub.

1. Selgita `NOTES.md`-s, miks plaan tahab VM-i luua, kuigi sina seda ei kustutanud: mida tegi refresh state'iga?
2. Taasta VM koodist. Kasuta `./up.sh`-i või `tofu apply`-d koos `ansible-playbook`-iga ainult selle hosti peal.
3. Uue VM-i host key on uus: puhasta control node'i `known_hosts` selle hosti nime ja IP jaoks.
4. Kontrolli sealt, kust teenust kasutatakse: küsi `/health` web01 kaudu, nagu teeb kasutaja, mitte taastatud VM-i seest.

    ```bash
    curl -s http://web01/health; echo
    ```

Arvesse läheb ainult kontroll, mis läbib sama tee nagu kasutaja. Tofu "Apply complete" ütleb, et VM on olemas, Ansible'i `ok` ütleb, et teenus on paigaldatud. Alles `/health` ütleb, et rakendus jõuab taastatud teenuseni. Kui `systemctl status` on taastatud VM-i peal roheline, aga rakendus ei saa sellega ühendust, on teenus kasutaja jaoks ikka maas.

**Edasi saad minna, kui** `/health` näitab kõiki sõltuvusi UP ja `NOTES.md`-s on selgitus, miks Tofu VM-i uuesti lõi.

## Lahenda muudetud atribuut

Teine lahknevus ei pruugi kedagi praegu häirida. Just seepärast tuleb see otsustada teadlikult, mitte lasta järgmisel `apply`-l see vaikides tagasi võtta.

Käsitsi muudatusel on tihti põhjus, mida koodis pole. Kui võtad selle tagasi ilma küsimata, võid tagasi tuua probleemi, mida keegi öösel parandas.

1. Leia `-refresh-only` väljundist, mis muutus, kus ja millest millele.
2. Otsusta: tagasi koodis kirjeldatud olekusse või koodi. Kaalu, mis teenus seal töötab, kas `check "ram_quota"` hoiatab ja mida see muudatus tähendab kvoodile.
3. Vii otsus ellu ainult koodi või Tofu käsuga.

Mõlemad otsused on õiged, kui põhjus on kirjas. Vale on ainult otsus, mida keegi ei teinud.

**Edasi saad minna, kui** plaanis pole enam `~` rida, `NOTES.md`-s on otsus koos põhjusega ja kui otsus oli "koodi", on muudatus commit'is.

## Lahenda tundmatu VM

Kolmas lahknevus on nähtamatu nii kasutajale kui Tofu tavalisele plaanile. Tofu ei kustuta ega muuda seda, mida ta ei tea.

1. Selgita `NOTES.md`-s, miks tavaline `tofu plan` seda VM-i ei näidanud.
2. Otsusta, kas VM jääb (siis on see koodis) või läheb (siis kustutad selle nii, et jälg jääb Giti). ops01 importimisel nägid mõlemat teed.
3. Kui tõid VM-i koodi alla, et see kustutada, eemalda pärast ka `import` plokk.

Kui pool ja `state list` klapivad, on Tofu vaade jälle terviklik. Edaspidi tähendab "No changes", et pool'is pole midagi, mida kood ei tea.

**Edasi saad minna, kui** UI pool'is on täpselt need VM-id, mis `tofu state list`-is (pluss control node), ja `NOTES.md`-s on otsus koos põhjusega.

## Kood, masinad, Ansible ja rakendus

Viimane kontroll käib läbi kõik tasemed samas järjekorras nagu `up.sh`: kood, masinad, Ansible, rakendus. Siis paned intsidendi kirja nii, et keegi teine saaks sellest õppida.

1. Kontrolli kõiki tasemeid.

    ```bash
    tofu plan -detailed-exitcode > /dev/null; echo "kood $?"
    ./up.sh; echo "kood $?"
    cd ../k02-ansible && ansible all -m ansible.builtin.ping -o
    curl -s http://web01/health; echo
    ```

2. Kontrolli, et drift'i kontroll oleks olukorra leidnud: `tofu plan -refresh-only -detailed-exitcode > /dev/null; echo "kood $?"` peab nüüd andma `0`. Kirjuta `NOTES.md`-sse, mida see oleks andnud kohe pärast "valmis".
3. Kirjuta `NOTES.md`-sse lühike intsidendi kokkuvõte: ajajoon (nullpunkt, avastus, iga otsus), mõju kasutajale ja kolm juurpõhjust ühe lausega.

Lisa `NOTES.md`-sse kaks lauset: milline neist kolmest oleks tootmises leitud kõige hiljem ja mis oleks selle varem välja toonud.

Kõik neli koodi `0` ja `/health` UP tähendavad, et kood, state, Proxmox ja masinate sisu on jälle üks tervik. Kokkuvõte on see osa, mida loeb ka inimene, kes intsidendi ajal kohal polnud.

**Edasi saad minna, kui** plaani kood on `0`, `./up.sh` lõpeb koodiga 0, viis hosti vastavad `SUCCESS`, `/health` on UP, `-refresh-only` annab `0` ja kokkuvõte on `NOTES.md`-s.


## Miks see nii töötab

**Refresh.** Refresh on iga plaani esimene samm. Tofu loeb iga state'is oleva objekti API-st ja kirjutab tulemuse state'i mälus olevasse koopiasse. Kui objekti pole, eemaldatakse see koopiast ja plaan näitab selle uuesti loomist.

**`-refresh-only`.** Seetõttu näitab tavaline `plan` kadunud VM-i lihtsalt reana „will be created" ega ütle, et midagi kadus. `-refresh-only` näitab sama sündmust otse kadumisena.

**Kolm lahknevust.** Lahknevusi on kolme liiki: state'is olev objekt, mida tegelikult pole; state'is olev objekt, mis on tegelikult teistsugune; ja objekt, millest state ei tea.

**Objekt, millest state ei tea.** Esimesed kaks leiab drift'i kontroll, kolmandat mitte, sest plaan küsib API-lt ainult state'is olevaid objekte, mitte kõike, mis seal veel on. Selle leidmiseks on vaja eraldi inventuuri, näiteks pool'i VM-ide võrdlust state'iga.

Kui jõudsid kiiremini: [Lisaülesanded → 15. Ühe hosti taastamine](lisa.md#15-uhe-hosti-taastamine), kirjutad skripti, mis taastab ühe katkise hosti teisi puutumata.
