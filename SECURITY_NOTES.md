# Synchronisation & Zugriff (Automerge, aktueller Stand)

## Was wird synchronisiert?
- `identity`: Lokales DID + optional `displayName`/`avatarUrl` (für alle sichtbar).
- `identities`: Pro DID ein Profil mit `displayName`/`avatarUrl` (Namensbindung pro DID).
- `assumptions`: `sentence`, `createdBy` (DID), Timestamps, `tagIds`, `voteIds`.
- `votes`: `value` (green|yellow|red), `voterDid`, optional `voterName`, Timestamps.
- `tags`: Name, optional Color, `createdBy` (DID).
- Meta: `version`, `lastModified`.

## Owner / Autorenschaft
- Jede Entität trägt `createdBy`/`voterDid` zur Nachvollziehbarkeit.
- Es gibt kein exklusives „Owner darf als einziger editieren“: CRDT lässt alle mit Doc-ID Änderungen machen.
- Neues Board wird vom aktuellen lokalen DID erstellt; Initiator ist faktischer Ersteller, aber ohne exklusive Rechte.

## Zugriff / Berechtigungen
- Keine serverseitige AuthZ: Jeder mit der Doc-ID und Sync-Zugang kann lesen/schreiben.
- Identitäten werden lokal erzeugt (DID + Name in localStorage) und mitgesynct.
- Votes/Annahmen/Tags sind damit von jedem veränderbar, der das Doc kennt; Konflikte löst CRDT.
- Sync läuft über `wss://sync.automerge.org` (öffentlicher Relay), kein E2EE eingebaut: Inhalte sind für jeden mit Doc-ID + Relay-Zugang sichtbar/bearbeitbar.

## Was fehlt für echten Schutz?
- Auth-Layer (z. B. signierte Aktionen pro DID).
- Policies/ACL im Dokument oder serverseitig.
- Optional E2EE/Teilen nur mit ausgewählten Peers statt öffentlichem Relay.
