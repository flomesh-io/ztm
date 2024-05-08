# Quick Start

Here's the step by step quick start docs. Since more features are emerging, please feel free to open an issue if you find mismatch of this doc. Well, let's start!

## Prepare

* Clone this repo.

```shell
$ git clone https://github.com/flomesh-io/ztm.git
```

* Download the latest App that suits your computor/laptop.

```
https://github.com/flomesh-io/ztm/releases
```

* Any release Linux machine from your public cloud vendor, which has an elastic IP. We recommand `Ubuntu 22` 、`Ubuntu 24` 、`Debian12` and `CentOS Stream`. This is the box you shall run `ZTM Hub`.

   **Please pay attention**: you should accept all IPs accessing port `8888`. Refer to your public cloud vendor, like `Security Groups` or `Firewalls`.

## Network topology

![netowkr topology](assets/network-topo.png)

In this case, I'm trying access `ssh` service of `megatron` from `KeveinsMBP`.

## Deploy the ZTM Hub

* Login to your Hub box, which is the **public cloud instance**. 

``` shell
$ ssh kevein@myhub
$ arch=`uname -m`
$ wget https://pipy-oss-1255617643.cos-website.ap-beijing.myqcloud.com/repo/pipy/${arch}/binary/pipy-1.1.0-33-generic_linux-${arch}.tar.gz
$ tar xvf pipy-1.1.0-33-generic_linux-${arch}.tar.gz && sudo cp -f usr/local/bin/pipy /usr/local/bin && rm -fr usr
$ git clone https://github.com/flomesh-io/ztm.git
```

* Then start up `CA` Service.

```shell
$ cd ~/ztm/ca
$ screen -S ztm-ca   # you'll enter a screen session
$ ./main.js
./main.js 
2024-05-09 00:55:17.573 [INF] [listener] Listening on TCP port 9999 at 0.0.0.0
2024-05-09 00:55:17.573 [INF] [worker] Thread 0 started


(Use ctrl+a then ctrl+d to detach from this screen session)
```

* Run `Hub` service.

```shell
$ cd ~/ztm/hub
$ screen -S ztm-hub # you'll enter a screen session
$ ./main.js
...detail omitted...
-----END CERTIFICATE-----

2024-05-09 01:01:49.827 [INF] [listener] Listening on TCP port 8888 at 0.0.0.0
2024-05-09 01:01:49.827 [INF] Hub started at 0.0.0.0:8888
```

> **_NOTE:_** We'll soon provide systemd scripts for CA and Hub service instead of using screen.

 **Again**, please make sure the port `8888` is public accessable.

## Get certificates for both your agents

Every agent use certifcate to communicate with Hub(s). And `Hub` can abstract user name from certs. At this moment, a super user can manipulate all agents that called `root`.

### Get cert for megatron

* Run the following command on `Hub`:

```shell
$ curl -d '' http://localhost:9999/api/certificates/megatron  | tee megatron.key
$ curl http://localhost:9999/api/certificates/megatron  | tee megatron.pem
$ curl http://localhost:9999/api/certificates/ca | tee ca.pem
```

Download all these there files to the host `megatron`.

### Get cert for KeveinsMBP

* Run the following command on `Hub`:

```shell
$ curl -d '' http://localhost:9999/api/certificates/root  | tee root.key
$ curl http://localhost:9999/api/certificates/root  | tee root.pem
$ curl http://localhost:9999/api/certificates/ca | tee ca.pem
```

Download all these there files to the host `KeveinsMBP`. This is the super user of current mesh.

