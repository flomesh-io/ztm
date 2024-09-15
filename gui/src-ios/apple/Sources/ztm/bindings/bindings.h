#pragma once

namespace ffi {
    extern "C" {
        void start_app();
    }
    extern "C" {
        int pipy_main(int argc, char *argv[]);
    }
}

