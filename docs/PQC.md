# Post-Quantum Cryptography How-To

## Enable PQC with a new deployment

All you have to do to enable PQC when deploying a new mesh is to start your hubs and agents with options `--pqc-key-exchange` and/or `--pqc-signature`.

On the hub side:

```sh
ztm start hub --names xx.xx.xx.xx:8888 --pqc-key-exchange ML-KEM-512 --pqc-signature ML-DSA-44
```

On the agent side:

```sh
ztm start agent --pqc-key-exchange ML-KEM-512 --pqc-signature ML-DSA-44
```

Available algorithms for `--pqc-key-exchange` include:

```
ML-KEM-512
ML-KEM-768
ML-KEM-1024
```

Available algorithms for `--pqc-signature` include:

```
ML-DSA-44
ML-DSA-65
ML-DSA-87
SLH-DSA-128s
SLH-DSA-128f
SLH-DSA-192s
SLH-DSA-192f
SLH-DSA-256s
SLH-DSA-256f
```

## Enable PQC on an existing deployment

Existing deployments might have traditional RSA keys and certificates already configured. To enable PQC, you'll have to generate all required keys and certificates again.

On the hub side, stop the hub, delete `~/.ztm/ztm-hub.db`, and then generate a new root permit with the options said above:

```sh
ztm root --names xx.xx.xx.xx:8888 --pqc-key-exchange ML-KEM-512 --pqc-signature ML-DSA-44
```

After that, start the hub with the same PQC options:

```sh
ztm start hub --names xx.xx.xx.xx:8888 --pqc-key-exchange ML-KEM-512 --pqc-signature ML-DSA-44
```

On the agent side, you need to leave the old mesh, restart the agent with the same PQC settings as the hub side:

```sh
ztm start agent --pqc-key-exchange ML-KEM-512 --pqc-signature ML-DSA-44
```

After the agent starts, join the mesh with the newly generated root permit.
