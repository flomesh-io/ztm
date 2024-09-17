#include <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#include "bindings/bindings.h"
#include <dlfcn.h>
#import "ztm-Swift.h"


int main(int argc, char * argv[]) {
    @autoreleasepool {
        [ActivityHelper watchEvent];
        [ActivityHelper startLiveActivity];
        ffi::start_app();
        return 0;
    }
}

