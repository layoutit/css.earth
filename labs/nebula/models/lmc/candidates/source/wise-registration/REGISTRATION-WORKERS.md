# Registration implementation owners

`validate-image-registration.pinned.py` is the unchanged historical scientific input required by `procedure.json`. SHA-256: `c618151fc317a19eba8308b24e28ee20ae1bcb6e1a2d3b107e80fcb5c8044e50`. The evidence replay resolves the old source location to this frozen copy before checking its bytes. This is an archived input, not the active registration implementation.

New registration work uses `labs/nebula/packages/reconstruction/src/registration/validate-image-registration.py`. Supply `--recipe`, `--source-id`, and `--reference-id` explicitly. Numerical registration is unchanged; the active worker removes target-specific defaults and labels contact sheets from the supplied image identities. Old receipts remain historical; new runs identify the new worker.
