#include <Foundation/Foundation.h>
#include "bindings/bindings.h"

void copyLibrary() {
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSError *error = nil;

    // 获取资源路径
    NSString *resourcePath = [[NSBundle mainBundle] pathForResource:@"assets/libpipy" ofType:@"dylib"];
    if (resourcePath == nil) {
        NSLog(@"Failed to get resource path for assets/libpipy.dylib");
        return;
    }

    // 获取目标路径 (应用的文档目录)
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths objectAtIndex:0];
    NSString *targetPath = [documentsDirectory stringByAppendingPathComponent:@"libpipy.dylib"];

    // 复制文件
    if ([fileManager fileExistsAtPath:targetPath]) {
        NSLog(@"File already exists at target path: %@", targetPath);
    } else {
        if (![fileManager copyItemAtPath:resourcePath toPath:targetPath error:&error]) {
            NSLog(@"Failed to copy file: %@", [error localizedDescription]);
        } else {
            NSLog(@"File copied successfully to %@", targetPath);
        }
    }
}

int main(int argc, char * argv[]) {
    @autoreleasepool {
        copyLibrary();
        ffi::start_app();
    }
    return 0;
}
