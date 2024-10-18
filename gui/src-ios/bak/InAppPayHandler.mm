#import <Foundation/Foundation.h>
#import <StoreKit/StoreKit.h>

// 确保使用 @import StoreKit 以加载 StoreKit 2 API
// @import StoreKit;

@interface InAppPayHandler : NSObject

+ (instancetype)sharedManager;
- (void)purchaseProductWithID;

@end

@implementation InAppPayHandler

+ (instancetype)sharedManager {
    static InAppPayHandler *sharedManager = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedManager = [[InAppPayHandler alloc] init];
    });
    return sharedManager;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        // 初始化逻辑
    }
    return self;
}

- (void)purchaseProductWithID {
    NSString *productIdentifier = @"com.flomesh.ztm.sub.awshub";
		NSLog(@"start purchaseProductWithID.");
    // 使用现代化的 StoreKit 2 API 来请求产品信息
    [self fetchProductWithID:productIdentifier completion:^(Product *product) {
        if (product) {
            // 找到产品后进行购买
            [self purchaseProduct:product];
        } else {
            NSLog(@"Product not found.");
        }
    }];
}

// 使用 StoreKit 2 的方式获取产品
- (void)fetchProductWithID:(NSString *)productIdentifier completion:(void (^)(Product *))completion {
    NSSet *productIdentifiers = [NSSet setWithObject:productIdentifier];
    
    NSLog(@"start fetchProductWithID.");
    // 从商店获取产品
    [Product productsFor:productIdentifiers completionHandler:^(NSArray<Product *> *products, NSError *error) {
        if (error == nil && products.count > 0) {
						NSLog(@"get products.");
            Product *product = products.firstObject;
            completion(product);
        } else {
            completion(nil);
        }
    }];
}

}

// 使用 StoreKit 2 发起购买操作
- (void)purchaseProduct:(Product *)product {
    if (@available(iOS 15.0, *)) {
        // 发起异步购买请求
        [product purchaseWithCompletion:^(StoreKit.Transaction *transaction, NSError *purchaseError) {
            if (transaction) {
                switch (transaction.transactionState) {
                    case StoreKit.TransactionStatePurchased:
                        NSLog(@"Purchase successful!");
                        // 完成购买，标记为已处理
                        [transaction finish];
                        break;

                    case StoreKit.TransactionStateFailed:
                        NSLog(@"Purchase failed: %@", purchaseError.localizedDescription);
                        [transaction finish];
                        break;

                    default:
                        break;
                }
            } else {
                NSLog(@"Purchase failed: %@", purchaseError.localizedDescription);
            }
        }];
    } else {
        NSLog(@"StoreKit 2 is not available on this device.");
    }
}

@end