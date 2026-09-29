# Registration implementation owners

`validate-image-registration.pinned.py` is the historical registration worker required by `procedure.json`, with its numerical steps unchanged; its receipts name files by path and no longer record file digests. The evidence replay resolves the old source location to this copy and checks that every named file is present and parses. This is an archived input, not the active registration implementation.

New registration work uses `labs/nebula/packages/reconstruction/src/registration/validate-image-registration.py`. Supply `--recipe`, `--source-id`, and `--reference-id` explicitly. Numerical registration is unchanged; the active worker removes target-specific defaults and labels contact sheets from the supplied image identities. Old receipts remain historical; new runs identify the new worker.
