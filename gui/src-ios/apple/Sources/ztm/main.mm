#include "bindings/bindings.h"

int main(int argc, char * argv[]) {
	ffi::start_app();
	ffi::pipy_main(argc, argv);
	return 0;
}
