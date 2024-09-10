#include <Foundation/Foundation.h>
#include "bindings/bindings.h"
#include <dlfcn.h>

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


void callPipyMain(int argc, char * arguments[]) {
    // 获取 libpipy.dylib 的路径
    NSString *path = [[NSBundle mainBundle] pathForResource:@"assets/libpipy" ofType:@"dylib"];
    if (!path) {
        NSLog(@"callPipyMain 未找到动态库 libpipy.dylib");
        return;
    }

    // 加载动态库
    void *handle = dlopen([path UTF8String], RTLD_NOW);
    if (!handle) {
        const char *error = dlerror();
        if (error) {
            NSLog(@"callPipyMain 加载动态库失败: %s", error);
        }
        return;
    }

    // 获取 pipy_main 函数指针
    const char *symbolName = "pipy_main";
    typedef int (*PipyMainFunction)(int, char **);
    PipyMainFunction pipyMain = (PipyMainFunction)dlsym(handle, symbolName);
    if (!pipyMain) {
        NSLog(@"callPipyMain 未找到符号: %s", symbolName);
        dlclose(handle);
        return;
    }

		// int argCount = sizeof(arguments) / sizeof(arguments[0]);
    // 调用 pipy_main 函数
    int result = pipyMain(argc, arguments);

    // 输出结果
    NSLog(@"callPipyMain pipy_main 返回值: %d", result);

    // 关闭动态库
    dlclose(handle);
}


void startPipyInNewThread(int argc, char * argv[]) {
    // 创建一个新的线程来调用 callPipyMain
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
			// callPipyMain(argc, argv);
			int result = ffi::pipy_main(argc, argv);
			NSLog(@"callPipyMain pipy_main 返回值: %d", result);
    });
}


int main(int argc, char * argv[]) {
    @autoreleasepool {
			// copyLibrary(@"assets/libpipy", @"dylib", @"libpipy.dylib");
			// 准备参数
			
			NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
			NSString *documentDirectory = [paths objectAtIndex:0];
			NSLog(@"libpipy documentDirectory is %@", documentDirectory);
			NSString *ztmdbPath = [documentDirectory stringByAppendingPathComponent:@"ztmdb"];
			const char *args[] = {"--pipy", "repo://ztm/agent", "--args", "--data", [ztmdbPath UTF8String], "--listen", "7777", "--pipy-options", "--log-local-only"};
			int argCount = sizeof(args) / sizeof(args[0]);
			startPipyInNewThread(argCount, (char **)args);
			// copyLibrary(@"assets/libpipy.dylib", @"dSYM", @"libpipy.dylib.dSYM");
			// copyLibrary(@"assets/libsayhello", @"dylib", @"libsayhello.dylib");
			// copyLibrary(@"assets/pipy", @"framework", @"pipy.framework");
			ffi::start_app();
    }
    return 0;
}
