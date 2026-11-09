---
tags:
  - Kubernetes
  - Helm
  - GitOps
  - SRE
  - Loeng
---

# Loeng: Kubernetes ja GitOps lähemalt

Loeng jätkab IS1 [Kubernetese ja GitOpsi loengut](https://hkhk-tk.github.io/is1-automatiseerimine/k07/loeng/): ressursipiirid, katkestuseta uuendus, võrgupiirangud, Helm ja Kustomize, GitOpsi riskid, klastri elutsükkel, SRE ning sündmuspõhine automaatika. Loe seda pärast IS1 loengut ja praktikumi 2. osa.

??? abstract "Õpiväljundid"

    Pärast loengut oskad:

    - eristada requests'e ja limits'e ning valida neile väärtused;
    - selgitada, miks rolling update võib anda vigu ka õigete probe'idega;
    - kavandada klastri versiooniuuendust node'i kaupa;
    - sõnastada teenusele SLI ja SLO, arvutada error budget'i ja otsustada selle järgi, kas deploy'd jätkata.

## Juhttasand on jagatud ressurss

Control plane on samasugune jagatud ressurss nagu andmebaasiserver. Iga node'i kubelet ja iga kontroller hoiab API serveriga avatud ühendust, nii et uus tööriist, mis teeb API-le palju päringuid, võib koormata kogu klastrit. OpenAI 2024. aasta detsembri katkestus algas just nii: uus telemeetriateenus käivitus korraga kõigil node'idel ja koormas control plane'i üle ([OpenAI incident report](https://status.openai.com/incidents/ctrsv3lwd797)). Seepärast tuuakse uus DaemonSet node'idele lainetena, mitte kõigile korraga.

## Requests ja limits

[`requests`](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) on reserveering, mille järgi scheduler pod'i paigutab, ja `limits` on lagi, mille jõustab kernel.

Mälu ja CPU limiit käituvad erinevalt. Mälulimiidi ületanud protsessi tapab OOM killer ja konteiner lõpeb koodiga 137 (`OOMKilled`). CPU limiit ei tapa, vaid aeglustab: `cpu: 500m` lubab 50 ms protsessoriaega iga 100 ms kohta ja ülejäänud aja protsess ootab. See avaldub latentsusena, mitte veana, seepärast jätavad paljud meeskonnad CPU-le ainult requests'i.

Requests'ide valik on sama kompromiss, mida VMware'i administraator teeb ülebroneerimisega. Liiga väikesed requests'id pakivad node'id täis ja mälupuuduse korral tõstab kubelet pod'e välja. Liiga suured jätavad node'id pooltühjaks. Mõistlik algus on mõõdetud kasutus väikese varuga. Namespace'i tasandil paneb [ResourceQuota](https://kubernetes.io/docs/concepts/policy/resource-quotas/) requests'idele ülempiiri ja LimitRange annab vaikeväärtused pod'idele, kus requests puudub. Mälupuuduse korral tõstetakse esimesena välja pod'id, millel requests puudub, viimasena need, mille requests võrdub limits'iga. Andmebaasile tasub anda võrdsed väärtused.

## Katkestuseta uuendus

Readiness'ile toetub ka **rolling update**. Uus ReplicaSet kasvab ühe pod'i kaupa ja vana kahaneb alles siis, kui uus pod on Ready. Kui uus versioon Ready'ks ei saa, jääb uuendus pooleli ja vana versioon teenindab edasi. Kubernetes ise muudatust tagasi ei pööra: rollback'i teeb inimene (`kubectl rollout undo`), pipeline või GitOps'i tööriist.

<figure markdown="span">
  ![Rolling update: uus ReplicaSet kasvab, vana kahaneb](assets/k07_rolling_update.svg)
  <figcaption>Joonis 7.1. Rolling update kahe ReplicaSet'i vahel. Vana pod läheb ära alles pärast seda, kui uus on Ready.</figcaption>
</figure>

Rolling update võib anda 502 vastuseid ka siis, kui probe'id on õiged. Kui pod lõpetatakse, saab konteiner SIGTERM'i ja samal ajal eemaldatakse pod lõpp-punktidest. Eemaldus jõuab igale node'ile mõne hetkega, nii et kui rakendus sulgub kohe, saavad selle aja jooksul saabunud päringud vea. Lahendus on `preStop` hook, mis ootab mõned sekundid, ja rakendus, mis lõpetab pooleliolevad päringud ([Pod termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination)). Load balancer'i taga töötanud admin tunneb seda kui serveri `drain`-olekut enne hooldust.

## Võrgupiirangud

Klastri sisevõrk on vaikimisi lame: iga pod jõuab iga pod'ini. [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/) lubab ainult nimetatud ühendused, kuid selle jõustab võrgulaiendus (CNI). Kui CNI seda ei toeta, objekt luuakse ja midagi ei blokeerita. NetworkPolicy tugineb label'itele, seega on see tõhus ainult koos RBAC-iga, mis ei luba suvaliste label'itega pod'e luua.

## Helm ja Kustomize

Valmis tarkvara, näiteks monitooring või andmebaasi operaator, tähendab kümneid manifeste ja iga keskkond vajab veidi erinevaid väärtusi. [Helm](https://helm.sh/docs/) koostab **chart**'i mallidest values-faili põhjal manifestid. Iga paigaldus on **release**, mille ajalugu hoitakse namespace'is ja rollback loob vanast revisjonist uue revisjoni. `helm upgrade` ilma values-failita paneb väärtused tagasi chart'i vaikeväärtustele ja eelmise paigalduse `--set` väärtused kaovad märkamatult. Seepärast hoitakse väärtused failis ja Gitis ning chart'i versioon lukustatakse nagu image'i tag. Oma rakenduse manifestidele lisavad paljud meeskonnad keskkonnapõhised muudatused [Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)'iga ilma mallideta.

## GitOpsi hind

GitOps'il on oma hind. Argo CD-l on tavaliselt laiad õigused kõigis klastrites, mida ta haldab, nii et see on ründaja jaoks sama väärtuslik sihtmärk nagu IS1 6. kohtumise Jenkins ([CVE-2022-24348](https://nvd.nist.gov/vuln/detail/CVE-2022-24348)). Teine küsimus on Giti ülesehitus: kas keskkonnad on harud või kaustad. Enamik meeskondi kasutab ühte haru ja keskkonnakaustu, kus keskkondade vahe on nähtav ühe `diff`-iga. Sama mõtet järgis Ansible'i `group_vars`: üks kood, keskkonna erinevus eraldi failis.

## Klastri elutsükkel ja CloudOps

Kubernetes annab välja umbes kolm minor-versiooni aastas ja iga versioon saab parandusi umbes 14 kuud ([Releases](https://kubernetes.io/releases/)). Klaster, mida ei uuendata, on aasta pärast ilma turvaparandusteta, nii et uuendus on sama korrapärane töö nagu OS-i patch'imine.

Järjekorra määrab [version skew policy](https://kubernetes.io/releases/version-skew-policy/). Kõigepealt uuendatakse control plane, ühe minor-versiooni kaupa. Node'ide kubelet võib olla mõne versiooni võrra vanem, nii et node'id uuendatakse hiljem, lainetena: `kubectl cordon` keelab node'ile uued pod'id ja `kubectl drain` tõstab olemasolevad mujale. Drain arvestab [PodDisruptionBudget'it](https://kubernetes.io/docs/tasks/run-application/configure-pdb/): kui rakendusel peab olema vähemalt kaks töötavat koopiat, ootab drain, kuni see on tagatud. Enne uuendust kontrolli, kas mõni manifest kasutab eemaldatavaid API-versioone, ja tee etcd'st varukoopia.

Reddit uuendas 2023. aasta märtsis klastri 1.23 pealt 1.24 peale ja oli 314 minutit maas ([You Broke Reddit](https://www.reddit.com/r/RedditEng/comments/11xx5o0/you_broke_reddit_the_piday_outage/)). 1.24 eemaldas node'idelt label'i, millele toetus aastaid tagasi käsitsi tehtud võrguseadistus. Seda seadistust polnud koodis ja selle autorid olid ettevõttest lahkunud. Uuendus oli korrektne, aga koodist mööda tehtud muudatus muutis selle riskantseks.

Klastri sertifikaadid kehtivad tavaliselt aasta ja uuenevad koos klastri uuendusega. Klaster, mis töötab aasta ilma uuenduseta, lakkab ühel päeval vastamast. Aegumist tasub jälgida monitooringus samamoodi nagu veebiserveri sertifikaati.

**Hallatud klaster** (EKS, AKS, GKE) võtab sinult üle control plane'i ja etcd. Node'ide uuendus, lisad (võrk, Ingress, salvestus), RBAC ja kulu jäävad sinule ning uuenduste tempo määrab pakkuja. Pilveressursside igapäevast käitamist nimetatakse **CloudOps**'iks. Mahtu lisab automaatselt [Cluster Autoscaler](https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler) või Karpenter siis, kui pod jääb requests'ide tõttu `Pending` olekusse, ja kulu arvutatakse requests'ide, mitte kasutuse järgi. Paisutatud requests on pilves otsene arve.

## SRE: mõõdetud töökindlus

Öine alert ütleb, et node'i CPU on 90%. Valvaja ei tea, kas kasutaja kannatab, ja hommikul selgub, et ei kannatanud. Teisel ööl on kõik näidikud rohelised, aga pool päringutest annab 502.

[SRE](https://sre.google/sre-book/service-level-objectives/) mõõdab töökindlust kasutaja vaatest:

- **SLI** on suhe: edukate sündmuste arv kõigist, näiteks HTTP vastused alla 500 ja kiiremad kui 300 ms. SLI-d mõõdetakse sealt, kust teenust kasutatakse (Ingress-kontrollerist või välisest kontrollist), mitte pod'i seest.
- **SLO** on sihtväärtus ajaaknas, näiteks 99,9% 30 päeva jooksul.
- **Error budget** on lubatud viga, 1 − SLO. 99,9% puhul on see 0,1% päringutest ehk ühtlase liikluse korral umbes 43 minutit kuus.

Eelarve muudab vaidluse „kas teeme reedel deploy“ arvuks: kui eelarvet on alles, võib riskida, kui see on otsas, muudatused peatatakse ja aeg kulub töökindluse parandamisele. Selle reegli peab juhtkond enne kokku leppima. Iga lisanduv üheksa maksab mitu korda rohkem: 99,99% jätab kuus umbes 4 minutit, mis on vähem kui ühe käsitsi rollback'i aeg. ITIL-i taustaga admin võib error budget'it vaadata kui muudatuste nõukogu (CAB) mõõdetud kriteeriumi.

Alert ei põhine lävendil, vaid sellel, kui kiiresti eelarve kulub (**burn rate**). Kiirus 1 kulutab eelarve täpselt akna lõpuks, 14,4 kulutab tunniga 2% kuu eelarvest. Valvaja kutsutakse siis, kui kiirust näitavad nii pikk kui ka lühike aken, et lühike piik ei ajaks kedagi öösel üles ([Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)):

```promql
# 99,9% SLO, kiirus 14,4: nii pikk kui ka lühike aken üle piiri
(sum(rate(traefik_service_requests_total{code=~"5.."}[1h]))
  / sum(rate(traefik_service_requests_total[1h])) > 14.4 * 0.001)
and
(sum(rate(traefik_service_requests_total{code=~"5.."}[5m]))
  / sum(rate(traefik_service_requests_total[5m])) > 14.4 * 0.001)
```

**Toil** on käsitsi tehtav, korduv ja automatiseeritav töö, mis kasvab koos teenusega: sertifikaadi käsitsi uuendamine, öine pod'i taaskäivitus, kettaruumi koristamine. Kui toil'i mõõdad valvelogist, tead, mida automatiseerida esimesena ([Eliminating Toil](https://sre.google/sre-book/eliminating-toil/)).

Kui eelarve kulus rikke tõttu, järgneb süüdistusteta **postmortem**: ajajoon, mõju SLO-le, soodustanud tegurid ja tegevused koos omanikuga. Kubernetes hoiab sündmusi (Events) vaikimisi ainult tund aega, nii et öise rikke kohta on hommikul vähe tõendeid. Events tuleb jooksvalt logisüsteemi saata.

## Signaalist tegevuseni: sündmuspõhine automaatika ja AI

Kubernetes taastab ise kõik, mis kuulub tema mudelisse: taaskäivitab konteineri, asendab pod'i ja viib pod'id kadunud node'ilt mujale. Täis ketas, aeguv sertifikaat või väline teenus jäävad sellest välja. Seal töötab **sündmuspõhine automaatika**: Alertmanager saadab alerdi webhook'iga reeglimootorile, näiteks [ansible-rulebook](https://ansible.readthedocs.io/projects/rulebook/en/latest/)'ile, mis käivitab tingimuse järgi heakskiidetud playbook'i. Otsus on reegli autori poolt eelnevalt tehtud ja eskalatsioon inimesele on reeglis kirjas.

Riskid on tuttavad. Automaatne restart võib peita põhjust, kuni see kasvab suuremaks, ja kahe reegli vastandlikud tegevused tekitavad tsükli. Seepärast on tegevus idempotentne, kontrollib enne olekut uuesti, sellel on käivituste arvu piir ja iga käivitus läheb ticket'isse. Piirid peavad olema tööriistas endas: AWS-i S3 2017. aasta katkestuse põhjus oli heakskiidetud käsk vale sisendiga, ja pärast seda muutis AWS tööriista nii, et see ei luba minna alla miinimummahu ([Summary of the Amazon S3 Service Disruption](https://aws.amazon.com/message/41926/)).

**AIOps** seob signaalid kokku, nii et 200 alerti muutuvad üheks intsidendiks, ja leiab anomaaliad, millele keegi lävendit ei pannud. AI-agendid lähevad edasi ja pakuvad parandust. Teada probleemi lahendab odavamalt ja ennustatavamalt tavaline playbook. Enne kui agent tohib klastris midagi muuta, peab paigas olema kolm asja:

1. **Tegevuste loend:** agent valib testitud playbook'ide seast, mitte ei koosta käske ise.
2. **Piirid:** oma ServiceAccount, Role ainult vajalike õigustega ühes namespace'is, ohtlik tegevus ootab inimese kinnitust. Mida agent tohib, näitab `kubectl auth can-i --list --as=system:serviceaccount:ops:agent`.
3. **Audit:** API serveri [audit log](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/) näitab, milline identiteet mida muutis.

Agent, kes loeb logisid, loeb ka teksti, mille ründaja sinna kirjutas, nii et logist tulnud „juhist“ ei tohi kunagi täita.

??? info "Loe juurde"

    [Site Reliability Engineering](https://hkhk-tk.github.io/is1-automatiseerimine/teemad/sre/) · [Sündmuspõhine automaatika](https://hkhk-tk.github.io/is1-automatiseerimine/teemad/sundmuspohine-automaatika/) · [AI ja automatiseerimine](https://hkhk-tk.github.io/is1-automatiseerimine/teemad/ai-ja-automatiseerimine/) · [Kubernetese klastrihaldus](https://hkhk-tk.github.io/is1-automatiseerimine/teemad/kubernetes-klastrihaldus/).

??? abstract "Kokkuvõte"

    - **Ressursid:** requests määrab paigutuse, limits'i jõustab kernel. Mälulimiidi ületus tapab protsessi, CPU limiit aeglustab.
    - **Rolling update:** uus pod saab liiklust alles Ready olekus, vana pod vajab lõpetamisel `preStop` ootust.
    - **Klastri elutsükkel:** control plane ühe minor-versiooni kaupa, node'id drain'iga PodDisruptionBudget'i piires.
    - **SLO:** mõõda kasutaja vaatest, alerdi burn rate'i järgi ja lepi enne kokku, mis juhtub, kui eelarve on otsas.
    - **Sündmus ja AI:** alert käivitab ainult heakskiidetud ja piiratud tegevust, agendil on oma identiteet ja audit.

## Kontrolli ennast

??? question "Teenuse SLO on 99,9% 30 päeva aknas, liiklus on ühtlane. Eilne vigane deploy andis 20 minutit ainult 5xx vastuseid. Kas reedene deploy võib minna?"
    Kuu eelarve on umbes 43 minutit, eilne rike kulutas sellest ligi poole. Kui eelarve poliitika lubab deploy'd ainult siis, kui eelarvet on üle poole alles, ootab reedene muudatus. Otsus tuleb poliitikast, mitte tundest.

??? question "AI-agent pakub öise rikke korral ise `kubectl delete pvc` ja tal on selleks õigus olemas. Mis on valesti?"
    Tegevus ei ole heakskiidetud raamatukogus ja õigused on liiga laiad. Agendi Role peab lubama ainult raamatukogu tegevusteks vajalikke verb'e, pöördumatu tegevus vajab inimese kinnitust ja audit log peab näitama agendi identiteeti.
