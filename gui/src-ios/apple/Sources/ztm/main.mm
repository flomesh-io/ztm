#include <Foundation/Foundation.h>
#import <BackgroundTasks/BackgroundTasks.h>
#import <UIKit/UIKit.h>
#include "bindings/bindings.h"
#include <dlfcn.h>

/*
// copyLibrary(@"assets/libpipy", @"dylib", @"libpipy.dylib");
// copyLibrary(@"assets/libpipy.dylib", @"dSYM", @"libpipy.dylib.dSYM");
// copyLibrary(@"assets/libsayhello", @"dylib", @"libsayhello.dylib");
// copyLibrary(@"assets/pipy", @"framework", @"pipy.framework");
*/
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

void startPipyInNewThread() {
		// 创建一个后台任务
    __block UIBackgroundTaskIdentifier bgTask = [[UIApplication sharedApplication] beginBackgroundTaskWithExpirationHandler:^{
        [[UIApplication sharedApplication] endBackgroundTask:bgTask];
        bgTask = UIBackgroundTaskInvalid;
    }];
			
    // 创建一个新的线程来调用 callPipyMain
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
			NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
			NSString *documentDirectory = [paths objectAtIndex:0];
			NSLog(@"libpipy documentDirectory is %@", documentDirectory);
			NSString *ztmdbPath = [documentDirectory stringByAppendingPathComponent:@"ztmdb"];
			const char *args[] = {"--pipy", "repo://ztm/agent", "--args", "--data", [ztmdbPath UTF8String], "--listen", "7777", "--pipy-options", "--log-local-only"};
			int argCount = sizeof(args) / sizeof(args[0]);
			
			int result = ffi::pipy_main(argCount, (char **)args);
			NSLog(@"callPipyMain pipy_main 返回值: %d", result);
			
			// 当任务完成后，结束后台任务
			// [[UIApplication sharedApplication] endBackgroundTask:bgTask];
			// bgTask = UIBackgroundTaskInvalid;
    });
}

// 处理后台任务
void handleBackgroundTask(BGProcessingTask *task) {
	 // 确保后台任务不会被立即挂起
	 task.expirationHandler = ^{
			 // 任务到期时调用
			 [task setTaskCompletedWithSuccess:NO];
			 scheduleBackgroundTask();  // 重新调度任务
	 };

	 // 启动 Pipy
	 startPipyInNewThread();

	 // 完成任务后调用
	 [task setTaskCompletedWithSuccess:YES];
}

// 注册后台任务
void registerBackgroundTasks() {
    [[BGTaskScheduler sharedScheduler] registerForTaskWithIdentifier:@"com.flomesh.ztm.pipy" usingQueue:nil launchHandler:^(BGTask *task) {
        handleBackgroundTask((BGProcessingTask *)task);
    }];
}

// 提交后台任务
void scheduleBackgroundTask() {
    NSError *error = nil;
    
    BGProcessingTaskRequest *request = [[BGProcessingTaskRequest alloc] initWithIdentifier:@"com.flomesh.ztm.pipy"];
    
    // 设置任务条件，例如要求网络连接等
    request.requiresNetworkConnectivity = NO;  // 不需要网络
    request.requiresExternalPower = NO;        // 不需要外部电源
    
    // 提交任务
    BOOL success = [[BGTaskScheduler sharedScheduler] submitTaskRequest:request error:&error];
    
    if (!success) {
        NSLog(@"提交后台任务失败: %@", error);
    } else {
        NSLog(@"后台任务提交成功");
    }
}

// 注册应用程序后台任务
bool applicationDidFinishLaunchingWithOptions(UIApplication *application, NSDictionary *launchOptions) {
    registerBackgroundTasks();
		// scheduleBackgroundTask();
    return true;
}

int main(int argc, char * argv[]) {
    @autoreleasepool {
			// 注册后台任务
			applicationDidFinishLaunchingWithOptions([UIApplication sharedApplication], nil);
			// 启动 Pipy
			scheduleBackgroundTask();
			ffi::start_app();
    }
    return 0;
}
