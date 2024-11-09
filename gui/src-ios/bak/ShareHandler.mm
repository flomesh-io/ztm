#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@interface ShareHandler : NSObject

+ (instancetype)sharedManager;
- (void)shareFile:(NSURL *)fileURL;
@end

@implementation ShareHandler

+ (instancetype)sharedManager {
    static ShareHandler *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[ShareHandler alloc] init];
    });
    return sharedInstance;
}


NSString* getPath(NSURL *fileURL) {
    
    NSString *filePath = [fileURL path];
    
    // 如果路径以 "/private" 开头，则移除这个前缀
    if ([filePath hasPrefix:@"/private"]) {
        filePath = [filePath stringByReplacingOccurrencesOfString:@"/private" withString:@""];
    }
    
    
    NSString *homeDirectory = NSHomeDirectory();
        
        // 将沙盒路径部分替换为 "./"
    NSString *relativePath = [filePath stringByReplacingOccurrencesOfString:homeDirectory withString:@""];
    if ([relativePath hasPrefix:@"/"]) {
        // 如果路径以 "/" 开头，移除第一个字符
        relativePath = [relativePath substringFromIndex:1];
    }
    
    
    NSString *path = [NSHomeDirectory() stringByAppendingPathComponent:relativePath];
   
    NSLog(@"相对路径2: %@", path);
    
    // 检查文件是否存在
    if (![[NSFileManager defaultManager] fileExistsAtPath:path]) {
        NSLog(@"文件不存在: %@", path);
        return nil;
    }
    
    
    return path;
}

- (void)shareFile:(NSURL *)fileURL {
    if (!fileURL) {
        NSLog(@"Error: fileURL is nil.");
        return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        // 检查文件是否存在
        if (![[NSFileManager defaultManager] fileExistsAtPath:fileURL.path]) {
            NSLog(@"Error: File does not exist at path: %@", fileURL.path);
            return;
        }
        
        // 准备分享内容
        NSMutableArray *activityItems = [NSMutableArray array];

        NSString *path = getPath(fileURL);
        NSURL *relativeURL = [NSURL fileURLWithPath:path];
        [activityItems addObject:relativeURL];
        
        // 初始化 UIActivityViewController
        UIActivityViewController *activityVC = [[UIActivityViewController alloc] initWithActivityItems:activityItems applicationActivities:nil];

        // 显示分享视图控制器
        UIViewController *rootVC = [UIApplication sharedApplication].keyWindow.rootViewController;
        if (rootVC) {
            [rootVC presentViewController:activityVC animated:YES completion:nil];
        } else {
            NSLog(@"Error: rootVC is nil.");
        }
    });
}

@end
