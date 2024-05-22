
# Build

If you'd like to stay up close to our latest progress, you don't have to wait for a binary release to happen. Building from the source is pretty straightforward as long as you have all the prerequisites installed.

## Build for Linux

The following prerequisites are required to build on a Linux variant:

* Clang (version 5.0 or above)
* CMake (version 3.1 or above)
* Node.js (version 16 or above)

For Ubuntu, for example, these tools can be installed by:

```sh
apt update
apt install clang cmake npm
```

> If the version of Node.js that comes with your Linux release isn't high enough, we recommend you to upgrade it with a _Node version manager_ such as [n](https://www.npmjs.com/package/n). Simply do:
>
> ```sh
> npm install -g n
> n 16
> ```

After that, clone the project and execute `build.sh`:

```sh
git clone https://github.com/flomesh-io/ztm.git
cd ztm
./build.sh
```

The final output is a single executable file located at `ztm/bin/ztm`.

## Build for macOS

If you are on macOS, the following are required to build ZTM:

* Xcode (version 15 or above)
* [CMake](https://cmake.org/) (version 3.1 or above)
* [Node.js](https://nodejs.org/) (version 16 or above)

Once you have all these tools installed, clone the project and execute `build.sh`:

```sh
git clone https://github.com/flomesh-io/ztm.git
cd ztm
./build.sh
```

The final output is a single executable file located at `ztm/bin/ztm`.

## Build for Windows

For Windows users, the following tools need to be installed prior to build:

* Microsoft Visual Studio 2022 or above
* [CMake](https://cmake.org/) (version 3.1 or above)
* [Node.js](https://nodejs.org/) (version 16 or above)
* [Perl](https://www.perl.org/) (ActiveState version 5.38 or above)
* [NASM](https://nasm.us/) (version 2.16 or above)

Since we are building with *Microsoft Visual C++*, we need to open *Developer Command Prompt for VS 2022* in order to have the build system environment set up propertly. In *Developer Command Prompt for VS 2022*, clone the project and execute `build.cmd`:

```sh
git clone https://github.com/flomesh-io/ztm.git
cd ztm
build.cmd
```

The final output is a single executable file located at `ztm\bin\ztm.exe`.
