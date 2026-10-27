# National restricted simulation — 27/10/2026

Local only. No government call, real invoice or customer email in this simulation.
Postman CLI 1.75.0, path routing on loopback port 5239, member `sefin`.
Owner discovery returned unrelated providers; none was adopted. The model follows
the SEFIN Swagger obtained with the existing SYSNEY certificate on DRServer:
https://sefin.producaorestrita.nfse.gov.br/SefinNacional/swagger/docs/v1
Official endpoint catalogue:
https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao

Start from repository root:

```powershell
postman simulation run postman/simulations/national-restricted.sim.yaml --port 5239 --no-history
$env:NATIONAL_SIM_BASE='http://127.0.0.1:5239/sefin'
node --test --test-concurrency=1 tests/national-restricted-http.test.mjs tests/national-workflow-http.test.mjs tests/national-profile.test.mjs
./tests/national-signature.test.ps1
```

Verify the CLI help for the installed version before restarting. Do not stop other
ATP simulations or Azurite. The mock supports only POST nfse, GET dps/nfse, one
specific event lookup and fake DANFSe. Unmodelled operations return 501. No fallback
to a real service. No credentials in the simulation. Synthetic recipient and
`cTribNac=000000` are intentionally unsuitable for government transmission; native
transport additionally refuses `NAO TRANSMITIR`. Keep this fixture blocked.

Observed: 201, idempotent replay GET-only, conflicting content blocked, timeout after
provider commit followed by DPS/key recovery without a second POST, wrong environment,
HTML/500, unavailable call, malformed gzip/base64, PDF recovery and corrupt PDF rejection.
Initial wrong-environment test found that the mock reused its saved environment;
the mock was corrected and the complete tests rerun successfully.

Integrated test enters the actual ATP facade over HTTP, uses its stored request to
reserve existing work provenance, builds DPS, injects a synthetic signer, calls the
real restricted client over Postman HTTP, and stores returned XML/PDF privately.
Signature injection in this HTTP test is not native signing. The separate PowerShell
test signs both the fixture and generated DPS with an in-memory QA certificate,
validates the pinned official restricted XSD, rejects tampering and production.
The actual SYSNEY certificate was tested separately on DRServer without exporting
the key or transmitting. None of these is an official authorized test NFS-e.

Restricted documents stay in a separate QA work namespace; the ATP public request
remains pending_review, document GET stays 409, and nationalAdapterReady stays false.
No cancellation POST is implemented. A specific event 404 cannot establish absence
of all cancellation/substitution events. Real ADN status normalization and DANFSe
download remain to be exercised against an officially authorized restricted note.

Final regression used an independent Azurite on loopback11010/11012 after the
shared11000 instance returned500 on QA blob PUT. No shared process/data was changed.
`ATP_AZURITE_BLOB_PORT` and `ATP_AZURITE_TABLE_PORT` select those local test ports;
the emulator helper still rejects remote endpoints. The fixture, native signature,
HTTP mock and live readonly mTLS observations remain distinct forms of evidence.

Integrated preparation now uses the durable sequence interface. HTTP simulation
exercises concurrent preparation and restarted workflow replay; Azurite regression
exercises the real atomic counter/assignment with8 same-request reservations,
8 different requests, recreated clients, post-commit lost response and series scope.
31 Node tests pass; runner dry-run tests assert no write or provider transport.
