#include <Foundation/Foundation.h>
#include "bindings/bindings.h"

void copyLibrary(NSString *resourceName, NSString *resourceType, NSString *destName) {
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSError *error = nil;

    // 获取资源路径
    NSString *resourcePath = [[NSBundle mainBundle] pathForResource:resourceName ofType:resourceType];
    if (resourcePath == nil) {
        NSLog(@"libpipy Failed to get resource path for %@", resourceName);
        return;
    }

    // 获取目标路径 (应用的文档目录)
		NSArray *paths = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES);
		NSString *libraryDirectory = [paths objectAtIndex:0];
		NSLog(@"libpipy libraryDirectory is %@", libraryDirectory);
		NSString *frameworksDirectory = [libraryDirectory stringByAppendingPathComponent:@"Frameworks"];
		// NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
		// NSString *documentsDirectory = [paths objectAtIndex:0];
		// NSString *frameworksDirectory = [documentsDirectory stringByAppendingPathComponent:@"../Library/Frameworks/"];
		NSLog(@"libpipy frameworksDirectory is %@", frameworksDirectory);
		NSString *targetPath = [libraryDirectory stringByAppendingPathComponent:destName];
		NSLog(@"libpipy targetPath is %@", targetPath);
    // 复制文件
    if ([fileManager fileExistsAtPath:targetPath]) {
        NSLog(@"libpipy File already exists at target path: %@", targetPath);
    } else {
        if (![fileManager copyItemAtPath:resourcePath toPath:targetPath error:&error]) {
            NSLog(@"libpipy Failed to copy file: %@", [error localizedDescription]);
        } else {
            NSLog(@"libpipy File copied successfully to %@", targetPath);
        }
    }
}


int main(int argc, char * argv[]) {
    @autoreleasepool {
			copyLibrary(@"assets/libpipy", @"dylib", @"libpipy.dylib");
			// copyLibrary(@"assets/libsayhello", @"dylib", @"libsayhello.dylib");
			// copyLibrary(@"assets/pipy", @"framework", @"pipy.framework");
			ffi::start_app();
    }
    return 0;
}
