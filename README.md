# ZTM (Zero Trust Mesh)

ZTM is an open source network infrastructure software for running a ***decentralized*** network. It is built upon ***HTTP/2 tunnels*** and can run on ***any sort of IP networks*** such as LANs, containerized networks and the Internet, etc.

## Why ZTM?

ZTM lays the foundation for building ***decentralized applications*** by providing a set of core capabilities including:

* Network connectivity across Internet gateways and firewalls
* TLS-encrypted communication channels
* Certificate-based authentication and access control
* Service discovery and load balancing

ZTM can be used in various settings ranging from a ***2-node personal network connecting one's home and workplace*** to a ***10,000-node enterprise network connecting offices and branches across the globe***. Examples of applications that can leverage ZTM are:

* Remote access your home computer from anywhere in the world
* Share documents, pictures and videos within a group of people without the need of a big-tech social networking platform
* Private and secure P2P chat or voice/video conferencing without the fear of eavesdropping

## Features

ZTM is written in ***PipyJS***, a JavaScript dialect designed for [***Pipy***](https://github.com/flomesh-io/pipy) (https://github.com/flomesh-io/pipy). ***Pipy*** is an open source programmable proxy software. Thanks to ***Pipy***, ZTM has many unique features on top of the capabilities it offers:

* **Fast**. HTTP/2 multiplexing is fast. And ***Pipy*** is fast. Like, C++ fast.

* **Secure**. All traffic is encrypted by TLS and has identities via certificates. By using ***PipyJS***, security policy can be easily customized to meet the requirements in your organization.

* **Highly customizable and programmable**, since ***Pipy*** in itself is a general-purpose networking scripting engine.

* **Portable**. Choose your CPU architecture: x86, ARM, MIPS, RISC-V, LoongArch... Choose your operating system: Linux, Windows, macOS, FreeBSD, Android... ZTM runs anywhere.
