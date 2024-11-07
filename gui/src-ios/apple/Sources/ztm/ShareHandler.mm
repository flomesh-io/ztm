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
        
            [activityItems addObject:fileURL];
//
//            // 根据文件扩展名选择处理方式
//            NSString *fileExtension = fileURL.pathExtension.lowercaseString;
//            
//            if ([fileExtension isEqualToString:@"pdf"]) {
//                // PDF 文件
//                NSData *pdfData = [NSData dataWithContentsOfURL:fileURL];
//                if (pdfData) {
//                    [activityItems addObject:pdfData];
//                }
//            } else if ([fileExtension isEqualToString:@"jpg"] || [fileExtension isEqualToString:@"jpeg"] || [fileExtension isEqualToString:@"png"]) {
//                // 图片文件
//                UIImage *image = [UIImage imageWithContentsOfFile:fileURL.path];
//                if (image) {
//                    [activityItems addObject:image];
//                }
//            } else if ([fileExtension isEqualToString:@"txt"] || [fileExtension isEqualToString:@"md"]) {
//                // 文本文件
//                NSString *text = [NSString stringWithContentsOfURL:fileURL encoding:NSUTF8StringEncoding error:nil];
//                if (text) {
//                    [activityItems addObject:text];
//                }
//            } else {
//                // 其他文件类型直接读取为 NSData
//                NSData *fileData = [NSData dataWithContentsOfURL:fileURL];
//                if (fileData) {
//                    [activityItems addObject:fileData];
//                }
//            }
            
            // 初始化 UIActivityViewController
            UIActivityViewController *activityVC = [[UIActivityViewController alloc] initWithActivityItems:activityItems applicationActivities:nil];
            
            // 配置排除的活动类型（可选）
            activityVC.excludedActivityTypes = @[
                    UIActivityTypePrint
            ];
            
            // 显示分享视图控制器
            UIViewController *rootVC = [UIApplication sharedApplication].keyWindow.rootViewController;
            [rootVC presentViewController:activityVC animated:YES completion:nil];
    });
}

@end
